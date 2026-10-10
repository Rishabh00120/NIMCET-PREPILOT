/**
 * Firebase Client Integration for PrepPilot
 * Handles Firebase Auth, Firestore sync, and Web Push notifications (FCM).
 * Fully graceful: operates in local-first mode when Firebase is unconfigured.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, type Firestore } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

// Environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

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
  } catch (err) {
    console.warn('Firebase initialization skipped/failed:', err);
  }
}

export { app, auth, firestore };

/**
 * Register FCM Service Worker and retrieve Web Push registration token
 */
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

    // Register Firebase Messaging
    if (!messaging) {
      messaging = getMessaging(app);
    }

    // Use the active unified PWA service worker registration
    const swRegistration = await navigator.serviceWorker.ready;

    const currentToken = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
      vapidKey: VAPID_KEY || undefined,
    });

    if (currentToken) {
      // Listen for foreground messages
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

/**
 * Sync user reminder schedule and deadlines to Firestore for background server-side dispatch
 */
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
  if (!isFirebaseConfigured() || !firestore) return false;

  try {
    await setDoc(doc(firestore, 'user_push_subscriptions', userId), {
      ...data,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to sync push subscription to Firestore:', err);
    return false;
  }
}
