import React from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const PWAUpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates periodically (e.g. every hour)
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('SW registration error:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-blue-500/40 bg-slate-900 p-4 text-white shadow-2xl backdrop-blur-md animate-fade-in dark:border-blue-400/30">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/40">
          <Sparkles className="h-5 w-5 animate-pulse" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>Update Available</span>
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-300 font-mono">
              vNew
            </span>
          </h4>
          <p className="mt-1 text-[11px] text-slate-300 leading-relaxed">
            A new version of PrepPilot is ready with latest syllabus tracking updates. Refresh to load the latest version.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => updateServiceWorker(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Update Now</span>
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>

        <button
          onClick={() => setNeedRefresh(false)}
          className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
