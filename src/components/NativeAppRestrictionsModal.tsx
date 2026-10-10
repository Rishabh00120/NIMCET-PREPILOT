import React from 'react';
import { X, ShieldAlert, ShieldCheck, Lock, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';

interface NativeAppRestrictionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NativeAppRestrictionsModal: React.FC<NativeAppRestrictionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                How App Restrictions Work
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Understanding PWA sandbox limitations vs. Native Android enforcement
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* Honest technical explanation */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <strong className="text-xs">Why Websites &amp; PWAs Cannot Block Other Apps:</strong>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-900 dark:text-amber-300">
                  Web browsers intentionally isolate websites and PWAs inside a strict security sandbox. A web app cannot access the operating system&apos;s process list, detect which other apps you have opened, or prevent another application from launching. This is a core web privacy principle.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <strong className="text-xs">How the Native Android App Implements Real App Blocking:</strong>
                <p className="mt-1 text-[11px] leading-relaxed text-emerald-900 dark:text-emerald-300">
                  A compiled Android APK can request specialized system permissions with user authorization:
                </p>
                <ul className="mt-2 space-y-1.5 text-[11px] list-disc list-inside text-emerald-800 dark:text-emerald-300">
                  <li><strong>Usage Stats Access:</strong> Detects foreground application transitions.</li>
                  <li><strong>Overlay &amp; Accessibility Services:</strong> Intercepts attempts to open blacklisted apps (e.g. social media, games) during active study timers and redirects you back to PrepPilot.</li>
                  <li><strong>Hard Lock / Exam Mode:</strong> Optional strict mode designed specifically for 2-hour full NIMCET mock simulations.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <h4 className="font-bold text-slate-900 dark:text-white mb-1.5">
              Current Best Practice with this PWA:
            </h4>
            <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
              While the native Android APK is in production, activate your phone’s built-in <strong className="text-slate-900 dark:text-white">Digital Wellbeing Focus Mode</strong> (on Android) or <strong className="text-slate-900 dark:text-white">Screen Time / Apple Focus</strong> (on iOS). This gives you genuine operating system-level app restrictions right now without installing third-party root tools.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white px-5 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
