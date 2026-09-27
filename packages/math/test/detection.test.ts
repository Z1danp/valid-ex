import { describe, expect, it } from 'vitest';
import { instrumentDetectionLimits, toSolidConcentration } from '../src/detection';
import { DATASETS, UNIT_CASES } from './fixtures/reference';

const rel = (a: number, e: number) => (e === 0 ? Math.abs(a) : Math.abs((a - e) / e));

describe('instrumentDetectionLimits (Kaiser 3-sigma / Currie 10-sigma)', () => {
  it('lod = 3*syx/slope dan loq = 10*syx/slope (acuan icpms7)', () => {
    const { slope, syx, lodInstrument, loqInstrument } = DATASETS.icpms7.expected;
    const { lod, loq } = instrumentDetectionLimits(slope, syx);
    expect(rel(lod, lodInstrument)).toBeLessThan(1e-12);
    expect(rel(loq, loqInstrument)).toBeLessThan(1e-12);
    // LOQ harus 10/3 kali LOD
    expect(rel(loq / lod, 10 / 3)).toBeLessThan(1e-12);
  });

  it('menerima override konstanta k', () => {
    const { lod, loq } = instrumentDetectionLimits(2, 0.1, { kLod: 3.3, kLoq: 10 });
    expect(rel(lod, (3.3 * 0.1) / 2)).toBeLessThan(1e-12);
    expect(rel(loq, (10 * 0.1) / 2)).toBeLessThan(1e-12);
  });

  it('menolak slope <= 0', () => {
    expect(() => instrumentDetectionLimits(0, 1)).toThrow();
    expect(() => instrumentDetectionLimits(-1, 1)).toThrow();
  });
});

describe('toSolidConcentration — UNIT-AWARE (falsifikasi galat 1000x)', () => {
  it.each(UNIT_CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const actual = toSolidConcentration(c.solutionConc, c.params);
    expect(rel(actual, c.expected)).toBeLessThan(1e-12);
  });

  it('ppb dan ppm berbeda tepat 1000x (bukti /1000 tidak boleh di-hardcode)', () => {
    const base = {
      volume: 50,
      volumeUnit: 'mL' as const,
      df: 1,
      weight: 0.2,
      weightUnit: 'g' as const,
      solidResultUnit: 'mg/kg' as const,
    };
    const ppb = toSolidConcentration(2.5, { ...base, solutionConcUnit: 'ppb' });
    const ppm = toSolidConcentration(2.5, { ...base, solutionConcUnit: 'ppm' });
    expect(rel(ppm / ppb, 1000)).toBeLessThan(1e-12);
  });

  it('dF mengali-linear hasil', () => {
    const p = {
      volume: 50,
      volumeUnit: 'mL' as const,
      weight: 0.2,
      weightUnit: 'g' as const,
      solutionConcUnit: 'ppb' as const,
      solidResultUnit: 'mg/kg' as const,
    };
    const base = toSolidConcentration(2.5, { ...p, df: 1 });
    expect(rel(toSolidConcentration(2.5, { ...p, df: 10 }), base * 10)).toBeLessThan(1e-12);
  });

  it('menolak weight <= 0', () => {
    const p = {
      volume: 50,
      volumeUnit: 'mL' as const,
      df: 1,
      weight: 0,
      weightUnit: 'g' as const,
      solutionConcUnit: 'ppb' as const,
      solidResultUnit: 'mg/kg' as const,
    };
    expect(() => toSolidConcentration(2.5, p)).toThrow();
  });
});
