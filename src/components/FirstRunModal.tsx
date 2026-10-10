import React, { useState } from 'react';
import { Compass, Calendar, Clock, Bell, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const FirstRunModal: React.FC = () => {
  const { userConfig, updateUserConfig, requestBrowserNotifications } = useApp();
  const [exactDateInput, setExactDateInput] = useState(userConfig.exactExamDate || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notificationState, setNotificationState] = useState<'prompt' | 'granted' | 'denied'>(
    userConfig.browserPermissionRequested
      ? userConfig.notificationsEnabled ? 'granted' : 'denied'
      : 'prompt'
  );

  if (userConfig.firstRunCompleted) return null;

  const handleEnableNotifications = async () => {
    const granted = await requestBrowserNotifications();
    setNotificationState(granted ? 'granted' : 'denied');
  };

  const handleFinish = () => {
    updateUserConfig({
      firstRunCompleted: true,
      exactExamDate: exactDateInput ? exactDateInput : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
            <Compass className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Your NIMCET 2027 preparation starts here.
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Welcome to PrepPilot, your dedicated entrance exam management cockpit.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-slate-900 dark:text-white">Start Date & Schedule:</span>
              <p className="text-slate-600 dark:text-slate-300">
                Starts on <strong className="font-semibold text-slate-900 dark:text-white">10 October 2026</strong>. Target exam month is <strong className="font-semibold text-slate-900 dark:text-white">May 2027</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-slate-900 dark:text-white">Daily Study Windows:</span>
              <p className="text-slate-600 dark:text-slate-300">
                Primary: <span className="tabular-nums font-mono text-slate-800 dark:text-slate-200">14:00–21:00</span> (7 hrs) &bull; Revision: <span className="tabular-nums font-mono text-slate-800 dark:text-slate-200">23:00–00:00</span> (1 hr).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-slate-900 dark:text-white">Smart Deadline Alerts:</span>
              <p className="text-slate-600 dark:text-slate-300">
                Get notified before target milestones without notification spam.
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Options */}
        <div className="mt-5 space-y-3">
          {/* Exact Date Option */}
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">Official Exam Date</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {exactDateInput ? `Set to ${exactDateInput}` : 'Not yet officially announced for NIMCET 2027'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {showDatePicker ? 'Done' : exactDateInput ? 'Change' : 'Configure now'}
              </button>
            </div>
            {showDatePicker && (
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-[11px] text-slate-500 mb-1">Select Exact Date:</label>
                <input
                  type="date"
                  value={exactDateInput}
                  onChange={(e) => setExactDateInput(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            )}
          </div>

          {/* Browser Notifications Option */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">Browser Reminders</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {notificationState === 'granted'
                  ? 'Notifications enabled'
                  : notificationState === 'denied'
                  ? 'Browser notifications blocked (in-app alerts active)'
                  : 'Receive timely study alerts in your browser'}
              </p>
            </div>
            {notificationState === 'prompt' && (
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Enable
              </button>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6">
          <button
            onClick={handleFinish}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-blue-700 active:scale-[0.99]"
          >
            <span>Begin with Preloaded Syllabus & Timetable</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
            90 official topics, weekly rotation, and milestones are ready for you.
          </p>
        </div>
      </div>
    </div>
  );
};
