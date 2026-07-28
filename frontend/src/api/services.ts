import { api } from './client';

export type ServiceRequestPayload = {
  service_slug: string;
  service_title: string;
  form_data: Record<string, string>;
  summary: string;
};

export type ServiceRequest = {
  id: string;
  service_slug: string;
  service_title: string;
  form_data: Record<string, string>;
  summary: string;
  status: 'new' | 'contacted' | 'done' | 'cancelled';
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  created_at: string;
  updated_at?: string;
};

export const servicesApi = {
  createRequest: async (payload: ServiceRequestPayload) => {
    const { data } = await api.post('/services/requests', payload);
    return data as ServiceRequest;
  },
  myRequests: async () => {
    const { data } = await api.get('/services/requests/mine');
    return data as ServiceRequest[];
  },
  listForOps: async (status?: string) => {
    const { data } = await api.get('/services/requests', { params: status ? { status } : {} });
    return data as ServiceRequest[];
  },
  updateStatus: async (id: string, status: ServiceRequest['status']) => {
    const { data } = await api.patch(`/services/requests/${id}`, { status });
    return data as ServiceRequest;
  },
};
