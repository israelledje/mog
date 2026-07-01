import { create } from 'zustand';
import { authApi } from '../api/auth';
import { clearTokens, getAccessToken } from '../api/client';
import type { User, SupportedLang } from '../types';

interface AuthState {
  user: User | null;
  ready: boolean;
  loading: boolean;
  lastPassword: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  loginWithQR: (token: string) => Promise<{ email: string }>;
  loginManualOTP: (email: string, password: string) => Promise<{ email: string }>;
  confirmQRLogin: (email: string, otp: string) => Promise<User>;
  register: (payload: any) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  updateProfile: (p: Partial<User>) => Promise<User>;
  uploadAvatar: (imageUri: string) => Promise<User>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  lastPassword: null,
  ready: false,
  loading: false,
  reset: () => set({ user: null, lastPassword: null, ready: false, loading: false }),
  bootstrap: async () => {
    try {
      const tk = await getAccessToken();
      if (!tk) {
        set({ ready: true });
        return;
      }
      const me = await authApi.me();
      set({ user: me, ready: true });
    } catch {
      await clearTokens();
      set({ user: null, ready: true });
    }
  },
  login: async (email, password) => {
    set({ loading: true });
    try {
      const u = await authApi.login(email, password);
      set({ user: u, lastPassword: password });
      // Register push token (non-blocking, native only)
      import('../api/push').then(({ registerForPushNotifications }) => {
        registerForPushNotifications().catch(() => {});
      });
      return u;
    } finally {
      set({ loading: false });
    }
  },
  loginWithQR: async (token) => {
    set({ loading: true });
    try {
      return await authApi.loginWithQR(token);
    } finally {
      set({ loading: false });
    }
  },
  loginManualOTP: async (email, password) => {
    set({ loading: true });
    try {
      return await authApi.operatorManualLogin(email, password);
    } finally {
      set({ loading: false });
    }
  },
  confirmQRLogin: async (email, otp) => {
    set({ loading: true });
    try {
      const u = await authApi.qrVerify(email, otp);
      set({ user: u });
      return u;
    } finally {
      set({ loading: false });
    }
  },
  register: async (payload) => {
    set({ loading: true });
    try {
      const u = await authApi.register(payload);
      set({ user: u, lastPassword: payload.password });
      import('../api/push').then(({ registerForPushNotifications }) => {
        registerForPushNotifications().catch(() => {});
      });
      return u;
    } finally {
      set({ loading: false });
    }
  },
  logout: async () => {
    await authApi.logout();
    set({ user: null, lastPassword: null });
  },
  setUser: (u) => set({ user: u }),
  updateProfile: async (p) => {
    const u = await authApi.updateMe(p);
    set({ user: u });
    return u;
  },
  uploadAvatar: async (imageUri: string) => {
    const u = await authApi.uploadAvatar(imageUri);
    set({ user: u });
    return u;
  },
}));
