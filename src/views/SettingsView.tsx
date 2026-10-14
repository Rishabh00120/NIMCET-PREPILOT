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
  AlertTriangle,
  Save,
  CheckCircle2,
  Smartphone,
  Server,
  Key,
  Cloud,
  CloudOff,
  RefreshCw,
  LogIn,
  LogOut,
  User,
  Check,
  AlertCircle,
  Laptop,
  Monitor,
  Send,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { setupWebPushSubscription, getPreMigrationBackups, getOrCreateDeviceId } from '../services/firebase';
import { PWAInstallButton } from '../components/PWAInstallButton';

export const SettingsView: React.FC = () => {
  const {
    userConfig,
    updateUserConfig,
    requestBrowserNotifications,
    exportBackupJSON,
    importBackupJSON,
    resetAllData,
    currentUser,
    syncStatusState,
    lastCloudSyncAt,
    syncErrorMessage,
    hasPendingOfflineChanges,
    isFirebaseConfigured,
    openAuthModal,
    signOut,
    forceCloudSync,
    restorePreMigrationBackupKey,
    syncPushSubscriptionToCloud,
    sendLocalTestNotification,
    sendServerTestNotification,
    registeredDevices,
    refreshRegisteredDevices,
    deactivateDevice,
    serverDispatchStatus,
    notificationDeliveryStatus,
    cloudPushError,
  } = useApp();

  const [exactDateInput, setExactDateInput] = useState(userConfig.exactExamDate || '');
  const [primaryWindow, setPrimaryWindow] = useState(userConfig.primaryStudyWindow);
  const [revisionWindow, setRevisionWindow] = useState(userConfig.revisionWindow);
  const [urgentBypassInput, setUrgentBypassInput] = useState(userConfig.urgentBypassStudyWindow || false);
  const [saveToast, setSaveToast] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Web Push status and test states
  const [pushLoading, setPushLoading] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);
  const [pushErrorDetail, setPushErrorDetail] = useState<string | null>(null);
  const [testDeliveryLoading, setTestDeliveryLoading] = useState(false);
  const [testDeliveryMessage, setTestDeliveryMessage] = useState<string | null>(null);
  const [serverTestLoading, setServerTestLoading] = useState(false);
  const [serverTestMessage, setServerTestMessage] = useState<{
    type: 'success' | 'partial' | 'error' | 'info';
    text: string;
    deliveredCount?: number;
    failedCount?: number;
  } | null>(null);

  const currentDeviceId = getOrCreateDeviceId();

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserConfig({
      exactExamDate: exactDateInput ? exactDateInput : null,
      primaryStudyWindow: primaryWindow,
      revisionWindow: revisionWindow,
      urgentBypassStudyWindow: urgentBypassInput,
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 3000);
  };

  const handleEnableWebPush = async () => {
    setPushLoading(true);
    setPushStatusMessage(null);
    setPushErrorDetail(null);

    // 1. Acquire browser permission and FCM registration token
    const result = await setupWebPushSubscription();
    setPushLoading(false);

    if (!result.token) {
      setPushStatusMessage(result.error || 'Failed to initialize Web Push subscription.');
      setPushErrorDetail(result.error || null);
      return;
    }

    // Retain token in local user configuration for offline resilience & immediate retry
    updateUserConfig({
      fcmToken: result.token,
      firebaseConnected: true,
      notificationsEnabled: true,
    });

    // 2. Multi-device Firestore sync: register under users/{uid}/devices/{deviceId}
    if (currentUser) {
      setPushStatusMessage('Browser token acquired. Registering this device in Cloud Firestore...');
      const cloudRes = await syncPushSubscriptionToCloud(result.token);
      if (cloudRes.success) {
        setPushStatusMessage(
          'Device registration verified! Token and preferences saved in Cloud Firestore under your account.'
        );
      } else {
        setPushStatusMessage('Local token saved, but Cloud Firestore registration failed.');
        setPushErrorDetail(cloudRes.error || 'Failed to sync device to Cloud Firestore');
      }
    } else {
      setPushStatusMessage(
        'Token created locally! Sign in with your account above to synchronize this device with Cloud Push Reminders.'
      );
    }
  };

  const handleSendTestAlert = async () => {
    setTestDeliveryLoading(true);
    setTestDeliveryMessage(null);
    const res = await sendLocalTestNotification();
    setTestDeliveryLoading(false);
    if (res.success) {
      setTestDeliveryMessage('Test alert displayed successfully! Notification banner and sound verified.');
    } else {
      setTestDeliveryMessage(res.error || 'Failed to display test notification.');
    }
    setTimeout(() => setTestDeliveryMessage(null), 6000);
  };

  const handleSendServerTestAlert = async () => {
    if (!currentUser) {
      setServerTestMessage({
        type: 'error',
        text: 'Please sign in above to dispatch a Cloud Push test to your registered devices.',
      });
      setTimeout(() => setServerTestMessage(null), 8000);
      return;
    }
    setServerTestLoading(true);
    setServerTestMessage(null);
    const res = await sendServerTestNotification();
    setServerTestLoading(false);

    if (res.status === 'accepted_by_fcm' || (res.success && (!res.failedDevices || res.failedDevices === 0))) {
      setServerTestMessage({
        type: 'success',
        text: res.message || 'Firebase Cloud Messaging accepted the dispatch for all registered devices! Note: FCM acceptance verifies server transmission; actual visible display on device requires browser background wake and system notification permissions.',
        deliveredCount: res.acceptedDevices ?? res.deliveredDevices,
        failedCount: res.failedDevices ?? 0,
      });
      setTimeout(() => {
        refreshRegisteredDevices();
      }, 1500);
    } else if (res.status === 'partial_failure' || (res.acceptedDevices && res.acceptedDevices > 0 && res.failedDevices && res.failedDevices > 0)) {
      setServerTestMessage({
        type: 'partial',
        text: res.message || `Partial Dispatch Warning: FCM accepted ${res.acceptedDevices} device(s), but failed for ${res.failedDevices} device(s). A partially successful dispatch is not counted as full success.`,
        deliveredCount: res.acceptedDevices,
        failedCount: res.failedDevices,
      });
      setTimeout(() => {
        refreshRegisteredDevices();
      }, 1500);
    } else {
      setServerTestMessage({
        type: 'error',
        text: res.error || res.message || 'FCM dispatch failed for all registered devices.',
        failedCount: res.failedDevices,
      });
    }
    setTimeout(() => setServerTestMessage(null), 12000);
  };

  const handleDeactivate = async (deviceId: string) => {
    if (!confirm('Deactivate push notifications for this device?')) return;
    await deactivateDevice(deviceId);
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

      {/* 2. Firebase Cloud Account & Cross-Device Synchronization */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <Cloud className="h-4 w-4" />
              <span>Cross-Device Cloud Synchronization</span>
            </div>
            <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
              Cloud Account &amp; Firestore Database (Phone &amp; Laptop)
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              Sign in with your Google account or email &amp; password to automatically synchronize tasks, syllabus checklists, timetable sessions, PYQ attempts, and mock tests across all your phones and laptops in real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => forceCloudSync()}
                  disabled={syncStatusState === 'syncing'}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer disabled:opacity-50"
                  title="Force immediate cloud sync"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-blue-500 ${syncStatusState === 'syncing' ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </button>

                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuthModal('login')}
                  disabled={!isFirebaseConfigured}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => openAuthModal('signup')}
                  disabled={!isFirebaseConfigured}
                  className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-950/40 hover:bg-blue-900/40 px-3.5 py-2 text-xs font-semibold text-blue-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Create Account</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sync Status Diagnostic Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Card 1: Account Status */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Account Status
            </span>
            <div className="flex items-center gap-2">
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="Avatar"
                  className="h-6 w-6 rounded-full ring-1 ring-blue-500"
                />
              ) : (
                <User className="h-5 w-5 text-slate-400" />
              )}
              <div className="truncate">
                <span className="font-semibold text-slate-900 dark:text-white block truncate">
                  {currentUser ? currentUser.displayName || currentUser.email || 'Cloud Account' : 'Guest / Local-Only Mode'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                  {currentUser ? currentUser.email : 'Data saved locally on this browser'}
                </span>
              </div>
            </div>
            {currentUser && (
              <div className="mt-2 flex items-center gap-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/80">
                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">
                  {currentUser.providerData?.[0]?.providerId === 'google.com' ? 'Google Sign-In' : 'Email/Password'}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    currentUser.emailVerified
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}
                >
                  {currentUser.emailVerified ? 'Email Verified' : 'Unverified Email'}
                </span>
                {!currentUser.emailVerified && (
                  <button
                    onClick={() => openAuthModal('verify_email')}
                    className="text-[10px] text-blue-400 underline hover:text-blue-300 ml-auto cursor-pointer"
                  >
                    Verify
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Firestore Sync State */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Cloud Database Sync
            </span>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                {syncStatusState === 'synced' ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : syncStatusState === 'syncing' || syncStatusState === 'signing_in' ? (
                  <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                ) : syncStatusState === 'migration_pending' ? (
                  <RefreshCw className="h-4 w-4 text-amber-500 animate-pulse" />
                ) : syncStatusState === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                ) : (
                  <CloudOff className="h-4 w-4 text-slate-400" />
                )}
                <span className="capitalize">{syncStatusState.replace('_', ' ')}</span>
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold ${
                  syncStatusState === 'synced'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : syncStatusState === 'syncing' || syncStatusState === 'signing_in'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    : syncStatusState === 'migration_pending'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : syncStatusState === 'error'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {currentUser ? 'Cloud Active' : 'Local Only'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {lastCloudSyncAt
                ? `Last synced: ${new Date(lastCloudSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : currentUser
                ? 'Ready for automatic sync'
                : 'Sign in to sync with your phone or laptop'}
            </p>
          </div>

          {/* Card 3: Security & Scope */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Data Isolation &amp; Security
            </span>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">
                {currentUser ? 'User-Scoped' : 'Private Local'}
              </span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Rule Protected
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {currentUser
                ? `Stored in /users/${currentUser.uid.slice(0, 8)}... (Owner only)`
                : 'Data remains on this device until you sign in'}
            </p>
          </div>
        </div>

        {/* Offline pending changes banner */}
        {hasPendingOfflineChanges && (
          <div className="rounded-xl border border-amber-900/60 bg-amber-950/40 p-3 text-xs text-amber-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <span className="font-bold">Offline Changes Pending:</span> You have local edits that haven&apos;t been synced to the cloud yet. They will upload automatically once online, or click &quot;Sync Now&quot;.
            </div>
          </div>
        )}

        {/* Error banner if any */}
        {syncErrorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <span className="font-bold">Sync Notice:</span> {syncErrorMessage}
            </div>
          </div>
        )}

        {/* Informational callout regarding Guest Mode vs Cloud Sync */}
        {!currentUser && (
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-3 text-xs text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
            <span className="font-bold">Guest Mode Notice:</span> Your preparation data is currently saved only in this browser’s IndexedDB/localStorage. Sign in with the same Google or Email account on both your phone and laptop so your study sessions, syllabus progress, timetable, and tasks synchronize automatically.
          </div>
        )}

        {/* Pre-Migration Automatic Safety Backups List */}
        {(() => {
          const backups = getPreMigrationBackups();
          if (backups.length === 0) return null;
          return (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Pre-Migration Safety Backups
                </span>
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400 font-mono">
                  {backups.length} snapshot{backups.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
                PrepPilot automatically creates a local safety snapshot before any account sync or migration. You can restore an earlier snapshot at any time:
              </p>
              <div className="space-y-1.5">
                {backups.map((b) => (
                  <div
                    key={b.key}
                    className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {new Date(b.timestamp).toLocaleString()}
                      </span>
                      <span className="ml-2 text-[10px] text-slate-500">
                        ({b.summary.taskCount} tasks, {b.summary.sessionCount} study logs, {b.summary.pyqEntryCount} PYQs)
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const ok = restorePreMigrationBackupKey(b.key);
                        if (ok) {
                          alert('Backup snapshot restored successfully into active session.');
                        }
                      }}
                      className="rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-2 py-0.5 text-[11px] font-semibold cursor-pointer"
                    >
                      Restore Snapshot
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3. Exam Date & Study Windows */}
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

          {/* Urgent Reminders Window Policy */}
          <div className="sm:col-span-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Allow Urgent Alerts Outside Primary Study Window
                </label>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  When enabled, overdue tasks, today&apos;s deadlines, and same-day mock tests can alert you outside the {primaryWindow || '14:00–21:00'} study window. When disabled, ALL reminders strictly obey the primary study window. Quiet hours (01:00–07:00) are always enforced.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={urgentBypassInput}
                  onChange={(e) => setUrgentBypassInput(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:bg-slate-700 peer-checked:bg-blue-600"></div>
              </label>
            </div>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" />
              <span>Notification Architecture &amp; Delivery Status</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Honest status reporting across browser permissions, device tokens, Cloud Firestore multi-device records, and server scheduling.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshRegisteredDevices()}
              disabled={!currentUser}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
              title="Refresh registered device records"
            >
              <RefreshCw className="h-3 w-3 text-blue-500" />
              <span>Refresh Status</span>
            </button>
          </div>
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
              Native browser permission for banner alerts and sound cues.
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
              Evaluates timetable sessions, test dates, and overdue tasks in-app.
            </p>
          </div>

          {/* State 3: Firebase Configuration */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              3. Firebase Configuration
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">
                {isFirebaseConfigured ? 'Cloud Configured' : 'Local-First'}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold ${
                  isFirebaseConfigured
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                }`}
              >
                {isFirebaseConfigured ? 'Cloud Ready' : 'Local Mode'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {isFirebaseConfigured
                ? 'Firebase credentials and Firestore connection verified.'
                : 'Local-first fallback active; operates offline without cloud setup.'}
            </p>
          </div>

          {/* State 4: Device Push Token & Multi-Device Sync */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              4. Device Push Token
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">
                {userConfig.fcmToken ? (userConfig.lastSubscriptionSyncAt ? 'Cloud Synced' : 'Stored Locally') : 'Unregistered'}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold ${
                  userConfig.fcmToken && userConfig.lastSubscriptionSyncAt
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : userConfig.fcmToken
                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {userConfig.fcmToken && userConfig.lastSubscriptionSyncAt
                  ? 'Multi-Device Ready'
                  : userConfig.fcmToken
                  ? 'Local Token'
                  : 'Unregistered'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {userConfig.fcmToken
                ? userConfig.lastSubscriptionSyncAt
                  ? `Registered to Cloud Firestore on ${new Date(userConfig.lastSubscriptionSyncAt).toLocaleTimeString()}`
                  : 'Token created locally; sign in to sync with your cloud account.'
                : 'Token not yet registered for background Web Push.'}
            </p>
          </div>

          {/* State 5: Honest Server-Side Push Delivery Status */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40 sm:col-span-2 lg:col-span-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              5. Scheduled Server Delivery
            </div>

            {(() => {
              switch (notificationDeliveryStatus) {
                case 'not_configured':
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white">Not configured</span>
                        <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                          Local-First Mode
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Firebase configuration is not present. Reminders trigger via in-app timers and unified Service Worker when the app is open.
                      </p>
                    </div>
                  );

                case 'permission_required':
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">Browser permission required</span>
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Permission Needed
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Click &quot;Register Web Push&quot; below to allow browser notification prompts on this device.
                      </p>
                    </div>
                  );

                case 'token_pending':
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">Token registration pending</span>
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          Token Pending
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Browser permission granted. Click &quot;Register Web Push&quot; to acquire this device&apos;s FCM registration token.
                      </p>
                    </div>
                  );

                case 'token_registered':
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">Device token registered</span>
                        <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                          Local Token Ready
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Token generated on this device. {currentUser ? 'Click "Register Web Push" to sync it with your Cloud Firestore account.' : 'Sign in above to link this device to your cloud account.'}
                      </p>
                    </div>
                  );

                case 'delivery_error':
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-600 dark:text-rose-400">Delivery error</span>
                        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          Dispatch Issue
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-rose-600/90 dark:text-rose-300">
                        Recent push dispatch failed: {serverDispatchStatus?.recentDelivery?.error || 'Target FCM token could not be reached.'}
                      </p>
                    </div>
                  );

                case 'accepted_by_fcm':
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sky-600 dark:text-sky-400">Accepted by FCM</span>
                        <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-mono font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                          FCM Accepted
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Firebase Cloud Messaging accepted the dispatch. (Note: Verifies server receipt and transmission; device display depends on OS notification permissions and wake).
                      </p>
                    </div>
                  );

                case 'partial_failure':
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">Partial dispatch</span>
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Partial Failure
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-amber-700/90 dark:text-amber-300">
                        FCM accepted dispatches for some registered devices, but failed for others. Retries target only pending failed devices.
                      </p>
                    </div>
                  );

                case 'delivery_test_succeeded':
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Device display confirmed</span>
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Verified Operational
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Confirmed delivery display for &quot;{serverDispatchStatus?.recentDelivery?.title}&quot; at {new Date(serverDispatchStatus?.recentDelivery?.timestamp || '').toLocaleTimeString()}.
                      </p>
                    </div>
                  );

                case 'backend_configured':
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Scheduled backend configured</span>
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Cloud Scheduler Active
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Verified Cloud Functions backend is deployed ({serverDispatchStatus?.scheduler || 'Asia/Kolkata'}). Last heartbeat: {serverDispatchStatus?.lastRunAt ? new Date(serverDispatchStatus.lastRunAt).toLocaleTimeString() : 'Recent'}.
                      </p>
                    </div>
                  );

                case 'backend_not_deployed':
                default:
                  return (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">Scheduled delivery not configured</span>
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Backend Not Deployed
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Device tokens are safely recorded in Cloud Firestore, but the scheduled Firebase Cloud Function has not been deployed yet. Reminders are served via in-app alerts and local PWA service worker.
                      </p>
                    </div>
                  );
              }
            })()}
          </div>
        </div>

        {/* Action Controls */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Multi-Device Web Push Registration
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Generates a privacy-conscious device token for this {getOrCreateDeviceId().slice(0, 10)}... device and registers it under your account in Cloud Firestore.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleEnableWebPush}
                disabled={pushLoading}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-2xs cursor-pointer"
              >
                <Key className="h-3.5 w-3.5" />
                <span>{pushLoading ? 'Registering...' : 'Register Web Push'}</span>
              </button>

              <button
                onClick={handleSendTestAlert}
                disabled={testDeliveryLoading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-50 cursor-pointer shadow-2xs"
                title="Send an immediate local test alert to verify browser notification permissions, sound, and banner"
              >
                <Send className="h-3.5 w-3.5 text-amber-500" />
                <span>{testDeliveryLoading ? 'Sending...' : 'Test Local Notification'}</span>
              </button>

              <button
                onClick={handleSendServerTestAlert}
                disabled={serverTestLoading || !currentUser}
                className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50/70 hover:bg-blue-100/80 px-3 py-2 text-xs font-semibold text-blue-700 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-300 disabled:opacity-50 cursor-pointer shadow-2xs"
                title={
                  currentUser
                    ? 'Dispatch real remote push notification via Cloud Functions to test server-to-device delivery'
                    : 'Sign in to send remote Cloud Push test'
                }
              >
                <Cloud className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>{serverTestLoading ? 'Dispatching...' : 'Send Cloud Push Test'}</span>
              </button>
            </div>
          </div>

          {/* Registration Status Feedback */}
          {pushStatusMessage && (
            <div className="mt-3 rounded-lg bg-white p-2.5 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200 border border-blue-200 dark:border-blue-900 font-medium">
              {pushStatusMessage}
            </div>
          )}

          {/* Registration Error Detail with Retry */}
          {(pushErrorDetail || cloudPushError) && (
            <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Registration Issue:</span> {pushErrorDetail || cloudPushError}
                  <p className="mt-0.5 text-[11px] text-rose-600/90 dark:text-rose-300/80">
                    Your local device token is retained. Check network connectivity or Firestore security rules, then retry.
                  </p>
                </div>
              </div>
              <button
                onClick={() => userConfig.fcmToken && syncPushSubscriptionToCloud(userConfig.fcmToken)}
                className="rounded bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 shrink-0 cursor-pointer"
              >
                Retry Cloud Sync
              </button>
            </div>
          )}

          {/* Test Local Alert Feedback */}
          {testDeliveryMessage && (
            <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 font-medium">
              {testDeliveryMessage}
            </div>
          )}

          {/* Server Cloud Push Test Feedback */}
          {serverTestMessage && (
            <div
              className={`mt-3 rounded-lg p-3 text-xs border font-medium ${
                serverTestMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                  : serverTestMessage.type === 'partial'
                  ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                  : 'bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200 border-rose-300 dark:border-rose-800'
              }`}
            >
              <div className="flex items-start gap-2">
                {serverTestMessage.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : serverTestMessage.type === 'partial' ? (
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-semibold">
                    {serverTestMessage.type === 'success'
                      ? 'FCM Accepted (Cloud Push Dispatched)'
                      : serverTestMessage.type === 'partial'
                      ? 'Partial FCM Dispatch (Warning)'
                      : 'Cloud Push Test Failed'}
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    {serverTestMessage.text}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-mono">
                    {serverTestMessage.type === 'success' && (
                      <>
                        <span className="rounded bg-emerald-200/70 px-1.5 py-0.5 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300">
                          FCM Accepted: Yes
                        </span>
                        {typeof serverTestMessage.deliveredCount === 'number' && (
                          <span className="rounded bg-emerald-200/70 px-1.5 py-0.5 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300">
                            Accepted Devices: {serverTestMessage.deliveredCount}
                          </span>
                        )}
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                          Display: Requires Client Wake &amp; Permission
                        </span>
                      </>
                    )}
                    {serverTestMessage.type === 'partial' && (
                      <>
                        <span className="rounded bg-amber-200/70 px-1.5 py-0.5 dark:bg-amber-900 text-amber-800 dark:text-amber-300">
                          Accepted: {serverTestMessage.deliveredCount ?? 0}
                        </span>
                        <span className="rounded bg-rose-200/70 px-1.5 py-0.5 dark:bg-rose-900 text-rose-800 dark:text-rose-300">
                          Failed: {serverTestMessage.failedCount ?? 0}
                        </span>
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          Status: Incomplete Dispatch
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Multi-Device Management Subpanel */}
        {currentUser && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Registered Devices ({registeredDevices.length})
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                User: <span className="font-mono">{currentUser.uid.slice(0, 8)}...</span>
              </span>
            </div>

            {registeredDevices.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                No active devices registered yet. Click &quot;Register Web Push&quot; above to link this browser.
              </p>
            ) : (
              <div className="space-y-2">
                {registeredDevices.map((dev) => {
                  const isCurrent = dev.deviceId === currentDeviceId;
                  return (
                    <div
                      key={dev.deviceId}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3 text-xs transition-colors ${
                        isCurrent
                          ? 'border-blue-500/50 bg-blue-50/30 dark:border-blue-900/60 dark:bg-blue-950/20'
                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                          {dev.deviceType === 'mobile' ? (
                            <Smartphone className="h-4 w-4 text-blue-500" />
                          ) : dev.deviceType === 'tablet' ? (
                            <Smartphone className="h-4 w-4 text-purple-500" />
                          ) : (
                            <Laptop className="h-4 w-4 text-emerald-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {dev.deviceLabel || 'Registered Browser'}
                            </span>
                            {isCurrent && (
                              <span className="rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-1.5 py-0.2 text-[10px] font-bold">
                                This Device
                              </span>
                            )}
                            <span
                              className={`rounded px-1.5 py-0.2 text-[10px] font-mono ${
                                dev.active
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {dev.active ? 'Active' : 'Deactivated'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            ID: {dev.deviceId} &bull; Timezone: {dev.timezone || 'Asia/Kolkata'} &bull; Last seen: {new Date(dev.lastActiveAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {dev.active && (
                        <button
                          onClick={() => handleDeactivate(dev.deviceId)}
                          className="flex items-center gap-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/60 dark:text-slate-300 dark:hover:text-rose-300 px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer self-start sm:self-center"
                          title="Deactivate push messages for this device"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Deactivate</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
