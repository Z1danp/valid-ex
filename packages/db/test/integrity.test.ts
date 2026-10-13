import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterEach, describe, expect, it } from 'vitest';

import { createDb, type Database } from '../src/client';
import {
  AUDIT_ACTIONS,
  auditLogs,
  calibrations,
  deleteCalibrationBatch,
  persistCalibrationBatch,
  qcCriteriaProfiles,
  users,
  type CalibrationBatchInsert,
} from '../src/index';
import * as schema from '../src/schema';

const migrationsFolder = new URL('../drizzle', import.meta.url).pathname;
const PROFILE_ID = '3f8a1c2e-9b7d-4bad-9bdd-2b0d7b3dcb6d';
const RESIDUAL = 0.1 + 0.2;

const clients: PGlite[] = [];

async function createTestDb(): Promise<PgliteDatabase<typeof schema>> {
  const client = new PGlite();
  clients.push(client);
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder });
  return db;
}

function asGatewayDb(db: PgliteDatabase<typeof schema>): Database {
  return db as unknown as Database;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

function profileDocument(ownerId: string) {
  return {
    id: PROFILE_ID,
    name: 'QC Criteria Check — SOP Lab',
    methodRef: 'Lab SOP QC CRITERIA CHECK',
    version: 1,
    effectiveDate: '2026-09-27',
    solutionConcUnit: 'ppb' as const,
    linearity: { minR: Math.PI },
    analytes: {
      Pb: {
        ccv: { bands: [{ maxConc: null, minRecovery: 90, maxRecovery: 110 }] },
        spike: { bands: [{ maxConc: null, minRecovery: 60, maxRecovery: 115 }] },
        duplicate: { bands: [{ maxConc: null, maxRpd: 25 }] },
      },
    },
    ownerId,
  };
}

function batch(userId: string, sampleCount = 1): CalibrationBatchInsert {
  const profile = profileDocument(userId);
  return {
    userId,
    title: 'Pengujian ICP-MS Batch Biskuit Gandum',
    instrument: 'ICP-MS',
    inputMode: 'in_vial_concentration',
    units: {
      solutionConcUnit: 'ppb',
      solidResultUnit: 'mg/kg',
      weightUnit: 'g',
      volumeUnit: 'mL',
      signalUnit: 'cps',
    },
    qcProfileId: PROFILE_ID,
    qcProfileVersion: 1,
    qcProfileSnapshot: {
      id: profile.id,
      name: profile.name,
      methodRef: profile.methodRef,
      version: profile.version,
      effectiveDate: profile.effectiveDate,
      solutionConcUnit: profile.solutionConcUnit,
      linearity: profile.linearity,
      analytes: profile.analytes,
    },
    qcStatus: 'INVALID_QC',
    analytes: ['Pb'],
    points: [
      {
        standardName: 'Std 1',
        readings: { Pb: { nominalConc: 10, signal: 12500 } },
      },
    ],
    samples: Array.from({ length: sampleCount }, (_, index) => ({
      sampleId: `1111 (${index + 1})`,
      sampleType: 'sample' as const,
      weight: 0.2014,
      volume: 50,
      df: 1,
      readings: { Pb: 1.16 },
    })),
    analytesSummary: {
      Pb: {
        slope: RESIDUAL,
        intercept: 1.2,
        r: 0.9998,
        rSquared: 0.9996,
        syx: 0.045,
        lodInstrument: 0.005,
        loqInstrument: 0.015,
      },
    },
    evaluatedSamples: [],
    qcViolations: [],
  };
}

async function seedUser(db: PgliteDatabase<typeof schema>, email = 'analis@lab.com') {
  const inserted = await db
    .insert(users)
    .values({
      email,
      name: 'Zidan',
      authProvider: 'local',
      passwordHash: 'scrypt-hash',
    })
    .returning({ id: users.id });
  const user = inserted[0];
  if (!user) {
    throw new Error('user insert returned no row');
  }
  return user;
}

async function seedProfile(
  db: PgliteDatabase<typeof schema>,
  ownerUserId: string,
  profileId = PROFILE_ID,
) {
  const profile = profileDocument(ownerUserId);
  await db.insert(qcCriteriaProfiles).values({
    id: profileId,
    version: profile.version,
    ownerUserId,
    name: profile.name,
    methodRef: profile.methodRef,
    effectiveDate: profile.effectiveDate,
    solutionConcUnit: profile.solutionConcUnit,
    linearityMinR: profile.linearity.minR,
    analytes: profile.analytes,
  });
}

async function seedOwner(db: PgliteDatabase<typeof schema>, email = 'analis@lab.com') {
  const user = await seedUser(db, email);
  await seedProfile(db, user.id);
  return user;
}

function messageOf(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join('\n');
}

async function expectDbError(run: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(messageOf(error)).toMatch(pattern);
    return;
  }
  throw new Error(`expected database error matching ${pattern}`);
}

describe('migration SQL', () => {
  const migration = readFileSync(new URL('../drizzle/0000_silly_storm.sql', import.meta.url), 'utf8');
  const guards = readFileSync(new URL('../drizzle/0001_integrity_guards.sql', import.meta.url), 'utf8');
  const guardSource = readFileSync(new URL('../src/integrity.sql', import.meta.url), 'utf8');
  const clientSource = readFileSync(new URL('../src/client.ts', import.meta.url), 'utf8');

  it('emits the T5 local-password check, JSONB points, and double precision', () => {
    expect(migration).toContain('CONSTRAINT "check_password_for_local_auth"');
    expect(migration).toContain(
      `("users"."auth_provider" = 'local' AND "users"."password_hash" IS NOT NULL) OR ("users"."auth_provider" != 'local')`,
    );
    expect(migration).toContain('"points" jsonb NOT NULL');
    expect(migration).toContain('"linearity_min_r" double precision NOT NULL');
    expect(migration).toContain('jsonb_array_length("calibrations"."samples") <= 250');
    expect(migration).not.toMatch(/\breal\b|\bfloat4\b/);
  });

  it('refuses to open a pool without a connection string', () => {
    expect(() => createDb('   ')).toThrow(/DATABASE_URL is empty/);
  });

  it('keeps the WebSocket pooler and the append-only guard migration in sync', () => {
    expect(clientSource).toContain("from 'drizzle-orm/neon-serverless'");
    expect(clientSource).toContain("from '@neondatabase/serverless'");
    expect(clientSource).not.toContain('drizzle-orm/neon-http');
    expect(guards).toBe(guardSource);
    expect(guards).toContain('audit_logs_append_only');
    expect(guards).toContain('qc_criteria_profiles_immutable');
    expect(guards).toContain('calibrations_no_update');
  });
});

describe('postgres integrity', () => {
  it('rejects a local account without a password hash and accepts a google account without one', async () => {
    const db = await createTestDb();

    await expectDbError(
      () =>
        db.insert(users).values({
          email: 'local@lab.com',
          name: 'Local',
          authProvider: 'local',
          passwordHash: null,
        }),
      /check_password_for_local_auth|check_provider_identity/,
    );

    await expectDbError(
      () =>
        db.insert(users).values({
          email: 'hybrid@lab.com',
          name: 'Hybrid',
          authProvider: 'google',
          googleId: 'google-1',
          passwordHash: 'not-allowed',
        }),
      /check_provider_identity/,
    );

    await expectDbError(
      () =>
        db.insert(users).values({
          email: 'Analis@lab.com',
          name: 'Case',
          authProvider: 'local',
          passwordHash: 'hash',
        }),
      /check_email_lowercase/,
    );

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

    await expectDbError(
      () =>
        db.insert(users).values({
          email: 'linked-local@lab.com',
          name: 'Linked',
          authProvider: 'local',
          passwordHash: 'hash',
          googleId: 'google-3',
        }),
      /check_provider_identity/,
    );

    const inserted = await db
      .insert(users)
      .values({
        email: 'oauth@lab.com',
        name: 'OAuth',
        authProvider: 'google',
        googleId: 'google-2',
        passwordHash: null,
      })
      .returning({ id: users.id, passwordHash: users.passwordHash });

    expect(inserted[0]?.passwordHash).toBeNull();
  });

  it('rejects a second account with the same email', async () => {
    const db = await createTestDb();
    await seedOwner(db);

    await expectDbError(
      () =>
        db.insert(users).values({
          email: 'analis@lab.com',
          name: 'Other',
          authProvider: 'local',
          passwordHash: 'other-hash',
        }),
      /users_email_unique|duplicate key/i,
    );
  });

  it('stores full-precision metrics and rolls a failed batch back with its audit log', async () => {
    const db = await createTestDb();
    const owner = await seedOwner(db);
    const gateway = asGatewayDb(db);

    await expect(
      gateway.transaction(async (tx) => {
        await persistCalibrationBatch(tx, batch(owner.id));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await db.select().from(calibrations)).toEqual([]);
    expect(await db.select().from(auditLogs)).toEqual([]);

    const persisted = await persistCalibrationBatch(gateway, batch(owner.id));
    const stored = await db.select().from(calibrations).where(eq(calibrations.id, persisted.calibrationId));
    const row = stored[0];
    expect(row?.analytesSummary.Pb?.slope).toBe(RESIDUAL);
    expect(Object.is(row?.analytesSummary.Pb?.slope, RESIDUAL)).toBe(true);

    const profile = await db.select().from(qcCriteriaProfiles);
    expect(Object.is(profile[0]?.linearityMinR, Math.PI)).toBe(true);

    const audit = await db.select().from(auditLogs).where(eq(auditLogs.id, persisted.auditLogId));
    expect(audit[0]).toMatchObject({
      action: AUDIT_ACTIONS.calibrationPersisted,
      entityType: 'calibration',
      entityId: persisted.calibrationId,
      userId: owner.id,
    });
    expect(audit[0]?.payload).toMatchObject({ qcStatus: 'INVALID_QC', qcProfileVersion: 1 });
  });

  it('caps a batch at 250 sample rows and requires a real profile version', async () => {
    const db = await createTestDb();
    const owner = await seedOwner(db);
    const gateway = asGatewayDb(db);

    const accepted = await persistCalibrationBatch(gateway, batch(owner.id, 250));
    expect(accepted.calibrationId).toEqual(expect.any(String));

    await expectDbError(
      () => persistCalibrationBatch(gateway, batch(owner.id, 251)),
      /calibrations_sample_row_cap/,
    );

    await expectDbError(
      () =>
        persistCalibrationBatch(gateway, {
          ...batch(owner.id),
          qcProfileVersion: 99,
        }),
      /calibrations_qc_profile_version_fk|foreign key/i,
    );
  });

  it('keeps the audit row after delete and refuses cross-owner deletion', async () => {
    const db = await createTestDb();
    const owner = await seedOwner(db);
    const other = await seedUser(db, 'other@lab.com');
    const gateway = asGatewayDb(db);
    const persisted = await persistCalibrationBatch(gateway, batch(owner.id));

    expect(
      await deleteCalibrationBatch(gateway, {
        calibrationId: persisted.calibrationId,
        userId: other.id,
      }),
    ).toBeNull();
    expect(await db.select().from(calibrations)).toHaveLength(1);

    const deleted = await deleteCalibrationBatch(gateway, {
      calibrationId: persisted.calibrationId,
      userId: owner.id,
    });
    expect(deleted?.auditLogId).toEqual(expect.any(String));
    expect(await db.select().from(calibrations)).toEqual([]);

    const audits = await db.select().from(auditLogs);
    expect(audits.map((entry) => entry.action)).toEqual([
      AUDIT_ACTIONS.calibrationPersisted,
      AUDIT_ACTIONS.calibrationDeleted,
    ]);
    expect(audits[1]?.payload).toMatchObject({
      title: 'Pengujian ICP-MS Batch Biskuit Gandum',
      methodRef: 'Lab SOP QC CRITERIA CHECK',
    });
  });

  it('rejects updates to batches, profiles, and audit logs', async () => {
    const db = await createTestDb();
    const owner = await seedOwner(db);
    const gateway = asGatewayDb(db);
    const persisted = await persistCalibrationBatch(gateway, batch(owner.id));

    await expectDbError(
      () => db.update(calibrations).set({ title: 'rewritten' }).where(eq(calibrations.id, persisted.calibrationId)),
      /calibrations forbids UPDATE/,
    );

    await expectDbError(
      () => db.update(qcCriteriaProfiles).set({ methodRef: 'rewritten' }).where(eq(qcCriteriaProfiles.id, PROFILE_ID)),
      /qc_criteria_profiles forbids UPDATE/,
    );

    await expectDbError(
      () => db.delete(qcCriteriaProfiles).where(eq(qcCriteriaProfiles.id, PROFILE_ID)),
      /qc_criteria_profiles forbids DELETE/,
    );

    await expectDbError(
      () => db.delete(auditLogs).where(eq(auditLogs.id, persisted.auditLogId)),
      /audit_logs forbids DELETE/,
    );

    const versionTwo = await db
      .insert(qcCriteriaProfiles)
      .values({
        id: PROFILE_ID,
        version: 2,
        ownerUserId: owner.id,
        name: 'QC Criteria Check — SOP Lab',
        methodRef: 'Lab SOP QC CRITERIA CHECK',
        effectiveDate: '2026-10-01',
        solutionConcUnit: 'ppb',
        linearityMinR: 0.995,
        analytes: profileDocument(owner.id).analytes,
      })
      .returning({ version: qcCriteriaProfiles.version });
    expect(versionTwo[0]?.version).toBe(2);
  });

  it('surfaces a constraint name when a check fails', async () => {
    const db = await createTestDb();
    try {
      await db.insert(users).values({
        email: 'missing-hash@lab.com',
        name: 'Missing',
        authProvider: 'local',
      });
      throw new Error('insert should have failed');
    } catch (error) {
      expect(messageOf(error)).toMatch(/check_password_for_local_auth|check_provider_identity/);
    }
  });
});
