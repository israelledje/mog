/** Facturation fret — aligné sur frontend/src/utils/freightBilling.ts */

export function packageCbm(pkg: any): number {
  const dims = pkg?.dimensions || {};
  const l = Number(dims.l || 0);
  const w = Number(dims.w || 0);
  const h = Number(dims.h || 0);
  if (l > 0 && w > 0 && h > 0) return (l * w * h) / 1_000_000;
  return Number(pkg?.volume_cbm || pkg?.cbm || 0) || 0;
}

export function airChargeableKgRaw(pkg: any): number {
  const real = Number(pkg?.weight_real || 0) || 0;
  let volumetric = Number(pkg?.weight_volumetric || 0) || 0;
  if (volumetric <= 0) {
    const dims = pkg?.dimensions || {};
    const l = Number(dims.l || 0);
    const w = Number(dims.w || 0);
    const h = Number(dims.h || 0);
    if (l > 0 && w > 0 && h > 0) volumetric = (l * w * h) / 6000;
  }
  return Math.max(real, volumetric, 0);
}

export function airBilledKg(pkg: any): number {
  const raw = airChargeableKgRaw(pkg);
  if (raw <= 0) return 0;
  return Math.ceil(raw);
}

/** ceil(somme) pour un groupe — 1.3+0.7 → 2 */
export function airBilledKgForPackages(pkgs: any[]): { rawSum: number; billedKg: number } {
  const rawSum = pkgs.reduce((s, p) => s + airChargeableKgRaw(p), 0);
  if (rawSum <= 0) return { rawSum: 0, billedKg: 0 };
  return { rawSum, billedKg: Math.ceil(rawSum) };
}

export function distributeBilledKg(pkgs: any[], billedKg: number): number[] {
  const raws = pkgs.map(airChargeableKgRaw);
  const totalRaw = raws.reduce((a, b) => a + b, 0);
  if (billedKg <= 0 || !pkgs.length) return pkgs.map(() => 0);
  if (totalRaw <= 0) return pkgs.map(() => billedKg / pkgs.length);
  return raws.map((r) => (r / totalRaw) * billedKg);
}

const UNIT_CATS = new Set([
  'phone_boxed', 'phone_unboxed', 'laptop', 'tablet_adult', 'tablet_child', 'powerbank',
]);

/**
 * Quantités facturées pour une sélection de facture.
 * Aérien kg même category_key (+ client_group) : ceil(somme) réparti.
 */
export function billedQuantitiesForInvoice(
  packages: any[],
  selectedIds: string[],
  idOf: (p: any) => string,
): Map<string, number> {
  const selected = packages.filter((p) => selectedIds.includes(idOf(p)));
  const result = new Map<string, number>();
  const airBuckets = new Map<string, any[]>();

  for (const p of selected) {
    const mode = String(p?.transport_mode || 'sea').toLowerCase();
    const isAir = mode === 'air' || mode === 'air_express';
    const cat = p?.category_key || 'standard';
    if (isAir && !UNIT_CATS.has(cat)) {
      const key = `${p?.client_group_id || 'invoice'}:${cat}`;
      if (!airBuckets.has(key)) airBuckets.set(key, []);
      airBuckets.get(key)!.push(p);
    } else if (isAir) {
      result.set(idOf(p), airBilledKg(p));
    } else {
      result.set(idOf(p), packageCbm(p));
    }
  }

  for (const [, group] of airBuckets) {
    if (group.length === 1) {
      result.set(idOf(group[0]), airBilledKg(group[0]));
      continue;
    }
    const { billedKg } = airBilledKgForPackages(group);
    const shares = distributeBilledKg(group, billedKg);
    group.forEach((p, i) => result.set(idOf(p), shares[i]));
  }

  return result;
}
