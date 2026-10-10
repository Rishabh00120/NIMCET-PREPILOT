import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X, Monitor, Smartphone, Check, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'button' | 'banner' | 'sidebar' }> = ({
  variant = 'button',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already installed, show small installed badge in sidebar if desired or hide
  if (isInstalled) {
    if (variant === 'sidebar') {
      return (
        <div className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          <span>PrepPilot App Active</span>
        </div>
      );
    }
    return null;
  }

  // Handle click on the install button
  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          onClick={handleInstallClick}
          className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2.5 text-xs font-semibold text-white shadow-xs hover:from-blue-500 hover:to-indigo-500 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 shrink-0" />
            <span>Install Desktop App</span>
          </div>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">PWA</span>
        </button>
      ) : (
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs transition-colors cursor-pointer"
          title="Install PrepPilot as a Desktop/Mobile App"
        >
          <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Install App</span>
        </button>
      )}

      {/* Cross-Platform Installation Guidance Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  <Download className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Install PrepPilot PWA
                </h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Install PrepPilot directly on your device for instant offline access, full-screen study cockpit, and daily streak reminders.
            </p>

            <div className="mt-4 space-y-3">
              {/* Chrome / Edge Desktop */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-950/50">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <Monitor className="h-4 w-4 text-blue-600" />
                  <span>Chrome / Edge Desktop</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                  Click the <strong>Install icon</strong> in your browser’s URL address bar (top right), or click <strong>Menu (⋮) &rarr; Save and share &rarr; Install PrepPilot</strong>.
                </p>
              </div>

              {/* iOS Safari */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-950/50">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <Smartphone className="h-4 w-4 text-indigo-600" />
                  <span>iPhone &amp; iPad (Safari)</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                  Tap the <strong>Share button</strong> <Share2 className="inline h-3 w-3 text-blue-600" /> in Safari’s bottom toolbar, scroll down, and tap <strong>Add to Home Screen</strong> <PlusSquare className="inline h-3 w-3 text-blue-600" />.
                </p>
              </div>

              {/* Android Chrome */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800/80 dark:bg-slate-950/50">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>Android (Chrome / Samsung Internet)</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                  Tap <strong>Menu (⋮)</strong> &rarr; <strong>Add to Home screen</strong> or <strong>Install app</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer shadow-xs"
            >
              Close Guidance
            </button>
          </div>
        </div>
      )}
    </>
  );
};
