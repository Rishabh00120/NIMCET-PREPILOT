import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  Clock,
  Trash2,
  CheckCircle2,
  Tag,
  ArrowUpDown,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TaskItem, TaskType, PriorityLevel, SubjectId } from '../types';

export const TodoListView: React.FC = () => {
  const {
    tasks,
    addTask,
    toggleTaskCompletion,
    deleteTask,
    bulkCompleteTasks,
    subjects,
    allTrackableTopics,
    todayDate,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'today' | 'pending' | 'completed' | 'overdue'>('pending');
  const [sortBy, setSortBy] = useState<'deadline' | 'priority' | 'subject'>('deadline');

  // Quick Add task form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubjectId, setNewSubjectId] = useState<SubjectId>('maths');
  const [newTaskType, setNewTaskType] = useState<TaskType>('Learn');
  const [newDeadline, setNewDeadline] = useState(todayDate);
  const [newPriority, setNewPriority] = useState<PriorityLevel>('medium');
  const [newEstMinutes, setNewEstMinutes] = useState(120);
  const [newNotes, setNewNotes] = useState('');

  // Selected for bulk action
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Filtered & sorted tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!t.title.toLowerCase().includes(q) && !t.notes.toLowerCase().includes(q)) {
            return false;
          }
        }

        // Filter status
        const isOverdue = t.status === 'pending' && t.deadline < todayDate;
        if (filterType === 'pending' && t.status !== 'pending') return false;
        if (filterType === 'completed' && t.status !== 'completed') return false;
        if (filterType === 'overdue' && !isOverdue) return false;
        if (filterType === 'today' && t.deadline !== todayDate) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'deadline') {
          return a.deadline.localeCompare(b.deadline);
        }
        if (sortBy === 'priority') {
          const pRank: Record<PriorityLevel, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
          return pRank[b.priority] - pRank[a.priority];
        }
        if (sortBy === 'subject') {
          return (a.subjectId || '').localeCompare(b.subjectId || '');
        }
        return 0;
      });
  }, [tasks, searchQuery, filterType, sortBy, todayDate]);

  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const pendingCount = totalCount - completedCount;
  const overdueCount = tasks.filter((t) => t.status === 'pending' && t.deadline < todayDate).length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addTask({
      title: newTitle.trim(),
      subjectId: newSubjectId,
      taskType: newTaskType,
      startDate: todayDate,
      deadline: newDeadline,
      priority: newPriority,
      status: 'pending',
      estimatedMinutes: newEstMinutes,
      actualMinutes: 0,
      notes: newNotes,
    });

    setNewTitle('');
    setNewNotes('');
    setShowAddForm(false);
  };

  const handleSelectAllFiltered = () => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map((t) => t.id));
    }
  };

  const handleBulkComplete = () => {
    bulkCompleteTasks(selectedTaskIds);
    setSelectedTaskIds([]);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Progress Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <CheckSquare className="h-4 w-4" />
              <span>NIMCET Preparation Task Queue</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              To-Do List & Study Tasks
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Manage day-to-day study tasks, problem solving quotas, PYQ sets, and mistake reviews.
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Add Study Task</span>
          </button>
        </div>

        {/* Progress Bar & Counters */}
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Task Completion Status
            </span>
            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
              {completedCount} completed &bull; {pendingCount} pending ({progressPct}%)
            </span>
          </div>

          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Controls: Search, Filters, Sort & Bulk Actions */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks, formulas, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-white"
          />
        </div>

        {/* Filter Segmented Control */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterType('pending')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              filterType === 'pending'
                ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilterType('today')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              filterType === 'today'
                ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Due Today
          </button>
          <button
            onClick={() => setFilterType('overdue')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              filterType === 'overdue'
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Overdue ({overdueCount})
          </button>
          <button
            onClick={() => setFilterType('completed')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              filterType === 'completed'
                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setFilterType('all')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              filterType === 'all'
                ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            All
          </button>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 pl-0 md:pl-3 pt-2 md:pt-0 dark:border-slate-800">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="deadline">Sort: Deadline</option>
            <option value="priority">Sort: Priority</option>
            <option value="subject">Sort: Subject</option>
          </select>
        </div>
      </div>

      {/* Bulk action toolbar if items selected */}
      {selectedTaskIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-2 text-xs text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
          <span>{selectedTaskIds.length} tasks selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkComplete}
              className="rounded-md bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-700"
            >
              Mark All as Completed
            </button>
            <button
              onClick={() => setSelectedTaskIds([])}
              className="text-slate-500 hover:underline"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* 3. Task Items List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No tasks found in this view.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isDone = task.status === 'completed';
            const isOverdue = !isDone && task.deadline < todayDate;
            const isSelected = selectedTaskIds.includes(task.id);

            return (
              <div
                key={task.id}
                className={`flex items-start sm:items-center justify-between p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${
                  isDone ? 'bg-slate-50/30 opacity-75 dark:bg-slate-950/20' : ''
                }`}
              >
                {/* Left: Checkbox & Details */}
                <div className="flex items-start gap-3 min-w-0 flex-1 pr-4">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggleTaskCompletion(task.id)}
                    className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer dark:border-slate-700 dark:bg-slate-800"
                    aria-label={`Mark task ${task.title} as completed`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`text-xs font-semibold ${
                          isDone
                            ? 'text-slate-400 line-through dark:text-slate-500'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {task.title}
                      </h3>

                      {isOverdue && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          [Overdue]
                        </span>
                      )}
                    </div>

                    {/* Unboxed Metadata (Zero-Pill Discipline) */}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Type: <strong className="text-slate-700 dark:text-slate-300">{task.taskType}</strong></span>
                      {task.subjectId && (
                        <>
                          <span aria-hidden="true">&bull;</span>
                          <span className="capitalize">{task.subjectId}</span>
                        </>
                      )}
                      <span aria-hidden="true">&bull;</span>
                      <span>Due: <span className="font-mono tabular-nums">{task.deadline}</span></span>
                      <span aria-hidden="true">&bull;</span>
                      <span>Priority: <span className="capitalize">{task.priority}</span></span>
                      <span aria-hidden="true">&bull;</span>
                      <span className="font-mono">{task.estimatedMinutes} mins est.</span>
                    </div>

                    {task.notes && (
                      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 italic">
                        {task.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTaskIds((prev) => prev.filter((id) => id !== task.id));
                      } else {
                        setSelectedTaskIds((prev) => [...prev, task.id]);
                      }
                    }}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium border ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-800'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </button>

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Quick Add Task Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Create New Study Task
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Schedule specific topic practice, revision, or mock review
            </p>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Practise 30 Matrices & Determinants questions"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subject
                  </label>
                  <select
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value as SubjectId)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Task Type
                  </label>
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value as TaskType)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Learn">Learn</option>
                    <option value="Practise">Practise</option>
                    <option value="PYQ">PYQ</option>
                    <option value="Revise">Revise</option>
                    <option value="Sectional Test">Sectional Test</option>
                    <option value="Full Mock">Full Mock</option>
                    <option value="Review Mistakes">Review Mistakes</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Deadline Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Estimated Minutes
                </label>
                <input
                  type="number"
                  step="15"
                  min="15"
                  value={newEstMinutes}
                  onChange={(e) => setNewEstMinutes(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Target problem numbers, key formulas, etc."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
                >
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
