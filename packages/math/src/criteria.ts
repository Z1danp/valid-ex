import type { AnalyteCriteria, QcCriteriaProfile, RecoveryBand, RpdBand } from './types';

function validateRecoveryBands(bands: RecoveryBand[], analyte: string, qcType: string): void {
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const isLast = i === bands.length - 1;

    // cek null catch all
    if (band?.maxConc === null && !isLast) {
      throw new Error(`QcType '${qcType}' for analyte '${analyte}' has null maxConc at non-last band (index ${i})`)
    }

    // cek ascending sorting vs bands[i-1]
    if (i > 0 && band?.maxConc !== null && bands[i-1]?.maxConc !== null) {
      if (band?.maxConc! <= bands[i-1]?.maxConc!) {
        throw new Error(`QcType '${qcType}' for analyte '${analyte}' has non-ascending maxConc at index ${i}`)
      }
    }

    // cek minRecovery < maxRecovery
    if (band?.minRecovery! >= band?.maxRecovery!) {
      throw new Error(`QcType '${qcType}' for analyte '${analyte}' has minRecovery >= maxRecovery at index ${i}`)
    }
  }
}

function validateRpdBands(bands: RpdBand[], analyte: string): void {
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const isLast = i === bands.length - 1;

    // cek null catch all
    if (band?.maxConc === null && !isLast) {
      throw new Error(`QcType 'Duplicate' for analyte '${analyte}' has null maxConc at non-last band (index ${i})`)
    }

    // cek ascending sorting vs bands[i-1]
    if (i > 0 && band?.maxConc !== null && bands[i-1]?.maxConc !== null) {
      if (band?.maxConc! <= bands[i-1]?.maxConc!) {
        throw new Error(`QcType 'Duplicate' for analyte '${analyte}' has non-ascending maxConc at index ${i}`)
      }
    }

    // cek maxRpd > 0
    if (band?.maxRpd! <= 0) {
      throw new Error(`QcType 'Duplicate' for analyte '${analyte}' has maxRpd <= 0 at index ${i}`)
    }
  }
}

/**
 * Validasi profil kriteria (dipanggil server-side / saat registrasi):
 * - `linearity.minR` harus > 0 dan <= 1.
 * - Setiap analit harus punya ccv/spike/duplicate dengan bands.length >= 1.
 * - Bands WAJIB:
 *     * terurut menaik berdasarkan maxConc,
 *     * kontigu & non-overlap (maxConc band[i] < maxConc band[i+1]),
 *     * elemen terakhir maxConc === null (catch-all),
 *     * hanya elemen terakhir yang boleh null.
 * - `minRecovery < maxRecovery`; `maxRpd > 0`.
 * - Bila ada band berbatas finit, `solutionConcUnit` wajib terisi.
 * Throw Error dengan pesan deskriptif bila invalid.
 */
export function validateProfile(profile: QcCriteriaProfile): void {
  if (profile.linearity.minR <= 0 || profile.linearity.minR > 1) {
    throw new Error('linearity.minR must be in range (0, 1)')
  }

  for (const [analyte, criteria] of Object.entries(profile.analytes)) {
    const ccvBands = criteria.ccv.bands;
    const spikeBands = criteria.spike.bands;
    const duplicateBands = criteria.duplicate.bands;

    if (ccvBands.length < 1) {
      throw new Error(`Analyte '${analyte}' must have at least one CCV band`)
    }

    if (spikeBands.length < 1) {
      throw new Error(`Analyte '${analyte}' must have at least one spike band`)
    }

    if (duplicateBands.length < 1) {
      throw new Error(`Analyte '${analyte}' must have at least one duplicate band`)
    }

    validateRecoveryBands(ccvBands, analyte, 'CCV');
    validateRecoveryBands(spikeBands, analyte, 'Spike');
    validateRpdBands(duplicateBands, analyte);
  }
}

/**
 * Ambil kriteria untuk satu analit. Throw bila analit tidak dideklarasikan
 * di profil (tidak ada fallback implisit — keputusan ADR-0007).
 */
export function resolveAnalyteCriteria(profile: QcCriteriaProfile, analyte: string): AnalyteCriteria {
  throw new Error('Not implemented: resolveAnalyteCriteria');
}

/**
 * Pilih band recovery untuk sebuah testValue:
 *   - bands terurut menaik; testValue masuk ke band PERTAMA dengan
 *     testValue < maxConc (maxConc eksklusif).
 *   - Band catch-all (maxConc === null) menerima sisanya.
 *   - Nilai negatif / di bawah batas pertama -> band pertama.
 * Guard: bands kosong -> throw; tidak ada catch-all & testValue melebihi
 * semua batas -> throw.
 */
export function selectRecoveryBand(bands: RecoveryBand[], testValue: number): RecoveryBand {
  throw new Error('Not implemented: selectRecoveryBand');
}

/**
 * Sama seperti selectRecoveryBand, untuk band RPD.
 */
export function selectRpdBand(bands: RpdBand[], testValue: number): RpdBand {
  throw new Error('Not implemented: selectRpdBand');
}
