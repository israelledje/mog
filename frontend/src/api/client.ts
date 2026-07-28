import axios from 'axios';
import { router } from 'expo-router';
import { storage } from './storage';

const MAX_NETWORK_RETRIES = 2;
const RETRY_BASE_DELAY = 800; // ms

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Vrai pour les erreurs transitoires (pas de réponse serveur / timeout). */
const isRetriableError = (error: any) =>
  error?.code === 'ECONNABORTED' ||
  error?.message === 'Network Error' ||
  (!error?.response && !!error?.request);

/**
 * Configuration de l'URL de base de l'API.
 * EXPO_PUBLIC_BACKEND_URL est injectée au moment du build EAS via eas.json.
 * Le fallback pointe vers le serveur de production pour éviter
 * que l'app appelle localhost (qui n'existe pas sur un vrai téléphone).
 */
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

if (__DEV__ && !BACKEND_URL) {
  console.warn(
    '[API] ⚠️ EXPO_PUBLIC_BACKEND_URL non définie ! ' +
    'Vérifiez votre fichier .env ou la config env de eas.json. ' +
    'Utilisation du fallback de production.'
  );
}

export const BASE = BACKEND_URL || 'https://mog.dis-network.net';

export const TOKEN_KEY = 'auth_access_token';
export const REFRESH_KEY = 'auth_refresh_token';

/**
 * Instance Axios configurée globalement pour communiquer avec le backend.
 * Un timeout de 20s est défini pour gérer les mauvaises connexions.
 */
export const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 20000,
  headers: {
    'ngrok-skip-browser-warning': 'true'
  }
});

/**
 * Intercepteur de requête : attache automatiquement le Bearer token 
 * à l'en-tête Authorization s'il est présent dans le stockage sécurisé.
 */
api.interceptors.request.use(async (config) => {
  try {
    const token = await storage.getItem(TOKEN_KEY);
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

/**
 * Intercepteur de réponse : gère globalement les erreurs,
 * en particulier les erreurs 401 (Non autorisé) pour tenter un rafraîchissement
 * automatique du token via le refresh_token.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 1) Rafraîchissement automatique du token sur 401
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await storage.getItem(REFRESH_KEY);
        if (!refreshToken) {
          await clearTokens();
          redirectToLogin();
          return Promise.reject(new Error('No refresh token'));
        }

        // Appel direct via axios pour éviter de boucler avec l'intercepteur 'api'
        const res = await axios.post(`${BASE}/api/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newAccessToken = res.data.access_token;
        const newRefreshToken = res.data.refresh_token;

        await saveTokens(newAccessToken, newRefreshToken);

        // Relancer la requête originale avec le nouveau token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Le refresh a échoué (token expiré) : déconnexion + retour au login
        await clearTokens();
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    // 2) Retry automatique sur erreurs réseau transitoires (avec backoff)
    if (originalRequest && isRetriableError(error)) {
      originalRequest._retryCount = originalRequest._retryCount ?? 0;
      if (originalRequest._retryCount < MAX_NETWORK_RETRIES) {
        originalRequest._retryCount += 1;
        await delay(RETRY_BASE_DELAY * originalRequest._retryCount);
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);

/** Redirige vers l'écran de connexion (tolérant si le router n'est pas encore prêt). */
const redirectToLogin = () => {
  try {
    router.replace('/(auth)/login');
  } catch {
    // Router pas encore monté — ignoré.
  }
};

/**
 * Sauvegarde les tokens d'accès et de rafraîchissement dans le stockage sécurisé.
 * @param access Le token d'accès JWT
 * @param refresh Le token de rafraîchissement JWT
 */
export const saveTokens = async (access: string, refresh: string) => {
  await storage.setItem(TOKEN_KEY, access);
  await storage.setItem(REFRESH_KEY, refresh);
};

import { useAuthStore } from '../store/authStore';
import { useColisStore } from '../store/colisStore';
import { useSettingsStore } from '../store/settingsStore';
import { useSyncStore } from '../store/syncStore';
import { useTarifsStore } from '../store/tarifsStore';

/**
 * Supprime les tokens du stockage local (ex: lors d'une déconnexion).
 */
export const clearTokens = async () => {
  await storage.deleteItem(TOKEN_KEY);
  await storage.deleteItem(REFRESH_KEY);

  // Purge complète de l'état en mémoire
  useAuthStore.getState().reset?.();
  useColisStore.getState().reset?.();
  useSettingsStore.getState().reset?.();
  useSyncStore.getState().reset?.();
  useTarifsStore.getState().reset?.();
};

export const getAccessToken = async () => {
  return await storage.getItem(TOKEN_KEY);
};

export const getRefreshToken = async () => {
  return await storage.getItem(REFRESH_KEY);
};

/**
 * Formate les erreurs Axios renvoyées par l'API FastAPI en message lisible.
 * Extrait automatiquement le champ `detail` de la réponse JSON.
 * @param e L'erreur levée (AxiosError ou Error classique)
 * @param fallback Le message par défaut si l'erreur n'est pas formatée
 * @returns Une chaîne de caractères contenant le message d'erreur
 */
export const formatErr = (e: any, fallback = 'errors.server'): string => {
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(' ');
  if (e?.message) return e.message;
  return fallback;
};
