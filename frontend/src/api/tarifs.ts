import { api } from './client';

export interface Tarif {
  id: string;
  mode: 'air' | 'sea';
  label: string;
  description: string;
  unit: string;
  price: number;
  category_key: string;
  created_at: string;
  updated_at: string;
}

export interface CalculationResult {
  tarif: Tarif;
  unit_value: number;
  unit_label: string;
  total: number;
}

export const tarifsApi = {
  async list(): Promise<Tarif[]> {
    const { data } = await api.get('/tarifs');
    return data;
  },

  async calculate(params: {
    transport_mode: 'air' | 'sea';
    weight_kg?: number;
    volume_cbm?: number;
    category_key?: string;
  }): Promise<CalculationResult> {
    const { data } = await api.get('/tarifs/calculate', { params });
    return data;
  },
};
