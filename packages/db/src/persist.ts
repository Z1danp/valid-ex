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

export async function persistCalibrationBatch(db: Database, input: CalibrationBatchInsert): Promise<PersistedCalibration> {
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