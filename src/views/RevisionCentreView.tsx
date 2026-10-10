import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Filter,
  Search,
  Clock,
  Sparkles,
  Trash2,
  Tag,
  BookOpen,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MistakeCategory, SubjectId, ErrorLogEntry } from '../types';

export const RevisionCentreView: React.FC = () => {
  const {
    revisionItems,
    completeRevisionStage,
    errorLogs,
    addErrorLog,
    updateErrorLog,
    deleteErrorLog,
    subjects,
    allTrackableTopics,
    addRevisionScheduleForTopic,
    todayDate,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'revision_cycles' | 'error_log' | 'redo_queue'>('revision_cycles');

  // Error Log Form State
  const [showAddError, setShowAddError] = useState(false);
  const [errorSubjectId, setErrorSubjectId] = useState<SubjectId>('maths');
  const [errorTopic, setErrorTopic] = useState('');
  const [errorQuestionRef, setErrorQuestionRef] = useState('');
  const [errorCategory, setErrorCategory] = useState<MistakeCategory>('calculation');
  const [errorNotes, setErrorNotes] = useState('');
  const [errorNeedsRedo, setErrorNeedsRedo] = useState(true);

  // Filters for Error Log
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');

  const mistakeCategoryLabels: Record<MistakeCategory, string> = {
    conceptual: 'Conceptual misunderstanding',
    formula: 'Formula forgotten',
    calculation: 'Calculation error',
    misread: 'Misread question',
    time_pressure: 'Time pressure',
    guess: 'Incorrect guess',
    careless: 'Careless mistake',
  };

  const handleCreateError = (e: React.FormEvent) => {
    e.preventDefault();
    addErrorLog({
      date: todayDate,
      subjectId: errorSubjectId,
      topic: errorTopic || 'General Question',
      questionRef: errorQuestionRef || 'Q-Ref',
      mistakeCategory: errorCategory,
      notes: errorNotes,
      needsRedo: errorNeedsRedo,
      resolved: false,
    });

    setErrorTopic('');
    setErrorQuestionRef('');
    setErrorNotes('');
    setShowAddError(false);
  };

  const filteredErrors = useMemo(() => {
    return errorLogs.filter((err) => {
      if (activeTab === 'redo_queue' && (!err.needsRedo || err.resolved)) return false;
      if (filterCategory !== 'all' && err.mistakeCategory !== filterCategory) return false;
      if (filterSubject !== 'all' && err.subjectId !== filterSubject) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          err.topic.toLowerCase().includes(q) ||
          err.questionRef.toLowerCase().includes(q) ||
          err.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [errorLogs, activeTab, filterCategory, filterSubject, searchQuery]);

  // Repeated mistakes analyzer: find topics with >= 2 logged errors
  const repeatedErrorTopics = useMemo(() => {
    const counts: Record<string, number> = {};
    errorLogs.forEach((err) => {
      const key = err.topic.trim().toLowerCase();
      if (key) {
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .filter(([_, count]) => count >= 2)
      .map(([topic, count]) => ({ topic, count }));
  }, [errorLogs]);

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Tab Switcher */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <RotateCcw className="h-4 w-4" />
              <span>Spaced Repetition & Diagnostic Error Log</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              Revision Centre & Error Analysis
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Spaced recall intervals (Same day, +1d, +3d, +7d, +14d, +30d) and mistake categorization across 7 cognitive traps.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddError(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              <span>Log Mistake</span>
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('revision_cycles')}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              activeTab === 'revision_cycles'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Spaced Revision Schedules ({revisionItems.length})
          </button>

          <button
            onClick={() => setActiveTab('error_log')}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              activeTab === 'error_log'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Comprehensive Error Log ({errorLogs.length})
          </button>

          <button
            onClick={() => setActiveTab('redo_queue')}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              activeTab === 'redo_queue'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            Redo Incorrect Questions ({errorLogs.filter((e) => e.needsRedo && !e.resolved).length})
          </button>
        </div>
      </div>

      {/* 2. Repeated Error Alert (Real Condition) */}
      {repeatedErrorTopics.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Automatic Catch-Up Recommendation: Repeated Mistake Hotspots</span>
          </div>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-400">
            You have logged multiple errors in these topics. Consider scheduling targeted re-learning:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {repeatedErrorTopics.map(({ topic, count }) => (
              <span
                key={topic}
                className="rounded-md bg-white border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-slate-900 dark:border-amber-800 dark:text-amber-200"
              >
                {topic} ({count} mistakes)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Tab Contents */}
      {activeTab === 'revision_cycles' ? (
        /* Spaced Revision Schedules View */
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Active Spaced Repetition Cycles
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Whenever a topic is marked studied, PrepPilot activates systematic review intervals at Same day &bull; 1 day &bull; 3 days &bull; 7 days &bull; 14 days &bull; 30 days.
            </p>
          </div>

          {revisionItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <RotateCcw className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                No active revision cycles yet
              </p>
              <p className="mt-1 max-w-sm mx-auto text-slate-400">
                Mark any syllabus topic as studied or completed in the Syllabus checklist, and its spaced review intervals will automatically appear here!
              </p>
            </div>
          ) : (
            revisionItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div>
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase">
                      {item.subjectId} &bull; Studied on {item.studiedDate}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.topicTitle}
                    </h3>
                  </div>
                </div>

                {/* Stage intervals pills */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {item.intervals.map((stage, idx) => (
                    <div
                      key={stage.stage}
                      className={`rounded-xl border p-2.5 text-center transition-colors ${
                        stage.completed
                          ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-950 dark:bg-emerald-950/20'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        {stage.stage}
                      </div>
                      <div className="font-mono text-[11px] font-medium text-slate-900 dark:text-white tabular-nums my-1">
                        {stage.targetDate}
                      </div>

                      {stage.completed ? (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          ✓ Done
                        </span>
                      ) : (
                        <button
                          onClick={() => completeRevisionStage(item.id, idx)}
                          className="w-full rounded bg-blue-600 py-1 text-[10px] font-semibold text-white hover:bg-blue-700"
                        >
                          Mark Reviewed
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Error Log & Redo Queue View */
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search mistake notes or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="all">All Mistake Types</option>
                {Object.entries(mistakeCategoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>

              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="all">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* List of logged errors */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredErrors.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No mistakes recorded in this view. Use &quot;Log Mistake&quot; whenever you encounter tricky problems or mock exam errors.
              </div>
            ) : (
              filteredErrors.map((err) => (
                <div key={err.id} className="p-4 transition-colors hover:bg-slate-50/40 dark:hover:bg-slate-800/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {err.questionRef} &bull; {err.topic}
                        </h4>
                        {err.needsRedo && !err.resolved && (
                          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            [Redo Needed]
                          </span>
                        )}
                        {err.resolved && (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            [Resolved]
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Subject: <strong className="capitalize text-slate-700 dark:text-slate-300">{err.subjectId}</strong></span>
                        <span aria-hidden="true">&bull;</span>
                        <span>Trap: <strong className="text-red-700 dark:text-red-400 font-semibold">{mistakeCategoryLabels[err.mistakeCategory]}</strong></span>
                        <span aria-hidden="true">&bull;</span>
                        <span className="font-mono tabular-nums">{err.date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateErrorLog(err.id, { resolved: !err.resolved })}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium border ${
                          err.resolved
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {err.resolved ? '✓ Resolved' : 'Mark Resolved'}
                      </button>

                      <button
                        onClick={() => deleteErrorLog(err.id)}
                        className="p-1 text-slate-400 hover:text-red-600"
                        title="Delete log"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {err.notes && (
                    <div className="mt-2.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 dark:bg-slate-950/60 dark:text-slate-300 leading-relaxed border border-slate-100 dark:border-slate-800">
                      <span className="font-semibold text-slate-900 dark:text-white">Cognitive Analysis: </span>
                      {err.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. Log Mistake Modal Form */}
      {showAddError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Log Question Mistake / Diagnostic Error
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Categorize root causes to avoid repeating the same conceptual or calculation traps
            </p>

            <form onSubmit={handleCreateError} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subject
                  </label>
                  <select
                    value={errorSubjectId}
                    onChange={(e) => setErrorSubjectId(e.target.value as SubjectId)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cognitive Mistake Category
                  </label>
                  <select
                    value={errorCategory}
                    onChange={(e) => setErrorCategory(e.target.value as MistakeCategory)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {Object.entries(mistakeCategoryLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Topic Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bayes’ Theorem"
                    value={errorTopic}
                    onChange={(e) => setErrorTopic(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Question Reference / Source
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PYQ 2023 Q14 or Mock 1 Q42"
                    value={errorQuestionRef}
                    onChange={(e) => setErrorQuestionRef(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Why was it missed? (Key lesson & correction)
                </label>
                <textarea
                  rows={2.5}
                  required
                  placeholder="e.g. Forgot that total probability denominator requires summing mutually exclusive priors..."
                  value={errorNotes}
                  onChange={(e) => setErrorNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="needsRedoErrorCheck"
                  checked={errorNeedsRedo}
                  onChange={(e) => setErrorNeedsRedo(e.target.checked)}
                  className="h-4 w-4 rounded-sm text-blue-600 cursor-pointer"
                />
                <label htmlFor="needsRedoErrorCheck" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  Place in &quot;Redo Incorrect Questions&quot; queue for subsequent revision sessions
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddError(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
                >
                  Save Mistake
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
