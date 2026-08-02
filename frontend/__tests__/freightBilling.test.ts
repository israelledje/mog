import {
  airBilledKg,
  airBilledKgForPackages,
  airChargeableKgRaw,
  packageCbm,
  distributeBilledKg,
} from '../src/utils/freightBilling';

describe('freightBilling', () => {
  it('ceil air weight to next kg', () => {
    expect(airBilledKg(1.3)).toBe(2);
    expect(airBilledKg(1.5)).toBe(2);
    expect(airBilledKg(2)).toBe(2);
    expect(airBilledKg(0.1)).toBe(1);
    expect(airBilledKg(0)).toBe(0);
  });

  it('uses max of real and volumetric then ceil', () => {
    expect(airBilledKg({ weight_real: 1.2, weight_volumetric: 1.8 })).toBe(2);
    expect(airChargeableKgRaw({ weight_real: 1.2, weight_volumetric: 1.8 })).toBe(1.8);
  });

  it('computes sea CBM from cm dimensions', () => {
    expect(packageCbm({ dimensions: { l: 100, w: 100, h: 100 } })).toBeCloseTo(1, 5);
  });

  it('groups air packages: 1.3 + 0.7 → 2 kg (not 3)', () => {
    const pkgs = [
      { weight_real: 1.3, transport_mode: 'air' },
      { weight_real: 0.7, transport_mode: 'air' },
    ];
    const alone = airBilledKg(pkgs[0]) + airBilledKg(pkgs[1]);
    expect(alone).toBe(3); // ceil(1.3)+ceil(0.7)

    const { rawSum, billedKg } = airBilledKgForPackages(pkgs);
    expect(rawSum).toBeCloseTo(2.0, 5);
    expect(billedKg).toBe(2);

    const shares = distributeBilledKg(pkgs, billedKg);
    expect(shares[0] + shares[1]).toBeCloseTo(2, 5);
  });
});
