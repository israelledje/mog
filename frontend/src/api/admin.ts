import { api } from './client';

export type AdminStats = {
  total_packages: number;
  packages_received: number;
  total_revenue: number;
  total_volume_cbm: number;
  active_clients: number;
  pending_payments: number;
  open_containers: number;
  logistics_split?: { sea: number; air: number; total: number };
  daily_trends?: { date: string; count: number; volume_cbm: number }[];
  packages_this_week?: number;
  packages_week_change_pct?: number | null;
};

export type AdminUser = {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  city?: string;
  role?: string;
  client_code?: string;
  loyalty_points?: number;
  loyalty_total_cbm?: number;
  assigned_entrepot_id?: string;
  created_at?: string;
  [key: string]: any;
};

export const adminApi = {
  stats() {
    return api.get<AdminStats>('/admin/stats').then((r) => r.data);
  },
  team() {
    return api.get<AdminUser[]>('/admin/team').then((r) => r.data);
  },
  customers() {
    return api.get<AdminUser[]>('/admin/customers').then((r) => r.data);
  },
  createUser(payload: Record<string, any>) {
    return api.post('/admin/users', payload).then((r) => r.data);
  },
  updateUser(id: string, payload: Record<string, any>) {
    return api.patch(`/admin/users/${id}`, payload).then((r) => r.data);
  },
};
