import { pgTable, uuid, varchar, jsonb, integer, timestamp, text, index, unique, check, foreignKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { components } from "@valid-ex/contracts";
import { users } from "./users";
import { inputModeEnum, instrumentTypeEnum, qcStatusEnum } from "./enums";
import { qcCriteriaProfiles } from "./qc-profiles";


export type MetrologyUnits = components['schemas']['MetrologyUnits']
export type StandardRowInput = components['schemas']['StandardRowInput']
export type AnalyteCurveMetrics = components['schemas']['AnalyteCurveMetrics']
export type QCViolationRecord = components['schemas']['QCViolationRecord']
export type QCCriteriaProfileDocument = components['schemas']['QCCriteriaProfile']


export const calibrations = pgTable('calibrations', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, {onDelete: 'restrict', onUpdate: 'restrict'}),
    title: varchar('title', {length: 255}).notNull(),
    instrument: instrumentTypeEnum('instrument').notNull(),
    inputMode: inputModeEnum('input_mode').notNull(),
    units: jsonb('units').$type<MetrologyUnits>().notNull(),
    qcProfileId: uuid('qc_profile').notNull(),
    qcProfileVersion: integer('qc_profile_version').notNull(),
    qcProfileSnapshot: jsonb('qc_profile_snapshot').$type<QCCriteriaProfileDocument>().notNull(),
    qcStatus: qcStatusEnum('qc_status').notNull(),
    analytes: text('analytes').array().notNull(),
    points: jsonb('points').$type<StandardRowInput[]>().notNull(),
    analytesSummary: jsonb('analytes_summary').$type<Record<string, AnalyteCurveMetrics>>().notNull(),
    qcViolations: jsonb('qc_violations').$type<QCViolationRecord[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow(),

}, (table) => [
    index('calibrations_owner_created_idx').on(table.userId, table.createdAt),
    index('calibrations_owner_instrument_idx').on(table.userId, table.instrument),
    index('calibrations_owner_qc_status_idx').on(table.userId, table.qcStatus),
    unique('calibrations_id_user_uq').on(table.id, table.userId),
    check('calibrations_analyte_nonempty', sql`cardinality(${table.analytes}) >= 1`),
    check('calibrations_points_are_array', sql`jsonb_typeof(${table.points}) = 'array'`),
    check('calibrations_qc_profile_version_positive', sql`${table.qcProfileVersion} >= 1`),
    foreignKey({name: 'calibrations_qc_profile_version_fk', columns: [table.userId, table.qcProfileId, table.qcProfileVersion], foreignColumns: [qcCriteriaProfiles.ownerUserId, qcCriteriaProfiles.id, qcCriteriaProfiles.version]}).onDelete('restrict').onUpdate('restrict'),
])