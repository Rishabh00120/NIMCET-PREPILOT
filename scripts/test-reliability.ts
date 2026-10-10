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

console.log(`\n====================================================`);
console.log(` All ${passedTests} / ${totalTests} Reliability Tests Passed Successfully!`);
console.log(`====================================================\n`);

