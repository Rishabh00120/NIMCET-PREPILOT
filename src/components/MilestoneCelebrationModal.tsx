import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Award, Sparkles, X, ChevronRight } from 'lucide-react';
import { Badge } from '../types';

interface MilestoneCelebrationModalProps {
  badge: Badge | null;
  onClose: () => void;
}

export const MilestoneCelebrationModal: React.FC<MilestoneCelebrationModalProps> = ({
  badge,
  onClose,
}) => {
  useEffect(() => {
    if (!badge) return;

    // Respect user's accessibility reduced-motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#2563EB', '#3B82F6', '#10B981', '#F59E0B'],
        });
      } catch (err) {
        // Safe fallback
      }
    }
  }, [badge]);

  if (!badge) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-sm rounded-2xl border border-blue-200 bg-white p-6 text-center shadow-2xl dark:border-blue-900 dark:bg-slate-900">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
          <Award className="h-8 w-8" />
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Milestone Unlocked!</span>
        </div>

        <h3 className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
          {badge.title}
        </h3>

        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          {badge.description}
        </p>

        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          <span>+{badge.xpReward} Preparation XP</span>
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            <span>Continue Preparation</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
