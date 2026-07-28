import { api } from './client';

export const paymentsApi = {
  async loyalty() {
    const { data } = await api.get('/payments/loyalty');
    return data as {
      points: number;
      value_xaf: number;
      points_per_cbm: number;
      point_value_xaf: number;
      rule?: string;
    };
  },
  async bankInfo() {
    const { data } = await api.get('/payments/bank-info');
    return data;
  },
  async payMobile(payload: {
    package_id?: string;
    invoice_id?: string;
    amount: number;
    phone: string;
    method: 'om' | 'momo';
    loyalty_points?: number;
  }) {
    const { data } = await api.post('/payments/mobile', payload);
    return data;
  },
  async payBank(payload: {
    package_id?: string;
    invoice_id?: string;
    amount: number;
    reference?: string;
    proof_url?: string;
    loyalty_points?: number;
  }) {
    const { data } = await api.post('/payments/bank', payload);
    return data;
  },
};
