import { COUNTRY_CODES, DEFAULT_DIAL_CODE, type CountryCode } from '../constants/countryCodes';

export function parsePhone(phone?: string | null): { country: CountryCode; national: string } {
  const fallback = COUNTRY_CODES.find((c) => c.dial === DEFAULT_DIAL_CODE) || COUNTRY_CODES[0];
  if (!phone?.trim()) {
    return { country: fallback, national: '' };
  }

  const cleaned = phone.replace(/[\s\-()]/g, '');
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);

  for (const country of sorted) {
    const dialDigits = country.dial.replace('+', '');
    if (cleaned.startsWith(country.dial) || cleaned.startsWith(dialDigits)) {
      const national = cleaned.startsWith('+')
        ? cleaned.slice(country.dial.length)
        : cleaned.slice(dialDigits.length);
      return { country, national: national.replace(/^0+/, '') };
    }
  }

  if (cleaned.startsWith('+')) {
    const match = cleaned.match(/^(\+\d{1,4})(\d*)$/);
    if (match) {
      const dial = match[1];
      const found = COUNTRY_CODES.find((c) => c.dial === dial);
      return {
        country: found || { code: 'XX', flag: '🌍', dial, label: dial },
        national: match[2].replace(/^0+/, ''),
      };
    }
  }

  return { country: fallback, national: cleaned.replace(/^0+/, '') };
}

export function buildFullPhone(dial: string, national: string): string {
  const digits = national.replace(/\D/g, '').replace(/^0+/, '');
  return `${dial}${digits}`;
}

export function phonesMatch(a?: string | null, b?: string | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const fullA = normalizePhoneForCompare(a);
  const fullB = normalizePhoneForCompare(b);
  return fullA === fullB;
}

export function normalizePhoneForCompare(phone: string): string {
  const { country, national } = parsePhone(phone);
  return buildFullPhone(country.dial, national);
}
