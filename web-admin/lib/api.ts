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

/** Origine backend (sans /api) pour servir /uploads/... */
export function mediaOrigin(): string {
  return API_BASE_URL.replace(/\/api\/?$/, '') || '';
}

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${mediaOrigin()}${normalized}`;
}
