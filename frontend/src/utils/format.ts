/** Parse user/API declared value (handles spaces, commas). */
export function parseDeclaredValue(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (raw == null) return 0;
  const cleaned = String(raw).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Display declared value with currency for package detail screens. */
export function formatDeclaredValue(
  value?: number | string | null,
  currency?: string | null,
): string {
  const num = parseDeclaredValue(value);
  if (num <= 0) return '—';
  const cur = (currency || 'CNY').trim();
  return `${num.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${cur}`;
}
