export type SubjectId = 'maths' | 'reasoning' | 'computer' | 'english';

export type TopicStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

export interface SyllabusTopic {
  id: string;
  subjectId: SubjectId;
  chapterId: string;
  title: string;
  completed: boolean;
  status: TopicStatus;
  plannedStartDate: string; // YYYY-MM-DD
  targetCompletionDate: string; // YYYY-MM-DD
  assignedMonth: string; // YYYY-MM e.g. "2026-10"
  priority: PriorityLevel;
  notes: string;
  estimatedHours: number;
  actualHours: number;
  questionsSolved: number;
  questionsCorrect: number;
  lastRevisionDate?: string;
  nextRevisionDate?: string;
  completedAt?: string;
}

export interface SyllabusChapter {
  id: string;
  subjectId: SubjectId;
  title: string;
  order: number;
  topics: SyllabusTopic[];
}

export interface SyllabusSubject {
  id: SubjectId;
  name: string;
  shortName: string;
  questionWeight: number; // NIMCET exam questions (Maths: 50, Reasoning: 40, Computer: 20, English: 10)
  marksPerQuestion: number; // e.g. Maths: 12 marks (or 600 total scale)
  color: string;
  chapters: SyllabusChapter[];
}

export type TaskType = 
  | 'Learn' 
  | 'Practise' 
  | 'Practice'
  | 'PYQ' 
  | 'Revise' 
  | 'Sectional Test' 
  | 'Full Mock' 
  | 'Review Mistakes';

export interface TaskItem {
  id: string;
  title: string;
  subjectId?: SubjectId;
  chapterId?: string;
  topicId?: string;
  taskType: TaskType;
  startDate: string; // YYYY-MM-DD
  deadline: string; // YYYY-MM-DD
  priority: PriorityLevel;
  status: 'pending' | 'completed';
  estimatedMinutes: number;
  actualMinutes: number;
  notes: string;
  completedAt?: string;
  createdAt: string;
}

export interface TimetableSlot {
  id: string;
  startTime: string; // "14:00"
  endTime: string; // "15:30"
  activity: string;
  subjectId?: SubjectId;
  chapterId?: string;
  isBreak?: boolean;
  dayPattern?: 'daily' | 'mwf' | 'tts'; // rotational support
}

export interface LoggedStudySession {
  id: string;
  date: string; // YYYY-MM-DD
  slotId: string;
  startTime: string;
  endTime: string;
  activity: string;
  subjectId?: SubjectId;
  chapterId?: string;
  topicId?: string;
  status: 'completed' | 'skipped' | 'partially_completed';
  plannedMinutes: number;
  actualMinutes: number;
  notes: string;
  loggedAt: string;
}

export interface PYQEntry {
  id: string;
  date: string; // YYYY-MM-DD
  yearOrPaper: string; // e.g. "NIMCET 2024", "NIMCET 2023 Paper", "Book Ch 3 PYQs"
  subjectId: SubjectId;
  topic: string;
  questionRange: string; // e.g. "Q1 - Q25"
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  timeMinutes: number;
  mistakesNotes: string;
  needsRedo: boolean;
  createdAt: string;
}

export type MockTestType = 'topic_quiz' | 'chapter_test' | 'sectional' | 'full_mock';

export interface MockTest {
  id: string;
  testName: string;
  provider: string; // e.g. "Online Test Series Provider", "Self-timed Mock"
  testType: MockTestType;
  scheduledDate: string; // YYYY-MM-DD
  completedDate?: string; // YYYY-MM-DD
  completed: boolean;
  score: number;
  maxMarks: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  subjectScores?: Partial<Record<SubjectId, number>>;
  timeObservations: string;
  weakTopics: string[];
  followUpTasks: string[];
  retestDate?: string;
}

export type MistakeCategory = 
  | 'conceptual'
  | 'formula'
  | 'calculation'
  | 'misread'
  | 'time_pressure'
  | 'guess'
  | 'careless';

export interface ErrorLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  subjectId: SubjectId;
  topic: string;
  questionRef: string;
  mistakeCategory: MistakeCategory;
  notes: string;
  needsRedo: boolean;
  resolved: boolean;
  resolvedAt?: string;
}

export interface SpacedRevisionItem {
  id: string;
  topicId: string;
  topicTitle: string;
  subjectId: SubjectId;
  studiedDate: string;
  intervals: {
    stage: 'Same Day' | '1 Day' | '3 Days' | '7 Days' | '14 Days' | '30 Days';
    targetDate: string;
    completed: boolean;
    completedAt?: string;
  }[];
  notes: string;
}

export interface MonthlyGoal {
  monthKey: string; // "2026-10" to "2027-05"
  name: string;
  phase: string;
  focusSummary: string;
  plannedTopicsCount: number;
  targetHours: number;
  targetQuestions: number;
  targetTests: number;
  isReviewed: boolean;
  userNotes: string;
  provisional?: boolean;
}

export interface AppNotification {
  id: string;
  type: 'deadline_passed' | 'monthly_milestone' | 'task_due_today' | 'session_missed' | 'behind_pace' | 'revision_due';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  dismissed: boolean;
  snoozedUntil?: string;
  actionUrl?: string;
}

export type BadgeId = 
  | 'first_step' 
  | 'first_chapter' 
  | 'streak_7' 
  | 'pyq_100' 
  | 'first_mock' 
  | 'month_target' 
  | 'math_dynamo' 
  | 'logic_sensei';

export interface Badge {
  id: BadgeId;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
  xpReward: number;
}

export interface PreparationLevel {
  level: number;
  title: string;
  minXP: number;
  maxXP: number;
}

export interface FocusSessionState {
  isActive: boolean;
  isPaused: boolean;
  mode: 'focus' | 'break';
  durationSeconds: number; // e.g. 25 * 60
  remainingSeconds: number;
  selectedTopicId?: string;
  selectedTaskId?: string;
  startedAt?: string;
  sessionsCompletedToday: number;
}

export interface UserConfig {
  examName: string;
  startDate: string;
  targetExamMonth: string;
  exactExamDate: string | null; // e.g. "2027-05-23" or null
  timezone: string;
  primaryStudyWindow: string;
  revisionWindow: string;
  inAppRemindersEnabled: boolean;
  notificationsEnabled: boolean;
  browserPermissionRequested: boolean;
  notificationFrequency: 'all' | 'daily_summary' | 'urgent_only';
  notificationsPaused: boolean;
  weightingMethod: 'unweighted_topics' | 'nimcet_exam_weight';
  firstRunCompleted: boolean;
  fcmToken?: string | null;
  firebaseConnected?: boolean;
}

export type NavSection = 
  | 'dashboard'
  | 'focus'
  | 'syllabus'
  | 'roadmap'
  | 'timetable'
  | 'tasks'
  | 'calendar'
  | 'pyq'
  | 'pyq_library'
  | 'mocks'
  | 'revision'
  | 'analytics'
  | 'settings';

export type PYQPaperStatus = 'not_started' | 'in_progress' | 'practised';

export interface PYQPaperAttempt {
  id: string;
  date: string;
  attempted?: number;
  correct?: number;
  incorrect?: number;
  skipped?: number;
  score?: number;
  maxScore?: number;
  timeMinutes?: number;
  notes?: string;
  weakTopics?: string[];
  subjectId?: SubjectId;
  topicId?: string;
  scheduledRetestDate?: string;
}

export interface PYQPaperRecord {
  year: number; // 2011 - 2026
  status: PYQPaperStatus;
  firstOpenedAt?: string;
  lastPractisedAt?: string;
  attempts: PYQPaperAttempt[];
}
