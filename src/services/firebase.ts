/**
 * Firebase Client Integration & Cloud Synchronisation Service for PrepPilot
 * Handles:
 * - Firebase Authentication (Google Sign-In, persistence, guest fallback)
 * - User-scoped Firestore synchronization (/users/{uid}/...)
 * - Real-time listeners for cross-device live updates
 * - Two-way merging for first-time cloud synchronization
 * - Reliable confirmation of writes (never claiming sync if write fails)
 * - Web Push notification tokens (FCM)
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut as fbSignOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  deleteDoc,
  collection,
  onSnapshot,
  writeBatch,
  enableIndexedDbPersistence,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import {
  SyllabusSubject,
  SyllabusTopic,
  TaskItem,
  TimetableSlot,
  LoggedStudySession,
  PYQEntry,
  MockTest,
  ErrorLogEntry,
  SpacedRevisionItem,
  MonthlyGoal,
  UserConfig,
  AppNotification,
  PYQPaperRecord,
  DevicePushRecord,
  NotificationDeliveryStatus,
} from '../types';

// Environment variables configuration with safe cross-environment fallback
const getEnvVar = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return (import.meta.env as any)[key] || '';
    }
  } catch {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || '';
    }
  } catch {
    // ignore
  }
  return '';
};

export const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID'),
};

export const VAPID_KEY = getEnvVar('VITE_FIREBASE_VAPID_KEY');

export function isVapidConfigured(): boolean {
  return Boolean(VAPID_KEY && VAPID_KEY.trim().length > 10);
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;
let messaging: Messaging | null = null;

if (typeof window !== 'undefined' && isFirebaseConfigured()) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);

    // Initialize Firestore with ignoreUndefinedProperties to complement payload sanitization
    try {
      firestore = initializeFirestore(app, {
        ignoreUndefinedProperties: true,
      });
    } catch {
      firestore = getFirestore(app);
    }

    // Try offline persistence for Firestore web client
    try {
      enableIndexedDbPersistence(firestore).catch((err) => {
        if (err.code === 'failed-precondition') {
          // Multiple tabs open, persistence can only be enabled in one tab at a time.
        } else if (err.code === 'unimplemented') {
          // The current browser does not support all of the features required to enable persistence
        }
      });
    } catch {
      // Ignore if already enabled or unsupported
    }
  } catch (err) {
    console.warn('Firebase initialization skipped/failed:', err);
  }
}

export { app, auth, firestore };

export type SyncStatusState =
  | 'idle'
  | 'local_only'
  | 'signing_in'
  | 'syncing'
  | 'synced'
  | 'migration_pending'
  | 'offline_pending'
  | 'offline'
  | 'error';

export interface SyncDiagnostic {
  status: SyncStatusState;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  isCloudConnected: boolean;
}

// =============================================================================
// AUTHENTICATION ERROR PARSING
// =============================================================================

export function formatAuthErrorMessage(err: any): string {
  if (!err) return 'An unknown error occurred.';
  const code = err.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Please provide a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account was found with this email. Please check your spelling or create an account.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please verify your password or use "Forgot Password".';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please choose a password with at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in Firebase Console. Please enable it under Firebase Console > Authentication > Sign-in method.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled before completion.';
    case 'auth/popup-blocked':
      return 'The sign-in popup was blocked by your browser. Please allow popups for this site.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Console. Add this domain under Authentication > Settings > Authorized domains.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please verify your internet connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Access is temporarily disabled. Please reset your password or try again later.';
    case 'auth/requires-recent-login':
      return 'This action requires you to re-authenticate. Please log in again.';
    default:
      return err.message || 'Authentication failed. Please try again.';
  }
}

// =============================================================================
// AUTHENTICATION FUNCTIONS
// =============================================================================

export function getCurrentFirebaseUser(): FirebaseUser | null {
  return auth?.currentUser || null;
}

export async function signInWithGoogle(): Promise<{ user: FirebaseUser | null; error?: string }> {
  if (!isFirebaseConfigured() || !auth) {
    return {
      user: null,
      error: 'Firebase is not yet configured with environment variables in this environment.',
    };
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const credential = await signInWithPopup(auth, provider);
    return { user: credential.user };
  } catch (err: any) {
    console.error('Google Sign-In Popup error:', err);
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/popup-closed-by-user') {
      try {
        await signInWithRedirect(auth, provider);
        return { user: null };
      } catch (redirectErr: any) {
        return { user: null, error: formatAuthErrorMessage(redirectErr) };
      }
    }
    return { user: null, error: formatAuthErrorMessage(err) };
  }
}

export async function signInWithEmailPassword(
  email: string,
  pass: string
): Promise<{ user: FirebaseUser | null; error?: string }> {
  if (!isFirebaseConfigured() || !auth) {
    return {
      user: null,
      error: 'Firebase is not yet configured with environment variables in this environment.',
    };
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return { user: credential.user };
  } catch (err: any) {
    console.error('Email Sign-In error:', err);
    return { user: null, error: formatAuthErrorMessage(err) };
  }
}

export async function signUpWithEmailPassword(
  email: string,
  pass: string,
  displayName?: string
): Promise<{ user: FirebaseUser | null; error?: string; verificationSent?: boolean }> {
  if (!isFirebaseConfigured() || !auth) {
    return {
      user: null,
      error: 'Firebase is not yet configured with environment variables in this environment.',
    };
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    const user = credential.user;

    // Attach display name if provided
    if (displayName && displayName.trim()) {
      try {
        await updateProfile(user, { displayName: displayName.trim() });
      } catch (profErr) {
        console.warn('Could not set displayName on created user:', profErr);
      }
    }

    // Attempt to send email verification link
    let verificationSent = false;
    try {
      await sendEmailVerification(user);
      verificationSent = true;
    } catch (verErr) {
      console.warn('Could not send initial verification email:', verErr);
    }

    return { user, verificationSent };
  } catch (err: any) {
    console.error('Email Sign-Up error:', err);
    return { user: null, error: formatAuthErrorMessage(err) };
  }
}

export async function sendPasswordResetEmailUser(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseConfigured() || !auth) {
    return {
      success: false,
      error: 'Firebase is not yet configured with environment variables in this environment.',
    };
  }

  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { success: true };
  } catch (err: any) {
    console.error('Password reset error:', err);
    return { success: false, error: formatAuthErrorMessage(err) };
  }
}

export async function sendEmailVerificationUser(): Promise<{ success: boolean; error?: string }> {
  if (!auth || !auth.currentUser) {
    return { success: false, error: 'No authenticated user to send verification email to.' };
  }

  try {
    await sendEmailVerification(auth.currentUser);
    return { success: true };
  } catch (err: any) {
    console.error('Resend verification error:', err);
    return { success: false, error: formatAuthErrorMessage(err) };
  }
}

export async function reloadCurrentUser(): Promise<{ user: FirebaseUser | null; error?: string }> {
  if (!auth || !auth.currentUser) return { user: null };
  try {
    await auth.currentUser.reload();
    return { user: auth.currentUser };
  } catch (err: any) {
    return { user: auth.currentUser, error: formatAuthErrorMessage(err) };
  }
}

export async function signOutUser(): Promise<{ success: boolean; error?: string }> {
  if (!auth) return { success: true };
  try {
    await fbSignOut(auth);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: formatAuthErrorMessage(err) };
  }
}

export function subscribeToAuthChanges(callback: (user: FirebaseUser | null) => void): Unsubscribe {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

// =============================================================================
// CLOUD FIRESTORE DATA PERSISTENCE & TWO-WAY MERGING
// =============================================================================

export interface FullUserDataPayload {
  tasks: TaskItem[];
  subjects: SyllabusSubject[];
  timetableSlots: TimetableSlot[];
  studySessions: LoggedStudySession[];
  pyqEntries: PYQEntry[];
  mockTests: MockTest[];
  errorLogs: ErrorLogEntry[];
  revisionItems: SpacedRevisionItem[];
  monthlyGoals: MonthlyGoal[];
  userConfig: Partial<UserConfig>;
  pyqPaperRecords: Record<number, PYQPaperRecord>;
}

/**
 * Fetch remote state from Cloud Firestore under users/{userId}
 */
export async function fetchRemoteUserData(userId: string): Promise<{
  data: FullUserDataPayload | null;
  exists: boolean;
  error?: string;
}> {
  if (!firestore) return { data: null, exists: false, error: 'Firestore not initialized' };

  try {
    const userDocRef = doc(firestore, 'users', userId);
    const snap = await getDoc(userDocRef);

    if (!snap.exists()) {
      return { data: null, exists: false };
    }

    const raw = snap.data();
    return {
      exists: true,
      data: {
        tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
        subjects: Array.isArray(raw.subjects) ? raw.subjects : [],
        timetableSlots: Array.isArray(raw.timetableSlots) ? raw.timetableSlots : [],
        studySessions: Array.isArray(raw.studySessions) ? raw.studySessions : [],
        pyqEntries: Array.isArray(raw.pyqEntries) ? raw.pyqEntries : [],
        mockTests: Array.isArray(raw.mockTests) ? raw.mockTests : [],
        errorLogs: Array.isArray(raw.errorLogs) ? raw.errorLogs : [],
        revisionItems: Array.isArray(raw.revisionItems) ? raw.revisionItems : [],
        monthlyGoals: Array.isArray(raw.monthlyGoals) ? raw.monthlyGoals : [],
        userConfig: raw.userConfig || {},
        pyqPaperRecords: raw.pyqPaperRecords || {},
      },
    };
  } catch (err: any) {
    console.error('fetchRemoteUserData error:', err);
    return { data: null, exists: false, error: err?.message || 'Failed to read from Firestore' };
  }
}

/**
 * Recursively inspects any object or array to find all property paths
 * whose value is `undefined`.
 * Used for development diagnostics without logging sensitive user data.
 */
export function findUndefinedFieldPaths(obj: unknown, currentPath = ''): string[] {
  const paths: string[] = [];
  if (obj === undefined) {
    if (currentPath) paths.push(currentPath);
    return paths;
  }
  if (obj === null) return paths;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const p = currentPath ? `${currentPath}[${i}]` : `[${i}]`;
      if (obj[i] === undefined) {
        paths.push(p);
      } else {
        paths.push(...findUndefinedFieldPaths(obj[i], p));
      }
    }
    return paths;
  }

  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const p = currentPath ? `${currentPath}.${key}` : key;
      const val = (obj as Record<string, any>)[key];
      if (val === undefined) {
        paths.push(p);
      } else if (val !== null && typeof val === 'object') {
        paths.push(...findUndefinedFieldPaths(val, p));
      }
    }
  }

  return paths;
}

/**
 * Checks if a value is a plain JavaScript object (not an Array, Date, null, etc.).
 */
export function isPlainObject(obj: unknown): obj is Record<string, any> {
  if (obj === null || typeof obj !== 'object') return false;
  const proto = Object.getPrototypeOf(obj);
  return proto === Object.prototype || proto === null;
}

/**
 * Normalizes and sanitizes a payload before Firestore persistence:
 * - Recursively removes properties whose values are `undefined` from plain objects.
 * - Preserves valid strings, numbers, booleans, dates/timestamps, null values, arrays, and nested objects.
 * - Handles undefined array entries deliberately: removes undefined items so Firestore never receives
 *   an unsupported undefined array value, preserving valid items in order.
 * - Preserves explicit null values (e.g. exactExamDate: null, fcmToken: null).
 * - Avoids mutating the original local records.
 */
export function sanitizeFirestoreData<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (Array.isArray(input)) {
    const sanitizedArray: any[] = [];
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      if (item !== undefined) {
        sanitizedArray.push(sanitizeFirestoreData(item));
      }
    }
    return sanitizedArray as unknown as T;
  }

  if (isPlainObject(input)) {
    const sanitizedObj: Record<string, any> = {};
    for (const key of Object.keys(input)) {
      const val = (input as Record<string, any>)[key];
      if (val !== undefined) {
        sanitizedObj[key] = sanitizeFirestoreData(val);
      }
    }
    return sanitizedObj as unknown as T;
  }

  return input;
}

export interface PayloadValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates the required structure and required fields of a FullUserDataPayload.
 * Ensures critical data is not missing or corrupted before writing to Firestore.
 */
export function validateUserDataPayload(payload: unknown): PayloadValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { isValid: false, errors: ['Payload must be a non-null object'] };
  }

  const p = payload as Record<string, any>;

  const requiredArrays = [
    'tasks',
    'subjects',
    'timetableSlots',
    'studySessions',
    'pyqEntries',
    'mockTests',
    'errorLogs',
    'revisionItems',
    'monthlyGoals',
  ];

  for (const arrName of requiredArrays) {
    if (!Array.isArray(p[arrName])) {
      errors.push(`Missing or invalid collection: ${arrName} must be an array`);
    }
  }

  if (!p.userConfig || typeof p.userConfig !== 'object' || Array.isArray(p.userConfig)) {
    errors.push('Missing or invalid userConfig: must be an object');
  }

  if (!p.pyqPaperRecords || typeof p.pyqPaperRecords !== 'object' || Array.isArray(p.pyqPaperRecords)) {
    errors.push('Missing or invalid pyqPaperRecords: must be an object');
  }

  // Validate tasks items
  if (Array.isArray(p.tasks)) {
    for (let i = 0; i < p.tasks.length; i++) {
      const t = p.tasks[i];
      if (!t || typeof t !== 'object') {
        errors.push(`tasks[${i}] must be an object`);
        continue;
      }
      if (!t.id || typeof t.id !== 'string') errors.push(`tasks[${i}].id is required`);
      if (!t.title || typeof t.title !== 'string') errors.push(`tasks[${i}].title is required`);
      if (!t.taskType || typeof t.taskType !== 'string') errors.push(`tasks[${i}].taskType is required`);
      if (!t.status || (t.status !== 'pending' && t.status !== 'completed')) {
        errors.push(`tasks[${i}].status must be pending or completed`);
      }
    }
  }

  // Validate subjects items
  if (Array.isArray(p.subjects)) {
    for (let i = 0; i < p.subjects.length; i++) {
      const s = p.subjects[i];
      if (!s || typeof s !== 'object') {
        errors.push(`subjects[${i}] must be an object`);
        continue;
      }
      if (!s.id || typeof s.id !== 'string') errors.push(`subjects[${i}].id is required`);
      if (!s.name || typeof s.name !== 'string') errors.push(`subjects[${i}].name is required`);
      if (!Array.isArray(s.chapters)) errors.push(`subjects[${i}].chapters must be an array`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Push full local dataset to Cloud Firestore under users/{userId}
 * Ensures all collections are validated, sanitized, and saved safely.
 */
export async function uploadFullLocalDataToRemote(
  userId: string,
  payload: FullUserDataPayload
): Promise<{ success: boolean; error?: string }> {
  if (!firestore) return { success: false, error: 'Firestore not initialized' };
  if (!userId) return { success: false, error: 'User ID is missing or unauthenticated' };

  try {
    // 1. Diagnostics: detect undefined property paths and log them without exposing sensitive data
    const undefinedPaths = findUndefinedFieldPaths(payload);
    if (undefinedPaths.length > 0) {
      console.warn(
        `[PrepPilot Firestore Diagnostics] Detected ${undefinedPaths.length} undefined field(s) before sanitization: ${undefinedPaths.slice(0, 10).join(', ')}${undefinedPaths.length > 10 ? ' (and more...)' : ''}`
      );
    }

    // 2. Validate required structure
    const validation = validateUserDataPayload(payload);
    if (!validation.isValid) {
      const errorMsg = `Payload validation failed: ${validation.errors.slice(0, 5).join('; ')}`;
      console.error('uploadFullLocalDataToRemote error:', errorMsg);
      return { success: false, error: errorMsg };
    }

    // 3. Normalize & sanitize payload recursively (omits undefined without replacing with null)
    const sanitizedPayload = sanitizeFirestoreData(payload);

    const userDocRef = doc(firestore, 'users', userId);
    await setDoc(
      userDocRef,
      {
        ...sanitizedPayload,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { success: true };
  } catch (err: any) {
    console.error('uploadFullLocalDataToRemote error:', err);
    return { success: false, error: err?.message || 'Failed to upload to Firestore' };
  }
}

/**
 * Save a single entity change to Firestore (e.g. updated task, logged session)
 */
export async function syncEntityUpdateToFirestore(
  userId: string,
  field: keyof FullUserDataPayload,
  data: any
): Promise<{ success: boolean; error?: string }> {
  if (!firestore || !userId) return { success: false, error: 'Not authenticated or Firestore inactive' };

  try {
    const undefinedPaths = findUndefinedFieldPaths({ [field]: data });
    if (undefinedPaths.length > 0) {
      console.warn(
        `[PrepPilot Firestore Diagnostics] Detected undefined in entity update (${String(field)}): ${undefinedPaths.slice(0, 5).join(', ')}`
      );
    }

    const sanitizedData = sanitizeFirestoreData(data);
    const userDocRef = doc(firestore, 'users', userId);
    await setDoc(
      userDocRef,
      {
        [field]: sanitizedData,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { success: true };
  } catch (err: any) {
    console.error(`syncEntityUpdateToFirestore (${field}) failed:`, err);
    return { success: false, error: err?.message || `Failed to update ${String(field)}` };
  }
}

/**
 * Listen for live remote changes on users/{userId} for cross-device live updates
 */
export function subscribeToRemoteUserData(
  userId: string,
  onRemoteUpdate: (remoteData: FullUserDataPayload) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!firestore || !userId) {
    return () => {};
  }

  const userDocRef = doc(firestore, 'users', userId);
  return onSnapshot(
    userDocRef,
    (snap) => {
      if (!snap.exists()) return;
      const raw = snap.data();
      const payload: FullUserDataPayload = {
        tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
        subjects: Array.isArray(raw.subjects) ? raw.subjects : [],
        timetableSlots: Array.isArray(raw.timetableSlots) ? raw.timetableSlots : [],
        studySessions: Array.isArray(raw.studySessions) ? raw.studySessions : [],
        pyqEntries: Array.isArray(raw.pyqEntries) ? raw.pyqEntries : [],
        mockTests: Array.isArray(raw.mockTests) ? raw.mockTests : [],
        errorLogs: Array.isArray(raw.errorLogs) ? raw.errorLogs : [],
        revisionItems: Array.isArray(raw.revisionItems) ? raw.revisionItems : [],
        monthlyGoals: Array.isArray(raw.monthlyGoals) ? raw.monthlyGoals : [],
        userConfig: raw.userConfig || {},
        pyqPaperRecords: raw.pyqPaperRecords || {},
      };
      onRemoteUpdate(payload);
    },
    (err) => {
      console.warn('subscribeToRemoteUserData snapshot error:', err);
      onError(err);
    }
  );
}

// =============================================================================
// SAFE TWO-WAY MERGE STRATEGY
// =============================================================================

/**
 * Helper to safely parse an ISO timestamp into epoch milliseconds.
 */
export function parseIsoTimestamp(timeStr?: string | null): number {
  if (!timeStr) return 0;
  const parsed = new Date(timeStr).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Helper to extract the most accurate timestamp for a record.
 * Checks all possible lifecycle timestamps (deletedAt, updatedAt, completedAt, loggedAt, createdAt, date)
 * and returns the latest epoch milliseconds.
 */
export function getItemTimestamp(item: any): number {
  if (!item) return 0;
  const tDeleted = parseIsoTimestamp(item.deletedAt);
  const tUpdated = parseIsoTimestamp(item.updatedAt);
  const tCompleted = parseIsoTimestamp(item.completedAt);
  const tLogged = parseIsoTimestamp(item.loggedAt);
  const tCreated = parseIsoTimestamp(item.createdAt);
  const tDate = parseIsoTimestamp(item.date);

  return Math.max(tDeleted, tUpdated, tCompleted, tLogged, tCreated, tDate);
}

/**
 * Helper to extract the most accurate timestamp for a topic.
 * Checks updatedAt first (representing any status or completion change), then completedAt.
 */
export function getTopicTimestamp(topic: SyllabusTopic | undefined | null): number {
  if (!topic) return 0;
  const tUpdated = parseIsoTimestamp(topic.updatedAt);
  const tCompleted = parseIsoTimestamp(topic.completedAt);
  return Math.max(tUpdated, tCompleted);
}

/**
 * Deterministic merge of two lists of items uniquely by 'id'.
 * Rules:
 * 1. If both items have deletion tombstones, the newer deletion wins.
 * 2. If one has a deletedAt tombstone, the deletion wins if its deletion timestamp
 *    is newer than or equal to the competing record's update/creation timestamp,
 *    or if the competing record lacks update metadata (safe migration fallback).
 * 3. If an item was edited strictly after a deletion timestamp on another device,
 *    the newer edit takes precedence.
 * 4. If neither has a tombstone, the record with the newer updatedAt/createdAt wins (LWW).
 * 5. includeTombstones defaults to true to allow durable tombstone propagation across devices.
 */
export function mergeItemsById<T extends { id: string; updatedAt?: string; deletedAt?: string; createdAt?: string }>(
  localList: T[],
  remoteList: T[],
  includeTombstones = true
): T[] {
  const map = new Map<string, T>();

  // Add remote items first
  for (const remoteItem of remoteList || []) {
    if (remoteItem && remoteItem.id) {
      map.set(remoteItem.id, remoteItem);
    }
  }

  // Compare each local item against remote item with same ID
  for (const localItem of localList || []) {
    if (!localItem || !localItem.id) continue;

    const existing = map.get(localItem.id);
    if (!existing) {
      map.set(localItem.id, localItem);
      continue;
    }

    const localTime = getItemTimestamp(localItem);
    const remoteTime = getItemTimestamp(existing);

    // Case 1: Both have deletion tombstones -> newer deletion wins
    if (localItem.deletedAt && existing.deletedAt) {
      if (localTime >= remoteTime) {
        map.set(localItem.id, localItem);
      } else {
        map.set(localItem.id, existing);
      }
      continue;
    }

    // Case 2: Local was deleted, remote is active
    if (localItem.deletedAt && !existing.deletedAt) {
      // Deletion wins unless remote was modified strictly AFTER the local deletion
      if (localTime >= remoteTime || remoteTime === 0) {
        map.set(localItem.id, localItem);
      } else {
        map.set(localItem.id, existing);
      }
      continue;
    }

    // Case 3: Remote was deleted, local is active
    if (existing.deletedAt && !localItem.deletedAt) {
      // Deletion wins unless local was modified strictly AFTER the remote deletion
      if (remoteTime >= localTime || localTime === 0) {
        map.set(localItem.id, existing);
      } else {
        map.set(localItem.id, localItem);
      }
      continue;
    }

    // Case 4: Neither is deleted -> newer record wins (LWW)
    if (localTime >= remoteTime) {
      map.set(localItem.id, localItem);
    } else {
      map.set(localItem.id, existing);
    }
  }

  const allItems = Array.from(map.values());
  if (includeTombstones) {
    return allItems;
  }
  return allItems.filter((item) => !item.deletedAt);
}

/**
 * Deterministic merge of two SyllabusTopic instances.
 * Resolves completion/uncompletion conflicts via update metadata (LWW)
 * while preserving cumulative study metrics (questionsSolved, actualHours).
 */
export function mergeTopics(localTop: SyllabusTopic, remoteTop: SyllabusTopic): SyllabusTopic {
  const localTime = getTopicTimestamp(localTop);
  const remoteTime = getTopicTimestamp(remoteTop);

  // Preserve cumulative study work (never lose solved questions or logged hours)
  const questionsSolved = Math.max(localTop.questionsSolved || 0, remoteTop.questionsSolved || 0);
  const questionsCorrect = Math.max(localTop.questionsCorrect || 0, remoteTop.questionsCorrect || 0);
  const actualHours = Math.max(localTop.actualHours || 0, remoteTop.actualHours || 0);

  let resolvedCompleted: boolean;
  let resolvedCompletedAt: string | undefined;
  let resolvedStatus: SyllabusTopic['status'];
  let resolvedUpdatedAt: string | undefined;

  if (localTime > remoteTime) {
    // Local topic state is strictly newer
    resolvedCompleted = localTop.completed;
    resolvedCompletedAt = localTop.completed ? (localTop.completedAt || new Date(localTime).toISOString()) : undefined;
    resolvedStatus = localTop.status;
    resolvedUpdatedAt = localTop.updatedAt || new Date(localTime).toISOString();
  } else if (remoteTime > localTime) {
    // Remote topic state is strictly newer
    resolvedCompleted = remoteTop.completed;
    resolvedCompletedAt = remoteTop.completed ? (remoteTop.completedAt || new Date(remoteTime).toISOString()) : undefined;
    resolvedStatus = remoteTop.status;
    resolvedUpdatedAt = remoteTop.updatedAt || new Date(remoteTime).toISOString();
  } else {
    // Same timestamp or historical records without timestamps (safe migration fallback)
    if (localTop.completed === remoteTop.completed) {
      resolvedCompleted = localTop.completed;
      resolvedCompletedAt = localTop.completedAt || remoteTop.completedAt;
      resolvedStatus = localTop.status !== 'not_started' ? localTop.status : remoteTop.status;
    } else {
      // One is completed, one is not, and timestamps are equal/missing
      if (localTop.completed && localTop.completedAt && !remoteTop.completedAt) {
        resolvedCompleted = true;
        resolvedCompletedAt = localTop.completedAt;
        resolvedStatus = 'completed';
      } else if (remoteTop.completed && remoteTop.completedAt && !localTop.completedAt) {
        resolvedCompleted = true;
        resolvedCompletedAt = remoteTop.completedAt;
        resolvedStatus = 'completed';
      } else {
        // Fallback for untimestamped historical data: preserve completion if either marked complete
        resolvedCompleted = localTop.completed || remoteTop.completed;
        resolvedCompletedAt = localTop.completedAt || remoteTop.completedAt;
        resolvedStatus = resolvedCompleted ? 'completed' : localTop.status;
      }
    }
    resolvedUpdatedAt = localTop.updatedAt || remoteTop.updatedAt;
  }

  const notes = localTop.notes?.trim()
    ? localTop.notes
    : remoteTop.notes?.trim()
    ? remoteTop.notes
    : localTop.notes;

  const mergedTopic: SyllabusTopic = {
    ...localTop,
    completed: resolvedCompleted,
    status: resolvedStatus,
    questionsSolved,
    questionsCorrect,
    actualHours,
    notes,
  };

  if (resolvedCompleted && resolvedCompletedAt) {
    mergedTopic.completedAt = resolvedCompletedAt;
  } else {
    delete (mergedTopic as any).completedAt;
  }

  if (resolvedUpdatedAt) {
    mergedTopic.updatedAt = resolvedUpdatedAt;
  }

  if (localTop.lastRevisionDate || remoteTop.lastRevisionDate) {
    mergedTopic.lastRevisionDate = localTop.lastRevisionDate || remoteTop.lastRevisionDate;
  }
  if (localTop.nextRevisionDate || remoteTop.nextRevisionDate) {
    mergedTopic.nextRevisionDate = localTop.nextRevisionDate || remoteTop.nextRevisionDate;
  }

  return mergedTopic;
}

/**
 * Deterministic merge of subjects tree using mergeTopics.
 * Preserves custom topics and chapters added on either device.
 */
export function mergeSubjects(
  localSubjects: SyllabusSubject[],
  remoteSubjects: SyllabusSubject[]
): SyllabusSubject[] {
  if (!remoteSubjects || remoteSubjects.length === 0) return localSubjects;
  if (!localSubjects || localSubjects.length === 0) return remoteSubjects;

  const remoteSubjMap = new Map(remoteSubjects.map((s) => [s.id, s]));

  const merged = localSubjects.map((localSubj) => {
    const remoteSubj = remoteSubjMap.get(localSubj.id);
    if (!remoteSubj) return localSubj;

    const remoteChMap = new Map(remoteSubj.chapters.map((c) => [c.id, c]));

    const mergedChapters = localSubj.chapters.map((localCh) => {
      const remoteCh = remoteChMap.get(localCh.id);
      if (!remoteCh) return localCh;

      const remoteTopMap = new Map(remoteCh.topics.map((t) => [t.id, t]));
      const mergedTopicsList = localCh.topics.map((localTop) => {
        const remoteTop = remoteTopMap.get(localTop.id);
        if (!remoteTop) return localTop;
        return mergeTopics(localTop, remoteTop);
      });

      // Also append any custom topics present in remote but missing in local
      for (const remoteTop of remoteCh.topics) {
        if (!localCh.topics.some((t) => t.id === remoteTop.id)) {
          mergedTopicsList.push(remoteTop);
        }
      }

      return {
        ...localCh,
        topics: mergedTopicsList,
      };
    });

    // Also append any custom chapters present in remote but missing in local
    for (const remoteCh of remoteSubj.chapters) {
      if (!localSubj.chapters.some((c) => c.id === remoteCh.id)) {
        mergedChapters.push(remoteCh);
      }
    }

    return {
      ...localSubj,
      chapters: mergedChapters,
    };
  });

  // Also append any subjects in remote not in local
  for (const remoteSubj of remoteSubjects) {
    if (!localSubjects.some((s) => s.id === remoteSubj.id)) {
      merged.push(remoteSubj);
    }
  }

  return merged;
}

/**
 * Merges local and remote user preferences without overwriting valid existing
 * preferences with empty default values.
 */
export function mergeUserConfig(
  localConfig?: Partial<UserConfig>,
  remoteConfig?: Partial<UserConfig>
): Partial<UserConfig> {
  const result: Partial<UserConfig> = { ...(remoteConfig || {}) };
  if (!localConfig) return result;

  for (const [k, localVal] of Object.entries(localConfig)) {
    const key = k as keyof UserConfig;
    const remoteVal = remoteConfig ? remoteConfig[key] : undefined;

    if (localVal === undefined) continue;

    // If remote has a valid non-empty value and local has an empty default, preserve remote
    if (remoteVal !== undefined && remoteVal !== null && remoteVal !== '') {
      if (localVal === null || localVal === '') {
        result[key] = remoteVal as any;
        continue;
      }
    }

    result[key] = localVal as any;
  }

  return result;
}

/**
 * Safe merge between local state and cloud state upon user authentication.
 * Guarantees no data loss when user signs in on phone or laptop.
 */
export function mergeLocalAndRemoteData(
  local: FullUserDataPayload,
  remote: FullUserDataPayload
): FullUserDataPayload {
  // 1. Tasks: merge uniquely by ID with durable tombstone preservation
  const mergedTasks = mergeItemsById(local.tasks, remote.tasks, true);

  // 2. Study Sessions: merge uniquely by ID with tombstone preservation
  const mergedSessions = mergeItemsById(local.studySessions, remote.studySessions, true);

  // 3. PYQ Entries: merge uniquely by ID with tombstone preservation
  const mergedPYQ = mergeItemsById(local.pyqEntries, remote.pyqEntries, true);

  // 4. Mock Tests: merge uniquely by ID with tombstone preservation
  const mergedMocks = mergeItemsById(local.mockTests, remote.mockTests, true);

  // 5. Error Logs: merge uniquely by ID with tombstone preservation
  const mergedErrors = mergeItemsById(local.errorLogs, remote.errorLogs, true);

  // 6. Revision Items: merge uniquely by ID with tombstone preservation
  const mergedRevisions = mergeItemsById(local.revisionItems, remote.revisionItems, true);

  // 7. Monthly Goals: merge by monthKey
  const goalMap = new Map<string, MonthlyGoal>();
  for (const g of remote.monthlyGoals || []) goalMap.set(g.monthKey, g);
  for (const g of local.monthlyGoals || []) goalMap.set(g.monthKey, g);
  const mergedGoals = Array.from(goalMap.values());

  // 8. Timetable Slots: merge by slot ID with tombstone preservation
  const mergedSlots = mergeItemsById(local.timetableSlots, remote.timetableSlots, true);

  // 9. PYQ Paper Records (2011 to 2026): merge by year, preserving union of attempts
  const mergedPaperRecords: Record<number, PYQPaperRecord> = { ...remote.pyqPaperRecords };
  for (const [yearStr, localRec] of Object.entries(local.pyqPaperRecords || {})) {
    const yr = Number(yearStr);
    const remoteRec = mergedPaperRecords[yr];
    if (!remoteRec) {
      mergedPaperRecords[yr] = localRec;
    } else {
      // Merge attempts
      const combinedAttempts = mergeItemsById(localRec.attempts || [], remoteRec.attempts || [], true);
      const isPractised = localRec.status === 'practised' || remoteRec.status === 'practised';
      const isInProg = localRec.status === 'in_progress' || remoteRec.status === 'in_progress';
      const resolvedStatus = isPractised ? 'practised' : isInProg ? 'in_progress' : 'not_started';

      mergedPaperRecords[yr] = {
        ...remoteRec,
        status: resolvedStatus,
        attempts: combinedAttempts,
        firstOpenedAt: localRec.firstOpenedAt || remoteRec.firstOpenedAt,
        lastPractisedAt: localRec.lastPractisedAt || remoteRec.lastPractisedAt,
      };
    }
  }

  // 10. Subjects: Merge topic completion & questions solved deterministically
  const mergedSubjects = mergeSubjects(local.subjects, remote.subjects);

  // 11. User Config: merge safely without overwriting valid data with empty default values
  const mergedConfig = mergeUserConfig(local.userConfig, remote.userConfig);

  return {
    tasks: mergedTasks,
    subjects: mergedSubjects,
    timetableSlots: mergedSlots,
    studySessions: mergedSessions,
    pyqEntries: mergedPYQ,
    mockTests: mergedMocks,
    errorLogs: mergedErrors,
    revisionItems: mergedRevisions,
    monthlyGoals: mergedGoals,
    userConfig: mergedConfig,
    pyqPaperRecords: mergedPaperRecords,
  };
}

// =============================================================================
// LOCAL STUDY DATA DETECTION & PRE-MIGRATION BACKUP UTILITIES
// =============================================================================

export interface DataMigrationSummary {
  taskCount: number;
  sessionCount: number;
  mockCount: number;
  errorLogCount: number;
  pyqEntryCount: number;
  revisionCount: number;
  completedTopicsCount: number;
  pyqPaperAttemptCount: number;
}

export function getDataSummary(data: FullUserDataPayload | null | undefined): DataMigrationSummary {
  if (!data) {
    return {
      taskCount: 0,
      sessionCount: 0,
      mockCount: 0,
      errorLogCount: 0,
      pyqEntryCount: 0,
      revisionCount: 0,
      completedTopicsCount: 0,
      pyqPaperAttemptCount: 0,
    };
  }

  const completedTopicsCount = (data.subjects || []).reduce((acc, s) => {
    return (
      acc +
      (s.chapters || []).reduce((chAcc, c) => {
        return chAcc + (c.topics || []).filter((t) => t.completed).length;
      }, 0)
    );
  }, 0);

  const pyqPaperAttemptCount = Object.values(data.pyqPaperRecords || {}).reduce(
    (acc, p) => acc + (p?.attempts?.length || 0),
    0
  );

  return {
    taskCount: (data.tasks || []).filter((t) => !t.deletedAt).length,
    sessionCount: (data.studySessions || []).filter((s) => !s.deletedAt).length,
    mockCount: (data.mockTests || []).filter((m) => !m.deletedAt).length,
    errorLogCount: (data.errorLogs || []).filter((e) => !e.deletedAt).length,
    pyqEntryCount: (data.pyqEntries || []).filter((p) => !p.deletedAt).length,
    revisionCount: (data.revisionItems || []).filter((r) => !r.deletedAt).length,
    completedTopicsCount,
    pyqPaperAttemptCount,
  };
}

export function hasCustomUserData(data: FullUserDataPayload | null | undefined): boolean {
  if (!data) return false;
  const summary = getDataSummary(data);
  return (
    summary.taskCount > 0 ||
    summary.sessionCount > 0 ||
    summary.mockCount > 0 ||
    summary.errorLogCount > 0 ||
    summary.pyqEntryCount > 0 ||
    summary.revisionCount > 0 ||
    summary.completedTopicsCount > 0 ||
    summary.pyqPaperAttemptCount > 0
  );
}

export function savePreMigrationBackup(data: FullUserDataPayload): string {
  try {
    const timestamp = new Date().toISOString();
    const backupKey = `preppilot_pre_migration_backup_${Date.now()}`;
    const payload = {
      timestamp,
      summary: getDataSummary(data),
      data,
      payload: data,
    };
    localStorage.setItem(backupKey, JSON.stringify(payload));

    const rawKeys = localStorage.getItem('preppilot_migration_backup_keys');
    const keys: string[] = rawKeys ? JSON.parse(rawKeys) : [];
    if (!keys.includes(backupKey)) {
      keys.unshift(backupKey);
      localStorage.setItem('preppilot_migration_backup_keys', JSON.stringify(keys.slice(0, 5)));
    }
    return backupKey;
  } catch (err) {
    console.warn('Could not store pre-migration backup in localStorage:', err);
    return '';
  }
}

export function getPreMigrationBackups(): Array<{
  key: string;
  timestamp: string;
  summary: DataMigrationSummary;
  data: FullUserDataPayload;
}> {
  try {
    const rawKeys = localStorage.getItem('preppilot_migration_backup_keys');
    const keys: string[] = rawKeys ? JSON.parse(rawKeys) : [];
    const list: Array<{
      key: string;
      timestamp: string;
      summary: DataMigrationSummary;
      data: FullUserDataPayload;
    }> = [];

    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          list.push({
            key,
            timestamp: parsed.timestamp || '',
            summary: parsed.summary || getDataSummary(parsed.data),
            data: parsed.data,
          });
        } catch {
          // ignore corrupted backup item
        }
      }
    }
    return list;
  } catch {
    return [];
  }
}

// =============================================================================
// MULTI-DEVICE WEB PUSH SUBSCRIPTION & CLOUD REGISTRATION
// =============================================================================

let unsubscribeOnMessage: (() => void) | null = null;

/**
 * Generates or retrieves a stable, privacy-conscious local device installation identifier.
 * Stored in localStorage so each phone, tablet, and desktop browser has its own persistent identity.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device';
  const STORAGE_KEY = 'preppilot_device_id';
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id || id.trim().length < 8) {
      const randomPart =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
          : Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      id = `dev_${randomPart}`;
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id.trim();
  } catch {
    return 'dev_fallback_' + Date.now();
  }
}

/**
 * Returns privacy-respecting client metadata without reading private device inventory.
 */
export function getDeviceMetadata(): { deviceType: 'mobile' | 'tablet' | 'desktop'; deviceLabel: string } {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { deviceType: 'desktop', deviceLabel: 'Generic Client' };
  }

  const ua = navigator.userAgent;
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/Mobi|Android|iPhone|iPod/i.test(ua)) {
    deviceType = 'mobile';
  }

  let browser = 'Browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';

  let os = 'Device';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS') || ua.includes('Macintosh')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return {
    deviceType,
    deviceLabel: `${browser} on ${os}`,
  };
}

/**
 * Step 1: Sets up local browser Web Push notification permissions, retrieves FCM token,
 * and attaches a single managed foreground listener without duplicate handlers.
 */
export async function setupWebPushSubscription(): Promise<{
  token: string | null;
  permission?: NotificationPermission;
  error?: string;
}> {
  if (typeof window === 'undefined') {
    return { token: null, error: 'Window is not defined' };
  }

  if (!('Notification' in window)) {
    return { token: null, error: 'Web Notifications are not supported by this browser.' };
  }

  if (!('serviceWorker' in navigator)) {
    return { token: null, error: 'Service Workers are not supported by this browser.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        token: null,
        permission,
        error: 'Notification permission was denied by the browser.',
      };
    }

    if (!isFirebaseConfigured() || !app) {
      return {
        token: null,
        permission,
        error: 'Firebase is not yet configured with environment credentials. Local reminders remain active.',
      };
    }

    // Explicit VAPID key check: do not attempt incomplete push subscription without VAPID key
    if (!isVapidConfigured()) {
      return {
        token: null,
        permission,
        error:
          'Firebase Web Push VAPID key is missing (VITE_FIREBASE_VAPID_KEY). Configure a valid Web Push key pair in your environment to complete push registration.',
      };
    }

    if (!messaging) {
      messaging = getMessaging(app);
    }

    const swRegistration = await navigator.serviceWorker.ready;
    const currentToken = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
      vapidKey: VAPID_KEY.trim(),
    });

    if (!currentToken) {
      return {
        token: null,
        permission,
        error: 'FCM returned an empty registration token. Please retry.',
      };
    }

    // Clean up any previously attached listener to avoid duplicate foreground notifications
    if (unsubscribeOnMessage) {
      try {
        unsubscribeOnMessage();
      } catch {}
      unsubscribeOnMessage = null;
    }

    // Register a single clean foreground message handler
    unsubscribeOnMessage = onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || 'PrepPilot • Study Reminder';
      const body = payload.notification?.body || payload.data?.body || 'Upcoming study session alert.';
      const tag = payload.data?.tag || (payload.notification as any)?.tag || 'preppilot-study-reminder';
      const targetUrl = payload.data?.url || '/';

      // Dispatch custom window event so in-app banner can also react
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('preppilot-push-received', {
            detail: { title, body, tag, targetUrl, data: payload.data },
          })
        );
      }

      // Display notification using consistent Service Worker notification options
      const notificationIcon = payload.notification?.icon || payload.data?.icon || '/pwa-192x192.png';
      const notificationBadge = (payload.notification as Record<string, any> | undefined)?.badge || payload.data?.badge || '/badge-72x72.png';

      if (swRegistration && 'showNotification' in swRegistration) {
        swRegistration.showNotification(title, {
          body,
          icon: notificationIcon,
          badge: notificationBadge,
          tag,
          data: { url: targetUrl, ...payload.data },
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: notificationIcon,
          badge: notificationBadge,
          tag,
          data: { url: targetUrl, ...payload.data },
        });
      }
    });

    return { token: currentToken, permission };
  } catch (err: any) {
    console.error('Error in Web Push subscription:', err);
    return { token: null, error: err?.message || 'Failed to initialize Web Push subscription.' };
  }
}

export interface DeviceRegistrationOptions {
  token: string;
  timezone?: string;
  notificationPreferences?: {
    notificationsPaused?: boolean;
    notificationFrequency?: 'all' | 'daily_summary' | 'urgent_only';
    primaryStudyWindow?: string;
    revisionWindow?: string;
  };
}

/**
 * Step 2: Multi-Device Cloud Registration
 * Registers the current device's FCM token under:
 * `user_push_subscriptions/{userId}/devices/{deviceId}`
 *
 * Guaranteed properties:
 * - Idempotent: Re-registering does not create duplicate device documents.
 * - Multi-device safe: Distinct devices (phone, laptop) never overwrite each other.
 * - Legacy migration safe: Copies previous single-token root subscriptions into a device record.
 * - Owner protected: Authenticated user check enforced before write.
 */
export async function registerDevicePushSubscription(
  userId: string,
  options: DeviceRegistrationOptions
): Promise<{ success: boolean; deviceId?: string; error?: string; syncedAt?: string }> {
  if (!isFirebaseConfigured() || !firestore) {
    return { success: false, error: 'Firebase is not initialized or configured.' };
  }
  if (!userId) {
    return { success: false, error: 'User ID is missing or unauthenticated.' };
  }
  if (!auth?.currentUser || auth.currentUser.uid !== userId) {
    return { success: false, error: 'User is not signed in or UID does not match authenticated user.' };
  }
  if (!options.token) {
    return { success: false, error: 'No FCM registration token provided to register.' };
  }

  try {
    const deviceId = getOrCreateDeviceId();
    const meta = getDeviceMetadata();
    const nowIso = new Date().toISOString();

    const deviceRecord: DevicePushRecord = {
      deviceId,
      token: options.token,
      timezone: options.timezone || 'Asia/Kolkata',
      deviceType: meta.deviceType,
      deviceLabel: meta.deviceLabel,
      active: true,
      registeredAt: nowIso,
      lastActiveAt: nowIso,
      notificationPreferences: {
        notificationsPaused: options.notificationPreferences?.notificationsPaused ?? false,
        notificationFrequency: options.notificationPreferences?.notificationFrequency || 'all',
        primaryStudyWindow: options.notificationPreferences?.primaryStudyWindow || '14:00–21:00',
        revisionWindow: options.notificationPreferences?.revisionWindow || '23:00–00:00',
      },
    };

    // 1. Write the device-specific record in subcollection. Avoid rewriting an
    // unchanged FCM token on every registration/page refresh, while still
    // refreshing activity, device metadata, and notification preferences.
    const sanitizedDevice = sanitizeFirestoreData(deviceRecord);
    const deviceRef = doc(firestore, 'user_push_subscriptions', userId, 'devices', deviceId);
    const existingDeviceSnap = await getDoc(deviceRef);
    if (existingDeviceSnap.exists() && existingDeviceSnap.data().token === options.token) {
      const deviceMetadata = sanitizeFirestoreData({
        deviceId,
        timezone: deviceRecord.timezone,
        deviceType: deviceRecord.deviceType,
        deviceLabel: deviceRecord.deviceLabel,
        active: deviceRecord.active,
        lastActiveAt: nowIso,
        notificationPreferences: deviceRecord.notificationPreferences,
      });
      await updateDoc(deviceRef, deviceMetadata);
    } else {
      await setDoc(deviceRef, sanitizedDevice, { merge: true });
    }

    // 2. Safe migration: check if parent document had a legacy token from an older single-device build
    const parentRef = doc(firestore, 'user_push_subscriptions', userId);
    const parentSnap = await getDoc(parentRef);
    if (parentSnap.exists()) {
      const parentData = parentSnap.data();
      // If legacy fcmToken exists and differs from current device token, preserve it as legacy_device
      if (
        parentData.fcmToken &&
        typeof parentData.fcmToken === 'string' &&
        parentData.fcmToken !== options.token
      ) {
        const legacyRef = doc(firestore, 'user_push_subscriptions', userId, 'devices', 'legacy_device');
        const legacySnap = await getDoc(legacyRef);
        if (!legacySnap.exists()) {
          await setDoc(
            legacyRef,
            sanitizeFirestoreData({
              deviceId: 'legacy_device',
              token: parentData.fcmToken,
              timezone: parentData.timezone || 'Asia/Kolkata',
              deviceType: 'mobile',
              deviceLabel: 'Previously Registered Device',
              active: true,
              registeredAt: parentData.updatedAt || nowIso,
              lastActiveAt: parentData.updatedAt || nowIso,
              notificationPreferences: {
                notificationsPaused: parentData.notificationsPaused ?? false,
                notificationFrequency: parentData.notificationFrequency || 'all',
                primaryStudyWindow: parentData.primaryStudyWindow || '14:00–21:00',
                revisionWindow: parentData.revisionWindow || '23:00–00:00',
              },
            }),
            { merge: true }
          );
        }
      }
    }

    // 3. Update root metadata document. Keep the legacy token field in sync,
    // but do not write it again when its value has not changed.
    const rootMetadata = sanitizeFirestoreData({
      userId,
      updatedAt: nowIso,
      lastClientSyncAt: nowIso,
      lastRegisteredDeviceId: deviceId,
    });
    if (parentSnap.exists() && parentSnap.data().fcmToken === options.token) {
      await updateDoc(parentRef, rootMetadata);
    } else {
      await setDoc(
        parentRef,
        sanitizeFirestoreData({
          ...rootMetadata,
          // Retain fcmToken for backward compatibility with existing single-token readers
          fcmToken: options.token,
        }),
        { merge: true }
      );
    }

    return { success: true, deviceId, syncedAt: nowIso };
  } catch (err: any) {
    console.error('Failed to register device push subscription in Firestore:', err);
    return { success: false, error: err?.message || 'Failed to save device subscription in Firestore' };
  }
}

/**
 * Retrieves all registered devices for the authenticated user.
 */
export async function fetchRegisteredDevices(
  userId: string
): Promise<{ success: boolean; devices: DevicePushRecord[]; error?: string }> {
  if (!firestore || !userId) {
    return { success: false, devices: [], error: 'Firestore inactive or unauthenticated' };
  }

  try {
    const devicesCol = collection(firestore, 'user_push_subscriptions', userId, 'devices');
    const snapshot = await getDocs(devicesCol);
    const devices: DevicePushRecord[] = [];

    snapshot.forEach((d) => {
      devices.push(d.data() as DevicePushRecord);
    });

    // If subcollection is empty but root document has a legacy token, synthesize legacy device
    if (devices.length === 0) {
      const rootSnap = await getDoc(doc(firestore, 'user_push_subscriptions', userId));
      if (rootSnap.exists()) {
        const rootData = rootSnap.data();
        if (rootData.fcmToken) {
          devices.push({
            deviceId: rootData.lastRegisteredDeviceId || 'legacy_device',
            token: rootData.fcmToken,
            timezone: rootData.timezone || 'Asia/Kolkata',
            deviceType: 'mobile',
            deviceLabel: 'Primary Device',
            active: true,
            registeredAt: rootData.updatedAt || new Date().toISOString(),
            lastActiveAt: rootData.updatedAt || new Date().toISOString(),
            notificationPreferences: {
              notificationsPaused: rootData.notificationsPaused ?? false,
              notificationFrequency: rootData.notificationFrequency || 'all',
              primaryStudyWindow: rootData.primaryStudyWindow || '14:00–21:00',
              revisionWindow: rootData.revisionWindow || '23:00–00:00',
            },
          });
        }
      }
    }

    return { success: true, devices };
  } catch (err: any) {
    console.error('Failed to fetch registered devices:', err);
    return { success: false, devices: [], error: err?.message || 'Failed to read devices from Firestore' };
  }
}

/**
 * Deactivates or removes a specific device subscription.
 */
export async function deactivateDeviceSubscription(
  userId: string,
  deviceId: string
): Promise<{ success: boolean; error?: string }> {
  if (!firestore || !userId || !deviceId) {
    return { success: false, error: 'Invalid parameters or unauthenticated' };
  }

  try {
    await setDoc(
      doc(firestore, 'user_push_subscriptions', userId, 'devices', deviceId),
      {
        active: false,
        lastActiveAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to deactivate device' };
  }
}

export interface ServerStatusCheckResult {
  isBackendDeployed: boolean;
  systemHeartbeatStatus?: 'healthy' | 'degraded' | 'error';
  lastRunAt?: string;
  schedule?: string;
  scheduler?: string;
  lastRunStats?: {
    processedUsers: number;
    totalUsersChecked?: number;
    totalDispatches: number;
    successCount: number;
    failureCount: number;
    retriedCount?: number;
    invalidTokensEvicted?: number;
    lastError?: string | null;
  };
  recentDelivery?: {
    deliveryId: string;
    timestamp: string;
    status: 'accepted_by_fcm' | 'delivered' | 'partial_failure' | 'failed' | 'skipped' | 'in_progress';
    title: string;
    type?: string;
    isTest?: boolean;
    error?: string;
    attempts?: number;
  };
  lastTestDelivery?: {
    deliveryId: string;
    timestamp: string;
    status: 'accepted_by_fcm' | 'delivered' | 'partial_failure' | 'failed';
    title: string;
    error?: string;
    fcmAccepted?: boolean;
    confirmedDisplayed?: boolean;
    acceptedDevices?: number;
    failedDevices?: number;
  };
  deliveryTestSucceeded: boolean;
  statusLabel: string;
  statusDetails?: string;
}

/**
 * Queries server deployment health and delivery audit history.
 * A token alone NEVER proves server dispatch is active; this checks for real backend execution.
 * Only marks deliveryTestSucceeded if a distinct test event was verified.
 */
export async function fetchServerDispatchStatus(
  userId: string
): Promise<ServerStatusCheckResult> {
  if (!firestore || !userId) {
    return {
      isBackendDeployed: false,
      deliveryTestSucceeded: false,
      statusLabel: 'Scheduled delivery not configured',
    };
  }

  try {
    // 1. Check system status written strictly by backend Cloud Functions
    let isDeployed = false;
    let systemHeartbeatStatus: 'healthy' | 'degraded' | 'error' | undefined;
    let lastRunAt: string | undefined;
    let schedule: string | undefined;
    let scheduler: string | undefined;
    let lastRunStats: ServerStatusCheckResult['lastRunStats'];
    let heartbeatIsStale = false;

    try {
      const systemSnap = await getDoc(doc(firestore, 'system_status', 'notification_backend'));
      if (systemSnap.exists()) {
        const sysData = systemSnap.data();
        if (sysData && sysData.lastRunAt) {
          // Safely convert Firestore Timestamp, millis, or string to ISO string
          let isoLastRun: string | undefined;
          if (typeof sysData.lastRunAt === 'object' && sysData.lastRunAt !== null) {
            if (typeof sysData.lastRunAt.toDate === 'function') {
              isoLastRun = sysData.lastRunAt.toDate().toISOString();
            } else if (typeof sysData.lastRunAt.toMillis === 'function') {
              isoLastRun = new Date(sysData.lastRunAt.toMillis()).toISOString();
            } else if (typeof (sysData.lastRunAt as any).seconds === 'number') {
              isoLastRun = new Date((sysData.lastRunAt as any).seconds * 1000).toISOString();
            } else if (typeof (sysData.lastRunAt as any)._seconds === 'number') {
              isoLastRun = new Date((sysData.lastRunAt as any)._seconds * 1000).toISOString();
            }
          } else if (typeof sysData.lastRunAt === 'string') {
            const parsed = new Date(sysData.lastRunAt);
            if (!isNaN(parsed.getTime())) {
              isoLastRun = parsed.toISOString();
            }
          }

          if (isoLastRun) {
            lastRunAt = isoLastRun;

            // Check for stale heartbeats. Scheduler runs hourly 08:00–23:00 Asia/Kolkata daily.
            // If the last run was more than 26 hours ago, the heartbeat is considered stale.
            const msSinceLastRun = Date.now() - new Date(isoLastRun).getTime();
            heartbeatIsStale = !isNaN(msSinceLastRun) && msSinceLastRun > 26 * 60 * 60 * 1000;

            const rawStatus = sysData.systemHeartbeatStatus || sysData.status;
            if (heartbeatIsStale) {
              systemHeartbeatStatus = 'degraded';
            } else if (rawStatus === 'healthy' || rawStatus === 'degraded' || rawStatus === 'error') {
              systemHeartbeatStatus = rawStatus;
            } else {
              systemHeartbeatStatus = 'healthy';
            }

            schedule = sysData.schedule || sysData.scheduler || '0 8-23 * * * (Hourly 08:00-23:00 IST)';
            scheduler = schedule;

            const rawStats = sysData.lastRunStats || {};
            const totalChecked =
              typeof rawStats.totalUsersChecked === 'number'
                ? rawStats.totalUsersChecked
                : typeof rawStats.processedUsers === 'number'
                ? rawStats.processedUsers
                : 0;

            lastRunStats = {
              processedUsers: totalChecked,
              totalUsersChecked: totalChecked,
              totalDispatches: typeof rawStats.totalDispatches === 'number' ? rawStats.totalDispatches : 0,
              successCount: typeof rawStats.successCount === 'number' ? rawStats.successCount : 0,
              failureCount: typeof rawStats.failureCount === 'number' ? rawStats.failureCount : 0,
              retriedCount: typeof rawStats.retriedCount === 'number' ? rawStats.retriedCount : 0,
              invalidTokensEvicted: typeof rawStats.invalidTokensEvicted === 'number' ? rawStats.invalidTokensEvicted : 0,
              lastError: rawStats.lastError || null,
            };

            // Only mark backend verified deployed when a valid, readable heartbeat document is present
            isDeployed = true;
          }
        }
      }
    } catch {
      // System status doc not found or permission locked -> backend not verified
      isDeployed = false;
      systemHeartbeatStatus = undefined;
    }

    // 2. Check user's delivery audit history for recent dispatches and dedicated test events
    let recentDelivery: ServerStatusCheckResult['recentDelivery'];
    let lastTestDelivery: ServerStatusCheckResult['lastTestDelivery'];
    let deliveryTestSucceeded = false;

    try {
      const historyCol = collection(firestore, 'user_push_subscriptions', userId, 'delivery_history');
      const historyQuery = query(historyCol, orderBy('timestamp', 'desc'), limit(10));
      const historySnap = await getDocs(historyQuery);

      if (!historySnap.empty) {
        for (const d of historySnap.docs) {
          const firstDoc = d.data();
          const deliveryId = firstDoc.deliveryId || d.id;
          const timestamp = firstDoc.timestamp
            ? new Date(firstDoc.timestamp.toMillis ? firstDoc.timestamp.toMillis() : firstDoc.timestamp).toISOString()
            : new Date().toISOString();

          // Set recentDelivery to the first document encountered
          if (!recentDelivery) {
            recentDelivery = {
              deliveryId,
              timestamp,
              status: firstDoc.status || 'delivered',
              title: firstDoc.title || 'Study Prompt',
              type: firstDoc.type,
              isTest: Boolean(firstDoc.isTest),
              error: firstDoc.errorDetails?.[0] || firstDoc.error,
              attempts: firstDoc.attempts,
            };
          }

          // Check if this document represents a dedicated test event
          if (!lastTestDelivery && (firstDoc.isTest === true || firstDoc.type === 'test_delivery')) {
            const rawStatus = firstDoc.status;
            const parsedStatus: 'accepted_by_fcm' | 'delivered' | 'partial_failure' | 'failed' =
              rawStatus === 'accepted_by_fcm'
                ? 'accepted_by_fcm'
                : rawStatus === 'delivered'
                ? 'delivered'
                : rawStatus === 'partial_failure'
                ? 'partial_failure'
                : 'failed';

            let testError = firstDoc.errorDetails?.[0] || firstDoc.error;
            if (!testError && firstDoc.deviceOutcomes && typeof firstDoc.deviceOutcomes === 'object') {
              const outcomes = Object.values(firstDoc.deviceOutcomes) as any[];
              const failed = outcomes.find((d) => d?.errorMessage || d?.errorCode);
              if (failed) {
                testError = failed.errorMessage || failed.errorCode;
              }
            }

            lastTestDelivery = {
              deliveryId,
              timestamp,
              status: parsedStatus,
              title: firstDoc.title || 'Cloud Push Test',
              error: testError,
              fcmAccepted: firstDoc.fcmAccepted ?? (parsedStatus === 'accepted_by_fcm' || parsedStatus === 'delivered'),
              confirmedDisplayed: Boolean(firstDoc.confirmedDisplayed),
              acceptedDevices: firstDoc.acceptedDevices,
              failedDevices: firstDoc.failedDevices,
            };
            // Only claim true delivery display when a genuine device-level acknowledgement exists (e.g. confirmedDisplayed === true).
            // Legacy status: 'delivered' or FCM acceptance ('accepted_by_fcm') does NOT automatically mean device display was confirmed.
            if (firstDoc.confirmedDisplayed === true) {
              deliveryTestSucceeded = true;
            }
          }
        }
      }
    } catch {
      // delivery history empty or not yet dispatched
    }

    // 3. Formulate honest status label
    let statusLabel = 'Scheduled delivery not configured';
    let statusDetails: string | undefined;

    if (!isDeployed || !systemHeartbeatStatus) {
      statusLabel = 'Scheduled delivery not configured';
      statusDetails = 'No recent system heartbeat found in Firestore. Deploy Cloud Functions backend to activate.';
    } else if (systemHeartbeatStatus === 'degraded') {
      if (heartbeatIsStale) {
        statusLabel = 'Degraded: Stale backend heartbeat';
        statusDetails = `Last scheduler run was recorded at ${new Date(lastRunAt || '').toLocaleString()}. The hourly Cloud Scheduler may be inactive.`;
      } else if (lastRunStats && lastRunStats.failureCount > 0 && lastRunStats.successCount === 0) {
        statusLabel = 'Degraded: Scheduler executed but all FCM sends failed';
        statusDetails = lastRunStats.lastError || 'FCM rejected push tokens';
      } else {
        statusLabel = 'Degraded: Partial delivery issues encountered';
      }
    } else if (systemHeartbeatStatus === 'error') {
      statusLabel = 'Backend execution error';
      statusDetails = lastRunStats?.lastError || 'Unhandled exception in Cloud Function';
    } else if (isDeployed && systemHeartbeatStatus === 'healthy') {
      statusLabel = 'Scheduled backend configured';
    }

    return {
      isBackendDeployed: isDeployed,
      systemHeartbeatStatus,
      lastRunAt,
      schedule,
      scheduler,
      lastRunStats,
      recentDelivery,
      lastTestDelivery,
      deliveryTestSucceeded,
      statusLabel,
      statusDetails,
    };
  } catch (err) {
    return {
      isBackendDeployed: false,
      deliveryTestSucceeded: false,
      statusLabel: 'Scheduled delivery not configured',
    };
  }
}

/**
 * Triggers a real server-side push notification to the authenticated user's active devices.
 * Invokes the secure Cloud Function 'sendUserTestNotification' using the caller's Firebase ID token.
 */
export async function triggerServerDeliveryTest(): Promise<{
  success: boolean;
  status?: 'accepted_by_fcm' | 'partial_failure' | 'failed';
  message?: string;
  acceptedDevices?: number;
  failedDevices?: number;
  deliveredDevices?: number;
  error?: string;
  deviceOutcomes?: Record<string, any>;
}> {
  if (!isFirebaseConfigured() || !auth?.currentUser) {
    return {
      success: false,
      error: 'Firebase is not initialized or user is not signed in. Sign in to test server push delivery.',
    };
  }

  try {
    const idToken = await auth.currentUser.getIdToken(true);
    const projectId = firebaseConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID;

    // Cloud Functions v2 endpoint in asia-south1
    const baseUrl =
      import.meta.env.VITE_FIREBASE_FUNCTIONS_URL ||
      `https://asia-south1-${projectId}.cloudfunctions.net`;

    const endpoint = `${baseUrl}/sendUserTestNotification`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return {
          success: false,
          error:
            'Cloud Function "sendUserTestNotification" is not reachable or not yet deployed. Deploy backend functions via "firebase deploy --only functions".',
        };
      }
      const errBody = await res.json().catch(() => null);
      return {
        success: false,
        error: errBody?.error || `Server responded with HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      success: Boolean(data.success),
      status: data.status,
      message: data.message,
      acceptedDevices: data.acceptedDevices,
      failedDevices: data.failedDevices,
      deliveredDevices: data.acceptedDevices ?? data.deliveredDevices,
      deviceOutcomes: data.deviceOutcomes,
    };
  } catch (err: any) {
    console.error('Error triggering server delivery test:', err);
    return {
      success: false,
      error:
        err?.message ||
        'Network error contacting server test endpoint. Verify backend Cloud Functions deployment.',
    };
  }
}

/**
 * Legacy wrapper: maps to multi-device registerDevicePushSubscription
 */
export interface ReminderSyncPayload {
  fcmToken: string;
  timezone: string;
  primaryStudyWindow: string;
  revisionWindow: string;
  notificationFrequency: 'all' | 'daily_summary' | 'urgent_only';
  notificationsPaused?: boolean;
  overdueTasksCount?: number;
  upcomingDeadlines?: Array<{ id: string; title: string; deadline: string; subject: string }>;
  upcomingTests?: Array<{ id: string; testName: string; scheduledDate: string }>;
  deviceInfo?: string;
  serverDispatchStatus?: 'not_configured' | 'pending_deployment' | 'active';
}

export async function syncRemindersToFirestore(
  userId: string,
  data: ReminderSyncPayload
): Promise<{ success: boolean; error?: string; syncedAt?: string }> {
  return registerDevicePushSubscription(userId, {
    token: data.fcmToken,
    timezone: data.timezone,
    notificationPreferences: {
      notificationsPaused: data.notificationsPaused,
      notificationFrequency: data.notificationFrequency,
      primaryStudyWindow: data.primaryStudyWindow,
      revisionWindow: data.revisionWindow,
    },
  });
}

export async function fetchPushSubscriptionFromFirestore(
  userId: string
): Promise<{ exists: boolean; data?: any; error?: string }> {
  if (!firestore || !userId) return { exists: false, error: 'Firestore inactive or unauthenticated' };
  try {
    const snap = await getDoc(doc(firestore, 'user_push_subscriptions', userId));
    if (!snap.exists()) return { exists: false };
    return { exists: true, data: snap.data() };
  } catch (err: any) {
    return { exists: false, error: err?.message || 'Failed to read subscription from Firestore' };
  }
}

