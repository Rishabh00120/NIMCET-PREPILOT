import React, { useState, useMemo } from 'react';
import {
  BookMarked,
  Plus,
  Search,
  CheckCircle2,
  RotateCcw,
  Clock,
  Trash2,
  BarChart2,
  Calendar,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PYQEntry, SubjectId } from '../types';

export const PYQTrackerView: React.FC = () => {
  const { pyqEntries, addPYQEntry, deletePYQEntry, updatePYQEntry, subjects, todayDate } = useApp();

  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRedoOnly, setFilterRedoOnly] = useState(false);

  // New PYQ Form State
  const [yearOrPaper, setYearOrPaper] = useState('NIMCET 2024 Paper');
  const [subjectId, setSubjectId] = useState<SubjectId>('maths');
  const [topic, setTopic] = useState('');
  const [questionRange, setQuestionRange] = useState('Q1 - Q25');
  const [attempted, setAttempted] = useState(25);
  const [correct, setCorrect] = useState(20);
  const [incorrect, setIncorrect] = useState(4);
  const [skipped, setSkipped] = useState(1);
  const [timeMinutes, setTimeMinutes] = useState(45);
  const [mistakesNotes, setMistakesNotes] = useState('');
  const [needsRedo, setNeedsRedo] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addPYQEntry({
      date: todayDate,
      yearOrPaper,
      subjectId,
      topic: topic || 'General Topics',
      questionRange,
      attempted,
      correct,
      incorrect,
      skipped,
      timeMinutes,
      mistakesNotes,
      needsRedo,
    });

    setMistakesNotes('');
    setNeedsRedo(false);
    setShowAddForm(false);
  };

  const filteredEntries = useMemo(() => {
    return pyqEntries.filter((entry) => {
      if (filterRedoOnly && !entry.needsRedo) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          entry.yearOrPaper.toLowerCase().includes(q) ||
          entry.topic.toLowerCase().includes(q) ||
          entry.mistakesNotes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [pyqEntries, filterRedoOnly, searchQuery]);

  // Aggregate stats
  const totalAttempted = pyqEntries.reduce((sum, e) => sum + e.attempted, 0);
  const totalCorrect = pyqEntries.reduce((sum, e) => sum + e.correct, 0);
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const redoCount = pyqEntries.filter((e) => e.needsRedo).length;

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <BookMarked className="h-4 w-4" />
              <span>NIMCET PYQ Book Practice Log</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              Previous Year Questions Tracker
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Track your practice sessions from your NIMCET PYQ book by year, topic range, speed, and error explanations.
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Log PYQ Session</span>
          </button>
        </div>

        {/* Aggregated PYQ KPI row */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-100 pt-4 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Total Solved PYQs:</span>
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {totalAttempted} Questions
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Correct Solved:</span>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {totalCorrect}
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Overall Accuracy:</span>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {overallAccuracy}%
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Redo Queue:</span>
            <div className={`text-base font-bold tabular-nums ${redoCount > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>
              {redoCount} set{redoCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filters & Search */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search paper year, topic, or mistake explanation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterRedoOnly(!filterRedoOnly)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filterRedoOnly
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400'
            }`}
          >
            {filterRedoOnly ? '✓ Redo Queue Filter Active' : 'Show Redo Queue Only'}
          </button>
        </div>
      </div>

      {/* 3. Logged PYQ Records List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {filteredEntries.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No PYQ practice logs recorded yet. Click &quot;Log PYQ Session&quot; to log your first practice set from your NIMCET book.
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const acc = entry.attempted > 0 ? Math.round((entry.correct / entry.attempted) * 100) : 0;

            return (
              <div key={entry.id} className="p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        {entry.yearOrPaper} &bull; {entry.questionRange}
                      </h3>
                      {entry.needsRedo && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          [Needs Redo]
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Subject: <strong className="capitalize text-slate-700 dark:text-slate-300">{entry.subjectId}</strong></span>
                      <span aria-hidden="true">&bull;</span>
                      <span>Topic: {entry.topic}</span>
                      <span aria-hidden="true">&bull;</span>
                      <span className="font-mono tabular-nums">{entry.date}</span>
                      <span aria-hidden="true">&bull;</span>
                      <span className="font-mono">{entry.timeMinutes} mins</span>
                    </div>
                  </div>

                  {/* Accuracy Badge */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                        {acc}% Accuracy
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                        {entry.correct}C / {entry.incorrect}I / {entry.skipped}S
                      </div>
                    </div>

                    <button
                      onClick={() => updatePYQEntry(entry.id, { needsRedo: !entry.needsRedo })}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400"
                    >
                      {entry.needsRedo ? 'Mark Done' : 'Mark for Redo'}
                    </button>

                    <button
                      onClick={() => deletePYQEntry(entry.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      title="Delete log"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {entry.mistakesNotes && (
                  <div className="mt-2.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 leading-relaxed dark:bg-slate-950/60 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-900 dark:text-white">Mistakes & Learnings: </span>
                    {entry.mistakesNotes}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Log PYQ Modal Form */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Log Previous Year Questions (PYQ) Session
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Record question numbers, time taken, and mistake review from your book
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Year or Paper
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NIMCET 2024"
                    value={yearOrPaper}
                    onChange={(e) => setYearOrPaper(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subject
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value as SubjectId)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
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
                    placeholder="e.g. Quadratic Equations & Roots"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Question Numbers / Range
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Q1 - Q25"
                    value={questionRange}
                    onChange={(e) => setQuestionRange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Counts: Attempted, Correct, Incorrect, Skipped */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Attempted</label>
                  <input
                    type="number"
                    min="1"
                    value={attempted}
                    onChange={(e) => setAttempted(parseInt(e.target.value) || 0)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Correct</label>
                  <input
                    type="number"
                    min="0"
                    max={attempted}
                    value={correct}
                    onChange={(e) => setCorrect(parseInt(e.target.value) || 0)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono font-bold text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Incorrect</label>
                  <input
                    type="number"
                    min="0"
                    max={attempted}
                    value={incorrect}
                    onChange={(e) => setIncorrect(parseInt(e.target.value) || 0)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono font-bold text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-red-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Skipped</label>
                  <input
                    type="number"
                    min="0"
                    value={skipped}
                    onChange={(e) => setSkipped(parseInt(e.target.value) || 0)}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-mono font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Time Taken (Minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mistakes and Explanations
                </label>
                <textarea
                  rows={2}
                  placeholder="Which questions tripped you up? Calculation errors, formula forgotten..."
                  value={mistakesNotes}
                  onChange={(e) => setMistakesNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="needsRedoCheck"
                  checked={needsRedo}
                  onChange={(e) => setNeedsRedo(e.target.checked)}
                  className="h-4 w-4 rounded-sm text-blue-600 cursor-pointer"
                />
                <label htmlFor="needsRedoCheck" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  Mark questions to redo later during revision cycles
                </label>
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
                  Save PYQ Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
