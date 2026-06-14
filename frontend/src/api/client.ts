import axios from 'axios';
import { storage } from './storage';

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

export const BASE = BACKEND_URL || 'http://216.126.224.57';

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
    // Si c'est une 401 et qu'on n'a pas encore réessayé cette requête
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await storage.getItem(REFRESH_KEY);
        if (!refreshToken) {
          await clearTokens();
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
        return axios(originalRequest);
      } catch (refreshError) {
        // Le refresh a échoué (token expiré), on déconnecte l'utilisateur
        await clearTokens();
        // Optionnel : rediriger vers la page de login via un EventEmitter ou en forçant le state
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Sauvegarde les tokens d'accès et de rafraîchissement dans le stockage sécurisé.
 * @param access Le token d'accès JWT
 * @param refresh Le token de rafraîchissement JWT
 */
export const saveTokens = async (access: string, refresh: string) => {
  await storage.setItem(TOKEN_KEY, access);
  await storage.setItem(REFRESH_KEY, refresh);
};

/**
 * Supprime les tokens du stockage local (ex: lors d'une déconnexion).
 */
export const clearTokens = async () => {
  await storage.deleteItem(TOKEN_KEY);
  await storage.deleteItem(REFRESH_KEY);
};

export const getAccessToken = async () => {
  return await storage.getItem(TOKEN_KEY);
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
