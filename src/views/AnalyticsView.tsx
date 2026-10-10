import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Award,
  Calendar,
  Sparkles,
  ArrowRight,
  BookOpen,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AnalyticsView: React.FC = () => {
  const {
    allTrackableTopics,
    subjects,
    subjectStats,
    overallCompletionPercentage,
    weightedCompletionPercentage,
    studySessions,
    mockTests,
    errorLogs,
    tasks,
    monthlyGoals,
    setSelectedTopicForModal,
    setActiveSection,
    todayDate,
  } = useApp();

  const [filterSubject, setFilterSubject] = useState<string>('all');

  // Total study hours
  const totalLoggedMinutes = studySessions.reduce((sum, s) => sum + (s.actualMinutes || 0), 0);
  const totalLoggedHours = Math.round((totalLoggedMinutes / 60) * 10) / 10;

  // Overdue topics
  const overdueTopics = allTrackableTopics.filter((t) => !t.completed && t.targetCompletionDate < todayDate);

  // Completed mock tests
  const completedMocks = mockTests.filter((m) => m.completed);
  const avgMockScorePct = completedMocks.length > 0
    ? Math.round(
        completedMocks.reduce((sum, m) => sum + (m.score / (m.maxMarks || 1)) * 100, 0) /
          completedMocks.length
      )
    : 0;

  // Mistake distribution by category
  const mistakesByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    errorLogs.forEach((err) => {
      counts[err.mistakeCategory] = (counts[err.mistakeCategory] || 0) + 1;
    });
    return counts;
  }, [errorLogs]);

  // Actionable catch-up suggestions
  interface CatchUpItem {
    title: string;
    desc: string;
    action: string;
    actionLabel: string;
    raw?: any;
  }

  const catchUpSuggestions: CatchUpItem[] = useMemo(() => {
    if (overdueTopics.length === 0) {
      return [
        {
          title: 'Ahead of Foundation Pace',
          desc: 'You have no overdue topics! Consider solving additional PYQ problems or taking an early topic quiz.',
          action: 'pyq',
          actionLabel: 'Go to PYQ Practice',
        },
      ];
    }
    return overdueTopics.slice(0, 3).map((topic) => ({
      title: `Overdue Catch-up: ${topic.title}`,
      desc: `Planned for ${topic.targetCompletionDate}. Needs approx ${topic.estimatedHours}h in tomorrow’s 14:00–15:30 slot.`,
      action: 'syllabus',
      actionLabel: 'Open in Syllabus',
      raw: topic,
    }));
  }, [overdueTopics]);

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <BarChart3 className="h-4 w-4" />
              <span>NIMCET 2027 Diagnostic Intelligence</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              Analytics & Preparation Reports
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Pacing metrics, planned versus actual study duration, mock score trajectories, and cognitive error distributions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Top 4 KPI Metrics */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-100 pt-4 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Total Hours Logged:</span>
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {totalLoggedHours}h
            </div>
            <div className="text-[11px] text-slate-400">From verified sessions</div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Syllabus Completion:</span>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {overallCompletionPercentage}% unweighted
            </div>
            <div className="text-[11px] text-slate-400">{weightedCompletionPercentage}% weighted</div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Mock Score Average:</span>
            <div className="text-base font-bold text-purple-600 dark:text-purple-400 tabular-nums">
              {completedMocks.length > 0 ? `${avgMockScorePct}%` : 'Awaiting 1st test'}
            </div>
            <div className="text-[11px] text-slate-400">{completedMocks.length} mocks submitted</div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Diagnostic Errors Logged:</span>
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {errorLogs.length} items
            </div>
            <div className="text-[11px] text-slate-400">In error analysis engine</div>
          </div>
        </div>
      </div>

      {/* 2. Actionable Catch-up Recommendations Banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-900 dark:bg-blue-950/20 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-950 dark:text-blue-300">
          <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>Actionable Catch-up & Optimization Strategy</span>
        </div>
        <p className="mt-1 text-xs text-blue-900/80 dark:text-blue-300/80">
          PrepPilot never simply displays a warning without giving you concrete next steps:
        </p>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {catchUpSuggestions.map((sug, i) => (
            <div
              key={i}
              className="rounded-xl border border-blue-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {sug.title}
                </h4>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {sug.desc}
                </p>
              </div>

              <button
                onClick={() => {
                  if (sug.raw) {
                    setSelectedTopicForModal(sug.raw);
                  }
                  setActiveSection(sug.action as any);
                }}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 self-start"
              >
                <span>{sug.actionLabel}</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Subject-wise Progress & Cognitive Error Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Breakdown Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Subject-Wise Progress Against Exam Weightage
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Shows completion ratio versus the 120-question NIMCET total distribution
          </p>

          <div className="space-y-4">
            {subjects.map((subj) => {
              const stat = subjectStats[subj.id];
              const pct = stat?.percentage || 0;

              return (
                <div key={subj.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {subj.name} ({subj.questionWeight} Qs)
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 font-bold tabular-nums">
                      {pct}% ({stat?.completedTopics}/{stat?.totalTopics})
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: subj.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cognitive Mistake Distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Cognitive Error Diagnostic Breakdown
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Analysis of 7 mistake categories from logged problem solving sessions
          </p>

          {errorLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No errors logged yet. As you log mistakes in the Revision Centre, cognitive patterns will visualize here.
            </div>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(mistakesByCategory).map(([cat, count]) => {
                const total = errorLogs.length;
                const pct = Math.round((count / total) * 100);

                return (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300 capitalize">
                      {cat.replace('_', ' ')}:
                    </span>
                    <div className="flex items-center gap-2 w-44">
                      <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-slate-600 dark:text-slate-400 w-12 text-right">
                        {count} ({pct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
