import { create } from 'zustand';
import { storage } from '../api/storage';
import { captureException } from '../api/monitoring';

interface SyncItem {
  id: string;
  type: 'reception' | 'photo';
  colisId: string;
  data: any;
  timestamp: number;
  attempts?: number;
}

const MAX_ATTEMPTS = 5; // nombre max de tentatives de synchro par élément

interface SyncState {
  queue: SyncItem[];
  flushing: boolean;
  addToQueue: (item: Omit<SyncItem, 'id' | 'timestamp'>) => Promise<void>;
  removeFromQueue: (id: string) => Promise<void>;
  getQueue: () => SyncItem[];
  hydrate: () => Promise<void>;
  /** Rejoue la file d'attente. Renvoie le nombre d'éléments synchronisés avec succès. */
  flush: () => Promise<number>;
  reset: () => void;
}

const persist = (queue: SyncItem[]) =>
  storage.setItem('sync_queue', JSON.stringify(queue)).catch(() => {});

export const useSyncStore = create<SyncState>((set, get) => ({
  queue: [],
  flushing: false,
  reset: () => {
    storage.deleteItem('sync_queue').catch(() => {});
    set({ queue: [], flushing: false });
  },
  addToQueue: async (item) => {
    const newItem: SyncItem = {
      ...item,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
      attempts: 0,
    };
    const newQueue = [...get().queue, newItem];
    set({ queue: newQueue });
    await persist(newQueue);
  },
  removeFromQueue: async (id) => {
    const newQueue = get().queue.filter((i) => i.id !== id);
    set({ queue: newQueue });
    await persist(newQueue);
  },
  getQueue: () => get().queue,
  hydrate: async () => {
    const saved = await storage.getItem('sync_queue');
    if (saved) {
      try {
        set({ queue: JSON.parse(saved) });
      } catch {}
    }
  },
  flush: async () => {
    if (get().flushing) return 0;
    const queue = [...get().queue];
    if (queue.length === 0) return 0;

    set({ flushing: true });
    const { colisApi } = await import('../api/colis');
    let synced = 0;
    const remaining: SyncItem[] = [];

    for (const item of queue) {
      try {
        if (item.type === 'photo') {
          await colisApi.uploadPhoto(item.colisId, item.data.uri);
        } else if (item.type === 'reception') {
          await colisApi.receive(item.colisId, item.data);
        }
        synced += 1;
      } catch (e) {
        const attempts = (item.attempts ?? 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          // Abandon après trop d'échecs : on retire de la file et on remonte l'erreur.
          captureException(e, { syncItem: { type: item.type, colisId: item.colisId, attempts } });
        } else {
          remaining.push({ ...item, attempts });
        }
      }
    }

    set({ queue: remaining, flushing: false });
    await persist(remaining);
    return synced;
  },
}));
