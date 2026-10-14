"use strict";
/**
 * PrepPilot — Scheduled Web Push Notification Backend (Firebase Cloud Functions v2)
 *
 * Capabilities:
 * - Secure authentication:
 *   * Administrative secret protection on global dispatch using Secret Manager (ADMIN_DISPATCH_SECRET).
 *   * Per-user Firebase Auth ID token verification for remote push delivery testing.
 * - Timezone-aware evaluation in Asia/Kolkata (IST) and custom user timezones.
 * - Absolute HTTPS URLs:
 *   * Resolves PREPPILOT_APP_URL into valid absolute HTTPS URLs for webpush.fcmOptions.link.
 *   * Retains internal hash routes in payload data.
 * - Window enforcement:
 *   * Actually enforces primary study window (e.g. 14:00–21:00) and revision window (e.g. 23:00–00:00).
 *   * Scheduler runs at 09:00, 14:00, 20:00, and 23:00 IST to support night revision windows.
 *   * Respects quiet hours (01:00 to 07:00), paused reminders, and frequency settings.
 *   * Filters out completed and deleted tasks, mock tests, and revision items.
 * - Atomic reservation & retries:
 *   * Atomic reservation using Firestore transactions prevents duplicate concurrent sends.
 *   * Safe recovery re-queues stale in_progress events (> 5 mins old).
 *   * Bounded retries (MAX_RETRIES = 3) with 30-minute backoff delay.
 * - Per-device partial delivery tracking:
 *   * Tracks delivery outcomes per device. If Device A succeeds and Device B fails,
 *     subsequent retries target ONLY Device B.
 *   * The event is only marked 'delivered' when all intended devices reach terminal state.
 *   * Automatically evicts unregistered/invalid FCM tokens.
 * - Consistent audit timestamps:
 *   * Every delivery_history document includes consistent Firestore serverTimestamp.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendUserTestNotification = exports.testReminderDispatch = exports.checkAndSendStudyReminders = exports.adminDispatchSecret = void 0;
exports.isHourInWindow = isHourInWindow;
exports.runStudyReminderDispatch = runStudyReminderDispatch;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const params_1 = require("firebase-functions/params");
// Server-side initialization: Admin SDK operates strictly on the backend with service credentials
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
const messaging = admin.messaging();
// Set default region to asia-south1 (Mumbai) for minimal latency to Asia/Kolkata users
(0, v2_1.setGlobalOptions)({ region: 'asia-south1', maxInstances: 5 });
// Administrator secret for secure global dispatch endpoint via Secret Manager
exports.adminDispatchSecret = (0, params_1.defineSecret)('ADMIN_DISPATCH_SECRET');
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 30 * 60 * 1000; // 30 minutes
const STALE_LOCK_MS = 5 * 60 * 1000; // 5 minutes to recover abandoned in_progress reservations
const DEFAULT_APP_URL = 'https://ais-dev-cor4kmqaedoz6lvhxagzys-915145878473.asia-southeast1.run.app';
/**
 * Resolves an internal route (e.g. "/#/tasks?id=123" or "/#/settings") into a validated
 * absolute HTTPS URL for webpush.fcmOptions.link according to the Web Push specification.
 */
function getAbsoluteNotificationUrl(internalRoute) {
    const rawBase = (process.env.PREPPILOT_APP_URL || DEFAULT_APP_URL).trim();
    let base = rawBase;
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
        base = `https://${base}`;
    }
    // Force HTTPS for all non-local domains
    if (base.startsWith('http://') && !base.includes('localhost') && !base.includes('127.0.0.1')) {
        base = base.replace('http://', 'https://');
    }
    base = base.replace(/\/+$/, '');
    const route = internalRoute.startsWith('/') ? internalRoute : `/${internalRoute}`;
    return `${base}${route}`;
}
/**
 * Timezone calculation helper locked to specified timezone (defaults to Asia/Kolkata)
 */
function getTimeInfo(timeZone = 'Asia/Kolkata', customDate = new Date()) {
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
    const partMap = {};
    for (const p of parts) {
        partMap[p.type] = p.value;
    }
    const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
    const hour = parseInt(partMap.hour, 10);
    const minute = parseInt(partMap.minute, 10);
    const addDays = (days) => {
        const d = new Date(customDate.getTime() + days * 24 * 60 * 60 * 1000);
        const subParts = formatter.formatToParts(d);
        const subMap = {};
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
function isHourInWindow(currentHour, windowStr) {
    if (!windowStr || typeof windowStr !== 'string')
        return true;
    const clean = windowStr.trim();
    if (!clean.includes('–') && !clean.includes('-'))
        return true;
    try {
        const separator = clean.includes('–') ? '–' : '-';
        const [startPart, endPart] = clean.split(separator).map((s) => s.trim());
        const startHour = parseInt(startPart.split(':')[0], 10);
        let endHour = parseInt(endPart.split(':')[0], 10);
        // Treat 00:00 or 0:00 at end of day as 24 (e.g. 23:00–00:00 = 23:00 to 24:00)
        if (endHour === 0 && (endPart.startsWith('00') || endPart.startsWith('0:'))) {
            endHour = 24;
        }
        if (isNaN(startHour) || isNaN(endHour)) {
            return true;
        }
        if (startHour <= endHour) {
            return currentHour >= startHour && currentHour < endHour;
        }
        else {
            // Overnight wrap (e.g. 22:00 to 02:00)
            return currentHour >= startHour || currentHour < endHour;
        }
    }
    catch {
        return true;
    }
}
// In-memory mutex within single instance
let isDispatchInProgress = false;
/**
 * Core dispatch engine that evaluates tasks, syllabus topics, scheduled tests,
 * and spaced revisions for all users with multi-device tracking, window enforcement,
 * and atomic retry reservation.
 */
async function runStudyReminderDispatch() {
    if (isDispatchInProgress) {
        console.warn('[PrepPilot Dispatcher] Another dispatch run is already in progress. Skipping concurrent run.');
        return {
            processedUsers: 0,
            totalDispatches: 0,
            successCount: 0,
            failureCount: 0,
            retriedCount: 0,
            invalidTokensEvicted: 0,
            lastError: 'Skipped: concurrent dispatch run in progress',
        };
    }
    isDispatchInProgress = true;
    const stats = {
        processedUsers: 0,
        totalDispatches: 0,
        successCount: 0,
        failureCount: 0,
        retriedCount: 0,
        invalidTokensEvicted: 0,
        lastError: null,
    };
    try {
        const { dateStr: kolkataDate, hour: kolkataHour } = getTimeInfo('Asia/Kolkata');
        console.log(`[PrepPilot Scheduler] Starting reminder evaluation. IST Date: ${kolkataDate}, Hour: ${kolkataHour}:00`);
        // 1. Retrieve all registered user push subscriptions
        const userSubsSnap = await db.collection('user_push_subscriptions').get();
        for (const userSubDoc of userSubsSnap.docs) {
            const userId = userSubDoc.id;
            stats.processedUsers++;
            try {
                // 2. Fetch all active device records under user_push_subscriptions/{userId}/devices
                const devicesSnap = await userSubDoc.ref
                    .collection('devices')
                    .where('active', '==', true)
                    .get();
                const activeDevices = [];
                devicesSnap.forEach((doc) => {
                    const d = doc.data();
                    if (d.token && typeof d.token === 'string') {
                        activeDevices.push({
                            deviceId: doc.id,
                            token: d.token,
                            timezone: d.timezone || 'Asia/Kolkata',
                            notificationPreferences: d.notificationPreferences,
                        });
                    }
                });
                // Safe migration fallback for legacy single-token root document
                if (activeDevices.length === 0) {
                    const rootData = userSubDoc.data();
                    if (rootData?.fcmToken && typeof rootData.fcmToken === 'string') {
                        activeDevices.push({
                            deviceId: rootData.lastRegisteredDeviceId || 'legacy_device',
                            token: rootData.fcmToken,
                            timezone: rootData.timezone || 'Asia/Kolkata',
                            notificationPreferences: {
                                notificationsPaused: rootData.notificationsPaused,
                                notificationFrequency: rootData.notificationFrequency,
                                primaryStudyWindow: rootData.primaryStudyWindow,
                                revisionWindow: rootData.revisionWindow,
                            },
                        });
                    }
                }
                if (activeDevices.length === 0) {
                    continue;
                }
                // 3. Fetch user preparation data under /users/{userId}
                const userDocSnap = await db.doc(`users/${userId}`).get();
                if (!userDocSnap.exists) {
                    continue;
                }
                const userData = userDocSnap.data() || {};
                const userConfig = userData.userConfig || {};
                // Respect global notification pause setting
                if (userConfig.notificationsPaused) {
                    continue;
                }
                const primaryTimezone = activeDevices[0].timezone || userConfig.timezone || 'Asia/Kolkata';
                const userTime = getTimeInfo(primaryTimezone);
                const { dateStr: todayDate, hour: userHour, tomorrowStr, plus3DaysStr } = userTime;
                // Quiet hours protection: Suppress non-urgent reminders during deep sleep (01:00 to 06:59)
                const isQuietHours = userHour >= 1 && userHour < 7;
                // 4. Check Reminder Window Constraints
                const inStudyWindow = isHourInWindow(userHour, userConfig.primaryStudyWindow);
                const inRevisionWindow = isHourInWindow(userHour, userConfig.revisionWindow);
                const tasks = Array.isArray(userData.tasks) ? userData.tasks : [];
                const mockTests = Array.isArray(userData.mockTests) ? userData.mockTests : [];
                const revisionItems = Array.isArray(userData.revisionItems) ? userData.revisionItems : [];
                // 5. Assemble candidate reminder events
                const candidateReminders = [];
                // A. Tasks: Exclude completed, deleted, and cancelled tasks
                for (const t of tasks) {
                    if (!t || t.deletedAt || t.status === 'completed' || t.completedAt)
                        continue;
                    if (!t.deadline)
                        continue;
                    if (t.deadline < todayDate) {
                        // Overdue tasks: Urgent alert (allowed in waking hours)
                        candidateReminders.push({
                            eventId: `rem_${userId}_task_overdue_${t.id}_${todayDate}`,
                            title: `Overdue Task: ${t.title}`,
                            body: `Scheduled for ${t.deadline}. Spend 25 minutes now to protect your preparation streak!`,
                            targetUrl: `/#/tasks?id=${encodeURIComponent(t.id)}`,
                            type: 'task_deadline',
                            priority: 'high',
                            category: 'overdue',
                        });
                    }
                    else if (t.deadline === todayDate) {
                        // Due today: Urgent alert (allowed in waking hours)
                        candidateReminders.push({
                            eventId: `rem_${userId}_task_today_${t.id}_${todayDate}`,
                            title: `Deadline Today: ${t.title}`,
                            body: `PrepPilot reminder: "${t.title}" is due today. Complete it before your study window ends!`,
                            targetUrl: `/#/tasks?id=${encodeURIComponent(t.id)}`,
                            type: 'task_deadline',
                            priority: 'high',
                            category: 'due_today',
                        });
                    }
                    else if (t.deadline === tomorrowStr) {
                        // 1-Day advance alert: Enforce primary study window
                        if (inStudyWindow) {
                            candidateReminders.push({
                                eventId: `rem_${userId}_task_1d_${t.id}_${todayDate}`,
                                title: `Due Tomorrow: ${t.title}`,
                                body: `Upcoming task: "${t.title}" is due tomorrow (${tomorrowStr}). Plan your study session.`,
                                targetUrl: `/#/tasks?id=${encodeURIComponent(t.id)}`,
                                type: 'task_deadline',
                                priority: 'normal',
                                category: 'advance_1d',
                            });
                        }
                    }
                    else if (t.deadline === plus3DaysStr) {
                        // 3-Day advance alert: Enforce primary study window
                        if (inStudyWindow) {
                            candidateReminders.push({
                                eventId: `rem_${userId}_task_3d_${t.id}_${todayDate}`,
                                title: `3 Days to Deadline: ${t.title}`,
                                body: `Advance alert: "${t.title}" is scheduled for ${plus3DaysStr}. Start early to avoid stress!`,
                                targetUrl: `/#/tasks?id=${encodeURIComponent(t.id)}`,
                                type: 'task_deadline',
                                priority: 'normal',
                                category: 'advance_3d',
                            });
                        }
                    }
                }
                // B. Mock Tests: Exclude completed and deleted tests
                for (const m of mockTests) {
                    if (!m || m.deletedAt || m.completed || m.completedAt)
                        continue;
                    if (!m.scheduledDate)
                        continue;
                    if (m.scheduledDate === todayDate) {
                        candidateReminders.push({
                            eventId: `rem_${userId}_mock_today_${m.id}_${todayDate}`,
                            title: `Mock Test Today: ${m.testName}`,
                            body: `You scheduled "${m.testName}" for today. Set aside uninterrupted focus time.`,
                            targetUrl: `/#/mocks?id=${encodeURIComponent(m.id)}`,
                            type: 'mock_test',
                            priority: 'high',
                            category: 'test',
                        });
                    }
                    else if (m.scheduledDate === tomorrowStr) {
                        if (inStudyWindow) {
                            candidateReminders.push({
                                eventId: `rem_${userId}_mock_1d_${m.id}_${todayDate}`,
                                title: `Mock Test Tomorrow: ${m.testName}`,
                                body: `Prepare your environment for "${m.testName}" scheduled tomorrow (${tomorrowStr}).`,
                                targetUrl: `/#/mocks?id=${encodeURIComponent(m.id)}`,
                                type: 'mock_test',
                                priority: 'normal',
                                category: 'test',
                            });
                        }
                    }
                }
                // C. Spaced Revisions: Exclude deleted and completed intervals
                // Actually enforce revision window (e.g. 23:00–00:00 or user-configured revision window)
                if (inRevisionWindow) {
                    for (const r of revisionItems) {
                        if (!r || r.deletedAt || !Array.isArray(r.intervals))
                            continue;
                        for (const interval of r.intervals) {
                            if (!interval || interval.completed || interval.completedAt)
                                continue;
                            if (interval.targetDate === todayDate) {
                                const stageKey = (interval.stage || 'revision').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                                candidateReminders.push({
                                    eventId: `rem_${userId}_rev_${r.id}_${stageKey}_${todayDate}`,
                                    title: `Revision Due: ${r.topicTitle || 'Topic Review'}`,
                                    body: `Stage "${interval.stage}" recall session is due today. Review formula notes to lock into long-term memory!`,
                                    targetUrl: `/#/revision`,
                                    type: 'revision',
                                    priority: 'normal',
                                    category: 'revision',
                                });
                            }
                        }
                    }
                }
                // D. Handle user frequency preference: 'daily_summary' consolidation
                const userFrequency = userConfig.notificationFrequency || 'all';
                let eligibleCandidates = [];
                if (userFrequency === 'daily_summary') {
                    const overdueCount = candidateReminders.filter((c) => c.category === 'overdue').length;
                    const todayTasksCount = candidateReminders.filter((c) => c.category === 'due_today').length;
                    const todayTestsCount = candidateReminders.filter((c) => c.category === 'test' && c.priority === 'high').length;
                    const revisionsCount = candidateReminders.filter((c) => c.category === 'revision').length;
                    if (overdueCount > 0 || todayTasksCount > 0 || todayTestsCount > 0 || revisionsCount > 0) {
                        const summaryParts = [];
                        if (overdueCount > 0)
                            summaryParts.push(`${overdueCount} overdue`);
                        if (todayTasksCount > 0)
                            summaryParts.push(`${todayTasksCount} due today`);
                        if (todayTestsCount > 0)
                            summaryParts.push(`${todayTestsCount} test scheduled`);
                        if (revisionsCount > 0)
                            summaryParts.push(`${revisionsCount} revisions`);
                        eligibleCandidates.push({
                            eventId: `rem_${userId}_daily_summary_${todayDate}`,
                            title: `PrepPilot Daily Briefing • ${todayDate}`,
                            body: `Your schedule today: ${summaryParts.join(', ')}. Keep up your NIMCET consistency!`,
                            targetUrl: '/#/dashboard',
                            type: 'daily_summary',
                            priority: overdueCount > 0 || todayTestsCount > 0 ? 'high' : 'normal',
                            category: 'summary',
                        });
                    }
                }
                else if (userFrequency === 'urgent_only') {
                    eligibleCandidates = candidateReminders.filter((c) => c.priority === 'high');
                }
                else {
                    eligibleCandidates = candidateReminders;
                }
                // Suppress non-urgent reminders during quiet hours
                if (isQuietHours) {
                    eligibleCandidates = eligibleCandidates.filter((c) => c.priority === 'high');
                }
                if (eligibleCandidates.length === 0) {
                    continue;
                }
                // Prioritize: Overdue > Due Today > Mock Tests > Revisions > Advance
                eligibleCandidates.sort((a, b) => {
                    const score = (item) => {
                        let pts = 0;
                        if (item.category === 'overdue')
                            pts += 100;
                        if (item.category === 'due_today')
                            pts += 80;
                        if (item.category === 'test' && item.priority === 'high')
                            pts += 70;
                        if (item.category === 'summary')
                            pts += 60;
                        if (item.category === 'revision')
                            pts += 50;
                        if (item.category === 'advance_1d')
                            pts += 30;
                        if (item.category === 'advance_3d')
                            pts += 10;
                        return pts;
                    };
                    return score(b) - score(a);
                });
                // Cap at 2 highest-priority reminders per run to prevent alert fatigue
                const selectedToDispatch = eligibleCandidates.slice(0, 2);
                // 6. Dispatch each selected candidate using Atomic Reservation & Per-Device Tracking
                for (const reminder of selectedToDispatch) {
                    const deliveryDocRef = userSubDoc.ref.collection('delivery_history').doc(reminder.eventId);
                    // Filter active devices respecting device-level preferences
                    const intendedDevices = activeDevices.filter((dev) => {
                        const prefs = dev.notificationPreferences;
                        if (prefs?.notificationsPaused)
                            return false;
                        if (prefs?.notificationFrequency === 'urgent_only' && reminder.priority !== 'high') {
                            return false;
                        }
                        return true;
                    });
                    if (intendedDevices.length === 0) {
                        await deliveryDocRef.set({
                            deliveryId: reminder.eventId,
                            status: 'skipped',
                            reason: 'No devices eligible based on device notification preferences',
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        }, { merge: true });
                        continue;
                    }
                    const reservation = await db.runTransaction(async (transaction) => {
                        const docSnap = await transaction.get(deliveryDocRef);
                        if (!docSnap.exists) {
                            // Fresh unattempted reminder: Atomically claim initial in_progress reservation
                            transaction.set(deliveryDocRef, {
                                deliveryId: reminder.eventId,
                                status: 'in_progress',
                                attempts: 1,
                                lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
                                lastAttemptAtMillis: Date.now(),
                                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                title: reminder.title,
                                body: reminder.body,
                                targetUrl: reminder.targetUrl,
                                type: reminder.type,
                                priority: reminder.priority,
                                isTest: false,
                            });
                            return {
                                eligible: true,
                                attemptNumber: 1,
                                devicesToTarget: intendedDevices,
                                existingOutcomes: {},
                            };
                        }
                        const data = docSnap.data() || {};
                        // 1. If delivered successfully to all intended devices, skip
                        if (data.status === 'delivered') {
                            return {
                                eligible: false,
                                reason: 'already_delivered',
                                attemptNumber: data.attempts || 1,
                                devicesToTarget: [],
                                existingOutcomes: data.deviceOutcomes || {},
                            };
                        }
                        // 2. Safe Recovery for stale in_progress locks
                        if (data.status === 'in_progress') {
                            const lastAttemptMs = data.lastAttemptAt?.toMillis
                                ? data.lastAttemptAt.toMillis()
                                : data.lastAttemptAtMillis || 0;
                            const ageMs = Date.now() - lastAttemptMs;
                            if (ageMs < STALE_LOCK_MS) {
                                // Another active instance is currently processing this reminder
                                return {
                                    eligible: false,
                                    reason: 'currently_in_progress',
                                    attemptNumber: data.attempts || 1,
                                    devicesToTarget: [],
                                    existingOutcomes: data.deviceOutcomes || {},
                                };
                            }
                            // Stale in_progress: timed out or crashed > 5 min ago. Re-queue for recovery attempt!
                        }
                        // 3. Retry cap enforcement
                        const currentAttempts = data.attempts || 1;
                        if (currentAttempts >= MAX_RETRIES) {
                            return {
                                eligible: false,
                                reason: 'retry_cap_exhausted',
                                attemptNumber: currentAttempts,
                                devicesToTarget: [],
                                existingOutcomes: data.deviceOutcomes || {},
                            };
                        }
                        // 4. Retry delay (backoff) enforcement
                        const nextRetryMs = data.nextRetryAfter?.toMillis
                            ? data.nextRetryAfter.toMillis()
                            : 0;
                        if (Date.now() < nextRetryMs) {
                            return {
                                eligible: false,
                                reason: 'retry_delay_active',
                                attemptNumber: currentAttempts,
                                devicesToTarget: [],
                                existingOutcomes: data.deviceOutcomes || {},
                            };
                        }
                        // 5. Per-device partial delivery tracking:
                        // Identify which devices have NOT yet succeeded
                        const existingOutcomes = data.deviceOutcomes || {};
                        const devicesToRetry = intendedDevices.filter((dev) => {
                            const outcome = existingOutcomes[dev.deviceId];
                            return outcome?.status !== 'delivered';
                        });
                        if (devicesToRetry.length === 0) {
                            // All devices have already received the notification
                            transaction.set(deliveryDocRef, {
                                status: 'delivered',
                                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            }, { merge: true });
                            return {
                                eligible: false,
                                reason: 'all_devices_already_delivered',
                                attemptNumber: currentAttempts,
                                devicesToTarget: [],
                                existingOutcomes,
                            };
                        }
                        // Atomically update to in_progress with incremented attempt
                        const nextAttempt = currentAttempts + 1;
                        transaction.set(deliveryDocRef, {
                            status: 'in_progress',
                            attempts: nextAttempt,
                            lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
                            lastAttemptAtMillis: Date.now(),
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        }, { merge: true });
                        return {
                            eligible: true,
                            attemptNumber: nextAttempt,
                            devicesToTarget: devicesToRetry,
                            existingOutcomes,
                        };
                    });
                    if (!reservation.eligible || reservation.devicesToTarget.length === 0) {
                        continue;
                    }
                    const { attemptNumber, devicesToTarget, existingOutcomes } = reservation;
                    if (attemptNumber > 1) {
                        stats.retriedCount++;
                    }
                    stats.totalDispatches++;
                    const tokensToSend = devicesToTarget.map((d) => d.token);
                    const absoluteLink = getAbsoluteNotificationUrl(reminder.targetUrl);
                    const fcmMessage = {
                        tokens: tokensToSend,
                        notification: {
                            title: reminder.title,
                            body: reminder.body,
                        },
                        data: {
                            tag: reminder.eventId,
                            url: reminder.targetUrl, // internal hash route for SPA navigation
                            fullUrl: absoluteLink,
                            type: reminder.type,
                        },
                        webpush: {
                            fcmOptions: {
                                link: absoluteLink, // validated absolute HTTPS URL
                            },
                            notification: {
                                icon: getAbsoluteNotificationUrl('/pwa-192x192.png'),
                                badge: getAbsoluteNotificationUrl('/pwa-192x192.png'),
                                tag: reminder.eventId,
                            },
                        },
                    };
                    const mergedOutcomes = { ...existingOutcomes };
                    const errors = [];
                    try {
                        const batchResponse = await messaging.sendEachForMulticast(fcmMessage);
                        stats.successCount += batchResponse.successCount;
                        stats.failureCount += batchResponse.failureCount;
                        for (let i = 0; i < batchResponse.responses.length; i++) {
                            const resp = batchResponse.responses[i];
                            const targetDevice = devicesToTarget[i];
                            const deviceId = targetDevice ? targetDevice.deviceId : `dev_${i}`;
                            if (resp.success) {
                                mergedOutcomes[deviceId] = {
                                    status: 'delivered',
                                    messageId: resp.messageId,
                                    deliveredAt: new Date().toISOString(),
                                };
                            }
                            else {
                                const errCode = resp.error?.code || 'unknown_error';
                                errors.push(`${deviceId}: ${errCode}`);
                                if (errCode === 'messaging/registration-token-not-registered' ||
                                    errCode === 'messaging/invalid-registration-token' ||
                                    errCode === 'messaging/invalid-argument') {
                                    // Permanent token eviction
                                    stats.invalidTokensEvicted++;
                                    console.warn(`[PrepPilot FCM] Evicting invalid token for device ${deviceId}: ${errCode}`);
                                    mergedOutcomes[deviceId] = {
                                        status: 'evicted',
                                        error: errCode,
                                    };
                                    await userSubDoc.ref
                                        .collection('devices')
                                        .doc(deviceId)
                                        .set({
                                        active: false,
                                        deactivatedReason: errCode,
                                        deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                    }, { merge: true });
                                }
                                else {
                                    // Transient error -> eligible for retry
                                    mergedOutcomes[deviceId] = {
                                        status: 'failed',
                                        error: errCode,
                                        lastAttemptAt: new Date().toISOString(),
                                    };
                                }
                            }
                        }
                        // Check completion state across all intended devices
                        const allResolved = intendedDevices.every((dev) => {
                            const o = mergedOutcomes[dev.deviceId];
                            return o && (o.status === 'delivered' || o.status === 'evicted');
                        });
                        const anyDelivered = Object.values(mergedOutcomes).some((o) => o.status === 'delivered');
                        const hasPendingFailed = intendedDevices.some((dev) => {
                            const o = mergedOutcomes[dev.deviceId];
                            return o?.status === 'failed';
                        });
                        let finalStatus;
                        let nextRetryAfter = null;
                        if (allResolved) {
                            finalStatus = 'delivered';
                        }
                        else if (attemptNumber >= MAX_RETRIES) {
                            finalStatus = anyDelivered ? 'partial_failure' : 'failed';
                        }
                        else if (hasPendingFailed) {
                            // Retry only failed devices on next run
                            finalStatus = anyDelivered ? 'partial_failure' : 'failed';
                            nextRetryAfter = admin.firestore.Timestamp.fromMillis(Date.now() + RETRY_BACKOFF_MS);
                        }
                        else {
                            finalStatus = 'delivered';
                        }
                        await deliveryDocRef.set({
                            deliveryId: reminder.eventId,
                            status: finalStatus,
                            fcmAccepted: anyDelivered,
                            title: reminder.title,
                            body: reminder.body,
                            targetUrl: reminder.targetUrl,
                            type: reminder.type,
                            devicesTargeted: intendedDevices.length,
                            successCount: Object.values(mergedOutcomes).filter((o) => o.status === 'delivered').length,
                            failureCount: Object.values(mergedOutcomes).filter((o) => o.status === 'failed').length,
                            attempts: attemptNumber,
                            lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            nextRetryAfter,
                            deviceOutcomes: mergedOutcomes,
                            errorDetails: errors.length > 0 ? errors : null,
                            isTest: false,
                        }, { merge: true });
                    }
                    catch (sendErr) {
                        stats.failureCount += tokensToSend.length;
                        const errMsg = sendErr?.message || 'FCM dispatch exception';
                        console.error(`[PrepPilot Dispatcher] FCM error for event ${reminder.eventId}:`, sendErr);
                        // Record failure outcome per targeted device
                        for (const dev of devicesToTarget) {
                            mergedOutcomes[dev.deviceId] = {
                                status: 'failed',
                                error: errMsg,
                                lastAttemptAt: new Date().toISOString(),
                            };
                        }
                        const nextRetryAfter = attemptNumber < MAX_RETRIES
                            ? admin.firestore.Timestamp.fromMillis(Date.now() + RETRY_BACKOFF_MS)
                            : null;
                        await deliveryDocRef.set({
                            status: 'failed',
                            fcmAccepted: false,
                            attempts: attemptNumber,
                            lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            nextRetryAfter,
                            deviceOutcomes: mergedOutcomes,
                            errorDetails: [errMsg],
                            isTest: false,
                        }, { merge: true });
                    }
                }
            }
            catch (userErr) {
                console.error(`[PrepPilot Scheduler] Error processing user ${userId}:`, userErr);
            }
        }
        // 7. Write global system-wide heartbeat under /system_status/notification_backend
        const overallStatus = stats.failureCount > 0 && stats.successCount === 0
            ? 'degraded'
            : stats.failureCount > 0
                ? 'degraded'
                : 'healthy';
        try {
            await db.doc('system_status/notification_backend').set({
                status: overallStatus,
                lastRunAt: new Date().toISOString(),
                version: '2.2.0',
                scheduler: 'Cloud Functions v2 (Asia/Kolkata)',
                lastRunStats: {
                    processedUsers: stats.processedUsers,
                    totalDispatches: stats.totalDispatches,
                    successCount: stats.successCount,
                    failureCount: stats.failureCount,
                    retriedCount: stats.retriedCount,
                    invalidTokensEvicted: stats.invalidTokensEvicted,
                    lastError: stats.lastError,
                },
            }, { merge: true });
        }
        catch (sysErr) {
            console.error('[PrepPilot Scheduler] Could not write system status:', sysErr);
            stats.lastError = sysErr?.message || 'Failed to update system_status';
        }
    }
    catch (err) {
        stats.lastError = err?.message || 'Fatal scheduler execution error';
        console.error('[PrepPilot Scheduler] Fatal error in runStudyReminderDispatch:', err);
        try {
            await db.doc('system_status/notification_backend').set({
                status: 'error',
                lastRunAt: new Date().toISOString(),
                lastRunStats: stats,
            }, { merge: true });
        }
        catch { }
    }
    finally {
        isDispatchInProgress = false;
    }
    return stats;
}
/**
 * Scheduled Cloud Function (Cloud Functions v2)
 * Runs at 09:00, 14:00, 20:00, and 23:00 Asia/Kolkata daily.
 * Supports primary study sessions as well as the 23:00–00:00 late evening revision window.
 */
exports.checkAndSendStudyReminders = (0, scheduler_1.onSchedule)({
    schedule: '0 9,14,20,23 * * *',
    timeZone: 'Asia/Kolkata',
    retryCount: 2,
}, async () => {
    const results = await runStudyReminderDispatch();
    console.log('[PrepPilot Scheduler] Completed scheduled run:', results);
});
/**
 * SECURE Global Dispatch Endpoint (Administrator Workflow Only)
 *
 * Security Requirements Enforced:
 * - Method: POST only
 * - Secret Authorization: Binds ADMIN_DISPATCH_SECRET via Secret Manager integration.
 *   Also checks process.env.ADMIN_DISPATCH_SECRET or process.env.ADMIN_SECRET_KEY for emulator environments.
 * - Standard signed-in users or public internet callers CANNOT trigger global dispatches.
 */
exports.testReminderDispatch = (0, https_1.onRequest)({ secrets: [exports.adminDispatchSecret] }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({
            success: false,
            error: 'Method Not Allowed. POST is required.',
        });
        return;
    }
    // Retrieve admin secret configured via Secret Manager or environment
    const configuredSecret = (exports.adminDispatchSecret.value ? exports.adminDispatchSecret.value() : null) ||
        process.env.ADMIN_DISPATCH_SECRET ||
        process.env.ADMIN_SECRET_KEY;
    const providedKey = req.headers['x-admin-key'] ||
        (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7).trim()
            : undefined);
    if (!configuredSecret || !providedKey || providedKey !== configuredSecret) {
        console.warn('[PrepPilot Security] Unauthorized attempt to invoke global testReminderDispatch');
        res.status(403).json({
            success: false,
            error: 'Access Denied: Administrative authorization required. Standard app users and public requests cannot trigger global dispatches.',
        });
        return;
    }
    try {
        const results = await runStudyReminderDispatch();
        res.status(200).json({
            success: true,
            message: 'Global reminder evaluation completed successfully',
            results,
        });
    }
    catch (err) {
        console.error('[PrepPilot Scheduler] Admin dispatch failed:', err);
        res.status(500).json({
            success: false,
            error: err?.message || 'Dispatch execution failed',
        });
    }
});
/**
 * SECURE Per-User Delivery Test Endpoint
 *
 * Enables individual signed-in users to verify real backend FCM push delivery
 * to their OWN registered devices without triggering global reminders for others.
 *
 * Security Requirements Enforced:
 * - Method: POST only
 * - Authenticated Caller: Verifies caller's Firebase ID token via admin.auth().verifyIdToken()
 * - User Isolation: Targets ONLY the caller's active devices (/user_push_subscriptions/{uid}/devices)
 * - Absolute HTTPS URL: webpush.fcmOptions.link is validated against PREPPILOT_APP_URL
 * - Records a dedicated test audit event with isTest: true and consistent timestamp
 */
exports.sendUserTestNotification = (0, https_1.onRequest)(async (req, res) => {
    // Set CORS headers for PWA client domain
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method Not Allowed. POST is required.' });
        return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: 'Unauthorized: Firebase ID token required in Authorization header' });
        return;
    }
    const idToken = authHeader.slice(7).trim();
    let userId;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        userId = decodedToken.uid;
    }
    catch (authErr) {
        console.warn('[PrepPilot Security] Failed to verify user ID token:', authErr?.message);
        res.status(401).json({ success: false, error: 'Invalid or expired Firebase authentication token' });
        return;
    }
    try {
        // 1. Fetch user's registered active devices
        const userSubRef = db.doc(`user_push_subscriptions/${userId}`);
        const devicesSnap = await userSubRef
            .collection('devices')
            .where('active', '==', true)
            .get();
        const activeDevicesList = [];
        devicesSnap.forEach((doc) => {
            const d = doc.data();
            if (d.token && typeof d.token === 'string') {
                activeDevicesList.push({ deviceId: doc.id, token: d.token });
            }
        });
        // Check legacy root token fallback
        if (activeDevicesList.length === 0) {
            const rootSnap = await userSubRef.get();
            if (rootSnap.exists && rootSnap.data()?.fcmToken) {
                activeDevicesList.push({
                    deviceId: rootSnap.data()?.lastRegisteredDeviceId || 'legacy_device',
                    token: rootSnap.data()?.fcmToken,
                });
            }
        }
        if (activeDevicesList.length === 0) {
            res.status(404).json({
                success: false,
                error: 'No active device tokens found. Please enable Web Push in Settings to register this device first.',
            });
            return;
        }
        const testEventId = `test_${userId}_${Date.now()}`;
        const targetUrl = '/#/settings';
        const absoluteLink = getAbsoluteNotificationUrl(targetUrl);
        const activeTokens = activeDevicesList.map((d) => d.token);
        const fcmMessage = {
            tokens: activeTokens,
            notification: {
                title: 'PrepPilot • Delivery Test Verified',
                body: 'Real server-side FCM dispatch succeeded! Your background study notifications are operational.',
            },
            data: {
                tag: testEventId,
                url: targetUrl,
                fullUrl: absoluteLink,
                type: 'test_delivery',
                isTest: 'true',
            },
            webpush: {
                fcmOptions: {
                    link: absoluteLink,
                },
                notification: {
                    icon: getAbsoluteNotificationUrl('/pwa-192x192.png'),
                    badge: getAbsoluteNotificationUrl('/pwa-192x192.png'),
                    tag: testEventId,
                },
            },
        };
        const batchResponse = await messaging.sendEachForMulticast(fcmMessage);
        const isSuccess = batchResponse.successCount > 0;
        const deviceOutcomes = {};
        for (let i = 0; i < batchResponse.responses.length; i++) {
            const resp = batchResponse.responses[i];
            const targetDevice = activeDevicesList[i];
            const deviceId = targetDevice ? targetDevice.deviceId : `dev_${i}`;
            if (resp.success) {
                deviceOutcomes[deviceId] = {
                    status: 'delivered',
                    messageId: resp.messageId,
                    deliveredAt: new Date().toISOString(),
                };
            }
            else {
                const errCode = resp.error?.code || 'unknown_error';
                deviceOutcomes[deviceId] = {
                    status: 'failed',
                    error: errCode,
                    lastAttemptAt: new Date().toISOString(),
                };
            }
        }
        // Record dedicated delivery test audit in delivery_history with consistent server timestamp
        const deliveryDocRef = userSubRef.collection('delivery_history').doc(testEventId);
        await deliveryDocRef.set({
            deliveryId: testEventId,
            status: isSuccess ? 'delivered' : 'failed',
            fcmAccepted: isSuccess,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
            title: 'PrepPilot • Delivery Test Verified',
            body: 'Real server-side FCM dispatch succeeded! Your background study notifications are operational.',
            targetUrl,
            type: 'test_delivery',
            isTest: true,
            devicesTargeted: activeTokens.length,
            successCount: batchResponse.successCount,
            failureCount: batchResponse.failureCount,
            attempts: 1,
            deviceOutcomes,
        });
        res.status(200).json({
            success: isSuccess,
            message: isSuccess
                ? 'Test notification successfully dispatched through Firebase Cloud Messaging'
                : 'All FCM test dispatches failed',
            deliveredDevices: batchResponse.successCount,
            failedDevices: batchResponse.failureCount,
            eventId: testEventId,
        });
    }
    catch (err) {
        console.error(`[PrepPilot TestDispatch] Error testing user ${userId}:`, err);
        res.status(500).json({
            success: false,
            error: err?.message || 'Server test dispatch execution error',
        });
    }
});
//# sourceMappingURL=index.js.map