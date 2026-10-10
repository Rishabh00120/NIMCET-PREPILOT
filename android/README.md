# PrepPilot — Android Native Scaffold Audit & Architecture Blueprint

## Current Status: Prototype Scaffold (Incomplete — Do Not Claim APK Builds)

The `/android` directory in this repository is currently an **architectural prototype scaffold** and is **NOT** a complete or buildable Gradle Android project. The primary, production-ready runtime of PrepPilot in this repository is the **Progressive Web App (PWA)**, which is 100% buildable, installable, and fully functional offline.

---

## 1. Missing Components Inventory

To compile this project into a native Android APK using Android Studio or the Gradle CLI, the following files and implementations must be added:

### A. Gradle Build System (Absent)
- `android/build.gradle` (Root project Gradle script specifying Google repositories, Android Gradle Plugin `com.android.tools.build:gradle:8.x`, and Kotlin Gradle Plugin).
- `android/settings.gradle` (Settings script including the `:app` module and Capacitor Android plugins).
- `android/gradle.properties` (JVM memory allocations, AndroidX flags: `android.useAndroidX=true`, `android.enableJetifier=true`).
- `android/gradlew` & `android/gradlew.bat` (Gradle wrapper executables).
- `android/gradle/wrapper/gradle-wrapper.jar` & `android/gradle/wrapper/gradle-wrapper.properties` (Distribution URL for Gradle 8.x).
- `android/app/build.gradle` (Module-level build script specifying `compileSdk`, `targetSdk`, `minSdk 26+`, dependencies for `@capacitor/android`, AndroidX, Kotlin stdlib, and desugaring).

### B. Missing Native Kotlin Classes (Referenced in Manifest / MainActivity)
- `com.preppilot.nimcet2027.MobileFocusLockPlugin` (Capacitor plugin bridge implementing `@CapacitorPlugin(name = "MobileFocusLock")`, bridging JS calls to native services).
- `com.preppilot.nimcet2027.FocusLockService` (Foreground Android Service running ongoing notification with `FOREGROUND_SERVICE_SPECIAL_USE` to monitor active apps).
- `com.preppilot.nimcet2027.FocusLockOverlayActivity` (Overlay dialog shown when an un-allowlisted distracting app is opened).
- `com.preppilot.nimcet2027.BootReceiver` (BroadcastReceiver for `BOOT_COMPLETED` to release any stale system lock if the phone is rebooted).
- `com.preppilot.nimcet2027.UsageStatsHelper` (Helper to query `UsageStatsManager` to determine the current foreground application package name).

### C. Missing Android Resources
- `android/app/src/main/res/values/styles.xml` or `themes.xml` (defining `@style/AppTheme`).
- `android/app/src/main/res/mipmap-*` (launcher icons).

---

## 2. PWA vs. Native Boundaries

- **PWA Environment (Current Production Build):**
  - Runs in standard browser or standalone installed PWA mode.
  - Cannot and does not attempt to lock out external Android apps.
  - Provides distraction-blocking guidance: OS Digital Wellbeing Focus Mode instructions, Screen Time guidance, and routine checklists.
  - Integrates Pomodoro timer, Screen Wake Lock API, spaced repetition, study analytics, and Web Push notifications.

- **Native Android Companion (Future Native Target):**
  - If developed as a separate Google AI Studio Android project, it will implement native `UsageStatsManager`, `SYSTEM_ALERT_WINDOW`, and `ForegroundService`.
  - The Web/PWA codebase already contains the typed bridge interface in `src/services/mobileFocusLockPlugin.ts` which automatically detects whether it is running on web or native via `Capacitor.isNativePlatform()`.
