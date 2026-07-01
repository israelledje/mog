import { api } from './client';
import type { Colis, Groupage, AppNotification } from '../types';
import { parseDeclaredValue } from '../utils/format';

function normalizeColis(data: any): Colis {
  const dims = data?.dimensions;
  return {
    ...data,
    declared_value: parseDeclaredValue(data?.declared_value ?? data?.valeur_declaree),
    currency: data?.currency || 'CNY',
    dimensions:
      dims && typeof dims === 'object'
        ? { l: dims.l ?? 0, w: dims.w ?? 0, h: dims.h ?? 0 }
        : { l: 0, w: 0, h: 0 },
  };
}

export const colisApi = {
  async list(params?: { tracking_number?: string; status?: string; skip?: number; limit?: number }): Promise<Colis[]> {
    const { data } = await api.get('/colis/', { params });
    return data.map(normalizeColis);
  },
  async searchUsers(q: string) {
    const { data } = await api.get('/colis/users/search', { params: { q } });
    return data;
  },
  async get(id: string): Promise<Colis> {
    const { data } = await api.get(`/colis/${id}`);
    return normalizeColis(data);
  },
  async create(payload: Partial<Colis> & any): Promise<Colis> {
    const { data } = await api.post('/colis/', payload);
    return normalizeColis(data);
  },
  async kpi() {
    const { data } = await api.get('/colis/kpi');
    return data as { pending: number; warehouse: number; transit: number; delivered: number };
  },
  async receive(id: string, payload: { weight_real: number; dimensions: any; nature?: string; warehouse_location?: string; status?: 'received' | 'damaged'; entrepot_id?: string }): Promise<void> {
    await api.post(`/colis/${id}/receive`, payload);
  },
  async updateStatus(id: string, status: string, location?: string): Promise<void> {
    await api.patch(`/colis/${id}/status`, { status, location });
  },
  async uploadPhoto(id: string, uri: string): Promise<string> {
    const formData = new FormData();
    // @ts-ignore
    formData.append('file', {
      uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
    const { data } = await api.post(`/colis/${id}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.url;
  },
  async uploadPaymentProof(id: string, uri: string): Promise<string> {
    const formData = new FormData();
    // @ts-ignore
    formData.append('file', {
      uri,
      name: 'proof.jpg',
      type: 'image/jpeg',
    });
    const { data } = await api.post(`/colis/${id}/payment-proof`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.url;
  },
};

export const groupagesApi = {
  async list(): Promise<Groupage[]> {
    const { data } = await api.get('/groupages');
    return data;
  },
  async next(): Promise<{ sea?: Groupage | null; air?: Groupage | null }> {
    const { data } = await api.get('/groupages/next/info');
    return data;
  },
  async getMyPackingLists(): Promise<Groupage[]> {
    const { data } = await api.get('/groupages/my-packing-lists');
    return data;
  },
  async updateStatus(id: string, status: string): Promise<void> {
    await api.patch(`/groupages/${id}/status`, { status });
  },
  async requestCloseOtp(id: string): Promise<{ message: string; channel?: string }> {
    const { data } = await api.post(`/groupages/${id}/close/request-otp`);
    return data;
  },
  async confirmClose(id: string, otpCode: string): Promise<{ message: string }> {
    const { data } = await api.post(`/groupages/${id}/close/confirm`, { otp_code: otpCode });
    return data;
  },
  async addPackage(containerId: string, packageId: string): Promise<void> {
    await api.post(`/groupages/${containerId}/add-package/${packageId}`);
  },
  async getManifest(id: string): Promise<string> {
    const { data } = await api.get(`/groupages/${id}/manifest`);
    return data; // Note: In reality, we would handle PDF blob
  },
};

export const notifsApi = {
  async list(): Promise<AppNotification[]> {
    const { data } = await api.get('/notifications');
    return data;
  },
  async markRead(id: string) {
    await api.post(`/notifications/${id}/read`);
  },
  async markAllRead() {
    await api.post('/notifications/read-all');
  },
};

export const invoicesApi = {
  async list(): Promise<any[]> {
    const { data } = await api.get('/invoices/');
    return data;
  },
};
