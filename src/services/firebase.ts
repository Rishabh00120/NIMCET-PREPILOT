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
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  onSnapshot,
  writeBatch,
  enableIndexedDbPersistence,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import {
  SyllabusSubject,
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
    firestore = getFirestore(app);

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
 * Push full local dataset to Cloud Firestore under users/{userId}
 * Ensures all collections are saved safely.
 */
export async function uploadFullLocalDataToRemote(
  userId: string,
  payload: FullUserDataPayload
): Promise<{ success: boolean; error?: string }> {
  if (!firestore) return { success: false, error: 'Firestore not initialized' };

  try {
    const userDocRef = doc(firestore, 'users', userId);
    await setDoc(
      userDocRef,
      {
        ...payload,
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
    const userDocRef = doc(firestore, 'users', userId);
    await setDoc(
      userDocRef,
      {
        [field]: data,
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
 * Helper to extract the most accurate timestamp for a record.
 */
function getItemTimestamp(item: any): number {
  if (!item) return 0;
  const timeStr = item.updatedAt || item.loggedAt || item.createdAt || item.date;
  if (!timeStr) return 0;
  const parsed = new Date(timeStr).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Deterministic merge of two lists of items uniquely by 'id'.
 * Rules:
 * 1. If an item has a deletedAt tombstone, the tombstone wins if its deletion timestamp
 *    is newer than or equal to the competing record's timestamp.
 * 2. If both exist without tombstones, the record with the newer updatedAt/createdAt wins (LWW).
 * 3. Deleted records are filtered out from the returned active items list.
 */
export function mergeItemsById<T extends { id: string; updatedAt?: string; deletedAt?: string }>(
  localList: T[],
  remoteList: T[],
  includeTombstones = false
): T[] {
  const map = new Map<string, T>();

  // Add remote items first
  for (const remoteItem of remoteList) {
    if (remoteItem && remoteItem.id) {
      map.set(remoteItem.id, remoteItem);
    }
  }

  // Compare each local item against remote item with same ID
  for (const localItem of localList) {
    if (!localItem || !localItem.id) continue;

    const existing = map.get(localItem.id);
    if (!existing) {
      map.set(localItem.id, localItem);
      continue;
    }

    const localTime = getItemTimestamp(localItem);
    const remoteTime = getItemTimestamp(existing);

    // If local was deleted and localTime >= remoteTime, local deletion wins
    if (localItem.deletedAt && localTime >= remoteTime) {
      map.set(localItem.id, localItem);
      continue;
    }

    // If remote was deleted and remoteTime >= localTime, remote deletion wins
    if (existing.deletedAt && remoteTime >= localTime) {
      continue;
    }

    // Otherwise, newer record wins (LWW)
    if (localTime >= remoteTime) {
      map.set(localItem.id, localItem);
    }
  }

  const allItems = Array.from(map.values());
  if (includeTombstones) {
    return allItems;
  }
  return allItems.filter((item) => !item.deletedAt);
}

/**
 * Safe merge between local state and cloud state upon user authentication.
 * Guarantees no data loss when user signs in on phone or laptop.
 */
export function mergeLocalAndRemoteData(
  local: FullUserDataPayload,
  remote: FullUserDataPayload
): FullUserDataPayload {
  // 1. Tasks: merge uniquely by ID
  const mergedTasks = mergeItemsById(local.tasks, remote.tasks);

  // 2. Study Sessions: merge uniquely by ID
  const mergedSessions = mergeItemsById(local.studySessions, remote.studySessions);

  // 3. PYQ Entries: merge uniquely by ID
  const mergedPYQ = mergeItemsById(local.pyqEntries, remote.pyqEntries);

  // 4. Mock Tests: merge uniquely by ID
  const mergedMocks = mergeItemsById(local.mockTests, remote.mockTests);

  // 5. Error Logs: merge uniquely by ID
  const mergedErrors = mergeItemsById(local.errorLogs, remote.errorLogs);

  // 6. Revision Items: merge uniquely by ID
  const mergedRevisions = mergeItemsById(local.revisionItems, remote.revisionItems);

  // 7. Monthly Goals: merge by monthKey
  const goalMap = new Map<string, MonthlyGoal>();
  for (const g of remote.monthlyGoals) goalMap.set(g.monthKey, g);
  for (const g of local.monthlyGoals) goalMap.set(g.monthKey, g);
  const mergedGoals = Array.from(goalMap.values());

  // 8. Timetable Slots: merge by slot ID
  const mergedSlots = mergeItemsById(local.timetableSlots, remote.timetableSlots);

  // 9. PYQ Paper Records (2011 to 2026): merge by year, preserving union of attempts
  const mergedPaperRecords: Record<number, PYQPaperRecord> = { ...remote.pyqPaperRecords };
  for (const [yearStr, localRec] of Object.entries(local.pyqPaperRecords)) {
    const yr = Number(yearStr);
    const remoteRec = mergedPaperRecords[yr];
    if (!remoteRec) {
      mergedPaperRecords[yr] = localRec;
    } else {
      // Merge attempts
      const combinedAttempts = mergeItemsById(localRec.attempts || [], remoteRec.attempts || []);
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

  // 10. Subjects: Merge topic completion & questions solved
  const mergedSubjects = local.subjects.map((localSubj) => {
    const remoteSubj = remote.subjects.find((s) => s.id === localSubj.id);
    if (!remoteSubj) return localSubj;

    return {
      ...localSubj,
      chapters: localSubj.chapters.map((localCh) => {
        const remoteCh = remoteSubj.chapters.find((c) => c.id === localCh.id);
        if (!remoteCh) return localCh;

        return {
          ...localCh,
          topics: localCh.topics.map((localTop) => {
            const remoteTop = remoteCh.topics.find((t) => t.id === localTop.id);
            if (!remoteTop) return localTop;

            // If either local or remote marked as completed, preserve completion
            const isCompleted = localTop.completed || remoteTop.completed;
            const completedAt = localTop.completedAt || remoteTop.completedAt;
            const questionsSolved = Math.max(localTop.questionsSolved || 0, remoteTop.questionsSolved || 0);
            const questionsCorrect = Math.max(localTop.questionsCorrect || 0, remoteTop.questionsCorrect || 0);
            const actualHours = Math.max(localTop.actualHours || 0, remoteTop.actualHours || 0);

            return {
              ...localTop,
              completed: isCompleted,
              completedAt,
              questionsSolved,
              questionsCorrect,
              actualHours,
              status: isCompleted ? 'completed' : localTop.status !== 'not_started' ? localTop.status : remoteTop.status,
            };
          }),
        };
      }),
    };
  });

  // 11. User Config: merge
  const mergedConfig: Partial<UserConfig> = {
    ...remote.userConfig,
    ...local.userConfig,
  };

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
    taskCount: data.tasks?.length || 0,
    sessionCount: data.studySessions?.length || 0,
    mockCount: data.mockTests?.length || 0,
    errorLogCount: data.errorLogs?.length || 0,
    pyqEntryCount: data.pyqEntries?.length || 0,
    revisionCount: data.revisionItems?.length || 0,
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
// WEB PUSH SUBSCRIPTION HELPER
// =============================================================================

export async function setupWebPushSubscription(): Promise<{ token: string | null; error?: string }> {
  if (typeof window === 'undefined') return { token: null, error: 'Window undefined' };

  if (!('Notification' in window)) {
    return { token: null, error: 'Web Notifications are not supported in this browser' };
  }

  if (!('serviceWorker' in navigator)) {
    return { token: null, error: 'Service Workers are not supported in this browser' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { token: null, error: 'Notification permission was denied by the user' };
    }

    if (!isFirebaseConfigured() || !app) {
      return {
        token: null,
        error: 'Firebase is not yet configured with environment variables. Local reminders are active.',
      };
    }

    if (!messaging) {
      messaging = getMessaging(app);
    }

    const swRegistration = await navigator.serviceWorker.ready;
    const currentToken = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
      vapidKey: VAPID_KEY || undefined,
    });

    if (currentToken) {
      onMessage(messaging, (payload) => {
        if (payload.notification?.title) {
          new Notification(payload.notification.title, {
            body: payload.notification.body,
            icon: '/pwa-192x192.png',
          });
        }
      });
      return { token: currentToken };
    } else {
      return { token: null, error: 'No registration token available. Request permission to generate one.' };
    }
  } catch (err: any) {
    console.error('Error in Web Push subscription:', err);
    return { token: null, error: err?.message || 'Failed to setup Web Push' };
  }
}

export async function syncRemindersToFirestore(
  userId: string,
  data: {
    fcmToken: string;
    timezone: string;
    primaryStudyWindow: string;
    revisionWindow: string;
    notificationFrequency: string;
    overdueTasksCount: number;
    upcomingDeadlines: Array<{ id: string; title: string; deadline: string; subject: string }>;
  }
): Promise<boolean> {
  if (!isFirebaseConfigured() || !firestore || !userId) return false;

  try {
    await setDoc(
      doc(firestore, 'user_push_subscriptions', userId),
      {
        ...data,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('Failed to sync push subscription to Firestore:', err);
    return false;
  }
}
