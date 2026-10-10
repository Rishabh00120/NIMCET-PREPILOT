import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Clock, HelpCircle, Save, Calendar, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SyllabusTopic, PriorityLevel, TopicStatus } from '../types';

export const TopicDetailModal: React.FC = () => {
  const { selectedTopicForModal, setSelectedTopicForModal, updateTopic, addRevisionScheduleForTopic } = useApp();

  const [formData, setFormData] = useState<SyllabusTopic | null>(null);

  useEffect(() => {
    if (selectedTopicForModal) {
      setFormData({ ...selectedTopicForModal });
    } else {
      setFormData(null);
    }
  }, [selectedTopicForModal]);

  if (!formData || !selectedTopicForModal) return null;

  const handleSave = () => {
    updateTopic(formData.id, formData);
    setSelectedTopicForModal(null);
  };

  const handleStartRevision = () => {
    addRevisionScheduleForTopic(formData);
    setSelectedTopicForModal(null);
  };

  const accuracy = formData.questionsSolved > 0 
    ? Math.round((formData.questionsCorrect / formData.questionsSolved) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              {formData.subjectId} &bull; Chapter Topic
            </span>
            <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white leading-snug">
              {formData.title}
            </h3>
          </div>
          <button
            onClick={() => setSelectedTopicForModal(null)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Completion Status
              </label>
              <select
                value={formData.completed ? 'completed' : formData.status}
                onChange={(e) => {
                  const val = e.target.value as TopicStatus;
                  const isDone = val === 'completed';
                  setFormData({
                    ...formData,
                    status: val,
                    completed: isDone,
                  });
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Priority Level
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as PriorityLevel })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Dates & Assigned Month */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Planned Start Date
              </label>
              <input
                type="date"
                value={formData.plannedStartDate}
                onChange={(e) => setFormData({ ...formData, plannedStartDate: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Completion Date
              </label>
              <input
                type="date"
                value={formData.targetCompletionDate}
                onChange={(e) => setFormData({ ...formData, targetCompletionDate: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Study Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Estimated Hours
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.estimatedHours}
                onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Actual Hours Spent
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={formData.actualHours}
                onChange={(e) => setFormData({ ...formData, actualHours: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Practice Questions & Accuracy */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                Practice Questions Record
              </span>
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                Accuracy: {accuracy}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Questions Solved</label>
                <input
                  type="number"
                  min="0"
                  value={formData.questionsSolved}
                  onChange={(e) => setFormData({ ...formData, questionsSolved: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Correct Answers</label>
                <input
                  type="number"
                  min="0"
                  max={formData.questionsSolved}
                  value={formData.questionsCorrect}
                  onChange={(e) => setFormData({ ...formData, questionsCorrect: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Personal Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Personal Study Notes & Key Formulas
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Important tricks, common traps, formula shortcuts..."
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white leading-relaxed"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-950">
          <button
            type="button"
            onClick={handleStartRevision}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Generate Spaced Revision Cycle</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedTopicForModal(null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
