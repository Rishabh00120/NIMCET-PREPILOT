import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Flame,
  Award,
  ArrowRight,
  TrendingUp,
  BookOpen,
  Play,
  Layers,
  Sparkles,
  Target,
  Trophy,
  Coffee,
  CheckSquare,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AchievementsModal } from '../components/AchievementsModal';

export const DashboardView: React.FC = () => {
  const {
    allTrackableTopics,
    totalTopicsCount,
    completedTopicsCount,
    inProgressTopicsCount,
    remainingTopicsCount,
    overdueTopicsCount,
    overallCompletionPercentage,
    weightedCompletionPercentage,
    subjectStats,
    studyHoursThisWeek,
    daysRemainingUntilExam,
    currentStudyStreak,
    nextScheduledSession,
    nextPlannedTest,
    encouragingMessage,
    continueStudying,
    setActiveSection,
    setSelectedTopicForModal,
    monthlyGoals,
    userXP,
    preparationLevel,
    badges,
    almostFinishedChapters,
    todaysTopTasks,
    recentWeekStudyHeatmap,
    toggleTaskCompletion,
    mockTests,
  } = useApp();

  const [showAchievementsModal, setShowAchievementsModal] = useState(false);

  // SVG circular gauge math
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallCompletionPercentage / 100) * circumference;

  // Level progress percentage
  const levelXPRange = preparationLevel.maxXP - preparationLevel.minXP;
  const currentLevelXP = Math.max(0, userXP - preparationLevel.minXP);
  const levelProgressPct = Math.min(100, Math.round((currentLevelXP / (levelXPRange || 1)) * 100));

  // Completed mock tests for chart
  const completedMocks = mockTests
    .filter((m) => m.completed)
    .sort((a, b) => (a.completedDate || '').localeCompare(b.completedDate || ''));

  // Weekly goal: target 56 hours per week (8 hrs/day * 7)
  const weeklyTargetHours = 56;
  const weeklyHoursPct = Math.min(100, Math.round((studyHoursThisWeek / weeklyTargetHours) * 100));

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Motivational Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-blue-900/40 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 sm:p-8 text-white shadow-lg">
        {/* Ambient background glow */}
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wider text-blue-300 uppercase">
              <button
                onClick={() => setShowAchievementsModal(true)}
                className="flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1 border border-blue-500/30 hover:bg-blue-500/30 transition-colors cursor-pointer"
                title="View Level Roadmap & Milestones"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                Level {preparationLevel.level}: {preparationLevel.title}
              </button>
              <span>&bull;</span>
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Flame className="h-4 w-4 fill-amber-400 animate-pulse" />
                {currentStudyStreak} Day Active Streak
              </span>
              <span>&bull;</span>
              <button
                onClick={() => setShowAchievementsModal(true)}
                className="text-slate-300 font-mono hover:text-white underline-offset-2 hover:underline cursor-pointer"
              >
                {userXP} XP Earned
              </button>
            </div>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              NIMCET 2027 &mdash; PrepPilot
            </h1>

            <p className="mt-2 text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-xl">
              {encouragingMessage}
            </p>

            {/* Level XP Progress Bar */}
            <div className="mt-4 max-w-md">
              <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium mb-1">
                <span>Next Tier Progress</span>
                <span className="font-mono">{userXP} / {preparationLevel.maxXP} XP ({levelProgressPct}%)</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800/80 overflow-hidden border border-slate-700/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-500"
                  style={{ width: `${levelProgressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={continueStudying}
              className="flex items-center gap-2 rounded-2xl bg-blue-500 hover:bg-blue-400 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-blue-500/25 transition-all active:scale-95"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>Continue Where You Left Off</span>
            </button>

            <button
              onClick={() => setActiveSection('focus')}
              className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-4 py-3 text-xs font-semibold text-slate-200 transition-all active:scale-95"
            >
              <Zap className="h-4 w-4 text-amber-400" />
              <span>Enter Focus Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Overall Syllabus</span>
            <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {overallCompletionPercentage}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono">
            {completedTopicsCount} / {totalTopicsCount} topics
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Hours This Week</span>
            <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {studyHoursThisWeek}h
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono">
            Goal: 56h / week
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Active Streak</span>
            <Flame className="h-4 w-4 fill-amber-500 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {currentStudyStreak} <span className="text-xs font-normal text-slate-500">days</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Starts 10 Oct 2026
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Overdue Targets</span>
            <AlertCircle className={`h-4 w-4 ${overdueTopicsCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <div className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${overdueTopicsCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
            {overdueTopicsCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {overdueTopicsCount > 0 ? 'Need catch-up slot' : 'All targets on schedule'}
          </div>
        </div>

        <div
          onClick={() => setShowAchievementsModal(true)}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
          title="Click to view all unlocked & upcoming badges"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Badges Unlocked</span>
            <Trophy className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {badges.filter((b) => b.unlocked).length} <span className="text-xs font-normal text-slate-500">/ {badges.length}</span>
          </div>
          <div className="mt-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
            View Milestones &rarr;
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Countdown</span>
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
            {daysRemainingUntilExam !== null ? `${daysRemainingUntilExam}d` : 'May 2027'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {daysRemainingUntilExam !== null ? 'Configured date' : 'Official date pending'}
          </div>
        </div>
      </div>

      {/* 3. Circular Progress Ring & Four Subject Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Prominent Circular Gauge */}
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Overall Syllabus Completion
          </span>

          <div className="relative mt-6 flex items-center justify-center">
            <svg className="h-44 w-44 -rotate-90 transform" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-slate-100 dark:stroke-slate-800"
                strokeWidth="12"
                fill="transparent"
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-blue-600 transition-all duration-700 ease-out"
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                {overallCompletionPercentage}%
              </span>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                {completedTopicsCount} / {totalTopicsCount} Topics
              </span>
            </div>
          </div>

          <div className="mt-6 grid w-full grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-center dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-400">Exam Weighted</span>
              <div className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {weightedCompletionPercentage}%
              </div>
            </div>
            <div>
              <span className="text-slate-400">Remaining</span>
              <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {remainingTopicsCount} topics
              </div>
            </div>
          </div>
        </div>

        {/* Right: Four Subject Cards */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Core Subjects Performance (120 Questions Scale)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detailed topic completion metrics categorized by NIMCET mark weights
              </p>
            </div>

            <button
              onClick={() => setActiveSection('syllabus')}
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-1"
            >
              <span>View All 90 Topics</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            {/* Mathematics */}
            {subjectStats['maths'] && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-slate-900 dark:text-white">Mathematics</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold tabular-nums">
                    {subjectStats['maths'].percentage}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${subjectStats['maths'].percentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>50 Questions &bull; 600 Marks</span>
                  <span>{subjectStats['maths'].completedTopics}/{subjectStats['maths'].totalTopics} done</span>
                </div>
              </div>
            )}

            {/* Reasoning */}
            {subjectStats['reasoning'] && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-slate-900 dark:text-white">Reasoning &amp; Logic</span>
                  <span className="font-mono text-teal-600 dark:text-teal-400 font-bold tabular-nums">
                    {subjectStats['reasoning'].percentage}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-teal-600 transition-all duration-300"
                    style={{ width: `${subjectStats['reasoning'].percentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>40 Questions &bull; 240 Marks</span>
                  <span>{subjectStats['reasoning'].completedTopics}/{subjectStats['reasoning'].totalTopics} done</span>
                </div>
              </div>
            )}

            {/* Computer Awareness */}
            {subjectStats['computer'] && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-slate-900 dark:text-white">Computer Awareness</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400 font-bold tabular-nums">
                    {subjectStats['computer'].percentage}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-purple-600 transition-all duration-300"
                    style={{ width: `${subjectStats['computer'].percentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>20 Questions &bull; 120 Marks</span>
                  <span>{subjectStats['computer'].completedTopics}/{subjectStats['computer'].totalTopics} done</span>
                </div>
              </div>
            )}

            {/* General English */}
            {subjectStats['english'] && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-slate-900 dark:text-white">General English</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-bold tabular-nums">
                    {subjectStats['english'].percentage}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${subjectStats['english'].percentage}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>10 Questions &bull; 40 Marks</span>
                  <span>{subjectStats['english'].completedTopics}/{subjectStats['english'].totalTopics} done</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. "Today's Mission" Panel & "You Are Almost There" Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Mission Panel */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Today&apos;s Mission &bull; Top 3 Priorities
                </h3>
              </div>
              <button
                onClick={() => setActiveSection('tasks')}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                All tasks
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {todaysTopTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-1" />
                  All top tasks completed for today! Check To-Do list for more.
                </div>
              ) : (
                todaysTopTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 transition-colors hover:bg-slate-100/70 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <input
                      type="checkbox"
                      checked={task.status === 'completed'}
                      onChange={() => toggleTaskCompletion(task.id)}
                      className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {task.title}
                      </h4>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="capitalize">{task.taskType}</span>
                        <span>&bull;</span>
                        <span className="font-mono">Due {task.deadline}</span>
                        <span>&bull;</span>
                        <span className="capitalize">{task.priority} Priority</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Weekly Hours Pace: <strong>{studyHoursThisWeek} / {weeklyTargetHours}h ({weeklyHoursPct}%)</strong></span>
            <button
              onClick={() => setActiveSection('tasks')}
              className="text-blue-600 hover:underline font-semibold"
            >
              Add Task &rarr;
            </button>
          </div>
        </div>

        {/* You Are Almost There Panel */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  You Are Almost There!
                </h3>
              </div>
              <button
                onClick={() => setActiveSection('syllabus')}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                Syllabus tree
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              These chapters are close to 100% mastery. Finish the remaining topics to unlock chapter achievements!
            </p>

            <div className="mt-3 space-y-3">
              {almostFinishedChapters.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 dark:border-slate-800">
                  Chapters with &gt;= 50% completion will appear here as your foundation phase progresses.
                </div>
              ) : (
                almostFinishedChapters.map((chap) => (
                  <div
                    key={chap.chapterId}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-bold text-slate-900 dark:text-white truncate max-w-xs">
                        {chap.chapterTitle}
                      </span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
                        {chap.percentage}%
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${chap.percentage}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{chap.subjectName}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {chap.remainingTopics} more topic{chap.remainingTopics > 1 ? 's' : ''} to finish
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Primary study window: <strong>14:00&ndash;21:00</strong></span>
            <button
              onClick={() => setActiveSection('timetable')}
              className="text-blue-600 hover:underline font-semibold"
            >
              Open Timetable &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* 5. Weekly Consistency Heatmap & Mock Test Trajectory */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Weekly Consistency Heatmap */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Weekly Consistency Heatmap
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {currentStudyStreak} days continuous streak
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Activity logged across the past 7 days based on verified study sessions:
          </p>

          <div className="mt-4 grid grid-cols-7 gap-2">
            {recentWeekStudyHeatmap.map((day) => (
              <div
                key={day.date}
                className={`rounded-2xl border p-3 text-center transition-all ${
                  day.studied
                    ? 'border-blue-300 bg-blue-50/70 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200'
                    : 'border-slate-200 bg-slate-50/50 text-slate-400 dark:border-slate-800 dark:bg-slate-950/20'
                }`}
              >
                <div className="text-[11px] font-bold">{day.dayName}</div>
                <div className="font-mono text-[10px] mt-0.5">{day.date.slice(5)}</div>
                <div className={`mt-2 font-mono text-xs font-bold tabular-nums ${day.studied ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                  {day.minutes > 0 ? `${Math.round(day.minutes / 60 * 10) / 10}h` : '0h'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compact Mock Test Score Performance Chart */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Mock Test Performance Trajectory
                </h3>
              </div>
              <button
                onClick={() => setActiveSection('mocks')}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                Full Test Series
              </button>
            </div>

            <div className="mt-3">
              {completedMocks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 dark:border-slate-800">
                  <Award className="mx-auto h-8 w-8 text-slate-300 mb-1" />
                  No completed mock scores recorded yet. Your scores and accuracy curve will plot here once you take chapter tests or sectional mocks!
                </div>
              ) : (
                <div className="space-y-3">
                  {completedMocks.slice(-4).map((test) => {
                    const pct = Math.round((test.score / (test.maxMarks || 1)) * 100);
                    return (
                      <div
                        key={test.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/40 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {test.testName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {test.completedDate} &bull; {test.provider}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-bold text-purple-600 dark:text-purple-400">
                            {test.score} / {test.maxMarks} ({pct}%)
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {test.correctCount}C &bull; {test.incorrectCount}I
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Next Planned Test: <strong>{nextPlannedTest ? nextPlannedTest.testName : 'None scheduled'}</strong></span>
            <button
              onClick={() => setActiveSection('mocks')}
              className="text-blue-600 hover:underline font-semibold"
            >
              Log Score &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* 6. Preparation Journey Timeline (October 2026 – May 2027) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800 gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Preparation Journey Timeline &bull; October 2026 &mdash; May 2027
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Phased monthly milestones that dynamically update with your actual completion rate
            </p>
          </div>

          <button
            onClick={() => setActiveSection('roadmap')}
            className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Roadmap &amp; Goal Targets</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {monthlyGoals.map((m, idx) => {
            const isOct = m.monthKey === '2026-10';
            const mTopics = allTrackableTopics.filter((t) => t.assignedMonth === m.monthKey);
            const mComp = mTopics.filter((t) => t.completed).length;
            const mTotal = mTopics.length;
            const mPct = mTotal > 0 ? Math.round((mComp / mTotal) * 100) : 0;

            return (
              <div
                key={m.monthKey}
                onClick={() => setActiveSection('roadmap')}
                className={`cursor-pointer rounded-2xl border p-3.5 text-center transition-all hover:scale-[1.02] ${
                  m.isReviewed || (mTotal > 0 && mComp === mTotal)
                    ? 'border-emerald-300 bg-emerald-50/40 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300'
                    : isOct
                    ? 'border-blue-400 bg-blue-50/60 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200'
                    : 'border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                <div className="text-[10px] font-mono text-slate-400">
                  Step {idx + 1}
                </div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {m.name.split(' ')[0]}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {m.name.split(' ')[1]}
                </div>

                <div className="mt-3">
                  <div className="font-mono text-xs font-bold tabular-nums">
                    {mTotal > 0 ? `${mPct}%` : 'Revision'}
                  </div>
                  {mTotal > 0 && (
                    <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mt-1">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${mPct}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                  {m.targetHours}h study
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. Achievements & Badges Showcase Strip */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Preparation Badges &amp; Milestone Achievements
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-500">
              Level {preparationLevel.level} &bull; {userXP} XP
            </span>
            <button
              onClick={() => setShowAchievementsModal(true)}
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
            >
              View All Milestones &rarr;
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
          {badges.map((b) => (
            <div
              key={b.id}
              onClick={() => setShowAchievementsModal(true)}
              className={`cursor-pointer rounded-2xl border p-3 text-center transition-all hover:scale-105 ${
                b.unlocked
                  ? 'border-amber-200 bg-amber-50/50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200'
                  : 'border-slate-200 bg-slate-50/40 opacity-40 grayscale dark:border-slate-800 dark:bg-slate-950/30'
              }`}
              title={`${b.title}: ${b.description}`}
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white shadow-xs">
                <Trophy className="h-5 w-5" />
              </div>

              <div className="mt-2 text-[11px] font-bold truncate">
                {b.title}
              </div>

              <div className="mt-1 font-mono text-[10px] text-slate-500">
                +{b.xpReward} XP
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements & Milestones Details Modal */}
      <AchievementsModal
        isOpen={showAchievementsModal}
        onClose={() => setShowAchievementsModal(false)}
      />
    </div>
  );
};
