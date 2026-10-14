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
  DevicePushRecord,
  NotificationDeliveryStatus,
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
import {
  isFirebaseConfigured,
  signInWithGoogle,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  sendPasswordResetEmailUser,
  sendEmailVerificationUser,
  reloadCurrentUser,
  signOutUser,
  subscribeToAuthChanges,
  fetchRemoteUserData,
  uploadFullLocalDataToRemote,
  syncEntityUpdateToFirestore,
  subscribeToRemoteUserData,
  mergeLocalAndRemoteData,
  mergeItemsById,
  mergeSubjects,
  mergeTopics,
  hasCustomUserData,
  savePreMigrationBackup,
  getPreMigrationBackups,
  syncRemindersToFirestore,
  registerDevicePushSubscription,
  fetchRegisteredDevices,
  deactivateDeviceSubscription,
  fetchServerDispatchStatus,
  triggerServerDeliveryTest,
  getOrCreateDeviceId,
  type ServerStatusCheckResult,
  type FullUserDataPayload,
  type SyncStatusState,
} from '../services/firebase';
import type { User as FirebaseUser } from 'firebase/auth';

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
  schedulePYQPaperTask: (
    year: number,
    scheduledDate: string,
    options?: {
      targetMinutes?: number;
      subjectId?: SubjectId;
      customNotes?: string;
    }
  ) => void;
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

  // Authentication & Cloud Sync
  currentUser: FirebaseUser | null;
  authLoading: boolean;
  syncStatusState: SyncStatusState;
  lastCloudSyncAt: string | null;
  syncErrorMessage: string | null;
  hasPendingOfflineChanges: boolean;
  isFirebaseConfigured: boolean;

  authModalOpen: boolean;
  authModalMode: 'login' | 'signup' | 'forgot_password' | 'verify_email';
  openAuthModal: (mode?: 'login' | 'signup' | 'forgot_password' | 'verify_email') => void;
  closeAuthModal: () => void;

  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signInWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (
    email: string,
    pass: string,
    displayName?: string
  ) => Promise<{ success: boolean; error?: string; verificationSent?: boolean }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  resendVerificationEmail: () => Promise<{ success: boolean; error?: string }>;
  checkEmailVerification: () => Promise<{ verified: boolean; error?: string }>;
  signOut: () => Promise<void>;
  forceCloudSync: () => Promise<void>;

  // First-time Safe Data Migration
  migrationPrompt: {
    isOpen: boolean;
    localData: FullUserDataPayload;
    remoteData: FullUserDataPayload | null;
    isRemoteEmpty: boolean;
    isLocalEmpty: boolean;
    user: FirebaseUser;
  } | null;
  resolveMigration: (strategy: 'merge' | 'upload_local' | 'use_cloud') => Promise<void>;
  dismissMigration: () => void;
  restorePreMigrationBackupKey: (backupKey: string) => boolean;

  continueStudying: () => void;
  exportBackupJSON: () => void;
  importBackupJSON: (jsonData: string) => boolean;
  resetAllData: () => void;

  syncPushSubscriptionToCloud: (tokenOverride?: string) => Promise<{ success: boolean; error?: string }>;
  sendLocalTestNotification: () => Promise<{ success: boolean; error?: string }>;
  sendServerTestNotification: () => Promise<{
    success: boolean;
    status?: 'accepted_by_fcm' | 'partial_failure' | 'failed';
    error?: string;
    message?: string;
    acceptedDevices?: number;
    failedDevices?: number;
    deliveredDevices?: number;
    deviceOutcomes?: Record<string, any>;
  }>;
  registeredDevices: DevicePushRecord[];
  refreshRegisteredDevices: () => Promise<void>;
  deactivateDevice: (deviceId: string) => Promise<{ success: boolean; error?: string }>;
  serverDispatchStatus: ServerStatusCheckResult | null;
  notificationDeliveryStatus: NotificationDeliveryStatus;
  cloudPushError: string | null;
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
  urgentBypassStudyWindow: false,
  weightingMethod: 'unweighted_topics',
  firstRunCompleted: false,
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

  // Ensure documentElement always has 'dark' class permanently
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

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

  // ===========================================================================
  // Firebase Authentication & Cloud Sync State
  // ===========================================================================
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [syncStatusState, setSyncStatusState] = useState<SyncStatusState>(
    isFirebaseConfigured() ? 'local_only' : 'offline'
  );
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`${STORAGE_KEY}_last_cloud_sync`) || null;
    } catch {
      return null;
    }
  });
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const isRemoteApplyingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<any>(null);

  // Auth modal controls
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | 'forgot_password' | 'verify_email'>('login');

  const openAuthModal = useCallback(
    (mode: 'login' | 'signup' | 'forgot_password' | 'verify_email' = 'login') => {
      setAuthModalMode(mode);
      setAuthModalOpen(true);
    },
    []
  );

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  // Offline pending changes flag
  const [hasPendingOfflineChanges, setHasPendingOfflineChanges] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`${STORAGE_KEY}_has_pending_offline`) === 'true';
    } catch {
      return false;
    }
  });

  const markPendingOffline = useCallback((pending: boolean) => {
    setHasPendingOfflineChanges(pending);
    try {
      localStorage.setItem(`${STORAGE_KEY}_has_pending_offline`, pending ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, []);

  // First-time Safe Data Migration Prompt State
  const [migrationPrompt, setMigrationPrompt] = useState<{
    isOpen: boolean;
    localData: FullUserDataPayload;
    remoteData: FullUserDataPayload | null;
    isRemoteEmpty: boolean;
    isLocalEmpty: boolean;
    user: FirebaseUser;
  } | null>(null);

  // Helper to apply a full payload into React state without re-triggering remote save echo
  const applyRemotePayload = useCallback((data: FullUserDataPayload) => {
    isRemoteApplyingRef.current = true;
    if (data.tasks) setTasks(data.tasks);
    if (data.subjects) setSubjects(data.subjects);
    if (data.timetableSlots) setTimetableSlots(data.timetableSlots);
    if (data.studySessions) setStudySessions(data.studySessions);
    if (data.pyqEntries) setPyqEntries(data.pyqEntries);
    if (data.mockTests) setMockTests(data.mockTests);
    if (data.errorLogs) setErrorLogs(data.errorLogs);
    if (data.revisionItems) setRevisionItems(data.revisionItems);
    if (data.monthlyGoals) setMonthlyGoals(data.monthlyGoals);
    if (data.pyqPaperRecords) setPyqPaperRecords(data.pyqPaperRecords);
    if (data.userConfig) setUserConfig((prev) => ({ ...prev, ...data.userConfig }));

    setTimeout(() => {
      isRemoteApplyingRef.current = false;
    }, 500);
  }, []);

  // Keep a ref to the latest complete local state to prevent capturing stale closure in auth listener
  const localStateRef = useRef<FullUserDataPayload>({
    tasks,
    subjects,
    timetableSlots,
    studySessions,
    pyqEntries,
    mockTests,
    errorLogs,
    revisionItems,
    monthlyGoals,
    userConfig,
    pyqPaperRecords,
  });

  useEffect(() => {
    localStateRef.current = {
      tasks,
      subjects,
      timetableSlots,
      studySessions,
      pyqEntries,
      mockTests,
      errorLogs,
      revisionItems,
      monthlyGoals,
      userConfig,
      pyqPaperRecords,
    };
  }, [
    tasks,
    subjects,
    timetableSlots,
    studySessions,
    pyqEntries,
    mockTests,
    errorLogs,
    revisionItems,
    monthlyGoals,
    userConfig,
    pyqPaperRecords,
  ]);

  // Monitor Firebase Auth state changes
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setAuthLoading(false);
      setSyncStatusState('offline');
      return;
    }

    const unsub = subscribeToAuthChanges(async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user) {
        setSyncStatusState('syncing');
        setSyncErrorMessage(null);

        try {
          // 1. Fetch remote user document
          const remoteRes = await fetchRemoteUserData(user.uid);

          // If read encountered an explicit error (e.g. permission-denied or network failure),
          // DO NOT treat this as an empty user account; flag it as error and preserve local state!
          if (remoteRes.error) {
            setSyncStatusState('error');
            setSyncErrorMessage(remoteRes.error);
            markPendingOffline(true);
            return;
          }

          // Use the latest local state from localStateRef
          const currentLocal: FullUserDataPayload = localStateRef.current;
          const migrationKey = `${STORAGE_KEY}_migrated_${user.uid}`;
          const alreadyMigrated = localStorage.getItem(migrationKey) === 'true';

          const localHasData = hasCustomUserData(currentLocal);
          const remoteHasData = remoteRes.exists && remoteRes.data && hasCustomUserData(remoteRes.data);

          // FIRST-TIME SAFE MIGRATION CHECK:
          // If both local and remote have custom data, and user hasn't explicitly resolved migration on this device
          if (!alreadyMigrated && localHasData && remoteHasData && remoteRes.data) {
            // Guarantee an automatic safety backup of local state first
            savePreMigrationBackup(currentLocal);

            setMigrationPrompt({
              isOpen: true,
              localData: currentLocal,
              remoteData: remoteRes.data,
              isRemoteEmpty: false,
              isLocalEmpty: false,
              user,
            });
            setSyncStatusState('migration_pending');
            return;
          }

          // If local has data but remote is clean/empty (first-time user account creation on device)
          if (!alreadyMigrated && localHasData && !remoteHasData) {
            savePreMigrationBackup(currentLocal);
            const uploadRes = await uploadFullLocalDataToRemote(user.uid, currentLocal);
            if (!uploadRes.success) {
              setSyncStatusState('error');
              setSyncErrorMessage(uploadRes.error || 'Failed to initialize cloud database');
              markPendingOffline(true);
              return;
            }
            try {
              localStorage.setItem(migrationKey, 'true');
            } catch {}
            markPendingOffline(false);
            const nowIso = new Date().toISOString();
            setLastCloudSyncAt(nowIso);
            try {
              localStorage.setItem(`${STORAGE_KEY}_last_cloud_sync`, nowIso);
            } catch {}
            setSyncStatusState('synced');
            return;
          }

          // If remote has data but local has no custom data (new phone/laptop signing into existing account)
          if (!alreadyMigrated && !localHasData && remoteHasData && remoteRes.data) {
            applyRemotePayload(remoteRes.data);
            try {
              localStorage.setItem(migrationKey, 'true');
            } catch {}
            markPendingOffline(false);
            const nowIso = new Date().toISOString();
            setLastCloudSyncAt(nowIso);
            try {
              localStorage.setItem(`${STORAGE_KEY}_last_cloud_sync`, nowIso);
            } catch {}
            setSyncStatusState('synced');
            return;
          }

          // Standard continuous sync or already migrated user
          if (remoteRes.exists && remoteRes.data) {
            // Merge local and cloud data safely using deterministic conflict resolution
            const merged = mergeLocalAndRemoteData(currentLocal, remoteRes.data);

            // Update cloud with merged state and verify result before applying locally
            const uploadRes = await uploadFullLocalDataToRemote(user.uid, merged);
            if (!uploadRes.success) {
              setSyncStatusState('error');
              setSyncErrorMessage(uploadRes.error || 'Failed to upload merged state to Cloud Firestore');
              markPendingOffline(true);
              return;
            }
            applyRemotePayload(merged);
          } else {
            // First time cloud user with no existing cloud document: upload local state to remote
            const uploadRes = await uploadFullLocalDataToRemote(user.uid, currentLocal);
            if (!uploadRes.success) {
              setSyncStatusState('error');
              setSyncErrorMessage(uploadRes.error || 'Failed to initialize cloud database document');
              markPendingOffline(true);
              return;
            }
          }

          try {
            localStorage.setItem(migrationKey, 'true');
          } catch {}
          markPendingOffline(false);
          const nowIso = new Date().toISOString();
          setLastCloudSyncAt(nowIso);
          try {
            localStorage.setItem(`${STORAGE_KEY}_last_cloud_sync`, nowIso);
          } catch {}
          setSyncStatusState('synced');
        } catch (err: any) {
          console.error('Initial Cloud Sync Error:', err);
          setSyncStatusState('error');
          setSyncErrorMessage(err?.message || 'Initial cloud sync failed');
          markPendingOffline(true);
        }
      } else {
        setSyncStatusState('local_only');
      }
    });

    return () => unsub();
  }, [applyRemotePayload, markPendingOffline]);

  // Real-time live listener across authenticated devices (laptop & phone)
  useEffect(() => {
    if (!currentUser) return;

    const unsub = subscribeToRemoteUserData(
      currentUser.uid,
      (remoteData) => {
        // Prevent echo-loop if this client initiated the write
        if (isRemoteApplyingRef.current) return;

        isRemoteApplyingRef.current = true;
        // 1. Tasks: preserve tombstones so remote deletions propagate locally
        setTasks((prev) => mergeItemsById(prev, remoteData.tasks, true));
        // 2. Study Sessions
        setStudySessions((prev) => mergeItemsById(prev, remoteData.studySessions, true));
        // 3. PYQ Entries
        setPyqEntries((prev) => mergeItemsById(prev, remoteData.pyqEntries, true));
        // 4. Mock Tests
        setMockTests((prev) => mergeItemsById(prev, remoteData.mockTests, true));
        // 5. Error Logs
        setErrorLogs((prev) => mergeItemsById(prev, remoteData.errorLogs, true));
        // 6. Revision Items
        setRevisionItems((prev) => mergeItemsById(prev, remoteData.revisionItems, true));
        // 7. Timetable Slots
        if (remoteData.timetableSlots && remoteData.timetableSlots.length > 0) {
          setTimetableSlots((prev) => mergeItemsById(prev, remoteData.timetableSlots, true));
        }
        // 8. Monthly Goals
        if (remoteData.monthlyGoals && remoteData.monthlyGoals.length > 0) {
          setMonthlyGoals((prev) => {
            const map = new Map<string, MonthlyGoal>();
            for (const g of prev) map.set(g.monthKey, g);
            for (const g of remoteData.monthlyGoals) map.set(g.monthKey, g);
            return Array.from(map.values());
          });
        }
        // 9. PYQ Paper Records
        if (remoteData.pyqPaperRecords && Object.keys(remoteData.pyqPaperRecords).length > 0) {
          setPyqPaperRecords((prev) => {
            const mergedPapers: Record<number, PYQPaperRecord> = { ...prev };
            for (const [yStr, remoteRec] of Object.entries(remoteData.pyqPaperRecords)) {
              const yr = Number(yStr);
              const localRec = prev[yr];
              if (!localRec) {
                mergedPapers[yr] = remoteRec;
              } else {
                mergedPapers[yr] = {
                  ...remoteRec,
                  attempts: mergeItemsById(localRec.attempts || [], remoteRec.attempts || [], true),
                  status: localRec.status === 'practised' || remoteRec.status === 'practised' ? 'practised' : 'in_progress',
                };
              }
            }
            return mergedPapers;
          });
        }
        // 10. Subjects & Topic Completion: deterministic conflict resolution (LWW)
        if (remoteData.subjects && remoteData.subjects.length > 0) {
          setSubjects((prev) => mergeSubjects(prev, remoteData.subjects));
        }
        // 11. User Config
        if (remoteData.userConfig && Object.keys(remoteData.userConfig).length > 0) {
          setUserConfig((prev) => ({ ...prev, ...remoteData.userConfig }));
        }

        const nowIso = new Date().toISOString();
        setLastCloudSyncAt(nowIso);
        setSyncStatusState('synced');
        setTimeout(() => {
          isRemoteApplyingRef.current = false;
        }, 300);
      },
      (error) => {
        console.warn('Live remote subscription error:', error);
        setSyncStatusState('error');
        setSyncErrorMessage(error.message || 'Live synchronization disconnected');
      }
    );

    return () => unsub();
  }, [currentUser]);

  // Debounced auto-sync to Cloud Firestore when local state mutates
  useEffect(() => {
    if (!currentUser || !isHydratedRef.current || isRemoteApplyingRef.current) return;

    setSyncStatusState('syncing');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const payload: FullUserDataPayload = {
          tasks,
          subjects,
          timetableSlots,
          studySessions,
          pyqEntries,
          mockTests,
          errorLogs,
          revisionItems,
          monthlyGoals,
          userConfig,
          pyqPaperRecords,
        };

        const result = await uploadFullLocalDataToRemote(currentUser.uid, payload);
        if (result.success) {
          const nowIso = new Date().toISOString();
          setLastCloudSyncAt(nowIso);
          setSyncStatusState('synced');
          setSyncErrorMessage(null);
          markPendingOffline(false);
          try {
            localStorage.setItem(`${STORAGE_KEY}_last_cloud_sync`, nowIso);
          } catch {
            // ignore
          }
        } else {
          setSyncStatusState('error');
          setSyncErrorMessage(result.error || 'Failed to save to Cloud Firestore');
          markPendingOffline(true);
        }
      } catch (err: any) {
        console.error('Debounced sync error:', err);
        setSyncStatusState('error');
        setSyncErrorMessage(err?.message || 'Failed to sync with cloud');
        markPendingOffline(true);
      }
    }, 1200);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [
    currentUser,
    tasks,
    subjects,
    timetableSlots,
    studySessions,
    pyqEntries,
    mockTests,
    errorLogs,
    revisionItems,
    monthlyGoals,
    userConfig,
    pyqPaperRecords,
    markPendingOffline,
  ]);

  // Manual Trigger to force cloud sync
  const forceCloudSync = useCallback(async () => {
    if (!currentUser) {
      setSyncErrorMessage('Please sign in to sync with Cloud Firestore.');
      return;
    }

    setSyncStatusState('syncing');
    setSyncErrorMessage(null);

    try {
      const payload: FullUserDataPayload = {
        tasks,
        subjects,
        timetableSlots,
        studySessions,
        pyqEntries,
        mockTests,
        errorLogs,
        revisionItems,
        monthlyGoals,
        userConfig,
        pyqPaperRecords,
      };

      const result = await uploadFullLocalDataToRemote(currentUser.uid, payload);
      if (result.success) {
        const nowIso = new Date().toISOString();
        setLastCloudSyncAt(nowIso);
        setSyncStatusState('synced');
        markPendingOffline(false);
        try {
          localStorage.setItem(`${STORAGE_KEY}_last_cloud_sync`, nowIso);
        } catch {
          // ignore
        }
      } else {
        setSyncStatusState('error');
        setSyncErrorMessage(result.error || 'Cloud sync failed');
        markPendingOffline(true);
      }
    } catch (err: any) {
      setSyncStatusState('error');
      setSyncErrorMessage(err?.message || 'Cloud sync failed');
      markPendingOffline(true);
    }
  }, [
    currentUser,
    tasks,
    subjects,
    timetableSlots,
    studySessions,
    pyqEntries,
    mockTests,
    errorLogs,
    revisionItems,
    monthlyGoals,
    userConfig,
    pyqPaperRecords,
    markPendingOffline,
  ]);

  // Handle Google Sign In
  const handleSignInWithGoogle = useCallback(async () => {
    setSyncStatusState('signing_in');
    setSyncErrorMessage(null);
    const result = await signInWithGoogle();
    if (result.error) {
      setSyncStatusState(currentUser ? 'synced' : 'local_only');
      setSyncErrorMessage(result.error);
      return { success: false, error: result.error };
    }
    closeAuthModal();
    return { success: true };
  }, [currentUser, closeAuthModal]);

  // Handle Email & Password Sign In
  const handleSignInWithEmail = useCallback(
    async (email: string, pass: string) => {
      setSyncStatusState('signing_in');
      setSyncErrorMessage(null);
      const result = await signInWithEmailPassword(email, pass);
      if (result.error) {
        setSyncStatusState(currentUser ? 'synced' : 'local_only');
        setSyncErrorMessage(result.error);
        return { success: false, error: result.error };
      }
      closeAuthModal();
      return { success: true };
    },
    [currentUser, closeAuthModal]
  );

  // Handle Email & Password Sign Up
  const handleSignUpWithEmail = useCallback(
    async (email: string, pass: string, displayName?: string) => {
      setSyncStatusState('signing_in');
      setSyncErrorMessage(null);
      const result = await signUpWithEmailPassword(email, pass, displayName);
      if (result.error) {
        setSyncStatusState(currentUser ? 'synced' : 'local_only');
        setSyncErrorMessage(result.error);
        return { success: false, error: result.error };
      }
      return { success: true, verificationSent: result.verificationSent };
    },
    [currentUser]
  );

  // Handle Password Reset
  const handleSendPasswordReset = useCallback(async (email: string) => {
    return await sendPasswordResetEmailUser(email);
  }, []);

  // Handle Resend Verification Email
  const handleResendVerificationEmail = useCallback(async () => {
    return await sendEmailVerificationUser();
  }, []);

  // Handle Check Email Verification
  const handleCheckEmailVerification = useCallback(async () => {
    const res = await reloadCurrentUser();
    if (res.error) {
      return { verified: false, error: res.error };
    }
    if (res.user) {
      setCurrentUser(res.user);
      return { verified: !!res.user.emailVerified };
    }
    return { verified: false };
  }, []);

  // Handle Sign Out
  const handleSignOut = useCallback(async () => {
    await signOutUser();
    setCurrentUser(null);
    setSyncStatusState('local_only');
    setSyncErrorMessage(null);
  }, []);

  // Resolve First-Time Data Migration Selection
  const resolveMigration = useCallback(
    async (strategy: 'merge' | 'upload_local' | 'use_cloud') => {
      if (!migrationPrompt || !currentUser) return;
      const { localData, remoteData, user } = migrationPrompt;
      const migrationKey = `${STORAGE_KEY}_migrated_${user.uid}`;
      setSyncStatusState('syncing');
      setSyncErrorMessage(null);

      try {
        // Guarantee pre-migration safety backup before any migration action
        savePreMigrationBackup(localData);

        if (strategy === 'merge' && remoteData) {
          const merged = mergeLocalAndRemoteData(localData, remoteData);
          // Await the actual Firestore write BEFORE applying to local state
          const res = await uploadFullLocalDataToRemote(user.uid, merged);
          if (!res.success) {
            setSyncStatusState('error');
            setSyncErrorMessage(res.error || 'Failed to upload merged state to Cloud Firestore');
            markPendingOffline(true);
            return;
          }
          // Only update local state after Firestore write is verified
          applyRemotePayload(merged);
        } else if (strategy === 'upload_local') {
          // Await the actual Firestore write BEFORE claiming completion
          const res = await uploadFullLocalDataToRemote(user.uid, localData);
          if (!res.success) {
            setSyncStatusState('error');
            setSyncErrorMessage(res.error || 'Failed to upload local state to Cloud Firestore');
            markPendingOffline(true);
            return;
          }
          applyRemotePayload(localData);
        } else if (strategy === 'use_cloud' && remoteData) {
          // Distinct operation: Replace local records with cloud records
          applyRemotePayload(remoteData);
        }

        try {
          localStorage.setItem(migrationKey, 'true');
        } catch {}
        markPendingOffline(false);
        const nowIso = new Date().toISOString();
        setLastCloudSyncAt(nowIso);
        try {
          localStorage.setItem(`${STORAGE_KEY}_last_cloud_sync`, nowIso);
        } catch {}
        setSyncStatusState('synced');
        setMigrationPrompt(null);
      } catch (err: any) {
        console.error('Migration resolution error:', err);
        setSyncStatusState('error');
        setSyncErrorMessage(err?.message || 'Failed to complete migration');
        markPendingOffline(true);
      }
    },
    [migrationPrompt, currentUser, applyRemotePayload, markPendingOffline]
  );

  const dismissMigration = useCallback(() => {
    setMigrationPrompt(null);
  }, []);

  const restorePreMigrationBackupKey = useCallback(
    (backupKey: string): boolean => {
      try {
        const raw = localStorage.getItem(backupKey);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        const payloadData = parsed.payload || parsed.data;
        if (!payloadData) return false;
        applyRemotePayload(payloadData);
        return true;
      } catch (err) {
        console.error('Failed to restore backup key:', err);
        return false;
      }
    },
    [applyRemotePayload]
  );
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

  // Active / Visible entities (filtering out durable deletion tombstones for UI views)
  const visibleTasks = useMemo(() => tasks.filter((t) => !t.deletedAt), [tasks]);
  const visibleTimetableSlots = useMemo(() => timetableSlots.filter((s) => !s.deletedAt), [timetableSlots]);
  const visibleStudySessions = useMemo(() => studySessions.filter((s) => !s.deletedAt), [studySessions]);
  const visiblePYQEntries = useMemo(() => pyqEntries.filter((e) => !e.deletedAt), [pyqEntries]);
  const visibleMockTests = useMemo(() => mockTests.filter((m) => !m.deletedAt), [mockTests]);
  const visibleErrorLogs = useMemo(() => errorLogs.filter((e) => !e.deletedAt), [errorLogs]);
  const visibleRevisionItems = useMemo(() => revisionItems.filter((r) => !r.deletedAt), [revisionItems]);

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
    const totalMins = visibleStudySessions
      .filter(
        (s) =>
          (s.status === 'completed' || s.status === 'partially_completed') &&
          isDateInCurrentWeek(s.date, todayDate)
      )
      .reduce((sum, s) => sum + (s.actualMinutes || 0), 0);
    return Math.round((totalMins / 60) * 10) / 10;
  }, [visibleStudySessions, todayDate]);

  // Lifetime total study hours logged across all historical sessions
  const totalStudyHoursLogged = useMemo(() => {
    const totalMins = visibleStudySessions
      .filter((s) => s.status === 'completed' || s.status === 'partially_completed')
      .reduce((sum, s) => sum + (s.actualMinutes || 0), 0);
    return Math.round((totalMins / 60) * 10) / 10;
  }, [visibleStudySessions]);

  // Dynamic exam countdown
  const daysRemainingUntilExam = useMemo(() => {
    if (!userConfig.exactExamDate) return null;
    const diff = getDaysDifference(todayDate, userConfig.exactExamDate);
    return diff >= 0 ? diff : 0;
  }, [userConfig.exactExamDate, todayDate]);

  // Genuine consecutive-day study streak
  const currentStudyStreak = useMemo(() => {
    const activeSessions = visibleStudySessions.filter(
      (s) => (s.status === 'completed' || s.status === 'partially_completed') && (s.actualMinutes || 0) > 0
    );
    return calculateConsecutiveStudyStreak(
      activeSessions.map((s) => s.date),
      todayDate
    );
  }, [visibleStudySessions, todayDate]);

  const nextScheduledSession = useMemo(() => {
    return visibleTimetableSlots.find((s) => !s.isBreak) || null;
  }, [visibleTimetableSlots]);

  const nextPlannedTest = useMemo(() => {
    const upcoming = visibleMockTests
      .filter((t) => !t.completed && t.scheduledDate >= todayDate)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    return upcoming[0] || null;
  }, [visibleMockTests, todayDate]);

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
    return visibleTasks
      .filter((t) => t.status === 'pending')
      .sort((a, b) => {
        const pRank: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        const prDiff = (pRank[b.priority] || 1) - (pRank[a.priority] || 1);
        if (prDiff !== 0) return prDiff;
        return a.deadline.localeCompare(b.deadline);
      })
      .slice(0, 3);
  }, [visibleTasks]);

  // Heatmap: last 7 days of consistency leading up to todayDate
  const recentWeekStudyHeatmap = useMemo(() => {
    const days: { date: string; dayName: string; minutes: number; studied: boolean }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const dateStr = addDaysToDateString(todayDate, -i);
      const d = parseDateAtNoon(dateStr);
      const mins = visibleStudySessions
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
    const completedTasksCount = visibleTasks.filter((t) => t.status === 'completed').length;
    xp += completedTasksCount * 50;

    // PYQs attempted: 2 XP per question
    const totalPYQAttempted = visiblePYQEntries.reduce((sum, e) => sum + e.attempted, 0);
    // Also include questions attempted from PYQ paper library (excluding deleted attempts)
    const paperQuestionsAttempted = Object.values(pyqPaperRecords).reduce(
      (sum, r) => sum + (r.attempts || []).filter((a) => !a.deletedAt).reduce((aSum, a) => aSum + (a.attempted || 0), 0),
      0
    );
    xp += (totalPYQAttempted + paperQuestionsAttempted) * 2;

    // Practised official PYQ papers: 100 XP bonus each
    xp += pyqPapersPractisedCount * 100;

    // Study minutes: 1 XP per minute studied
    const totalMinsStudied = visibleStudySessions.reduce((sum, s) => sum + (s.actualMinutes || 0), 0);
    xp += totalMinsStudied;

    // Completed mock tests: 120 XP
    const completedMocksCount = visibleMockTests.filter((m) => m.completed).length;
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
          isUnlocked = visibleMockTests.some((m) => m.testType === 'full_mock' && m.completed);
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
    const now = new Date().toISOString();
    setSubjects((prevSubjects) => {
      return prevSubjects.map((subject) => ({
        ...subject,
        chapters: subject.chapters.map((chapter) => ({
          ...chapter,
          topics: chapter.topics.map((topic) => {
            if (topic.id !== topicId) return topic;

            const updated: SyllabusTopic = { ...topic, ...updates, updatedAt: now };

            if (updated.completed) {
              updated.status = 'completed';
              if (!updated.completedAt) {
                updated.completedAt = now;
              }
            } else {
              if (updated.targetCompletionDate < todayDate) {
                updated.status = 'overdue';
              } else if (updated.actualHours > 0 || updated.questionsSolved > 0) {
                updated.status = 'in_progress';
              } else {
                updated.status = 'not_started';
              }
              delete updated.completedAt;
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
      updatedAt: new Date().toISOString(),
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
    const now = new Date().toISOString();

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
      updatedAt: now,
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
      createdAt: now,
      updatedAt: now,
    };
    setTasks((prev) => [revisionTask, ...prev]);
  }, [todayDate]);

  // Toggle Topic Completion
  const toggleTopicCompletion = useCallback((topicId: string) => {
    const now = new Date().toISOString();
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
              updatedAt: now,
            };
            if (willBeCompleted) {
              updatedTopic.completedAt = now;
            } else {
              delete (updatedTopic as any).completedAt;
            }
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
    const now = new Date().toISOString();
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
      updatedAt: now,
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
    const now = new Date().toISOString();
    const newTask: TaskItem = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    };
    setTasks((prev) => [newTask, ...prev]);
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<TaskItem>) => {
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const updated = { ...t, ...updates, updatedAt: now };
        if (updated.status === 'completed' && !updated.completedAt) {
          updated.completedAt = now;
        } else if (updated.status === 'pending') {
          delete updated.completedAt;
        }
        return updated;
      })
    );
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, deletedAt: now, updatedAt: now } : t))
    );
  }, []);

  const toggleTaskCompletion = useCallback((taskId: string) => {
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const nextStatus = t.status === 'completed' ? 'pending' : 'completed';
        const updated: TaskItem = {
          ...t,
          status: nextStatus,
          updatedAt: now,
        };
        if (nextStatus === 'completed') {
          updated.completedAt = now;
        } else {
          delete updated.completedAt;
        }
        return updated;
      })
    );
  }, []);

  const bulkCompleteTasks = useCallback((taskIds: string[]) => {
    const setIds = new Set(taskIds);
    const now = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) => {
        if (!setIds.has(t.id)) return t;
        return {
          ...t,
          status: 'completed',
          completedAt: now,
          updatedAt: now,
        };
      })
    );
  }, []);

  // Timetable & Sessions
  const updateTimetableSlot = useCallback((slotId: string, updates: Partial<TimetableSlot>) => {
    const now = new Date().toISOString();
    setTimetableSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, ...updates, updatedAt: now } : s))
    );
  }, []);

  const logStudySession = useCallback((sessionData: Omit<LoggedStudySession, 'id' | 'loggedAt'>) => {
    const now = new Date().toISOString();
    const newSession: LoggedStudySession = {
      ...sessionData,
      id: `session-${Date.now()}`,
      loggedAt: now,
      updatedAt: now,
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
    const now = new Date().toISOString();
    setStudySessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, ...updates, updatedAt: now } : s))
    );
  }, []);

  const deleteStudySession = useCallback((sessionId: string) => {
    const now = new Date().toISOString();
    setStudySessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, deletedAt: now, updatedAt: now } : s))
    );
  }, []);

  // PYQ Tracker (Book / topic practice)
  const addPYQEntry = useCallback((entryData: Omit<PYQEntry, 'id' | 'createdAt'>) => {
    const now = new Date().toISOString();
    const newEntry: PYQEntry = {
      ...entryData,
      id: `pyq-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    setPyqEntries((prev) => [newEntry, ...prev]);
  }, []);

  const updatePYQEntry = useCallback((entryId: string, updates: Partial<PYQEntry>) => {
    const now = new Date().toISOString();
    setPyqEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, ...updates, updatedAt: now } : e))
    );
  }, []);

  const deletePYQEntry = useCallback((entryId: string) => {
    const now = new Date().toISOString();
    setPyqEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, deletedAt: now, updatedAt: now } : e))
    );
  }, []);

  // PYQ Library Paper Tracking (16 Official Papers: 2011 to 2026)
  const recordPYQPaperAttempt = useCallback(
    (year: number, attemptData: Omit<PYQPaperAttempt, 'id'>, markPractised = true) => {
      const now = new Date().toISOString();
      const newAttempt: PYQPaperAttempt = {
        ...attemptData,
        id: `pyq-attempt-${year}-${Date.now()}`,
        updatedAt: now,
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
            createdAt: now,
            updatedAt: now,
          };
          return [newTask, ...prevTasks];
        });
      }
    },
    [todayDate]
  );

  const updatePYQPaperAttempt = useCallback(
    (year: number, attemptId: string, updates: Partial<Omit<PYQPaperAttempt, 'id'>>) => {
      const now = new Date().toISOString();
      setPyqPaperRecords((prev) => {
        const existing = prev[year];
        if (!existing) return prev;
        const updatedAttempts = existing.attempts.map((att) =>
          att.id === attemptId ? { ...att, ...updates, updatedAt: now } : att
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
            createdAt: now,
            updatedAt: now,
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
    (
      year: number,
      scheduledDate: string,
      options?: {
        targetMinutes?: number;
        subjectId?: SubjectId;
        customNotes?: string;
      }
    ) => {
      const minutes = options?.targetMinutes && options.targetMinutes > 0 ? options.targetMinutes : 120;
      const chosenSubject = options?.subjectId; // undefined = general PYQ practice
      const notes =
        options?.customNotes?.trim() ||
        `Solve and analyze NIMCET ${year} paper via MyAspireStudy external resource. Follow paper-specific instructions.`;

      addTask({
        title: `NIMCET ${year} Practice Paper (MyAspireStudy)`,
        subjectId: chosenSubject,
        taskType: 'Practice',
        startDate: todayDate,
        deadline: scheduledDate,
        priority: 'high',
        status: 'pending',
        estimatedMinutes: minutes,
        actualMinutes: 0,
        notes,
      });
    },
    [todayDate, addTask]
  );

  // Mock Tests
  const addMockTest = useCallback((testData: Omit<MockTest, 'id'>) => {
    const now = new Date().toISOString();
    const newTest: MockTest = {
      ...testData,
      id: `mock-${Date.now()}`,
      updatedAt: now,
    };
    setMockTests((prev) => [newTest, ...prev]);
  }, []);

  const updateMockTest = useCallback((testId: string, updates: Partial<MockTest>) => {
    const now = new Date().toISOString();
    setMockTests((prev) => prev.map((t) => (t.id === testId ? { ...t, ...updates, updatedAt: now } : t)));
  }, []);

  const deleteMockTest = useCallback((testId: string) => {
    const now = new Date().toISOString();
    setMockTests((prev) =>
      prev.map((t) => (t.id === testId ? { ...t, deletedAt: now, updatedAt: now } : t))
    );
  }, []);

  // Error Log
  const addErrorLog = useCallback((logData: Omit<ErrorLogEntry, 'id'>) => {
    const now = new Date().toISOString();
    const newLog: ErrorLogEntry = {
      ...logData,
      id: `err-${Date.now()}`,
      updatedAt: now,
    };
    setErrorLogs((prev) => [newLog, ...prev]);
  }, []);

  const updateErrorLog = useCallback((logId: string, updates: Partial<ErrorLogEntry>) => {
    const now = new Date().toISOString();
    setErrorLogs((prev) => prev.map((e) => (e.id === logId ? { ...e, ...updates, updatedAt: now } : e)));
  }, []);

  const deleteErrorLog = useCallback((logId: string) => {
    const now = new Date().toISOString();
    setErrorLogs((prev) =>
      prev.map((e) => (e.id === logId ? { ...e, deletedAt: now, updatedAt: now } : e))
    );
  }, []);

  // Revision stages
  const completeRevisionStage = useCallback((revisionId: string, stageIndex: number) => {
    const now = new Date().toISOString();
    setRevisionItems((prev) =>
      prev.map((item) => {
        if (item.id !== revisionId) return item;
        const newIntervals = [...item.intervals];
        if (newIntervals[stageIndex]) {
          newIntervals[stageIndex] = {
            ...newIntervals[stageIndex],
            completed: true,
            completedAt: now,
          };
        }
        return { ...item, intervals: newIntervals, updatedAt: now };
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

  // Multi-device push states
  const [registeredDevices, setRegisteredDevices] = useState<DevicePushRecord[]>([]);
  const [serverDispatchStatus, setServerDispatchStatus] = useState<ServerStatusCheckResult | null>(null);
  const [cloudPushError, setCloudPushError] = useState<string | null>(null);

  // Refresh registered devices list and server health
  const refreshRegisteredDevices = useCallback(async () => {
    if (!currentUser) {
      setRegisteredDevices([]);
      setServerDispatchStatus(null);
      return;
    }
    const res = await fetchRegisteredDevices(currentUser.uid);
    if (res.success) {
      setRegisteredDevices(res.devices);
    }
    const serverStatus = await fetchServerDispatchStatus(currentUser.uid);
    setServerDispatchStatus(serverStatus);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      refreshRegisteredDevices();
    } else {
      setRegisteredDevices([]);
      setServerDispatchStatus(null);
    }
  }, [currentUser, refreshRegisteredDevices]);

  // Web Push Subscription & Multi-Device Reminder Sync to Cloud Firestore
  const syncPushSubscriptionToCloud = useCallback(
    async (tokenOverride?: string): Promise<{ success: boolean; error?: string }> => {
      setCloudPushError(null);
      if (!currentUser) {
        const err = 'Sign in to sync your device push token to your cloud account.';
        setCloudPushError(err);
        return { success: false, error: err };
      }
      const token = tokenOverride || userConfig.fcmToken;
      if (!token) {
        const err = 'No device push token registered on this browser.';
        setCloudPushError(err);
        return { success: false, error: err };
      }

      const res = await registerDevicePushSubscription(currentUser.uid, {
        token,
        timezone: userConfig.timezone,
        notificationPreferences: {
          notificationsPaused: userConfig.notificationsPaused,
          notificationFrequency: userConfig.notificationFrequency,
          primaryStudyWindow: userConfig.primaryStudyWindow,
          revisionWindow: userConfig.revisionWindow,
        },
      });

      if (res.success) {
        setUserConfig((prev) => ({
          ...prev,
          lastSubscriptionSyncAt: res.syncedAt || new Date().toISOString(),
          deviceSyncStatus: 'registered',
          deviceSyncError: null,
        }));
        await refreshRegisteredDevices();
        return { success: true };
      } else {
        const err = res.error || 'Failed to save device subscription in Firestore';
        setCloudPushError(err);
        setUserConfig((prev) => ({
          ...prev,
          deviceSyncStatus: 'sync_error',
          deviceSyncError: err,
        }));
        return { success: false, error: err };
      }
    },
    [currentUser, userConfig, refreshRegisteredDevices]
  );

  const deactivateDevice = useCallback(
    async (deviceId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: 'Sign in to manage devices' };
      const res = await deactivateDeviceSubscription(currentUser.uid, deviceId);
      if (res.success) {
        await refreshRegisteredDevices();
      }
      return res;
    },
    [currentUser, refreshRegisteredDevices]
  );

  const sendServerTestNotification = useCallback(async (): Promise<{
    success: boolean;
    status?: 'accepted_by_fcm' | 'partial_failure' | 'failed';
    error?: string;
    message?: string;
    acceptedDevices?: number;
    failedDevices?: number;
    deliveredDevices?: number;
    deviceOutcomes?: Record<string, any>;
  }> => {
    if (!currentUser) return { success: false, error: 'Sign in to trigger server delivery test' };
    const res = await triggerServerDeliveryTest();
    await refreshRegisteredDevices();
    return res;
  }, [currentUser, refreshRegisteredDevices]);

  // Honest notification delivery status calculation:
  // - Separates browser permission, FCM token registration, Firestore syncing, and server dispatch
  // - ONLY reports 'delivery_test_succeeded' after a distinct test notification confirmed displayed
  // - Accurately differentiates 'accepted_by_fcm' and 'partial_failure'
  const notificationDeliveryStatus = useMemo<NotificationDeliveryStatus>(() => {
    if (!isFirebaseConfigured()) return 'not_configured';
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return 'permission_required';
    }
    if (!userConfig.fcmToken) {
      return 'token_pending';
    }
    if (!currentUser || !userConfig.lastSubscriptionSyncAt) {
      return 'token_registered';
    }
    // Only report 'delivery_test_succeeded' if confirmed on device
    if (serverDispatchStatus?.deliveryTestSucceeded) {
      return 'delivery_test_succeeded';
    }
    // Differentiate FCM accepted vs partial failure
    if (serverDispatchStatus?.lastTestDelivery?.status === 'accepted_by_fcm') {
      return 'accepted_by_fcm';
    }
    if (serverDispatchStatus?.lastTestDelivery?.status === 'partial_failure') {
      return 'partial_failure';
    }
    // If test failed or scheduler reported failure/degraded state
    if (
      serverDispatchStatus?.lastTestDelivery?.status === 'failed' ||
      serverDispatchStatus?.systemHeartbeatStatus === 'degraded' ||
      serverDispatchStatus?.systemHeartbeatStatus === 'error' ||
      serverDispatchStatus?.recentDelivery?.status === 'failed'
    ) {
      return 'delivery_error';
    }
    if (serverDispatchStatus?.isBackendDeployed) {
      return 'backend_configured';
    }
    return 'backend_not_deployed';
  }, [userConfig.fcmToken, userConfig.lastSubscriptionSyncAt, currentUser, serverDispatchStatus]);

  // Deep-linking from notification clicks (URL hash navigation)
  useEffect(() => {
    const handleUrlRoute = () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (!hash) return;

      const [sectionPart, queryPart] = hash.split('?');
      const validSections: NavSection[] = [
        'dashboard',
        'focus',
        'syllabus',
        'roadmap',
        'timetable',
        'tasks',
        'calendar',
        'pyq',
        'pyq_library',
        'mocks',
        'revision',
        'analytics',
        'settings',
      ];

      if (validSections.includes(sectionPart as NavSection)) {
        setActiveSection(sectionPart as NavSection);
      }

      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        const topicId = params.get('topic') || params.get('topicId');
        if (topicId) {
          const found = allTrackableTopics.find((t) => t.id === topicId);
          if (found) {
            setSelectedTopicForModal(found);
          }
        }
      }
    };

    handleUrlRoute();
    window.addEventListener('hashchange', handleUrlRoute);
    return () => window.removeEventListener('hashchange', handleUrlRoute);
  }, [allTrackableTopics]);

  // Foreground Push message event receiver
  useEffect(() => {
    const handlePushEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        const { title, body, targetUrl } = customEvent.detail;
        setNotifications((prev) => [
          {
            id: `push-${Date.now()}`,
            type: 'revision_due',
            title: title || 'PrepPilot • Study Reminder',
            message: body || 'You have an upcoming study session.',
            timestamp: new Date().toISOString(),
            read: false,
            dismissed: false,
            actionUrl:
              targetUrl && targetUrl.includes('mocks')
                ? 'mocks'
                : targetUrl && targetUrl.includes('syllabus')
                ? 'syllabus'
                : 'tasks',
          },
          ...prev,
        ]);
      }
    };
    window.addEventListener('preppilot-push-received', handlePushEvent);
    return () => window.removeEventListener('preppilot-push-received', handlePushEvent);
  }, []);

  const sendLocalTestNotification = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { success: false, error: 'Browser notifications are not supported on this platform.' };
    }

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      return { success: false, error: 'Browser notification permission was not granted.' };
    }

    try {
      const nowIso = new Date().toISOString();
      const testTitle = 'PrepPilot • Study Reminder Test';
      const testBody = 'Notification delivery is verified and operational on this device!';

      // Prefer showing via active Service Worker registration
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          if (reg && 'showNotification' in reg) {
            await reg.showNotification(testTitle, {
              body: testBody,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: 'preppilot-test-verification',
            });
            setUserConfig((prev) => ({ ...prev, lastLocalDeliveryVerifiedAt: nowIso }));
            return { success: true };
          }
        } catch {
          // fallback to Notification constructor
        }
      }

      new Notification(testTitle, {
        body: testBody,
        icon: '/pwa-192x192.png',
        tag: 'preppilot-test-verification',
      });
      setUserConfig((prev) => ({ ...prev, lastLocalDeliveryVerifiedAt: nowIso }));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to display test notification.' };
    }
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
      if (parsed.userConfig) {
        // Strip obsolete darkMode property if present in old backup files
        const { darkMode: _obsoleteDarkMode, ...cleanConfig } = parsed.userConfig as any;
        setUserConfig((prev) => ({ ...prev, ...cleanConfig }));
      }
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
    const upcomingTest = visibleMockTests.find((t) => !t.completed && t.scheduledDate >= todayDate);
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
  }, [allTrackableTopics, visibleMockTests, todayDate, userConfig.notificationsPaused, userConfig.inAppRemindersEnabled]);

  const value: AppContextType = {
    activeSection,
    setActiveSection,
    selectedTopicForModal,
    setSelectedTopicForModal,
    todayDate,
    subjects,
    tasks: visibleTasks,
    timetableSlots: visibleTimetableSlots,
    studySessions: visibleStudySessions,
    pyqEntries: visiblePYQEntries,
    mockTests: visibleMockTests,
    errorLogs: visibleErrorLogs,
    revisionItems: visibleRevisionItems,
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
    currentUser,
    authLoading,
    syncStatusState,
    lastCloudSyncAt,
    syncErrorMessage,
    hasPendingOfflineChanges,
    isFirebaseConfigured: isFirebaseConfigured(),
    authModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    signInWithGoogle: handleSignInWithGoogle,
    signInWithEmail: handleSignInWithEmail,
    signUpWithEmail: handleSignUpWithEmail,
    sendPasswordReset: handleSendPasswordReset,
    resendVerificationEmail: handleResendVerificationEmail,
    checkEmailVerification: handleCheckEmailVerification,
    signOut: handleSignOut,
    forceCloudSync,
    migrationPrompt,
    resolveMigration,
    dismissMigration,
    restorePreMigrationBackupKey,
    continueStudying,
    exportBackupJSON,
    importBackupJSON,
    resetAllData,
    syncPushSubscriptionToCloud,
    sendLocalTestNotification,
    sendServerTestNotification,
    registeredDevices,
    refreshRegisteredDevices,
    deactivateDevice,
    serverDispatchStatus,
    notificationDeliveryStatus,
    cloudPushError,
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
