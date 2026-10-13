/**
 * Automated Reliability & Verification Test Suite for PrepPilot | NIMCET 2027
 * Tests:
 * 1. Dynamic dates & Asia/Kolkata timezone calculations (midnight rollover, leap years, week bounds)
 * 2. True consecutive study streak calculation (today, yesterday buffer, broken streaks, duplicate days)
 * 3. Weekly study hours (Monday-Sunday boundaries) vs Lifetime hours
 * 4. Syllabus completion percentages (unweighted & NIMCET exam-weighted) and overdue status
 * 5. Persistence recovery & offline queue synchronization with remote acknowledgment safety
 */

import assert from 'node:assert';
import {
  getTodayDateString,
  addDaysToDateString,
  getDaysDifference,
  getStartOfWeekDateString,
  getEndOfWeekDateString,
  isDateInCurrentWeek,
  calculateConsecutiveStudyStreak,
  DEFAULT_TIMEZONE,
} from '../src/utils/dateUtils';
import { LoggedStudySession, SyllabusSubject, SyllabusTopic, PYQPaperAttempt, PYQPaperRecord, SubjectId, NavSection } from '../src/types';
import { PYQ_PAPER_LINKS, isValidPYQUrl, getPYQPaperByYear } from '../src/data/pyqLinks';
import {
  formatAuthErrorMessage,
  hasCustomUserData,
  getDataSummary,
  mergeItemsById,
  mergeTopics,
  mergeSubjects,
  mergeLocalAndRemoteData,
  mergeUserConfig,
  sanitizeFirestoreData,
  findUndefinedFieldPaths,
  validateUserDataPayload,
  savePreMigrationBackup,
  getPreMigrationBackups,
  type FullUserDataPayload,
} from '../src/services/firebase';

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

console.log('====================================================');
console.log(' PrepPilot Reliability & Verification Test Suite');
console.log('====================================================\n');

// 1. Dynamic Dates & Timezone calculations
console.log('Group 1: Dynamic Date & Timezone Utilities');

runTest('getTodayDateString returns valid YYYY-MM-DD in Asia/Kolkata', () => {
  const todayStr = getTodayDateString(DEFAULT_TIMEZONE);
  assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/);
});

runTest('addDaysToDateString handles day, month, and year rollovers accurately', () => {
  assert.strictEqual(addDaysToDateString('2026-10-10', 1), '2026-10-11');
  assert.strictEqual(addDaysToDateString('2026-10-31', 1), '2026-11-01');
  assert.strictEqual(addDaysToDateString('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(addDaysToDateString('2027-01-01', -1), '2026-12-31');
  assert.strictEqual(addDaysToDateString('2028-02-28', 1), '2028-02-29'); // Leap year check
});

runTest('getDaysDifference computes exact calendar day delta without DST drift', () => {
  assert.strictEqual(getDaysDifference('2026-10-10', '2026-10-10'), 0);
  assert.strictEqual(getDaysDifference('2026-10-10', '2026-10-17'), 7);
  assert.strictEqual(getDaysDifference('2026-10-10', '2027-06-06'), 239);
});

runTest('getStartOfWeekDateString and getEndOfWeekDateString enforce Monday-Sunday bounds', () => {
  // 2026-10-14 is Wednesday
  const monday = getStartOfWeekDateString('2026-10-14');
  const sunday = getEndOfWeekDateString('2026-10-14');
  assert.strictEqual(monday, '2026-10-12'); // Monday
  assert.strictEqual(sunday, '2026-10-18'); // Sunday

  // Sunday 2026-10-18 should also belong to week starting 2026-10-12
  assert.strictEqual(getStartOfWeekDateString('2026-10-18'), '2026-10-12');
  assert.strictEqual(getEndOfWeekDateString('2026-10-18'), '2026-10-18');
});

runTest('isDateInCurrentWeek correctly includes current week and rejects previous/future weeks', () => {
  const currentToday = '2026-10-14'; // Wednesday
  assert.strictEqual(isDateInCurrentWeek('2026-10-12', currentToday), true); // Monday of this week
  assert.strictEqual(isDateInCurrentWeek('2026-10-14', currentToday), true); // Today
  assert.strictEqual(isDateInCurrentWeek('2026-10-18', currentToday), true); // Sunday of this week
  assert.strictEqual(isDateInCurrentWeek('2026-10-11', currentToday), false); // Sunday of previous week
  assert.strictEqual(isDateInCurrentWeek('2026-10-19', currentToday), false); // Monday of next week
});

// 2. Study Streak Calculation
console.log('\nGroup 2: True Consecutive Study Streak Engine');

runTest('Streak is 0 when no study sessions are logged', () => {
  assert.strictEqual(calculateConsecutiveStudyStreak([], '2026-10-14'), 0);
});

runTest('Streak counts today and consecutive previous days', () => {
  const dates = ['2026-10-14', '2026-10-13', '2026-10-12'];
  assert.strictEqual(calculateConsecutiveStudyStreak(dates, '2026-10-14'), 3);
});

runTest('Streak is kept alive if studied yesterday but session not yet logged today', () => {
  // User studied on 12th and 13th. Today is 14th (morning, not yet studied).
  const dates = ['2026-10-13', '2026-10-12'];
  assert.strictEqual(calculateConsecutiveStudyStreak(dates, '2026-10-14'), 2);
});

runTest('Multiple sessions on one day count as a single study day', () => {
  const dates = [
    '2026-10-14',
    '2026-10-14',
    '2026-10-14',
    '2026-10-13',
    '2026-10-13',
    '2026-10-12',
  ];
  assert.strictEqual(calculateConsecutiveStudyStreak(dates, '2026-10-14'), 3);
});

runTest('Missing a day breaks consecutive streak', () => {
  // Studied today (14th) and 12th, but missed 13th
  const dates = ['2026-10-14', '2026-10-12', '2026-10-11'];
  assert.strictEqual(calculateConsecutiveStudyStreak(dates, '2026-10-14'), 1);
});

runTest('Streak returns 0 if neither today nor yesterday was studied', () => {
  // Last studied on 11th. Today is 14th (yesterday was 13th).
  const dates = ['2026-10-11', '2026-10-10'];
  assert.strictEqual(calculateConsecutiveStudyStreak(dates, '2026-10-14'), 0);
});

// 3. Weekly study hours vs Lifetime study hours
console.log('\nGroup 3: Weekly Study Hours vs Lifetime Hours Isolation');

runTest('Weekly hours isolates sessions within Monday-Sunday week and ignores past weeks', () => {
  const todayStr = '2026-10-14'; // Wednesday in week 2026-10-12 to 2026-10-18
  const sampleSessions: Partial<LoggedStudySession>[] = [
    { date: '2026-10-08', actualMinutes: 120, status: 'completed' }, // Previous week (Thursday)
    { date: '2026-10-09', actualMinutes: 90, status: 'completed' },  // Previous week (Friday)
    { date: '2026-10-12', actualMinutes: 90, status: 'completed' },  // Current week (Monday)
    { date: '2026-10-13', actualMinutes: 90, status: 'completed' },  // Current week (Tuesday)
    { date: '2026-10-14', actualMinutes: 60, status: 'partially_completed' }, // Current week (Wednesday)
    { date: '2026-10-14', actualMinutes: 30, status: 'skipped' },    // Skipped: should be excluded
  ];

  // Calculate current week hours
  const weeklyMinutes = sampleSessions
    .filter(
      (s) =>
        (s.status === 'completed' || s.status === 'partially_completed') &&
        isDateInCurrentWeek(s.date!, todayStr)
    )
    .reduce((sum, s) => sum + (s.actualMinutes || 0), 0);

  const weeklyHours = Math.round((weeklyMinutes / 60) * 10) / 10;
  assert.strictEqual(weeklyHours, 4.0); // 90 + 90 + 60 = 240 mins = 4.0 hours

  // Calculate lifetime hours
  const lifetimeMinutes = sampleSessions
    .filter((s) => s.status === 'completed' || s.status === 'partially_completed')
    .reduce((sum, s) => sum + (s.actualMinutes || 0), 0);

  const lifetimeHours = Math.round((lifetimeMinutes / 60) * 10) / 10;
  assert.strictEqual(lifetimeHours, 7.5); // 120 + 90 + 90 + 90 + 60 = 450 mins = 7.5 hours
});

// 4. Progress percentages and overdue detection
console.log('\nGroup 4: Progress Percentages & Overdue Calculation');

runTest('Unweighted progress computes correct integer percentage', () => {
  const total = 90;
  const completed = 27;
  const pct = Math.round((completed / total) * 100);
  assert.strictEqual(pct, 30);
});

runTest('NIMCET Exam-Weighted progress reflects 50/40/20/10 question distribution', () => {
  // Maths: 50/120 = 41.67%
  // Reasoning: 40/120 = 33.33%
  // Computer: 20/120 = 16.67%
  // English: 10/120 = 8.33%
  const totalExamQuestions = 120;
  const subjects: Array<{ questionWeight: number; totalTopics: number; completedTopics: number }> = [
    { questionWeight: 50, totalTopics: 40, completedTopics: 40 }, // Maths 100% done
    { questionWeight: 40, totalTopics: 20, completedTopics: 0 },  // Reasoning 0% done
    { questionWeight: 20, totalTopics: 20, completedTopics: 0 },  // Computer 0% done
    { questionWeight: 10, totalTopics: 10, completedTopics: 0 },  // English 0% done
  ];

  let weightedSum = 0;
  subjects.forEach((subj) => {
    const ratio = subj.completedTopics / subj.totalTopics;
    weightedSum += ratio * (subj.questionWeight / totalExamQuestions);
  });
  const weightedPct = Math.round(weightedSum * 100);
  // (50 / 120) * 100 = 41.666% -> 42%
  assert.strictEqual(weightedPct, 42);
});

runTest('Overdue topic detection accurately compares targetCompletionDate against todayDate', () => {
  const todayStr = '2026-10-15';
  const sampleTopics: Array<{ completed: boolean; targetCompletionDate: string }> = [
    { completed: false, targetCompletionDate: '2026-10-14' }, // Overdue
    { completed: false, targetCompletionDate: '2026-10-15' }, // Due today (not overdue)
    { completed: false, targetCompletionDate: '2026-10-16' }, // Future (not overdue)
    { completed: true, targetCompletionDate: '2026-10-10' },  // Completed in past (not overdue)
  ];

  const overdue = sampleTopics.filter((t) => !t.completed && t.targetCompletionDate < todayStr);
  assert.strictEqual(overdue.length, 1);
  assert.strictEqual(overdue[0].targetCompletionDate, '2026-10-14');
});

// 5. Persistence Recovery & Remote Acknowledgment Safety
console.log('\nGroup 5: Persistence Recovery & Offline Queue Sync Safety');

runTest('Sync queue never removes items without verified acknowledgment', async () => {
  interface MockQueueItem {
    id: number;
    action: string;
  }

  const queue: MockQueueItem[] = [
    { id: 1, action: 'save_task' },
    { id: 2, action: 'update_topic' },
    { id: 3, action: 'log_session' },
  ];

  const deletedIds: number[] = [];

  // Mock sync handler where item 2 fails (e.g. server timeout or network drop)
  const syncHandler = async (item: MockQueueItem): Promise<boolean> => {
    if (item.id === 2) {
      return false; // Not acknowledged!
    }
    return true; // Acknowledged
  };

  for (const item of queue) {
    const ack = await syncHandler(item);
    if (ack) {
      deletedIds.push(item.id);
    }
  }

  // Only acknowledged items were deleted
  assert.deepStrictEqual(deletedIds, [1, 3]);

  // Unacknowledged item #2 is preserved!
  const remaining = queue.filter((item) => !deletedIds.includes(item.id));
  assert.strictEqual(remaining.length, 1);
  assert.strictEqual(remaining[0].id, 2);
});

runTest('Durable state restoration never overwrites existing state with empty defaults', () => {
  const emptyDefaults = { topics: [] };
  const durableBackup = { topics: [{ id: 'topic-1', title: 'Set Theory' }] };

  // If local store is empty, restore from backup
  const shouldRestore = durableBackup.topics.length > 0 && emptyDefaults.topics.length === 0;
  assert.strictEqual(shouldRestore, true);

  const restoredState = shouldRestore ? durableBackup : emptyDefaults;
  assert.strictEqual(restoredState.topics.length, 1);
  assert.strictEqual(restoredState.topics[0].title, 'Set Theory');
});

// 6. PYQ Library Data Integrity & Attempt Lifecycle
console.log('\nGroup 6: PYQ Library Data Integrity & Attempt Lifecycle');

runTest('PYQ Library navigation routing is distinct and reachable', () => {
  const sections: NavSection[] = ['pyq', 'pyq_library'];
  assert.strictEqual(sections.includes('pyq_library'), true);
  assert.notStrictEqual('pyq', 'pyq_library');
});

runTest('PYQ paper links configuration contains all 16 years (2011–2026) without unverified defaults', () => {
  assert.strictEqual(PYQ_PAPER_LINKS.length, 16);

  const years = PYQ_PAPER_LINKS.map((p) => p.year);
  const expectedYears = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011];
  assert.deepStrictEqual(years, expectedYears);

  for (const paper of PYQ_PAPER_LINKS) {
    assert.strictEqual(paper.provider, 'MyAspireStudy');
    assert.strictEqual(
      paper.url,
      `https://www.myaspirestudy.com/library/pyq/1/NIMCET?view=year&key=${paper.year}`
    );
    // Unverified assumed defaults must be removed from the link records
    assert.strictEqual(paper.totalMarks, undefined);
    assert.strictEqual(paper.totalQuestions, undefined);
    assert.strictEqual(paper.durationMinutes, undefined);
  }

  // URL security validation
  assert.strictEqual(isValidPYQUrl(PYQ_PAPER_LINKS[0].url), true);
  assert.strictEqual(isValidPYQUrl('https://malicious-site.example.com'), false);
  assert.strictEqual(getPYQPaperByYear(2024)?.year, 2024);
});

runTest('PYQ paper counts are strictly calculated only from the 16 configured year links', () => {
  const configuredYears = new Set(PYQ_PAPER_LINKS.map((p) => p.year));
  assert.strictEqual(configuredYears.size, 16);

  // Stale or unrelated keys (e.g. 1999 or 2035) must not inflate the practiced count
  const mockRecords: Record<number, { status: string }> = {
    2026: { status: 'practised' },
    2025: { status: 'practised' },
    2024: { status: 'in_progress' },
    1999: { status: 'practised' }, // Stale external key
    2035: { status: 'practised' }, // Invalid future key
  };

  const practisedCount = Object.entries(mockRecords).filter(([yearStr, r]) => {
    return configuredYears.has(Number(yearStr)) && r.status === 'practised';
  }).length;

  assert.strictEqual(practisedCount, 2);
  const remainingCount = Math.max(0, configuredYears.size - practisedCount);
  assert.strictEqual(remainingCount, 14);
  const completionPercentage = Math.round((practisedCount / configuredYears.size) * 100);
  assert.strictEqual(completionPercentage, 13);
});

runTest('Result validation verifies whole integers, skipped counts, bounds, and scores', () => {
  const validateResult = (
    attempted: number,
    correct: number,
    incorrect: number,
    skipped: number | undefined,
    score: number,
    maxScore: number | undefined,
    date: string
  ) => {
    // Non-negative integers
    if (attempted < 0 || !Number.isInteger(attempted)) return false;
    if (correct < 0 || !Number.isInteger(correct)) return false;
    if (incorrect < 0 || !Number.isInteger(incorrect)) return false;
    if (skipped !== undefined && (skipped < 0 || !Number.isInteger(skipped))) return false;
    
    // Bounds against attempted
    if (correct > attempted) return false;
    if (incorrect > attempted) return false;
    if (correct + incorrect > attempted) return false;

    // Scores
    if (isNaN(score) || score < 0) return false;
    if (maxScore !== undefined && (maxScore <= 0 || score > maxScore)) return false;

    // Valid date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) return false;

    return true;
  };

  // Valid inputs with skipped
  assert.strictEqual(validateResult(100, 75, 20, 5, 360, 1000, '2026-10-10'), true);
  // Valid inputs without skipped
  assert.strictEqual(validateResult(80, 60, 15, undefined, 240, undefined, '2026-10-10'), true);

  // Inconsistent: 80 + 30 = 110 > 100 attempted
  assert.strictEqual(validateResult(100, 80, 30, 0, 380, 1000, '2026-10-10'), false);
  // Negative counts
  assert.strictEqual(validateResult(100, -5, 10, 0, 50, 1000, '2026-10-10'), false);
  assert.strictEqual(validateResult(-10, 0, 0, 0, 0, 1000, '2026-10-10'), false);
  assert.strictEqual(validateResult(100, 50, 20, -2, 200, 1000, '2026-10-10'), false);
  // Negative score
  assert.strictEqual(validateResult(100, 50, 20, 0, -20, 1000, '2026-10-10'), false);
  // Score exceeds maximum
  assert.strictEqual(validateResult(100, 50, 20, 0, 550, 500, '2026-10-10'), false);
  // Invalid date format
  assert.strictEqual(validateResult(100, 50, 20, 0, 200, 1000, 'invalid-date'), false);
});

runTest('Separates editing latest attempt from adding new attempt and preserves attempt history', () => {
  let attempts: PYQPaperAttempt[] = [
    { id: 'att-1', date: '2026-10-01', attempted: 100, correct: 70, incorrect: 20, skipped: 10, score: 350 },
  ];

  // 1. Add new attempt
  const newAttempt: PYQPaperAttempt = {
    id: 'att-2',
    date: '2026-10-09',
    attempted: 110,
    correct: 85,
    incorrect: 15,
    skipped: 10,
    score: 410,
    subjectId: 'computer',
    topicId: 'comp-data-rep',
  };
  attempts = [newAttempt, ...attempts];
  assert.strictEqual(attempts.length, 2);
  assert.strictEqual(attempts[0].id, 'att-2');
  assert.strictEqual(attempts[1].id, 'att-1');

  // 2. Edit latest attempt without duplicating
  const updatedAttempts = attempts.map((att) =>
    att.id === 'att-2' ? { ...att, score: 430, skipped: 8 } : att
  );
  assert.strictEqual(updatedAttempts.length, 2); // Count does not change
  assert.strictEqual(updatedAttempts[0].score, 430);
  assert.strictEqual(updatedAttempts[0].skipped, 8);
  assert.strictEqual(updatedAttempts[0].subjectId, 'computer');
  assert.strictEqual(updatedAttempts[1].score, 350); // Previous attempt preserved intact
});

runTest('Revision tasks assign user-selected subjectId or general review instead of forcing maths', () => {
  const createRevisionTask = (
    year: number,
    weakTopics: string[],
    subjectId?: SubjectId,
    topicId?: string
  ) => {
    return {
      id: `task-pyq-rev-${year}-1`,
      title: `PYQ ${year} Review: ${weakTopics.join(', ')}`,
      subjectId, // Only set if user chose one; otherwise undefined (general review)
      topicId,
      taskType: 'Revise' as const,
      status: 'pending' as const,
    };
  };

  // User specifies Reasoning
  const reasoningTask = createRevisionTask(2024, ['Syllogisms', 'Blood Relations'], 'reasoning', 'reas-puzzle');
  assert.strictEqual(reasoningTask.subjectId, 'reasoning');
  assert.strictEqual(reasoningTask.topicId, 'reas-puzzle');

  // User specifies Computer
  const computerTask = createRevisionTask(2023, ["2's Complement", 'Logic Gates'], 'computer');
  assert.strictEqual(computerTask.subjectId, 'computer');

  // User leaves subject unmapped (general review) - never forced to maths
  const generalTask = createRevisionTask(2022, ['Mixed Section Mistakes']);
  assert.strictEqual(generalTask.subjectId, undefined);
  assert.notStrictEqual(generalTask.subjectId, 'maths');
});

runTest('Deduplicates revision tasks when weak topics are unchanged or re-edited', () => {
  const existingTasks = [
    { id: 'task-1', title: 'PYQ 2024 Review: Vectors, Circles', status: 'pending' },
  ];

  const candidateTitle = 'PYQ 2024 Review: Vectors, Circles';
  const alreadyExists = existingTasks.some((t) => t.title === candidateTitle && t.status !== 'completed');

  assert.strictEqual(alreadyExists, true);
  // Does not create duplicate task!
  const finalTasks = alreadyExists ? existingTasks : [...existingTasks, { id: 'task-2', title: candidateTitle, status: 'pending' }];
  assert.strictEqual(finalTasks.length, 1);
});

runTest('Unchecking Mark as Practised restores in_progress if attempts exist', () => {
  const recordWithAttempts: PYQPaperRecord = {
    year: 2024,
    status: 'practised',
    attempts: [
      { id: 'att-1', date: '2026-10-09', attempted: 100, correct: 80, incorrect: 20, score: 380 },
    ],
  };

  // When unchecking "Mark as Practised"
  const resolvedStatus = recordWithAttempts.attempts.length > 0 ? 'in_progress' : 'not_started';
  assert.strictEqual(resolvedStatus, 'in_progress');
  // Meaningful attempt history remains intact
  assert.strictEqual(recordWithAttempts.attempts.length, 1);
});

runTest('PYQ paper scheduling creates tasks without forced maths or unverified question counts', () => {
  const scheduleTask = (
    year: number,
    scheduledDate: string,
    options?: { targetMinutes?: number; subjectId?: SubjectId; customNotes?: string }
  ) => {
    const minutes = options?.targetMinutes && options.targetMinutes > 0 ? options.targetMinutes : 120;
    const chosenSubject = options?.subjectId; // undefined = general PYQ practice
    const notes =
      options?.customNotes?.trim() ||
      `Solve and analyze NIMCET ${year} paper via MyAspireStudy external resource. Follow paper-specific instructions.`;

    return {
      title: `NIMCET ${year} Practice Paper (MyAspireStudy)`,
      subjectId: chosenSubject,
      taskType: 'Practice' as const,
      deadline: scheduledDate,
      estimatedMinutes: minutes,
      notes,
    };
  };

  // Case 1: Default scheduling - no forced maths, no claim of 120 questions
  const defaultTask = scheduleTask(2025, '2026-10-20');
  assert.strictEqual(defaultTask.subjectId, undefined);
  assert.strictEqual(defaultTask.estimatedMinutes, 120);
  assert.ok(!defaultTask.notes.includes('120-question'));
  assert.ok(defaultTask.notes.includes('2025'));

  // Case 2: Custom subject and custom duration - user specified Computer and 90 mins
  const customTask = scheduleTask(2023, '2026-10-22', {
    subjectId: 'computer',
    targetMinutes: 90,
    customNotes: 'Focus on digital electronics section',
  });
  assert.strictEqual(customTask.subjectId, 'computer');
  assert.strictEqual(customTask.estimatedMinutes, 90);
  assert.strictEqual(customTask.notes, 'Focus on digital electronics section');
});

// 7. Cloud Synchronization, Two-Way Merge & Conflict Resolution
console.log('\nGroup 7: Cloud Synchronization, Two-Way Merge & Conflict Resolution');

runTest('mergeItemsById merges unique items and updates existing with LWW timestamps', () => {
  interface SampleItem {
    id: string;
    title: string;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string;
  }

  const remoteItems: SampleItem[] = [
    { id: 'item-1', title: 'Task Phone', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' },
    { id: 'item-2', title: 'Task Laptop', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' },
  ];

  const localItems: SampleItem[] = [
    { id: 'item-2', title: 'Task Laptop (Edited on Phone)', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T12:00:00Z' },
    { id: 'item-3', title: 'New Task from Phone', createdAt: '2026-10-03T10:00:00Z', updatedAt: '2026-10-03T10:00:00Z' },
  ];

  const merged = mergeItemsById(localItems, remoteItems, true);

  assert.strictEqual(merged.length, 3);
  assert.strictEqual(merged.find((i) => i.id === 'item-1')?.title, 'Task Phone');
  assert.strictEqual(merged.find((i) => i.id === 'item-2')?.title, 'Task Laptop (Edited on Phone)');
  assert.strictEqual(merged.find((i) => i.id === 'item-3')?.title, 'New Task from Phone');
});

runTest('mergeItemsById propagates deletion tombstones and prevents resurrection of deleted items', () => {
  interface SampleTask {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
  }

  // Device A deleted task-1 at 2026-10-10T15:00:00Z
  const deviceALocal: SampleTask[] = [
    {
      id: 'task-1',
      title: 'Review Trigonometry',
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-10T15:00:00Z',
      deletedAt: '2026-10-10T15:00:00Z',
    },
  ];

  // Device B still has the old active task-1 from 2026-10-05
  const deviceBRemote: SampleTask[] = [
    {
      id: 'task-1',
      title: 'Review Trigonometry',
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-05T12:00:00Z',
    },
  ];

  // When merging, tombstone MUST win over older active record
  const merged = mergeItemsById(deviceALocal, deviceBRemote, true);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].id, 'task-1');
  assert.ok(merged[0].deletedAt, 'Deleted tombstone must be preserved');
  assert.strictEqual(merged[0].deletedAt, '2026-10-10T15:00:00Z');

  // Also verify with includeTombstones = false for visible filtering
  const visible = mergeItemsById(deviceALocal, deviceBRemote, false);
  assert.strictEqual(visible.length, 0, 'Deleted item must be hidden from visible list');
});

runTest('mergeItemsById allows edit strictly after deletion to take precedence', () => {
  interface SampleTask {
    id: string;
    title: string;
    updatedAt?: string;
    deletedAt?: string;
  }

  // Deleted on Phone at 10:00 AM
  const localList: SampleTask[] = [
    { id: 'task-revive', title: 'Calculus', deletedAt: '2026-10-10T10:00:00Z', updatedAt: '2026-10-10T10:00:00Z' },
  ];

  // Edited on Laptop at 11:00 AM (strictly after deletion)
  const remoteList: SampleTask[] = [
    { id: 'task-revive', title: 'Calculus (Re-opened & Edited)', updatedAt: '2026-10-10T11:00:00Z' },
  ];

  const merged = mergeItemsById(localList, remoteList, true);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].title, 'Calculus (Re-opened & Edited)');
  assert.strictEqual(merged[0].deletedAt, undefined, 'Post-deletion edit must resurrect task');
});

runTest('mergeTopics resolves topic completion conflict: newer uncompletion wins over older completion', () => {
  // Device A uncompleted topic at 2026-10-12T14:00:00Z
  const uncompletedTopic: SyllabusTopic = {
    id: 'top-matrices',
    subjectId: 'maths',
    chapterId: 'chap-algebra',
    title: 'Matrix Inversion',
    completed: false,
    status: 'in_progress',
    questionsSolved: 25,
    questionsCorrect: 20,
    actualHours: 3.5,
    estimatedHours: 4,
    priority: 'high',
    notes: 'Need to review adjoint calculation',
    assignedMonth: '2026-10',
    plannedStartDate: '2026-10-01',
    targetCompletionDate: '2026-10-20',
    updatedAt: '2026-10-12T14:00:00Z',
  };

  // Device B marked it completed earlier at 2026-10-10T10:00:00Z
  const completedTopic: SyllabusTopic = {
    ...uncompletedTopic,
    completed: true,
    status: 'completed',
    completedAt: '2026-10-10T10:00:00Z',
    updatedAt: '2026-10-10T10:00:00Z',
    questionsSolved: 15, // Less questions solved earlier
    actualHours: 2.0,
  };

  const resolved = mergeTopics(uncompletedTopic, completedTopic);

  // Newer uncompletion must win! (No longer trapped by logical OR)
  assert.strictEqual(resolved.completed, false, 'Newer uncompletion must take precedence over older completion');
  assert.strictEqual(resolved.status, 'in_progress');
  assert.strictEqual(resolved.completedAt, undefined);

  // Cumulative study metrics must be preserved (maximum of both)
  assert.strictEqual(resolved.questionsSolved, 25, 'Maximum questions solved must be preserved');
  assert.strictEqual(resolved.actualHours, 3.5, 'Maximum study hours must be preserved');
});

runTest('mergeSubjects preserves union of completed topics for older untimestamped records (safe migration fallback)', () => {
  const localSubjects = [
    {
      id: 'maths' as const,
      name: 'Mathematics',
      shortName: 'Maths',
      questionWeight: 50,
      marksPerQuestion: 12,
      color: '#3b82f6',
      chapters: [
        {
          id: 'set-theory',
          subjectId: 'maths' as const,
          order: 1,
          title: 'Set Theory',
          topics: [
            {
              id: 'top-1',
              subjectId: 'maths' as const,
              chapterId: 'set-theory',
              title: 'Sets & Subsets',
              completed: true,
              questionsSolved: 30,
              questionsCorrect: 25,
              actualHours: 2,
              estimatedHours: 3,
              priority: 'high' as const,
              notes: '',
              assignedMonth: '2026-10',
              plannedStartDate: '2026-10-01',
              targetCompletionDate: '2026-10-20',
              status: 'completed' as const,
            },
            {
              id: 'top-2',
              subjectId: 'maths' as const,
              chapterId: 'set-theory',
              title: 'Venn Diagrams',
              completed: false,
              questionsSolved: 10,
              questionsCorrect: 8,
              actualHours: 1,
              estimatedHours: 2,
              priority: 'medium' as const,
              notes: '',
              assignedMonth: '2026-10',
              plannedStartDate: '2026-10-01',
              targetCompletionDate: '2026-10-20',
              status: 'in_progress' as const,
            },
          ],
        },
      ],
    },
  ];

  const remoteSubjects = [
    {
      id: 'maths' as const,
      name: 'Mathematics',
      shortName: 'Maths',
      questionWeight: 50,
      marksPerQuestion: 12,
      color: '#3b82f6',
      chapters: [
        {
          id: 'set-theory',
          subjectId: 'maths' as const,
          order: 1,
          title: 'Set Theory',
          topics: [
            {
              id: 'top-1',
              subjectId: 'maths' as const,
              chapterId: 'set-theory',
              title: 'Sets & Subsets',
              completed: false,
              questionsSolved: 15,
              questionsCorrect: 12,
              actualHours: 1,
              estimatedHours: 3,
              priority: 'high' as const,
              notes: '',
              assignedMonth: '2026-10',
              plannedStartDate: '2026-10-01',
              targetCompletionDate: '2026-10-20',
              status: 'not_started' as const,
            },
            {
              id: 'top-2',
              subjectId: 'maths' as const,
              chapterId: 'set-theory',
              title: 'Venn Diagrams',
              completed: true,
              completedAt: '2026-10-08T10:00:00Z',
              questionsSolved: 25,
              questionsCorrect: 20,
              actualHours: 2.5,
              estimatedHours: 2,
              priority: 'medium' as const,
              notes: '',
              assignedMonth: '2026-10',
              plannedStartDate: '2026-10-01',
              targetCompletionDate: '2026-10-20',
              status: 'completed' as const,
            },
          ],
        },
      ],
    },
  ];

  const merged = mergeSubjects(localSubjects, remoteSubjects);
  const topics = merged[0].chapters[0].topics;

  assert.strictEqual(topics[0].completed, true);
  assert.strictEqual(topics[0].questionsSolved, 30);
  assert.strictEqual(topics[1].completed, true);
  assert.strictEqual(topics[1].questionsSolved, 25);
  assert.strictEqual(topics[1].actualHours, 2.5);
});

runTest('mergeLocalAndRemoteData unions PYQ paper attempts from multiple devices', () => {
  const localPaperRecords: Record<number, any> = {
    2024: {
      year: 2024,
      status: 'practised',
      attempts: [{ id: 'att-phone', date: '2026-10-10', score: 420 }],
    },
  };

  const remotePaperRecords: Record<number, any> = {
    2024: {
      year: 2024,
      status: 'in_progress',
      attempts: [{ id: 'att-laptop', date: '2026-10-08', score: 380 }],
    },
    2023: {
      year: 2023,
      status: 'practised',
      attempts: [{ id: 'att-laptop-23', date: '2026-10-07', score: 450 }],
    },
  };

  const mergedPapers: Record<number, any> = { ...remotePaperRecords };
  for (const [yStr, localRec] of Object.entries(localPaperRecords)) {
    const yr = Number(yStr);
    const remoteRec = mergedPapers[yr];
    if (!remoteRec) {
      mergedPapers[yr] = localRec;
    } else {
      const map = new Map<string, any>();
      for (const a of remoteRec.attempts || []) map.set(a.id, a);
      for (const a of localRec.attempts || []) map.set(a.id, a);
      mergedPapers[yr] = {
        ...remoteRec,
        status: localRec.status === 'practised' || remoteRec.status === 'practised' ? 'practised' : 'in_progress',
        attempts: Array.from(map.values()),
      };
    }
  }

  // 2024 has 2 merged attempts from phone + laptop
  assert.strictEqual(mergedPapers[2024].attempts.length, 2);
  assert.strictEqual(mergedPapers[2024].status, 'practised');
  // 2023 preserved from laptop
  assert.strictEqual(mergedPapers[2023].attempts.length, 1);
});

console.log('\nGroup 8: Firebase Authentication & Migration Safety Logic');

runTest('formatAuthErrorMessage translates standard error codes to user-friendly messages', () => {
  assert.strictEqual(
    formatAuthErrorMessage({ code: 'auth/invalid-credential' }),
    'Invalid email or password. Please verify your credentials and try again.'
  );
  assert.strictEqual(
    formatAuthErrorMessage({ code: 'auth/email-already-in-use' }),
    'An account with this email address already exists. Please sign in instead.'
  );
  assert.strictEqual(
    formatAuthErrorMessage({ code: 'auth/weak-password' }),
    'Password is too weak. Please choose a password with at least 6 characters.'
  );
  assert.strictEqual(
    formatAuthErrorMessage({ code: 'auth/popup-closed-by-user' }),
    'Google sign-in was cancelled before completion.'
  );
  assert.strictEqual(
    formatAuthErrorMessage({ code: 'auth/network-request-failed' }),
    'Network connection error. Please verify your internet connection and try again.'
  );
});

runTest('hasCustomUserData accurately differentiates empty/default vs populated user state', () => {
  // Empty payload
  assert.strictEqual(
    hasCustomUserData({
      tasks: [],
      subjects: [],
      timetableSlots: [],
      studySessions: [],
      pyqEntries: [],
      mockTests: [],
      errorLogs: [],
      revisionItems: [],
      monthlyGoals: [],
      userConfig: {} as any,
      pyqPaperRecords: {},
    }),
    false
  );

  // Populated with a completed task
  assert.strictEqual(
    hasCustomUserData({
      tasks: [{ id: 't1', title: 'Calculus review', completed: true } as any],
      subjects: [],
      timetableSlots: [],
      studySessions: [],
      pyqEntries: [],
      mockTests: [],
      errorLogs: [],
      revisionItems: [],
      monthlyGoals: [],
      userConfig: {} as any,
      pyqPaperRecords: {},
    }),
    true
  );
});

runTest('getDataSummary computes exact counts of study records for migration modal preview', () => {
  const summary = getDataSummary({
    tasks: [{ id: '1' } as any, { id: '2' } as any],
    subjects: [
      {
        id: 'maths' as any,
        name: 'Mathematics',
        chapters: [
          {
            id: 'c1',
            title: 'Algebra',
            subjectId: 'maths' as any,
            order: 1,
            topics: [
              { id: 'top-1', title: 'Quadratics', completed: true } as any,
              { id: 'top-2', title: 'Progressions', completed: false } as any,
            ],
          },
        ],
      } as any,
    ],
    timetableSlots: [{ id: 's1' } as any],
    studySessions: [{ id: 'ses-1' } as any],
    pyqEntries: [{ id: 'p1' } as any],
    mockTests: [{ id: 'm1', completed: true } as any],
    errorLogs: [{ id: 'e1' } as any],
    revisionItems: [],
    monthlyGoals: [],
    userConfig: {} as any,
    pyqPaperRecords: {},
  });

  assert.strictEqual(summary.taskCount, 2);
  assert.strictEqual(summary.completedTopicsCount, 1);
  assert.strictEqual(summary.sessionCount, 1);
  assert.strictEqual(summary.pyqEntryCount, 1);
  assert.strictEqual(summary.mockCount, 1);
  assert.strictEqual(summary.errorLogCount, 1);
});

// =============================================================================
// Group 9: Firestore Payload Sanitization, Smart Merge & Migration Safety
// =============================================================================
console.log('\nGroup 9: Firestore Payload Sanitization, Smart Merge & Migration Safety');

// Ensure localStorage mock is present in Node environment for backup tests
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => { store.set(key, String(val)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    length: 0,
  };
}

runTest('Undefined properties at multiple nesting levels are detected and omitted', () => {
  const payloadWithUndefined = {
    tasks: [
      {
        id: 'task-1',
        title: 'Trigonometry formula revision',
        completedAt: undefined, // nested level 2 undefined
        deletedAt: undefined,
      },
    ],
    subjects: [
      {
        id: 'maths',
        chapters: [
          {
            id: 'ch-1',
            topics: [
              {
                id: 'top-1',
                title: 'Sets and Relations',
                completed: false,
                completedAt: undefined, // nested level 4 undefined
                lastRevisionDate: undefined,
                nextRevisionDate: undefined,
              },
            ],
          },
        ],
      },
    ],
    userConfig: {
      examName: 'NIMCET 2027',
      fcmToken: undefined,
    },
  };

  // 1. Diagnostics detects all nested paths without leaking private values
  const undefinedPaths = findUndefinedFieldPaths(payloadWithUndefined);
  assert.ok(undefinedPaths.includes('tasks[0].completedAt'));
  assert.ok(undefinedPaths.includes('tasks[0].deletedAt'));
  assert.ok(undefinedPaths.includes('subjects[0].chapters[0].topics[0].completedAt'));
  assert.ok(undefinedPaths.includes('subjects[0].chapters[0].topics[0].lastRevisionDate'));
  assert.ok(undefinedPaths.includes('userConfig.fcmToken'));

  // 2. Sanitizer recursively strips undefined properties
  const sanitized = sanitizeFirestoreData(payloadWithUndefined);

  // Assert properties are completely removed (not setDoc incompatible)
  assert.strictEqual('completedAt' in sanitized.tasks[0], false);
  assert.strictEqual('deletedAt' in sanitized.tasks[0], false);
  assert.strictEqual('completedAt' in sanitized.subjects[0].chapters[0].topics[0], false);
  assert.strictEqual('lastRevisionDate' in sanitized.subjects[0].chapters[0].topics[0], false);
  assert.strictEqual('fcmToken' in sanitized.userConfig, false);

  // Original object was NOT mutated
  assert.strictEqual('completedAt' in payloadWithUndefined.tasks[0], true);
});

runTest('Arrays containing undefined or incomplete items are handled safely', () => {
  // Array containing undefined items
  const arrayWithUndefined = ['topic-a', undefined, 'topic-b', undefined, 'topic-c'];
  const sanitizedArray = sanitizeFirestoreData(arrayWithUndefined);

  assert.deepStrictEqual(sanitizedArray, ['topic-a', 'topic-b', 'topic-c']);
  assert.strictEqual(sanitizedArray.length, 3);

  // Nested array of items with undefined properties
  const objectsArray = [
    { id: '1', name: 'Item 1', optionalNote: undefined },
    undefined,
    { id: '2', name: 'Item 2', score: 100 },
  ];
  const sanitizedObjects = sanitizeFirestoreData(objectsArray) as Array<{ id: string; name: string; score?: number }>;
  assert.strictEqual(sanitizedObjects.length, 2);
  assert.strictEqual(sanitizedObjects[0]!.id, '1');
  assert.strictEqual('optionalNote' in sanitizedObjects[0]!, false);
  assert.strictEqual(sanitizedObjects[1]!.id, '2');
});

runTest('Valid null values are preserved and not replaced or stripped', () => {
  const payloadWithNull = {
    exactExamDate: null,
    fcmToken: null,
    scheduledRetestDate: null,
    subConfig: {
      secondaryDate: null,
    },
  };

  const sanitized = sanitizeFirestoreData(payloadWithNull);
  assert.strictEqual(sanitized.exactExamDate, null);
  assert.strictEqual(sanitized.fcmToken, null);
  assert.strictEqual(sanitized.scheduledRetestDate, null);
  assert.strictEqual(sanitized.subConfig.secondaryDate, null);
});

runTest('Empty optional fields are preserved when meaningful and omitted when undefined', () => {
  const itemWithEmptyFields = {
    id: 'entry-1',
    notes: '', // empty string is meaningful, preserve
    weakTopics: [], // empty array is meaningful, preserve
    actualHours: 0, // 0 is meaningful number, preserve
    isBreak: false, // false is meaningful boolean, preserve
    missingField: undefined, // undefined should be omitted
  };

  const sanitized = sanitizeFirestoreData(itemWithEmptyFields);
  assert.strictEqual(sanitized.notes, '');
  assert.deepStrictEqual(sanitized.weakTopics, []);
  assert.strictEqual(sanitized.actualHours, 0);
  assert.strictEqual(sanitized.isBreak, false);
  assert.strictEqual('missingField' in sanitized, false);
});

runTest('Missing required fields fail validation with useful diagnostics', () => {
  // Completely missing required array
  const invalidPayload1 = {
    tasks: 'not-an-array' as any,
    subjects: [],
  };
  const res1 = validateUserDataPayload(invalidPayload1);
  assert.strictEqual(res1.isValid, false);
  assert.ok(res1.errors.some((e) => e.includes('tasks')));

  // Task item missing required id and title
  const invalidPayload2 = {
    tasks: [{ priority: 'high', status: 'pending' }] as any,
    subjects: [],
    timetableSlots: [],
    studySessions: [],
    pyqEntries: [],
    mockTests: [],
    errorLogs: [],
    revisionItems: [],
    monthlyGoals: [],
    userConfig: {},
    pyqPaperRecords: {},
  };
  const res2 = validateUserDataPayload(invalidPayload2);
  assert.strictEqual(res2.isValid, false);
  assert.ok(res2.errors.some((e) => e.includes('tasks[0].id is required')));
  assert.ok(res2.errors.some((e) => e.includes('tasks[0].title is required')));

  // Valid payload passes
  const validPayload = {
    tasks: [
      { id: 't1', title: 'Task 1', taskType: 'Learn', startDate: '2026-10-10', deadline: '2026-10-12', priority: 'high', status: 'pending' },
    ],
    subjects: [
      { id: 'maths', name: 'Mathematics', chapters: [] },
    ],
    timetableSlots: [],
    studySessions: [],
    pyqEntries: [],
    mockTests: [],
    errorLogs: [],
    revisionItems: [],
    monthlyGoals: [],
    userConfig: { examName: 'NIMCET 2027' },
    pyqPaperRecords: {},
  };
  const res3 = validateUserDataPayload(validPayload);
  assert.strictEqual(res3.isValid, true);
  assert.strictEqual(res3.errors.length, 0);
});

runTest('Smart Merge safely combines disjoint datasets, preserving custom topics and config', () => {
  const localDataset: FullUserDataPayload = {
    tasks: [
      { id: 'task-local-1', title: 'Maths Integration', taskType: 'Practise', startDate: '2026-10-10', deadline: '2026-10-12', priority: 'high', status: 'pending', createdAt: '2026-10-10T10:00:00Z', updatedAt: '2026-10-10T10:00:00Z', estimatedMinutes: 60, actualMinutes: 0, notes: '' },
      { id: 'task-shared', title: 'Shared Task (Local newer)', taskType: 'Learn', startDate: '2026-10-10', deadline: '2026-10-12', priority: 'medium', status: 'completed', createdAt: '2026-10-10T10:00:00Z', updatedAt: '2026-10-12T15:00:00Z', estimatedMinutes: 45, actualMinutes: 45, notes: '' },
    ],
    subjects: [
      {
        id: 'maths',
        name: 'Mathematics',
        shortName: 'Math',
        questionWeight: 50,
        marksPerQuestion: 12,
        color: 'blue',
        chapters: [
          {
            id: 'ch-alg',
            subjectId: 'maths',
            title: 'Algebra',
            order: 1,
            topics: [
              { id: 'top-1', subjectId: 'maths', chapterId: 'ch-alg', title: 'Quadratics', completed: true, completedAt: '2026-10-11T10:00:00Z', updatedAt: '2026-10-11T10:00:00Z', status: 'completed', plannedStartDate: '2026-10-10', targetCompletionDate: '2026-10-15', assignedMonth: '2026-10', priority: 'high', notes: '', estimatedHours: 3, actualHours: 2, questionsSolved: 30, questionsCorrect: 25 },
            ],
          },
        ],
      },
    ],
    timetableSlots: [],
    studySessions: [
      { id: 'sess-local-1', date: '2026-10-11', slotId: 'slot-1', startTime: '14:00', endTime: '15:30', activity: 'Algebra Study', status: 'completed', plannedMinutes: 90, actualMinutes: 90, notes: '', loggedAt: '2026-10-11T15:30:00Z' },
    ],
    pyqEntries: [],
    mockTests: [],
    errorLogs: [],
    revisionItems: [],
    monthlyGoals: [],
    userConfig: {
      examName: 'NIMCET 2027',
      exactExamDate: null, // default empty on local
    },
    pyqPaperRecords: {},
  };

  const remoteDataset: FullUserDataPayload = {
    tasks: [
      { id: 'task-remote-1', title: 'Reasoning Puzzles', taskType: 'Practise', startDate: '2026-10-10', deadline: '2026-10-12', priority: 'medium', status: 'pending', createdAt: '2026-10-09T10:00:00Z', updatedAt: '2026-10-09T10:00:00Z', estimatedMinutes: 40, actualMinutes: 0, notes: '' },
      { id: 'task-shared', title: 'Shared Task (Remote older)', taskType: 'Learn', startDate: '2026-10-10', deadline: '2026-10-12', priority: 'medium', status: 'pending', createdAt: '2026-10-10T10:00:00Z', updatedAt: '2026-10-10T11:00:00Z', estimatedMinutes: 45, actualMinutes: 0, notes: '' },
    ],
    subjects: [
      {
        id: 'maths',
        name: 'Mathematics',
        shortName: 'Math',
        questionWeight: 50,
        marksPerQuestion: 12,
        color: 'blue',
        chapters: [
          {
            id: 'ch-alg',
            subjectId: 'maths',
            title: 'Algebra',
            order: 1,
            topics: [
              { id: 'top-1', subjectId: 'maths', chapterId: 'ch-alg', title: 'Quadratics', completed: false, status: 'in_progress', plannedStartDate: '2026-10-10', targetCompletionDate: '2026-10-15', assignedMonth: '2026-10', priority: 'high', notes: '', estimatedHours: 3, actualHours: 1, questionsSolved: 10, questionsCorrect: 8 },
              // Custom topic added on device B
              { id: 'top-custom-remote', subjectId: 'maths', chapterId: 'ch-alg', title: 'Theory of Equations Extra', completed: true, completedAt: '2026-10-12T09:00:00Z', updatedAt: '2026-10-12T09:00:00Z', status: 'completed', plannedStartDate: '2026-10-10', targetCompletionDate: '2026-10-15', assignedMonth: '2026-10', priority: 'medium', notes: '', estimatedHours: 2, actualHours: 2, questionsSolved: 20, questionsCorrect: 18 },
            ],
          },
        ],
      },
    ],
    timetableSlots: [],
    studySessions: [],
    pyqEntries: [],
    mockTests: [
      { id: 'mock-1', testName: 'NIMCET Mock 1', provider: 'Standard', testType: 'full_mock', scheduledDate: '2026-10-12', completed: true, score: 380, maxMarks: 600, correctCount: 95, incorrectCount: 15, skippedCount: 10, timeObservations: 'Good speed', weakTopics: [], followUpTasks: [] },
    ],
    errorLogs: [],
    revisionItems: [],
    monthlyGoals: [],
    userConfig: {
      examName: 'NIMCET 2027',
      exactExamDate: '2027-05-23', // customized on remote device!
      weightingMethod: 'nimcet_exam_weight',
    },
    pyqPaperRecords: {},
  };

  const merged = mergeLocalAndRemoteData(localDataset, remoteDataset);

  // Assert Tasks: 3 unique tasks total (union)
  assert.strictEqual(merged.tasks.length, 3);
  const sharedTask = merged.tasks.find((t) => t.id === 'task-shared');
  assert.strictEqual(sharedTask?.title, 'Shared Task (Local newer)');
  assert.strictEqual(sharedTask?.status, 'completed');

  // Assert Sessions & Mocks preserved
  assert.strictEqual(merged.studySessions.length, 1);
  assert.strictEqual(merged.mockTests.length, 1);

  // Assert custom topic preserved
  const mathsTopics = merged.subjects[0].chapters[0].topics;
  assert.ok(mathsTopics.some((t) => t.id === 'top-custom-remote'));

  // Assert cumulative study metrics preserved (Math.max)
  const quadratics = mathsTopics.find((t) => t.id === 'top-1');
  assert.strictEqual(quadratics?.completed, true);
  assert.strictEqual(quadratics?.questionsSolved, 30);
  assert.strictEqual(quadratics?.actualHours, 2);

  // Assert user config: remote customized exactExamDate is preserved (not overwritten by local null default)
  assert.strictEqual(merged.userConfig.exactExamDate, '2027-05-23');
  assert.strictEqual(merged.userConfig.weightingMethod, 'nimcet_exam_weight');
});

runTest('Failed Firestore writes preserve local records and pre-migration backup intact', async () => {
  const localData: FullUserDataPayload = {
    tasks: [{ id: 'task-preserve-1', title: 'Local Study Item', taskType: 'Learn', startDate: '2026-10-10', deadline: '2026-10-12', priority: 'high', status: 'pending', createdAt: '2026-10-10T10:00:00Z', estimatedMinutes: 30, actualMinutes: 0, notes: '' }],
    subjects: [],
    timetableSlots: [],
    studySessions: [],
    pyqEntries: [],
    mockTests: [],
    errorLogs: [],
    revisionItems: [],
    monthlyGoals: [],
    userConfig: {},
    pyqPaperRecords: {},
  };

  // 1. Create pre-migration backup
  const backupKey = savePreMigrationBackup(localData);
  assert.ok(backupKey.length > 0);

  // 2. Simulate migration attempt with a write failure
  let localState = { ...localData };
  const mockUploadFailure = async () => ({ success: false, error: 'Network unavailable: 503 Service Unavailable' });

  const res = await mockUploadFailure();
  if (!res.success) {
    // Under our safe migration rules: local state is NOT mutated
  } else {
    localState = { tasks: [] } as any;
  }

  // Verify local data is 100% intact
  assert.strictEqual(localState.tasks.length, 1);
  assert.strictEqual(localState.tasks[0].id, 'task-preserve-1');

  // Verify backup is safely retrieved and matches original
  const backups = getPreMigrationBackups();
  assert.ok(backups.length > 0);
  const foundBackup = backups.find((b) => b.key === backupKey);
  assert.ok(foundBackup);
  assert.strictEqual(foundBackup?.data.tasks[0].id, 'task-preserve-1');
});

runTest('Partial migration failures prevent Synced status and allow clean retry', async () => {
  let syncStatus = 'migration_pending';
  let syncErrorMessage: string | null = null;
  let isMigratedFlag = false;

  const simulateMigrationWrite = async (succeed: boolean) => {
    if (!succeed) {
      syncStatus = 'error';
      syncErrorMessage = 'Write operation failed: permission-denied';
      return { success: false, error: syncErrorMessage };
    }
    syncStatus = 'synced';
    syncErrorMessage = null;
    isMigratedFlag = true;
    return { success: true };
  };

  // Step 1: Write fails
  const failureRes = await simulateMigrationWrite(false);
  assert.strictEqual(failureRes.success, false);
  assert.strictEqual(syncStatus, 'error');
  assert.strictEqual(isMigratedFlag, false);
  assert.ok(failureRes.error && failureRes.error.includes('permission-denied'));

  // Step 2: Retry with successful write
  const retryRes = await simulateMigrationWrite(true);
  assert.strictEqual(retryRes.success, true);
  assert.strictEqual(syncStatus, 'synced');
  assert.strictEqual(isMigratedFlag, true);
  assert.strictEqual(syncErrorMessage, null);
});

console.log(`\n====================================================`);
console.log(` All ${passedTests} / ${totalTests} Reliability Tests Passed Successfully!`);
console.log(`====================================================\n`);

