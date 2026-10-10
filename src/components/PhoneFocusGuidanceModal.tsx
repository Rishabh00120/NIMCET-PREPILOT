import React, { useState } from 'react';
import {
  X,
  Smartphone,
  ExternalLink,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Apple,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { DevicePlatform } from '../hooks/useDevicePlatform';

interface PhoneFocusGuidanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlatform?: DevicePlatform;
}

export const PhoneFocusGuidanceModal: React.FC<PhoneFocusGuidanceModalProps> = ({
  isOpen,
  onClose,
  defaultPlatform = 'android',
}) => {
  const [platformTab, setPlatformTab] = useState<DevicePlatform>(defaultPlatform);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Phone Focus & App Restriction Setup
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure your mobile operating system to pause distracting apps during study
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-6 py-2.5 dark:border-slate-800 dark:bg-slate-950/40">
          <button
            onClick={() => setPlatformTab('android')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              platformTab === 'android'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>Android (Digital Wellbeing)</span>
          </button>
          <button
            onClick={() => setPlatformTab('ios')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              platformTab === 'ios'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>iPhone / iPad (Apple Focus)</span>
          </button>
          <button
            onClick={() => setPlatformTab('desktop')}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              platformTab === 'desktop'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>Desktop DND</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Transparency Sandbox Notice */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs dark:border-blue-950 dark:bg-blue-950/30">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-blue-950 dark:text-blue-200">
                <strong>Why configure this in your phone settings?</strong>
                <p className="mt-0.5 text-[11px] leading-relaxed text-blue-800 dark:text-blue-300">
                  Web browsers and PWAs operate inside a secure privacy sandbox and cannot close or block other installed apps. Using your phone’s built-in system Focus Mode allows Android or iOS to directly pause distracting apps while you study.
                </p>
              </div>
            </div>
          </div>

          {platformTab === 'android' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Step-by-Step Android Digital Wellbeing Setup:
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    1
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    Open your phone’s <strong className="text-slate-900 dark:text-white">Settings</strong> app, then scroll and tap <strong className="text-slate-900 dark:text-white">Digital Wellbeing &amp; parental controls</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    2
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    Tap <strong className="text-slate-900 dark:text-white">Focus mode</strong> (found under &quot;Ways to disconnect&quot;).
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    3
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    Select your most distracting apps to pause: <strong className="text-slate-900 dark:text-white">Instagram, YouTube, WhatsApp, Reddit, Games, Telegram</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    4
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    Tap <strong className="text-slate-900 dark:text-white">Turn on now</strong> before starting your Pomodoro, or set a recurring schedule matching your study windows (14:00–21:00).
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                    &star;
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">Pro Tip:</strong> Swipe down your phone’s notification shade, tap the edit pencil, and add the <strong className="text-slate-900 dark:text-white">Focus mode</strong> tile to your Quick Settings for 1-tap activation!
                  </div>
                </div>
              </div>

              {/* Official Google Documentation Link */}
              <div className="pt-2">
                <a
                  href="https://support.google.com/android/answer/9346420"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                >
                  <span>Google Support: Manage how you spend time on your Android phone</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}

          {platformTab === 'ios' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Step-by-Step iPhone &amp; iPad Focus &amp; Screen Time Setup:
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    1
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    Open <strong className="text-slate-900 dark:text-white">Settings</strong> &rarr; tap <strong className="text-slate-900 dark:text-white">Focus</strong> (or swipe down Control Center and press &amp; hold the Focus icon).
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    2
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    Select <strong className="text-slate-900 dark:text-white">Do Not Disturb</strong> or tap <strong className="text-slate-900 dark:text-white">+</strong> to create a custom &quot;Study&quot; Focus.
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    3
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    Under <strong className="text-slate-900 dark:text-white">Silence Notifications</strong>, choose <strong className="text-slate-900 dark:text-white">People: None</strong> and <strong className="text-slate-900 dark:text-white">Apps: Only essential</strong> so message popups don’t break your train of thought.
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    4
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">To limit distracting apps:</strong> Go to <strong className="text-slate-900 dark:text-white">Settings &rarr; Screen Time &rarr; App Limits &rarr; Add Limit</strong>. Select <em>Social</em> &amp; <em>Games</em> and set a 1-minute limit during study hours.
                  </div>
                </div>
              </div>

              {/* Official Apple Documentation Links */}
              <div className="pt-2 space-y-1.5">
                <div>
                  <a
                    href="https://support.apple.com/HT212608"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    <span>Apple Support: Turn on or schedule a Focus on iPhone</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div>
                  <a
                    href="https://support.apple.com/HT208982"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    <span>Apple Support: Use Screen Time on your iPhone or iPad</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {platformTab === 'desktop' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Desktop / Laptop Distraction-Free Tips:
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    1
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">macOS:</strong> Open Control Center from the top menu bar &rarr; click <strong className="text-slate-900 dark:text-white">Focus</strong> &rarr; turn on <strong className="text-slate-900 dark:text-white">Do Not Disturb</strong> for 1 hour.
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    2
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">Windows 11:</strong> Click the Date &amp; Time notification tray in the bottom right &rarr; click <strong className="text-slate-900 dark:text-white">Focus</strong> to start a Windows focus session and silence desktop notifications.
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    3
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-900 dark:text-white">Install PrepPilot as PWA:</strong> Click the &quot;Install App&quot; button in the header so PrepPilot runs in its own dedicated distraction-free window without browser tab clutter.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
          >
            I&apos;m Ready to Focus
          </button>
        </div>
      </div>
    </div>
  );
};
