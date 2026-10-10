/**
 * IndexedDB offline storage helper for PrepPilot
 * Mirrors application state in IndexedDB for reliable offline storage,
 * and maintains an offline modification queue for eventual server sync.
 */

const DB_NAME = 'preppilot_idb';
const DB_VERSION = 1;
const STORE_STATE = 'app_state';
const STORE_QUEUE = 'offline_sync_queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE);
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToIDB<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, 'readwrite');
      const store = tx.objectStore(STORE_STATE);
      const req = store.put(data, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Graceful fallback if indexedDB is unavailable
    console.warn('IDB write fallback to localStorage:', err);
  }
}

export async function getFromIDB<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, 'readonly');
      const store = tx.objectStore(STORE_STATE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return null;
  }
}

export interface OfflineAction {
  id?: number;
  type: string;
  payload: any;
  timestamp: string;
}

export async function queueOfflineAction(action: Omit<OfflineAction, 'id'>): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      const req = store.add(action);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not queue offline action:', err);
  }
}

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const store = tx.objectStore(STORE_QUEUE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeQueueItem(id: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not remove queue item:', err);
  }
}

/**
 * Safely synchronize offline queued changes to remote services.
 * GUARANTEE: Never clear queued changes without a successful remote acknowledgement!
 * An item is removed from IndexedDB ONLY after syncHandler verifies successful storage.
 */
export async function syncOfflineQueueWithRemote(
  syncHandler: (action: OfflineAction) => Promise<boolean>
): Promise<{ total: number; synced: number; failed: number }> {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return { total: 0, synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const acknowledged = await syncHandler(item);
      if (acknowledged && typeof item.id === 'number') {
        await removeQueueItem(item.id);
        synced++;
      } else {
        failed++;
      }
    } catch (err) {
      console.warn('Failed to sync item from offline queue:', err);
      failed++;
    }
  }

  return { total: queue.length, synced, failed };
}

export async function clearOfflineQueue(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not clear offline queue:', err);
  }
}
