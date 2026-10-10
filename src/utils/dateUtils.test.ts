import {
  calculateConsecutiveStudyStreak,
  addDaysToDateString,
  getDaysDifference,
  getStartOfWeekDateString,
  getEndOfWeekDateString,
  isDateInCurrentWeek,
  getTodayDateString,
} from './dateUtils';

function runTests() {
  console.log('--- RUNNING DATE UTILS TESTS ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${msg}`);
    } else {
      console.error(`[FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  const today = '2026-10-15';
  const yesterday = '2026-10-14';
  const dayBefore = '2026-10-13';

  // 1. Streak tests
  assert(
    calculateConsecutiveStudyStreak([], today) === 0,
    'Empty sessions returns 0 streak'
  );

  assert(
    calculateConsecutiveStudyStreak([today], today) === 1,
    'Session today gives streak of 1'
  );

  assert(
    calculateConsecutiveStudyStreak([today, today, today], today) === 1,
    'Multiple sessions on same date count as 1 study day'
  );

  assert(
    calculateConsecutiveStudyStreak([today, yesterday, dayBefore], today) === 3,
    'Consecutive sessions across 3 days gives streak of 3'
  );

  assert(
    calculateConsecutiveStudyStreak([yesterday, dayBefore], today) === 2,
    'Unrecorded session today preserves streak from yesterday'
  );

  assert(
    calculateConsecutiveStudyStreak([dayBefore], today) === 0,
    'Missing yesterday breaks the streak (returns 0)'
  );

  assert(
    calculateConsecutiveStudyStreak([today, dayBefore], today) === 1,
    'Missed yesterday but studied today resets streak to 1'
  );

  // 2. Month boundaries & day additions
  assert(
    addDaysToDateString('2026-10-31', 1) === '2026-11-01',
    'Adding 1 day to Oct 31 rolls over to Nov 01'
  );

  assert(
    addDaysToDateString('2026-11-01', -1) === '2026-10-31',
    'Subtracting 1 day from Nov 01 rolls back to Oct 31'
  );

  assert(
    getDaysDifference('2026-10-10', '2026-10-20') === 10,
    'Day difference between Oct 10 and Oct 20 is 10 days'
  );

  // 3. Weekly bounds (Monday to Sunday)
  // 2026-10-15 is Thursday
  assert(
    getStartOfWeekDateString('2026-10-15') === '2026-10-12', // Monday
    'Start of week for Thu 2026-10-15 is Mon 2026-10-12'
  );
  assert(
    getEndOfWeekDateString('2026-10-15') === '2026-10-18', // Sunday
    'End of week for Thu 2026-10-15 is Sun 2026-10-18'
  );

  assert(
    isDateInCurrentWeek('2026-10-12', '2026-10-15') === true,
    'Monday is in current week'
  );
  assert(
    isDateInCurrentWeek('2026-10-18', '2026-10-15') === true,
    'Sunday is in current week'
  );
  assert(
    isDateInCurrentWeek('2026-10-11', '2026-10-15') === false,
    'Previous Sunday is NOT in current week'
  );

  console.log(`--- ALL ${passed}/${total} DATE UTILS TESTS PASSED ---`);
}

runTests();
