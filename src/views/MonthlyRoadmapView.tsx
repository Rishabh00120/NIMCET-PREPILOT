import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Target,
  Award,
  ChevronRight,
  Edit2,
  Save,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MonthlyGoal } from '../types';

export const MonthlyRoadmapView: React.FC = () => {
  const {
    monthlyGoals,
    updateMonthlyGoal,
    allTrackableTopics,
    studySessions,
    mockTests,
    userConfig,
    updateUserConfig,
    setSelectedTopicForModal,
    setActiveSection,
    updateTopic,
  } = useApp();

  const [editingMonthKey, setEditingMonthKey] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<MonthlyGoal>>({});
  const [rescheduleMessage, setRescheduleMessage] = useState<string | null>(null);

  const startEdit = (goal: MonthlyGoal) => {
    setEditingMonthKey(goal.monthKey);
    setEditFormData({
      targetHours: goal.targetHours,
      targetQuestions: goal.targetQuestions,
      targetTests: goal.targetTests,
      userNotes: goal.userNotes,
    });
  };

  const saveEdit = (monthKey: string) => {
    updateMonthlyGoal(monthKey, editFormData);
    setEditingMonthKey(null);
  };

  // Rebalance / Move unfinished topics assistant
  const handleRescheduleUnfinished = (sourceMonthKey: string, targetMonthKey: string) => {
    const unfinishedInSource = allTrackableTopics.filter(
      (t) => t.assignedMonth === sourceMonthKey && !t.completed
    );

    if (unfinishedInSource.length === 0) {
      setRescheduleMessage(`No incomplete topics found in ${sourceMonthKey}.`);
      setTimeout(() => setRescheduleMessage(null), 3500);
      return;
    }

    // Move to target month without duplicating
    unfinishedInSource.forEach((topic) => {
      updateTopic(topic.id, {
        assignedMonth: targetMonthKey,
        targetCompletionDate: `${targetMonthKey}-25`,
      });
    });

    setRescheduleMessage(
      `Successfully rescheduled ${unfinishedInSource.length} incomplete topic(s) to ${targetMonthKey} target pool!`
    );
    setTimeout(() => setRescheduleMessage(null), 4000);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Overview */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <span>October 2026 &mdash; May 2027</span>
              <span aria-hidden="true">&bull;</span>
              <span>8-Month Preparation Horizon</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              NIMCET 2027 Monthly Roadmap & Goal Management
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Plan, pace, and calibrate your syllabus milestones from first foundation principles through intensive full-length test simulations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSection('syllabus')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Browse Syllabus
            </button>
          </div>
        </div>

        {rescheduleMessage && (
          <div className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900 flex items-center justify-between">
            <span>{rescheduleMessage}</span>
            <button onClick={() => setRescheduleMessage(null)} className="font-bold ml-2">&times;</button>
          </div>
        )}
      </div>

      {/* 2. Month-by-Month Cards Timeline */}
      <div className="space-y-6">
        {monthlyGoals.map((goal, index) => {
          // Calculate actual metrics for this month
          const monthTopics = allTrackableTopics.filter((t) => t.assignedMonth === goal.monthKey);
          const completedCount = monthTopics.filter((t) => t.completed).length;
          const totalTopics = monthTopics.length;
          const pct = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;
          const overdueCount = monthTopics.filter((t) => !t.completed && t.status === 'overdue').length;

          // Tests completed this month
          const monthTests = mockTests.filter((m) => m.scheduledDate.startsWith(goal.monthKey));
          const completedTestsCount = monthTests.filter((m) => m.completed).length;

          const isEditing = editingMonthKey === goal.monthKey;
          const isMay = goal.monthKey === '2027-05';

          return (
            <div
              key={goal.monthKey}
              className={`rounded-2xl border transition-all ${
                goal.isReviewed
                  ? 'border-emerald-200 bg-emerald-50/20 dark:border-emerald-950 dark:bg-emerald-950/10'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              } p-6 shadow-2xs`}
            >
              {/* Month Header Strip */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-800">
                    <span className="text-xs font-mono font-bold">{index + 1}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        {goal.name}
                      </h2>
                      {goal.provisional && !userConfig.exactExamDate && (
                        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          (Provisional &bull; Official date pending)
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {goal.phase}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateMonthlyGoal(goal.monthKey, { isReviewed: !goal.isReviewed })}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      goal.isReviewed
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {goal.isReviewed ? '✓ Month Reviewed' : 'Mark Reviewed'}
                  </button>

                  <button
                    onClick={() => (isEditing ? saveEdit(goal.monthKey) : startEdit(goal))}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {isEditing ? <Save className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                    <span>{isEditing ? 'Save' : 'Edit Targets'}</span>
                  </button>
                </div>
              </div>

              {/* Month Focus Summary */}
              <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-700 leading-relaxed dark:bg-slate-950/60 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-900 dark:text-white">Core Focus: </span>
                {goal.focusSummary}
              </div>

              {/* Month Targets Grid */}
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {/* Syllabus Coverage */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Syllabus Progress</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {totalTopics > 0 ? `${pct}%` : 'Revision'}
                    </span>
                    {totalTopics > 0 && (
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        ({completedCount}/{totalTopics})
                      </span>
                    )}
                  </div>
                  {overdueCount > 0 && (
                    <div className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      {overdueCount} overdue target{overdueCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Study Hours Target */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Target Study Hours</div>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editFormData.targetHours || 0}
                      onChange={(e) => setEditFormData({ ...editFormData, targetHours: parseInt(e.target.value) || 0 })}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  ) : (
                    <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {goal.targetHours}h
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-slate-500">
                    Primary: 14:00–21:00 window
                  </div>
                </div>

                {/* Target Questions */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Practice Questions</div>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editFormData.targetQuestions || 0}
                      onChange={(e) => setEditFormData({ ...editFormData, targetQuestions: parseInt(e.target.value) || 0 })}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  ) : (
                    <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {goal.targetQuestions} Qs
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-slate-500">
                    PYQs & topic problems
                  </div>
                </div>

                {/* Mock / Sectional Tests */}
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Tests Target</div>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editFormData.targetTests || 0}
                      onChange={(e) => setEditFormData({ ...editFormData, targetTests: parseInt(e.target.value) || 0 })}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  ) : (
                    <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {completedTestsCount} / {goal.targetTests}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-slate-500">
                    Sectionals & Mocks
                  </div>
                </div>
              </div>

              {/* Month Assigned Topics Preview & Reschedule Tools */}
              {totalTopics > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Assigned Topics Checklist ({completedCount}/{totalTopics} completed)
                    </span>

                    {/* Reschedule button if unfinished */}
                    {totalTopics > completedCount && index < monthlyGoals.length - 1 && (
                      <button
                        onClick={() => handleRescheduleUnfinished(goal.monthKey, monthlyGoals[index + 1].monthKey)}
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-1 font-medium"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Move unfinished to next month &rarr;</span>
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {monthTopics.slice(0, 10).map((topic) => (
                      <button
                        key={topic.id}
                        onClick={() => setSelectedTopicForModal(topic)}
                        className={`text-left rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          topic.completed
                            ? 'bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500'
                            : 'bg-white border border-slate-200 text-slate-800 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {topic.title}
                      </button>
                    ))}
                    {monthTopics.length > 10 && (
                      <span className="px-2 py-1 text-[11px] text-slate-400">
                        +{monthTopics.length - 10} more topics
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* User Notes */}
              {goal.userNotes && (
                <div className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 italic">
                  Note: {goal.userNotes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
