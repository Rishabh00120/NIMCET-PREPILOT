/**
 * Central Date Utility for PrepPilot
 * Handles dynamic date calculations in Asia/Kolkata timezone,
 * prevents UTC off-by-one errors, handles midnight rollover,
 * and calculates true consecutive streaks.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

// Official preparation foundation start date for NIMCET 2027
export const PREPARATION_START_DATE = '2026-10-10';

/**
 * Returns the current date formatted as YYYY-MM-DD in the specified timezone (default: Asia/Kolkata)
 */
export function getTodayDateString(timezone: string = DEFAULT_TIMEZONE): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch (err) {
    // Fallback if timezone string is invalid
    console.warn(`Invalid timezone ${timezone}, falling back to UTC:`, err);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Returns the current time formatted as HH:MM in the specified timezone
 */
export function getCurrentTimeString(timezone: string = DEFAULT_TIMEZONE): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toTimeString().slice(0, 5);
  }
}

/**
 * Safely parse a YYYY-MM-DD string into a Date object at noon (12:00:00)
 * to avoid any timezone/DST midnight drift
 */
export function parseDateAtNoon(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0);
}

/**
 * Adds or subtracts days to a YYYY-MM-DD date string safely
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const date = parseDateAtNoon(dateStr);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates calendar day difference (laterDateStr - earlierDateStr)
 */
export function getDaysDifference(earlierDateStr: string, laterDateStr: string): number {
  const d1 = parseDateAtNoon(earlierDateStr);
  const d2 = parseDateAtNoon(laterDateStr);
  const diffMs = d2.getTime() - d1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Returns Monday of the week for a given dateStr
 */
export function getStartOfWeekDateString(dateStr: string): string {
  const date = parseDateAtNoon(dateStr);
  // getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
  const day = date.getDay();
  // We treat Monday as first day of study week (day = 1, diff = 0; day = 0 (Sun), diff = -6)
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysToDateString(dateStr, diff);
}

/**
 * Returns Sunday of the week for a given dateStr
 */
export function getEndOfWeekDateString(dateStr: string): string {
  const monday = getStartOfWeekDateString(dateStr);
  return addDaysToDateString(monday, 6);
}

/**
 * Checks if a session date falls within the current calendar week (Monday to Sunday)
 */
export function isDateInCurrentWeek(sessionDateStr: string, todayDateStr: string): boolean {
  const startOfWeek = getStartOfWeekDateString(todayDateStr);
  const endOfWeek = getEndOfWeekDateString(todayDateStr);
  return sessionDateStr >= startOfWeek && sessionDateStr <= endOfWeek;
}

/**
 * Formats a YYYY-MM-DD date string into human readable format, e.g. "9 Oct 2026"
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const mIdx = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} ${monthNames[mIdx] || ''} ${year}`;
}

/**
 * Calculates genuine consecutive-day study streak
 *
 * Rules:
 * 1. Multiple sessions on one calendar day count as 1 study day.
 * 2. If the user studied today (todayDateStr), the streak counts today + consecutive days back.
 * 3. If the user has NOT studied today yet (the day is still in progress), we check yesterday.
 *    If yesterday was studied, the streak is alive (counted back from yesterday consecutively).
 *    This ensures users don't see 0 streak at 9 AM before their study slot begins.
 * 4. If neither today nor yesterday was studied, streak is broken and returns 0.
 * 5. Missing a calendar day breaks the streak.
 */
export function calculateConsecutiveStudyStreak(
  sessionDates: string[],
  todayDateStr: string
): number {
  if (!sessionDates || sessionDates.length === 0) return 0;

  // Filter valid dates, eliminate duplicates, and sort in descending order (newest first)
  const uniqueDates = Array.from(new Set(sessionDates.filter(Boolean)))
    .sort()
    .reverse();

  if (uniqueDates.length === 0) return 0;

  const yesterdayDateStr = addDaysToDateString(todayDateStr, -1);
  const hasStudiedToday = uniqueDates.includes(todayDateStr);
  const hasStudiedYesterday = uniqueDates.includes(yesterdayDateStr);

  // If neither today nor yesterday was studied, streak is broken
  if (!hasStudiedToday && !hasStudiedYesterday) {
    return 0;
  }

  let streak = 0;
  // Start checking from today if studied today, otherwise start from yesterday
  let expectedDate = hasStudiedToday ? todayDateStr : yesterdayDateStr;

  const dateSet = new Set(uniqueDates);

  while (dateSet.has(expectedDate)) {
    streak++;
    expectedDate = addDaysToDateString(expectedDate, -1);
  }

  return streak;
}

/**
 * Calculates milliseconds until next midnight in the specified timezone
 */
export function getMsUntilNextMidnight(timezone: string = DEFAULT_TIMEZONE): number {
  const todayStr = getTodayDateString(timezone);
  const tomorrowStr = addDaysToDateString(todayStr, 1);
  const now = new Date();
  
  // Approximate timestamp of next midnight in timezone
  // We can calculate via Intl or a short 60s poll fallback
  // Safe timeout between 10 seconds and 24 hours
  try {
    const nextMidnightUtcGuess = new Date(`${tomorrowStr}T00:00:00Z`).getTime();
    const currentUtcGuess = new Date(`${todayStr}T${now.toISOString().slice(11, 19)}Z`).getTime();
    const diff = nextMidnightUtcGuess - currentUtcGuess;
    return Math.max(10000, Math.min(diff, 24 * 60 * 60 * 1000));
  } catch {
    return 60000; // 1 min fallback
  }
}
