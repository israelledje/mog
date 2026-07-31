import { api } from './client';

export const growthApi = {
  listPromos() {
    return api.get('/growth/promos').then((r) => r.data);
  },
  createPromo(payload: Record<string, any>) {
    return api.post('/growth/promos', payload).then((r) => r.data);
  },
  updatePromo(id: string, payload: Record<string, any>) {
    return api.patch(`/growth/promos/${id}`, payload).then((r) => r.data);
  },
  validatePromo(code: string, amount_xaf: number, context: 'groupage' | 'marketplace' = 'groupage') {
    return api.post('/growth/promos/validate', { code, amount_xaf, context }).then((r) => r.data);
  },
  listAgents() {
    return api.get('/growth/agents').then((r) => r.data);
  },
  createAgent(payload: Record<string, any>) {
    return api.post('/growth/agents', payload).then((r) => r.data);
  },
  updateAgent(id: string, payload: Record<string, any>) {
    return api.patch(`/growth/agents/${id}`, payload).then((r) => r.data);
  },
  listCommissions() {
    return api.get('/growth/commissions').then((r) => r.data);
  },
  payCommission(id: string) {
    return api.post(`/growth/commissions/${id}/pay`).then((r) => r.data);
  },
  getSettings() {
    return api.get('/growth/settings').then((r) => r.data);
  },
  updateSettings(payload: Record<string, any>) {
    return api.patch('/growth/settings', payload).then((r) => r.data);
  },
  myReferral() {
    return api.get('/growth/referral/me').then((r) => r.data);
  },
  attachReferral(referral_code: string) {
    return api.post('/growth/referral/attach', { referral_code }).then((r) => r.data);
  },
};
