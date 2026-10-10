import { useState, useEffect } from 'react';

export type DevicePlatform = 'android' | 'ios' | 'desktop';

export function useDevicePlatform() {
  const [detectedPlatform, setDetectedPlatform] = useState<DevicePlatform>('desktop');
  const [selectedPlatform, setSelectedPlatform] = useState<DevicePlatform>('desktop');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent.toLowerCase();
    let platform: DevicePlatform = 'desktop';

    if (/android/.test(ua)) {
      platform = 'android';
    } else if (/iphone|ipad|ipod/.test(ua)) {
      platform = 'ios';
    } else if (
      // iPadOS 13+ detection
      navigator.maxTouchPoints &&
      navigator.maxTouchPoints > 2 &&
      /macintosh/.test(ua)
    ) {
      platform = 'ios';
    } else {
      platform = 'desktop';
    }

    setDetectedPlatform(platform);
    setSelectedPlatform(platform);
  }, []);

  return {
    detectedPlatform,
    selectedPlatform,
    setSelectedPlatform,
    isMobile: detectedPlatform === 'android' || detectedPlatform === 'ios',
  };
}
