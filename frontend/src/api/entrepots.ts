import { api } from './client';

export interface Entrepot {
  id: string;
  _id?: string;
  name: string;
  city: string;
  country: string;
  type: 'origin' | 'destination';
  address?: string;
  contact?: string;
}

export const entrepotsApi = {
  async list(): Promise<Entrepot[]> {
    const { data } = await api.get('/entrepots/');
    return data;
  },
  async receivePackage(packageId: string, entrepotId: string, notes?: string) {
    const { data } = await api.post(`/entrepots/receive-package/${packageId}`, {
      entrepot_id: entrepotId,
      notes,
    });
    return data;
  },
  async transferPackage(packageId: string, toEntrepotId: string, notes?: string) {
    const { data } = await api.post(`/entrepots/transfer-package/${packageId}`, {
      to_entrepot_id: toEntrepotId,
      notes,
    });
    return data;
  },
  async getHistory(packageId: string) {
    const { data } = await api.get(`/entrepots/package/${packageId}/history`);
    return data;
  },
};
