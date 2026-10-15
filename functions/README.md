# PrepPilot — Scheduled Web Push Notification Backend

This package contains the server-side scheduled notification dispatcher for PrepPilot, built on Firebase Cloud Functions v2 and Firebase Admin SDK.

## Architecture & Capabilities

1. **Server-Side Admin SDK**:
   - Runs strictly in Google Cloud / Firebase Cloud Functions v2 (Node.js 22 runtime).
   - Private service account credentials never leak to client code or browser bundles.

2. **Multi-Device Support & Per-Device Tracking**:
   - Dispatches to `user_push_subscriptions/{userId}/devices/{deviceId}`.
   - Distinct devices (phone, laptop, tablet) maintain independent registration tokens, device labels, and active statuses.
   - If Device A succeeds and Device B fails, subsequent retries target **only** Device B.
   - Safe legacy migration: previous root-level `fcmToken` entries are preserved.

3. **Accurate Delivery Status & FCM Acceptance**:
   - Explicitly distinguishes Firebase Cloud Messaging acceptance (`accepted_by_fcm`) from confirmed on-device display (`delivered`).
   - FCM acceptance verifies receipt and transmission by Google's push infrastructure; user-visible display on device depends on client device wake, network connectivity, and OS notification permissions.
   - Handles partial failures accurately: if 1 of 2 devices fails, the dispatch is recorded as `partial_failure` and reported as an incomplete dispatch.
   - Failed attempts log exact per-device error codes (e.g. `messaging/registration-token-not-registered`).

4. **Account-Level Timezone Evaluation**:
   - Timezone Policy: Uses one explicit account-level timezone (`userConfig.timezone`, defaulting to `Asia/Kolkata` for NIMCET preparation) consistently across all registered devices for an account.
   - All study timetable reminders, mock exam milestones, and spaced-revision intervals are evaluated against this account-level timezone so that all devices stay synchronized.

5. **Window Enforcement & Priority Policy**:
   - Enforces the primary study window (`14:00–21:00`) for normal advance study reminders.
   - Enforces the late evening revision window (`23:00–00:00`) for spaced recall items.
   - Urgent reminders (overdue tasks, today's deadlines, same-day mocks) obey the primary study window by default. They can bypass the primary study window only if the explicit user preference `urgentBypassStudyWindow` is enabled.
   - Quiet hours (`01:00` to `07:00`) are strictly enforced for all reminders under all circumstances.
   - Completed, deleted, or cancelled items are filtered out before dispatch.
   - Retries obey the exact same window and quiet-hours eligibility rules as initial dispatches.
   - Cloud Scheduler runs hourly (`0 8-23 * * *` Asia/Kolkata) during waking hours, fully serving the 09:00, 14:00, 20:00, and 23:00–00:00 revision windows.

6. **Validated Production URL (Parameterized Configuration)**:
   - Uses Firebase Functions v2 Parameterized Configuration (`defineString('PREPPILOT_APP_URL')`).
   - Requires an explicit, valid HTTPS production origin. Rejects embedded credentials, unexpected subpaths, and malformed URLs.
   - Automatically converts internal SPA hash routes (e.g. `/#/tasks?id=123`, `/#/settings`) into validated absolute HTTPS URLs for `webpush.fcmOptions.link`.
   - Uses the same validated origin for notification icons (`/pwa-192x192.png`) and monochrome status badges (`/badge-72x72.png`).

7. **Atomic Reservation & Bounded Retries**:
   - Atomic reservation using Firestore transactions prevents duplicate concurrent sends across multiple Cloud Function instances.
   - Safe recovery re-queues stale `in_progress` locks (> 5 minutes old).
   - Enforces a 3-attempt retry cap with a 30-minute backoff delay.
   - Automatically evicts invalid or expired FCM tokens (`active: false`).

---

## Prerequisites & Billing Requirements

- **Firebase Blaze Plan**: Google Cloud Scheduler and Firebase Cloud Functions v2 require the pay-as-you-go Blaze plan (includes 2M invocations/month free tier).
- **Firebase CLI**: Install globally via `npm install -g firebase-tools`.
- **Node.js**: Node 22 runtime (`node: "22"` in `package.json`).

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

### 3. Configure Parameterized Environment Variables
Create or verify `functions/.env` (or configure via Firebase CLI prompts / `.env.<project-id>`):
```bash
# Set your canonical deployed PrepPilot HTTPS origin (e.g. Vercel deployment URL):
PREPPILOT_APP_URL=https://REPLACE_WITH_YOUR_ACTUAL_DEPLOYED_PREPPILOT_URL
```
*(Firebase Functions v2 automatically reads parameters defined via `defineString` from `functions/.env` or prompts for them during initial deploy. You must configure the exact HTTPS origin of your deployed web client, e.g. `https://preppilot.vercel.app` or your custom domain. Placeholder domains such as `your-preppilot-domain` or `REPLACE_WITH_...` are intentionally rejected with an explicit error by `validateAppOrigin()` so unconfigured deployments fail fast rather than silently routing notifications to invalid hosts).*

### 4. Configure Administrative Secret (Secret Manager)
Set the secret used to protect the global administrative dispatch endpoint:
```bash
firebase functions:secrets:set ADMIN_DISPATCH_SECRET
```
(Enter your secure passphrase when prompted).

### 5. Deploy Firestore Rules and Functions
From the repository root:
```bash
# 1. Deploy Firestore Security Rules (enables /devices subcollection and /system_status)
firebase deploy --only firestore:rules

# 2. Deploy Cloud Functions Backend (predeploy hook automatically compiles TypeScript)
firebase deploy --only functions
```

---

## Testing Workflows

### 1. Administrative Global Dispatch Test (POST with Authorization)
Trigger on-demand reminder evaluation for all users (Administrative only; requires secret):
```bash
curl -X POST https://asia-south1-<YOUR_PROJECT_ID>.cloudfunctions.net/testReminderDispatch \
  -H "Authorization: Bearer <ADMIN_DISPATCH_SECRET>" \
  -H "Content-Type: application/json"
```
Or via custom header:
```bash
curl -X POST https://asia-south1-<YOUR_PROJECT_ID>.cloudfunctions.net/testReminderDispatch \
  -H "X-Admin-Key: <ADMIN_DISPATCH_SECRET>" \
  -H "Content-Type: application/json"
```

### 2. User Remote Push Test (In-App or via ID Token)
In the PrepPilot web application, navigate to **Settings** &rarr; **Notification Architecture & Delivery Status**:
- Click **Test Local Notification** to test browser audio cue, permission, and banner display.
- Click **Send Cloud Push Test** to dispatch a real remote push through Firebase Cloud Messaging strictly to your own registered devices.

Or via terminal with a Firebase User ID token:
```bash
curl -X POST https://asia-south1-<YOUR_PROJECT_ID>.cloudfunctions.net/sendUserTestNotification \
  -H "Authorization: Bearer <USER_ID_TOKEN>" \
  -H "Content-Type: application/json"
```

### 3. Local Testing with Emulators

Testing Cloud Functions locally requires choosing an approach that suits your testing target:

#### Option A: HTTPS Development Tunnel (Recommended for Real Device Push Testing)
Web Push notifications and mobile/desktop browsers require a secure HTTPS origin to display notifications and open notification action links (`webpush.fcmOptions.link`). When testing against a local PrepPilot instance on real devices:
```bash
# 1. Start your local Vite dev server in the project root
npm run dev

# 2. Expose port 3000 via a secure HTTPS tunnel (e.g. ngrok or Cloudflare Tunnel)
ngrok http 3000
# or: cloudflared tunnel --url http://localhost:3000

# 3. Start Firebase emulators using your tunnel HTTPS origin
cd functions
npm run build
ADMIN_DISPATCH_SECRET="test-secret-123" PREPPILOT_APP_URL="https://<your-tunnel-subdomain>.ngrok-free.app" firebase emulators:start --only functions,firestore
```

#### Option B: Isolated Emulator Environment (HTTP localhost)
For testing Cloud Scheduler logic, Firestore triggers, and administrative dispatch endpoints strictly within the local Firebase emulator suite, `firebase emulators:start` automatically runs with `FUNCTIONS_EMULATOR=true`. The origin validator explicitly permits `http://localhost:3000` or `http://127.0.0.1:3000` **only** when running inside an isolated emulator or test environment:
```bash
cd functions
npm run build
ADMIN_DISPATCH_SECRET="test-secret-123" PREPPILOT_APP_URL="http://localhost:3000" FUNCTIONS_EMULATOR="true" firebase emulators:start --only functions,firestore
```
*(Note: Production environments never allow plain HTTP or localhost origins; attempts to deploy with non-HTTPS or placeholder URLs are rejected by `validateAppOrigin()` to preserve push security).*

Trigger local evaluation:
```bash
curl -X POST http://127.0.0.1:5001/<YOUR_PROJECT_ID>/asia-south1/testReminderDispatch \
  -H "Authorization: Bearer test-secret-123" \
  -H "Content-Type: application/json"
```
