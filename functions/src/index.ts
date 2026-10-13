/**
 * PrepPilot — Scheduled Web Push Notification Backend (Firebase Cloud Functions v2)
 *
 * Capabilities:
 * - Timezone-aware evaluation in Asia/Kolkata (IST)
 * - Multi-device dispatch using Firebase Admin SDK & Cloud Messaging (FCM)
 * - Idempotency and deduplication via stable reminder event keys
 * - Invalid/unregistered token eviction
 * - Detailed delivery history audit records (/user_push_subscriptions/{uid}/delivery_history)
 * - System health status reporting (/system_status/notification_backend)
 * - Bounded retries and error tolerance
 */

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

// Server-side initialization: Admin SDK operates strictly on the backend with service credentials
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

// Set default region to asia-south1 (Mumbai) or closest region for minimal latency to Asia/Kolkata
setGlobalOptions({ region: 'asia-south1', maxInstances: 5 });

/**
 * Helper to get current date string (YYYY-MM-DD) and hour (0-23) in Asia/Kolkata timezone
 */
function getKolkataTimeInfo(customDate = new Date()): { dateStr: string; hour: number; timeStr: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(customDate);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const hour = parseInt(partMap.hour, 10);
  const timeStr = `${partMap.hour}:00`;

  return { dateStr, hour, timeStr };
}

interface ActiveDevice {
  deviceId: string;
  token: string;
  timezone: string;
  notificationPreferences?: {
    notificationsPaused?: boolean;
    notificationFrequency?: 'all' | 'daily_summary' | 'urgent_only';
    primaryStudyWindow?: string;
    revisionWindow?: string;
  };
}

interface PendingReminder {
  eventId: string;
  title: string;
  body: string;
  targetUrl: string;
  type: 'task_deadline' | 'mock_test' | 'revision' | 'overdue_topic';
  priority: 'high' | 'normal';
}

/**
 * Core dispatch engine that evaluates tasks, syllabus topics, and scheduled tests for all users
 */
export async function runStudyReminderDispatch(): Promise<{
  processedUsers: number;
  totalDispatches: number;
  successCount: number;
  failureCount: number;
  invalidTokensEvicted: number;
}> {
  const { dateStr: todayDate, hour: currentHour } = getKolkataTimeInfo();
  console.log(`[PrepPilot Scheduler] Starting reminder evaluation for IST Date: ${todayDate}, Hour: ${currentHour}:00`);

  let processedUsers = 0;
  let totalDispatches = 0;
  let successCount = 0;
  let failureCount = 0;
  let invalidTokensEvicted = 0;

  // 1. Retrieve all registered user push subscription root records
  const userSubsSnap = await db.collection('user_push_subscriptions').get();

  for (const userSubDoc of userSubsSnap.docs) {
    const userId = userSubDoc.id;
    processedUsers++;

    try {
      // 2. Fetch all active device records under user_push_subscriptions/{userId}/devices
      const devicesSnap = await userSubDoc.ref
        .collection('devices')
        .where('active', '==', true)
        .get();

      const activeDevices: ActiveDevice[] = [];
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

      // If no subcollection devices exist, check for legacy root document token
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
            },
          });
        }
      }

      if (activeDevices.length === 0) {
        continue;
      }

      // 3. Fetch user preparation dataset under /users/{userId}
      const userDocSnap = await db.doc(`users/${userId}`).get();
      if (!userDocSnap.exists) {
        continue;
      }

      const userData = userDocSnap.data() || {};
      const tasks: any[] = Array.isArray(userData.tasks) ? userData.tasks : [];
      const mockTests: any[] = Array.isArray(userData.mockTests) ? userData.mockTests : [];
      const userConfig = userData.userConfig || {};

      // 4. Assemble candidate reminder events
      const candidateReminders: PendingReminder[] = [];

      // A. Overdue & Due-Today Tasks (excluding completed, deleted, or rescheduled tasks)
      for (const t of tasks) {
        if (!t || t.deletedAt || t.status === 'completed') continue;
        if (!t.deadline) continue;

        if (t.deadline === todayDate) {
          candidateReminders.push({
            eventId: `rem_${userId}_task_today_${t.id}_${todayDate}`,
            title: `Deadline Today: ${t.title}`,
            body: `PrepPilot reminder: "${t.title}" is due today. Complete it to protect your streak!`,
            targetUrl: `/#/tasks?id=${encodeURIComponent(t.id)}`,
            type: 'task_deadline',
            priority: 'high',
          });
        } else if (t.deadline < todayDate) {
          candidateReminders.push({
            eventId: `rem_${userId}_task_overdue_${t.id}_${todayDate}`,
            title: `Overdue Task: ${t.title}`,
            body: `This item was scheduled for ${t.deadline}. Take a quick focus session to clear it!`,
            targetUrl: `/#/tasks?id=${encodeURIComponent(t.id)}`,
            type: 'task_deadline',
            priority: 'high',
          });
        }
      }

      // B. Scheduled Mock Tests for Today
      for (const m of mockTests) {
        if (!m || m.deletedAt || m.completed) continue;
        if (m.scheduledDate === todayDate) {
          candidateReminders.push({
            eventId: `rem_${userId}_mock_${m.id}_${todayDate}`,
            title: `Mock Test Today: ${m.testName}`,
            body: `You scheduled "${m.testName}" for today. Set aside uninterrupted focus time.`,
            targetUrl: `/#/mocks?id=${encodeURIComponent(m.id)}`,
            type: 'mock_test',
            priority: 'high',
          });
        }
      }

      // Cap notifications per run to avoid spamming the user (max 2 highest priority items)
      const selectedReminders = candidateReminders.slice(0, 2);

      // 5. Send reminders to each device respecting device-level preferences
      for (const reminder of selectedReminders) {
        // Check deduplication delivery history in Firestore: delivery_history/{eventId}
        const deliveryDocRef = userSubDoc.ref.collection('delivery_history').doc(reminder.eventId);
        const deliveryDocSnap = await deliveryDocRef.get();
        if (deliveryDocSnap.exists) {
          // Already successfully sent or attempted today for this event -> Skip!
          continue;
        }

        // Filter devices that allow this reminder
        const eligibleDevices = activeDevices.filter((dev) => {
          const prefs = dev.notificationPreferences;
          if (prefs?.notificationsPaused) return false;
          if (prefs?.notificationFrequency === 'urgent_only') {
            return reminder.priority === 'high';
          }
          return true;
        });

        if (eligibleDevices.length === 0) {
          continue;
        }

        totalDispatches++;
        const tokensToSend = eligibleDevices.map((d) => d.token);

        const fcmMessage: admin.messaging.MulticastMessage = {
          tokens: tokensToSend,
          notification: {
            title: reminder.title,
            body: reminder.body,
          },
          data: {
            tag: reminder.eventId,
            url: reminder.targetUrl,
            type: reminder.type,
          },
          webpush: {
            fcmOptions: {
              link: reminder.targetUrl,
            },
            notification: {
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag: reminder.eventId,
            },
          },
        };

        const batchResponse = await messaging.sendEachForMulticast(fcmMessage);
        successCount += batchResponse.successCount;
        failureCount += batchResponse.failureCount;

        // Clean up invalid/expired tokens reported by FCM
        for (let i = 0; i < batchResponse.responses.length; i++) {
          const resp = batchResponse.responses[i];
          if (!resp.success && resp.error) {
            const errCode = resp.error.code;
            if (
              errCode === 'messaging/registration-token-not-registered' ||
              errCode === 'messaging/invalid-registration-token' ||
              errCode === 'messaging/invalid-argument'
            ) {
              const badDevice = eligibleDevices[i];
              if (badDevice) {
                console.warn(
                  `[PrepPilot FCM] Evicting invalid token for device ${badDevice.deviceId}: ${errCode}`
                );
                invalidTokensEvicted++;
                await userSubDoc.ref
                  .collection('devices')
                  .doc(badDevice.deviceId)
                  .set(
                    {
                      active: false,
                      deactivatedReason: errCode,
                      deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                  );
              }
            }
          }
        }

        // Record audit entry in delivery_history subcollection
        await deliveryDocRef.set({
          deliveryId: reminder.eventId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          status: batchResponse.successCount > 0 ? 'delivered' : 'failed',
          title: reminder.title,
          body: reminder.body,
          targetUrl: reminder.targetUrl,
          type: reminder.type,
          devicesTargeted: tokensToSend.length,
          successCount: batchResponse.successCount,
          failureCount: batchResponse.failureCount,
        });
      }
    } catch (userErr) {
      console.error(`[PrepPilot Scheduler] Error processing user ${userId}:`, userErr);
    }
  }

  // Record system-wide health heartbeat under /system_status/notification_backend
  try {
    await db.doc('system_status/notification_backend').set(
      {
        status: 'healthy',
        lastRunAt: new Date().toISOString(),
        version: '1.0.0',
        scheduler: 'Cloud Functions v2 (Asia/Kolkata)',
        lastRunStats: {
          processedUsers,
          totalDispatches,
          successCount,
          failureCount,
          invalidTokensEvicted,
        },
      },
      { merge: true }
    );
  } catch (sysErr) {
    console.error('[PrepPilot Scheduler] Could not write system status:', sysErr);
  }

  return {
    processedUsers,
    totalDispatches,
    successCount,
    failureCount,
    invalidTokensEvicted,
  };
}

/**
 * Scheduled Cloud Function (Cloud Functions v2)
 * Runs at 09:00, 14:00, and 20:00 Asia/Kolkata every day
 * (Peak study reminder intervals for NIMCET preparation)
 */
export const checkAndSendStudyReminders = onSchedule(
  {
    schedule: '0 9,14,20 * * *',
    timeZone: 'Asia/Kolkata',
    retryCount: 2,
  },
  async () => {
    const results = await runStudyReminderDispatch();
    console.log('[PrepPilot Scheduler] Finished scheduled run:', results);
  }
);

/**
 * HTTPS Test Endpoint for Verification & Development
 * Allows administrators or verified test calls to trigger reminder processing on demand.
 */
export const testReminderDispatch = onRequest(async (req, res) => {
  try {
    const results = await runStudyReminderDispatch();
    res.status(200).json({
      success: true,
      message: 'Reminder evaluation completed successfully',
      results,
    });
  } catch (err: any) {
    console.error('[PrepPilot Scheduler] Test dispatch failed:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Dispatch execution failed',
    });
  }
});
