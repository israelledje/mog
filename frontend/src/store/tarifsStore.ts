import { create } from 'zustand';
import { tarifsApi, Tarif, CalculationResult } from '../api/tarifs';

interface TarifsState {
  tarifs: Tarif[];
  loading: boolean;
  fetchTarifs: () => Promise<void>;
  simulatePrice: (params: {
    transport_mode: 'air' | 'sea';
    weight_kg?: number;
    volume_cbm?: number;
    category_key?: string;
  }) => Promise<CalculationResult>;
  reset: () => void;
}

export const useTarifsStore = create<TarifsState>((set, get) => ({
  tarifs: [],
  loading: false,
  reset: () => set({ tarifs: [], loading: false }),

  fetchTarifs: async () => {
    set({ loading: true });
    try {
      const data = await tarifsApi.list();
      set({ tarifs: data });
    } finally {
      set({ loading: false });
    }
  },

  simulatePrice: async (params) => {
    return await tarifsApi.calculate(params);
  },
}));
