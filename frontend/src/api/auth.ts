import { api, saveTokens, clearTokens } from './client';
import type { User, SupportedLang } from '../types';

export const authApi = {
  async login(email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const { data } = await api.post('/auth/login', { email: cleanEmail, password: cleanPassword });
    await saveTokens(data.access_token || data.access, data.refresh_token || data.refresh);
    return data.user as User;
  },
  async loginWithQR(qrToken: string) {
    const { data } = await api.post('/auth/qr-login', null, { params: { qr_token: qrToken } });
    return data; // Returns { message, email }
  },
  async operatorManualLogin(email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const { data } = await api.post('/auth/operator-manual-login', { email: cleanEmail, password: cleanPassword });
    return data; // Returns { message, email }
  },
  async qrVerify(email: string, otpCode: string) {
    const { data } = await api.post('/auth/qr-verify', { email, otp_code: otpCode });
    await saveTokens(data.access_token || data.access, data.refresh_token || data.refresh);
    return data.user as User;
  },
  async register(payload: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    city: string;
    preferred_language: SupportedLang;
  }) {
    const { data } = await api.post('/auth/register', payload);
    // Note: ensure backend register returns access_token/refresh_token
    await saveTokens(data.access_token || data.access, data.refresh_token || data.refresh);
    return data.user as User;
  },
  async me() {
    const { data } = await api.get('/auth/me');
    return data as User;
  },
  async updateMe(payload: Partial<User>) {
    const { data } = await api.put('/auth/me', payload);
    return data as User;
  },
  async setActiveEntrepot(entrepotId: string) {
    const { data } = await api.put('/auth/me/active-entrepot', { entrepot_id: entrepotId });
    return data as User;
  },
  async uploadAvatar(imageUri: string) {
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image`;

    formData.append('file', {
      uri: imageUri,
      name: filename,
      type,
    } as any);

    const { data } = await api.post('/auth/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data as User;
  },
  async forgotPassword(email: string) {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data as { ok: boolean; dev_code?: string };
  },
  async verifyOtp(email: string, code: string) {
    const { data } = await api.post('/auth/verify-otp', { email, otp_code: code });
    return data;
  },
  async resetPassword(email: string, code: string, new_password: string) {
    const { data } = await api.post('/auth/reset-password', { email, otp_code: code, new_password });
    return data;
  },
  async sendPhoneOtp(phone: string) {
    const { data } = await api.post('/auth/phone/send-otp', { phone });
    return data as { message: string; channel?: 'whatsapp' | 'sms' };
  },
  async verifyPhoneOtp(phone: string, otp_code: string) {
    const { data } = await api.post('/auth/phone/verify-otp', { phone, otp_code });
    return data as User;
  },
  async logout() {
    await clearTokens();
  },
};
