/**
 * Règles de facturation fret M.O.G :
 * - Aérien (au kg) : poids facturable = ceil(max(poids réel, volumétrique)) — 1,3 kg → 2 kg
 * - Groupement aérien : ceil(somme) — 1,3 + 0,7 → 2 kg (pas 2+1=3)
 * - Maritime : volume CBM (L×l×H / 1_000_000)
 */

export function packageCbm(pkg: {
  dimensions?: { l?: number; w?: number; h?: number } | null;
  volume_cbm?: number;
  cbm?: number;
} | null | undefined): number {
  const dims = pkg?.dimensions || {};
  const l = Number(dims.l || 0);
  const w = Number(dims.w || 0);
  const h = Number(dims.h || 0);
  if (l > 0 && w > 0 && h > 0) return (l * w * h) / 1_000_000;
  return Number(pkg?.volume_cbm || pkg?.cbm || 0) || 0;
}

/** Poids taxable aérien avant arrondi (réel vs volumétrique). */
export function airChargeableKgRaw(pkg: {
  weight_real?: number;
  weight_kg?: number;
  weight?: number;
  weight_volumetric?: number;
  dimensions?: { l?: number; w?: number; h?: number } | null;
} | null | undefined): number {
  const real = Number(pkg?.weight_real ?? pkg?.weight_kg ?? pkg?.weight ?? 0) || 0;
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

/**
 * Kg facturés aérien pour UN colis : arrondi au kilo supérieur.
 * Ex. 1.3 → 2, 1.5 → 2, 2.0 → 2, 0 → 0
 */
export function airBilledKg(weightOrPkg: number | Record<string, any> | null | undefined): number {
  const raw = typeof weightOrPkg === 'number'
    ? Math.max(0, weightOrPkg)
    : airChargeableKgRaw(weightOrPkg);
  if (raw <= 0) return 0;
  return Math.ceil(raw);
}

/**
 * Kg facturés pour un GROUPE de colis aériens :
 * ceil(somme) — 1.3 + 0.7 → 2 (pas 3).
 */
export function airBilledKgForPackages(pkgs: Array<Record<string, any> | null | undefined>): {
  rawSum: number;
  billedKg: number;
  note: string | null;
} {
  const rawSum = pkgs.reduce((s, p) => s + airChargeableKgRaw(p), 0);
  if (rawSum <= 0) return { rawSum: 0, billedKg: 0, note: null };
  const billedKg = Math.ceil(rawSum);
  const note = billedKg !== rawSum
    ? `${rawSum} kg → ${billedKg} kg facturés (arrondi groupé)`
    : `${billedKg} kg facturés (somme groupée)`;
  return { rawSum, billedKg, note };
}

/** Répartit les kg facturés au prorata du poids taxable. */
export function distributeBilledKg(
  pkgs: Array<Record<string, any>>,
  billedKg: number,
): number[] {
  const raws = pkgs.map((p) => airChargeableKgRaw(p));
  const totalRaw = raws.reduce((a, b) => a + b, 0);
  if (billedKg <= 0 || !pkgs.length) return pkgs.map(() => 0);
  if (totalRaw <= 0) {
    const share = billedKg / pkgs.length;
    return pkgs.map(() => share);
  }
  return raws.map((r) => (r / totalRaw) * billedKg);
}

/**
 * Pour une sélection de colis facturés ensemble :
 * - aérien kg (même category_key) → ceil(somme) réparti
 * - sinon → qty individuelle (ceil par colis / CBM)
 *
 * Retourne Map packageId → qty facturée.
 */
export function billedQuantitiesForInvoice(
  packages: any[],
  selectedIds: string[],
  idOf: (p: any) => string = (p) => String(p?.id || p?._id || ''),
): Map<string, { qty: number; unit: 'kg' | 'cbm'; label: string }> {
  const selected = packages.filter((p) => selectedIds.includes(idOf(p)));
  const result = new Map<string, { qty: number; unit: 'kg' | 'cbm'; label: string }>();

  // Bucket air kg by category_key (+ client_group_id if present for tighter grouping)
  const airBuckets = new Map<string, any[]>();
  const rest: any[] = [];

  for (const p of selected) {
    const mode = String(p?.transport_mode || 'sea').toLowerCase();
    const isAir = mode === 'air' || mode === 'air_express';
    // Les catégories unitaires restent hors regroupement kg
    const unitCats = ['phone_boxed', 'phone_unboxed', 'laptop', 'tablet_adult', 'tablet_child', 'powerbank'];
    const cat = p?.category_key || 'standard';
    if (isAir && !unitCats.includes(cat)) {
      const bucketKey = `${p?.client_group_id || 'invoice'}:${cat}`;
      if (!airBuckets.has(bucketKey)) airBuckets.set(bucketKey, []);
      airBuckets.get(bucketKey)!.push(p);
    } else if (isAir) {
      const kg = airBilledKg(p);
      result.set(idOf(p), { qty: kg, unit: 'kg', label: `${kg} kg` });
    } else {
      rest.push(p);
    }
  }

  for (const [, group] of airBuckets) {
    if (group.length === 1) {
      const p = group[0];
      const kg = airBilledKg(p);
      result.set(idOf(p), { qty: kg, unit: 'kg', label: `${kg} kg` });
      continue;
    }
    const { rawSum, billedKg, note } = airBilledKgForPackages(group);
    const shares = distributeBilledKg(group, billedKg);
    group.forEach((p, i) => {
      result.set(idOf(p), {
        qty: shares[i],
        unit: 'kg',
        label: note || `${shares[i].toFixed(2)} kg`,
      });
    });
    void rawSum;
  }

  for (const p of rest) {
    const cbm = packageCbm(p);
    result.set(idOf(p), { qty: cbm, unit: 'cbm', label: `${cbm.toFixed(3)} CBM` });
  }

  return result;
}

/** Quantité facturable selon le mode (kg ceil / CBM) — colis isolé. */
export function billedQuantity(
  pkg: any,
  opts?: { unitBased?: boolean; quantity?: number },
): { qty: number; unit: 'kg' | 'cbm' | 'unit'; label: string } {
  const mode = String(pkg?.transport_mode || pkg?.mode || 'sea').toLowerCase();
  if (opts?.unitBased) {
    const q = Math.max(1, Number(opts.quantity || 1));
    return { qty: q, unit: 'unit', label: `${q} unité(s)` };
  }
  if (mode === 'air' || mode === 'air_express') {
    const kg = airBilledKg(pkg);
    return { qty: kg, unit: 'kg', label: `${kg} kg facturé(s)` };
  }
  const cbm = packageCbm(pkg);
  return { qty: cbm, unit: 'cbm', label: `${cbm.toFixed(3)} CBM` };
}
