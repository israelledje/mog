import type { Colis, Groupage } from '../types';

/** Statuts conteneur considérés comme une expédition active */
export const ACTIVE_CONTAINER_STATUSES = [
  'open',
  'closed',
  'in_transit',
  'customs',
  'arrived',
  'distributed',
] as const;

/** Statuts colis correspondant à un parcours d'expédition en cours */
export const TRANSIT_COLIS_STATUSES = [
  'grouped',
  'loaded',
  'loading',
  'closed',
  'departed',
  'in_transit',
  'customs',
  'arrived',
  'distributed',
] as const;

export function normalizeGroupage(data: any): Groupage {
  return {
    ...data,
    id: data.id || data._id,
    mode: data.mode || data.transport_mode || 'sea',
    transport_mode: data.transport_mode || data.mode || 'sea',
    origin_port: data.origin_port || data.origin_city || 'Guangzhou',
    destination_port: data.destination_port || data.destination_city,
  };
}

export function getActiveContainers(groupages: Groupage[]) {
  return groupages.filter((g) =>
    ACTIVE_CONTAINER_STATUSES.includes((g.status || '') as (typeof ACTIVE_CONTAINER_STATUSES)[number]),
  );
}

/**
 * Colis à afficher dans « Expéditions actives » :
 * - statut logistique en cours, OU
 * - rattaché à un conteneur actif (ex. B0230 en transit même si le statut colis n'a pas été resynchronisé)
 */
export function getActiveShipments(colis: Colis[], groupages: Groupage[]) {
  const activeContainerIds = new Set(getActiveContainers(groupages).map((g) => g.id));

  return colis.filter((c) => {
    if (['delivered', 'draft', 'damaged'].includes(c.status)) return false;
    if (TRANSIT_COLIS_STATUSES.includes(c.status as (typeof TRANSIT_COLIS_STATUSES)[number])) return true;
    if (c.container_id && activeContainerIds.has(c.container_id)) return true;
    if (c.groupage_id && activeContainerIds.has(c.groupage_id)) return true;
    return false;
  });
}

/** Étapes de progression affichées pour un conteneur / groupage */
export const CONTAINER_PROGRESS_STAGES = [
  'closed',
  'in_transit',
  'customs',
  'arrived',
  'distributed',
] as const;

export function containerProgressIndex(status?: string) {
  const idx = CONTAINER_PROGRESS_STAGES.indexOf((status || '') as (typeof CONTAINER_PROGRESS_STAGES)[number]);
  if (idx >= 0) return idx;
  if (status === 'open') return 0;
  return -1;
}
