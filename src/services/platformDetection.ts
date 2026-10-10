import { Capacitor } from '@capacitor/core';

export type AppEnvironment =
  | 'desktop_web'
  | 'mobile_web'
  | 'installed_pwa'
  | 'native_android'
  | 'native_ios'
  | 'unsupported';

export interface PlatformCapabilities {
  environment: AppEnvironment;
  isNative: boolean;
  platform: 'android' | 'ios' | 'web';
  isMobileDevice: boolean;
  isPWAInstalled: boolean;
  supportsNativeFocusLock: boolean;
  platformLabel: string;
  restrictionsExplanation: string;
}

export function detectPlatformCapabilities(): PlatformCapabilities {
  const isNative = Capacitor.isNativePlatform();
  const rawPlatform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

  // Detect standalone PWA mode
  const isPWAInstalled =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  // Detect mobile device viewport / user agent
  const isTouchDevice =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  
  const userAgent = typeof window !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  const isMobileUA = /android|iphone|ipad|ipod|mobile/.test(userAgent);
  const isMobileDevice = isTouchDevice || isMobileUA;

  let environment: AppEnvironment = 'desktop_web';
  let platformLabel = 'Desktop Web Browser';
  let supportsNativeFocusLock = false;
  let restrictionsExplanation =
    'System-level application allowlisting and blocking requires the native Android or iOS companion app. Web browsers cannot restrict external phone applications.';

  if (isNative) {
    if (rawPlatform === 'android') {
      environment = 'native_android';
      platformLabel = 'Android Native App';
      supportsNativeFocusLock = true;
      restrictionsExplanation =
        'Full native allowlist enforcement supported via Android Usage Stats, Overlay, and Foreground Focus Service.';
    } else if (rawPlatform === 'ios') {
      environment = 'native_ios';
      platformLabel = 'iOS Native App (Screen Time)';
      supportsNativeFocusLock = true;
      restrictionsExplanation =
        'Native app shielding supported via Apple FamilyControls and ManagedSettings Screen Time APIs.';
    }
  } else if (isPWAInstalled && isMobileDevice) {
    environment = 'installed_pwa';
    platformLabel = 'Installed Mobile PWA';
    supportsNativeFocusLock = false;
  } else if (isMobileDevice) {
    environment = 'mobile_web';
    platformLabel = 'Mobile Web Browser';
    supportsNativeFocusLock = false;
  } else {
    environment = 'desktop_web';
    platformLabel = 'Desktop Web Browser';
    supportsNativeFocusLock = false;
  }

  return {
    environment,
    isNative,
    platform: rawPlatform as 'android' | 'ios' | 'web',
    isMobileDevice,
    isPWAInstalled,
    supportsNativeFocusLock,
    platformLabel,
    restrictionsExplanation,
  };
}
