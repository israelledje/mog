/**
 * URL de base de l'API.
 * En production derrière Nginx : /api (même origine HTTPS).
 * En dev local : définir NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api dans .env.local
 */
const raw = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/+$/, '');
export const API_BASE_URL = raw || '/api';
export const API = API_BASE_URL;

/** Construit une URL API sans double slash */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
