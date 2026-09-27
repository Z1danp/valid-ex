import type { CalibrationInput, CalibrationOutput } from './types';

/**
 * Orkestrator utama (ADR-0003: isomorphic zero-drift).
 *
 * Alur:
 * 1. Validasi profil (validateProfile) & resolve kriteria per analit.
 * 2. Bangun kurva OLS per analit dari standards (x=nominalConc, y=signal).
 *    - assertMinNonZeroLevels (D1).
 *    - Hitung CurveMetrics: slope/intercept/r/rSquared/syx + lod/loq instrumen.
 * 3. Cari blanko metode (sampleType 'blank_method') per analit -> C_blank.
 * 4. Untuk setiap baris sampel x analit:
 *    - cRaw: mode A -> inverseConcentration(signal); mode B -> readings[analyte].
 *    - cNet = cRaw - C_blank.
 *    - classifyZone(cNet, lodInstrument, loqInstrument).
 *    - lodMethod/loqMethod per sampel via toSolidConcentration.
 *    - concSolid hanya bila VALID_QUANTIFICATION.
 *    - reportedValue via formatReportedValue.
 *    - ccvRecovery: untuk 'ccv' -> ccvRecovery(cRaw, expectedConc) (larutan kontrol, tidak dikoreksi blanko).
 *    - spikeRecovery: untuk 'spike' (link parentSampleId) -> spikeRecovery(cNet_spiked, cNet_unspiked, spikeAdded).
 *    - rpd: untuk 'duplicate' (link parentSampleId) -> relativePercentDifference(cNet_pair).
 * 5. Evaluasi QC memakai band terpilih (selectRecoveryBand/selectRpdBand):
 *    - LINEARITY_R  : r < profile.linearity.minR
 *    - CCV_RECOVERY : recovery di luar band[a].minRecovery..maxRecovery
 *    - SPIKE_RECOVERY, DUPLICATE_RPD analog.
 *    - Push QCViolation (dengan profileVersion + appliedCriteria).
 * 6. qcStatus = violations.length ? 'INVALID_QC' : 'PASSED' (soft-flag; TIDAK throw).
 *
 * Analit independen (Invariant D2): hasil tiap analit tidak saling mempengaruhi.
 */
export function evaluateCalibration(input: CalibrationInput): CalibrationOutput {
  throw new Error('Not implemented: evaluateCalibration');
}
