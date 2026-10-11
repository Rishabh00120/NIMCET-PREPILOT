import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  BookOpen,
  ExternalLink,
  CheckCircle2,
  Clock,
  Calendar,
  Search,
  Filter,
  ArrowUpDown,
  Sparkles,
  TrendingUp,
  Award,
  AlertCircle,
  Plus,
  LayoutGrid,
  List,
  ChevronRight,
  BookMarked,
  X,
  Save,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PYQ_PAPER_LINKS, isValidPYQUrl } from '../data/pyqLinks';
import { PYQPaperStatus, PYQPaperAttempt, SubjectId } from '../types';

export const PYQLibraryView: React.FC = () => {
  const {
    pyqPaperRecords,
    recordPYQPaperAttempt,
    updatePYQPaperAttempt,
    updatePYQPaperStatus,
    markPYQPaperOpened,
    schedulePYQPaperTask,
    pyqPapersTotalCount,
    pyqPapersPractisedCount,
    pyqPapersRemainingCount,
    pyqPapersCompletionPercentage,
    subjects,
    todayDate,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PYQPaperStatus>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'status'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Record / Edit Results Modal State
  const [activeModalYear, setActiveModalYear] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<'new' | 'edit'>('new');
  const [editingAttemptId, setEditingAttemptId] = useState<string | null>(null);

  // Form input fields (initialised blank/unset, no fabricated scores)
  const [attemptDate, setAttemptDate] = useState<string>(todayDate);
  const [attemptedCount, setAttemptedCount] = useState<string>('');
  const [correctCount, setCorrectCount] = useState<string>('');
  const [incorrectCount, setIncorrectCount] = useState<string>('');
  const [skippedCount, setSkippedCount] = useState<string>('');
  const [scoreVal, setScoreVal] = useState<string>('');
  const [maxScoreVal, setMaxScoreVal] = useState<string>('');
  const [timeMinutes, setTimeMinutes] = useState<string>('');
  const [mistakesNotes, setMistakesNotes] = useState<string>('');
  const [weakTopicsInput, setWeakTopicsInput] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<SubjectId | ''>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Schedule Task Modal State
  const [scheduleModalYear, setScheduleModalYear] = useState<number | null>(null);
  const [scheduledTargetDate, setScheduledTargetDate] = useState<string>(todayDate);
  const [scheduleSubjectId, setScheduleSubjectId] = useState<SubjectId | ''>('');
  const [scheduleDurationMinutes, setScheduleDurationMinutes] = useState<string>('120');
  const [scheduleCustomNotes, setScheduleCustomNotes] = useState<string>('');
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState<string | null>(null);

  // Syllabus topics available for selected subject
  const availableTopics = useMemo(() => {
    if (!selectedSubjectId) return [];
    const subject = subjects.find((s) => s.id === selectedSubjectId);
    if (!subject) return [];
    return subject.chapters.flatMap((ch) => ch.topics);
  }, [subjects, selectedSubjectId]);

  // Safe external link opener
  const handleOpenPaper = (year: number, url: string) => {
    if (!isValidPYQUrl(url)) {
      alert('Security Notice: Invalid external destination URL.');
      return;
    }

    markPYQPaperOpened(year);
    // Safe link handling with rel="noopener noreferrer"
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Open modal for a brand new attempt: initialise blank/empty values, today's date
  const handleOpenNewAttemptModal = (year: number) => {
    setActiveModalYear(year);
    setModalMode('new');
    setEditingAttemptId(null);
    setValidationErrors([]);

    // Clear all fields to blank — no fabricated scores or prefilled answers
    setAttemptDate(todayDate);
    setAttemptedCount('');
    setCorrectCount('');
    setIncorrectCount('');
    setSkippedCount('');
    setScoreVal('');
    setMaxScoreVal('');
    setTimeMinutes('');
    setMistakesNotes('');
    setWeakTopicsInput('');
    setSelectedSubjectId('');
    setSelectedTopicId('');
  };

  // Open modal to edit the existing latest attempt
  const handleOpenEditLatestModal = (year: number) => {
    setActiveModalYear(year);
    setModalMode('edit');
    setValidationErrors([]);

    const existing = pyqPaperRecords[year];
    const latestAttempt = existing?.attempts[0];

    if (latestAttempt) {
      setEditingAttemptId(latestAttempt.id);
      setAttemptDate(latestAttempt.date || todayDate);
      setAttemptedCount(latestAttempt.attempted !== undefined ? String(latestAttempt.attempted) : '');
      setCorrectCount(latestAttempt.correct !== undefined ? String(latestAttempt.correct) : '');
      setIncorrectCount(latestAttempt.incorrect !== undefined ? String(latestAttempt.incorrect) : '');
      setSkippedCount(latestAttempt.skipped !== undefined ? String(latestAttempt.skipped) : '');
      setScoreVal(latestAttempt.score !== undefined ? String(latestAttempt.score) : '');
      setMaxScoreVal(latestAttempt.maxScore !== undefined ? String(latestAttempt.maxScore) : '');
      setTimeMinutes(latestAttempt.timeMinutes !== undefined ? String(latestAttempt.timeMinutes) : '');
      setMistakesNotes(latestAttempt.notes || '');
      setWeakTopicsInput((latestAttempt.weakTopics || []).join(', '));
      setSelectedSubjectId(latestAttempt.subjectId || '');
      setSelectedTopicId(latestAttempt.topicId || '');
    } else {
      handleOpenNewAttemptModal(year);
    }
  };

  const validateForm = (): {
    isValid: boolean;
    errors: string[];
    data?: {
      attempted: number;
      correct: number;
      incorrect: number;
      skipped?: number;
      score: number;
      maxScore?: number;
      timeMinutes?: number;
      weakTopics: string[];
    };
  } => {
    const errors: string[] = [];

    // Attempted questions
    if (!attemptedCount.trim()) {
      errors.push('Please enter the number of questions attempted.');
    }
    const attemptedNum = Number(attemptedCount.trim());
    if (isNaN(attemptedNum) || !Number.isInteger(attemptedNum) || attemptedNum < 0) {
      errors.push('Questions attempted must be a non-negative whole integer.');
    }

    // Correct questions
    if (!correctCount.trim()) {
      errors.push('Please enter the number of correct questions.');
    }
    const correctNum = Number(correctCount.trim());
    if (isNaN(correctNum) || !Number.isInteger(correctNum) || correctNum < 0) {
      errors.push('Correct questions must be a non-negative whole integer.');
    }

    // Incorrect questions
    if (!incorrectCount.trim()) {
      errors.push('Please enter the number of incorrect questions.');
    }
    const incorrectNum = Number(incorrectCount.trim());
    if (isNaN(incorrectNum) || !Number.isInteger(incorrectNum) || incorrectNum < 0) {
      errors.push('Incorrect questions must be a non-negative whole integer.');
    }

    // Internal consistency: correct + incorrect must not exceed attempted
    if (!isNaN(attemptedNum)) {
      if (!isNaN(correctNum) && correctNum > attemptedNum) {
        errors.push(`Correct answers (${correctNum}) cannot exceed questions attempted (${attemptedNum}).`);
      }
      if (!isNaN(incorrectNum) && incorrectNum > attemptedNum) {
        errors.push(`Incorrect answers (${incorrectNum}) cannot exceed questions attempted (${attemptedNum}).`);
      }
      if (!isNaN(correctNum) && !isNaN(incorrectNum) && correctNum + incorrectNum > attemptedNum) {
        errors.push(
          `Correct (${correctNum}) + Incorrect (${incorrectNum}) = ${
            correctNum + incorrectNum
          }, which exceeds total attempted (${attemptedNum}).`
        );
      }
    }

    // Skipped questions (optional)
    let skippedNum: number | undefined = undefined;
    if (skippedCount.trim()) {
      skippedNum = Number(skippedCount.trim());
      if (isNaN(skippedNum) || !Number.isInteger(skippedNum) || skippedNum < 0) {
        errors.push('Skipped questions must be a non-negative whole integer if provided.');
      }
    }

    // Check paper known question limit if available
    const paperLink = activeModalYear !== null ? PYQ_PAPER_LINKS.find((p) => p.year === activeModalYear) : undefined;
    if (paperLink?.totalQuestions && !isNaN(attemptedNum)) {
      const combined = attemptedNum + (skippedNum ?? 0);
      if (combined > paperLink.totalQuestions) {
        errors.push(
          `Attempted (${attemptedNum}) + Skipped (${skippedNum ?? 0}) = ${combined}, which exceeds known total questions (${paperLink.totalQuestions}) for ${activeModalYear}.`
        );
      }
    }

    // Score validation
    if (!scoreVal.trim()) {
      errors.push('Please enter the marks/score obtained.');
    }
    const scoreNum = Number(scoreVal.trim());
    if (isNaN(scoreNum)) {
      errors.push('Score must be a valid number.');
    } else if (scoreNum < 0) {
      errors.push('Marks obtained cannot be negative.');
    }

    // Max score (optional)
    let maxScoreNum: number | undefined = undefined;
    if (maxScoreVal.trim()) {
      maxScoreNum = Number(maxScoreVal.trim());
      if (isNaN(maxScoreNum) || maxScoreNum <= 0) {
        errors.push('Maximum marks must be a positive number if provided.');
      } else if (!isNaN(scoreNum) && scoreNum > maxScoreNum) {
        errors.push(`Marks obtained (${scoreNum}) cannot exceed maximum marks (${maxScoreNum}).`);
      }
    }

    // Time taken (optional, must be positive if supplied)
    let timeNum: number | undefined = undefined;
    if (timeMinutes.trim()) {
      timeNum = Number(timeMinutes.trim());
      if (isNaN(timeNum) || timeNum <= 0) {
        errors.push('Time taken must be a positive number of minutes if provided.');
      }
    }

    // Date
    if (!attemptDate || !/^\d{4}-\d{2}-\d{2}$/.test(attemptDate) || isNaN(new Date(attemptDate).getTime())) {
      errors.push('Please specify a valid attempt date (YYYY-MM-DD).');
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    const weakTopics = weakTopicsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      isValid: true,
      errors: [],
      data: {
        attempted: attemptedNum,
        correct: correctNum,
        incorrect: incorrectNum,
        skipped: skippedNum,
        score: scoreNum,
        maxScore: maxScoreNum,
        timeMinutes: timeNum,
        weakTopics,
      },
    };
  };

  const handleSaveAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeModalYear === null) return;

    const validation = validateForm();
    if (!validation.isValid || !validation.data) {
      setValidationErrors(validation.errors);
      return;
    }

    const { attempted, correct, incorrect, skipped, score, maxScore, timeMinutes: time, weakTopics } = validation.data;
    const subjectId = selectedSubjectId ? (selectedSubjectId as SubjectId) : undefined;
    const topicId = selectedTopicId || undefined;

    if (modalMode === 'edit' && editingAttemptId) {
      // Edit existing attempt without duplicating
      updatePYQPaperAttempt(activeModalYear, editingAttemptId, {
        date: attemptDate,
        attempted,
        correct,
        incorrect,
        skipped,
        score,
        maxScore,
        timeMinutes: time,
        notes: mistakesNotes,
        weakTopics,
        subjectId,
        topicId,
      });
    } else {
      // Add new attempt appending to attempt history
      recordPYQPaperAttempt(
        activeModalYear,
        {
          date: attemptDate,
          attempted,
          correct,
          incorrect,
          skipped,
          score,
          maxScore,
          timeMinutes: time,
          notes: mistakesNotes,
          weakTopics,
          subjectId,
          topicId,
        },
        true
      );
    }

    setActiveModalYear(null);
  };

  const handleConfirmSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (scheduleModalYear === null) return;

    const parsedMins = scheduleDurationMinutes.trim() ? Number(scheduleDurationMinutes.trim()) : 120;
    const duration = isNaN(parsedMins) || parsedMins <= 0 ? 120 : parsedMins;
    const subject = scheduleSubjectId ? (scheduleSubjectId as SubjectId) : undefined;

    schedulePYQPaperTask(scheduleModalYear, scheduledTargetDate, {
      targetMinutes: duration,
      subjectId: subject,
      customNotes: scheduleCustomNotes.trim() || undefined,
    });
    setScheduleSuccessMsg(`Scheduled NIMCET ${scheduleModalYear} paper for ${scheduledTargetDate}`);
    setTimeout(() => {
      setScheduleSuccessMsg(null);
      setScheduleModalYear(null);
    }, 1500);
  };

  // Filter & Sort Logic
  const filteredPapers = PYQ_PAPER_LINKS.filter((paper) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (!String(paper.year).includes(q)) {
        return false;
      }
    }

    // Status filter
    const record = pyqPaperRecords[paper.year];
    const status = record?.status || 'not_started';
    if (statusFilter !== 'all' && status !== statusFilter) {
      return false;
    }

    return true;
  }).sort((a, b) => {
    if (sortOrder === 'newest') return b.year - a.year;
    if (sortOrder === 'oldest') return a.year - b.year;
    if (sortOrder === 'status') {
      const rank: Record<PYQPaperStatus, number> = {
        practised: 3,
        in_progress: 2,
        not_started: 1,
      };
      const stA = pyqPaperRecords[a.year]?.status || 'not_started';
      const stB = pyqPaperRecords[b.year]?.status || 'not_started';
      return rank[stB] - rank[stA] || b.year - a.year;
    }
    return b.year - a.year;
  });

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* 1. Header Banner & Dynamic Practice Analytics */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <GraduationCap className="h-4 w-4" />
              <span>External PYQ Links — MyAspireStudy (16 Papers: 2011–2026)</span>
            </div>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              NIMCET Previous-Year Questions Library
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Direct links to external practice papers on MyAspireStudy. Note: These provide links to external resources; PrepPilot does not claim to have verified complete paper contents of external destination pages. Record your real attempt results, analyze mistakes, and create targeted revision tasks.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-center dark:border-slate-800 dark:bg-slate-950">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Coverage</span>
              <div className="text-base font-bold text-slate-900 dark:text-white font-mono">
                2011–2026
              </div>
              <div className="text-[10px] text-slate-500">{pyqPapersTotalCount} Available</div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-center dark:border-emerald-900/60 dark:bg-emerald-950/40">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold tracking-wider">Practised</span>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                {pyqPapersPractisedCount} Papers
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400">Practised</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-center dark:border-slate-800 dark:bg-slate-950">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Remaining</span>
              <div className="text-base font-bold text-slate-900 dark:text-white font-mono">
                {pyqPapersRemainingCount}
              </div>
              <div className="text-[10px] text-slate-500">To Attempt</div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3.5 text-center dark:border-blue-900/60 dark:bg-blue-950/40">
              <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold tracking-wider">Completion</span>
              <div className="text-base font-bold text-blue-700 dark:text-blue-300 font-mono">
                {pyqPapersCompletionPercentage}%
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400">Overall Target</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-slate-700 dark:text-slate-300">
              Full Paper Practice Progress ({pyqPapersPractisedCount} of {pyqPapersTotalCount} Papers Solved)
            </span>
            <span className="font-mono text-blue-600 dark:text-blue-400">{pyqPapersCompletionPercentage}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
              style={{ width: `${pyqPapersCompletionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Controls Bar: Search, Filters, Sorting & View Toggle */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by year (e.g. 2024)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Filters & Sorting */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Status filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All (16)
            </button>
            <button
              onClick={() => setStatusFilter('not_started')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                statusFilter === 'not_started'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Not Started
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                statusFilter === 'in_progress'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setStatusFilter('practised')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                statusFilter === 'practised'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Practised
            </button>
          </div>

          {/* Sort order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="newest">Newest First (2026 &rarr; 2011)</option>
            <option value="oldest">Oldest First (2011 &rarr; 2026)</option>
            <option value="status">By Practice Status</option>
          </select>

          {/* Grid / List switch */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-lg p-1.5 text-slate-600 transition-colors ${
                viewMode === 'grid' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-lg p-1.5 text-slate-600 transition-colors ${
                viewMode === 'list' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              title="List View"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Empty State if filter yields no cards */}
      {filteredPapers.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <BookMarked className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
            No Previous-Year Papers Found
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            No papers matched your search query &quot;{searchQuery}&quot; or status filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* 4. Papers Grid / List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPapers.map((paper) => {
            const record = pyqPaperRecords[paper.year];
            const status = record?.status || 'not_started';
            const isPractised = status === 'practised';
            const isInProgress = status === 'in_progress';
            const latestAttempt = record?.attempts[0];

            return (
              <div
                key={paper.year}
                className={`flex flex-col justify-between rounded-3xl border p-5 transition-all shadow-2xs ${
                  isPractised
                    ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                    : isInProgress
                    ? 'border-blue-200 bg-blue-50/20 dark:border-blue-900/40 dark:bg-blue-950/20'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <div>
                  {/* Top Year & Status Pill */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xl font-black text-slate-900 dark:text-white">
                      NIMCET {paper.year}
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                        isPractised
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : isInProgress
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {isPractised ? 'Practised' : isInProgress ? 'In Progress' : 'Not Started'}
                    </span>
                  </div>

                  {/* Provider label & question details */}
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1 text-[11px]">
                      <span>Resource:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {paper.provider}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] font-mono text-slate-400">
                      {paper.totalQuestions ? (
                        <>
                          <span>{paper.totalQuestions} Questions</span>
                          <span>&bull;</span>
                        </>
                      ) : null}
                      <span>External Resource Link</span>
                    </div>
                  </div>

                  {/* Recorded Practice Results if any */}
                  {latestAttempt && (
                    <div className="mt-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Last Attempt:</span>
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {latestAttempt.date}
                        </span>
                      </div>
                      {latestAttempt.score !== undefined && (
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Score:</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {latestAttempt.score}
                            {latestAttempt.maxScore ? ` / ${latestAttempt.maxScore}` : ' marks'}
                          </span>
                        </div>
                      )}
                      {latestAttempt.attempted !== undefined && (
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Breakdown:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {latestAttempt.correct ?? 0}C / {latestAttempt.incorrect ?? 0}I
                            {latestAttempt.skipped !== undefined ? ` / ${latestAttempt.skipped}S` : ''}
                            {` (${latestAttempt.attempted} att)`}
                          </span>
                        </div>
                      )}
                      {latestAttempt.attempted !== undefined && latestAttempt.attempted > 0 && (
                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Accuracy:</span>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {Math.round(((latestAttempt.correct || 0) / latestAttempt.attempted) * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="mt-5 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {/* Primary: Open PYQs in safe external tab */}
                  <button
                    onClick={() => handleOpenPaper(paper.year, paper.url)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Open PYQs</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>

                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {/* Add New vs Edit Action */}
                    {latestAttempt ? (
                      <div className="col-span-2 flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditLatestModal(paper.year)}
                          className="flex-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-2 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                        >
                          Edit Latest Attempt
                        </button>
                        <button
                          onClick={() => handleOpenNewAttemptModal(paper.year)}
                          className="rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 py-2 px-2 text-[11px] font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 transition-colors cursor-pointer"
                          title="Record another practice attempt"
                        >
                          + New
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOpenNewAttemptModal(paper.year)}
                        className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-2 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                      >
                        Record Results
                      </button>
                    )}

                    {/* Schedule Task Action (full width if not scheduled) */}
                    <button
                      onClick={() => setScheduleModalYear(paper.year)}
                      className={`${latestAttempt ? 'col-span-2' : ''} rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-2 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors cursor-pointer`}
                    >
                      Schedule Task
                    </button>
                  </div>

                  {/* Direct toggle marked as practised */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-600 dark:text-slate-400 font-medium select-none">
                      <input
                        type="checkbox"
                        checked={isPractised}
                        onChange={(e) => {
                          const newPractised = e.target.checked;
                          if (newPractised) {
                            updatePYQPaperStatus(paper.year, 'practised');
                          } else {
                            // Restore state based on attempt history
                            const hasAttempts = (record?.attempts.length || 0) > 0;
                            updatePYQPaperStatus(paper.year, hasAttempts ? 'in_progress' : 'not_started');
                          }
                        }}
                        className="h-3.5 w-3.5 rounded text-emerald-600 cursor-pointer"
                      />
                      <span>Mark as Practised</span>
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Compact List View for Mobile & Quick Browsing */
        <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800">
          {filteredPapers.map((paper) => {
            const record = pyqPaperRecords[paper.year];
            const status = record?.status || 'not_started';
            const isPractised = status === 'practised';
            const latestAttempt = record?.attempts[0];

            return (
              <div
                key={paper.year}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 font-mono text-sm font-bold text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    {paper.year}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        NIMCET {paper.year} Paper
                      </h4>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                          isPractised
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      External resource &bull; {paper.provider}
                      {latestAttempt?.score !== undefined ? ` &bull; Last Score: ${latestAttempt.score}${latestAttempt.maxScore ? `/${latestAttempt.maxScore}` : ''}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {latestAttempt ? (
                    <>
                      <button
                        onClick={() => handleOpenEditLatestModal(paper.year)}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        Edit Latest
                      </button>
                      <button
                        onClick={() => handleOpenNewAttemptModal(paper.year)}
                        className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 cursor-pointer"
                      >
                        + Attempt
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleOpenNewAttemptModal(paper.year)}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Record Results
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenPaper(paper.year, paper.url)}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-xs cursor-pointer"
                  >
                    <span>Open PYQs</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Record Results Modal */}
      {activeModalYear !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <button
              onClick={() => setActiveModalYear(null)}
              className="absolute right-4 top-4 rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {modalMode === 'edit' ? 'Edit Latest Practice Attempt' : 'Record Practice Attempt'} — NIMCET {activeModalYear}
                </h3>
                <p className="text-xs text-slate-500">
                  {modalMode === 'edit'
                    ? 'Updating your most recent recorded attempt. Previous attempts remain preserved.'
                    : 'Enter your actual attempt details. Follow the relevant external paper instructions for question counts.'}
                </p>
              </div>
            </div>

            {/* Validation errors banner */}
            {validationErrors.length > 0 && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <span>Please resolve the following before saving:</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleSaveAttempt} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date Practised <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={attemptDate}
                    onChange={(e) => setAttemptDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Time Taken (Minutes) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 120"
                    value={timeMinutes}
                    onChange={(e) => setTimeMinutes(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Attempted <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 105"
                    value={attemptedCount}
                    onChange={(e) => setAttemptedCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Correct <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 88"
                    value={correctCount}
                    onChange={(e) => setCorrectCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Incorrect <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 17"
                    value={incorrectCount}
                    onChange={(e) => setIncorrectCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Skipped <span className="text-slate-400 font-normal">(Opt)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 15"
                    value={skippedCount}
                    onChange={(e) => setSkippedCount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Marks Obtained <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 420"
                    value={scoreVal}
                    onChange={(e) => setScoreVal(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Maximum Marks <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 1000"
                    value={maxScoreVal}
                    onChange={(e) => setMaxScoreVal(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mistake Notes &amp; Observations
                </label>
                <textarea
                  rows={2}
                  placeholder="Record what went wrong, time management notes, formula lapses..."
                  value={mistakesNotes}
                  onChange={(e) => setMistakesNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Revision Task Linkage */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  Revision Task Linkage (Optional)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Target Subject
                    </label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => {
                        setSelectedSubjectId(e.target.value as SubjectId | '');
                        setSelectedTopicId('');
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">General PYQ Review (No Subject)</option>
                      {subjects.map((subj) => (
                        <option key={subj.id} value={subj.id}>
                          {subj.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Syllabus Topic Link
                    </label>
                    <select
                      value={selectedTopicId}
                      onChange={(e) => setSelectedTopicId(e.target.value)}
                      disabled={!selectedSubjectId}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">None / Custom weak topics below</option>
                      {availableTopics.map((top) => (
                        <option key={top.id} value={top.id}>
                          {top.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Specific Weak Topics (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Coordinate Geometry, Vectors, Syllogisms"
                    value={weakTopicsInput}
                    onChange={(e) => setWeakTopicsInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    PrepPilot creates an automatic revision task for these topics without duplicates, linked to syllabus and revision centre.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModalYear(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>{modalMode === 'edit' ? 'Update Attempt' : 'Save Attempt & Mark Practised'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Schedule Task Modal */}
      {scheduleModalYear !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setScheduleModalYear(null)}
              className="absolute right-4 top-4 rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Schedule NIMCET {scheduleModalYear} Paper
                </h3>
                <p className="text-[11px] text-slate-500">
                  Add this paper to your preparation to-do calendar
                </p>
              </div>
            </div>

            {scheduleSuccessMsg ? (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold text-center border border-emerald-200 dark:border-emerald-800">
                {scheduleSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleConfirmSchedule} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Practice Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduledTargetDate}
                    onChange={(e) => setScheduledTargetDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Subject <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={scheduleSubjectId}
                    onChange={(e) => setScheduleSubjectId(e.target.value as SubjectId | '')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">General PYQ Practice (No Subject)</option>
                    {subjects.map((subj) => (
                      <option key={subj.id} value={subj.id}>
                        {subj.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Duration (Minutes) <span className="text-slate-400 font-normal">(Default: 120 mins &bull; editable)</span>
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="5"
                    placeholder="e.g. 120"
                    value={scheduleDurationMinutes}
                    onChange={(e) => setScheduleDurationMinutes(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Custom Notes <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Focus on speed and review unattempted questions afterward"
                    value={scheduleCustomNotes}
                    onChange={(e) => setScheduleCustomNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setScheduleModalYear(null)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-bold text-white shadow-xs"
                  >
                    Add to Tasks
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
