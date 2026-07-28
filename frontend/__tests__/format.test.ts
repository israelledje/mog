import { parseDeclaredValue, formatDeclaredValue } from '../src/utils/format';

describe('format.parseDeclaredValue', () => {
  it('gère les nombres, virgules et espaces', () => {
    expect(parseDeclaredValue(1200)).toBe(1200);
    expect(parseDeclaredValue('1 200,50')).toBe(1200.5);
    expect(parseDeclaredValue('abc')).toBe(0);
    expect(parseDeclaredValue(null)).toBe(0);
    expect(parseDeclaredValue(NaN)).toBe(0);
  });
});

describe('format.formatDeclaredValue', () => {
  it('affiche un tiret pour une valeur nulle ou négative', () => {
    expect(formatDeclaredValue(0)).toBe('—');
    expect(formatDeclaredValue(null)).toBe('—');
  });

  it('affiche la devise par défaut CNY', () => {
    expect(formatDeclaredValue(1500)).toContain('CNY');
  });

  it('respecte la devise fournie', () => {
    expect(formatDeclaredValue(1500, 'USD')).toContain('USD');
  });
});
