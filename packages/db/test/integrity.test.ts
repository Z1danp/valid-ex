import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';

import {
  AUDIT_ACTIONS,
  auditLogs,
  type CalibrationBatchInsert,
  calibrations,
  type Database,
  deleteCalibration,
  persistCalibrationBatch,
  type QCCriteriaProfileDocument,
  qcCriteriaProfiles,
  sampleRows,
  users,
} from '../src';
import * as schema from '../src/schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = resolve(__dirname, '../drizzle');

const PROFILE_ID = '00000000-0000-4000-8000-000000000001';
const RESIDUAL = 0.14285714285714285;

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
type TransactionHost = { transaction: Database['transaction'] };

async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

function asGatewayDb(db: TestDb): TransactionHost {
  return db as unknown as TransactionHost;
}

function messageOf(error: unknown): string {
  const parts: string[] = [];
  let cursor: unknown = error;
  while (cursor instanceof Error) {
    parts.push(cursor.message);
    const pgCode = (cursor as { code?: string }).code;
    const constraint = (cursor as { constraint?: string }).constraint;
    if (pgCode) parts.push(pgCode);
    if (constraint) parts.push(constraint);
    cursor = cursor.cause;
  }
  return parts.join(' :: ');
}

async function expectDbError(action: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  expect(caught, `expected failure matching ${pattern}`).toBeDefined();
  expect(messageOf(caught)).toMatch(pattern);
}

function profileDocument(): QCCriteriaProfileDocument {
  return {
    id: PROFILE_ID,
    name: 'QC Criteria Check — SOP Lab',
    methodRef: 'Lab SOP QC CRITERIA CHECK',
    version: 1,
    effectiveDate: '2026-09-27',
    solutionConcUnit: 'ppb',
    linearity: { minR: 0.995 },
    analytes: {
      Pb: {
        ccv: { bands: [{ maxConc: null, minRecovery: 90, maxRecovery: 110 }] },
        spike: { bands: [{ maxConc: null, minRecovery: 60, maxRecovery: 115 }] },
        duplicate: { bands: [{ maxConc: null, maxRpd: 25 }] },
      },
    },
  };
}

async function seedUser(db: TestDb, email = 'analis@lab.com'): Promise<{ id: string }> {
  const inserted = await db
    .insert(users)
    .values({
      email,
      name: 'Analis Utama',
      authProvider: 'local',
      passwordHash: '$2b$10$validhash',
    })
    .returning({ id: users.id });
  const row = inserted[0];
  if (!row) {
    throw new Error('failed to seed user');
  }
  return row;
}

async function seedOwnerWithProfile(db: TestDb): Promise<{ id: string }> {
  const owner = await seedUser(db);
  const doc = profileDocument();
  await db.insert(qcCriteriaProfiles).values({
    id: doc.id,
    version: doc.version,
    ownerUserId: owner.id,
    name: doc.name,
    methodRef: doc.methodRef,
    effectiveDate: doc.effectiveDate,
    solutionConcUnit: doc.solutionConcUnit,
    linearityMinR: Math.PI,
    analytes: doc.analytes,
  });
  return owner;
}

function batch(userId: string, sampleCount = 2): CalibrationBatchInsert {
  const sampleRowsInput: NonNullable<CalibrationBatchInsert['sampleRows']> = Array.from(
    { length: sampleCount },
    (_, index) => ({
      sampleId: index === 0 ? 'Blanko' : `S-${index}`,
      labSampleId: index === 0 ? '   ' : `  LAB-${index}  `,
      sampleType: index === 0 ? 'blank_method' : 'sample',
      parentSampleId: null,
      weight: 0.2014,
      volume: 50,
      df: 1,
      spikeAdded: null,
      expectedConc: null,
      readings: { Pb: 1.16 + index },
      analyteResults: {
        Pb: {
          cRaw: 1.16,
          cNet: 1.11,
          concSolid: RESIDUAL,
          detectionZone: 'VALID_QUANTIFICATION',
          reportedValue: '0.276 mg/kg',
          lodMethod: 0.03,
          loqMethod: 0.1,
          rpd: null,
          spikeRecovery: null,
          ccvRecovery: null,
        },
      },
    }),
  );

  return {
    userId,
    title: 'Pengujian ICP-MS Batch Biskuit Gandum',
    instrument: 'ICP-MS',
    inputMode: 'raw_signal',
    units: {
      solutionConcUnit: 'ppb',
      solidResultUnit: 'mg/kg',
      weightUnit: 'g',
      volumeUnit: 'mL',
      signalUnit: 'cps',
    },
    qcProfileId: PROFILE_ID,
    qcProfileVersion: 1,
    qcProfileSnapshot: profileDocument(),
    qcStatus: 'INVALID_QC',
    analytes: ['Pb', 'Cd', 'Mercury'],
    points: [
      { standardName: 'Blank', readings: { Pb: { nominalConc: 0, signal: 10 } } },
      { standardName: 'Std 1', readings: { Pb: { nominalConc: 1, signal: 240 } } },
    ],
    analytesSummary: {
      Pb: {
        slope: RESIDUAL,
        intercept: 10,
        r: 0.99985,
        rSquared: 0.9997,
        syx: RESIDUAL,
        lodInstrument: 0.12,
        loqInstrument: 0.4,
      },
    },
    qcViolations: [
      {
        rule: 'CCV_RECOVERY',
        analyte: 'Pb',
        sampleId: 'CCV-1',
        expected: '90.0% - 110.0%',
        actual: '114.2%',
        message: 'CCV drift',
        profileVersion: 1,
        appliedCriteria: {
          testValue: 1,
          bandMaxConc: null,
          min: 90,
          max: 110,
        },
      },
    ],
    sampleRows: sampleRowsInput,
  };
}

describe('@valid-ex/db — Milestone 3 (ADR-0008) integrity & transactions', () => {
  it('Skenario 1: enforces single-table auth invariants and lowercase unique email', async () => {
    const db = await createTestDb();

    // Local account without password_hash -> rejected
    await expectDbError(
      () =>
        db.insert(users).values({
          email: 'local@lab.com',
          name: 'Local No Password',
          authProvider: 'local',
          passwordHash: null,
        }),
      /check_provider_identity/,
    );

    // Local account carrying google_id -> rejected
    await expectDbError(
      () =>
        db.insert(users).values({
          email: 'linked-local@lab.com',
          name: 'Linked Local',
          authProvider: 'local',
          passwordHash: 'hash',
          googleId: 'google-1',
        }),
      /check_provider_identity/,
    );

    // Google account carrying password_hash -> rejected
    await expectDbError(
      () =>
        db.insert(users).values({
          email: 'oauth-bad@lab.com',
          name: 'Bad OAuth',
          authProvider: 'google',
          googleId: 'google-2',
          passwordHash: 'not-allowed',
        }),
      /check_provider_identity/,
    );

    // Google account missing google_id -> rejected
    await expectDbError(
      () =>
        db.insert(users).values({
          email: 'nolink@lab.com',
          name: 'No Link',
          authProvider: 'google',
          passwordHash: null,
        }),
      /check_provider_identity/,
    );

    // Uppercase email -> rejected
    await expectDbError(
      () =>
        db.insert(users).values({
          email: 'Analis@lab.com',
          name: 'Uppercase',
          authProvider: 'local',
          passwordHash: 'hash',
        }),
      /check_email_lowercase/,
    );

    // Duplicate email -> rejected
    await seedUser(db, 'analis@lab.com');
    await expectDbError(
      () =>
        db.insert(users).values({
          email: 'analis@lab.com',
          name: 'Duplicate',
          authProvider: 'local',
          passwordHash: 'other-hash',
        }),
      /users_email_unique|duplicate key/i,
    );
  });

  it('Skenario 2: enforces composite FK ownership and version on qc_criteria_profiles', async () => {
    const db = await createTestDb();
    const owner = await seedOwnerWithProfile(db);
    const intruder = await seedUser(db, 'intruder@lab.com');
    const gateway = asGatewayDb(db);

    // Cross-owner profile usage -> rejected by 3-column composite FK
    await expectDbError(
      () =>
        persistCalibrationBatch(gateway, {
          ...batch(intruder.id),
          qcProfileId: PROFILE_ID,
          qcProfileVersion: 1,
        }),
      /calibrations_qc_profile_version_fk|foreign key/i,
    );

    // Non-existent profile version -> rejected by composite FK
    await expectDbError(
      () =>
        persistCalibrationBatch(gateway, {
          ...batch(owner.id),
          qcProfileVersion: 99,
        }),
      /calibrations_qc_profile_version_fk|foreign key/i,
    );
  });

  it('Skenario 3: commits calibrations + sample_rows + audit_logs atomically and preserves IEEE 754 precision', async () => {
    const db = await createTestDb();
    const owner = await seedOwnerWithProfile(db);
    const gateway = asGatewayDb(db);

    await expect(
      gateway.transaction(async (tx) => {
        await persistCalibrationBatch(tx as unknown as TransactionHost, batch(owner.id, 3));
        throw new Error('simulated crash');
      }),
    ).rejects.toThrow('simulated crash');

    expect(await db.select().from(calibrations)).toEqual([]);
    expect(await db.select().from(sampleRows)).toEqual([]);
    expect(await db.select().from(auditLogs)).toEqual([]);

    const persisted = await persistCalibrationBatch(gateway, batch(owner.id, 3));
    expect(persisted.sampleRowsIds).toHaveLength(3);

    const calRows = await db
      .select()
      .from(calibrations)
      .where(eq(calibrations.id, persisted.calibrationId));
    expect(calRows[0]?.analytes).toEqual(['Pb', 'Cd', 'Mercury']);
    expect(Object.is(calRows[0]?.analytesSummary.Pb?.slope, RESIDUAL)).toBe(true);

    const sRows = await db
      .select()
      .from(sampleRows)
      .where(eq(sampleRows.calibrationId, persisted.calibrationId));
    expect(sRows).toHaveLength(3);
    expect(Object.is(sRows[0]?.analyteResults.Pb?.concSolid, RESIDUAL)).toBe(true);
  });

  it('Skenario 4: enforces 250 sample row cap, unique sample_id per batch, and trimmed lab_sample_id', async () => {
    const db = await createTestDb();
    const owner = await seedOwnerWithProfile(db);
    const gateway = asGatewayDb(db);

    const maxAccepted = await persistCalibrationBatch(gateway, batch(owner.id, 250));
    expect(maxAccepted.sampleRowsIds).toHaveLength(250);

    await expectDbError(
      () => persistCalibrationBatch(gateway, batch(owner.id, 251)),
      /Too many sample rows/,
    );

    // Check trimmed labSampleId values in DB
    const storedSamples = await db
      .select()
      .from(sampleRows)
      .where(eq(sampleRows.calibrationId, maxAccepted.calibrationId));
    const blankRow = storedSamples.find((r) => r.sampleId === 'Blanko');
    const firstSample = storedSamples.find((r) => r.sampleId === 'S-1');
    expect(blankRow?.labSampleId).toBeNull();
    expect(firstSample?.labSampleId).toBe('LAB-1');

    // Duplicate sample_id within the same batch -> rejected
    const dupBatch = batch(owner.id, 2);
    dupBatch.sampleRows = [
      dupBatch.sampleRows![0]!,
      { ...dupBatch.sampleRows![1]!, sampleId: 'Blanko' },
    ];
    await expectDbError(
      () => persistCalibrationBatch(gateway, dupBatch),
      /sample_rows_calibration_sample_id_uq|duplicate key/i,
    );

    // Direct insert of untrimmed lab_sample_id -> rejected by DB CHECK constraint
    await expectDbError(
      () =>
        db.insert(sampleRows).values({
          calibrationId: maxAccepted.calibrationId,
          userId: owner.id,
          sampleId: 'Untrimmed-Direct',
          labSampleId: '  291843  ',
          sampleType: 'sample',
          weight: 0.2,
          volume: 50,
          df: 1,
          readings: { Pb: 10 },
          analyteResults: {},
        }),
      /sample_rows_lab_sample_id_trimmed_nonempty/,
    );
  });

  it('Skenario 5: cascades sample_rows deletion while preserving audit_logs and blocking cross-owner delete', async () => {
    const db = await createTestDb();
    const owner = await seedOwnerWithProfile(db);
    const other = await seedUser(db, 'other@lab.com');
    const gateway = asGatewayDb(db);
    const persisted = await persistCalibrationBatch(gateway, batch(owner.id, 2));

    // Cross-owner delete -> rejected
    await expectDbError(
      () =>
        deleteCalibration(gateway, {
          calibrationId: persisted.calibrationId,
          userId: other.id,
        }),
      /Calibration not found/,
    );
    expect(await db.select().from(calibrations)).toHaveLength(1);
    expect(await db.select().from(sampleRows)).toHaveLength(2);

    // Owner delete -> removes calibration and cascades sample_rows, keeps audit_logs
    const deleted = await deleteCalibration(gateway, {
      calibrationId: persisted.calibrationId,
      userId: owner.id,
    });
    expect(deleted.auditLogId).toEqual(expect.any(String));
    expect(await db.select().from(calibrations)).toEqual([]);
    expect(await db.select().from(sampleRows)).toEqual([]);

    const audits = await db.select().from(auditLogs);
    expect(audits.map((entry) => entry.action)).toEqual([
      AUDIT_ACTIONS.calibrationPersisted,
      AUDIT_ACTIONS.calibrationDeleted,
    ]);
  });

  it('Skenario 6: triggers reject UPDATE on calibrations/sample_rows and UPDATE/DELETE on profiles/audit_logs', async () => {
    const db = await createTestDb();
    const owner = await seedOwnerWithProfile(db);
    const gateway = asGatewayDb(db);
    const persisted = await persistCalibrationBatch(gateway, batch(owner.id, 1));

    await expectDbError(
      () =>
        db
          .update(calibrations)
          .set({ title: 'rewritten' })
          .where(eq(calibrations.id, persisted.calibrationId)),
      /calibrations forbids UPDATE/,
    );

    await expectDbError(
      () =>
        db
          .update(sampleRows)
          .set({ weight: 9.99 })
          .where(eq(sampleRows.calibrationId, persisted.calibrationId)),
      /sample_rows forbids UPDATE/,
    );

    await expectDbError(
      () =>
        db
          .update(qcCriteriaProfiles)
          .set({ methodRef: 'rewritten' })
          .where(eq(qcCriteriaProfiles.id, PROFILE_ID)),
      /qc_criteria_profiles forbids UPDATE/,
    );

    await expectDbError(
      () => db.delete(qcCriteriaProfiles).where(eq(qcCriteriaProfiles.id, PROFILE_ID)),
      /qc_criteria_profiles forbids DELETE/,
    );

    await expectDbError(
      () => db.delete(auditLogs).where(eq(auditLogs.id, persisted.auditLogsId)),
      /audit_logs forbids DELETE/,
    );
  });
});
