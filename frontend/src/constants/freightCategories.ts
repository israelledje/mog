import { colors } from './theme';

export type FreightCategory = {
  key: string;
  label: string;
  icon: string;
  desc: string;
  color: string;
};

/** Catégories tarifaires aérien — alignées sur DEFAULT_TARIFS / simulateur */
export const AIR_FREIGHT_CATEGORIES: FreightCategory[] = [
  { key: 'express', label: 'Express', icon: '⚡', desc: '13 500 F/kg · 2–3 j', color: colors.accent },
  { key: 'standard', label: 'Normal', icon: '📦', desc: '9 000 F/kg · 7–14 j', color: colors.primary },
  { key: 'phone_boxed', label: 'Tél. carton', icon: '📱', desc: '10k / 7k dès 10', color: '#F59E0B' },
  { key: 'phone_unboxed', label: 'Tél. s/carton', icon: '📲', desc: '6k / 5k dès 10', color: '#F97316' },
  { key: 'laptop', label: 'Ordinateur', icon: '💻', desc: '30 000 F/u', color: '#6366F1' },
  { key: 'tablet_adult', label: 'Tablette', icon: '📟', desc: '10 000 F/u', color: '#8B5CF6' },
  { key: 'tablet_child', label: 'Tab. enfant', icon: '🎮', desc: '8–9 000 F/u', color: '#A855F7' },
  { key: 'battery', label: 'Batterie', icon: '🔋', desc: '11 000 F/kg', color: '#EF4444' },
  { key: 'powerbank', label: 'Powerbank', icon: '🔌', desc: '5k / 11k', color: '#14B8A6' },
  { key: 'liquid', label: 'Liquide/Poudre', icon: '🧴', desc: '11 000 F/kg', color: '#06B6D4' },
];

/** Catégories tarifaires maritime — alignées sur DEFAULT_TARIFS / simulateur */
export const SEA_FREIGHT_CATEGORIES: FreightCategory[] = [
  { key: 'standard', label: 'Standard', icon: '📦', desc: '355 000 F/CBM', color: '#0EA5E9' },
  { key: 'bales', label: 'Balles', icon: '🧺', desc: '400 000 F/CBM', color: '#0284C7' },
  { key: 'bigball', label: 'Big Ball', icon: '🗜️', desc: '415 000 F/CBM', color: '#0369A1' },
  { key: 'cosmetics', label: 'Cosmétiques', icon: '💄', desc: '360 000 F/CBM', color: '#DB2777' },
  { key: 'medical', label: 'Médical', icon: '🏥', desc: '360 000 F/CBM', color: '#059669' },
  { key: 'chemical', label: 'Industriel', icon: '🏭', desc: '370 000 F/CBM', color: '#64748B' },
  { key: 'building', label: 'Carreaux/Fer', icon: '🏗️', desc: '380 000 F/t', color: colors.accent },
  { key: 'machines', label: 'Machines', icon: '⚙️', desc: '370–400k F/CBM', color: '#B45309' },
  { key: 'supplements', label: 'Bien-être', icon: '💊', desc: '370 000 F/CBM', color: '#7C3AED' },
];

export const UNIT_BASED_AIR_KEYS = [
  'phone_boxed', 'phone_unboxed', 'laptop', 'tablet_adult', 'tablet_child', 'powerbank',
] as const;

export function freightCategoriesForMode(mode: 'air' | 'sea' | string): FreightCategory[] {
  return mode === 'air' ? AIR_FREIGHT_CATEGORIES : SEA_FREIGHT_CATEGORIES;
}

export function defaultFreightCategoryKey(mode: 'air' | 'sea' | string): string {
  return 'standard';
}

export function freightCategoryLabel(mode: string | undefined, key: string | undefined): string {
  if (!key) return '—';
  const list = freightCategoriesForMode(mode === 'air' ? 'air' : 'sea');
  return list.find((c) => c.key === key)?.label || key;
}

export function isUnitBasedAirCategory(key: string): boolean {
  return (UNIT_BASED_AIR_KEYS as readonly string[]).includes(key);
}
