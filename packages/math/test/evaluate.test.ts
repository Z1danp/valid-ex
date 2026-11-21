import { describe, expect, it } from 'vitest';
import { evaluateCalibration } from '../src/evaluate';
import type { CalibrationInput, SampleRow, StandardRow } from '../src/types';
import { SOP_QC_PROFILE } from './fixtures/profiles';

const rel = (a: number, e: number) => (e === 0 ? Math.abs(a) : Math.abs((a - e) / e));

// Kurva sempurna (syx = 0): Al -> signal = 2x + 5 ; Pb -> signal = 10x + 100
const AL = (c: number) => 2 * c + 5;
const PB = (c: number) => 10 * c + 100;
const levels = [0, 10, 50, 100, 300, 500];

function perfectStandards(): StandardRow[] {
  return levels.map((x, i) => {
    const pb = levels[i]!;
    return {
      standardName: x === 0 ? 'Blank' : `Std ${x}`,
      readings: {
        Al: { nominalConc: x, signal: AL(x) },
        Pb: { nominalConc: pb, signal: PB(pb) },
      },
    };
  });
}

function batch(samples: SampleRow[]): CalibrationInput {
  return {
    title: 'E2E Controlled',
    instrument: 'ICP-MS',
    inputMode: 'raw_signal',
    units: {
      solutionConcUnit: 'ppb',
      solidResultUnit: 'mg/kg',
      weightUnit: 'g',
      volumeUnit: 'mL',
      signalUnit: 'cps',
    },
    analytes: ['Al', 'Pb'],
    standards: perfectStandards(),
    samples,
    qcProfile: SOP_QC_PROFILE,
  };
}

const base = { weight: 0.2, volume: 50, df: 1 };
const nullPrep = { weight: null, volume: null, df: null };

describe('evaluateCalibration — skenario terkontrol mode raw_signal', () => {
  const samples: SampleRow[] = [
    // Blanko metode: cRaw Al = 0.5, Pb = 2
    {
      sampleId: 'MB',
      sampleType: 'blank_method',
      ...nullPrep,
      readings: { Al: AL(0.5), Pb: PB(2) },
    },
    // Sampel S1: cRaw Al = 11, Pb = 12
    { sampleId: 'S1', sampleType: 'sample', ...base, readings: { Al: AL(11), Pb: PB(12) } },
    // Sampel S2: cRaw Al = 3 (-> cNet 2.5), Pb = 1 (-> cNet -1 -> ND)
    { sampleId: 'S2', sampleType: 'sample', ...base, readings: { Al: AL(3), Pb: PB(1) } },
    // CCV: Al sengaja 120% (pelanggaran), Pb 100%
    {
      sampleId: 'CCV1',
      sampleType: 'ccv',
      ...nullPrep,
      expectedConc: { Al: 100, Pb: 50 },
      readings: { Al: AL(120), Pb: PB(50) },
    },
    // Spike dari S1: Al 140% (pelanggaran), Pb 100%
    {
      sampleId: 'SP1',
      sampleType: 'spike',
      parentSampleId: 'S1',
      ...base,
      spikeAdded: { Al: 10, Pb: 5 },
      readings: { Al: AL(25), Pb: PB(17) },
    },
    // Duplo dari S1: Al RPD 80% (pelanggaran), Pb ~1%
    {
      sampleId: 'D1',
      sampleType: 'duplicate',
      parentSampleId: 'S1',
      ...base,
      readings: { Al: AL(5), Pb: PB(12.1) },
    },
  ];

  const out = evaluateCalibration(batch(samples));
  const row = (id: string) => out.evaluatedSamples.find((s) => s.sampleId === id)!;

  it('membangun kurva per analit', () => {
    expect(rel(out.analytesSummary.Al!.slope, 2)).toBeLessThan(1e-12);
    expect(rel(out.analytesSummary.Al!.intercept, 5)).toBeLessThan(1e-12);
    expect(rel(out.analytesSummary.Pb!.slope, 10)).toBeLessThan(1e-12);
    expect(rel(out.analytesSummary.Pb!.intercept, 100)).toBeLessThan(1e-12);
    expect(rel(out.analytesSummary.Al!.r, 1)).toBeLessThan(1e-12);
  });

  it('koreksi blanko + kuantifikasi padatan (unit-aware)', () => {
    const s1al = row('S1').analytes.Al!;
    expect(rel(s1al.cRaw, 11)).toBeLessThan(1e-12);
    expect(rel(s1al.cNet, 10.5)).toBeLessThan(1e-12);
    expect(s1al.detectionZone).toBe('VALID_QUANTIFICATION');
    expect(rel(s1al.concSolid!, (10.5 * 50) / (0.2 * 1000))).toBeLessThan(1e-12);
    expect(s1al.reportedValue).toBe('2.625 mg/kg');
  });

  it('zona ND menahan angka negatif', () => {
    const s2pb = row('S2').analytes.Pb!;
    expect(s2pb.cNet).toBeLessThan(0);
    expect(s2pb.detectionZone).toBe('NOT_DETECTED');
    expect(s2pb.concSolid).toBeNull();
    expect(s2pb.reportedValue).toBe('ND');
  });

  it('menghitung CCV, spike, dan RPD', () => {
    expect(rel(row('CCV1').analytes.Al!.ccvRecovery!, 120)).toBeLessThan(1e-9);
    expect(rel(row('SP1').analytes.Al!.spikeRecovery!, 140)).toBeLessThan(1e-9);
    expect(rel(row('D1').analytes.Al!.rpd!, 80)).toBeLessThan(1e-9);
    // Pb semuanya lulus
    expect(rel(row('CCV1').analytes.Pb!.ccvRecovery!, 100)).toBeLessThan(1e-9);
    expect(rel(row('SP1').analytes.Pb!.spikeRecovery!, 100)).toBeLessThan(1e-9);
  });

  it('INDEPENDENSI MULTI-ANALIT (Invariant D2): hanya Al yang melanggar QC', () => {
    const rules = out.qcViolations.map((v) => `${v.rule}:${v.analyte}`).sort();
    expect(rules).toEqual(['CCV_RECOVERY:Al', 'DUPLICATE_RPD:Al', 'SPIKE_RECOVERY:Al']);
    expect(out.qcStatus).toBe('INVALID_QC');
  });

  it('mencatat appliedCriteria + profileVersion (jejak audit)', () => {
    const ccv = out.qcViolations.find((v) => v.rule === 'CCV_RECOVERY')!;
    expect(ccv.profileVersion).toBe(1);
    expect(rel(ccv.appliedCriteria.testValue!, 100)).toBeLessThan(1e-12);
    expect(ccv.appliedCriteria.bandMaxConc).toBeNull();
    expect(ccv.appliedCriteria.min).toBe(90);
    expect(ccv.appliedCriteria.max).toBe(110);
  });

  it('blank_method dan ccv tidak dikonversi ke padatan (weight/volume/df/lodMethod/loqMethod/concSolid = null) dan CCV melaporkan konsentrasi larutan terukur (cRaw)', () => {
    const mb = row('MB');
    expect(mb.weight).toBeNull();
    expect(mb.volume).toBeNull();
    expect(mb.df).toBeNull();
    expect(mb.analytes.Al!.lodMethod).toBeNull();
    expect(mb.analytes.Al!.loqMethod).toBeNull();
    expect(mb.analytes.Al!.concSolid).toBeNull();
    expect(mb.analytes.Al!.reportedValue).toBe('ND');

    const ccv = row('CCV1');
    expect(ccv.weight).toBeNull();
    expect(ccv.volume).toBeNull();
    expect(ccv.df).toBeNull();
    expect(ccv.analytes.Al!.lodMethod).toBeNull();
    expect(ccv.analytes.Al!.loqMethod).toBeNull();
    expect(ccv.analytes.Al!.concSolid).toBeNull();
    expect(ccv.analytes.Al!.reportedValue).toBe('120.000 ppb');
    expect(ccv.analytes.Pb!.reportedValue).toBe('50.000 ppb');
  });
});

describe('evaluateCalibration — mode in_vial_concentration', () => {
  it('readings sampel dipakai langsung (kurva tetap dari signal standar)', () => {
    const samples: SampleRow[] = [
      { sampleId: 'MB', sampleType: 'blank_method', ...nullPrep, readings: { Al: 0.5, Pb: 2 } },
      { sampleId: 'S1', sampleType: 'sample', ...base, readings: { Al: 11, Pb: 12 } },
    ];
    const out = evaluateCalibration({ ...batch(samples), inputMode: 'in_vial_concentration' });
    const s1 = out.evaluatedSamples.find((s) => s.sampleId === 'S1')!;
    expect(rel(s1.analytes.Al!.cRaw, 11)).toBeLessThan(1e-12);
    expect(rel(s1.analytes.Al!.cNet, 10.5)).toBeLessThan(1e-12);
    // kurva tetap terbentuk dari signal standar
    expect(rel(out.analytesSummary.Al!.slope, 2)).toBeLessThan(1e-12);
  });
});

describe('evaluateCalibration — LOD/LOQ metode PER-SAMPEL', () => {
  // Standar memakai dataset icpms7 (syx > 0) agar LOD/LOQ instrumen tidak nol.
  const xs = [0, 10, 50, 100, 300, 500, 1000];
  const ys = [12.5, 238.4, 1198.2, 2410.7, 7195.3, 12010.8, 24085.6];
  const slope = 24.073816869868125;
  const intercept = -4.74015213450366;
  const sig = (c: number) => slope * c + intercept;

  const standards: StandardRow[] = xs.map((x, i) => ({
    standardName: `Std ${x}`,
    readings: { Al: { nominalConc: x, signal: ys[i]! } },
  }));

  const mk = (id: string, w: number): SampleRow => ({
    sampleId: id,
    sampleType: 'sample',
    weight: w,
    volume: 50,
    df: 1,
    readings: { Al: sig(20) },
  });

  const input: CalibrationInput = {
    title: 'LOD per sampel',
    instrument: 'ICP-MS',
    inputMode: 'raw_signal',
    units: {
      solutionConcUnit: 'ppb',
      solidResultUnit: 'mg/kg',
      weightUnit: 'g',
      volumeUnit: 'mL',
      signalUnit: 'cps',
    },
    analytes: ['Al'],
    standards,
    samples: [
      {
        sampleId: 'MB',
        sampleType: 'blank_method',
        ...nullPrep,
        readings: { Al: sig(5) },
      },
      mk('W02', 0.2),
      mk('W05', 0.5),
    ],
    qcProfile: SOP_QC_PROFILE,
  };

  const out = evaluateCalibration(input);
  const row = (id: string) => out.evaluatedSamples.find((s) => s.sampleId === id)!;
  const lodInst = 2.219957959535686; // 3*syx/slope dari acuan icpms7
  const loqInst = 7.399859865118954;

  it('lodMethod/loqMethod berskala 1/berat', () => {
    // ppb -> mg/kg: lodMethod = lodInstrument * V / (W * 1000)
    expect(rel(row('W02').analytes.Al!.lodMethod!, (lodInst * 50) / (0.2 * 1000))).toBeLessThan(
      1e-9,
    );
    expect(rel(row('W05').analytes.Al!.lodMethod!, (lodInst * 50) / (0.5 * 1000))).toBeLessThan(
      1e-9,
    );
    expect(rel(row('W02').analytes.Al!.loqMethod!, (loqInst * 50) / (0.2 * 1000))).toBeLessThan(
      1e-9,
    );
  });
});

describe('evaluateCalibration — validasi & soft-flag', () => {
  it('menolak analit yang tidak ada di profil (tanpa fallback)', () => {
    const standards = perfectStandards().map((s, i) => {
      const c = levels[i]!;
      return { ...s, readings: { ...s.readings, Cr: { nominalConc: c, signal: 3 * c + 1 } } };
    });
    const input: CalibrationInput = {
      ...batch([
        {
          sampleId: 'S',
          sampleType: 'sample',
          ...base,
          readings: { Al: AL(11), Pb: PB(12), Cr: 5 },
        },
      ]),
      analytes: ['Al', 'Pb', 'Cr'],
      standards,
    };
    expect(() => evaluateCalibration(input)).toThrow();
  });

  it('QC gagal TIDAK melempar (soft-flag, ADR-0005)', () => {
    const bad: SampleRow[] = [
      { sampleId: 'MB', sampleType: 'blank_method', ...nullPrep, readings: { Al: 0, Pb: 0 } },
      { sampleId: 'S1', sampleType: 'sample', ...base, readings: { Al: AL(11), Pb: PB(12) } },
      {
        sampleId: 'CCV',
        sampleType: 'ccv',
        ...nullPrep,
        expectedConc: { Al: 100, Pb: 50 },
        readings: { Al: AL(200), Pb: PB(500) }, // jauh di luar batas
      },
    ];
    expect(() => evaluateCalibration(batch(bad))).not.toThrow();
    const out = evaluateCalibration(batch(bad));
    expect(out.qcStatus).toBe('INVALID_QC');
    expect(out.qcViolations.length).toBeGreaterThan(0);
  });

  it('menolak baris matriks padatan (sample, spike, duplicate) jika weight, volume, atau df bernilai null atau <= 0', () => {
    const missingWeight: SampleRow[] = [
      { sampleId: 'MB', sampleType: 'blank_method', ...nullPrep, readings: { Al: 0, Pb: 0 } },
      {
        sampleId: 'S1',
        sampleType: 'sample',
        weight: null,
        volume: 50,
        df: 1,
        readings: { Al: AL(11), Pb: PB(12) },
      },
    ];
    expect(() => evaluateCalibration(batch(missingWeight))).toThrow(/weight|volume|df/i);
  });
});

describe('evaluateCalibration — cross-reference data lab nyata (docs/Olah data ICP-OES.xlsx, Logam Mo)', () => {
  const moStandards: StandardRow[] = [
    { standardName: 'Blank', readings: { Mo: { nominalConc: 0, signal: 33.25 } } },
    { standardName: 'Standar 1', readings: { Mo: { nominalConc: 0.1, signal: 2279.39 } } },
    { standardName: 'Standar 2', readings: { Mo: { nominalConc: 0.3, signal: 5403.57 } } },
    { standardName: 'Standar 3', readings: { Mo: { nominalConc: 0.5, signal: 9132.67 } } },
    { standardName: 'Standar 4', readings: { Mo: { nominalConc: 0.7, signal: 12614.31 } } },
    { standardName: 'Standar 5', readings: { Mo: { nominalConc: 0.8, signal: 13896.79 } } },
    { standardName: 'Standar 6', readings: { Mo: { nominalConc: 1, signal: 17610.61 } } },
  ];

  const moInput: CalibrationInput = {
    title: 'Heavy Metal By ICP-OES (Mo 202.032 nm)',
    instrument: 'ICP-OES',
    inputMode: 'in_vial_concentration',
    units: {
      solutionConcUnit: 'ppm',
      solidResultUnit: 'mg/kg',
      weightUnit: 'g',
      volumeUnit: 'mL',
      signalUnit: 'cps',
    },
    analytes: ['Mo'],
    standards: moStandards,
    samples: [
      {
        sampleId: 'Blank',
        sampleType: 'blank_method',
        weight: null,
        volume: null,
        df: null,
        readings: { Mo: 0 },
      },
      {
        sampleId: 'HKUST-1',
        sampleType: 'sample',
        weight: 0.729,
        volume: 50,
        df: 1,
        readings: { Mo: 0 },
      },
      {
        sampleId: 'PMA (0,041) @HKUST-1',
        sampleType: 'sample',
        weight: 0.1242,
        volume: 50,
        df: 100,
        readings: { Mo: 0.21 },
      },
      {
        sampleId: 'PMA (0,082) @HKUST-1',
        sampleType: 'sample',
        weight: 0.1414,
        volume: 50,
        df: 100,
        readings: { Mo: 0.26 },
      },
      {
        sampleId: 'PMA (0,164) @HKUST-1',
        sampleType: 'sample',
        weight: 0.0955,
        volume: 50,
        df: 100,
        readings: { Mo: 0.25 },
      },
      {
        sampleId: 'PMA (0,246) @HKUST-1',
        sampleType: 'sample',
        weight: 0.0909,
        volume: 50,
        df: 100,
        readings: { Mo: 0.37 },
      },
      {
        sampleId: 'Cek Std',
        sampleType: 'ccv',
        weight: null,
        volume: null,
        df: null,
        expectedConc: { Mo: 0.5 },
        readings: { Mo: 0.5 },
      },
    ],
    qcProfile: {
      id: 'sop-icp-oes-mo',
      name: 'QC CRITERIA CHECK (Olah data ICP-OES.xlsx)',
      methodRef: 'Sheet Mo Rows 20-23',
      version: 1,
      effectiveDate: '2026-01-01',
      solutionConcUnit: 'ppm',
      linearity: { minR: 0.995 },
      analytes: {
        Mo: {
          ccv: { bands: [{ maxConc: null, minRecovery: 90, maxRecovery: 110 }] },
          spike: { bands: [{ maxConc: null, minRecovery: 60, maxRecovery: 115 }] },
          duplicate: { bands: [{ maxConc: null, maxRpd: 20 }] },
        },
      },
    },
  };

  const out = evaluateCalibration(moInput);
  const row = (id: string) => out.evaluatedSamples.find((s) => s.sampleId === id)!;

  it('memenuhi QC criteria check (r >= 0.995, CCV 100%) dan LOD/LOQ selaras dengan Excel analis', () => {
    expect(out.qcStatus).toBe('PASSED');
    expect(out.qcViolations).toEqual([]);

    const moCurve = out.analytesSummary.Mo!;
    expect(moCurve.r).toBeGreaterThanOrEqual(0.995);
    // Excel analis membulatkan trendline ke 17330x + 292.67 (LOD=0.04053, LOQ=0.13510 ppm)
    expect(Math.abs(moCurve.lodInstrument - 0.04053)).toBeLessThan(1e-4);
    expect(Math.abs(moCurve.loqInstrument - 0.1351)).toBeLessThan(1e-4);
  });

  it('menghitung hasil padatan PMA @HKUST-1 cocok persis dengan sheet Mo dan menahan HKUST-1 ke ND', () => {
    expect(row('Blank').analytes.Mo!.reportedValue).toBe('ND');
    expect(row('HKUST-1').analytes.Mo!.detectionZone).toBe('NOT_DETECTED');
    expect(row('HKUST-1').analytes.Mo!.concSolid).toBeNull();
    expect(row('HKUST-1').analytes.Mo!.reportedValue).toBe('ND');

    expect(
      rel(row('PMA (0,041) @HKUST-1').analytes.Mo!.concSolid!, 8454.106280193237),
    ).toBeLessThan(1e-12);
    expect(
      rel(row('PMA (0,082) @HKUST-1').analytes.Mo!.concSolid!, 9193.776520509195),
    ).toBeLessThan(1e-12);
    expect(
      rel(row('PMA (0,164) @HKUST-1').analytes.Mo!.concSolid!, 13089.005235602093),
    ).toBeLessThan(1e-12);
    expect(
      rel(row('PMA (0,246) @HKUST-1').analytes.Mo!.concSolid!, 20352.035203520354),
    ).toBeLessThan(1e-12);

    expect(row('Cek Std').analytes.Mo!.ccvRecovery).toBe(100);
    expect(row('Cek Std').analytes.Mo!.reportedValue).toBe('0.500 ppm');
  });
});
