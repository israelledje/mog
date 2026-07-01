export type CountryCode = {
  code: string;
  flag: string;
  dial: string;
  label: string;
};

/** Indicatifs les plus utilisés pour MOG (Cameroun, Chine, diaspora). */
export const COUNTRY_CODES: CountryCode[] = [
  { code: 'CM', flag: '🇨🇲', dial: '+237', label: 'Cameroun' },
  { code: 'CN', flag: '🇨🇳', dial: '+86', label: 'Chine' },
  { code: 'FR', flag: '🇫🇷', dial: '+33', label: 'France' },
  { code: 'US', flag: '🇺🇸', dial: '+1', label: 'États-Unis' },
  { code: 'CA', flag: '🇨🇦', dial: '+1', label: 'Canada' },
  { code: 'GB', flag: '🇬🇧', dial: '+44', label: 'Royaume-Uni' },
  { code: 'BE', flag: '🇧🇪', dial: '+32', label: 'Belgique' },
  { code: 'DE', flag: '🇩🇪', dial: '+49', label: 'Allemagne' },
  { code: 'NG', flag: '🇳🇬', dial: '+234', label: 'Nigeria' },
  { code: 'GA', flag: '🇬🇦', dial: '+241', label: 'Gabon' },
  { code: 'CG', flag: '🇨🇬', dial: '+242', label: 'Congo' },
  { code: 'CI', flag: '🇨🇮', dial: '+225', label: "Côte d'Ivoire" },
  { code: 'SN', flag: '🇸🇳', dial: '+221', label: 'Sénégal' },
  { code: 'CH', flag: '🇨🇭', dial: '+41', label: 'Suisse' },
  { code: 'AE', flag: '🇦🇪', dial: '+971', label: 'Émirats' },
];

export const DEFAULT_DIAL_CODE = '+237';
