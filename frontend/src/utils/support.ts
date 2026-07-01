const DEFAULT_SUPPORT_PHONE = '237694581150';

/** Chiffres uniquement, pour les liens WhatsApp */
export function getSupportPhoneDigits(settings?: { support_phone?: string } | null): string {
  return (settings?.support_phone || DEFAULT_SUPPORT_PHONE).replace(/\D/g, '');
}

/** Affichage lisible : +237 694 58 11 50 */
export function formatSupportPhoneDisplay(phone: string): string {
  const digits = getSupportPhoneDigits({ support_phone: phone });
  if (digits.startsWith('237') && digits.length >= 12) {
    const local = digits.slice(3);
    return `+237 ${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7)}`.trim();
  }
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export function buildWhatsAppUrl(phoneDigits: string, message: string): string {
  return `whatsapp://send?phone=${phoneDigits}&text=${encodeURIComponent(message)}`;
}
