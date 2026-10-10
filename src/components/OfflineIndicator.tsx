import React, { useEffect, useState, useCallback } from 'react';
import { WifiOff, Check, Database, Cloud } from 'lucide-react';
import { isFirebaseConfigured } from '../services/firebase';
import { getOfflineQueue, syncOfflineQueueWithRemote, OfflineAction } from '../services/db';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [justReconnected, setJustReconnected] = useState<boolean>(false);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Check queue length periodically or on connection change
  const refreshQueueCount = useCallback(async () => {
    try {
      const q = await getOfflineQueue();
      setQueueCount(q.length);
    } catch {
      setQueueCount(0);
    }
  }, []);

  useEffect(() => {
    refreshQueueCount();
    const interval = setInterval(refreshQueueCount, 15000);
    return () => clearInterval(interval);
  }, [refreshQueueCount]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setJustReconnected(true);
      // Real remote-sync handler is not configured for arbitrary offline mutations;
      // keep queued operations intact and confirm local device persistence.
      setSyncStatus('Local-First mode active • All progress saved locally on device');

      await refreshQueueCount();
      const timer = setTimeout(() => {
        setJustReconnected(false);
        setSyncStatus(null);
      }, 5000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
      refreshQueueCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshQueueCount]);

  if (isOnline && !justReconnected) return null;

  if (justReconnected) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-emerald-700/95 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md animate-fade-in border border-emerald-500/40">
        <Check className="h-4 w-4 shrink-0 text-emerald-200" />
        <span>
          Back Online &bull;{' '}
          {syncStatus || 'All progress saved locally on this device (Local-First mode)'}
        </span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-slate-900/95 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-md animate-fade-in border border-amber-500/40">
      <WifiOff className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" />
      <span>
        Offline Mode &bull;{' '}
        {queueCount > 0
          ? `${queueCount} unsynced change${queueCount > 1 ? 's' : ''} saved locally on device`
          : 'All progress saved locally on this device'}
      </span>
    </div>
  );
};
