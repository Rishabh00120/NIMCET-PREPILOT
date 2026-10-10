import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Calendar,
  Plus,
  BookOpen,
  Coffee,
  AlertTriangle,
  Save,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TimetableSlot, LoggedStudySession, SubjectId } from '../types';
import { getRotatedSubjectForDate } from '../data/seedTimetable';

export const DailyTimetableView: React.FC = () => {
  const {
    timetableSlots,
    updateTimetableSlot,
    studySessions,
    logStudySession,
    deleteStudySession,
    subjects,
    allTrackableTopics,
    continueStudying,
    todayDate,
  } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [activeSlotToLog, setActiveSlotToLog] = useState<TimetableSlot | null>(null);

  // Form for logging a session
  const [logStatus, setLogStatus] = useState<'completed' | 'skipped' | 'partially_completed'>('completed');
  const [actualMinutes, setActualMinutes] = useState<number>(90);
  const [linkedTopicId, setLinkedTopicId] = useState<string>('');
  const [sessionNotes, setSessionNotes] = useState<string>('');

  const rotation = getRotatedSubjectForDate(selectedDate);

  // Sessions logged for selectedDate
  const loggedForDate = studySessions.filter((s) => s.date === selectedDate);
  const totalPlannedMins = 8 * 60; // 7h primary + 1h revision = 480 mins (excluding breaks)
  const totalActualMins = loggedForDate.reduce((sum, s) => sum + (s.actualMinutes || 0), 0);

  const openLogDialog = (slot: TimetableSlot) => {
    setActiveSlotToLog(slot);
    // calculate planned minutes from start and end time
    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60; // for 23:30 to 00:00
    setActualMinutes(diff);
    setLogStatus('completed');
    setLinkedTopicId('');
    setSessionNotes('');
  };

  const submitLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSlotToLog) return;

    logStudySession({
      date: selectedDate,
      slotId: activeSlotToLog.id,
      startTime: activeSlotToLog.startTime,
      endTime: activeSlotToLog.endTime,
      activity: activeSlotToLog.activity,
      subjectId: activeSlotToLog.subjectId,
      topicId: linkedTopicId || undefined,
      status: logStatus,
      plannedMinutes: actualMinutes,
      actualMinutes: logStatus === 'skipped' ? 0 : actualMinutes,
      notes: sessionNotes,
    });

    setActiveSlotToLog(null);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header with Daily Controls & Rotation Info */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <Clock className="h-4 w-4" />
              <span>Daily Study Schedule & Session Tracker</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
              Daily Timetable Planner (Asia/Kolkata)
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Primary Window: <strong className="font-mono text-slate-800 dark:text-slate-200">14:00–21:00</strong> &bull; Revision Window: <strong className="font-mono text-slate-800 dark:text-slate-200">23:00–00:00</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950">
              <Calendar className="h-4 w-4 text-slate-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Rotation Banner */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-blue-50/70 p-3.5 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-100 dark:border-blue-900">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              <strong>Evening 19:15 Rotation for today:</strong> {rotation.label}
            </span>
          </div>

          <div className="text-[11px] text-blue-700 dark:text-blue-400">
            MWF: Computer Awareness &bull; TTS: General English
          </div>
        </div>

        {/* Planned vs Actual Strip */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400">Planned Daily Goal:</span>
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
              8.0 hours
            </div>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Actual Logged Today:</span>
            <div className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {Math.round((totalActualMins / 60) * 10) / 10} hours
            </div>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Sessions Logged:</span>
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
              {loggedForDate.length} sessions
            </div>
          </div>
          <div className="flex items-center justify-end">
            <button
              onClick={continueStudying}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
            >
              <Play className="h-3 w-3 fill-white" />
              <span>Next Task</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Timetable Slot Rows */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
          Timetable Schedule for {selectedDate}
        </h2>

        <div className="space-y-3">
          {timetableSlots.map((slot) => {
            const isBreak = slot.isBreak;
            const logEntry = loggedForDate.find((s) => s.slotId === slot.id);

            return (
              <div
                key={slot.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all ${
                  isBreak
                    ? 'border-dashed border-slate-200 bg-slate-50/40 text-slate-500 dark:border-slate-800 dark:bg-slate-950/20'
                    : logEntry
                    ? logEntry.status === 'completed'
                      ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20'
                      : logEntry.status === 'skipped'
                      ? 'border-red-200 bg-red-50/20 dark:border-red-900 dark:bg-red-950/20'
                      : 'border-amber-200 bg-amber-50/20 dark:border-amber-900 dark:bg-amber-950/20'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                {/* Time & Activity */}
                <div className="flex items-start sm:items-center gap-3">
                  <div className="flex h-10 w-28 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-800 tabular-nums dark:bg-slate-800 dark:text-slate-200">
                    {slot.startTime} &ndash; {slot.endTime}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`text-xs font-semibold ${isBreak ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                        {slot.id === 'slot-7'
                          ? `19:15 Rotation: ${rotation.label}`
                          : slot.activity}
                      </h4>
                      {isBreak && <Coffee className="h-3.5 w-3.5 text-slate-400" />}
                    </div>

                    {logEntry && (
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 capitalize">
                          Logged: {logEntry.status}
                        </span>
                        <span>&bull;</span>
                        <span className="font-mono">{logEntry.actualMinutes} mins</span>
                        {logEntry.notes && (
                          <>
                            <span>&bull;</span>
                            <span className="italic">{logEntry.notes}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action button */}
                {!isBreak && (
                  <div className="mt-2 sm:mt-0 flex items-center gap-2">
                    {logEntry ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Logged</span>
                        </span>
                        <button
                          onClick={() => deleteStudySession(logEntry.id)}
                          className="text-slate-400 hover:text-red-600 text-xs p-1"
                          title="Remove session log"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => openLogDialog(slot)}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
                      >
                        Log Study Session
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Log Session Modal Dialog */}
      {activeSlotToLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Log Study Session
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {activeSlotToLog.startTime} &ndash; {activeSlotToLog.endTime}: {activeSlotToLog.activity}
            </p>

            <form onSubmit={submitLog} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Session Outcome
                </label>
                <select
                  value={logStatus}
                  onChange={(e) => setLogStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="completed">Completed Successfully</option>
                  <option value="partially_completed">Partially Completed</option>
                  <option value="skipped">Skipped / Missed</option>
                </select>
              </div>

              {logStatus !== 'skipped' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Actual Minutes Studied
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="5"
                    value={actualMinutes}
                    onChange={(e) => setActualMinutes(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Link to Syllabus Topic (Optional)
                </label>
                <select
                  value={linkedTopicId}
                  onChange={(e) => setLinkedTopicId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">-- No specific topic link --</option>
                  {allTrackableTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      [{topic.subjectId.toUpperCase()}] {topic.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Session Notes & Formulas Covered
                </label>
                <textarea
                  rows={2}
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Notes, difficulty level, questions attempted..."
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveSlotToLog(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-2xs"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
