import { create } from 'zustand';
import { api } from '../api/client';

interface Settings {
  exchange_rate_cny_xaf_under_1m: number;
  exchange_rate_cny_xaf_over_1m: number;
  storage_free_days: number;
  storage_daily_fee: number;
  air_delay_days: number;
  air_express_delay_days: number;
  sea_delay_days: number;
  support_phone: string;
}

interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: false,
  error: null,
  reset: () => set({ settings: null, loading: false, error: null }),
  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      // Create a temporary axios instance or use the global one without auth
      // since /api/settings is public.
      const response = await api.get('/settings');
      set({ settings: response.data, loading: false });
    } catch (error: any) {
      console.error('Failed to fetch settings:', error);
      set({ error: error.message, loading: false });
    }
  },
}));
