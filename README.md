# PrepPilot | NIMCET 2027

A comprehensive, production-grade Progressive Web App (PWA) and study intelligence cockpit designed specifically for aspirants preparing for the **NIMCET 2027** Master of Computer Applications common entrance examination.

---

## Key Architecture & Core Systems

### 1. Dynamic Date & Timezone Engine (`Asia/Kolkata`)
- **Dynamic Anchoring:** Replaces fixed runtime dates with a reactive central date utility (`src/utils/dateUtils.ts`) locked to `Asia/Kolkata`.
- **Midnight Rollover & Background Wake:** Automatically detects midnight rollovers and tab focus events without requiring page reloads.
- **Historical Integrity:** Preserves the official preparation start date (`2026-10-10`) and all historical logged sessions while calculating upcoming milestones, overdue topics, and exam countdowns from the current date.

### 2. True Consecutive Study Streak
- **Streak Rules:**
  - Multiple sessions on the same calendar day count as 1 study day.
  - If a study session is logged today, the streak counts today plus previous consecutive days.
  - If the user has not yet studied today, the streak is kept alive if yesterday was studied (so early morning study sessions are not penalized).
  - Missing a day in between breaks the consecutive streak.
- **Weekly vs. Lifetime Study Hours:**
  - Weekly study hours strictly sum sessions within the current Monday–Sunday calendar week.
  - Lifetime study hours are isolated and tracked across all historical sessions.

### 3. Dual-Layer Storage & Safe Offline Sync
- **Dual Persistence:** Primary state is kept in `localStorage` with durable mirroring to `IndexedDB` (`preppilot_idb`).
- **Startup Protection:** Restores valid saved state from IndexedDB if local storage is ever cleared, preventing empty defaults from overwriting user data.
- **Safe Offline Queue Synchronization:** Queued offline modifications are preserved in IndexedDB and **never** deleted without verified remote acknowledgement.
- **Truthful Indicators:** Distinguishes between local-first storage mode and active remote cloud sync in the UI.

### 4. Focus Mode & Screen Wake Lock Lifecycle
- Pomodoro deep work cockpit with custom & preset intervals (25, 45, 60, 90 mins).
- Automatically acquires the Screen Wake Lock API during active sessions to keep the display awake.
- **Lifecycle Guarantees:** Wake lock is automatically released whenever a session completes, is reset, is abandoned, or when the tab becomes inactive.

### 5. Unified PWA & Service Worker
- Built with `vite-plugin-pwa` with `injectManifest` strategy (`src/sw.ts`).
- **Workbox Precaching:** Caches application shell, icons, styles, and offline fallback (`offline.html`).
- **Unified Push Handler:** Single service worker handles both standard Web Push and Firebase Cloud Messaging (FCM) background push notifications.
- **Offline Navigation:** Safely falls back to the precached single-page app shell when offline.

### 6. 5-State Notification Architecture
The notification preferences view separates and transparently reports:
1. **Browser Permission:** Real status (`granted`, `denied`, `default`, `unsupported`).
2. **Local Study Reminders:** In-app study interval and deadline alerts (`active` vs. `paused`).
3. **Firebase Cloud Configuration:** Verified presence of FCM environment variables.
4. **Device Push Token:** Device registration token status with the service worker.
5. **Server-Side Push Delivery:** Cloud background dispatch vs. client-side fallback.

---

## Build, Test & Run Instructions

### Prerequisites
- Node.js 22+
- npm or bun

### Commands

```bash
# 1. Install dependencies
npm install

# 2. Start the local development server (Port 3000)
npm run dev

# 3. Run the automated reliability test suite
npm test

# 4. Check TypeScript types
npm run lint

# 5. Build for production (Generates optimized dist/ and PWA service worker)
npm run build

# 6. Preview production build locally
npm run preview
```

---

## Reliability Test Suite

An executable test suite is located at `scripts/test-reliability.ts`. Run it with:
```bash
npm test
```
The suite verifies:
- Dynamic dates and timezone arithmetic across month/year/leap-year boundaries.
- Consecutive study streaks, buffer logic, and broken streak rules.
- Monday–Sunday weekly hours isolation versus lifetime hours.
- Unweighted and NIMCET 120-question weighted completion percentages.
- Overdue topic detection against dynamic current dates.
- Persistence recovery and safe offline queue acknowledgment.
- Parameterized HTTPS application URL validation, origin preservation, and hash routing.
- Multi-device partial failures, accurate FCM acceptance versus client display, and invalid token eviction.
- Primary study window, 23:00–00:00 revision window, quiet hours (01:00–07:00), and urgent bypass policy.
- Account-level timezone evaluation locked to user study timezone.

See [`functions/README.md`](./functions/README.md) for Cloud Functions v2 deployment and administrative testing instructions.

---

## Native Android Scaffold Status

See [`android/README.md`](./android/README.md) for full details. The `/android` folder contains an architectural scaffold (`MainActivity.kt`, `AndroidManifest.xml`). Complete APK compilation requires Gradle build scripts and native service implementations. The application is production-ready and fully functional as an installed Progressive Web App (PWA).
