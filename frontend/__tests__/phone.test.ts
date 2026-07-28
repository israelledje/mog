import { buildFullPhone, parsePhone, phonesMatch, normalizePhoneForCompare } from '../src/utils/phone';

describe('phone.buildFullPhone', () => {
  it('concatène indicatif + numéro national en retirant les zéros de tête et non-chiffres', () => {
    expect(buildFullPhone('+237', '0691234567')).toBe('+237691234567');
    expect(buildFullPhone('+33', '06 12 34 56 78')).toBe('+33612345678');
  });
});

describe('phone.parsePhone', () => {
  it('sépare indicatif et numéro national pour un numéro complet', () => {
    const { country, national } = parsePhone('+237691234567');
    expect(country.dial).toBe('+237');
    expect(national).toBe('691234567');
  });

  it('renvoie le pays par défaut pour une entrée vide', () => {
    const { national } = parsePhone('');
    expect(national).toBe('');
  });
});

describe('phone.phonesMatch', () => {
  it('considère équivalents deux formats du même numéro', () => {
    expect(phonesMatch('+237 691 234 567', '237691234567')).toBe(true);
  });

  it('détecte deux numéros différents', () => {
    expect(phonesMatch('+237691234567', '+237690000000')).toBe(false);
  });

  it('gère les valeurs nulles', () => {
    expect(phonesMatch(null, null)).toBe(true);
    expect(phonesMatch('+237691234567', null)).toBe(false);
  });
});

describe('phone.normalizePhoneForCompare', () => {
  it('normalise vers un format canonique', () => {
    expect(normalizePhoneForCompare('+237 691-234-567')).toBe('+237691234567');
  });
});
