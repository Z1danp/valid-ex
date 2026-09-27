/**
 * @valid-ex/math — Internal Domain Types
 *
 * IMPORTANT (Invariant A2): Tipe di sini adalah milik math engine dan SENGAJA
 * TIDAK mengimpor tipe kontrak OpenAPI. Gateway/client memetakan DTO kontrak
 * -> tipe internal ini. Ini menjaga paket tetap zero-dependency & isomorphic.
 */

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------
export type SolutionConcUnit = 'ppt' | 'ppb' | 'ppm';
export type SolidResultUnit = 'ug/kg' | 'mg/kg' | 'percent';
export type WeightUnit = 'g' | 'mg';
export type VolumeUnit = 'mL' | 'L';
export type SignalUnit = 'cps' | 'intensity' | 'peak_area';

export type InputMode = 'raw_signal' | 'in_vial_concentration';
export type SampleType = 'sample' | 'blank_method' | 'ccv' | 'spike' | 'duplicate';
export type DetectionZone = 'NOT_DETECTED' | 'QUALITATIVE_ONLY' | 'VALID_QUANTIFICATION';
export type QCStatus = 'PASSED' | 'INVALID_QC';
export type QCRule = 'LINEARITY_R' | 'CCV_RECOVERY' | 'SPIKE_RECOVERY' | 'DUPLICATE_RPD';

export interface Units {
  solutionConcUnit: SolutionConcUnit;
  solidResultUnit: SolidResultUnit;
  weightUnit: WeightUnit;
  volumeUnit: VolumeUnit;
  signalUnit: SignalUnit;
}

// ---------------------------------------------------------------------------
// Regression
// ---------------------------------------------------------------------------
export interface Point {
  x: number;
  y: number;
}

export interface Regression {
  /** Jumlah titik yang dipakai. */
  n: number;
  /** Slope m. */
  slope: number;
  /** Intercept c. */
  intercept: number;
  /** Koefisien korelasi Pearson r. */
  r: number;
  /** Koefisien determinasi R^2. */
  rSquared: number;
  /** Standar deviasi residual s_y/x (df = n - 2). */
  syx: number;
  /** Sum of squared deviations of x: sum((x - xMean)^2). */
  sxx: number;
  xMean: number;
  yMean: number;
}

// ---------------------------------------------------------------------------
// QC Criteria Profile (Governed, Versioned, Banded)
// ---------------------------------------------------------------------------
export interface RecoveryBand {
  /** Batas atas band (eksklusif) dalam solutionConcUnit. null = catch-all (tak hingga). */
  maxConc: number | null;
  minRecovery: number;
  maxRecovery: number;
}

export interface RpdBand {
  /** Batas atas band (eksklusif) dalam solutionConcUnit. null = catch-all (tak hingga). */
  maxConc: number | null;
  maxRpd: number;
}

export interface AnalyteCriteria {
  ccv: { bands: RecoveryBand[] };
  spike: { bands: RecoveryBand[] };
  duplicate: { bands: RpdBand[] };
}

export interface QcCriteriaProfile {
  id: string;
  name: string;
  methodRef: string;
  version: number;
  effectiveDate: string;
  /** Satuan batas band. Wajib bila ada band berbatas finit; boleh null bila seluruh profil flat. */
  solutionConcUnit?: SolutionConcUnit | null;
  linearity: { minR: number };
  analytes: Record<string, AnalyteCriteria>;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
export interface StandardReading {
  nominalConc: number;
  /** Respon detektor (c/s). WAJIB di kedua inputMode. */
  signal: number;
}

export interface StandardRow {
  standardName: string;
  readings: Record<string, StandardReading>;
}

export interface SampleRow {
  sampleId: string;
  sampleType: SampleType;
  parentSampleId?: string | null;
  /** Konsentrasi spike yang ditambahkan per analit (solutionConcUnit). */
  spikeAdded?: Record<string, number> | null;
  /** Konsentrasi target teoritis (CCV) per analit (solutionConcUnit). */
  expectedConc?: Record<string, number> | null;
  weight: number;
  volume: number;
  df: number;
  /** Map analit -> signal (mode A) atau konsentrasi in-vial (mode B). */
  readings: Record<string, number>;
}

export interface CalibrationInput {
  title: string;
  instrument: string;
  inputMode: InputMode;
  units: Units;
  analytes: string[];
  standards: StandardRow[];
  samples: SampleRow[];
  qcProfile: QcCriteriaProfile;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
export interface CurveMetrics {
  slope: number;
  intercept: number;
  r: number;
  rSquared: number;
  syx: number;
  lodInstrument: number;
  loqInstrument: number;
}

export interface AppliedCriteria {
  /** Nilai yang dipakai memilih band (CCV=expectedConc, spike=spikeAdded, duplo=mean C_net). */
  testValue: number | null;
  bandMaxConc: number | null;
  min: number | null;
  max: number | null;
}

export interface QCViolation {
  rule: QCRule;
  analyte: string;
  sampleId: string | null;
  expected: string;
  actual: string;
  message: string;
  profileVersion: number;
  appliedCriteria: AppliedCriteria;
}

export interface AnalyteSampleResult {
  cRaw: number;
  cNet: number;
  concSolid: number | null;
  detectionZone: DetectionZone;
  reportedValue: string;
  /** LOD metode PADA SAMPEL INI (solidResultUnit). */
  lodMethod: number;
  /** LOQ metode PADA SAMPEL INI (solidResultUnit). */
  loqMethod: number;
  rpd: number | null;
  spikeRecovery: number | null;
  ccvRecovery: number | null;
}

export interface EvaluatedSampleRow {
  sampleId: string;
  sampleType: SampleType;
  parentSampleId: string | null;
  weight: number;
  volume: number;
  df: number;
  analytes: Record<string, AnalyteSampleResult>;
}

export interface CalibrationOutput {
  qcStatus: QCStatus;
  qcViolations: QCViolation[];
  analytesSummary: Record<string, CurveMetrics>;
  evaluatedSamples: EvaluatedSampleRow[];
}
