"use strict";
/**
 * PrepPilot — Scheduled Web Push Notification Backend (Firebase Cloud Functions v2)
 *
 * Capabilities:
 * - Parameterized Configuration:
 *   * Uses modern Firebase Functions v2 params API (`defineString('PREPPILOT_APP_URL')`).
 *   * Requires valid HTTPS production URL; validates origin, rejects embedded credentials and subpaths.
 *   * Generates absolute HTTPS URLs for webpush.fcmOptions.link, notification icons, and badges.
 * - Delivery Status & Partial Failures:
 *   * Distinguishes FCM message acceptance from confirmed on-device display.
 *   * Returns accurate statuses ('accepted_by_fcm', 'partial_failure', 'failed').
 *   * Returns separate accepted and failed device counts with exact per-device error codes.
 *   * Test dispatches are kept distinct from scheduled reminders.
 * - Window & Priority Enforcement:
 *   * Primary study window (e.g. 14:00–21:00) enforced for normal reminders.
 *   * Late evening revision window (e.g. 23:00–00:00) enforced for spaced recall items.
 *   * Urgent items (overdue, due today) obey study window unless `userConfig.urgentBypassStudyWindow === true`.
 *   * Quiet hours (01:00–07:00) strictly enforced under all conditions.
 *   * Retries obey the same eligibility rules as initial dispatches.
 * - Timezone Handling:
 *   * Explicit account-level timezone (`userConfig.timezone`, defaulting to Asia/Kolkata)
 *     evaluated consistently across all registered devices for the user account.
 * - Security & Reliability:
 *   * Secret Manager integration (`ADMIN_DISPATCH_SECRET`) for global administrator endpoint.
 *   * Per-user Firebase Auth ID token verification for test dispatches.
 *   * Atomic Firestore transaction locks prevent duplicate concurrent dispatches.
 *   * Stale lock recovery (> 5 min) and bounded retries (MAX_RETRIES = 3, 30 min backoff).
 *   * Automatic eviction of unregistered/invalid FCM tokens.
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendUserTestNotification = exports.testReminderDispatch = exports.checkAndSendStudyReminders = exports.preppilotAppUrl = exports.adminDispatchSecret = void 0;
exports.getAppUrl = getAppUrl;
exports.getAbsoluteNotificationUrl = getAbsoluteNotificationUrl;
exports.runStudyReminderDispatch = runStudyReminderDispatch;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const params_1 = require("firebase-functions/params");
const notificationUtils_1 = require("./notificationUtils");
__exportStar(require("./notificationUtils"), exports);
// Server-side initialization: Admin SDK operates strictly on the backend with service credentials
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
const messaging = admin.messaging();
// Set default region to asia-south1 (Mumbai) for low latency to Asia/Kolkata users
(0, v2_1.setGlobalOptions)({ region: 'asia-south1', maxInstances: 5 });
// Administrator secret for secure global dispatch endpoint via Secret Manager
exports.adminDispatchSecret = (0, params_1.defineSecret)('ADMIN_DISPATCH_SECRET');
// Modern Firebase Functions v2 Parameterized Configuration for production app origin
exports.preppilotAppUrl = (0, params_1.defineString)('PREPPILOT_APP_URL', {
    description: 'The canonical HTTPS production URL of PrepPilot (e.g. https://ais-dev-cor4kmqaedoz6lvhxagzys-915145878473.asia-southeast1.run.app)',
    default: process.env.PREPPILOT_APP_URL || '',
});
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 30 * 60 * 1000; // 30 minutes
const STALE_LOCK_MS = 5 * 60 * 1000; // 5 minutes to recover abandoned in_progress reservations
/**
 * Helper to get validated base application URL through parameter or environment
 */
function getAppUrl() {
    let val;
    try {
        val = exports.preppilotAppUrl.value ? exports.preppilotAppUrl.value() : undefined;
    }
    catch {
        val = process.env.PREPPILOT_APP_URL;
    }
    return (0, notificationUtils_1.validateAppOrigin)(val || process.env.PREPPILOT_APP_URL);
}
/**
 * Returns validated absolute notification URL
 */
function getAbsoluteNotificationUrl(internalRoute) {
    return (0, notificationUtils_1.getAbsoluteNotificationUrl)(internalRoute, getAppUrl());
}
let isDispatchInProgress = false;
/**
 * Core Reminder Evaluation and Dispatch Engine
 */
async function runStudyReminderDispatch() {
    const startedAt = new Date().toISOString();
    const stats = {
        startedAt,
        totalUsersChecked: 0,
        totalUsersWithReminders: 0,
        totalDispatches: 0,
        successCount: 0,
        failureCount: 0,
        retriedCount: 0,
        invalidTokensEvicted: 0,
    };
    if (isDispatchInProgress) {
        console.warn('[PrepPilot Dispatcher] Another dispatch run is currently active. Skipping overlapping run.');
        return stats;
    }
    isDispatchInProgress = true;
    try {
        // Validate configured production URL before running dispatches
        const appOrigin = getAppUrl();
        console.log(`[PrepPilot Dispatcher] Starting scheduled dispatch with verified app origin: ${appOrigin}`);
        // Query all users who have active push subscriptions
        const subscriptionsSnap = await db.collection('user_push_subscriptions').get();
        stats.totalUsersChecked = subscriptionsSnap.docs.length;
        for (const userSubDoc of subscriptionsSnap.docs) {
            const userId = userSubDoc.id;
            try {
                // 1. Fetch active devices from subcollection /user_push_subscriptions/{userId}/devices
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
                // 2. Fetch user preparation data under /users/{userId}
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
                // Timezone Policy: Use one explicit account-level timezone consistently across all devices.
                // Sourced from userConfig.timezone, with fallback to accountTimezone on subscription record or 'Asia/Kolkata'.
                const accountTimezone = userConfig.timezone || userSubDoc.data()?.accountTimezone || 'Asia/Kolkata';
                const userTime = (0, notificationUtils_1.getTimeInfo)(accountTimezone);
                const { dateStr: todayDate, hour: userHour, tomorrowStr, plus3DaysStr } = userTime;
                const primaryStudyWindow = userConfig.primaryStudyWindow || '14:00–21:00';
                const revisionWindow = userConfig.revisionWindow || '23:00–00:00';
                const notificationFrequency = userConfig.notificationFrequency || 'all';
                const urgentBypassStudyWindow = userConfig.urgentBypassStudyWindow === true;
                const tasks = Array.isArray(userData.tasks) ? userData.tasks : [];
                const mockTests = Array.isArray(userData.mockTests) ? userData.mockTests : [];
                const revisionItems = Array.isArray(userData.revisionItems) ? userData.revisionItems : [];
                // 3. Assemble candidate reminder events
                const candidateReminders = [];
                // A. Tasks: Exclude completed, deleted, and cancelled tasks
                for (const t of tasks) {
                    if (!t || t.deletedAt || t.status === 'completed' || t.completedAt)
                        continue;
                    if (!t.deadline)
                        continue;
                    if (t.deadline < todayDate) {
                        // Overdue tasks: Urgent alert
                        const eligible = (0, notificationUtils_1.isReminderWindowEligible)({
                            category: 'overdue',
                            priority: 'high',
                            userHour,
                            primaryStudyWindow,
                            revisionWindow,
                            notificationsPaused: false,
                            notificationFrequency,
                            urgentBypassStudyWindow,
                        });
                        if (eligible.eligible) {
                            candidateReminders.push({
                                eventId: `rem_${userId}_task_overdue_${t.id}_${todayDate}`,
                                itemId: t.id,
                                title: `Overdue Task: ${t.title}`,
                                body: `Scheduled for ${t.deadline}. Spend 25 minutes now to protect your preparation streak!`,
                                targetUrl: `/#/tasks?id=${encodeURIComponent(t.id)}`,
                                type: 'task_deadline',
                                priority: 'high',
                                category: 'overdue',
                            });
                        }
                    }
                    else if (t.deadline === todayDate) {
                        // Due today: Urgent alert
                        const eligible = (0, notificationUtils_1.isReminderWindowEligible)({
                            category: 'due_today',
                            priority: 'high',
                            userHour,
                            primaryStudyWindow,
                            revisionWindow,
                            notificationsPaused: false,
                            notificationFrequency,
                            urgentBypassStudyWindow,
                        });
                        if (eligible.eligible) {
                            candidateReminders.push({
                                eventId: `rem_${userId}_task_today_${t.id}_${todayDate}`,
                                itemId: t.id,
                                title: `Deadline Today: ${t.title}`,
                                body: `PrepPilot reminder: "${t.title}" is due today. Complete it before your study window ends!`,
                                targetUrl: `/#/tasks?id=${encodeURIComponent(t.id)}`,
                                type: 'task_deadline',
                                priority: 'high',
                                category: 'due_today',
                            });
                        }
                    }
                    else if (t.deadline === tomorrowStr) {
                        // 1-Day advance alert: Enforce primary study window
                        const eligible = (0, notificationUtils_1.isReminderWindowEligible)({
                            category: 'advance_1d',
                            priority: 'normal',
                            userHour,
                            primaryStudyWindow,
                            revisionWindow,
                            notificationsPaused: false,
                            notificationFrequency,
                            urgentBypassStudyWindow,
                        });
                        if (eligible.eligible) {
                            candidateReminders.push({
                                eventId: `rem_${userId}_task_1d_${t.id}_${todayDate}`,
                                itemId: t.id,
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
                        const eligible = (0, notificationUtils_1.isReminderWindowEligible)({
                            category: 'advance_3d',
                            priority: 'normal',
                            userHour,
                            primaryStudyWindow,
                            revisionWindow,
                            notificationsPaused: false,
                            notificationFrequency,
                            urgentBypassStudyWindow,
                        });
                        if (eligible.eligible) {
                            candidateReminders.push({
                                eventId: `rem_${userId}_task_3d_${t.id}_${todayDate}`,
                                itemId: t.id,
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
                        // Test today: Urgent
                        const eligible = (0, notificationUtils_1.isReminderWindowEligible)({
                            category: 'test',
                            priority: 'high',
                            userHour,
                            primaryStudyWindow,
                            revisionWindow,
                            notificationsPaused: false,
                            notificationFrequency,
                            urgentBypassStudyWindow,
                        });
                        if (eligible.eligible) {
                            candidateReminders.push({
                                eventId: `rem_${userId}_mock_today_${m.id}_${todayDate}`,
                                itemId: m.id,
                                title: `Mock Test Today: ${m.testName}`,
                                body: `You scheduled "${m.testName}" for today. Set aside uninterrupted focus time.`,
                                targetUrl: `/#/mocks?id=${encodeURIComponent(m.id)}`,
                                type: 'mock_test',
                                priority: 'high',
                                category: 'test',
                            });
                        }
                    }
                    else if (m.scheduledDate === tomorrowStr) {
                        // Test tomorrow: Normal
                        const eligible = (0, notificationUtils_1.isReminderWindowEligible)({
                            category: 'test',
                            priority: 'normal',
                            userHour,
                            primaryStudyWindow,
                            revisionWindow,
                            notificationsPaused: false,
                            notificationFrequency,
                            urgentBypassStudyWindow,
                        });
                        if (eligible.eligible) {
                            candidateReminders.push({
                                eventId: `rem_${userId}_mock_1d_${m.id}_${todayDate}`,
                                itemId: m.id,
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
                for (const r of revisionItems) {
                    if (!r || r.deletedAt || !Array.isArray(r.intervals))
                        continue;
                    for (const interval of r.intervals) {
                        if (!interval || interval.completed || interval.completedAt)
                            continue;
                        if (interval.targetDate === todayDate) {
                            const eligible = (0, notificationUtils_1.isReminderWindowEligible)({
                                category: 'revision',
                                priority: 'normal',
                                userHour,
                                primaryStudyWindow,
                                revisionWindow,
                                notificationsPaused: false,
                                notificationFrequency,
                                urgentBypassStudyWindow,
                            });
                            if (eligible.eligible) {
                                const stageKey = (interval.stage || 'revision').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                                candidateReminders.push({
                                    eventId: `rem_${userId}_rev_${r.id}_${stageKey}_${todayDate}`,
                                    itemId: r.id,
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
                // D. Handle 'daily_summary' consolidation
                let eligibleCandidates = [];
                if (notificationFrequency === 'daily_summary') {
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
                            body: `Today's schedule: ${summaryParts.join(', ')}. Review your timeline in PrepPilot.`,
                            targetUrl: `/#/tasks`,
                            type: 'daily_summary',
                            priority: 'high',
                            category: 'daily_summary',
                        });
                    }
                }
                else {
                    eligibleCandidates = candidateReminders;
                }
                if (eligibleCandidates.length === 0) {
                    continue;
                }
                stats.totalUsersWithReminders++;
                // 4. Dispatch each eligible reminder with Atomic Transaction & Retry Lock
                for (const reminder of eligibleCandidates) {
                    const deliveryDocRef = userSubDoc.ref.collection('delivery_history').doc(reminder.eventId);
                    // Filter intended devices based on per-device preference overrides
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
                            // Initial unattempted reminder: Atomically claim initial in_progress reservation
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
                        // 1. If already completed / accepted by all intended devices, skip
                        if (data.status === 'accepted_by_fcm' || data.status === 'delivered') {
                            return {
                                eligible: false,
                                reason: 'already_completed',
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
                            // Stale in_progress: timed out or crashed > 5 min ago. Re-queue for recovery!
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
                        // 5. Retry Eligibility: Retries MUST obey the same window and quiet-hours rules
                        const retryWindowCheck = (0, notificationUtils_1.isReminderWindowEligible)({
                            category: reminder.category,
                            priority: reminder.priority,
                            userHour,
                            primaryStudyWindow,
                            revisionWindow,
                            notificationsPaused: false,
                            notificationFrequency,
                            urgentBypassStudyWindow,
                        });
                        if (!retryWindowCheck.eligible) {
                            return {
                                eligible: false,
                                reason: `retry_window_closed_${retryWindowCheck.reason}`,
                                attemptNumber: currentAttempts,
                                devicesToTarget: [],
                                existingOutcomes: data.deviceOutcomes || {},
                            };
                        }
                        // 6. Per-device partial delivery tracking:
                        // Identify which devices have NOT yet been accepted by FCM
                        const existingOutcomes = data.deviceOutcomes || {};
                        const devicesToRetry = intendedDevices.filter((dev) => {
                            const outcome = existingOutcomes[dev.deviceId];
                            return !outcome || (outcome.status !== 'accepted_by_fcm' && outcome.status !== 'delivered' && outcome.status !== 'evicted');
                        });
                        if (devicesToRetry.length === 0) {
                            // All devices have already received the notification
                            transaction.set(deliveryDocRef, {
                                status: 'accepted_by_fcm',
                                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            }, { merge: true });
                            return {
                                eligible: false,
                                reason: 'all_devices_already_accepted',
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
                    try {
                        const batchResponse = await messaging.sendEachForMulticast(fcmMessage);
                        stats.successCount += batchResponse.successCount;
                        stats.failureCount += batchResponse.failureCount;
                        const outcomesResult = (0, notificationUtils_1.calculateMulticastOutcomes)({
                            devices: devicesToTarget,
                            fcmResponses: batchResponse.responses,
                            existingOutcomes,
                        });
                        // Evict invalid/expired tokens permanently from Firestore
                        if (outcomesResult.invalidTokensToEvict.length > 0) {
                            stats.invalidTokensEvicted += outcomesResult.invalidTokensToEvict.length;
                            for (const devId of outcomesResult.invalidTokensToEvict) {
                                console.warn(`[PrepPilot FCM] Evicting invalid registration token for device ${devId}`);
                                await userSubDoc.ref.collection('devices').doc(devId).set({
                                    active: false,
                                    deactivatedReason: 'invalid_or_expired_registration_token',
                                    deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                }, { merge: true });
                            }
                        }
                        // Check completion state across all intended devices
                        const allResolved = intendedDevices.every((dev) => {
                            const o = outcomesResult.deviceOutcomes[dev.deviceId];
                            return o && (o.status === 'accepted_by_fcm' || o.status === 'delivered' || o.status === 'evicted');
                        });
                        const hasPendingFailed = intendedDevices.some((dev) => {
                            const o = outcomesResult.deviceOutcomes[dev.deviceId];
                            return o?.status === 'failed';
                        });
                        let finalStatus;
                        let nextRetryAfter = null;
                        if (allResolved) {
                            finalStatus = 'accepted_by_fcm';
                        }
                        else if (hasPendingFailed && attemptNumber < MAX_RETRIES) {
                            finalStatus = outcomesResult.acceptedDevicesCount > 0 ? 'partial_failure' : 'failed';
                            nextRetryAfter = admin.firestore.Timestamp.fromMillis(Date.now() + RETRY_BACKOFF_MS);
                        }
                        else {
                            finalStatus = outcomesResult.acceptedDevicesCount > 0 ? 'partial_failure' : 'failed';
                        }
                        await deliveryDocRef.set({
                            deliveryId: reminder.eventId,
                            status: finalStatus,
                            fcmAccepted: outcomesResult.acceptedDevicesCount > 0,
                            confirmedDisplayed: false, // Accurate: FCM acceptance != confirmed client display
                            title: reminder.title,
                            body: reminder.body,
                            targetUrl: reminder.targetUrl,
                            type: reminder.type,
                            devicesTargeted: intendedDevices.length,
                            acceptedDevices: Object.values(outcomesResult.deviceOutcomes).filter((o) => o.status === 'accepted_by_fcm' || o.status === 'delivered').length,
                            failedDevices: Object.values(outcomesResult.deviceOutcomes).filter((o) => o.status === 'failed').length,
                            attempts: attemptNumber,
                            lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            nextRetryAfter,
                            deviceOutcomes: outcomesResult.deviceOutcomes,
                            isTest: false,
                        }, { merge: true });
                    }
                    catch (sendErr) {
                        stats.failureCount += tokensToSend.length;
                        const errMsg = sendErr?.message || 'FCM dispatch exception';
                        console.error(`[PrepPilot Dispatcher] FCM error for event ${reminder.eventId}:`, sendErr);
                        const mergedOutcomes = { ...existingOutcomes };
                        for (const dev of devicesToTarget) {
                            mergedOutcomes[dev.deviceId] = {
                                status: 'failed',
                                fcmAccepted: false,
                                confirmedDisplayed: false,
                                errorMessage: errMsg,
                                failedAt: new Date().toISOString(),
                            };
                        }
                        const nextRetryAfter = attemptNumber < MAX_RETRIES
                            ? admin.firestore.Timestamp.fromMillis(Date.now() + RETRY_BACKOFF_MS)
                            : null;
                        await deliveryDocRef.set({
                            status: 'failed',
                            fcmAccepted: false,
                            confirmedDisplayed: false,
                            attempts: attemptNumber,
                            lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            nextRetryAfter,
                            deviceOutcomes: mergedOutcomes,
                            errorMessage: errMsg,
                            isTest: false,
                        }, { merge: true });
                    }
                }
            }
            catch (userErr) {
                console.error(`[PrepPilot Scheduler] Error processing user ${userId}:`, userErr);
                stats.lastError = userErr?.message;
            }
        }
        stats.completedAt = new Date().toISOString();
        // 5. Update global backend heartbeat record for frontend health verification
        await db.doc('system_status/notification_backend').set({
            isDeployed: true,
            deployedRuntime: 'Node.js 22 (Cloud Functions v2)',
            appOrigin,
            timeZone: 'Asia/Kolkata',
            schedule: '0 8-23 * * * (Hourly 08:00-23:00 IST)',
            lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
            lastRunStats: stats,
            systemHeartbeatStatus: stats.failureCount > 0 ? 'degraded' : 'healthy',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    finally {
        isDispatchInProgress = false;
    }
    return stats;
}
/**
 * Scheduled Cloud Function (Cloud Functions v2)
 * Runs hourly from 08:00 to 23:00 Asia/Kolkata daily.
 * Fully serves primary study sessions and specifically the 23:00–00:00 late evening revision window.
 */
exports.checkAndSendStudyReminders = (0, scheduler_1.onSchedule)({
    schedule: '0 8-23 * * *',
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
 * - Standard signed-in users or public callers CANNOT trigger global dispatches.
 */
exports.testReminderDispatch = (0, https_1.onRequest)({ secrets: [exports.adminDispatchSecret] }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({
            success: false,
            error: 'Method Not Allowed. POST is required.',
        });
        return;
    }
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
 * Requirements Enforced:
 * - Method: POST only
 * - Authenticated Caller: Verifies caller's Firebase ID token via admin.auth().verifyIdToken()
 * - User Isolation: Targets ONLY the caller's active devices (/user_push_subscriptions/{uid}/devices)
 * - Absolute HTTPS URL: webpush.fcmOptions.link is validated against PREPPILOT_APP_URL
 * - Accurate Status: Distinguishes FCM acceptance ('accepted_by_fcm') from device display
 * - Partial Failure: A partially successful test is NOT marked as completely successful
 * - Returns separate accepted and failed device counts with exact per-device error codes
 */
exports.sendUserTestNotification = (0, https_1.onRequest)(async (req, res) => {
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
                error: 'No active device tokens found. Please click "Register Web Push" in Settings to register this device first.',
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
                body: 'Real server-side FCM dispatch verified! Your background study notification path is operational.',
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
        const outcomesResult = (0, notificationUtils_1.calculateMulticastOutcomes)({
            devices: activeDevicesList,
            fcmResponses: batchResponse.responses,
        });
        // Automatically deactivate invalid/expired tokens in Firestore
        for (const devId of outcomesResult.invalidTokensToEvict) {
            await userSubRef.collection('devices').doc(devId).set({
                active: false,
                deactivatedReason: 'invalid_or_expired_registration_token',
                deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        const isFullAcceptance = outcomesResult.overallStatus === 'accepted_by_fcm';
        const isPartialFailure = outcomesResult.overallStatus === 'partial_failure';
        // Record dedicated delivery test audit with accurate status
        const deliveryDocRef = userSubRef.collection('delivery_history').doc(testEventId);
        await deliveryDocRef.set({
            deliveryId: testEventId,
            status: outcomesResult.overallStatus,
            fcmAccepted: outcomesResult.acceptedDevicesCount > 0,
            confirmedDisplayed: false, // Honest: FCM acceptance != confirmed client device display
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
            title: 'PrepPilot • Delivery Test Verified',
            body: 'Real server-side FCM dispatch verified! Your background study notification path is operational.',
            targetUrl,
            fullUrl: absoluteLink,
            type: 'test_delivery',
            isTest: true,
            devicesTargeted: activeTokens.length,
            acceptedDevices: outcomesResult.acceptedDevicesCount,
            failedDevices: outcomesResult.failedDevicesCount,
            attempts: 1,
            deviceOutcomes: outcomesResult.deviceOutcomes,
        });
        // Detailed user message
        let message;
        if (isFullAcceptance) {
            message = `FCM Accepted: Message accepted by Firebase Cloud Messaging for ${outcomesResult.acceptedDevicesCount} active device(s). (Note: Verifies server transmission; client display requires device wake & system permissions).`;
        }
        else if (isPartialFailure) {
            message = `Partial Dispatch Warning: FCM accepted ${outcomesResult.acceptedDevicesCount} device(s), but failed for ${outcomesResult.failedDevicesCount} device(s). Check device token validity in Settings.`;
        }
        else {
            message = `FCM Dispatch Failed: 0 of ${activeTokens.length} devices accepted by Firebase Cloud Messaging.`;
        }
        res.status(200).json({
            success: isFullAcceptance, // Partial failure returns success: false so it is never displayed as completely successful!
            status: outcomesResult.overallStatus,
            fcmAccepted: outcomesResult.acceptedDevicesCount > 0,
            confirmedDisplayed: false,
            message,
            acceptedDevices: outcomesResult.acceptedDevicesCount,
            failedDevices: outcomesResult.failedDevicesCount,
            totalDevices: activeTokens.length,
            deviceOutcomes: outcomesResult.deviceOutcomes,
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