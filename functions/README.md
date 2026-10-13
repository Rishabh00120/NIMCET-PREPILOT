# PrepPilot — Scheduled Web Push Notification Backend

This package contains the server-side scheduled notification dispatcher for PrepPilot, built on Firebase Cloud Functions v2 and Firebase Admin SDK.

## Architecture

1. **Server-Side Admin SDK**:
   - Runs strictly in Google Cloud / Firebase Cloud Functions.
   - Private service account credentials never leak to client code or browser bundles.

2. **Multi-Device Support**:
   - Queries `user_push_subscriptions/{userId}/devices/{deviceId}`.
   - Distinct devices (phone, laptop, tablet) maintain independent registration tokens, device labels, timezones, and reminder preferences.
   - Safe legacy migration: previous root-level `fcmToken` entries are preserved.

3. **Timezone-Aware Evaluation**:
   - Evaluates tasks and tests in `Asia/Kolkata` (IST) timezone.
   - Default schedule: `0 9,14,20 * * *` (09:00 AM, 02:00 PM, 08:00 PM IST daily).

4. **Deduplication & Idempotency**:
   - Each reminder event generates a deterministic event ID: `rem_{userId}_{type}_{itemId}_{date}`.
   - Audited against `/user_push_subscriptions/{userId}/delivery_history/{eventId}`.
   - Prevents duplicate alerts even if the scheduler runs repeatedly.

5. **Token Eviction**:
   - Automatically detects unregistered/expired FCM tokens (`messaging/registration-token-not-registered`, `messaging/invalid-registration-token`).
   - Marks the device doc as `active: false` in Firestore to keep the push registry clean.

6. **Honest System Health**:
   - Writes server status to `/system_status/notification_backend`.
   - The PrepPilot frontend verifies this record and only displays "Scheduled backend configured" when the backend is deployed and healthy. Until deployed, the UI displays "Scheduled delivery not configured."

---

## Prerequisites & Billing Requirements

- **Firebase Blaze Plan**: Google Cloud Scheduler and Firebase Cloud Functions v2 require the pay-as-you-go Blaze plan (Cloud Functions has a generous free tier of 2M invocations/month).
- **Firebase CLI**: Install globally via `npm install -g firebase-tools`.
- **Node.js**: Node 20 runtime.

---

## Deployment Instructions

### 1. Authenticate with Firebase
```bash
firebase login
```

### 2. Select Your Existing Firebase Project
```bash
firebase use <YOUR_FIREBASE_PROJECT_ID>
```

### 3. Deploy Firestore Rules and Functions
From the repository root:
```bash
# 1. Deploy Firestore Security Rules (enables /devices subcollection and /system_status)
firebase deploy --only firestore:rules

# 2. Deploy Cloud Functions Backend
firebase deploy --only functions
```

---

## Local Testing with Emulators

You can test the Cloud Functions locally before deploying:
```bash
cd functions
npm install
npm run build
firebase emulators:start --only functions,firestore
```

Trigger an on-demand evaluation:
```bash
curl -X GET http://127.0.0.1:5001/<YOUR_PROJECT_ID>/asia-south1/testReminderDispatch
```
