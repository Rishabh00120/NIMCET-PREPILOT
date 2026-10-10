import { TimetableSlot, SubjectId } from '../types';

export const DEFAULT_TIMETABLE_SLOTS: TimetableSlot[] = [
  {
    id: 'slot-1',
    startTime: '14:00',
    endTime: '15:30',
    activity: 'Mathematics: concepts and worked examples',
    subjectId: 'maths',
    isBreak: false,
    dayPattern: 'daily',
  },
  {
    id: 'slot-2',
    startTime: '15:30',
    endTime: '15:45',
    activity: 'Break & refresh',
    isBreak: true,
    dayPattern: 'daily',
  },
  {
    id: 'slot-3',
    startTime: '15:45',
    endTime: '17:15',
    activity: 'Mathematics: problem-solving and PYQs',
    subjectId: 'maths',
    isBreak: false,
    dayPattern: 'daily',
  },
  {
    id: 'slot-4',
    startTime: '17:15',
    endTime: '17:30',
    activity: 'Break & hydration',
    isBreak: true,
    dayPattern: 'daily',
  },
  {
    id: 'slot-5',
    startTime: '17:30',
    endTime: '19:00',
    activity: 'Analytical Ability & Logical Reasoning',
    subjectId: 'reasoning',
    isBreak: false,
    dayPattern: 'daily',
  },
  {
    id: 'slot-6',
    startTime: '19:00',
    endTime: '19:15',
    activity: 'Break & snack',
    isBreak: true,
    dayPattern: 'daily',
  },
  {
    id: 'slot-7',
    startTime: '19:15',
    endTime: '20:15',
    activity: 'Rotate: Computer Awareness (Mon/Wed/Fri) / General English (Tue/Thu/Sat/Sun)',
    subjectId: 'computer', // dynamically rotated based on day
    isBreak: false,
    dayPattern: 'daily',
  },
  {
    id: 'slot-8',
    startTime: '20:15',
    endTime: '20:45',
    activity: 'Chapter checklist, assigned practice, or test analysis',
    isBreak: false,
    dayPattern: 'daily',
  },
  {
    id: 'slot-9',
    startTime: '20:45',
    endTime: '21:00',
    activity: 'Plan tomorrow and update study log',
    isBreak: false,
    dayPattern: 'daily',
  },
  {
    id: 'slot-10',
    startTime: '21:00',
    endTime: '23:00',
    activity: 'Free time, dinner, and rest',
    isBreak: true,
    dayPattern: 'daily',
  },
  {
    id: 'slot-11',
    startTime: '23:00',
    endTime: '23:30',
    activity: 'Revise material studied today',
    isBreak: false,
    dayPattern: 'daily',
  },
  {
    id: 'slot-12',
    startTime: '23:30',
    endTime: '00:00',
    activity: 'Spaced revision, flashcards, formulas, or error log',
    isBreak: false,
    dayPattern: 'daily',
  },
];

export function getRotatedSubjectForDate(dateStr: string): { subjectId: SubjectId; label: string } {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday, etc.
  // Mon (1), Wed (3), Fri (5) => Computer Awareness
  // Tue (2), Thu (4), Sat (6), Sun (0) => General English
  if (day === 1 || day === 3 || day === 5) {
    return { subjectId: 'computer', label: 'Computer Awareness (MWF rotation)' };
  } else {
    return { subjectId: 'english', label: 'General English (TTS rotation)' };
  }
}
