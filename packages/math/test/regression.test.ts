import { describe, expect, it } from 'vitest';
import { assertMinNonZeroLevels, linearRegression, pearsonR } from '../src/regression';
import { DATASETS } from './fixtures/reference';

const abs = (a: number, e: number) => Math.abs(a - e);
const rel = (a: number, e: number) => (e === 0 ? Math.abs(a) : Math.abs((a - e) / e));

describe('linearRegression — nilai acuan independen (Python statistics)', () => {
  it('perfect: garis eksak y = 2x + 1', () => {
    const { points, expected } = DATASETS.perfect;
    const r = linearRegression(points);
    expect(r.n).toBe(expected.n);
    expect(abs(r.slope, expected.slope)).toBeLessThan(1e-12);
    expect(abs(r.intercept, expected.intercept)).toBeLessThan(1e-12);
    expect(abs(r.r, expected.r)).toBeLessThan(1e-12);
    expect(abs(r.syx, expected.syx)).toBeLessThan(1e-12); // syx = 0
    expect(abs(r.sxx, expected.sxx)).toBeLessThan(1e-12);
    expect(abs(r.xMean, expected.xMean)).toBeLessThan(1e-12);
    expect(abs(r.yMean, expected.yMean)).toBeLessThan(1e-12);
  });

  it('icpms7: kurva ICP-MS realistis (7 titik)', () => {
    const { points, expected } = DATASETS.icpms7;
    const r = linearRegression(points);
    expect(rel(r.slope, expected.slope)).toBeLessThan(1e-12);
    expect(rel(r.intercept, expected.intercept)).toBeLessThan(1e-9);
    expect(rel(r.r, expected.r)).toBeLessThan(1e-12);
    expect(rel(r.rSquared, expected.rSquared)).toBeLessThan(1e-12);
    expect(rel(r.syx, expected.syx)).toBeLessThan(1e-9);
    expect(abs(r.sxx, expected.sxx)).toBeLessThan(1e-6);
    expect(abs(r.xMean, expected.xMean)).toBeLessThan(1e-12);
    // LOD/LOQ instrumen = 3*syx/slope dan 10*syx/slope
    expect(rel(instrument(r), expected.lodInstrument)).toBeLessThan(1e-9);
  });

  it('noisy5: residual tidak nol', () => {
    const { points, expected } = DATASETS.noisy5;
    const r = linearRegression(points);
    expect(rel(r.slope, expected.slope)).toBeLessThan(1e-12);
    expect(abs(r.intercept, expected.intercept)).toBeLessThan(1e-12);
    expect(rel(r.r, expected.r)).toBeLessThan(1e-12);
    expect(rel(r.syx, expected.syx)).toBeLessThan(1e-9);
    expect(r.syx).toBeGreaterThan(0);
  });
});

describe('linearRegression — FALSIFIKASI catastrophic cancellation (Layer -1)', () => {
  it('x ber-offset 1e9 harus tetap eksak (rumus naif gagal ~2.4e-7)', () => {
    const { points, expected } = DATASETS.bigOffset;
    const r = linearRegression(points);
    // Nilai eksak = 1.971. Rumus naif -> 1.970999755859 (error ~2.4e-7).
    expect(abs(r.slope, expected.slope)).toBeLessThan(1e-9);
    expect(rel(r.intercept, expected.intercept)).toBeLessThan(1e-9);
    expect(rel(r.r, expected.r)).toBeLessThan(1e-9);
  });
});

describe('linearRegression — guards', () => {
  it('menolak n < 3 (df = n - 2 harus >= 1)', () => {
    expect(() => linearRegression([{ x: 1, y: 2 }])).toThrow();
    expect(() =>
      linearRegression([
        { x: 1, y: 2 },
        { x: 2, y: 3 },
      ]),
    ).toThrow();
  });

  it('menolak semua x identik (sxx = 0)', () => {
    expect(() =>
      linearRegression([
        { x: 5, y: 1 },
        { x: 5, y: 2 },
        { x: 5, y: 3 },
      ]),
    ).toThrow();
  });
});

describe('pearsonR', () => {
  it('sama dengan r dari linearRegression', () => {
    const { points, expected } = DATASETS.noisy5;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    expect(rel(pearsonR(xs, ys), expected.r)).toBeLessThan(1e-12);
  });

  it('menolak panjang array berbeda', () => {
    expect(() => pearsonR([1, 2, 3], [1, 2])).toThrow();
  });
});

describe('assertMinNonZeroLevels (Invariant D1)', () => {
  const pts = (n: number) => Array.from({ length: n + 1 }, (_, i) => ({ x: i, y: 2 * i + 1 }));

  it('lulus dengan 5 level non-zero + blank', () => {
    expect(() => assertMinNonZeroLevels(pts(5))).not.toThrow();
  });

  it('gagal dengan 4 level non-zero (default minimal 5)', () => {
    expect(() => assertMinNonZeroLevels(pts(4))).toThrow();
  });

  it('screening kualitatif boleh 3 level via parameter', () => {
    expect(() => assertMinNonZeroLevels(pts(3), 3)).not.toThrow();
    expect(() => assertMinNonZeroLevels(pts(2), 3)).toThrow();
  });
});

/** Helper: LOD instrumen dari regression object. */
function instrument(r: { slope: number; syx: number }): number {
  return (3 * r.syx) / r.slope;
}
