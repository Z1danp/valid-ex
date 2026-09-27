/**
 * GROUND-TRUTH REFERENCE VALUES — @valid-ex/math
 *
 * PROVENANCE (WAJIB dibaca sebelum mengubah angka):
 * Nilai di file ini TIDAK dikarang. Dihasilkan secara independen dari kode TS
 * oleh `generate_reference.py` (Python 3 stdlib):
 *   - `statistics.linear_regression` & `statistics.correlation` untuk slope/intercept/r
 *   - `syx` dihitung manual: sqrt(SSres / (n - 2))
 *   - Dataset bigOffset dihitung eksak memakai aritmetika rasional `fractions.Fraction`
 *     (untuk membuktikan stabilitas numerik rumus terpusat vs rumus naif).
 *
 * Jalankan ulang: `python3 test/fixtures/generate_reference.py`
 */

export interface RegressionFixture {
  points: { x: number; y: number }[];
  expected: {
    n: number;
    slope: number;
    intercept: number;
    r: number;
    rSquared: number;
    syx: number;
    sxx: number;
    xMean: number;
    yMean: number;
    lodInstrument: number;
    loqInstrument: number;
  };
}

export const DATASETS = {
  perfect: {
    points: [
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
      { x: 4, y: 9 },
      { x: 5, y: 11 },
    ],
    expected: {
      n: 5,
      slope: 2,
      intercept: 1,
      r: 1,
      rSquared: 1,
      syx: 0,
      sxx: 10,
      xMean: 3,
      yMean: 7,
      lodInstrument: 0,
      loqInstrument: 0,
    },
  },
  icpms7: {
    points: [
      { x: 0, y: 12.5 },
      { x: 10, y: 238.4 },
      { x: 50, y: 1198.2 },
      { x: 100, y: 2410.7 },
      { x: 300, y: 7195.3 },
      { x: 500, y: 12010.8 },
      { x: 1000, y: 24085.6 },
    ],
    expected: {
      n: 7,
      slope: 24.073816869868125,
      intercept: -4.74015213450366,
      r: 0.9999982969088662,
      rSquared: 0.999996593820633,
      syx: 17.814287125556074,
      sxx: 803800,
      xMean: 280,
      yMean: 6735.928571428572,
      lodInstrument: 2.219957959535686,
      loqInstrument: 7.399859865118954,
    },
  },
  noisy5: {
    points: [
      { x: 1, y: 2.1 },
      { x: 2, y: 3.9 },
      { x: 3, y: 6.2 },
      { x: 4, y: 7.8 },
      { x: 5, y: 10.1 },
    ],
    expected: {
      n: 5,
      slope: 1.9899999999999998,
      intercept: 0.0500000000000016,
      r: 0.9986517555689657,
      rSquared: 0.9973053289009772,
      syx: 0.18885620632287123,
      sxx: 10,
      xMean: 3,
      yMean: 6.02,
      lodInstrument: 0.2847078487279466,
      loqInstrument: 0.9490261624264887,
    },
  },
  // Falsifikasi catastrofic cancellation: x ber-offset 1e9.
  // Rumus naif memberi slope 1.970999755859 (error ~2.4e-7);
  // rumus terpusat memberi nilai eksak 1.971.
  bigOffset: {
    points: [
      { x: 1000000000, y: 2.1 },
      { x: 1000000001, y: 4.05 },
      { x: 1000000002, y: 6.02 },
      { x: 1000000003, y: 7.9 },
      { x: 1000000004, y: 10.03 },
    ],
    expected: {
      n: 5,
      slope: 1.971,
      intercept: -1970999997.9220002,
      r: 0.9998277080115404,
      rSquared: 0.9996554457076101,
      syx: 0.06680820930210722,
      sxx: 10,
      xMean: 1000000002,
      yMean: 6.02,
      lodInstrument: 0.10168677214932605,
      loqInstrument: 0.3389559071644202,
    },
  },
};

/**
 * Unit conversion: toSolidConcentration(solutionConc, params) harus menghasilkan nilai ini.
 * (base mg/kg = C * k_conc * V * k_vol * df / (W * k_weight), lalu dikonversi ke solidResultUnit)
 */
export interface UnitCase {
  name: string;
  solutionConc: number;
  params: {
    volume: number;
    volumeUnit: 'mL' | 'L';
    df: number;
    weight: number;
    weightUnit: 'g' | 'mg';
    solutionConcUnit: 'ppt' | 'ppb' | 'ppm';
    solidResultUnit: 'mg/kg' | 'ug/kg' | 'percent';
  };
  expected: number;
}

export const UNIT_CASES: UnitCase[] = [
  {
    name: 'ppb + mL + g -> mg/kg (harus /1000, BUKAN lupa)',
    solutionConc: 2.5,
    params: {
      volume: 50,
      volumeUnit: 'mL',
      df: 1,
      weight: 0.2,
      weightUnit: 'g',
      solutionConcUnit: 'ppb',
      solidResultUnit: 'mg/kg',
    },
    expected: 0.625,
  },
  {
    name: 'ppm + mL + g -> mg/kg (TANPA /1000)',
    solutionConc: 2.5,
    params: {
      volume: 50,
      volumeUnit: 'mL',
      df: 1,
      weight: 0.2,
      weightUnit: 'g',
      solutionConcUnit: 'ppm',
      solidResultUnit: 'mg/kg',
    },
    expected: 625,
  },
  {
    name: 'ppt + mL + g -> mg/kg',
    solutionConc: 2.5,
    params: {
      volume: 50,
      volumeUnit: 'mL',
      df: 1,
      weight: 0.2,
      weightUnit: 'g',
      solutionConcUnit: 'ppt',
      solidResultUnit: 'mg/kg',
    },
    expected: 0.000625,
  },
  {
    name: 'ppb + mL + g -> ug/kg',
    solutionConc: 2.5,
    params: {
      volume: 50,
      volumeUnit: 'mL',
      df: 1,
      weight: 0.2,
      weightUnit: 'g',
      solutionConcUnit: 'ppb',
      solidResultUnit: 'ug/kg',
    },
    expected: 625,
  },
  {
    name: 'ppb + L + g -> mg/kg',
    solutionConc: 2.5,
    params: {
      volume: 0.05,
      volumeUnit: 'L',
      df: 1,
      weight: 0.2,
      weightUnit: 'g',
      solutionConcUnit: 'ppb',
      solidResultUnit: 'mg/kg',
    },
    expected: 0.625,
  },
  {
    name: 'ppb + mL + mg -> mg/kg',
    solutionConc: 2.5,
    params: {
      volume: 50,
      volumeUnit: 'mL',
      df: 1,
      weight: 200,
      weightUnit: 'mg',
      solutionConcUnit: 'ppb',
      solidResultUnit: 'mg/kg',
    },
    expected: 0.625,
  },
  {
    name: 'ppm + mL + g -> percent',
    solutionConc: 10000,
    params: {
      volume: 50,
      volumeUnit: 'mL',
      df: 1,
      weight: 0.5,
      weightUnit: 'g',
      solutionConcUnit: 'ppm',
      solidResultUnit: 'percent',
    },
    expected: 100,
  },
];

export const QC_CASES = {
  ccv_95_2_of_100: 95.2,
  spike_110_unspiked_50_added_50: 120,
  rpd_10_vs_10_2: 1.9801980198019733,
};
