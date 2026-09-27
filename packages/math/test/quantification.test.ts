import { describe, expect, it } from 'vitest';
import { classifyZone, formatReportedValue, inverseConcentration } from '../src/quantification';

const rel = (a: number, e: number) => (e === 0 ? Math.abs(a) : Math.abs((a - e) / e));

describe('inverseConcentration', () => {
  it('c = (signal - intercept) / slope', () => {
    const slope = 24.073816869868125;
    const intercept = -4.74015213450366;
    // Titik yang tepat berada di garis -> harus kembali ke x = 1000
    const c = inverseConcentration(slope * 1000 + intercept, slope, intercept);
    expect(rel(c, 1000)).toBeLessThan(1e-9);
  });

  it('menolak slope <= 0', () => {
    expect(() => inverseConcentration(100, 0, 1)).toThrow();
  });
});

describe('classifyZone (Invariant D3) — batas inklusif', () => {
  const lod = 2.2;
  const loq = 7.4;

  it('cNet <= 0 -> NOT_DETECTED', () => {
    expect(classifyZone(0, lod, loq)).toBe('NOT_DETECTED');
    expect(classifyZone(-0.5, lod, loq)).toBe('NOT_DETECTED');
  });

  it('0 < cNet < lod -> NOT_DETECTED', () => {
    expect(classifyZone(2.199, lod, loq)).toBe('NOT_DETECTED');
  });

  it('cNet == lod -> QUALITATIVE_ONLY (LOD inklusif)', () => {
    expect(classifyZone(2.2, lod, loq)).toBe('QUALITATIVE_ONLY');
  });

  it('lod < cNet < loq -> QUALITATIVE_ONLY', () => {
    expect(classifyZone(5, lod, loq)).toBe('QUALITATIVE_ONLY');
    expect(classifyZone(7.399, lod, loq)).toBe('QUALITATIVE_ONLY');
  });

  it('cNet >= loq -> VALID_QUANTIFICATION (LOQ inklusif)', () => {
    expect(classifyZone(7.4, lod, loq)).toBe('VALID_QUANTIFICATION');
    expect(classifyZone(100, lod, loq)).toBe('VALID_QUANTIFICATION');
  });
});

describe('formatReportedValue (presentation layer, Invariant D5)', () => {
  it('NOT_DETECTED -> "ND"', () => {
    expect(
      formatReportedValue({
        zone: 'NOT_DETECTED',
        concSolid: null,
        loqMethod: 0.375,
        solidResultUnit: 'mg/kg',
      }),
    ).toBe('ND');
  });

  it('QUALITATIVE_ONLY -> "< {loqMethod} {unit}"', () => {
    expect(
      formatReportedValue({
        zone: 'QUALITATIVE_ONLY',
        concSolid: null,
        loqMethod: 0.375,
        solidResultUnit: 'mg/kg',
      }),
    ).toBe('< 0.375 mg/kg');
  });

  it('VALID_QUANTIFICATION -> "{concSolid} {unit}" dengan desimal default 3', () => {
    expect(
      formatReportedValue({
        zone: 'VALID_QUANTIFICATION',
        concSolid: 2.625,
        loqMethod: 0.375,
        solidResultUnit: 'mg/kg',
      }),
    ).toBe('2.625 mg/kg');
  });

  it('menghormati override desimal', () => {
    expect(
      formatReportedValue({
        zone: 'VALID_QUANTIFICATION',
        concSolid: 2.625,
        loqMethod: 0.375,
        solidResultUnit: 'mg/kg',
        decimals: 2,
      }),
    ).toBe('2.63 mg/kg');
  });
});
