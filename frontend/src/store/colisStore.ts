import { create } from 'zustand';
import { colisApi, groupagesApi, notifsApi } from '../api/colis';
import { storage } from '../api/storage';
import type { Colis, Groupage, AppNotification } from '../types';

const CACHE_KEY = 'colis_cache_v1'; // cache persistant hors-ligne

interface ColisState {
  colis: Colis[];
  groupages: Groupage[];
  notifications: AppNotification[];
  kpi: { pending: number; warehouse: number; transit: number; delivered: number };
  loading: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
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

/** Sauvegarde le snapshot des données pour un accès hors-ligne. */
const persistCache = (state: Pick<ColisState, 'colis' | 'groupages' | 'notifications' | 'kpi'>) => {
  storage
    .setItem(
      CACHE_KEY,
      JSON.stringify({
        colis: state.colis,
        groupages: state.groupages,
        notifications: state.notifications,
        kpi: state.kpi,
      }),
    )
    .catch(() => {});
};

export const useColisStore = create<ColisState>((set, get) => ({
  colis: [],
  groupages: [],
  notifications: [],
  kpi: { pending: 0, warehouse: 0, transit: 0, delivered: 0 },
  loading: false,
  hydrated: false,
  reset: () => {
    storage.deleteItem(CACHE_KEY).catch(() => {});
    set({ colis: [], groupages: [], notifications: [], kpi: { pending: 0, warehouse: 0, transit: 0, delivered: 0 }, loading: false });
  },
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await storage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        set({
          colis: cached.colis ?? [],
          groupages: cached.groupages ?? [],
          notifications: cached.notifications ?? [],
          kpi: cached.kpi ?? get().kpi,
        });
      }
    } catch {}
    set({ hydrated: true });
  },
  fetchAll: async () => {
    set({ loading: true });
    try {
      const [c, g, n, k] = await Promise.all([
        colisApi.list(),
        groupagesApi.listForUser(),
        notifsApi.list(),
        colisApi.kpi(),
      ]);
      set({ colis: c, groupages: g, notifications: n, kpi: k });
      persistCache({ colis: c, groupages: g, notifications: n, kpi: k });
    } finally {
      set({ loading: false });
    }
  },
  fetchColis: async () => {
    const c = await colisApi.list();
    const k = await colisApi.kpi();
    set({ colis: c, kpi: k });
    const s = get();
    persistCache({ colis: c, groupages: s.groupages, notifications: s.notifications, kpi: k });
  },
  fetchGroupages: async () => {
    const [g, c] = await Promise.all([groupagesApi.listForUser(), colisApi.list()]);
    set({ groupages: g, colis: c });
    const s = get();
    persistCache({ colis: c, groupages: g, notifications: s.notifications, kpi: s.kpi });
  },
  fetchNotifications: async () => {
    const n = await notifsApi.list();
    set({ notifications: n });
    const s = get();
    persistCache({ colis: s.colis, groupages: s.groupages, notifications: n, kpi: s.kpi });
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
