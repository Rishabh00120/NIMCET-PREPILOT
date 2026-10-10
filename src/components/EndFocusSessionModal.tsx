import React from 'react';
import { AlertCircle, Clock, CheckCircle2, RotateCcw, X, Play } from 'lucide-react';

interface EndFocusSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  elapsedMinutes: number;
  totalPlannedMinutes: number;
  onLogAndEnd: () => void;
  onDiscardAndEnd: () => void;
  onResume: () => void;
}

export const EndFocusSessionModal: React.FC<EndFocusSessionModalProps> = ({
  isOpen,
  onClose,
  elapsedMinutes,
  totalPlannedMinutes,
  onLogAndEnd,
  onDiscardAndEnd,
  onResume,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              End Focus Session Early?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You are currently in an active focus interval.
            </p>
          </div>
        </div>

        {/* Elapsed Time Metric */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-950/50">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300">Elapsed Study Time:</span>
            <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {elapsedMinutes} of {totalPlannedMinutes} mins
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
            Would you like to credit this time to your verified syllabus hours, or discard it?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 space-y-2.5">
          <button
            onClick={() => {
              onLogAndEnd();
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Finish &amp; Log {Math.max(1, elapsedMinutes)} Minutes</span>
          </button>

          <button
            onClick={() => {
              onResume();
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <Play className="h-4 w-4 fill-white" />
            <span>Resume Focusing (Don&apos;t Stop)</span>
          </button>

          <button
            onClick={() => {
              onDiscardAndEnd();
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-2 text-xs font-semibold text-rose-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Discard Session (Reset Timer)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
