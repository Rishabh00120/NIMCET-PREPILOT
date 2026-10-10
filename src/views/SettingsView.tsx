import React, { useState } from 'react';
import {
  Settings,
  Calendar,
  Clock,
  Bell,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Moon,
  Sun,
  AlertTriangle,
  Save,
  CheckCircle2,
  Smartphone,
  Server,
  Key,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isFirebaseConfigured, setupWebPushSubscription } from '../services/firebase';
import { PWAInstallButton } from '../components/PWAInstallButton';

export const SettingsView: React.FC = () => {
  const {
    userConfig,
    updateUserConfig,
    requestBrowserNotifications,
    exportBackupJSON,
    importBackupJSON,
    resetAllData,
  } = useApp();

  const [exactDateInput, setExactDateInput] = useState(userConfig.exactExamDate || '');
  const [primaryWindow, setPrimaryWindow] = useState(userConfig.primaryStudyWindow);
  const [revisionWindow, setRevisionWindow] = useState(userConfig.revisionWindow);
  const [saveToast, setSaveToast] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Web Push status state
  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserConfig({
      exactExamDate: exactDateInput ? exactDateInput : null,
      primaryStudyWindow: primaryWindow,
      revisionWindow: revisionWindow,
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  const handleEnableWebPush = async () => {
    setPushLoading(true);
    setPushStatusMessage(null);
    const result = await setupWebPushSubscription();
    setPushLoading(false);

    if (result.token) {
      updateUserConfig({
        fcmToken: result.token,
        firebaseConnected: true,
        notificationsEnabled: true,
      });
      setPushStatusMessage('Web Push successfully enabled! Token registered for background reminders.');
    } else {
      setPushStatusMessage(result.error || 'Failed to initialize Web Push subscription.');
    }
    setTimeout(() => setPushStatusMessage(null), 6000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importBackupJSON(content);
      if (success) {
        setImportStatus('Backup restored successfully! All data updated.');
      } else {
        setImportStatus('Failed to parse backup JSON. Please check file format.');
      }
      setTimeout(() => setImportStatus(null), 4000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
          <Settings className="h-4 w-4" />
          <span>App Configuration & Data Control</span>
        </div>
        <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
          Planner Settings & Backup Management
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Set official exam date, adjust study windows, manage browser reminders, and export/restore offline JSON backups.
        </p>

        {saveToast && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <span>Settings updated successfully!</span>
          </div>
        )}
      </div>

      {/* 2. Exam Date & Study Windows */}
      <form onSubmit={handleSaveGeneral} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Examination & Schedule Configuration
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Official NIMCET 2027 Exam Date
            </label>
            <input
              type="date"
              value={exactDateInput}
              onChange={(e) => setExactDateInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Leave blank if official date is not yet announced; May 2027 is used as provisional target.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Configured Timezone
            </label>
            <input
              type="text"
              disabled
              value="Asia/Kolkata (IST)"
              className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Primary Daily Study Window
            </label>
            <input
              type="text"
              value={primaryWindow}
              onChange={(e) => setPrimaryWindow(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Default: 14:00–21:00 (7 hours)
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Daily Revision Window
            </label>
            <input
              type="text"
              value={revisionWindow}
              onChange={(e) => setRevisionWindow(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Default: 23:00–00:00 (1 hour for spaced recall)
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Schedule Settings</span>
          </button>
        </div>
      </form>

      {/* 3. Weighting & Calculation Explanation */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
          Syllabus Calculation Methodology
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
          PrepPilot tracks both unweighted topic counts and exam-weighted percentages:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-white">Unweighted Method:</span>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Overall completion = (Completed trackable topics ÷ 90 total topics) × 100.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-white">Exam-Weighted Method:</span>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Weights topics by NIMCET question count: Maths (50/120 = 41.7%), Reasoning (40/120 = 33.3%), Computer (20/120 = 16.7%), English (10/120 = 8.3%).
            </p>
          </div>
        </div>
      </div>

      {/* 4. PWA Installation & Offline Support */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Progressive Web App (PWA) & Offline Access</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Install PrepPilot directly to your mobile home screen or desktop application launcher for offline capabilities.
            </p>
          </div>

          <PWAInstallButton />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="font-semibold text-slate-900 dark:text-white">Desktop (Chrome/Edge):</span>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Click the &quot;Install App&quot; button in the header or address bar. PrepPilot launches in a dedicated window without browser chrome.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="font-semibold text-slate-900 dark:text-white">Android:</span>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Tap &quot;Install App&quot; when prompted by Chrome. The app icon will appear with adaptive squircle masking on your launcher.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="font-semibold text-slate-900 dark:text-white">iPhone &amp; iPad:</span>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              In Safari, tap <strong>Share</strong> &rarr; <strong>Add to Home Screen</strong>. Web Push on iOS requires adding to Home Screen on iOS 16.4+.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Notification Controls & Server-Delivered Web Push */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <span>Notification Architecture &amp; Delivery Status</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            PrepPilot maintains 5 distinct notification layers to guarantee reliable study prompts across all platforms and networks.
          </p>
        </div>

        {/* 5-State Infrastructure Diagnostic Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {/* State 1: Browser OS Permission */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              1. Browser Permission
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">
                {typeof window !== 'undefined' && 'Notification' in window
                  ? Notification.permission.toUpperCase()
                  : 'UNSUPPORTED'}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold ${
                  typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
                  ? 'Active'
                  : 'Needs Action'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Native browser prompt permission for banner &amp; sound alerts.
            </p>
          </div>

          {/* State 2: Local In-App Reminders */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              2. Local Study Reminders
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">
                {userConfig.notificationsPaused ? 'Paused' : 'Active'}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold ${
                  !userConfig.notificationsPaused
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {!userConfig.notificationsPaused ? 'Running' : 'Paused'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Evaluates deadlines, timetable slots, and overdue tasks in-app.
            </p>
          </div>

          {/* State 3: Firebase Configuration */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              3. Firebase Configuration
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">
                {isFirebaseConfigured() ? 'Cloud Configured' : 'Local-First'}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold ${
                  isFirebaseConfigured()
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                }`}
              >
                {isFirebaseConfigured() ? 'Cloud Ready' : 'Local Mode'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {isFirebaseConfigured()
                ? 'Firebase environment credentials detected and verified.'
                : 'Local-first fallback active; no third-party keys required.'}
            </p>
          </div>

          {/* State 4: Registered Device Subscription */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              4. Device Push Token
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">
                {userConfig.fcmToken ? 'Subscribed' : 'Not Subscribed'}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold ${
                  userConfig.fcmToken
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {userConfig.fcmToken ? 'Token Stored' : 'Unregistered'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {userConfig.fcmToken
                ? 'Browser registration token is synced with unified service worker.'
                : 'Token not yet registered for background push.'}
            </p>
          </div>

          {/* State 5: Server-Side Push Delivery */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40 sm:col-span-2 lg:col-span-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              5. Server-Side Push Delivery
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">
                {isFirebaseConfigured() && userConfig.fcmToken
                  ? 'Server Dispatch Active'
                  : 'Client-Authoritative Dispatch'}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold ${
                  isFirebaseConfigured() && userConfig.fcmToken
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                }`}
              >
                {isFirebaseConfigured() && userConfig.fcmToken
                  ? 'Cloud Messaging'
                  : 'Local PWA Workers'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {isFirebaseConfigured() && userConfig.fcmToken
                ? 'Backend cloud workers trigger remote push dispatches for upcoming tests & slots.'
                : 'Service worker and tab timers trigger local scheduled notifications without server dependency.'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Register or Refresh Web Push Subscription
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Connects browser to the unified Workbox push handler to receive study prompts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleEnableWebPush}
                disabled={pushLoading}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shrink-0 shadow-2xs cursor-pointer"
              >
                <Key className="h-3.5 w-3.5" />
                <span>{pushLoading ? 'Registering...' : 'Register Web Push'}</span>
              </button>
            </div>
          </div>

          {pushStatusMessage && (
            <div className="mt-3 rounded-lg bg-white p-2.5 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200 border border-blue-200 dark:border-blue-900 font-medium">
              {pushStatusMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 text-xs">
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">Request Browser Permission</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Prompt native browser notification permission dialog
            </p>
          </div>

          <button
            onClick={requestBrowserNotifications}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
          >
            Prompt Permission
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 text-xs">
          <div>
            <span className="font-semibold text-slate-900 dark:text-white">Pause In-App Deadline Alerts</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Temporarily silence overdue topic prompts
            </p>
          </div>

          <input
            type="checkbox"
            checked={userConfig.notificationsPaused}
            onChange={(e) => updateUserConfig({ notificationsPaused: e.target.checked })}
            className="h-4 w-4 rounded-sm text-blue-600 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Reminder Frequency
          </label>
          <select
            value={userConfig.notificationFrequency}
            onChange={(e) => updateUserConfig({ notificationFrequency: e.target.value as any })}
            className="w-full sm:w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Reminders &amp; Deadlines</option>
            <option value="daily_summary">Daily Summary Only</option>
            <option value="urgent_only">Urgent Overdue Deadlines Only</option>
          </select>
        </div>
      </div>

      {/* 5. Data Persistence, Backup Export/Import & Reset */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Data Backup & Storage Control
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          All your progress, checklist states, logged hours, test scores, and error reflections are stored persistently in your browser.
        </p>

        {importStatus && (
          <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
            {importStatus}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={exportBackupJSON}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export Backup JSON</span>
          </button>

          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Upload className="h-4 w-4 text-slate-500" />
            <span>Import Backup JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset Data to Initial State</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Reset */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2.5 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-bold">Reset All PrepPilot Data?</h3>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will reset all your checklist progress, custom topics, logged study sessions, test scores, and error reflections back to the default syllabus and timetable. This cannot be undone unless you export a JSON backup first.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetAllData();
                  setShowResetConfirm(false);
                }}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
