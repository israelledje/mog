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
  unit_price?: number;
  total: number;
  raw_weight_kg?: number | null;
  billed_weight_kg?: number | null;
  billing_note?: string | null;
  note?: string;
}

export const tarifsApi = {
  async list(): Promise<Tarif[]> {
    const { data } = await api.get('/tarifs');
    return data;
  },

  async create(payload: {
    mode: string;
    label: string;
    description: string;
    unit: string;
    price: number;
    category_key: string;
    price_bulk?: number;
    bulk_from?: number;
    eta_days?: string;
  }) {
    const { data } = await api.post('/tarifs/', payload);
    return data as Tarif;
  },

  async update(id: string, payload: Partial<{
    price: number;
    label: string;
    description: string;
    price_bulk: number;
    bulk_from: number;
    price_max: number;
    eta_days: string;
  }>) {
    const { data } = await api.patch(`/tarifs/${id}`, payload);
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
