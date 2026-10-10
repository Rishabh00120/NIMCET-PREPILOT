import React from 'react';
import { X, Bell, CheckCircle2, Clock, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose }) => {
  const {
    notifications,
    dismissNotification,
    snoozeNotification,
    clearAllNotifications,
    userConfig,
    updateUserConfig,
    requestBrowserNotifications,
    setActiveSection,
  } = useApp();

  if (!isOpen) return null;

  const activeNotifications = notifications.filter((n) => !n.dismissed);

  const handleAction = (actionUrl?: string) => {
    if (actionUrl) {
      setActiveSection(actionUrl as any);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Notification Centre
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Timely reminders, milestone warnings & catch-up advice
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Close notifications"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls bar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white">
              {activeNotifications.length} active alert{activeNotifications.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {activeNotifications.length > 0 && (
              <button
                onClick={clearAllNotifications}
                className="flex items-center gap-1 text-[11px] text-red-600 hover:underline dark:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear all</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {activeNotifications.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <h4 className="mt-2 text-xs font-semibold text-slate-900 dark:text-white">
                All caught up!
              </h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                No pending deadlines or missed sessions right now. You are ready for your study sessions!
              </p>
            </div>
          ) : (
            activeNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`rounded-xl border p-3.5 transition-colors ${
                  notif.type === 'deadline_passed'
                    ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    {notif.type === 'deadline_passed' ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <Clock className="mt-0.5 h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                        {notif.title}
                      </h4>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissNotification(notif.id)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => snoozeNotification(notif.id, 4)}
                      className="text-[11px] text-slate-500 hover:underline dark:text-slate-400"
                    >
                      Snooze 4h
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <button
                      onClick={() => dismissNotification(notif.id)}
                      className="text-[11px] text-slate-500 hover:underline dark:text-slate-400"
                    >
                      Dismiss
                    </button>
                  </div>

                  {notif.actionUrl && (
                    <button
                      onClick={() => handleAction(notif.actionUrl)}
                      className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
                    >
                      View in {notif.actionUrl}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: Browser Notification Toggle */}
        <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Browser Notifications</span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {userConfig.notificationsEnabled ? 'Active while tab is open' : 'Disabled'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (!userConfig.notificationsEnabled) {
                  requestBrowserNotifications();
                } else {
                  updateUserConfig({ notificationsEnabled: false });
                }
              }}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {userConfig.notificationsEnabled ? 'Turn Off' : 'Enable'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
