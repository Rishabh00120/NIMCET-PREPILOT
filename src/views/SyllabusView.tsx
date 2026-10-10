import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  Filter,
  AlertCircle,
  Clock,
  Sparkles,
  HelpCircle,
  Calendar,
  Layers,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SubjectId, SyllabusTopic, PriorityLevel } from '../types';

export const SyllabusView: React.FC = () => {
  const {
    subjects,
    toggleTopicCompletion,
    setSelectedTopicForModal,
    addTopic,
    subjectStats,
    allTrackableTopics,
  } = useApp();

  const [activeTab, setActiveTab] = useState<SubjectId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'incomplete' | 'completed' | 'overdue' | 'high_priority'>('all');
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});

  // Quick custom topic modal state
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customSubjectId, setCustomSubjectId] = useState<SubjectId>('maths');
  const [customChapterId, setCustomChapterId] = useState<string>('');
  const [customTopicTitle, setCustomTopicTitle] = useState('');
  const [customPriority, setCustomPriority] = useState<PriorityLevel>('medium');

  // Toggle chapter collapse
  const toggleChapter = (chapterId: string) => {
    setCollapsedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  // Expand all / collapse all
  const expandAll = () => setCollapsedChapters({});
  const collapseAll = () => {
    const allIds: Record<string, boolean> = {};
    subjects.forEach((s) => s.chapters.forEach((c) => (allIds[c.id] = true)));
    setCollapsedChapters(allIds);
  };

  // Filtered subjects & chapters
  const filteredSubjects = useMemo(() => {
    return subjects
      .filter((s) => activeTab === 'all' || s.id === activeTab)
      .map((subj) => {
        const filteredChapters = subj.chapters
          .map((chap) => {
            const filteredTopics = chap.topics.filter((topic) => {
              // Search query
              if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesTitle = topic.title.toLowerCase().includes(q);
                const matchesNotes = topic.notes.toLowerCase().includes(q);
                if (!matchesTitle && !matchesNotes) return false;
              }

              // Filter status
              if (filterStatus === 'incomplete' && topic.completed) return false;
              if (filterStatus === 'completed' && !topic.completed) return false;
              if (filterStatus === 'overdue' && (topic.completed || topic.status !== 'overdue')) return false;
              if (filterStatus === 'high_priority' && topic.priority !== 'high' && topic.priority !== 'urgent') return false;

              return true;
            });

            return {
              ...chap,
              topics: filteredTopics,
            };
          })
          .filter((chap) => chap.topics.length > 0 || !searchQuery.trim());

        return {
          ...subj,
          chapters: filteredChapters,
        };
      });
  }, [subjects, activeTab, searchQuery, filterStatus]);

  // Handle adding custom topic
  const handleAddTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTopicTitle.trim()) return;

    const targetSubject = subjects.find((s) => s.id === customSubjectId);
    const chapterToUse = customChapterId || (targetSubject?.chapters[0]?.id || '');
    if (!chapterToUse) return;

    addTopic(customSubjectId, chapterToUse, customTopicTitle.trim(), customPriority);
    setCustomTopicTitle('');
    setShowAddCustom(false);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header & Subject Tabs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Official NIMCET 2027 Syllabus Checklist
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Hierarchical tracker for all 90 atomic examination topics with question-solving records & revision dates
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const sub = subjects.find((s) => s.id === (activeTab === 'all' ? 'maths' : activeTab));
                setCustomSubjectId(sub ? sub.id : 'maths');
                setCustomChapterId(sub?.chapters[0]?.id || '');
                setShowAddCustom(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Custom Topic</span>
            </button>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            All Subjects ({allTrackableTopics.length})
          </button>

          {subjects.map((s) => {
            const stat = subjectStats[s.id];
            const isActive = activeTab === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <span>{s.name}</span>
                <span className={`rounded-md px-1.5 py-0.2 text-[10px] font-mono tabular-nums ${
                  isActive ? 'bg-blue-700 text-white' : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {stat?.percentage || 0}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search topic title, concepts, formulas, or personal notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-950/60 dark:text-white"
          />
        </div>

        {/* Filter Segmented Control */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterStatus('all')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              filterStatus === 'all'
                ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('incomplete')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              filterStatus === 'incomplete'
                ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Incomplete
          </button>
          <button
            onClick={() => setFilterStatus('overdue')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              filterStatus === 'overdue'
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Overdue
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              filterStatus === 'completed'
                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilterStatus('high_priority')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              filterStatus === 'high_priority'
                ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            High Priority
          </button>

          <span className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

          <button
            onClick={expandAll}
            className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* 3. Syllabus Subject & Chapters Tree */}
      <div className="space-y-6">
        {filteredSubjects.map((subj) => (
          <div key={subj.id} className="space-y-4">
            {/* Subject Section Title */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-xs"
                  style={{ backgroundColor: subj.color }}
                />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {subj.name}
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ({subj.questionWeight} Questions &bull; {subj.chapters.length} Chapters)
                </span>
              </div>

              <div className="text-xs font-mono tabular-nums text-slate-500">
                {subjectStats[subj.id]?.completedTopics} / {subjectStats[subj.id]?.totalTopics} done
              </div>
            </div>

            {/* Chapters */}
            <div className="space-y-3">
              {subj.chapters.map((chap) => {
                const isCollapsed = collapsedChapters[chap.id];
                const chapCompletedCount = chap.topics.filter((t) => t.completed).length;
                const chapTotalCount = chap.topics.length;
                const chapPct = chapTotalCount > 0 ? Math.round((chapCompletedCount / chapTotalCount) * 100) : 0;

                return (
                  <div
                    key={chap.id}
                    className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
                  >
                    {/* Chapter Header */}
                    <div
                      onClick={() => toggleChapter(chap.id)}
                      className="flex cursor-pointer items-center justify-between bg-slate-50/70 px-4 py-3 hover:bg-slate-100/60 transition-colors dark:bg-slate-950/40 dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center gap-2.5">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {chap.title}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          ({chapTotalCount} topics)
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 w-28">
                          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${chapPct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                            {chapPct}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Chapter Topics Table */}
                    {!isCollapsed && (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {chap.topics.length === 0 ? (
                          <div className="py-4 text-center text-xs text-slate-400">
                            No topics match the current filter.
                          </div>
                        ) : (
                          chap.topics.map((topic) => {
                            const isOverdue = !topic.completed && topic.status === 'overdue';

                            return (
                              <div
                                key={topic.id}
                                className={`flex items-start sm:items-center justify-between p-3.5 transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/30 ${
                                  topic.completed ? 'bg-slate-50/30 dark:bg-slate-950/20' : ''
                                }`}
                              >
                                {/* Left: Checkbox & Title */}
                                <div className="flex items-start gap-3 min-w-0 flex-1 pr-4">
                                  <input
                                    type="checkbox"
                                    checked={topic.completed}
                                    onChange={() => toggleTopicCompletion(topic.id)}
                                    className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer dark:border-slate-700 dark:bg-slate-800"
                                    aria-label={`Mark ${topic.title} as completed`}
                                  />

                                  <div
                                    onClick={() => setSelectedTopicForModal(topic)}
                                    className="cursor-pointer min-w-0"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`text-xs font-medium leading-snug ${
                                          topic.completed
                                            ? 'text-slate-400 line-through dark:text-slate-500'
                                            : 'text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400'
                                        }`}
                                      >
                                        {topic.title}
                                      </span>

                                      {isOverdue && (
                                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                          [Overdue]
                                        </span>
                                      )}
                                    </div>

                                    {/* Unboxed Metadata (Zero-Pill Discipline) */}
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                      <span>Target: <strong className="font-mono tabular-nums">{topic.targetCompletionDate}</strong></span>
                                      <span aria-hidden="true">&bull;</span>
                                      <span>Priority: <span className="capitalize">{topic.priority}</span></span>
                                      {topic.questionsSolved > 0 && (
                                        <>
                                          <span aria-hidden="true">&bull;</span>
                                          <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                                            {topic.questionsCorrect}/{topic.questionsSolved} questions ({Math.round((topic.questionsCorrect / topic.questionsSolved) * 100)}%)
                                          </span>
                                        </>
                                      )}
                                      {topic.actualHours > 0 && (
                                        <>
                                          <span aria-hidden="true">&bull;</span>
                                          <span className="font-mono tabular-nums">{topic.actualHours}h spent</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Right: Edit button */}
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => setSelectedTopicForModal(topic)}
                                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  >
                                    Details
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 4. Add Custom Topic Modal */}
      {showAddCustom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Add Custom Topic to NIMCET Syllabus
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Integrate your own supplementary subtopics into your tracking plan
            </p>

            <form onSubmit={handleAddTopicSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject
                </label>
                <select
                  value={customSubjectId}
                  onChange={(e) => {
                    const sid = e.target.value as SubjectId;
                    setCustomSubjectId(sid);
                    const sub = subjects.find((s) => s.id === sid);
                    setCustomChapterId(sub?.chapters[0]?.id || '');
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Chapter
                </label>
                <select
                  value={customChapterId}
                  onChange={(e) => setCustomChapterId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {subjects
                    .find((s) => s.id === customSubjectId)
                    ?.chapters.map((ch) => (
                      <option key={ch.id} value={ch.id}>{ch.title}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Topic Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advanced Trigonometric Series Summations"
                  value={customTopicTitle}
                  onChange={(e) => setCustomTopicTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  value={customPriority}
                  onChange={(e) => setCustomPriority(e.target.value as PriorityLevel)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Add Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
