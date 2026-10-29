import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { auditLogs, type Database } from '@valid-ex/db';
import { createApp } from '../src/app';
import { createTestDb } from './helpers/test-db';

const TEST_JWT_SECRET = 'test-super-secret-jwt-key-for-vitest';

function extractCookiePair(setCookieHeader: string | null): string {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(';')[0] ?? '';
}

const VALID_QC_PROFILE_INPUT = {
  name: 'SOP Lab ICP-MS Logam Berat',
  methodRef: 'SOP-LAB-01 Rev.1 (EURACHEM)',
  effectiveDate: '2026-10-01',
  solutionConcUnit: 'ppb',
  linearity: { minR: 0.995 },
  analytes: {
    Pb: {
      ccv: { bands: [{ maxConc: null, minRecovery: 90, maxRecovery: 110 }] },
      spike: { bands: [{ maxConc: null, minRecovery: 60, maxRecovery: 115 }] },
      duplicate: { bands: [{ maxConc: null, maxRpd: 25 }] },
    },
    Cd: {
      ccv: { bands: [{ maxConc: null, minRecovery: 90, maxRecovery: 110 }] },
      spike: { bands: [{ maxConc: null, minRecovery: 60, maxRecovery: 115 }] },
      duplicate: { bands: [{ maxConc: null, maxRpd: 25 }] },
    },
  },
};

function buildCalibrationPayload(qcProfileId: string) {
  return {
    title: 'Batch Uji Biskuit Gandum ICP-MS',
    instrument: 'ICP-MS',
    inputMode: 'in_vial_concentration',
    units: {
      solutionConcUnit: 'ppb',
      solidResultUnit: 'mg/kg',
      weightUnit: 'g',
      volumeUnit: 'mL',
      signalUnit: 'cps',
    },
    qcProfileId,
    analytes: ['Pb', 'Cd'],
    standards: [
      {
        standardName: 'Blank',
        readings: {
          Pb: { nominalConc: 0, signal: 10 },
          Cd: { nominalConc: 0, signal: 5 },
        },
      },
      {
        standardName: 'Std 1',
        readings: {
          Pb: { nominalConc: 1, signal: 1010 },
          Cd: { nominalConc: 0.5, signal: 505 },
        },
      },
      {
        standardName: 'Std 2',
        readings: {
          Pb: { nominalConc: 2, signal: 2010 },
          Cd: { nominalConc: 1.0, signal: 1005 },
        },
      },
      {
        standardName: 'Std 3',
        readings: {
          Pb: { nominalConc: 5, signal: 5010 },
          Cd: { nominalConc: 2.5, signal: 2505 },
        },
      },
      {
        standardName: 'Std 4',
        readings: {
          Pb: { nominalConc: 10, signal: 10010 },
          Cd: { nominalConc: 5.0, signal: 5005 },
        },
      },
      {
        standardName: 'Std 5',
        readings: {
          Pb: { nominalConc: 20, signal: 20010 },
          Cd: { nominalConc: 10.0, signal: 10005 },
        },
      },
    ],
    samples: [
      {
        sampleId: 'Blank Mars',
        sampleType: 'blank_method',
        weight: 0.5,
        volume: 50,
        df: 1,
        readings: { Pb: 0.01, Cd: 0.005 },
      },
      {
        sampleId: 'S-101',
        labSampleId: 'LAB-2026-001',
        sampleType: 'sample',
        weight: 0.5,
        volume: 50,
        df: 1,
        readings: { Pb: 5.01, Cd: 2.005 },
      },
      {
        sampleId: 'CCV-Mid',
        sampleType: 'ccv',
        expectedConc: { Pb: 5.0, Cd: 2.5 },
        weight: 0.5,
        volume: 50,
        df: 1,
        readings: { Pb: 5.05, Cd: 2.48 },
      },
    ],
  };
}

describe('Stage 4C: QC Criteria Profiles & ACID Calibration Endpoints', () => {
  let db: Database;
  let client: PGlite;
  let app: ReturnType<typeof createApp>;
  let authCookie: string;

  beforeEach(async () => {
    const setup = await createTestDb();
    db = setup.db;
    client = setup.client;
    app = createApp({ db, jwtSecret: TEST_JWT_SECRET });

    const regRes = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'analis@lab.com',
        password: 'SuperSecurePassword123!',
        name: 'Zidan Analis',
      }),
    });
    authCookie = extractCookiePair(regRes.headers.get('set-cookie'));
  });

  afterEach(async () => {
    await client.close();
  });

  it('POST /api/v1/qc-profiles creates v1 profile (201) and auto-increments to v2 with same id when name matches', async () => {
    const res1 = await app.request('/api/v1/qc-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify(VALID_QC_PROFILE_INPUT),
    });
    expect(res1.status).toBe(201);
    const v1 = await res1.json();
    expect(v1.version).toBe(1);
    expect(v1.id).toEqual(expect.any(String));

    // Create again with same name -> should keep same id and increment version to 2
    const res2 = await app.request('/api/v1/qc-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        ...VALID_QC_PROFILE_INPUT,
        linearity: { minR: 0.998 },
      }),
    });
    expect(res2.status).toBe(201);
    const v2 = await res2.json();
    expect(v2.id).toBe(v1.id);
    expect(v2.version).toBe(2);
    expect(v2.linearity.minR).toBe(0.998);

    // GET /api/v1/qc-profiles/:id returns latest version (v2)
    const getRes = await app.request(`/api/v1/qc-profiles/${v1.id}`, {
      headers: { Cookie: authCookie },
    });
    expect(getRes.status).toBe(200);
    const latest = await getRes.json();
    expect(latest.version).toBe(2);
  });

  it('POST /api/v1/qc-profiles returns 422 when profile violates metrological band rules', async () => {
    const invalidProfile = {
      ...VALID_QC_PROFILE_INPUT,
      linearity: { minR: 1.5 }, // Invalid: r cannot exceed 1.0
    };
    const res = await app.request('/api/v1/qc-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify(invalidProfile),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('INVALID_QC_PROFILE');
  });

  it('POST /api/v1/calibrations evaluates multi-analyte batch and persists ACID transaction + audit log (201)', async () => {
    const profRes = await app.request('/api/v1/qc-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify(VALID_QC_PROFILE_INPUT),
    });
    const profile = await profRes.json();

    const calRes = await app.request('/api/v1/calibrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify(buildCalibrationPayload(profile.id)),
    });
    expect(calRes.status).toBe(201);
    const batch = await calRes.json();

    expect(batch.id).toEqual(expect.any(String));
    expect(batch.qcStatus).toBe('PASSED');
    expect(batch.qcProfileRef).toEqual({ id: profile.id, version: 1 });
    expect(batch.evaluatedSamples).toHaveLength(3);
    expect(batch.evaluatedSamples[1].sampleId).toBe('S-101');
    expect(batch.evaluatedSamples[1].analytes.Pb.detectionZone).toBe('VALID_QUANTIFICATION');
    expect(batch.evaluatedSamples[1].analytes.Cd.detectionZone).toBe('VALID_QUANTIFICATION');

    // Verify audit log was persisted inside the ACID transaction
    const logs = await db.select().from(auditLogs);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe('calibration.persisted');
  });

  it('POST /api/v1/calibrations soft-flags INVALID_QC (201) when CCV drifts out of bounds (Invariant D4)', async () => {
    const profRes = await app.request('/api/v1/qc-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify(VALID_QC_PROFILE_INPUT),
    });
    const profile = await profRes.json();

    const payload = buildCalibrationPayload(profile.id);
    // Force CCV Pb recovery to 140% (expected 5.0, reading 7.0 -> outside 90%-110%)
    payload.samples[2]!.readings = { Pb: 7.0, Cd: 2.5 };

    const calRes = await app.request('/api/v1/calibrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify(payload),
    });
    expect(calRes.status).toBe(201);
    const batch = await calRes.json();
    expect(batch.qcStatus).toBe('INVALID_QC');
    expect(batch.qcViolations.length).toBeGreaterThan(0);
    expect(batch.qcViolations[0].rule).toBe('CCV_RECOVERY');
  });

  it('DELETE /api/v1/calibrations/:id removes calibration via ACID deleteCalibration and records audit log (204)', async () => {
    const profRes = await app.request('/api/v1/qc-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify(VALID_QC_PROFILE_INPUT),
    });
    const profile = await profRes.json();

    const calRes = await app.request('/api/v1/calibrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify(buildCalibrationPayload(profile.id)),
    });
    const batch = await calRes.json();

    const delRes = await app.request(`/api/v1/calibrations/${batch.id}`, {
      method: 'DELETE',
      headers: { Cookie: authCookie },
    });
    expect(delRes.status).toBe(204);

    const getAfterDel = await app.request(`/api/v1/calibrations/${batch.id}`, {
      headers: { Cookie: authCookie },
    });
    expect(getAfterDel.status).toBe(404);

    const logs = await db.select().from(auditLogs);
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => l.action)).toContain('calibration.deleted');
  });
});
