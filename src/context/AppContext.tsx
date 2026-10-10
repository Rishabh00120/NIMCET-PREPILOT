import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  SubjectId,
  SyllabusSubject,
  SyllabusTopic,
  TaskItem,
  TimetableSlot,
  LoggedStudySession,
  PYQEntry,
  MockTest,
  ErrorLogEntry,
  SpacedRevisionItem,
  MonthlyGoal,
  AppNotification,
  UserConfig,
  NavSection,
  Badge,
  BadgeId,
  PreparationLevel,
  FocusSessionState,
  PYQPaperRecord,
  PYQPaperAttempt,
  PYQPaperStatus,
} from '../types';
import { INITIAL_SYLLABUS_SUBJECTS, getAllTrackableTopics } from '../data/seedSyllabus';
import { INITIAL_MONTHLY_GOALS } from '../data/seedRoadmap';
import { DEFAULT_TIMETABLE_SLOTS } from '../data/seedTimetable';
import { INITIAL_TASKS, INITIAL_MOCK_TESTS } from '../data/seedTasksAndTests';
import { saveToIDB, getFromIDB } from '../services/db';
import {
  DEFAULT_TIMEZONE,
  PREPARATION_START_DATE,
  getTodayDateString,
  addDaysToDateString,
  getDaysDifference,
  isDateInCurrentWeek,
  calculateConsecutiveStudyStreak,
  parseDateAtNoon,
} from '../utils/dateUtils';
import { PYQ_PAPER_LINKS } from '../data/pyqLinks';

const STORAGE_KEY = 'preppilot_nimcet2027_v1';

// Dynamic today date in Asia/Kolkata timezone (evaluated on import, reactive via context todayDate)
export const TODAY_DATE = getTodayDateString(DEFAULT_TIMEZONE);

export const INITIAL_BADGES: Badge[] = [
  {
    id: 'first_step',
    title: 'First Step',
    description: 'Completed your first official syllabus topic',
    icon: 'Flag',
    unlocked: false,
    xpReward: 60,
  },
  {
    id: 'first_chapter',
    title: 'Chapter Conqueror',
    description: 'Mastered all topics in a syllabus chapter',
    icon: 'Award',
    unlocked: false,
    xpReward: 150,
  },
  {
    id: 'streak_7',
    title: 'Consistency Champion',
    description: 'Maintained a 7-day continuous study streak',
    icon: 'Flame',
    unlocked: false,
    xpReward: 200,
  },
  {
    id: 'pyq_100',
    title: 'PYQ Centurion',
    description: 'Solved 100+ Previous Year Questions from your book or papers',
    icon: 'BookMarked',
    unlocked: false,
    xpReward: 250,
  },
  {
    id: 'first_mock',
    title: 'Mock Pioneer',
    description: 'Completed your first full-length mock simulation',
    icon: 'Trophy',
    unlocked: false,
    xpReward: 300,
  },
  {
    id: 'month_target',
    title: 'Monthly Pacesetter',
    description: 'Successfully reached a monthly milestone target',
    icon: 'Target',
    unlocked: false,
    xpReward: 200,
  },
  {
    id: 'math_dynamo',
    title: 'Math Dynamo',
    description: 'Completed 10 core Mathematics topics',
    icon: 'Calculator',
    unlocked: false,
    xpReward: 200,
  },
  {
    id: 'logic_sensei',
    title: 'Logic Sensei',
    description: 'Completed 5 Reasoning & Analytical puzzles topics',
    icon: 'Brain',
    unlocked: false,
    xpReward: 150,
  },
];

export const PREPARATION_LEVELS: PreparationLevel[] = [
  { level: 1, title: 'Novice Aspirant', minXP: 0, maxXP: 300 },
  { level: 2, title: 'Foundation Builder', minXP: 300, maxXP: 800 },
  { level: 3, title: 'Problem Solver', minXP: 800, maxXP: 1800 },
  { level: 4, title: 'Section Specialist', minXP: 1800, maxXP: 3500 },
  { level: 5, title: 'Mock Strategist', minXP: 3500, maxXP: 6000 },
  { level: 6, title: 'NIMCET Contender', minXP: 6000, maxXP: 10000 },
];

interface SubjectStat {
  subjectId: SubjectId;
  name: string;
  shortName: string;
  color: string;
  totalTopics: number;
  completedTopics: number;
  inProgressTopics: number;
  overdueTopics: number;
  percentage: number;
  questionWeight: number;
}

export interface ChapterProgress {
  chapterId: string;
  chapterTitle: string;
  subjectId: SubjectId;
  subjectName: string;
  totalTopics: number;
  completedTopics: number;
  remainingTopics: number;
  percentage: number;
}

interface AppContextType {
  // Navigation & active views
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;
  selectedTopicForModal: SyllabusTopic | null;
  setSelectedTopicForModal: (topic: SyllabusTopic | null) => void;

  // Dynamic Date state (recalculated at midnight and on tab wake)
  todayDate: string;

  // Data
  subjects: SyllabusSubject[];
  tasks: TaskItem[];
  timetableSlots: TimetableSlot[];
  studySessions: LoggedStudySession[];
  pyqEntries: PYQEntry[];
  mockTests: MockTest[];
  errorLogs: ErrorLogEntry[];
  revisionItems: SpacedRevisionItem[];
  monthlyGoals: MonthlyGoal[];
  userConfig: UserConfig;
  notifications: AppNotification[];

  // PYQ Library (2011 - 2026)
  pyqPaperRecords: Record<number, PYQPaperRecord>;
  recordPYQPaperAttempt: (year: number, attempt: Omit<PYQPaperAttempt, 'id'>, markPractised?: boolean) => void;
  updatePYQPaperAttempt: (year: number, attemptId: string, updates: Partial<Omit<PYQPaperAttempt, 'id'>>) => void;
  updatePYQPaperStatus: (year: number, status: PYQPaperStatus) => void;
  markPYQPaperOpened: (year: number) => void;
  schedulePYQPaperTask: (year: number, scheduledDate: string) => void;
  pyqPapersTotalCount: number;
  pyqPapersPractisedCount: number;
  pyqPapersRemainingCount: number;
  pyqPapersCompletionPercentage: number;

  // Computed metrics
  allTrackableTopics: SyllabusTopic[];
  totalTopicsCount: number;
  completedTopicsCount: number;
  inProgressTopicsCount: number;
  remainingTopicsCount: number;
  overdueTopicsCount: number;
  overallCompletionPercentage: number;
  weightedCompletionPercentage: number;
  subjectStats: Record<SubjectId, SubjectStat>;
  studyHoursThisWeek: number;
  totalStudyHoursLogged: number;
  daysRemainingUntilExam: number | null;
  currentStudyStreak: number;
  nextScheduledSession: TimetableSlot | null;
  nextPlannedTest: MockTest | null;
  encouragingMessage: string;

  // Gamification & Milestones
  userXP: number;
  preparationLevel: PreparationLevel;
  badges: Badge[];
  uncelebratedBadge: Badge | null;
  dismissCelebration: () => void;

  // Motivational Panels Data
  almostFinishedChapters: ChapterProgress[];
  todaysTopTasks: TaskItem[];
  recentWeekStudyHeatmap: { date: string; dayName: string; minutes: number; studied: boolean }[];

  // Focus Mode (Pomodoro)
  focusSession: FocusSessionState;
  startFocusSession: (topicId?: string, taskId?: string, durationMins?: number) => void;
  pauseFocusSession: () => void;
  resumeFocusSession: () => void;
  resetFocusSession: () => void;
  completeFocusSession: (overrideMinutes?: number) => void;
  switchFocusMode: (mode: 'focus' | 'break', customDurationMins?: number) => void;
  updateFocusTopicOrTask: (topicId?: string, taskId?: string) => void;

  // Actions
  toggleTopicCompletion: (topicId: string) => void;
  updateTopic: (topicId: string, updates: Partial<SyllabusTopic>) => void;
  addTopic: (subjectId: SubjectId, chapterId: string, title: string, priority?: SyllabusTopic['priority']) => void;
  
  addTask: (task: Omit<TaskItem, 'id' | 'createdAt'>) => void;
  updateTask: (taskId: string, updates: Partial<TaskItem>) => void;
  deleteTask: (taskId: string) => void;
  toggleTaskCompletion: (taskId: string) => void;
  bulkCompleteTasks: (taskIds: string[]) => void;

  updateTimetableSlot: (slotId: string, updates: Partial<TimetableSlot>) => void;
  logStudySession: (session: Omit<LoggedStudySession, 'id' | 'loggedAt'>) => void;
  updateStudySession: (sessionId: string, updates: Partial<LoggedStudySession>) => void;
  deleteStudySession: (sessionId: string) => void;

  addPYQEntry: (entry: Omit<PYQEntry, 'id' | 'createdAt'>) => void;
  updatePYQEntry: (entryId: string, updates: Partial<PYQEntry>) => void;
  deletePYQEntry: (entryId: string) => void;

  addMockTest: (test: Omit<MockTest, 'id'>) => void;
  updateMockTest: (testId: string, updates: Partial<MockTest>) => void;
  deleteMockTest: (testId: string) => void;

  addErrorLog: (log: Omit<ErrorLogEntry, 'id'>) => void;
  updateErrorLog: (logId: string, updates: Partial<ErrorLogEntry>) => void;
  deleteErrorLog: (logId: string) => void;

  addRevisionScheduleForTopic: (topic: SyllabusTopic) => void;
  completeRevisionStage: (revisionId: string, stageIndex: number) => void;

  updateMonthlyGoal: (monthKey: string, updates: Partial<MonthlyGoal>) => void;
  updateUserConfig: (updates: Partial<UserConfig>) => void;

  requestBrowserNotifications: () => Promise<boolean>;
  dismissNotification: (id: string) => void;
  snoozeNotification: (id: string, hours?: number) => void;
  clearAllNotifications: () => void;

  continueStudying: () => void;
  exportBackupJSON: () => void;
  importBackupJSON: (jsonData: string) => boolean;
  resetAllData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const INITIAL_USER_CONFIG: UserConfig = {
  examName: 'NIMCET 2027',
  startDate: PREPARATION_START_DATE, // 10 October 2026
  targetExamMonth: 'May 2027',
  exactExamDate: null,
  timezone: DEFAULT_TIMEZONE, // Asia/Kolkata
  primaryStudyWindow: '14:00–21:00',
  revisionWindow: '23:00–00:00',
  inAppRemindersEnabled: true,
  notificationsEnabled: false, // Default false until explicit user permission
  browserPermissionRequested: false,
  notificationFrequency: 'all',
  notificationsPaused: false,
  weightingMethod: 'unweighted_topics',
  firstRunCompleted: false,
  darkMode: false,
};

const DEFAULT_FOCUS_STATE: FocusSessionState = {
  isActive: false,
  isPaused: false,
  mode: 'focus',
  durationSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  sessionsCompletedToday: 0,
};

function getInitialPYQPaperRecords(): Record<number, PYQPaperRecord> {
  const records: Record<number, PYQPaperRecord> = {};
  for (let year = 2011; year <= 2026; year++) {
    records[year] = {
      year,
      status: 'not_started',
      attempts: [],
    };
  }
  return records;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [selectedTopicForModal, setSelectedTopicForModal] = useState<SyllabusTopic | null>(null);

  // Dynamic todayDate reactive to user timezone and midnight rollover
  const [userConfig, setUserConfig] = useState<UserConfig>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_config`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_USER_CONFIG, ...parsed };
      }
      return INITIAL_USER_CONFIG;
    } catch {
      return INITIAL_USER_CONFIG;
    }
  });

  const [todayDate, setTodayDate] = useState<string>(() =>
    getTodayDateString(userConfig.timezone || DEFAULT_TIMEZONE)
  );

  // Midnight rollover & visibility change listener
  useEffect(() => {
    const tz = userConfig.timezone || DEFAULT_TIMEZONE;
    const checkMidnight = () => {
      const current = getTodayDateString(tz);
      setTodayDate((prev) => (prev !== current ? current : prev));
    };

    const interval = setInterval(checkMidnight, 30000);
    const handleVis = () => {
      if (document.visibilityState === 'visible') {
        checkMidnight();
      }
    };

    window.addEventListener('visibilitychange', handleVis);
    window.addEventListener('focus', checkMidnight);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('focus', checkMidnight);
    };
  }, [userConfig.timezone]);

  // Core State with synchronous localStorage hydration
  const [subjects, setSubjects] = useState<SyllabusSubject[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_subjects`);
      return saved ? JSON.parse(saved) : INITIAL_SYLLABUS_SUBJECTS;
    } catch {
      return INITIAL_SYLLABUS_SUBJECTS;
    }
  });

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_tasks`);
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_slots`);
      return saved ? JSON.parse(saved) : DEFAULT_TIMETABLE_SLOTS;
    } catch {
      return DEFAULT_TIMETABLE_SLOTS;
    }
  });

  const [studySessions, setStudySessions] = useState<LoggedStudySession[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_sessions`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pyqEntries, setPyqEntries] = useState<PYQEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_pyq`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [mockTests, setMockTests] = useState<MockTest[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_mocks`);
      return saved ? JSON.parse(saved) : INITIAL_MOCK_TESTS;
    } catch {
      return INITIAL_MOCK_TESTS;
    }
  });

  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_errors`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [revisionItems, setRevisionItems] = useState<SpacedRevisionItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_revisions`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_roadmap`);
      return saved ? JSON.parse(saved) : INITIAL_MONTHLY_GOALS;
    } catch {
      return INITIAL_MONTHLY_GOALS;
    }
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_notifications`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Gamification: tracked celebrated badges
  const [celebratedBadgeIds, setCelebratedBadgeIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_celebrated_badges`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [uncelebratedBadge, setUncelebratedBadge] = useState<Badge | null>(null);

  // Focus Mode State
  const [focusSession, setFocusSession] = useState<FocusSessionState>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_focus`);
      return saved ? JSON.parse(saved) : DEFAULT_FOCUS_STATE;
    } catch {
      return DEFAULT_FOCUS_STATE;
    }
  });

  // PYQ Paper Records (2011 to 2026)
  const [pyqPaperRecords, setPyqPaperRecords] = useState<Record<number, PYQPaperRecord>>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_pyq_papers`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const initial = getInitialPYQPaperRecords();
        return { ...initial, ...parsed };
      }
      return getInitialPYQPaperRecords();
    } catch {
      return getInitialPYQPaperRecords();
    }
  });

  // Hydration safety flag
  const isHydratedRef = useRef<boolean>(false);

  // Dual-Layer Asynchronous Hydration Recovery:
  // If localStorage was cleared but IndexedDB has a valid saved backup, restore it without overwriting!
  useEffect(() => {
    async function recoverFromIDBIfLocalStorageEmpty() {
      const hasLocalSubjects = Boolean(localStorage.getItem(`${STORAGE_KEY}_subjects`));
      if (!hasLocalSubjects) {
        try {
          const backedUpState = await getFromIDB<any>('app_full_state');
          if (backedUpState && backedUpState.subjects && Array.isArray(backedUpState.subjects)) {
            console.log('Restoring PrepPilot state from durable IndexedDB store...');
            if (backedUpState.subjects) setSubjects(backedUpState.subjects);
            if (backedUpState.tasks) setTasks(backedUpState.tasks);
            if (backedUpState.timetableSlots) setTimetableSlots(backedUpState.timetableSlots);
            if (backedUpState.studySessions) setStudySessions(backedUpState.studySessions);
            if (backedUpState.pyqEntries) setPyqEntries(backedUpState.pyqEntries);
            if (backedUpState.mockTests) setMockTests(backedUpState.mockTests);
            if (backedUpState.errorLogs) setErrorLogs(backedUpState.errorLogs);
            if (backedUpState.revisionItems) setRevisionItems(backedUpState.revisionItems);
            if (backedUpState.monthlyGoals) setMonthlyGoals(backedUpState.monthlyGoals);
            if (backedUpState.userConfig) setUserConfig((prev) => ({ ...prev, ...backedUpState.userConfig }));
            if (backedUpState.celebratedBadgeIds) setCelebratedBadgeIds(backedUpState.celebratedBadgeIds);
            if (backedUpState.pyqPaperRecords) setPyqPaperRecords(backedUpState.pyqPaperRecords);
          }
        } catch (err) {
          console.warn('Could not read from IndexedDB fallback:', err);
        }
      }
      isHydratedRef.current = true;
    }

    recoverFromIDBIfLocalStorageEmpty();
  }, []);

  // Apply dark mode class to document
  useEffect(() => {
    if (userConfig.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [userConfig.darkMode]);

  // Save changes to localStorage & mirror to IndexedDB for durable offline reliability
  useEffect(() => {
    if (!isHydratedRef.current) return;

    try {
      localStorage.setItem(`${STORAGE_KEY}_subjects`, JSON.stringify(subjects));
      localStorage.setItem(`${STORAGE_KEY}_tasks`, JSON.stringify(tasks));
      localStorage.setItem(`${STORAGE_KEY}_slots`, JSON.stringify(timetableSlots));
      localStorage.setItem(`${STORAGE_KEY}_sessions`, JSON.stringify(studySessions));
      localStorage.setItem(`${STORAGE_KEY}_pyq`, JSON.stringify(pyqEntries));
      localStorage.setItem(`${STORAGE_KEY}_mocks`, JSON.stringify(mockTests));
      localStorage.setItem(`${STORAGE_KEY}_errors`, JSON.stringify(errorLogs));
      localStorage.setItem(`${STORAGE_KEY}_revisions`, JSON.stringify(revisionItems));
      localStorage.setItem(`${STORAGE_KEY}_roadmap`, JSON.stringify(monthlyGoals));
      localStorage.setItem(`${STORAGE_KEY}_config`, JSON.stringify(userConfig));
      localStorage.setItem(`${STORAGE_KEY}_notifications`, JSON.stringify(notifications));
      localStorage.setItem(`${STORAGE_KEY}_celebrated_badges`, JSON.stringify(celebratedBadgeIds));
      localStorage.setItem(`${STORAGE_KEY}_focus`, JSON.stringify(focusSession));
      localStorage.setItem(`${STORAGE_KEY}_pyq_papers`, JSON.stringify(pyqPaperRecords));

      // Mirror state to IndexedDB asynchronously
      saveToIDB('app_full_state', {
        subjects,
        tasks,
        timetableSlots,
        studySessions,
        pyqEntries,
        mockTests,
        errorLogs,
        revisionItems,
        monthlyGoals,
        userConfig,
        notifications,
        celebratedBadgeIds,
        pyqPaperRecords,
        savedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Persistence save warning:', e);
    }
  }, [
    subjects,
    tasks,
    timetableSlots,
    studySessions,
    pyqEntries,
    mockTests,
    errorLogs,
    revisionItems,
    monthlyGoals,
    userConfig,
    notifications,
    celebratedBadgeIds,
    focusSession,
    pyqPaperRecords,
  ]);

  // Flattened trackable topics
  const allTrackableTopics = useMemo(() => {
    return getAllTrackableTopics(subjects);
  }, [subjects]);

  // Derived metrics
  const totalTopicsCount = allTrackableTopics.length;

  const completedTopicsCount = useMemo(() => {
    return allTrackableTopics.filter((t) => t.completed).length;
  }, [allTrackableTopics]);

  const inProgressTopicsCount = useMemo(() => {
    return allTrackableTopics.filter((t) => !t.completed && t.status === 'in_progress').length;
  }, [allTrackableTopics]);

  const overdueTopicsCount = useMemo(() => {
    return allTrackableTopics.filter((t) => !t.completed && t.targetCompletionDate < todayDate).length;
  }, [allTrackableTopics, todayDate]);

  const remainingTopicsCount = totalTopicsCount - completedTopicsCount;

  const overallCompletionPercentage = useMemo(() => {
    if (totalTopicsCount === 0) return 0;
    return Math.round((completedTopicsCount / totalTopicsCount) * 100);
  }, [completedTopicsCount, totalTopicsCount]);

  // Weighted by NIMCET exam question distribution: Maths 50/120, Reasoning 40/120, Computer 20/120, English 10/120
  const weightedCompletionPercentage = useMemo(() => {
    const totalExamQuestions = 120;
    let weightedSum = 0;
    subjects.forEach((subj) => {
      const subjTopics = getAllTrackableTopics([subj]);
      if (subjTopics.length > 0) {
        const completed = subjTopics.filter((t) => t.completed).length;
        const subjRatio = completed / subjTopics.length;
        weightedSum += subjRatio * (subj.questionWeight / totalExamQuestions);
      }
    });
    return Math.round(weightedSum * 100);
  }, [subjects]);

  const subjectStats = useMemo(() => {
    const stats: Record<SubjectId, SubjectStat> = {} as Record<SubjectId, SubjectStat>;
    subjects.forEach((subj) => {
      const topics = getAllTrackableTopics([subj]);
      const total = topics.length;
      const completed = topics.filter((t) => t.completed).length;
      const inProg = topics.filter((t) => !t.completed && t.status === 'in_progress').length;
      const overdue = topics.filter((t) => !t.completed && t.targetCompletionDate < todayDate).length;
      const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
      stats[subj.id] = {
        subjectId: subj.id,
        name: subj.name,
        shortName: subj.shortName,
        color: subj.color,
        totalTopics: total,
        completedTopics: completed,
        inProgressTopics: inProg,
        overdueTopics: overdue,
        percentage: pct,
        questionWeight: subj.questionWeight,
      };
    });
    return stats;
  }, [subjects, todayDate]);

  // Weekly study hours: filtered strictly to current Monday-Sunday calendar week in Asia/Kolkata
  const studyHoursThisWeek = useMemo(() => {
    const totalMins = studySessions
      .filter(
        (s) =>
          (s.status === 'completed' || s.status === 'partially_completed') &&
          isDateInCurrentWeek(s.date, todayDate)
      )
      .reduce((sum, s) => sum + (s.actualMinutes || 0), 0);
    return Math.round((totalMins / 60) * 10) / 10;
  }, [studySessions, todayDate]);

  // Lifetime total study hours logged across all historical sessions
  const totalStudyHoursLogged = useMemo(() => {
    const totalMins = studySessions
      .filter((s) => s.status === 'completed' || s.status === 'partially_completed')
      .reduce((sum, s) => sum + (s.actualMinutes || 0), 0);
    return Math.round((totalMins / 60) * 10) / 10;
  }, [studySessions]);

  // Dynamic exam countdown
  const daysRemainingUntilExam = useMemo(() => {
    if (!userConfig.exactExamDate) return null;
    const diff = getDaysDifference(todayDate, userConfig.exactExamDate);
    return diff >= 0 ? diff : 0;
  }, [userConfig.exactExamDate, todayDate]);

  // Genuine consecutive-day study streak
  const currentStudyStreak = useMemo(() => {
    const activeSessions = studySessions.filter(
      (s) => (s.status === 'completed' || s.status === 'partially_completed') && (s.actualMinutes || 0) > 0
    );
    return calculateConsecutiveStudyStreak(
      activeSessions.map((s) => s.date),
      todayDate
    );
  }, [studySessions, todayDate]);

  const nextScheduledSession = useMemo(() => {
    return timetableSlots.find((s) => !s.isBreak) || null;
  }, [timetableSlots]);

  const nextPlannedTest = useMemo(() => {
    const upcoming = mockTests
      .filter((t) => !t.completed && t.scheduledDate >= todayDate)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    return upcoming[0] || null;
  }, [mockTests, todayDate]);

  // "Almost Finished Chapters" calculation
  const almostFinishedChapters = useMemo(() => {
    const list: ChapterProgress[] = [];
    subjects.forEach((subj) => {
      subj.chapters.forEach((chap) => {
        const total = chap.topics.length;
        const comp = chap.topics.filter((t) => t.completed).length;
        const rem = total - comp;
        const pct = total > 0 ? Math.round((comp / total) * 100) : 0;
        if (total > 0 && rem > 0 && (pct >= 50 || rem <= 2)) {
          list.push({
            chapterId: chap.id,
            chapterTitle: chap.title,
            subjectId: subj.id,
            subjectName: subj.name,
            totalTopics: total,
            completedTopics: comp,
            remainingTopics: rem,
            percentage: pct,
          });
        }
      });
    });
    return list.sort((a, b) => b.percentage - a.percentage).slice(0, 3);
  }, [subjects]);

  // "Today's Mission" - Top 3 pending tasks for today
  const todaysTopTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status === 'pending')
      .sort((a, b) => {
        const pRank: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        const prDiff = (pRank[b.priority] || 1) - (pRank[a.priority] || 1);
        if (prDiff !== 0) return prDiff;
        return a.deadline.localeCompare(b.deadline);
      })
      .slice(0, 3);
  }, [tasks]);

  // Heatmap: last 7 days of consistency leading up to todayDate
  const recentWeekStudyHeatmap = useMemo(() => {
    const days: { date: string; dayName: string; minutes: number; studied: boolean }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const dateStr = addDaysToDateString(todayDate, -i);
      const d = parseDateAtNoon(dateStr);
      const mins = studySessions
        .filter((s) => s.date === dateStr && s.status !== 'skipped')
        .reduce((sum, s) => sum + (s.actualMinutes || 0), 0);

      days.push({
        date: dateStr,
        dayName: dayNames[d.getDay()],
        minutes: mins,
        studied: mins > 0,
      });
    }
    return days;
  }, [studySessions, todayDate]);

  // PYQ Library derived metrics (strictly calculated from the 16 configured paper links)
  const pyqPapersTotalCount = PYQ_PAPER_LINKS.length; // 16

  const pyqPapersPractisedCount = useMemo(() => {
    const validYears = new Set(PYQ_PAPER_LINKS.map((p) => p.year));
    return Object.entries(pyqPaperRecords).filter(([yearStr, r]) => {
      const year = Number(yearStr);
      return validYears.has(year) && r.status === 'practised';
    }).length;
  }, [pyqPaperRecords]);

  const pyqPapersRemainingCount = Math.max(0, pyqPapersTotalCount - pyqPapersPractisedCount);

  const pyqPapersCompletionPercentage = useMemo(() => {
    if (pyqPapersTotalCount === 0) return 0;
    return Math.min(100, Math.round((pyqPapersPractisedCount / pyqPapersTotalCount) * 100));
  }, [pyqPapersPractisedCount, pyqPapersTotalCount]);

  // Gamification: calculate XP and Badges purely from real user activity
  const { userXP, badges } = useMemo(() => {
    let xp = 0;

    // Completed topics: 60 XP
    xp += completedTopicsCount * 60;

    // Completed tasks: 50 XP
    const completedTasksCount = tasks.filter((t) => t.status === 'completed').length;
    xp += completedTasksCount * 50;

    // PYQs attempted: 2 XP per question
    const totalPYQAttempted = pyqEntries.reduce((sum, e) => sum + e.attempted, 0);
    // Also include questions attempted from PYQ paper library
    const paperQuestionsAttempted = Object.values(pyqPaperRecords).reduce(
      (sum, r) => sum + r.attempts.reduce((aSum, a) => aSum + (a.attempted || 0), 0),
      0
    );
    xp += (totalPYQAttempted + paperQuestionsAttempted) * 2;

    // Practised official PYQ papers: 100 XP bonus each
    xp += pyqPapersPractisedCount * 100;

    // Study minutes: 1 XP per minute studied
    const totalMinsStudied = studySessions.reduce((sum, s) => sum + (s.actualMinutes || 0), 0);
    xp += totalMinsStudied;

    // Completed mock tests: 120 XP
    const completedMocksCount = mockTests.filter((m) => m.completed).length;
    xp += completedMocksCount * 120;

    // Check Badge unlock conditions
    const computedBadges: Badge[] = INITIAL_BADGES.map((b) => {
      let isUnlocked = false;

      switch (b.id) {
        case 'first_step':
          isUnlocked = completedTopicsCount >= 1;
          break;
        case 'first_chapter':
          isUnlocked = subjects.some((s) =>
            s.chapters.some((c) => c.topics.length > 0 && c.topics.every((t) => t.completed))
          );
          break;
        case 'streak_7':
          isUnlocked = currentStudyStreak >= 7;
          break;
        case 'pyq_100':
          isUnlocked = (totalPYQAttempted + paperQuestionsAttempted) >= 100;
          break;
        case 'first_mock':
          isUnlocked = mockTests.some((m) => m.testType === 'full_mock' && m.completed);
          break;
        case 'month_target':
          isUnlocked = monthlyGoals.some(
            (g) => g.isReviewed || (g.plannedTopicsCount > 0 && allTrackableTopics.filter((t) => t.assignedMonth === g.monthKey).every((t) => t.completed))
          );
          break;
        case 'math_dynamo': {
          const mathTopics = getAllTrackableTopics(subjects.filter((s) => s.id === 'maths'));
          isUnlocked = mathTopics.filter((t) => t.completed).length >= 10;
          break;
        }
        case 'logic_sensei': {
          const reasTopics = getAllTrackableTopics(subjects.filter((s) => s.id === 'reasoning'));
          isUnlocked = reasTopics.filter((t) => t.completed).length >= 5;
          break;
        }
      }

      if (isUnlocked) {
        xp += b.xpReward;
      }

      return {
        ...b,
        unlocked: isUnlocked,
      };
    });

    return { userXP: xp, badges: computedBadges };
  }, [
    completedTopicsCount,
    tasks,
    pyqEntries,
    pyqPaperRecords,
    pyqPapersPractisedCount,
    studySessions,
    mockTests,
    subjects,
    currentStudyStreak,
    monthlyGoals,
    allTrackableTopics,
  ]);

  // Preparation Level based on userXP
  const preparationLevel = useMemo(() => {
    for (let i = PREPARATION_LEVELS.length - 1; i >= 0; i--) {
      if (userXP >= PREPARATION_LEVELS[i].minXP) {
        return PREPARATION_LEVELS[i];
      }
    }
    return PREPARATION_LEVELS[0];
  }, [userXP]);

  // Trigger celebration modal for newly unlocked badges
  useEffect(() => {
    const newlyUnlocked = badges.find((b) => b.unlocked && !celebratedBadgeIds.includes(b.id));
    if (newlyUnlocked && !uncelebratedBadge) {
      setUncelebratedBadge(newlyUnlocked);
      setCelebratedBadgeIds((prev) => [...prev, newlyUnlocked.id]);
    }
  }, [badges, celebratedBadgeIds, uncelebratedBadge]);

  const dismissCelebration = useCallback(() => {
    setUncelebratedBadge(null);
  }, []);

  // Real-data intelligent encouraging progress message
  const encouragingMessage = useMemo(() => {
    if (overdueTopicsCount > 0) {
      return `You have ${overdueTopicsCount} overdue task${overdueTopicsCount > 1 ? 's' : ''}. Let’s make a realistic catch-up plan.`;
    }

    const completedMocks = mockTests
      .filter((m) => m.completed && m.score !== undefined)
      .sort((a, b) => (a.completedDate || '').localeCompare(b.completedDate || ''));
    if (completedMocks.length >= 2) {
      const latest = completedMocks[completedMocks.length - 1];
      const previous = completedMocks[completedMocks.length - 2];
      if (latest.score > previous.score) {
        return 'Your mock score improved compared with your previous attempt. Excellent progress!';
      }
    }

    const weekAgoStr = addDaysToDateString(todayDate, -7);
    const completedThisWeek = allTrackableTopics.filter(
      (t) => t.completed && t.completedAt && t.completedAt >= weekAgoStr
    ).length;
    if (completedThisWeek >= 3) {
      return `Fantastic! You completed ${completedThisWeek} topics this week.`;
    }

    const currentMonthKey = todayDate.slice(0, 7);
    const thisMonthTopics = allTrackableTopics.filter((t) => t.assignedMonth === currentMonthKey);
    if (thisMonthTopics.length > 0) {
      const monthCompleted = thisMonthTopics.filter((t) => t.completed).length;
      const monthPct = Math.round((monthCompleted / thisMonthTopics.length) * 100);
      if (monthPct >= 20 && monthPct < 100) {
        return `You are ${monthPct}% through this month’s planned syllabus.`;
      }
    }

    if (almostFinishedChapters.length > 0) {
      const topChap = almostFinishedChapters[0];
      const word = topChap.remainingTopics === 2 ? 'Two' : `${topChap.remainingTopics}`;
      return `${word} more topic${topChap.remainingTopics > 1 ? 's' : ''} will complete ${topChap.chapterTitle}.`;
    }

    const completedToday = allTrackableTopics.filter(
      (t) => t.completed && t.completedAt?.startsWith(todayDate)
    ).length;
    if (completedToday > 0) {
      return `Fantastic! You completed ${completedToday} topic${completedToday > 1 ? 's' : ''} today.`;
    }

    if (currentStudyStreak > 0) {
      const hasStudiedToday = studySessions.some((s) => s.date === todayDate && s.status !== 'skipped');
      if (hasStudiedToday) {
        return `Your study streak is active at ${currentStudyStreak} day${currentStudyStreak > 1 ? 's' : ''}. Welcome back!`;
      }
      return `Your study streak is at ${currentStudyStreak} day${currentStudyStreak > 1 ? 's' : ''}. Log today’s session to keep the flame alive!`;
    }

    if (overallCompletionPercentage > 0) {
      return `You have completed ${overallCompletionPercentage}% of your total syllabus.`;
    }

    return `Your NIMCET 2027 preparation journey starts here. Welcome to PrepPilot!`;
  }, [
    overdueTopicsCount,
    mockTests,
    todayDate,
    allTrackableTopics,
    almostFinishedChapters,
    currentStudyStreak,
    studySessions,
    overallCompletionPercentage,
  ]);

  // Focus Mode Timer Hook (Pomodoro)
  useEffect(() => {
    if (!focusSession.isActive || focusSession.isPaused) return;

    const timer = setInterval(() => {
      setFocusSession((prev) => {
        if (!prev.isActive || prev.isPaused) return prev;
        if (prev.remainingSeconds <= 1) {
          return {
            ...prev,
            remainingSeconds: 0,
            isPaused: true,
          };
        }
        return {
          ...prev,
          remainingSeconds: prev.remainingSeconds - 1,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [focusSession.isActive, focusSession.isPaused]);

  // Focus actions
  const startFocusSession = useCallback((topicId?: string, taskId?: string, durationMins = 25) => {
    setFocusSession({
      isActive: true,
      isPaused: false,
      mode: 'focus',
      durationSeconds: durationMins * 60,
      remainingSeconds: durationMins * 60,
      selectedTopicId: topicId,
      selectedTaskId: taskId,
      startedAt: new Date().toISOString(),
      sessionsCompletedToday: focusSession.sessionsCompletedToday,
    });
  }, [focusSession.sessionsCompletedToday]);

  const pauseFocusSession = useCallback(() => {
    setFocusSession((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resumeFocusSession = useCallback(() => {
    setFocusSession((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const resetFocusSession = useCallback(() => {
    setFocusSession((prev) => ({
      ...prev,
      isActive: false,
      isPaused: false,
      remainingSeconds: prev.durationSeconds,
    }));
  }, []);

  // Update Topic & status recalculation
  const updateTopic = useCallback((topicId: string, updates: Partial<SyllabusTopic>) => {
    setSubjects((prevSubjects) => {
      return prevSubjects.map((subject) => ({
        ...subject,
        chapters: subject.chapters.map((chapter) => ({
          ...chapter,
          topics: chapter.topics.map((topic) => {
            if (topic.id !== topicId) return topic;

            const updated: SyllabusTopic = { ...topic, ...updates };

            if (updated.completed) {
              updated.status = 'completed';
              if (!updated.completedAt) {
                updated.completedAt = new Date().toISOString();
              }
            } else {
              if (updated.targetCompletionDate < todayDate) {
                updated.status = 'overdue';
              } else if (updated.actualHours > 0 || updated.questionsSolved > 0) {
                updated.status = 'in_progress';
              } else {
                updated.status = 'not_started';
              }
              updated.completedAt = undefined;
            }

            return updated;
          }),
        })),
      }));
    });
  }, [todayDate]);

  const completeFocusSession = useCallback((overrideMinutes?: number) => {
    const elapsedMinutes =
      overrideMinutes !== undefined
        ? Math.max(1, overrideMinutes)
        : Math.round((focusSession.durationSeconds - focusSession.remainingSeconds) / 60) ||
          Math.round(focusSession.durationSeconds / 60);

    const newSession: LoggedStudySession = {
      id: `session-focus-${Date.now()}`,
      date: todayDate,
      slotId: 'focus-pomodoro',
      startTime: new Date().toTimeString().slice(0, 5),
      endTime: new Date().toTimeString().slice(0, 5),
      activity: `Pomodoro Focus Session (${elapsedMinutes} mins)`,
      topicId: focusSession.selectedTopicId,
      status: 'completed',
      plannedMinutes: Math.round(focusSession.durationSeconds / 60),
      actualMinutes: elapsedMinutes,
      notes: 'Completed in Distraction-Free Focus Mode.',
      loggedAt: new Date().toISOString(),
    };
    setStudySessions((prev) => [newSession, ...prev]);

    if (focusSession.selectedTopicId && elapsedMinutes > 0) {
      updateTopic(focusSession.selectedTopicId, {
        actualHours: Math.round((elapsedMinutes / 60) * 10) / 10,
      });
    }

    setFocusSession((prev) => ({
      ...prev,
      mode: 'break',
      durationSeconds: 5 * 60,
      remainingSeconds: 5 * 60,
      isPaused: true,
      sessionsCompletedToday: prev.sessionsCompletedToday + 1,
    }));
  }, [focusSession, updateTopic, todayDate]);

  const switchFocusMode = useCallback((mode: 'focus' | 'break', customDurationMins?: number) => {
    const defaultDur = mode === 'focus' ? 25 : 5;
    const durMins = customDurationMins && customDurationMins > 0 ? customDurationMins : defaultDur;
    const durSeconds = durMins * 60;
    setFocusSession((prev) => ({
      ...prev,
      mode,
      durationSeconds: durSeconds,
      remainingSeconds: durSeconds,
      isPaused: true,
    }));
  }, []);

  const updateFocusTopicOrTask = useCallback((topicId?: string, taskId?: string) => {
    setFocusSession((prev) => ({
      ...prev,
      selectedTopicId: topicId,
      selectedTaskId: taskId,
    }));
  }, []);

  // Generate spaced revision item for a studied topic
  const addRevisionScheduleForTopic = useCallback((topic: SyllabusTopic) => {
    const addDays = (dStr: string, days: number) => addDaysToDateString(dStr, days);

    const newRevisionItem: SpacedRevisionItem = {
      id: `rev-${topic.id}-${Date.now()}`,
      topicId: topic.id,
      topicTitle: topic.title,
      subjectId: topic.subjectId,
      studiedDate: todayDate,
      intervals: [
        { stage: 'Same Day', targetDate: todayDate, completed: false },
        { stage: '1 Day', targetDate: addDays(todayDate, 1), completed: false },
        { stage: '3 Days', targetDate: addDays(todayDate, 3), completed: false },
        { stage: '7 Days', targetDate: addDays(todayDate, 7), completed: false },
        { stage: '14 Days', targetDate: addDays(todayDate, 14), completed: false },
        { stage: '30 Days', targetDate: addDays(todayDate, 30), completed: false },
      ],
      notes: `Automated spaced repetition cycle for ${topic.title}`,
    };
    setRevisionItems((prev) => [...prev, newRevisionItem]);

    const revisionTask: TaskItem = {
      id: `task-rev-${Date.now()}`,
      title: `Day 1 Spaced Revision: ${topic.title}`,
      subjectId: topic.subjectId,
      topicId: topic.id,
      taskType: 'Revise',
      startDate: todayDate,
      deadline: addDays(todayDate, 1),
      priority: 'high',
      status: 'pending',
      estimatedMinutes: 30,
      actualMinutes: 0,
      notes: 'Quick spaced retrieval practice and formula recall.',
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [revisionTask, ...prev]);
  }, [todayDate]);

  // Toggle Topic Completion
  const toggleTopicCompletion = useCallback((topicId: string) => {
    setSubjects((prevSubjects) => {
      let completedTarget: SyllabusTopic | null = null;
      const nextSubjects = prevSubjects.map((subject) => ({
        ...subject,
        chapters: subject.chapters.map((chapter) => ({
          ...chapter,
          topics: chapter.topics.map((topic) => {
            if (topic.id !== topicId) return topic;
            const willBeCompleted = !topic.completed;
            const updatedTopic: SyllabusTopic = {
              ...topic,
              completed: willBeCompleted,
              status: willBeCompleted ? 'completed' : topic.targetCompletionDate < todayDate ? 'overdue' : 'not_started',
              completedAt: willBeCompleted ? new Date().toISOString() : undefined,
            };
            if (willBeCompleted) {
              completedTarget = updatedTopic;
            }
            return updatedTopic;
          }),
        })),
      }));

      if (completedTarget) {
        addRevisionScheduleForTopic(completedTarget);
      }
      return nextSubjects;
    });
  }, [addRevisionScheduleForTopic, todayDate]);

  // Add custom topic
  const addTopic = useCallback((subjectId: SubjectId, chapterId: string, title: string, priority: SyllabusTopic['priority'] = 'medium') => {
    const newTopic: SyllabusTopic = {
      id: `cust-topic-${Date.now()}`,
      subjectId,
      chapterId,
      title,
      completed: false,
      status: 'not_started',
      plannedStartDate: todayDate,
      targetCompletionDate: addDaysToDateString(todayDate, 21),
      assignedMonth: todayDate.slice(0, 7),
      priority,
      notes: '',
      estimatedHours: 3,
      actualHours: 0,
      questionsSolved: 0,
      questionsCorrect: 0,
    };

    setSubjects((prev) =>
      prev.map((subj) => {
        if (subj.id !== subjectId) return subj;
        return {
          ...subj,
          chapters: subj.chapters.map((ch) => {
            if (ch.id !== chapterId) return ch;
            return {
              ...ch,
              topics: [...ch.topics, newTopic],
            };
          }),
        };
      })
    );
  }, [todayDate]);

  // Tasks actions
  const addTask = useCallback((taskData: Omit<TaskItem, 'id' | 'createdAt'>) => {
    const newTask: TaskItem = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<TaskItem>) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const updated = { ...t, ...updates };
        if (updated.status === 'completed' && !updated.completedAt) {
          updated.completedAt = new Date().toISOString();
        } else if (updated.status === 'pending') {
          updated.completedAt = undefined;
        }
        return updated;
      })
    );
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const toggleTaskCompletion = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const nextStatus = t.status === 'completed' ? 'pending' : 'completed';
        return {
          ...t,
          status: nextStatus,
          completedAt: nextStatus === 'completed' ? new Date().toISOString() : undefined,
        };
      })
    );
  }, []);

  const bulkCompleteTasks = useCallback((taskIds: string[]) => {
    const setIds = new Set(taskIds);
    setTasks((prev) =>
      prev.map((t) => {
        if (!setIds.has(t.id)) return t;
        return {
          ...t,
          status: 'completed',
          completedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  // Timetable & Sessions
  const updateTimetableSlot = useCallback((slotId: string, updates: Partial<TimetableSlot>) => {
    setTimetableSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, ...updates } : s)));
  }, []);

  const logStudySession = useCallback((sessionData: Omit<LoggedStudySession, 'id' | 'loggedAt'>) => {
    const newSession: LoggedStudySession = {
      ...sessionData,
      id: `session-${Date.now()}`,
      loggedAt: new Date().toISOString(),
    };
    setStudySessions((prev) => [newSession, ...prev]);

    if (sessionData.topicId && sessionData.actualMinutes > 0) {
      const addedHours = Math.round((sessionData.actualMinutes / 60) * 10) / 10;
      updateTopic(sessionData.topicId, {
        actualHours: addedHours,
      });
    }
  }, [updateTopic]);

  const updateStudySession = useCallback((sessionId: string, updates: Partial<LoggedStudySession>) => {
    setStudySessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...updates } : s)));
  }, []);

  const deleteStudySession = useCallback((sessionId: string) => {
    setStudySessions((prev) => prev.filter((s) => s.id !== sessionId));
  }, []);

  // PYQ Tracker (Book / topic practice)
  const addPYQEntry = useCallback((entryData: Omit<PYQEntry, 'id' | 'createdAt'>) => {
    const newEntry: PYQEntry = {
      ...entryData,
      id: `pyq-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setPyqEntries((prev) => [newEntry, ...prev]);
  }, []);

  const updatePYQEntry = useCallback((entryId: string, updates: Partial<PYQEntry>) => {
    setPyqEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, ...updates } : e)));
  }, []);

  const deletePYQEntry = useCallback((entryId: string) => {
    setPyqEntries((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  // PYQ Library Paper Tracking (16 Official Papers: 2011 to 2026)
  const recordPYQPaperAttempt = useCallback(
    (year: number, attemptData: Omit<PYQPaperAttempt, 'id'>, markPractised = true) => {
      const newAttempt: PYQPaperAttempt = {
        ...attemptData,
        id: `pyq-attempt-${year}-${Date.now()}`,
      };

      setPyqPaperRecords((prev) => {
        const existing = prev[year] || { year, status: 'not_started', attempts: [] };
        const nextStatus: PYQPaperStatus = markPractised ? 'practised' : 'in_progress';
        return {
          ...prev,
          [year]: {
            ...existing,
            status: nextStatus,
            lastPractisedAt: attemptData.date || todayDate,
            firstOpenedAt: existing.firstOpenedAt || todayDate,
            attempts: [newAttempt, ...existing.attempts],
          },
        };
      });

      // If user identified weak topics or selected syllabus topic, generate revision task with safe deduplication
      const hasWeakTopics = attemptData.weakTopics && attemptData.weakTopics.length > 0;
      const hasTopic = Boolean(attemptData.topicId);
      if (hasWeakTopics || hasTopic) {
        const detailStr = hasWeakTopics ? attemptData.weakTopics!.join(', ') : 'Topic Review';
        const taskTitle = `PYQ ${year} Review: ${detailStr}`;
        setTasks((prevTasks) => {
          const alreadyExists = prevTasks.some((t) => t.title === taskTitle && t.status !== 'completed');
          if (alreadyExists) return prevTasks;
          const newTask: TaskItem = {
            id: `task-pyq-rev-${year}-${Date.now()}`,
            title: taskTitle,
            subjectId: attemptData.subjectId, // Only assigned if user specified a subject; undefined = general review
            topicId: attemptData.topicId,
            taskType: 'Revise',
            startDate: todayDate,
            deadline: addDaysToDateString(todayDate, 2),
            priority: 'high',
            status: 'pending',
            estimatedMinutes: 45,
            actualMinutes: 0,
            notes: `Mistake revision from NIMCET ${year} paper. Notes: ${attemptData.notes || 'None'}`,
            createdAt: new Date().toISOString(),
          };
          return [newTask, ...prevTasks];
        });
      }
    },
    [todayDate]
  );

  const updatePYQPaperAttempt = useCallback(
    (year: number, attemptId: string, updates: Partial<Omit<PYQPaperAttempt, 'id'>>) => {
      setPyqPaperRecords((prev) => {
        const existing = prev[year];
        if (!existing) return prev;
        const updatedAttempts = existing.attempts.map((att) =>
          att.id === attemptId ? { ...att, ...updates } : att
        );
        return {
          ...prev,
          [year]: {
            ...existing,
            lastPractisedAt: updates.date || existing.lastPractisedAt,
            attempts: updatedAttempts,
          },
        };
      });

      // If weak topics or topicId are updated, check if task exists to prevent duplicate tasks
      const hasWeakTopics = updates.weakTopics && updates.weakTopics.length > 0;
      const hasTopic = Boolean(updates.topicId);
      if (hasWeakTopics || hasTopic) {
        const detailStr = hasWeakTopics ? updates.weakTopics!.join(', ') : 'Topic Review';
        const taskTitle = `PYQ ${year} Review: ${detailStr}`;
        setTasks((prevTasks) => {
          const alreadyExists = prevTasks.some((t) => t.title === taskTitle && t.status !== 'completed');
          if (alreadyExists) return prevTasks;
          const newTask: TaskItem = {
            id: `task-pyq-rev-${year}-${Date.now()}`,
            title: taskTitle,
            subjectId: updates.subjectId, // Assigned only if provided; undefined = general review
            topicId: updates.topicId,
            taskType: 'Revise',
            startDate: todayDate,
            deadline: addDaysToDateString(todayDate, 2),
            priority: 'high',
            status: 'pending',
            estimatedMinutes: 45,
            actualMinutes: 0,
            notes: `Mistake revision from NIMCET ${year} paper. Notes: ${updates.notes || 'None'}`,
            createdAt: new Date().toISOString(),
          };
          return [newTask, ...prevTasks];
        });
      }
    },
    [todayDate]
  );

  const updatePYQPaperStatus = useCallback((year: number, status: PYQPaperStatus) => {
    setPyqPaperRecords((prev) => {
      const existing = prev[year] || { year, status: 'not_started', attempts: [] };
      // If unchecking practised but attempts exist, restore in_progress to preserve meaningful progress
      const resolvedStatus =
        status === 'not_started' && existing.attempts.length > 0 ? 'in_progress' : status;
      return {
        ...prev,
        [year]: {
          ...existing,
          status: resolvedStatus,
          lastPractisedAt:
            resolvedStatus === 'practised'
              ? existing.lastPractisedAt || todayDate
              : existing.lastPractisedAt,
        },
      };
    });
  }, [todayDate]);

  const markPYQPaperOpened = useCallback((year: number) => {
    setPyqPaperRecords((prev) => {
      const existing = prev[year] || { year, status: 'not_started', attempts: [] };
      if (existing.status === 'not_started') {
        return {
          ...prev,
          [year]: {
            ...existing,
            status: 'in_progress',
            firstOpenedAt: existing.firstOpenedAt || todayDate,
          },
        };
      }
      return prev;
    });
  }, [todayDate]);

  const schedulePYQPaperTask = useCallback(
    (year: number, scheduledDate: string) => {
      addTask({
        title: `Solve NIMCET ${year} Full Paper (MyAspireStudy)`,
        subjectId: 'maths',
        taskType: 'Practice',
        startDate: todayDate,
        deadline: scheduledDate,
        priority: 'high',
        status: 'pending',
        estimatedMinutes: 120,
        actualMinutes: 0,
        notes: `Simulate 120-question NIMCET ${year} paper under 2-hour exam conditions.`,
      });
    },
    [todayDate, addTask]
  );

  // Mock Tests
  const addMockTest = useCallback((testData: Omit<MockTest, 'id'>) => {
    const newTest: MockTest = {
      ...testData,
      id: `mock-${Date.now()}`,
    };
    setMockTests((prev) => [newTest, ...prev]);
  }, []);

  const updateMockTest = useCallback((testId: string, updates: Partial<MockTest>) => {
    setMockTests((prev) => prev.map((t) => (t.id === testId ? { ...t, ...updates } : t)));
  }, []);

  const deleteMockTest = useCallback((testId: string) => {
    setMockTests((prev) => prev.filter((t) => t.id !== testId));
  }, []);

  // Error Log
  const addErrorLog = useCallback((logData: Omit<ErrorLogEntry, 'id'>) => {
    const newLog: ErrorLogEntry = {
      ...logData,
      id: `err-${Date.now()}`,
    };
    setErrorLogs((prev) => [newLog, ...prev]);
  }, []);

  const updateErrorLog = useCallback((logId: string, updates: Partial<ErrorLogEntry>) => {
    setErrorLogs((prev) => prev.map((e) => (e.id === logId ? { ...e, ...updates } : e)));
  }, []);

  const deleteErrorLog = useCallback((logId: string) => {
    setErrorLogs((prev) => prev.filter((e) => e.id !== logId));
  }, []);

  // Revision stages
  const completeRevisionStage = useCallback((revisionId: string, stageIndex: number) => {
    setRevisionItems((prev) =>
      prev.map((item) => {
        if (item.id !== revisionId) return item;
        const newIntervals = [...item.intervals];
        if (newIntervals[stageIndex]) {
          newIntervals[stageIndex] = {
            ...newIntervals[stageIndex],
            completed: true,
            completedAt: new Date().toISOString(),
          };
        }
        return { ...item, intervals: newIntervals };
      })
    );
  }, []);

  // Roadmap & Config
  const updateMonthlyGoal = useCallback((monthKey: string, updates: Partial<MonthlyGoal>) => {
    setMonthlyGoals((prev) => prev.map((g) => (g.monthKey === monthKey ? { ...g, ...updates } : g)));
  }, []);

  const updateUserConfig = useCallback((updates: Partial<UserConfig>) => {
    setUserConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // Notifications
  const requestBrowserNotifications = useCallback(async () => {
    if (!('Notification' in window)) {
      setUserConfig((prev) => ({ ...prev, browserPermissionRequested: true, notificationsEnabled: false }));
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setUserConfig((prev) => ({
        ...prev,
        browserPermissionRequested: true,
        notificationsEnabled: granted,
      }));
      if (granted) {
        new Notification('PrepPilot | NIMCET 2027', {
          body: 'Browser notifications enabled! We will alert you of upcoming study sessions and deadlines.',
          icon: '/pwa-192x192.png',
        });
      }
      return granted;
    } catch {
      return false;
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, dismissed: true, read: true } : n)));
  }, []);

  const snoozeNotification = useCallback((id: string, hours = 4) => {
    const snoozeDate = new Date();
    snoozeDate.setHours(snoozeDate.getHours() + hours);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, snoozedUntil: snoozeDate.toISOString(), read: true } : n))
    );
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Continue Studying CTA: opens next incomplete task or syllabus topic
  const continueStudying = useCallback(() => {
    const pendingTask = tasks.find((t) => t.status === 'pending');
    if (pendingTask) {
      setActiveSection('tasks');
      return;
    }
    const nextTopic = allTrackableTopics.find((t) => !t.completed);
    if (nextTopic) {
      setSelectedTopicForModal(nextTopic);
      setActiveSection('syllabus');
      return;
    }
    setActiveSection('timetable');
  }, [tasks, allTrackableTopics]);

  // Export & Import backup JSON
  const exportBackupJSON = useCallback(() => {
    const backupData = {
      version: '1.2',
      exportedAt: new Date().toISOString(),
      userConfig,
      subjects,
      tasks,
      timetableSlots,
      studySessions,
      pyqEntries,
      mockTests,
      errorLogs,
      revisionItems,
      monthlyGoals,
      celebratedBadgeIds,
      pyqPaperRecords,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preppilot_backup_${todayDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [userConfig, subjects, tasks, timetableSlots, studySessions, pyqEntries, mockTests, errorLogs, revisionItems, monthlyGoals, celebratedBadgeIds, pyqPaperRecords, todayDate]);

  const importBackupJSON = useCallback((jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.subjects) setSubjects(parsed.subjects);
      if (parsed.tasks) setTasks(parsed.tasks);
      if (parsed.timetableSlots) setTimetableSlots(parsed.timetableSlots);
      if (parsed.studySessions) setStudySessions(parsed.studySessions);
      if (parsed.pyqEntries) setPyqEntries(parsed.pyqEntries);
      if (parsed.mockTests) setMockTests(parsed.mockTests);
      if (parsed.errorLogs) setErrorLogs(parsed.errorLogs);
      if (parsed.revisionItems) setRevisionItems(parsed.revisionItems);
      if (parsed.monthlyGoals) setMonthlyGoals(parsed.monthlyGoals);
      if (parsed.userConfig) setUserConfig(parsed.userConfig);
      if (parsed.celebratedBadgeIds) setCelebratedBadgeIds(parsed.celebratedBadgeIds);
      if (parsed.pyqPaperRecords) setPyqPaperRecords(parsed.pyqPaperRecords);
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      return false;
    }
  }, []);

  const resetAllData = useCallback(() => {
    localStorage.removeItem(`${STORAGE_KEY}_subjects`);
    localStorage.removeItem(`${STORAGE_KEY}_tasks`);
    localStorage.removeItem(`${STORAGE_KEY}_slots`);
    localStorage.removeItem(`${STORAGE_KEY}_sessions`);
    localStorage.removeItem(`${STORAGE_KEY}_pyq`);
    localStorage.removeItem(`${STORAGE_KEY}_mocks`);
    localStorage.removeItem(`${STORAGE_KEY}_errors`);
    localStorage.removeItem(`${STORAGE_KEY}_revisions`);
    localStorage.removeItem(`${STORAGE_KEY}_roadmap`);
    localStorage.removeItem(`${STORAGE_KEY}_config`);
    localStorage.removeItem(`${STORAGE_KEY}_notifications`);
    localStorage.removeItem(`${STORAGE_KEY}_celebrated_badges`);
    localStorage.removeItem(`${STORAGE_KEY}_focus`);
    localStorage.removeItem(`${STORAGE_KEY}_pyq_papers`);

    setSubjects(INITIAL_SYLLABUS_SUBJECTS);
    setTasks(INITIAL_TASKS);
    setTimetableSlots(DEFAULT_TIMETABLE_SLOTS);
    setStudySessions([]);
    setPyqEntries([]);
    setMockTests(INITIAL_MOCK_TESTS);
    setErrorLogs([]);
    setRevisionItems([]);
    setMonthlyGoals(INITIAL_MONTHLY_GOALS);
    setUserConfig(INITIAL_USER_CONFIG);
    setNotifications([]);
    setCelebratedBadgeIds([]);
    setFocusSession(DEFAULT_FOCUS_STATE);
    setPyqPaperRecords(getInitialPYQPaperRecords());
  }, []);

  // System alert checker for in-app smart notifications
  useEffect(() => {
    if (userConfig.notificationsPaused || !userConfig.inAppRemindersEnabled) return;

    const generatedNotifications: AppNotification[] = [];

    // 1. Check overdue topics
    const overdueTopics = allTrackableTopics.filter((t) => !t.completed && t.targetCompletionDate < todayDate);
    if (overdueTopics.length > 0) {
      const overdueId = `notif-overdue-${todayDate}`;
      const existing = notifications.find((n) => n.id === overdueId);
      const isSnoozed = existing?.snoozedUntil && new Date(existing.snoozedUntil) > new Date();

      if (!existing && !isSnoozed) {
        generatedNotifications.push({
          id: overdueId,
          type: 'deadline_passed',
          title: 'Overdue Syllabus Target',
          message: `You have ${overdueTopics.length} unfinished topic${overdueTopics.length > 1 ? 's' : ''} past deadline (${overdueTopics[0].title.slice(0, 30)}...).`,
          timestamp: new Date().toISOString(),
          read: false,
          dismissed: false,
          actionUrl: 'syllabus',
        });
      }
    }

    // 2. Check upcoming test in next 7 days
    const upcomingTest = mockTests.find((t) => !t.completed && t.scheduledDate >= todayDate);
    if (upcomingTest) {
      const testId = `notif-test-${upcomingTest.id}`;
      const existing = notifications.find((n) => n.id === testId);
      const isSnoozed = existing?.snoozedUntil && new Date(existing.snoozedUntil) > new Date();

      if (!existing && !isSnoozed) {
        generatedNotifications.push({
          id: testId,
          type: 'monthly_milestone',
          title: 'Upcoming Test Milestone',
          message: `Your scheduled test "${upcomingTest.testName}" is approaching on ${upcomingTest.scheduledDate}.`,
          timestamp: new Date().toISOString(),
          read: false,
          dismissed: false,
          actionUrl: 'mocks',
        });
      }
    }

    if (generatedNotifications.length > 0) {
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const newOnes = generatedNotifications.filter((n) => !existingIds.has(n.id));
        return [...newOnes, ...prev];
      });
    }
  }, [allTrackableTopics, mockTests, todayDate, userConfig.notificationsPaused, userConfig.inAppRemindersEnabled]);

  const value: AppContextType = {
    activeSection,
    setActiveSection,
    selectedTopicForModal,
    setSelectedTopicForModal,
    todayDate,
    subjects,
    tasks,
    timetableSlots,
    studySessions,
    pyqEntries,
    mockTests,
    errorLogs,
    revisionItems,
    monthlyGoals,
    userConfig,
    notifications,
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
    allTrackableTopics,
    totalTopicsCount,
    completedTopicsCount,
    inProgressTopicsCount,
    remainingTopicsCount,
    overdueTopicsCount,
    overallCompletionPercentage,
    weightedCompletionPercentage,
    subjectStats,
    studyHoursThisWeek,
    totalStudyHoursLogged,
    daysRemainingUntilExam,
    currentStudyStreak,
    nextScheduledSession,
    nextPlannedTest,
    encouragingMessage,
    userXP,
    preparationLevel,
    badges,
    uncelebratedBadge,
    dismissCelebration,
    almostFinishedChapters,
    todaysTopTasks,
    recentWeekStudyHeatmap,
    focusSession,
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    resetFocusSession,
    completeFocusSession,
    switchFocusMode,
    updateFocusTopicOrTask,
    toggleTopicCompletion,
    updateTopic,
    addTopic,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    bulkCompleteTasks,
    updateTimetableSlot,
    logStudySession,
    updateStudySession,
    deleteStudySession,
    addPYQEntry,
    updatePYQEntry,
    deletePYQEntry,
    addMockTest,
    updateMockTest,
    deleteMockTest,
    addErrorLog,
    updateErrorLog,
    deleteErrorLog,
    addRevisionScheduleForTopic,
    completeRevisionStage,
    updateMonthlyGoal,
    updateUserConfig,
    requestBrowserNotifications,
    dismissNotification,
    snoozeNotification,
    clearAllNotifications,
    continueStudying,
    exportBackupJSON,
    importBackupJSON,
    resetAllData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
