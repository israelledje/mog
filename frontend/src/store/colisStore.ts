import { create } from 'zustand';
import { colisApi, groupagesApi, notifsApi } from '../api/colis';
import type { Colis, Groupage, AppNotification } from '../types';

interface ColisState {
  colis: Colis[];
  groupages: Groupage[];
  notifications: AppNotification[];
  kpi: { pending: number; warehouse: number; transit: number; delivered: number };
  loading: boolean;
  fetchAll: () => Promise<void>;
  fetchColis: () => Promise<void>;
  fetchGroupages: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addColis: (c: Colis) => void;
  unreadCount: () => number;
  reset: () => void;
}

export const useColisStore = create<ColisState>((set, get) => ({
  colis: [],
  groupages: [],
  notifications: [],
  kpi: { pending: 0, warehouse: 0, transit: 0, delivered: 0 },
  loading: false,
  reset: () => set({ colis: [], groupages: [], notifications: [], kpi: { pending: 0, warehouse: 0, transit: 0, delivered: 0 }, loading: false }),
  fetchAll: async () => {
    set({ loading: true });
    try {
      const [c, g, n, k] = await Promise.all([
        colisApi.list(),
        groupagesApi.list(),
        notifsApi.list(),
        colisApi.kpi(),
      ]);
      set({ colis: c, groupages: g, notifications: n, kpi: k });
    } finally {
      set({ loading: false });
    }
  },
  fetchColis: async () => {
    const c = await colisApi.list();
    const k = await colisApi.kpi();
    set({ colis: c, kpi: k });
  },
  fetchGroupages: async () => {
    const g = await groupagesApi.list();
    set({ groupages: g });
  },
  fetchNotifications: async () => {
    const n = await notifsApi.list();
    set({ notifications: n });
  },
  markRead: async (id) => {
    await notifsApi.markRead(id);
    set({ notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) });
  },
  markAllRead: async () => {
    await notifsApi.markAllRead();
    set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) });
  },
  addColis: (c) => set({ colis: [c, ...get().colis] }),
  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
