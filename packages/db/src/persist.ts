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
    sampleRows?: SampleRowInsertInput
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