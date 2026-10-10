import { useState, useEffect, useRef, useCallback } from 'react';

export interface WakeLockState {
  isSupported: boolean;
  isActive: boolean;
  error: string | null;
  requestWakeLock: () => Promise<boolean>;
  releaseWakeLock: () => Promise<void>;
  toggleWakeLock: () => Promise<boolean>;
}

export function useWakeLock(): WakeLockState {
  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const [isActive, setIsActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sentinel reference
  const wakeLockRef = useRef<any>(null);
  // Track if user explicitly desired wake lock to be on
  const desiredActiveRef = useRef<boolean>(false);

  const releaseWakeLock = useCallback(async () => {
    desiredActiveRef.current = false;
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (err) {
        console.warn('Error releasing wake lock:', err);
      } finally {
        wakeLockRef.current = null;
        setIsActive(false);
      }
    } else {
      setIsActive(false);
    }
  }, []);

  const requestWakeLock = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Screen Wake Lock is not supported on this browser or platform.');
      setIsActive(false);
      return false;
    }

    try {
      desiredActiveRef.current = true;
      setError(null);

      // If already active, return true
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        setIsActive(true);
        return true;
      }

      const sentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      setIsActive(true);

      sentinel.addEventListener('release', () => {
        // Only mark inactive if released
        wakeLockRef.current = null;
        setIsActive(false);
      });

      return true;
    } catch (err: any) {
      console.warn('Screen Wake Lock request failed:', err);
      const message =
        err?.name === 'NotAllowedError'
          ? 'Screen Wake Lock permission was denied or battery saver is active.'
          : err?.message || 'Could not activate Screen Wake Lock.';
      setError(message);
      setIsActive(false);
      wakeLockRef.current = null;
      return false;
    }
  }, [isSupported]);

  const toggleWakeLock = useCallback(async (): Promise<boolean> => {
    if (isActive) {
      await releaseWakeLock();
      return false;
    } else {
      return await requestWakeLock();
    }
  }, [isActive, releaseWakeLock, requestWakeLock]);

  // Handle document visibility change (e.g. switching tabs, locking phone)
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && desiredActiveRef.current) {
        // Re-acquire wake lock if user desired it active
        try {
          if (!wakeLockRef.current || wakeLockRef.current.released) {
            const sentinel = await (navigator as any).wakeLock.request('screen');
            wakeLockRef.current = sentinel;
            setIsActive(true);

            sentinel.addEventListener('release', () => {
              wakeLockRef.current = null;
              setIsActive(false);
            });
          }
        } catch (err) {
          console.warn('Wake lock re-acquisition on visibility change failed:', err);
          setIsActive(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSupported]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isActive,
    error,
    requestWakeLock,
    releaseWakeLock,
    toggleWakeLock,
  };
}
