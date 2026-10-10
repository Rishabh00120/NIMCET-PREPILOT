import React, { useState, useMemo } from 'react';
import {
  Award,
  Plus,
  CheckCircle2,
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
  Trash2,
  Edit2,
  Save,
  Target,
  BarChart2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MockTest, MockTestType, SubjectId } from '../types';

export const TestSeriesView: React.FC = () => {
  const { mockTests, addMockTest, updateMockTest, deleteMockTest, todayDate } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);

  // Form state
  const [testName, setTestName] = useState('Full Mock 2');
  const [provider, setProvider] = useState('Online Test Series');
  const [testType, setTestType] = useState<MockTestType>('sectional');
  const [scheduledDate, setScheduledDate] = useState('2026-12-15');
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [maxMarks, setMaxMarks] = useState(200);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [timeObservations, setTimeObservations] = useState('');
  const [weakTopicsStr, setWeakTopicsStr] = useState('');
  const [followUpTasksStr, setFollowUpTasksStr] = useState('');
  const [retestDate, setRetestDate] = useState('');

  const handleCreateTest = (e: React.FormEvent) => {
    e.preventDefault();
    addMockTest({
      testName,
      provider,
      testType,
      scheduledDate,
      completed,
      completedDate: completed ? todayDate : undefined,
      score,
      maxMarks,
      correctCount,
      incorrectCount,
      skippedCount,
      timeObservations,
      weakTopics: weakTopicsStr.split(',').map((s) => s.trim()).filter(Boolean),
      followUpTasks: followUpTasksStr.split(',').map((s) => s.trim()).filter(Boolean),
      retestDate: retestDate || undefined,
    });
    setShowAddModal(false);
  };

  const openLogResults = (test: MockTest) => {
    setEditingTestId(test.id);
    setScore(test.score);
    setMaxMarks(test.maxMarks);
    setCorrectCount(test.correctCount);
    setIncorrectCount(test.incorrectCount);
    setSkippedCount(test.skippedCount);
    setTimeObservations(test.timeObservations);
    setWeakTopicsStr(test.weakTopics.join(', '));
    setFollowUpTasksStr(test.followUpTasks.join(', '));
    setRetestDate(test.retestDate || '');
  };

  const saveResults = (testId: string) => {
    updateMockTest(testId, {
      completed: true,
      completedDate: todayDate,
      score,
      maxMarks,
      correctCount,
      incorrectCount,
      skippedCount,
      timeObservations,
      weakTopics: weakTopicsStr.split(',').map((s) => s.trim()).filter(Boolean),
      followUpTasks: followUpTasksStr.split(',').map((s) => s.trim()).filter(Boolean),
      retestDate: retestDate || undefined,
    });
    setEditingTestId(null);
  };

  // Metrics
  const completedTests = mockTests.filter((t) => t.completed);
  const scheduledUpcoming = mockTests.filter((t) => !t.completed);
  const averageScorePct = completedTests.length > 0
    ? Math.round(
        completedTests.reduce((sum, t) => sum + (t.score / (t.maxMarks || 1)) * 100, 0) /
          completedTests.length
      )
    : 0;

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <Award className="h-4 w-4" />
              <span>NIMCET Test Series & Full Mock Simulations</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              Test Series & Mock Examination Tracker
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Track tests from your purchased online test series, from topic quizzes to sectional and timed 120-minute full mock simulations.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule New Test</span>
          </button>
        </div>

        {/* Milestone Phasing Guide */}
        <div className="mt-5 rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-900 dark:text-white mb-1.5">
            Recommended Test Series Milestones:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <div>&bull; <strong>Oct&ndash;Nov:</strong> Topic quizzes & chapter tests</div>
            <div>&bull; <strong>Dec 2026:</strong> Regular sectional timed tests</div>
            <div>&bull; <strong>Jan 2027:</strong> 1 Full Mock/week + sectionals</div>
            <div>&bull; <strong>Feb&ndash;Apr:</strong> 2&ndash;3 Full Mocks/week</div>
          </div>
        </div>

        {/* Aggregate KPI */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-100 pt-4 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Completed Tests:</span>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {completedTests.length} tests
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Scheduled Upcoming:</span>
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {scheduledUpcoming.length} tests
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Average Score %:</span>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {completedTests.length > 0 ? `${averageScorePct}%` : 'N/A (Awaiting 1st test)'}
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Next Scheduled:</span>
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {scheduledUpcoming[0] ? scheduledUpcoming[0].scheduledDate : 'None planned'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Test List */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {mockTests.map((test) => {
          const isEditing = editingTestId === test.id;
          const accuracy = (test.correctCount + test.incorrectCount) > 0
            ? Math.round((test.correctCount / (test.correctCount + test.incorrectCount)) * 100)
            : 0;

          return (
            <div key={test.id} className="p-5 transition-colors hover:bg-slate-50/40 dark:hover:bg-slate-800/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {test.testName}
                    </h3>
                    {test.completed ? (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Completed</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                        [Scheduled for {test.scheduledDate}]
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Provider: <strong className="text-slate-700 dark:text-slate-300">{test.provider}</strong></span>
                    <span aria-hidden="true">&bull;</span>
                    <span className="capitalize">{test.testType.replace('_', ' ')}</span>
                    <span aria-hidden="true">&bull;</span>
                    <span>Max: {test.maxMarks} marks</span>
                  </div>
                </div>

                {/* Status & Action */}
                <div className="flex items-center gap-3">
                  {test.completed && (
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                        {test.score} / {test.maxMarks}
                      </div>
                      <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                        {accuracy}% Accuracy &bull; {test.correctCount}C / {test.incorrectCount}I
                      </div>
                    </div>
                  )}

                  {!test.completed ? (
                    <button
                      onClick={() => openLogResults(test)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
                    >
                      Log Test Result
                    </button>
                  ) : (
                    <button
                      onClick={() => openLogResults(test)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      Edit Scores
                    </button>
                  )}

                  <button
                    onClick={() => deleteMockTest(test.id)}
                    className="p-1 text-slate-400 hover:text-red-600"
                    title="Delete test"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Weak topics & Observations */}
              {test.completed && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800 text-xs">
                  {test.timeObservations && (
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      <strong>Time Management: </strong> {test.timeObservations}
                    </p>
                  )}

                  {test.weakTopics.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Weak Topics Identified: </span>
                      {test.weakTopics.map((wt, i) => (
                        <span key={i} className="text-red-700 dark:text-red-400 font-medium">
                          {wt}{i < test.weakTopics.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Edit dialog inline if selected */}
              {isEditing && (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3">
                    Record Real Results for &quot;{test.testName}&quot;
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Score Obtained</label>
                      <input
                        type="number"
                        value={score}
                        onChange={(e) => setScore(parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Correct Count</label>
                      <input
                        type="number"
                        value={correctCount}
                        onChange={(e) => setCorrectCount(parseInt(e.target.value) || 0)}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-emerald-600 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Incorrect Count</label>
                      <input
                        type="number"
                        value={incorrectCount}
                        onChange={(e) => setIncorrectCount(parseInt(e.target.value) || 0)}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-red-600 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Skipped Count</label>
                      <input
                        type="number"
                        value={skippedCount}
                        onChange={(e) => setSkippedCount(parseInt(e.target.value) || 0)}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Time observations / exam pressure</label>
                      <input
                        type="text"
                        value={timeObservations}
                        onChange={(e) => setTimeObservations(e.target.value)}
                        placeholder="e.g. Spent too much time on Q10-15 in Calculus..."
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Weak topics identified (comma separated)</label>
                      <input
                        type="text"
                        value={weakTopicsStr}
                        onChange={(e) => setWeakTopicsStr(e.target.value)}
                        placeholder="e.g. Bayes Theorem, Tangents & Normals"
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingTestId(null)}
                      className="rounded px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveResults(test.id)}
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Save Results
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. Schedule New Test Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Schedule New Test or Mock Exam
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Add upcoming sectional test or full-length simulation
            </p>

            <form onSubmit={handleCreateTest} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Test Title
                </label>
                <input
                  type="text"
                  required
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Test Provider / Series
                  </label>
                  <input
                    type="text"
                    required
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Test Type
                  </label>
                  <select
                    value={testType}
                    onChange={(e) => setTestType(e.target.value as MockTestType)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="topic_quiz">Topic Quiz</option>
                    <option value="chapter_test">Chapter Test</option>
                    <option value="sectional">Sectional Test</option>
                    <option value="full_mock">Full-Length Mock</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Maximum Marks
                  </label>
                  <input
                    type="number"
                    min="10"
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
                >
                  Schedule Test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
