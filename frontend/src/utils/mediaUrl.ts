import { BASE } from '../api/client';

/** URL publique d'un fichier stocké en /uploads/... */
export function resolveMediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BASE}${normalized}`;
}

/** URL API de secours pour une photo de colis (vérifie l'association colis ↔ fichier). */
export function packagePhotoUrl(packageId: string, storedPath: string): string {
  if (!packageId || !storedPath) return resolveMediaUrl(storedPath);
  if (storedPath.startsWith('http')) return storedPath;
  const filename = storedPath.replace(/\\/g, '/').split('/').pop() || storedPath;
  return `${BASE}/api/colis/${packageId}/photos/${encodeURIComponent(filename)}`;
}
