import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Coffee,
  Sparkles,
  BookOpen,
  CheckSquare,
  Award,
  Zap,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Lock,
  ExternalLink,
  Info,
  Clock,
  Flame,
  ChevronRight,
  Sliders,
  BatteryMedium,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWakeLock } from '../hooks/useWakeLock';
import { useDevicePlatform, DevicePlatform } from '../hooks/useDevicePlatform';
import { useStudySpaceChecklist } from '../hooks/useStudySpaceChecklist';
import { PhoneFocusGuidanceModal } from '../components/PhoneFocusGuidanceModal';
import { NativeAppRestrictionsModal } from '../components/NativeAppRestrictionsModal';
import { EndFocusSessionModal } from '../components/EndFocusSessionModal';
import { getRandomFocusQuote, FocusQuote } from '../data/focusQuotes';

export const FocusModeView: React.FC = () => {
  const {
    focusSession,
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    resetFocusSession,
    completeFocusSession,
    switchFocusMode,
    updateFocusTopicOrTask,
    allTrackableTopics,
    tasks,
    userXP,
    preparationLevel,
    studyHoursThisWeek,
    currentStudyStreak,
  } = useApp();

  // Screen Wake Lock Hook
  const {
    isSupported: isWakeLockSupported,
    isActive: isWakeLockActive,
    error: wakeLockError,
    toggleWakeLock,
    releaseWakeLock,
  } = useWakeLock();

  // Device & Platform Detection Hook
  const { detectedPlatform, selectedPlatform, setSelectedPlatform, isMobile } =
    useDevicePlatform();

  // Study Space Checklist Hook
  const {
    items: checklistItems,
    toggleItem: toggleChecklistItem,
    isCompleted: isChecklistItemCompleted,
    completedCount: checklistCompletedCount,
    totalCount: checklistTotalCount,
  } = useStudySpaceChecklist();

  // Modals state
  const [showGuidanceModal, setShowGuidanceModal] = useState<boolean>(false);
  const [showRestrictionsModal, setShowRestrictionsModal] = useState<boolean>(false);
  const [showEndConfirmModal, setShowEndConfirmModal] = useState<boolean>(false);

  // Focus Quote state
  const [currentQuote, setCurrentQuote] = useState<FocusQuote>(getRandomFocusQuote());

  // Duration settings state
  const [selectedDurationMins, setSelectedDurationMins] = useState<number>(25);
  const [customDurationInput, setCustomDurationInput] = useState<string>('30');
  const [showCustomDurationInput, setShowCustomDurationInput] = useState<boolean>(false);

  // Daily target sessions: standard recommendation is 4 sessions (approx 2 hours of deep work)
  const dailyTargetSessions = 4;

  // Format time mm:ss
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const progressPercent =
    focusSession.durationSeconds > 0
      ? Math.round(
          ((focusSession.durationSeconds - focusSession.remainingSeconds) /
            focusSession.durationSeconds) *
            100
        )
      : 0;

  const elapsedMinutes = Math.round(
    (focusSession.durationSeconds - focusSession.remainingSeconds) / 60
  );
  const totalPlannedMinutes = Math.round(focusSession.durationSeconds / 60);

  // Selected topic / task info
  const activeTopic = allTrackableTopics.find((t) => t.id === focusSession.selectedTopicId);
  const activeTask = tasks.find((t) => t.id === focusSession.selectedTaskId);

  // SVG Circular math
  const radius = 96;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // Enforce Screen Wake Lock lifecycle: Release lock when session finishes, is reset, or becomes inactive
  useEffect(() => {
    if (!focusSession.isActive) {
      releaseWakeLock();
    }
  }, [focusSession.isActive, releaseWakeLock]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // Rotate quote on session completion
  const handleSessionCompletion = () => {
    releaseWakeLock();
    // Confetti celebration (respecting prefers-reduced-motion)
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#2563EB', '#10B981', '#F59E0B', '#6366F1'],
        });
      } catch {
        // Fallback
      }
    }

    completeFocusSession();
    setCurrentQuote(getRandomFocusQuote());
  };

  // Safe end early handler
  const handleRequestResetOrEnd = () => {
    if (focusSession.isActive && focusSession.remainingSeconds > 0) {
      // Pause while confirmation is open
      pauseFocusSession();
      setShowEndConfirmModal(true);
    } else {
      releaseWakeLock();
      resetFocusSession();
    }
  };

  const handleDiscardAndReset = () => {
    releaseWakeLock();
    resetFocusSession();
  };

  // Android APK configuration variable check
  const androidAppUrl = (import.meta.env.VITE_ANDROID_APP_URL as string) || '';
  const isAndroidUrlValid =
    Boolean(androidAppUrl) && androidAppUrl.trim().startsWith('https://');

  return (
    <div className="space-y-8 pb-16 max-w-4xl mx-auto">
      {/* 1. Header Bar with Real-Data Study Stats */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-5">
        <div>
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            <Sparkles className="h-4 w-4" />
            <span>Deep Work &bull; Pomodoro Cockpit</span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Focus Mode &amp; Study Chamber
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
            Eliminate phone distractions. Work in uninterrupted intervals and log verified study time directly to your NIMCET syllabus.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5">
          {/* Today's Focus Sessions */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center dark:border-slate-800 dark:bg-slate-950">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Today&apos;s Target
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {focusSession.sessionsCompletedToday} / {dailyTargetSessions} done
            </div>
          </div>

          {/* Weekly Hours */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-center dark:border-slate-800 dark:bg-slate-950">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              This Week
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {studyHoursThisWeek}h logged
            </div>
          </div>

          {/* Level & XP */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-center dark:border-blue-900 dark:bg-blue-950/40">
            <span className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider">
              {preparationLevel.title}
            </span>
            <div className="text-sm font-bold text-blue-700 dark:text-blue-300 font-mono tabular-nums">
              {userXP} XP
            </div>
          </div>
        </div>
      </div>

      {/* Encouraging Quote Banner */}
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50/60 p-4 text-xs dark:border-blue-950 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-slate-950/20">
        <div className="flex items-start gap-2.5">
          <Zap className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <div className="flex-1">
            <p className="italic text-slate-700 dark:text-slate-300">
              &ldquo;{currentQuote.quote}&rdquo;
            </p>
            <span className="mt-1 block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              &mdash; {currentQuote.author}
            </span>
          </div>
          <button
            onClick={() => setCurrentQuote(getRandomFocusQuote())}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer shrink-0"
          >
            New Quote
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION A: STUDY FOCUS (POMODORO TIMER COCKPIT) */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Mode Switcher Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-6">
          <button
            onClick={() => switchFocusMode('focus', selectedDurationMins)}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              focusSession.mode === 'focus'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>
              Focus Session (
              {focusSession.mode === 'focus'
                ? Math.round(focusSession.durationSeconds / 60)
                : selectedDurationMins}
              m)
            </span>
          </button>

          <button
            onClick={() => switchFocusMode('break', 5)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              focusSession.mode === 'break' && focusSession.durationSeconds === 5 * 60
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Coffee className="h-3.5 w-3.5" />
            <span>Short Break (5m)</span>
          </button>

          <button
            onClick={() => switchFocusMode('break', 15)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              focusSession.mode === 'break' && focusSession.durationSeconds === 15 * 60
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Coffee className="h-3.5 w-3.5" />
            <span>Long Break (15m)</span>
          </button>
        </div>

        {/* Short / Long Break Motivational Guidance Banner */}
        {focusSession.mode === 'break' && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 max-w-lg w-full text-left">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs">
              <Coffee className="h-5 w-5" />
            </div>
            <div className="flex-1 text-xs">
              <div className="font-bold">Break Time &bull; Rest &amp; Recharge</div>
              <p className="mt-0.5 text-emerald-800 dark:text-emerald-300 text-[11px] leading-relaxed">
                Great effort! Step away from your desk, stretch, hydrate with water, or rest your eyes before the next problem-solving interval.
              </p>
            </div>
          </div>
        )}

        {/* Animated Circular Countdown & Progress Ring */}
        <div className="relative flex items-center justify-center my-3">
          <svg className="h-64 w-64 -rotate-90 transform" viewBox="0 0 240 240">
            <circle
              cx="120"
              cy="120"
              r={radius}
              className="stroke-slate-100 dark:stroke-slate-800"
              strokeWidth="12"
              fill="transparent"
            />
            <circle
              cx="120"
              cy="120"
              r={radius}
              className={`transition-all duration-300 ease-out ${
                focusSession.mode === 'focus' ? 'stroke-blue-600' : 'stroke-emerald-500'
              }`}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="font-mono text-5xl font-black tracking-tight text-slate-900 dark:text-white tabular-nums">
              {formatTime(focusSession.remainingSeconds)}
            </span>
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  focusSession.isPaused
                    ? 'bg-amber-400'
                    : focusSession.isActive
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {focusSession.isPaused
                  ? 'Paused'
                  : focusSession.isActive
                  ? focusSession.mode === 'focus'
                    ? 'Focusing...'
                    : 'Resting...'
                  : 'Ready to Start'}
              </span>
            </div>
          </div>
        </div>

        {/* Selected Task / Topic Pill */}
        <div className="mt-3 max-w-md text-center">
          {activeTopic ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
              <span className="font-bold uppercase tracking-wider text-[10px] bg-blue-600 text-white rounded px-1.5 py-0.5">
                {activeTopic.subjectId}
              </span>
              <span className="truncate max-w-xs font-semibold">{activeTopic.title}</span>
            </div>
          ) : activeTask ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              <span className="font-bold uppercase tracking-wider text-[10px] bg-slate-700 text-white rounded px-1.5 py-0.5">
                {activeTask.taskType}
              </span>
              <span className="truncate max-w-xs font-semibold">{activeTask.title}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">
              No topic selected &bull; Focus time will be recorded to general study hours
            </span>
          )}
        </div>

        {/* Primary Timer Controls */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {!focusSession.isActive || focusSession.isPaused ? (
            <button
              onClick={() => {
                if (focusSession.isActive) {
                  resumeFocusSession();
                } else {
                  startFocusSession(
                    focusSession.selectedTopicId,
                    focusSession.selectedTaskId,
                    selectedDurationMins
                  );
                }
              }}
              className="flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 px-7 py-3 text-sm font-bold text-white shadow-md active:scale-95 transition-all cursor-pointer min-h-[44px]"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>{focusSession.isActive ? 'Resume Session' : 'Start Focus'}</span>
            </button>
          ) : (
            <button
              onClick={pauseFocusSession}
              className="flex items-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white px-7 py-3 text-sm font-bold text-white shadow-md active:scale-95 transition-all cursor-pointer min-h-[44px]"
            >
              <Pause className="h-4 w-4 fill-current" />
              <span>Pause</span>
            </button>
          )}

          {/* Reset / End early with confirmation */}
          <button
            onClick={handleRequestResetOrEnd}
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer min-h-[44px]"
            title={focusSession.isActive ? 'End session early' : 'Reset timer'}
          >
            <RotateCcw className="h-4 w-4 text-slate-500" />
            <span>{focusSession.isActive ? 'End Early...' : 'Reset'}</span>
          </button>

          {/* Direct Session Complete */}
          {focusSession.isActive && (
            <button
              onClick={handleSessionCompletion}
              className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-xs font-bold text-white shadow-md active:scale-95 transition-all cursor-pointer min-h-[44px]"
              title="Log completed study hours now"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Finish &amp; Log Hours</span>
            </button>
          )}
        </div>

        {/* Preset Durations: 25, 45, 60, 90 mins & Custom Picker */}
        {!focusSession.isActive && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Session Presets:</span>
            {[25, 45, 60, 90].map((mins) => (
              <button
                key={mins}
                onClick={() => {
                  setSelectedDurationMins(mins);
                  setShowCustomDurationInput(false);
                  switchFocusMode('focus', mins);
                }}
                className={`rounded-xl px-3 py-1.5 font-mono font-semibold transition-colors cursor-pointer ${
                  selectedDurationMins === mins && !showCustomDurationInput
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {mins}m
              </button>
            ))}

            <button
              onClick={() => setShowCustomDurationInput(!showCustomDurationInput)}
              className={`flex items-center gap-1 rounded-xl px-3 py-1.5 font-semibold transition-colors cursor-pointer ${
                showCustomDurationInput
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Sliders className="h-3 w-3" />
              <span>Custom</span>
            </button>
          </div>
        )}

        {/* Custom Duration Input Box */}
        {!focusSession.isActive && showCustomDurationInput && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50/60 p-2 text-xs dark:border-blue-900 dark:bg-blue-950/40">
            <span className="text-slate-600 dark:text-slate-300">Set minutes (1–180):</span>
            <input
              type="number"
              min="1"
              max="180"
              value={customDurationInput}
              onChange={(e) => setCustomDurationInput(e.target.value)}
              className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              onClick={() => {
                const parsed = parseInt(customDurationInput, 10);
                if (!isNaN(parsed) && parsed > 0 && parsed <= 180) {
                  setSelectedDurationMins(parsed);
                  switchFocusMode('focus', parsed);
                }
              }}
              className="rounded-lg bg-blue-600 px-3 py-1 font-bold text-white hover:bg-blue-500 cursor-pointer"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Target Chapter or Task Linking Box */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
          Link Syllabus Chapter or To-Do Task
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Linking a topic automatically adds actual study minutes to your syllabus progress upon completion.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Link to Syllabus Topic
            </label>
            <select
              value={focusSession.selectedTopicId || ''}
              onChange={(e) => updateFocusTopicOrTask(e.target.value || undefined, undefined)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">-- None (General Practice) --</option>
              {allTrackableTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  [{topic.subjectId.toUpperCase()}] {topic.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Or Link to Pending To-Do Task
            </label>
            <select
              value={focusSession.selectedTaskId || ''}
              onChange={(e) => updateFocusTopicOrTask(undefined, e.target.value || undefined)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">-- None --</option>
              {tasks.filter((t) => t.status === 'pending').map((task) => (
                <option key={task.id} value={task.id}>
                  [{task.taskType}] {task.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION B: REDUCE PHONE DISTRACTIONS (DISTRACTION-FREE ENVIRONMENT) */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Create a Distraction-Free Environment
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Set up your phone operating system and study desk to block interruptions during this session.
            </p>
          </div>

          {/* Manual Platform Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs self-start sm:self-auto">
            <span className="text-[11px] text-slate-400 px-2 font-medium">Device Guide:</span>
            <button
              onClick={() => setSelectedPlatform('android')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                selectedPlatform === 'android'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Android
            </button>
            <button
              onClick={() => setSelectedPlatform('ios')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                selectedPlatform === 'ios'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              iPhone / iPad
            </button>
            <button
              onClick={() => setSelectedPlatform('desktop')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                selectedPlatform === 'desktop'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Desktop
            </button>
          </div>
        </div>

        {/* 1. Phone OS Focus Mode Setup Card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  1. Enable Your Phone&apos;s Focus Mode (
                  {selectedPlatform === 'android'
                    ? 'Android Digital Wellbeing'
                    : selectedPlatform === 'ios'
                    ? 'Apple Focus & Screen Time'
                    : 'Do Not Disturb'}
                  )
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedPlatform === 'android'
                  ? 'Android’s Digital Wellbeing Focus Mode allows you to temporarily pause distracting apps (Instagram, YouTube, WhatsApp) and silence their notifications while you study.'
                  : selectedPlatform === 'ios'
                  ? 'Apple’s Focus & Screen Time settings let you silence non-essential notifications and enforce app limits on distracting social and entertainment apps.'
                  : 'Silence desktop notifications and browser popups so problem-solving steps remain undisturbed.'}
              </p>
            </div>

            <button
              onClick={() => setShowGuidanceModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <span>View Step-by-Step Guide</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Keep Screen Awake (Screen Wake Lock API) Card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <BatteryMedium className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  2. Keep Screen Awake During Study Session
                </h3>
                {isWakeLockActive ? (
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Active
                  </span>
                ) : isWakeLockSupported ? (
                  <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Inactive
                  </span>
                ) : (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Unsupported
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Prevents your phone or laptop screen from turning off while this Pomodoro session is running. Consumes more battery while active; the wake lock is automatically released when your session ends or tab is minimized.
              </p>

              {!isWakeLockSupported && (
                <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                  Screen Wake Lock API is not supported on this browser version. You can temporarily adjust your phone’s screen timeout to 30 mins in your OS Display Settings.
                </div>
              )}

              {wakeLockError && (
                <div className="mt-2 text-[11px] text-rose-600 dark:text-rose-400">
                  {wakeLockError}
                </div>
              )}
            </div>

            {isWakeLockSupported && (
              <button
                onClick={toggleWakeLock}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  isWakeLockActive
                    ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-500'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs'
                }`}
              >
                <span>{isWakeLockActive ? 'Screen Lock Active' : 'Keep Screen Awake'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 & 4. Minimise Interruptions & Prepare Study Space Checklist */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-2 dark:border-slate-800">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                3 &amp; 4. Prepare Your Study Space &amp; Routine Checklist
              </h3>
              <p className="text-[11px] text-slate-500">
                Optional pre-session habits ({checklistCompletedCount} of {checklistTotalCount} checked)
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
              {Math.round((checklistCompletedCount / (checklistTotalCount || 1)) * 100)}%
            </span>
          </div>

          <div className="space-y-2.5">
            {checklistItems.map((item) => {
              const checked = isChecklistItemCompleted(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleChecklistItem(item.id)}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                    checked
                      ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-950 dark:bg-emerald-950/20'
                      : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border ${
                      checked
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-transparent'
                    }`}
                  >
                    {checked && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-xs font-semibold ${
                        checked
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.label}
                    </span>
                    {item.tip && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.tip}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION C: NATIVE APP RESTRICTIONS CARD */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-[11px] font-bold text-indigo-300 border border-indigo-500/30 uppercase tracking-wider mb-2">
              <Lock className="h-3.5 w-3.5 text-indigo-400" />
              <span>Native Enforcement</span>
            </div>

            <h2 className="text-xl font-black text-white sm:text-2xl tracking-tight">
              Need Stronger App Restrictions?
            </h2>

            <p className="mt-1 text-xs text-indigo-200 font-medium leading-relaxed">
              PrepPilot Focus Mode helps you study. The native Android app is designed to support additional phone-level focus features where permitted.
            </p>

            <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">
              Because websites and installed PWAs are strictly sandboxed for your security, they cannot detect or lock other applications. For device-level hard enforcement (e.g., blocking social media during 2-hour full mocks), the native PrepPilot Android APK communicates directly with Android’s system APIs.
            </p>

            {/* Non-misleading status indicator */}
            <div className="mt-4 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs text-amber-300 font-medium">
                {isAndroidUrlValid
                  ? 'Official Android APK Build Available'
                  : 'Native Android app setup in progress • Testing NIMCET Mock Lock'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 shrink-0">
            {isAndroidUrlValid ? (
              <a
                href={androidAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl bg-blue-500 hover:bg-blue-400 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95"
              >
                <span>Explore PrepPilot for Android</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <div className="flex flex-col gap-1.5">
                <button
                  disabled
                  className="flex items-center justify-center gap-2 rounded-2xl border border-indigo-500/40 bg-indigo-950/60 px-6 py-3 text-xs font-bold text-indigo-200 opacity-90 cursor-not-allowed"
                >
                  <span>Explore PrepPilot for Android</span>
                </button>
                <span className="text-[10px] text-indigo-300/80 text-center">
                  Official APK release in progress
                </span>
              </div>
            )}

            <button
              onClick={() => setShowRestrictionsModal(true)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            >
              <Info className="h-3.5 w-3.5 text-indigo-400" />
              <span>How App Restrictions Work</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Modals */}
      <PhoneFocusGuidanceModal
        isOpen={showGuidanceModal}
        onClose={() => setShowGuidanceModal(false)}
        defaultPlatform={selectedPlatform}
      />

      <NativeAppRestrictionsModal
        isOpen={showRestrictionsModal}
        onClose={() => setShowRestrictionsModal(false)}
      />

      <EndFocusSessionModal
        isOpen={showEndConfirmModal}
        onClose={() => setShowEndConfirmModal(false)}
        elapsedMinutes={elapsedMinutes}
        totalPlannedMinutes={totalPlannedMinutes}
        onLogAndEnd={handleSessionCompletion}
        onDiscardAndEnd={handleDiscardAndReset}
        onResume={resumeFocusSession}
      />
    </div>
  );
};
