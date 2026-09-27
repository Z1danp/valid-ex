import type { AnalyteCriteria, QcCriteriaProfile } from '../../src/types';

/**
 * PROFIL QC DEFAULT — disalin PERSIS dari SOP lab "QC CRITERIA CHECK":
 *
 *   Calibration Curve                     : r >= 0.995
 *   Calibration Standard Check Recovery   : 100 +/- 10%   (90 - 110%)
 *   Sample & QC Spike Recovery            : 60 - 115%
 *   RPD                                   : <= 25%
 *
 * SOP ini FLAT (satu rentang per aturan), sehingga direpresentasikan sebagai
 * SATU band catch-all (maxConc: null) per tipe QC. Bila kelak lab punya tabel
 * level-dependent (mis. AOAC Table A5), cukup tambahkan band sebelum catch-all.
 */

const flatAnalyte = (): AnalyteCriteria => ({
  ccv: { bands: [{ maxConc: null, minRecovery: 90, maxRecovery: 110 }] },
  spike: { bands: [{ maxConc: null, minRecovery: 60, maxRecovery: 115 }] },
  duplicate: { bands: [{ maxConc: null, maxRpd: 25 }] },
});

export const SOP_QC_PROFILE: QcCriteriaProfile = {
  id: '3f8a1c2e-9b7d-4bad-9bdd-2b0d7b3dcb6d',
  name: 'QC Criteria Check — SOP Lab',
  methodRef: 'Lab SOP "QC CRITERIA CHECK" (rev 1; SOP ID pending)',
  version: 1,
  effectiveDate: '2026-09-27',
  solutionConcUnit: null,
  linearity: { minR: 0.995 },
  analytes: {
    Al: flatAnalyte(),
    Pb: flatAnalyte(),
    Cd: flatAnalyte(),
    As: flatAnalyte(),
    Hg: flatAnalyte(),
  },
};

/** Profil dengan band level-dependent, untuk menguji resolver (bukan SOP asli). */
export const BANDED_TEST_PROFILE: QcCriteriaProfile = {
  id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  name: 'Banded Test Profile (sintetis untuk uji resolver)',
  methodRef: 'TEST-ONLY',
  version: 2,
  effectiveDate: '2026-09-27',
  solutionConcUnit: 'ppb',
  linearity: { minR: 0.995 },
  analytes: {
    Al: {
      ccv: {
        bands: [
          { maxConc: 10, minRecovery: 85, maxRecovery: 115 },
          { maxConc: 100, minRecovery: 90, maxRecovery: 110 },
          { maxConc: null, minRecovery: 95, maxRecovery: 105 },
        ],
      },
      spike: {
        bands: [
          { maxConc: 10, minRecovery: 50, maxRecovery: 150 },
          { maxConc: null, minRecovery: 60, maxRecovery: 115 },
        ],
      },
      duplicate: {
        bands: [
          { maxConc: 10, maxRpd: 30 },
          { maxConc: null, maxRpd: 25 },
        ],
      },
    },
  },
};
