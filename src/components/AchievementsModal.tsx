import React, { useState } from 'react';
import {
  Trophy,
  Award,
  Sparkles,
  X,
  CheckCircle2,
  Lock,
  Flame,
  BookMarked,
  Calculator,
  Brain,
  Target,
  Flag,
  Zap,
} from 'lucide-react';
import { useApp, PREPARATION_LEVELS } from '../context/AppContext';
import { Badge } from '../types';

interface AchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({ isOpen, onClose }) => {
  const { userXP, preparationLevel, badges } = useApp();
  const [activeTab, setActiveTab] = useState<'all' | 'unlocked' | 'upcoming' | 'levels'>('all');

  if (!isOpen) return null;

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const upcomingBadges = badges.filter((b) => !b.unlocked);

  const displayedBadges =
    activeTab === 'unlocked'
      ? unlockedBadges
      : activeTab === 'upcoming'
      ? upcomingBadges
      : badges;

  const getBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'Flag':
        return <Flag className="h-5 w-5" />;
      case 'Award':
        return <Award className="h-5 w-5" />;
      case 'Flame':
        return <Flame className="h-5 w-5" />;
      case 'BookMarked':
        return <BookMarked className="h-5 w-5" />;
      case 'Trophy':
        return <Trophy className="h-5 w-5" />;
      case 'Target':
        return <Target className="h-5 w-5" />;
      case 'Calculator':
        return <Calculator className="h-5 w-5" />;
      case 'Brain':
        return <Brain className="h-5 w-5" />;
      default:
        return <Trophy className="h-5 w-5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white shadow-md">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Achievements & Preparation Milestones
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  Level {preparationLevel.level}: {preparationLevel.title}
                </span>
                <span>&bull;</span>
                <span className="font-mono">{userXP} XP Total</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-6 py-2.5 dark:border-slate-800 dark:bg-slate-950/40">
          <button
            onClick={() => setActiveTab('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            All Badges ({badges.length})
          </button>
          <button
            onClick={() => setActiveTab('unlocked')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'unlocked'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Unlocked ({unlockedBadges.length})
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Upcoming ({upcomingBadges.length})
          </button>
          <button
            onClick={() => setActiveTab('levels')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'levels'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Level Road
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'levels' ? (
            /* Levels Progression View */
            <div className="space-y-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-950 dark:bg-blue-950/30">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                  How You Earn Preparation XP:
                </span>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-blue-800 dark:text-blue-300 font-mono">
                  <div>&bull; Syllabus Topic: +60 XP</div>
                  <div>&bull; To-Do Task: +50 XP</div>
                  <div>&bull; PYQ Question: +2 XP</div>
                  <div>&bull; Study Minute: +1 XP</div>
                  <div>&bull; Mock Test: +120 XP</div>
                  <div>&bull; Badges: +60-300 XP</div>
                </div>
              </div>

              <div className="space-y-3">
                {PREPARATION_LEVELS.map((lvl) => {
                  const isCurrent = lvl.level === preparationLevel.level;
                  const isPast = userXP >= lvl.maxXP;
                  return (
                    <div
                      key={lvl.level}
                      className={`rounded-2xl border p-4 transition-all ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                          : isPast
                          ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-950 dark:bg-emerald-950/20'
                          : 'border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950/20 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${
                              isCurrent
                                ? 'bg-blue-600 text-white'
                                : isPast
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {lvl.level}
                          </span>
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {lvl.title}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                              Current Rank
                            </span>
                          )}
                        </div>

                        <span className="font-mono text-slate-500 text-[11px]">
                          {lvl.minXP} &ndash; {lvl.maxXP} XP
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Badges Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className={`flex items-start gap-3.5 rounded-2xl border p-4 transition-all ${
                    badge.unlocked
                      ? 'border-amber-200 bg-amber-50/40 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100 shadow-2xs'
                      : 'border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-950/30 opacity-60'
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${
                      badge.unlocked
                        ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 shadow-md shadow-amber-500/20'
                        : 'bg-slate-300 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {badge.unlocked ? getBadgeIcon(badge.icon) : <Lock className="h-5 w-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {badge.title}
                      </h4>
                      <span className="font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        +{badge.xpReward} XP
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {badge.description}
                    </p>

                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold">
                      {badge.unlocked ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Unlocked & Achieved
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Lock className="h-3 w-3" />
                          In Progress
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40 text-center">
          <p className="text-[11px] text-slate-400">
            All achievements are verified and recalculated automatically from your logged syllabus study and mock attempts.
          </p>
        </div>
      </div>
    </div>
  );
};
