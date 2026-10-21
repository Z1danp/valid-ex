import {and, eq} from 'drizzle-orm';

import type { Database } from './client';

import { auditLogs, calibrations, sampleRows } from './schema';

export const MAX_SAMPLES_ROWS_PER_BATCH = 250;

export const AUDIT_ACTIONS = {
    calibrationPersisted: 'calibration.persisted',
    calibrationDeleted: 'calibration.deleted'
} as const;

export type SampleRowInsertInput = Omit<typeof sampleRows.$inferInsert, 'id' | 'calibrationId' | 'userId' | 'createdAt'> & {
    id?: string;
};

export type CalibrationBatchInsert = Omit<typeof calibrations.$inferInsert, 'id' | 'createdAt' | 'updatedAt' | 'qcViolations'> & {
    id?: string;
    qcViolations?: typeof calibrations.$inferInsert.qcViolations;
    sampleRows?: SampleRowInsertInput[]
};

export type PersistedCalibration = {
    calibrationId: string;
    sampleRowsIds: string[];
    auditLogsId: string;
};

export type DeletedCalibration = {
    auditLogsId: string;
}

type TransactionHost = {
    transaction: Database['transaction'];
};

export function normalizeLabSampleId(raw: string | null | undefined): string | null {
    if (raw === null || raw === undefined) {return null;}
    const trimmed = raw.trim();
    return trimmed.length === 0 ? null : trimmed;
}

export async function persistCalibrationBatch(db: TransactionHost, input: CalibrationBatchInsert): Promise<PersistedCalibration> {
    // sample threshold max
    if (input.sampleRows && input.sampleRows.length > MAX_SAMPLES_ROWS_PER_BATCH) {
        throw new Error(`Too many sample rows: ${input.sampleRows.length} > ${MAX_SAMPLES_ROWS_PER_BATCH}`);
    }
    // open acid transaction
    const transaction = await db.transaction(async (tx) => {
        const {sampleRows: sampleRowsInputs, ...calibrationsValues} = input;
        // insert calibration to get id 
        const inserted = await tx.insert(calibrations).values({...calibrationsValues, qcViolations: input.qcViolations}).returning({id: calibrations.id});
        const calibration = inserted[0];
        if (!calibration) {
            throw new Error('Failed to insert calibration');
        }
        let sampleRowsIds: string[] = [];
        // insert sample rows
        if (sampleRowsInputs && sampleRowsInputs.length > 0) {
            const sampleRowsInserted = await tx.insert(sampleRows).values(sampleRowsInputs.map((row: SampleRowInsertInput) => ({
                ...row,
                calibrationId: calibration.id,
                userId: input.userId,
                labSampleId: normalizeLabSampleId(row.labSampleId)
            }))).returning({id: sampleRows.id})
            sampleRowsIds = sampleRowsInserted.map((row: {id: string}) => row.id);
        }
        // insert audit logs
        const auditLog = await tx.insert(auditLogs).values({
            userId: input.userId,
            action: AUDIT_ACTIONS.calibrationPersisted,
            entityType: 'calibration',
            entityId: calibration.id,
            payload: {
                qcStatus: input.qcStatus,
                qcProfileId: input.qcProfileId,
                qcProfileVersion: input.qcProfileVersion,
                title: input.title,
                sampleCount: sampleRowsInputs?.length,
            }
        }).returning({id: auditLogs.id})
        if (!auditLog) {
            throw new Error('Failed to insert audit log');
        }
        return {
            calibrationId: calibration.id,
            sampleRowsIds,
            auditLogsId: auditLog[0]?.id ?? ''
        };
    });
    if (!transaction) {
        throw new Error('Failed to persist calibration batch');
    }
    return transaction;
}

export async function deleteCalibration(db: TransactionHost, args: {calibrationId: string, userId: string}) {
    const transaction = await db.transaction(async (tx) => {
        const calibration = await tx.select().from(calibrations).where(and(eq(calibrations.id, args.calibrationId), eq(calibrations.userId, args.userId)))
        if(!calibration[0]) {
            throw new Error('Calibration not found');
        }
        // record audit log
        const auditLog = await tx.insert(auditLogs).values({
            userId: args.userId,
            action: AUDIT_ACTIONS.calibrationDeleted,
            entityType: 'calibration',
            entityId: args.calibrationId,
            payload: {
                title: calibration[0].title,
                instrument: calibration[0].instrument,
                qcStatus: calibration[0].qcStatus,
                qcProfileId: calibration[0].qcProfileId,
                qcProfileVersion: calibration[0].qcProfileVersion,
                methodRef: calibration[0].qcProfileSnapshot.methodRef,
            }
        }).returning({id: auditLogs.id})
        const audit = auditLog[0];
        if(!audit) {
            throw new Error('Failed to insert audit log');
        }
        // delete calibration
        await tx.delete(calibrations).where(eq(calibrations.id, args.calibrationId));
        return {
            auditLogId: audit.id
        }
    })
    if (!transaction) {
        throw new Error('Failed to delete calibration');
    }
    return transaction;
}