import { registerPlugin, Capacitor } from '@capacitor/core';

export interface InstalledAppInfo {
  packageName: string;
  appName: string;
  iconBase64?: string;
  isSystemApp?: boolean;
  category?: 'utility' | 'communication' | 'productivity' | 'social' | 'entertainment' | 'other';
  isEssential?: boolean; // Emergency dialer, system settings, phone
}

export interface FocusLockPermissionStatus {
  usageAccessGranted: boolean;
  overlayGranted: boolean;
  accessibilityGranted?: boolean;
  screenTimeAuthorized?: boolean;
  canEnforceLock: boolean;
  missingPermissions: string[];
  message: string;
}

export interface FocusLockSessionConfig {
  durationMinutes: number;
  breakMinutes: number;
  allowlistedPackages: string[];
  topicId?: string;
  topicTitle?: string;
  taskId?: string;
  allowEarlyExit: boolean;
  strictMode?: boolean;
  startedAt: string;
  plannedEndTime: string;
}

export interface FocusLockActiveState {
  isActive: boolean;
  remainingSeconds: number;
  totalDurationSeconds: number;
  allowlistedPackages: string[];
  allowEarlyExit: boolean;
  startTime: string;
  endTime: string;
  restrictionsActive: boolean;
  platform: 'android' | 'ios' | 'web';
  topicId?: string;
  topicTitle?: string;
  taskId?: string;
}

export interface FocusLockSessionRecord {
  id: string;
  startedAt: string;
  endedAt: string;
  plannedMinutes: number;
  actualMinutes: number;
  allowlistedPackageCount: number;
  status: 'completed' | 'cancelled' | 'interrupted' | 'failed';
  topicId?: string;
  topicTitle?: string;
  taskId?: string;
  restrictionsSuccessfullyEnforced: boolean;
  platform: string;
}

export type FocusLockPresetId = 'study_essentials' | 'minimal' | 'custom';

export interface FocusLockPreset {
  id: FocusLockPresetId;
  name: string;
  description: string;
  recommendedPackages: string[];
}

export interface MobileFocusLockPlugin {
  checkPermissions(): Promise<FocusLockPermissionStatus>;
  requestUsageAccessPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<{ granted: boolean }>;
  requestAccessibilityPermission(): Promise<{ granted: boolean }>;
  requestScreenTimeAuthorization(): Promise<{ granted: boolean }>;
  openDigitalWellbeingSettings(): Promise<void>;
  getInstalledApps(): Promise<{ apps: InstalledAppInfo[] }>;
  startFocusLock(config: FocusLockSessionConfig): Promise<{ success: boolean; message: string }>;
  stopFocusLock(): Promise<{ success: boolean; sessionRecord?: FocusLockSessionRecord }>;
  getLockStatus(): Promise<FocusLockActiveState>;
}

// Register Capacitor native plugin bridge
const NativePlugin = registerPlugin<MobileFocusLockPlugin>('MobileFocusLock');

const ALLOWLIST_STORAGE_KEY = 'preppilot_focus_allowlist_packages';
const PRESET_STORAGE_KEY = 'preppilot_focus_active_preset';

export const FOCUS_LOCK_PRESETS: FocusLockPreset[] = [
  {
    id: 'study_essentials',
    name: 'Study Essentials',
    description: 'Permits PrepPilot, Calculator, Notes, PDF readers, and browser for formula research.',
    recommendedPackages: [
      'com.preppilot.nimcet2027',
      'com.google.android.calculator',
      'com.android.calculator2',
      'com.google.android.keep',
      'com.google.android.apps.docs',
      'com.adobe.reader',
      'com.android.chrome',
      'com.google.android.dialer',
      'com.android.phone',
      'com.google.android.deskclock',
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal Distractions',
    description: 'Permits only PrepPilot, Phone dialer, and System Clock. Zero external app access.',
    recommendedPackages: [
      'com.preppilot.nimcet2027',
      'com.google.android.dialer',
      'com.android.phone',
      'com.google.android.deskclock',
    ],
  },
  {
    id: 'custom',
    name: 'Custom Selection',
    description: 'Manually select exactly which installed applications are allowed.',
    recommendedPackages: ['com.preppilot.nimcet2027'],
  },
];

// Helper methods for web fallback and local persistence
export const MobileFocusLockService = {
  isSupportedOnCurrentPlatform(): boolean {
    return Capacitor.isNativePlatform();
  },

  getPlatformName(): 'android' | 'ios' | 'web' {
    return Capacitor.getPlatform() as 'android' | 'ios' | 'web';
  },

  async checkPermissions(): Promise<FocusLockPermissionStatus> {
    if (!Capacitor.isNativePlatform()) {
      return {
        usageAccessGranted: false,
        overlayGranted: false,
        canEnforceLock: false,
        missingPermissions: ['Native Companion Required'],
        message:
          'Native Android or iOS companion is required to enforce system-level app restrictions.',
      };
    }
    try {
      return await NativePlugin.checkPermissions();
    } catch {
      return {
        usageAccessGranted: false,
        overlayGranted: false,
        canEnforceLock: false,
        missingPermissions: ['Plugin Error'],
        message: 'Could not communicate with native MobileFocusLock plugin.',
      };
    }
  },

  async requestUsageAccessPermission(): Promise<{ granted: boolean }> {
    if (!Capacitor.isNativePlatform()) return { granted: false };
    try {
      return await NativePlugin.requestUsageAccessPermission();
    } catch {
      return { granted: false };
    }
  },

  async requestOverlayPermission(): Promise<{ granted: boolean }> {
    if (!Capacitor.isNativePlatform()) return { granted: false };
    try {
      return await NativePlugin.requestOverlayPermission();
    } catch {
      return { granted: false };
    }
  },

  async requestScreenTimeAuthorization(): Promise<{ granted: boolean }> {
    if (!Capacitor.isNativePlatform()) return { granted: false };
    try {
      return await NativePlugin.requestScreenTimeAuthorization();
    } catch {
      return { granted: false };
    }
  },

  async openDigitalWellbeingSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await NativePlugin.openDigitalWellbeingSettings();
    } catch {
      // Fallback
    }
  },

  async getInstalledApps(): Promise<InstalledAppInfo[]> {
    if (!Capacitor.isNativePlatform()) {
      // Fallback mock app list for web preview testing when simulating native UI
      return [
        { packageName: 'com.preppilot.nimcet2027', appName: 'PrepPilot (NIMCET 2027)', isEssential: true, category: 'productivity' },
        { packageName: 'com.google.android.dialer', appName: 'Phone & Emergency Calls', isEssential: true, category: 'communication' },
        { packageName: 'com.google.android.deskclock', appName: 'Clock & Alarms', isEssential: true, category: 'utility' },
        { packageName: 'com.google.android.calculator', appName: 'Calculator', isSystemApp: true, category: 'utility' },
        { packageName: 'com.google.android.keep', appName: 'Google Keep (Notes)', isSystemApp: false, category: 'productivity' },
        { packageName: 'com.android.chrome', appName: 'Google Chrome', isSystemApp: true, category: 'utility' },
        { packageName: 'com.adobe.reader', appName: 'Adobe Acrobat Reader', isSystemApp: false, category: 'productivity' },
        { packageName: 'com.whatsapp', appName: 'WhatsApp', isSystemApp: false, category: 'communication' },
        { packageName: 'com.instagram.android', appName: 'Instagram', isSystemApp: false, category: 'social' },
        { packageName: 'com.google.android.youtube', appName: 'YouTube', isSystemApp: true, category: 'entertainment' },
        { packageName: 'com.reddit.frontpage', appName: 'Reddit', isSystemApp: false, category: 'social' },
        { packageName: 'com.spotify.music', appName: 'Spotify', isSystemApp: false, category: 'entertainment' },
      ];
    }

    try {
      const result = await NativePlugin.getInstalledApps();
      return result.apps || [];
    } catch (e) {
      console.warn('Error fetching installed apps via native plugin:', e);
      return [];
    }
  },

  async startFocusLock(config: FocusLockSessionConfig): Promise<{ success: boolean; message: string }> {
    if (!Capacitor.isNativePlatform()) {
      return {
        success: false,
        message: 'Native companion required to enforce OS-level app restrictions.',
      };
    }
    try {
      return await NativePlugin.startFocusLock(config);
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to start native focus lock.',
      };
    }
  },

  async stopFocusLock(): Promise<{ success: boolean; sessionRecord?: FocusLockSessionRecord }> {
    if (!Capacitor.isNativePlatform()) {
      return { success: true };
    }
    try {
      return await NativePlugin.stopFocusLock();
    } catch {
      return { success: false };
    }
  },

  async getLockStatus(): Promise<FocusLockActiveState> {
    if (!Capacitor.isNativePlatform()) {
      return {
        isActive: false,
        remainingSeconds: 0,
        totalDurationSeconds: 0,
        allowlistedPackages: [],
        allowEarlyExit: true,
        startTime: '',
        endTime: '',
        restrictionsActive: false,
        platform: 'web',
      };
    }
    try {
      return await NativePlugin.getLockStatus();
    } catch {
      return {
        isActive: false,
        remainingSeconds: 0,
        totalDurationSeconds: 0,
        allowlistedPackages: [],
        allowEarlyExit: true,
        startTime: '',
        endTime: '',
        restrictionsActive: false,
        platform: Capacitor.getPlatform() as 'android' | 'ios',
      };
    }
  },

  // Local storage management for allowlisted packages
  getSavedAllowlistedPackages(): string[] {
    try {
      const saved = localStorage.getItem(ALLOWLIST_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    // Default: Study Essentials
    return FOCUS_LOCK_PRESETS[0].recommendedPackages;
  },

  saveAllowlistedPackages(packages: string[]): void {
    try {
      // Ensure PrepPilot and Phone are always in allowlist
      const alwaysAllowed = ['com.preppilot.nimcet2027', 'com.google.android.dialer', 'com.android.phone'];
      const merged = Array.from(new Set([...alwaysAllowed, ...packages]));
      localStorage.setItem(ALLOWLIST_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Ignore
    }
  },

  getSavedPreset(): FocusLockPresetId {
    try {
      const saved = localStorage.getItem(PRESET_STORAGE_KEY) as FocusLockPresetId;
      if (saved && ['study_essentials', 'minimal', 'custom'].includes(saved)) {
        return saved;
      }
    } catch {
      // Ignore
    }
    return 'study_essentials';
  },

  savePreset(presetId: FocusLockPresetId): void {
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, presetId);
    } catch {
      // Ignore
    }
  },
};
