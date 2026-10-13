import { and, eq } from 'drizzle-orm';

import type { Database } from './client';
import { auditLogs, calibrations } from './schema';

export const AUDIT_ACTIONS = {
  calibrationPersisted: 'calibration.persisted',
  calibrationDeleted: 'calibration.deleted',
} as const;

export type CalibrationBatchInsert = Omit<
  typeof calibrations.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'qcViolations'
> & {
  id?: string;
  qcViolations?: typeof calibrations.$inferInsert.qcViolations;
};

export type PersistedCalibration = {
  calibrationId: string;
  auditLogId: string;
};

type TransactionHost = {
  transaction: Database['transaction'];
};

/**
 * Writes one calibration batch and its audit event in a single transaction
 * (Invariant T6). A failure on either insert rolls both back.
 */
export async function persistCalibrationBatch(
  db: TransactionHost,
  input: CalibrationBatchInsert,
): Promise<PersistedCalibration> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(calibrations)
      .values({
        ...input,
        qcViolations: input.qcViolations ?? [],
      })
      .returning({ id: calibrations.id });
    const calibration = inserted[0];
    if (!calibration) {
      throw new Error('calibration insert returned no row');
    }

    const audited = await tx
      .insert(auditLogs)
      .values({
        userId: input.userId,
        action: AUDIT_ACTIONS.calibrationPersisted,
        entityType: 'calibration',
        entityId: calibration.id,
        payload: {
          qcStatus: input.qcStatus,
          qcProfileId: input.qcProfileId,
          qcProfileVersion: input.qcProfileVersion,
          title: input.title,
        },
      })
      .returning({ id: auditLogs.id });
    const audit = audited[0];
    if (!audit) {
      throw new Error('audit log insert returned no row');
    }

    return { calibrationId: calibration.id, auditLogId: audit.id };
  });
}

export type DeletedCalibration = {
  auditLogId: string;
};

/**
 * Records the deletion, then removes the batch. The audit row keeps a summary
 * because `audit_logs.entity_id` is not a foreign key.
 * Returns null when the batch is missing or owned by someone else.
 */
export async function deleteCalibrationBatch(
  db: TransactionHost,
  args: { calibrationId: string; userId: string },
): Promise<DeletedCalibration | null> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({
        id: calibrations.id,
        title: calibrations.title,
        instrument: calibrations.instrument,
        qcStatus: calibrations.qcStatus,
        qcProfileId: calibrations.qcProfileId,
        qcProfileVersion: calibrations.qcProfileVersion,
        qcProfileSnapshot: calibrations.qcProfileSnapshot,
      })
      .from(calibrations)
      .where(and(eq(calibrations.id, args.calibrationId), eq(calibrations.userId, args.userId)));
    const row = existing[0];
    if (!row) {
      return null;
    }

    const audited = await tx
      .insert(auditLogs)
      .values({
        userId: args.userId,
        action: AUDIT_ACTIONS.calibrationDeleted,
        entityType: 'calibration',
        entityId: row.id,
        payload: {
          title: row.title,
          instrument: row.instrument,
          qcStatus: row.qcStatus,
          qcProfileId: row.qcProfileId,
          qcProfileVersion: row.qcProfileVersion,
          methodRef: row.qcProfileSnapshot.methodRef,
        },
      })
      .returning({ id: auditLogs.id });
    const audit = audited[0];
    if (!audit) {
      throw new Error('audit log insert returned no row');
    }

    await tx.delete(calibrations).where(eq(calibrations.id, row.id));
    return { auditLogId: audit.id };
  });
}
