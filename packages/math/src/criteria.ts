import type { AnalyteCriteria, QcCriteriaProfile, RecoveryBand, RpdBand } from './types';

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
  throw new Error('Not implemented: validateProfile');
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
