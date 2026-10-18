import type { components } from "@valid-ex/contracts";
import { pgTable, uuid, varchar, index, jsonb, doublePrecision, timestamp, foreignKey, unique, check,  } from "drizzle-orm/pg-core";
import { sampleTypeEnum } from "./enums";
import { sql } from "drizzle-orm";
import { calibrations } from "./calibrations";

export type AnalyteSampleResult = components['schemas']['AnalyteSampleResult'];

export const sampleRows = pgTable('sample_rows', {
    id: uuid('id').defaultRandom().primaryKey(),
    calibrationId: uuid('calibration_id').notNull(),
    userId: uuid('user_id').notNull(),
    labSampleId: varchar('lab_sample_id', {length: 255}),
    sampleId: varchar('sample_id', {length: 255}).notNull(),
    sampleType: sampleTypeEnum('sample_type').notNull(),
    parentSampleId: varchar('parent_sample_id', {length: 255}),
    weight: doublePrecision('weight').notNull(),
    volume: doublePrecision('volume').notNull(),
    df: doublePrecision('df').notNull(),
    spikeAdded: jsonb('spike_added').$type<Record<string, number>>(),
    expectedConc: jsonb('expected_conc').$type<Record<string, number>>(),
    readings: jsonb('readings').$type<Record<string, number>>().notNull(),
    analyteResults: jsonb('analyte_results').$type<Record<string, AnalyteSampleResult>>().notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow()
}, (table) => [
    foreignKey({name: 'sample_rows_calibration_user_fk', columns: [table.calibrationId, table.userId], foreignColumns: [calibrations.id, calibrations.userId]}).onDelete('cascade').onUpdate('cascade'),
    unique('sample_rows_calibration_sample_id_uq').on(table.calibrationId, table.sampleId),
    index('sample_rows_calibration_id_idx').on(table.calibrationId),
    index('sample_rows_owner_lab_sample_id_idx').on(table.userId, table.labSampleId).where(sql`${table.labSampleId} IS NOT NULL`),
    check(
        'sample_rows_lab_sample_id_trimmed_nonempty',
        sql`${table.labSampleId} IS NULL OR (length(btrim(${table.labSampleId})) > 0 AND ${table.labSampleId} = btrim(${table.labSampleId}))`,
      ),
    check('sample_rows_df_positive', sql`${table.df} >= 0`),
])