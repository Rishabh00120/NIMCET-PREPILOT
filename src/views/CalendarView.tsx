import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Award,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const CalendarView: React.FC = () => {
  const {
    allTrackableTopics,
    tasks,
    mockTests,
    studySessions,
    monthlyGoals,
    setSelectedTopicForModal,
    todayDate,
  } = useApp();

  // Current view month: defaulting to today's month/year
  const [currentYear, setCurrentYear] = useState<number>(() => {
    const y = parseInt(todayDate.split('-')[0], 10);
    return isNaN(y) ? 2026 : y;
  });
  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    const m = parseInt(todayDate.split('-')[1], 10);
    return isNaN(m) ? 9 : m - 1;
  });
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Days in current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday

  // Group events by date (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map: Record<string, { type: 'topic' | 'task' | 'test' | 'session'; title: string; id: string; completed?: boolean; overdue?: boolean; raw?: any }[]> = {};

    // Topics by target completion date
    allTrackableTopics.forEach((topic) => {
      const d = topic.targetCompletionDate;
      if (!map[d]) map[d] = [];
      map[d].push({
        type: 'topic',
        title: topic.title,
        id: topic.id,
        completed: topic.completed,
        overdue: !topic.completed && topic.targetCompletionDate < todayDate,
        raw: topic,
      });
    });

    // Mock tests by scheduled date
    mockTests.forEach((test) => {
      const d = test.scheduledDate;
      if (!map[d]) map[d] = [];
      map[d].push({
        type: 'test',
        title: test.testName,
        id: test.id,
        completed: test.completed,
      });
    });

    // Study tasks by deadline
    tasks.forEach((task) => {
      const d = task.deadline;
      if (!map[d]) map[d] = [];
      map[d].push({
        type: 'task',
        title: task.title,
        id: task.id,
        completed: task.status === 'completed',
        overdue: task.status === 'pending' && task.deadline < todayDate,
      });
    });

    return map;
  }, [allTrackableTopics, mockTests, tasks, todayDate]);

  // Monthly progress metrics for the selected calendar month
  const monthGoal = monthlyGoals.find((g) => g.monthKey === currentMonthKey);
  const monthTopics = allTrackableTopics.filter((t) => t.assignedMonth === currentMonthKey);
  const completedMonthTopics = monthTopics.filter((t) => t.completed).length;
  const overdueMonthTopics = monthTopics.filter((t) => !t.completed && t.status === 'overdue').length;
  const pendingMonthTopics = monthTopics.length - completedMonthTopics;

  // Study hours logged in this month
  const monthSessions = studySessions.filter((s) => s.date.startsWith(currentMonthKey));
  const actualMonthHours = Math.round((monthSessions.reduce((sum, s) => sum + (s.actualMinutes || 0), 0) / 60) * 10) / 10;

  // Tests in this month
  const monthTests = mockTests.filter((m) => m.scheduledDate.startsWith(currentMonthKey));
  const completedMonthTests = monthTests.filter((m) => m.completed).length;

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header with Month Navigator & View Switcher */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <CalendarIcon className="h-4 w-4" />
              <span>NIMCET 2027 Study Calendar</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {monthNames[currentMonth]} {currentYear}
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {monthGoal ? monthGoal.phase : 'Self-directed Preparation Month'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
              <button
                onClick={prevMonth}
                className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                {monthNames[currentMonth].slice(0, 3)} {currentYear}
              </span>
              <button
                onClick={nextMonth}
                className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950 text-xs">
              <button
                onClick={() => setViewMode('month')}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  viewMode === 'month'
                    ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                Month View
              </button>
            </div>
          </div>
        </div>

        {/* 2. Monthly Progress Comparison Widget */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-6 border-t border-slate-100 pt-4 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Planned Topics:</span>
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {monthTopics.length}
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Completed Topics:</span>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {completedMonthTopics}
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Pending Topics:</span>
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {pendingMonthTopics}
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Overdue Targets:</span>
            <div className={`text-base font-bold tabular-nums ${overdueMonthTopics > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
              {overdueMonthTopics}
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Hours (Act / Plan):</span>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {actualMonthHours}h / {monthGoal?.targetHours || 180}h
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Tests (Act / Plan):</span>
            <div className="text-base font-bold text-purple-600 dark:text-purple-400 tabular-nums">
              {completedMonthTests} / {monthGoal?.targetTests || 4}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Monthly Calendar Grid */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-x-auto">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-px text-center text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1.5 pt-2">
          {/* Empty cells for leading days */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[110px] rounded-lg bg-slate-50/40 p-2 dark:bg-slate-950/20" />
          ))}

          {/* Actual days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isToday = dateStr === todayDate;
            const dayEvents = eventsByDate[dateStr] || [];

            return (
              <div
                key={dateStr}
                className={`min-h-[110px] rounded-lg border p-2 flex flex-col justify-between transition-colors ${
                  isToday
                    ? 'border-blue-500 bg-blue-50/20 dark:border-blue-600 dark:bg-blue-950/20'
                    : 'border-slate-100 bg-white dark:border-slate-800/80 dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Day Number Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold font-mono tabular-nums ${
                      isToday
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {dayEvents.length} item{dayEvents.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Event Pills */}
                <div className="mt-1 flex-1 space-y-1 overflow-y-auto max-h-20 text-[10px]">
                  {dayEvents.slice(0, 3).map((ev, evIdx) => (
                    <div
                      key={`${ev.id}-${evIdx}`}
                      onClick={() => {
                        if (ev.type === 'topic' && ev.raw) {
                          setSelectedTopicForModal(ev.raw);
                        }
                      }}
                      className={`cursor-pointer truncate rounded px-1.5 py-0.5 font-medium leading-tight ${
                        ev.type === 'test'
                          ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300'
                          : ev.overdue
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                          : ev.completed
                          ? 'bg-emerald-100 text-emerald-800 line-through dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                      title={ev.title}
                    >
                      {ev.type === 'test' ? '🏆 ' : ''}
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[9px] font-semibold text-slate-400 text-center">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
