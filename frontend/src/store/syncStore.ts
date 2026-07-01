import { create } from 'zustand';
import { storage } from '../api/storage';

interface SyncItem {
  id: string;
  type: 'reception' | 'photo';
  colisId: string;
  data: any;
  timestamp: number;
}

interface SyncState {
  queue: SyncItem[];
  addToQueue: (item: Omit<SyncItem, 'id' | 'timestamp'>) => Promise<void>;
  removeFromQueue: (id: string) => Promise<void>;
  getQueue: () => SyncItem[];
  hydrate: () => Promise<void>;
  reset: () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  queue: [],
  reset: () => set({ queue: [] }),
  addToQueue: async (item) => {
    const newItem: SyncItem = {
      ...item,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
    };
    const newQueue = [...get().queue, newItem];
    set({ queue: newQueue });
    await storage.setItem('sync_queue', JSON.stringify(newQueue));
  },
  removeFromQueue: async (id) => {
    const newQueue = get().queue.filter((i) => i.id !== id);
    set({ queue: newQueue });
    await storage.setItem('sync_queue', JSON.stringify(newQueue));
  },
  getQueue: () => get().queue,
  hydrate: async () => {
    const saved = await storage.getItem('sync_queue');
    if (saved) {
      set({ queue: JSON.parse(saved) });
    }
  },
}));
