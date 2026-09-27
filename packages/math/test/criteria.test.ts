import { describe, expect, it } from 'vitest';
import {
  resolveAnalyteCriteria,
  selectRecoveryBand,
  selectRpdBand,
  validateProfile,
} from '../src/criteria';
import type { QcCriteriaProfile, RecoveryBand } from '../src/types';
import { BANDED_TEST_PROFILE, SOP_QC_PROFILE } from './fixtures/profiles';

/** Deep clone JSON-safe lokal (menghindari ketergantungan @types/node / DOM). */
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('validateProfile', () => {
  it('menerima profil flat SOP (satu catch-all per tipe QC)', () => {
    expect(() => validateProfile(SOP_QC_PROFILE)).not.toThrow();
  });

  it('menerima profil berband dengan catch-all & unit terisi', () => {
    expect(() => validateProfile(BANDED_TEST_PROFILE)).not.toThrow();
  });

  it('menolak band yang tidak diakhiri catch-all (maxConc null)', () => {
    const bad = clone(BANDED_TEST_PROFILE) as QcCriteriaProfile;
    bad.analytes.Al!.ccv.bands = [
      { maxConc: 10, minRecovery: 90, maxRecovery: 110 },
      { maxConc: 100, minRecovery: 90, maxRecovery: 110 },
    ];
    expect(() => validateProfile(bad)).toThrow();
  });

  it('menolak band yang tumpang tindih / tidak kontigu', () => {
    const bad = clone(BANDED_TEST_PROFILE) as QcCriteriaProfile;
    bad.analytes.Al!.ccv.bands = [
      { maxConc: 100, minRecovery: 90, maxRecovery: 110 },
      { maxConc: 50, minRecovery: 90, maxRecovery: 110 },
      { maxConc: null, minRecovery: 90, maxRecovery: 110 },
    ];
    expect(() => validateProfile(bad)).toThrow();
  });

  it('menolak null yang muncul bukan di elemen terakhir', () => {
    const bad = clone(BANDED_TEST_PROFILE) as QcCriteriaProfile;
    bad.analytes.Al!.ccv.bands = [
      { maxConc: null, minRecovery: 90, maxRecovery: 110 },
      { maxConc: 10, minRecovery: 90, maxRecovery: 110 },
    ];
    expect(() => validateProfile(bad)).toThrow();
  });

  it('menolak minRecovery >= maxRecovery', () => {
    const bad = clone(SOP_QC_PROFILE) as QcCriteriaProfile;
    bad.analytes.Al!.ccv.bands = [{ maxConc: null, minRecovery: 110, maxRecovery: 90 }];
    expect(() => validateProfile(bad)).toThrow();
  });

  it('menolak band berbatas finit tanpa solutionConcUnit', () => {
    const bad = clone(BANDED_TEST_PROFILE) as QcCriteriaProfile;
    bad.solutionConcUnit = null;
    expect(() => validateProfile(bad)).toThrow();
  });

  it('menolak analit tanpa band (kosong)', () => {
    const bad = clone(SOP_QC_PROFILE) as QcCriteriaProfile;
    bad.analytes.Al!.spike.bands = [];
    expect(() => validateProfile(bad)).toThrow();
  });
});

describe('resolveAnalyteCriteria', () => {
  it('mengembalikan kriteria analit yang dideklarasikan', () => {
    const c = resolveAnalyteCriteria(SOP_QC_PROFILE, 'Pb');
    expect(c.ccv.bands).toHaveLength(1);
  });

  it('menolak analit yang tidak dideklarasikan (tanpa fallback implisit)', () => {
    expect(() => resolveAnalyteCriteria(SOP_QC_PROFILE, 'Cr')).toThrow();
  });
});

describe('selectRecoveryBand — pemilih band (batas atas eksklusif)', () => {
  const bands: RecoveryBand[] = [
    { maxConc: 10, minRecovery: 85, maxRecovery: 115 },
    { maxConc: 100, minRecovery: 90, maxRecovery: 110 },
    { maxConc: null, minRecovery: 95, maxRecovery: 105 },
  ];

  it('di bawah batas pertama -> band pertama', () => {
    expect(selectRecoveryBand(bands, 5).maxConc).toBe(10);
  });

  it('tepat di batas (10) -> band BERIKUTNYA', () => {
    expect(selectRecoveryBand(bands, 10).maxConc).toBe(100);
  });

  it('tepat di batas (100) -> band catch-all', () => {
    expect(selectRecoveryBand(bands, 100).maxConc).toBeNull();
  });

  it('di atas semua batas -> band catch-all', () => {
    expect(selectRecoveryBand(bands, 9999).maxConc).toBeNull();
  });

  it('band flat tunggal -> selalu band itu', () => {
    const flat: RecoveryBand[] = [{ maxConc: null, minRecovery: 60, maxRecovery: 115 }];
    expect(selectRecoveryBand(flat, -3).minRecovery).toBe(60);
    expect(selectRecoveryBand(flat, 1e9).minRecovery).toBe(60);
  });

  it('menolak array band kosong', () => {
    expect(() => selectRecoveryBand([], 1)).toThrow();
  });
});

describe('selectRpdBand', () => {
  it('memilih band berdasarkan nilai acuan', () => {
    const bands = [
      { maxConc: 10, maxRpd: 30 },
      { maxConc: null, maxRpd: 25 },
    ];
    expect(selectRpdBand(bands, 5).maxRpd).toBe(30);
    expect(selectRpdBand(bands, 10).maxRpd).toBe(25);
  });
});
