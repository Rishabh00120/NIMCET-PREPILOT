/**
 * PrepPilot — Push Notification & Scheduling Utilities
 *
 * Pure utilities for:
 * - Production Application URL validation & absolute link generation
 * - Window enforcement (primary study window, revision window, quiet hours)
 * - Timezone calculation locked to account-level timezone
 * - Per-device outcome tracking & overall status resolution
 * - Retry eligibility evaluation
 */

export interface TimeInfo {
  dateStr: string;
  hour: number;
  minute: number;
  yesterdayStr: string;
  tomorrowStr: string;
  plus3DaysStr: string;
}

export interface DeviceOutcomeRecord {
  status: 'accepted_by_fcm' | 'delivered' | 'failed' | 'evicted';
  token?: string;
  fcmAccepted?: boolean;
  confirmedDisplayed?: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
  acceptedAt?: string;
  displayedAt?: string;
  failedAt?: string;
}

export type OverallDeliveryStatus =
  | 'accepted_by_fcm'
  | 'partial_failure'
  | 'failed'
  | 'delivered'
  | 'skipped'
  | 'in_progress';

/**
 * Known placeholder patterns that indicate unconfigured deployment values
 */
const PLACEHOLDER_HOST_PATTERNS = [
  'your-preppilot-domain',
  'your-domain',
  'your-app',
  'replace_with',
  'replace-with',
  '<your',
  'your_domain',
];

/**
 * Validates the configured production application origin.
 * Strictly requires HTTPS in production, rejects credentials, unexpected non-root paths, malformed URLs,
 * and placeholder values. Plain HTTP for localhost/127.0.0.1 is permitted strictly in isolated emulator/test environments.
 */
export function validateAppOrigin(candidateUrl?: string | null): string {
  const urlToTest = candidateUrl ? candidateUrl.trim() : '';

  if (!urlToTest) {
    throw new Error(
      'Missing required PREPPILOT_APP_URL configuration. An explicit, valid HTTPS production origin must be configured (e.g. "https://preppilot.example.com").'
    );
  }

  // Reject obvious placeholder strings or unconfigured template values
  const lowerUrl = urlToTest.toLowerCase();
  if (PLACEHOLDER_HOST_PATTERNS.some(pattern => lowerUrl.includes(pattern))) {
    throw new Error(
      `Invalid PREPPILOT_APP_URL: Found placeholder origin "${urlToTest}". You must configure PREPPILOT_APP_URL with your actual deployed PrepPilot HTTPS origin before deployment.`
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(urlToTest);
  } catch {
    throw new Error(`Invalid PREPPILOT_APP_URL: "${urlToTest}" is not a valid URL.`);
  }

  // Reject embedded credentials (user:pass@)
  if (parsed.username || parsed.password) {
    throw new Error('Invalid PREPPILOT_APP_URL: URLs with embedded credentials are prohibited for security.');
  }

  // Reject non-http(s) protocols
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Invalid PREPPILOT_APP_URL: Unsupported protocol "${parsed.protocol}".`);
  }

  // Require HTTPS protocol (allow http only for localhost or 127.0.0.1 in isolated local emulator or test runner)
  const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  const isIsolatedEmulatorEnv =
    process.env.FUNCTIONS_EMULATOR === 'true' ||
    Boolean(process.env.FIREBASE_EMULATOR_HUB) ||
    process.env.NODE_ENV === 'test';

  if (parsed.protocol !== 'https:') {
    if (parsed.protocol === 'http:' && isLocalhost) {
      if (!isIsolatedEmulatorEnv) {
        throw new Error(
          'Invalid PREPPILOT_APP_URL: Protocol must be HTTPS. Plain HTTP for localhost is supported only in an isolated emulator or test environment (FUNCTIONS_EMULATOR=true).'
        );
      }
    } else {
      throw new Error(`Invalid PREPPILOT_APP_URL: Protocol must be HTTPS (received "${parsed.protocol}").`);
    }
  }

  // Reject invalid hostnames
  if (!parsed.hostname || (!parsed.hostname.includes('.') && !isLocalhost)) {
    throw new Error(`Invalid PREPPILOT_APP_URL hostname: "${parsed.hostname}" is not a valid production host.`);
  }

  // Reject non-root pathname in configured base origin (e.g. https://domain.com/subpath)
  if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(
      `Invalid PREPPILOT_APP_URL origin: Base URL must be the root origin without subpaths (received path "${parsed.pathname}").`
    );
  }

  return parsed.origin;
}

/**
 * Resolves an internal route (e.g. "/#/tasks?id=123" or "/#/settings") into a validated
 * absolute HTTPS URL for webpush.fcmOptions.link according to the Web Push specification.
 */
export function getAbsoluteNotificationUrl(internalRoute: string, baseUrl?: string | null): string {
  const origin = validateAppOrigin(baseUrl);

  if (!internalRoute || internalRoute === '/') {
    return origin;
  }

  const trimmedRoute = internalRoute.trim();

  // If already absolute URL, ensure it matches origin
  if (trimmedRoute.startsWith('http://') || trimmedRoute.startsWith('https://')) {
    const parsed = new URL(trimmedRoute);
    if (parsed.origin !== origin) {
      throw new Error(
        `External notification URL "${trimmedRoute}" does not match configured app origin "${origin}".`
      );
    }
    return parsed.toString();
  }

  // Preserve hash routes (e.g. "/#/tasks?id=123" or "#/tasks" or "/settings")
  const normalizedRoute = trimmedRoute.startsWith('/') ? trimmedRoute : `/${trimmedRoute}`;
  return `${origin}${normalizedRoute}`;
}

/**
 * Timezone calculation helper locked to specified account timezone (defaults to Asia/Kolkata)
 */
export function getTimeInfo(timeZone = 'Asia/Kolkata', customDate = new Date()): TimeInfo {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(customDate);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const hour = parseInt(partMap.hour, 10);
  const minute = parseInt(partMap.minute, 10);

  const addDays = (days: number): string => {
    const d = new Date(customDate.getTime() + days * 24 * 60 * 60 * 1000);
    const subParts = formatter.formatToParts(d);
    const subMap: Record<string, string> = {};
    for (const p of subParts) {
      subMap[p.type] = p.value;
    }
    return `${subMap.year}-${subMap.month}-${subMap.day}`;
  };

  return {
    dateStr,
    hour,
    minute,
    yesterdayStr: addDays(-1),
    tomorrowStr: addDays(1),
    plus3DaysStr: addDays(3),
  };
}

/**
 * Evaluates whether currentHour (0-23) falls within a configured window (e.g. "14:00–21:00" or "23:00–00:00").
 * Safely handles midnight endings ("00:00" as 24) and overnight wraps (e.g. "23:00–02:00").
 */
export function isHourInWindow(currentHour: number, windowStr?: string | null): boolean {
  if (!windowStr || typeof windowStr !== 'string') return true;
  const clean = windowStr.trim();
  if (!clean.includes('–') && !clean.includes('-')) return true;

  try {
    const separator = clean.includes('–') ? '–' : '-';
    const [startPart, endPart] = clean.split(separator).map((s) => s.trim());
    const startHour = parseInt(startPart.split(':')[0], 10);
    let endHour = parseInt(endPart.split(':')[0], 10);

    if (isNaN(startHour) || isNaN(endHour)) return true;

    // "00:00" ending represents midnight rollover (end of day)
    if (endHour === 0 && startHour > 0) {
      endHour = 24;
    }

    if (startHour <= endHour) {
      // Standard daytime window, e.g. 14:00 to 21:00 or 23:00 to 24:00
      return currentHour >= startHour && currentHour < endHour;
    } else {
      // Overnight wrap across midnight, e.g. 22:00 to 02:00
      return currentHour >= startHour || currentHour < endHour;
    }
  } catch {
    return true;
  }
}

/**
 * Reminder Window & Priority Policy Evaluator
 *
 * Policy:
 * 1. Quiet Hours (01:00 to 06:59): NO reminders under any circumstances.
 * 2. Paused Reminders: NO reminders if userConfig.notificationsPaused is true.
 * 3. Notification Frequency:
 *    - 'urgent_only': only priority === 'high' (overdue, due today) allowed.
 * 4. Normal Reminders (1d/3d advance tasks, advance mocks): MUST be in primaryStudyWindow.
 * 5. Spaced Revision Reminders: MUST be in revisionWindow (e.g. 23:00–00:00).
 * 6. Urgent Reminders (overdue, due today, same-day mocks):
 *    - Respect primaryStudyWindow BY DEFAULT.
 *    - Allowed outside primaryStudyWindow ONLY IF urgentBypassStudyWindow === true.
 *    - Still prohibited during quiet hours.
 */
export function isReminderWindowEligible(params: {
  category: 'overdue' | 'due_today' | 'advance_1d' | 'advance_3d' | 'test' | 'revision' | 'daily_summary';
  priority: 'normal' | 'high';
  userHour: number;
  primaryStudyWindow?: string | null;
  revisionWindow?: string | null;
  notificationsPaused?: boolean;
  notificationFrequency?: 'all' | 'daily_summary' | 'urgent_only';
  urgentBypassStudyWindow?: boolean;
}): { eligible: boolean; reason?: string } {
  const {
    category,
    priority,
    userHour,
    primaryStudyWindow,
    revisionWindow,
    notificationsPaused,
    notificationFrequency,
    urgentBypassStudyWindow,
  } = params;

  // 1. Paused check
  if (notificationsPaused) {
    return { eligible: false, reason: 'notifications_paused' };
  }

  // 2. Quiet hours protection (01:00 to 06:59)
  const isQuietHours = userHour >= 1 && userHour < 7;
  if (isQuietHours) {
    return { eligible: false, reason: 'quiet_hours_enforced' };
  }

  // 3. Frequency check
  if (notificationFrequency === 'urgent_only' && priority !== 'high') {
    return { eligible: false, reason: 'frequency_urgent_only' };
  }

  const inStudyWindow = isHourInWindow(userHour, primaryStudyWindow);
  const inRevisionWindow = isHourInWindow(userHour, revisionWindow);

  // 4. Spaced revision reminders
  if (category === 'revision') {
    if (!inRevisionWindow) {
      return { eligible: false, reason: 'outside_revision_window' };
    }
    return { eligible: true };
  }

  // 5. Urgent reminders (overdue, due today, same-day mocks)
  const isUrgent = priority === 'high' || category === 'overdue' || category === 'due_today';
  if (isUrgent) {
    if (inStudyWindow) {
      return { eligible: true };
    }
    if (urgentBypassStudyWindow) {
      return { eligible: true };
    }
    return { eligible: false, reason: 'outside_study_window_urgent_bypass_disabled' };
  }

  // 6. Normal reminders
  if (!inStudyWindow) {
    return { eligible: false, reason: 'outside_study_window' };
  }

  return { eligible: true };
}

/**
 * Calculates per-device outcomes and overall delivery status from an FCM multicast response.
 * Distinguishes FCM acceptance from confirmed device display.
 */
export function calculateMulticastOutcomes(params: {
  devices: Array<{ deviceId: string; token: string }>;
  fcmResponses: Array<{ success: boolean; messageId?: string; error?: { code?: string; message?: string } }>;
  existingOutcomes?: Record<string, DeviceOutcomeRecord>;
}): {
  deviceOutcomes: Record<string, DeviceOutcomeRecord>;
  acceptedDevicesCount: number;
  failedDevicesCount: number;
  overallStatus: OverallDeliveryStatus;
  invalidTokensToEvict: string[];
} {
  const { devices, fcmResponses, existingOutcomes = {} } = params;
  const mergedOutcomes: Record<string, DeviceOutcomeRecord> = { ...existingOutcomes };
  const invalidTokensToEvict: string[] = [];

  let acceptedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < fcmResponses.length; i++) {
    const resp = fcmResponses[i];
    const dev = devices[i];
    const deviceId = dev ? dev.deviceId : `dev_${i}`;
    const token = dev ? dev.token : undefined;

    if (resp.success) {
      acceptedCount++;
      mergedOutcomes[deviceId] = {
        status: 'accepted_by_fcm',
        token,
        fcmAccepted: true,
        confirmedDisplayed: false, // Distinguishes FCM acceptance from confirmed device display
        messageId: resp.messageId,
        acceptedAt: new Date().toISOString(),
      };
    } else {
      failedCount++;
      const errCode = resp.error?.code || 'unknown_error';
      const errMsg = resp.error?.message || 'FCM rejected push message';

      if (
        errCode === 'messaging/registration-token-not-registered' ||
        errCode === 'messaging/invalid-registration-token' ||
        errCode === 'messaging/invalid-argument'
      ) {
        invalidTokensToEvict.push(deviceId);
        mergedOutcomes[deviceId] = {
          status: 'evicted',
          token,
          fcmAccepted: false,
          confirmedDisplayed: false,
          errorCode: errCode,
          errorMessage: errMsg,
          failedAt: new Date().toISOString(),
        };
      } else {
        mergedOutcomes[deviceId] = {
          status: 'failed',
          token,
          fcmAccepted: false,
          confirmedDisplayed: false,
          errorCode: errCode,
          errorMessage: errMsg,
          failedAt: new Date().toISOString(),
        };
      }
    }
  }

  // Determine aggregate delivery status across all resolved devices
  const allOutcomes = Object.values(mergedOutcomes);
  const totalAccepted = allOutcomes.filter(
    (o) => o.status === 'accepted_by_fcm' || o.status === 'delivered'
  ).length;
  const totalEvicted = allOutcomes.filter((o) => o.status === 'evicted').length;
  const totalFailed = allOutcomes.filter((o) => o.status === 'failed').length;
  const totalAll = allOutcomes.length;

  let overallStatus: OverallDeliveryStatus;

  if (totalAccepted === totalAll && totalAll > 0) {
    // Every targeted device has been accepted by FCM
    overallStatus = 'accepted_by_fcm';
  } else if (totalAccepted > 0 && (totalFailed > 0 || totalEvicted > 0)) {
    // At least one device accepted, but some failed or were evicted
    overallStatus = 'partial_failure';
  } else {
    // 0 devices accepted (e.g. all evicted, all failed, or mixed failed+evicted)
    overallStatus = 'failed';
  }

  return {
    deviceOutcomes: mergedOutcomes,
    acceptedDevicesCount: totalAccepted,
    failedDevicesCount: totalFailed + totalEvicted,
    overallStatus,
    invalidTokensToEvict,
  };
}

/**
 * Filters intended active devices to determine which should be targeted in a dispatch or retry attempt.
 * - If a device has never been targeted, it is included.
 * - If an evicted or failed device has re-registered with a NEW token, it is included (not suppressed).
 * - If a device already reached a terminal state (accepted_by_fcm, delivered, or evicted) with the SAME token, it is excluded.
 */
export function filterDevicesToTarget(params: {
  intendedDevices: Array<{ deviceId: string; token: string }>;
  existingOutcomes: Record<string, DeviceOutcomeRecord>;
}): Array<{ deviceId: string; token: string }> {
  const { intendedDevices, existingOutcomes } = params;
  return intendedDevices.filter((dev) => {
    const outcome = existingOutcomes[dev.deviceId];
    if (!outcome) return true;

    // If an evicted or failed device registered a NEW token later, do NOT suppress it
    if (outcome.token && dev.token && outcome.token !== dev.token) {
      return true;
    }

    // Do not retry permanently invalid (evicted) tokens or already accepted/delivered tokens
    return (
      outcome.status !== 'accepted_by_fcm' &&
      outcome.status !== 'delivered' &&
      outcome.status !== 'evicted'
    );
  });
}

/**
 * Resolves the aggregate delivery status across all intended devices.
 * Requires at least 1 FCM accepted device for successful acceptance.
 * An invalid or evicted token never counts as a successful send.
 * If 0 devices accepted, returns 'failed'.
 * If some devices accepted but others failed/evicted, returns 'partial_failure'.
 * If all devices accepted, returns 'accepted_by_fcm'.
 */
export function resolveDeliveryAggregateStatus(params: {
  intendedDevicesCount: number;
  deviceOutcomes: Record<string, DeviceOutcomeRecord>;
}): {
  status: 'accepted_by_fcm' | 'partial_failure' | 'failed';
  fcmAccepted: boolean;
  acceptedCount: number;
  failedCount: number;
  evictedCount: number;
  allResolved: boolean;
  terminalReason: string;
} {
  const { intendedDevicesCount, deviceOutcomes } = params;
  const outcomes = Object.values(deviceOutcomes);

  const acceptedCount = outcomes.filter(
    (o) => o.status === 'accepted_by_fcm' || o.status === 'delivered'
  ).length;
  const evictedCount = outcomes.filter((o) => o.status === 'evicted').length;
  const failedCount = outcomes.filter((o) => o.status === 'failed').length;

  const allResolved =
    outcomes.length >= intendedDevicesCount &&
    outcomes.every((o) => o.status === 'accepted_by_fcm' || o.status === 'delivered' || o.status === 'evicted');

  let status: 'accepted_by_fcm' | 'partial_failure' | 'failed';
  let terminalReason: string;

  if (acceptedCount === intendedDevicesCount && intendedDevicesCount > 0) {
    status = 'accepted_by_fcm';
    terminalReason = 'all_devices_already_accepted';
  } else if (acceptedCount > 0) {
    status = 'partial_failure';
    terminalReason = 'partial_devices_accepted';
  } else {
    status = 'failed';
    terminalReason = evictedCount > 0 ? 'all_devices_evicted_or_invalid' : 'all_devices_failed';
  }

  return {
    status,
    fcmAccepted: acceptedCount > 0,
    acceptedCount,
    failedCount,
    evictedCount,
    allResolved,
    terminalReason,
  };
}

