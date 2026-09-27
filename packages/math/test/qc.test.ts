import { describe, expect, it } from 'vitest';
import { ccvRecovery, relativePercentDifference, spikeRecovery } from '../src/qc';
import { QC_CASES } from './fixtures/reference';

const rel = (a: number, e: number) => (e === 0 ? Math.abs(a) : Math.abs((a - e) / e));

describe('ccvRecovery (calibration standard check)', () => {
  it('recovery = measured / expected * 100', () => {
    expect(rel(ccvRecovery(95.2, 100), QC_CASES.ccv_95_2_of_100)).toBeLessThan(1e-12);
    expect(rel(ccvRecovery(120, 100), 120)).toBeLessThan(1e-12);
  });

  it('menolak expected = 0', () => {
    expect(() => ccvRecovery(10, 0)).toThrow();
  });
});

describe('spikeRecovery (matrix spike)', () => {
  it('recovery = (spiked - unspiked) / spikeAdded * 100', () => {
    expect(rel(spikeRecovery(110, 50, 50), QC_CASES.spike_110_unspiked_50_added_50)).toBeLessThan(1e-12);
  });

  it('recovery bisa negatif bila spiked < unspiked', () => {
    expect(spikeRecovery(40, 50, 50)).toBeLessThan(0);
  });

  it('menolak spikeAdded = 0', () => {
    expect(() => spikeRecovery(110, 50, 0)).toThrow();
  });
});

describe('relativePercentDifference', () => {
  it('RPD = |s1 - s2| / mean * 100', () => {
    expect(rel(relativePercentDifference(10, 10.2) as number, QC_CASES.rpd_10_vs_10_2)).toBeLessThan(1e-12);
    expect(relativePercentDifference(10, 10)).toBe(0);
  });

  it('mean <= 0 -> null (BUKAN Infinity/NaN)', () => {
    expect(relativePercentDifference(0, -0.1)).toBeNull();
    expect(relativePercentDifference(-1, -1)).toBeNull();
    expect(relativePercentDifference(0, 0)).toBeNull();
  });
});
