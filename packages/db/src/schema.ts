import { sql } from 'drizzle-orm';
import {
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { components } from '@valid-ex/contracts';

/** OpenAPI `UserProfile.authProvider`. */
export const authProviderEnum = pgEnum('auth_provider', ['local', 'google']);

/** OpenAPI `InstrumentType`. */
export const instrumentTypeEnum = pgEnum('instrument_type', [
  'ICP-MS',
  'ICP-OES',
  'AAS',
  'HPLC',
  'GC-MS',
]);

/** OpenAPI `InputMode`. */
export const inputModeEnum = pgEnum('input_mode', ['raw_signal', 'in_vial_concentration']);

/** OpenAPI `MetrologyUnits.solutionConcUnit`. */
export const solutionConcUnitEnum = pgEnum('solution_conc_unit', ['ppb', 'ppm', 'ppt']);

/** OpenAPI `QCStatus`. */
export const qcStatusEnum = pgEnum('qc_status', ['PASSED', 'INVALID_QC']);

type Schemas = components['schemas'];

export type MetrologyUnits = Schemas['MetrologyUnits'];
export type StandardRowInput = Schemas['StandardRowInput'];
export type SampleRowInput = Schemas['SampleRowInput'];
export type AnalyteCurveMetrics = Schemas['AnalyteCurveMetrics'];
export type EvaluatedSampleRow = Schemas['EvaluatedSampleRow'];
export type QCViolationRecord = Schemas['QCViolationRecord'];
export type QCCriteriaProfileDocument = Schemas['QCCriteriaProfile'];
export type AnalyteCriteriaMap = Schemas['QCCriteriaProfile']['analytes'];

/**
 * Option 1 auth schema (ADR-0002 / Invariant T5).
 * Local accounts cannot be stored without a password hash.
 * Google accounts cannot carry a password hash or omit `google_id`.
 * Email is stored lowercase so uniqueness cannot be bypassed by case.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    avatarUrl: text('avatar_url'),
    passwordHash: text('password_hash'),
    authProvider: authProviderEnum('auth_provider').notNull().default('local'),
    googleId: varchar('google_id', { length: 255 }).unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'check_password_for_local_auth',
      sql`(${table.authProvider} = 'local' AND ${table.passwordHash} IS NOT NULL) OR (${table.authProvider} != 'local')`,
    ),
    check(
      'check_provider_identity',
      sql`(
        (${table.authProvider} = 'local' AND ${table.passwordHash} IS NOT NULL AND ${table.googleId} IS NULL)
        OR
        (${table.authProvider} = 'google' AND ${table.passwordHash} IS NULL AND ${table.googleId} IS NOT NULL)
      )`,
    ),
    check('check_email_lowercase', sql`${table.email} = lower(${table.email})`),
  ],
);

/**
 * Governed QC criteria (ADR-0007). One row per immutable version.
 * `id` is the profile family; GET /qc-profiles/{id} reads the highest version.
 * Changing a threshold inserts a new version instead of updating this row.
 */
export const qcCriteriaProfiles = pgTable(
  'qc_criteria_profiles',
  {
    id: uuid('id').notNull(),
    version: integer('version').notNull(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    methodRef: text('method_ref').notNull(),
    effectiveDate: date('effective_date').notNull(),
    solutionConcUnit: solutionConcUnitEnum('solution_conc_unit'),
    linearityMinR: doublePrecision('linearity_min_r').notNull(),
    analytes: jsonb('analytes').$type<AnalyteCriteriaMap>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.version] }),
    unique('qc_profiles_owner_name_version_uq').on(table.ownerUserId, table.name, table.version),
    index('qc_profiles_owner_name_idx').on(table.ownerUserId, table.name),
    check('qc_profiles_version_positive', sql`${table.version} >= 1`),
  ],
);

/**
 * One analytical batch. Curve points and sample rows stay JSONB documents
 * (matrix payload, ADR-0006) so multi-analyte maps are not shredded into rows.
 * Numeric metrics inside those documents are JSON numbers (IEEE 754). The only
 * scalar metric column uses `double precision` (Invariant D5).
 */
export const calibrations = pgTable(
  'calibrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    title: varchar('title', { length: 500 }).notNull(),
    instrument: instrumentTypeEnum('instrument').notNull(),
    inputMode: inputModeEnum('input_mode').notNull(),
    units: jsonb('units').$type<MetrologyUnits>().notNull(),
    qcProfileId: uuid('qc_profile_id').notNull(),
    qcProfileVersion: integer('qc_profile_version').notNull(),
    qcProfileSnapshot: jsonb('qc_profile_snapshot').$type<QCCriteriaProfileDocument>().notNull(),
    qcStatus: qcStatusEnum('qc_status').notNull(),
    analytes: text('analytes').array().notNull(),
    points: jsonb('points').$type<StandardRowInput[]>().notNull(),
    samples: jsonb('samples').$type<SampleRowInput[]>().notNull(),
    analytesSummary: jsonb('analytes_summary').$type<Record<string, AnalyteCurveMetrics>>().notNull(),
    evaluatedSamples: jsonb('evaluated_samples').$type<EvaluatedSampleRow[]>().notNull(),
    qcViolations: jsonb('qc_violations')
      .$type<QCViolationRecord[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('calibrations_owner_created_idx').on(table.userId, table.createdAt),
    index('calibrations_owner_instrument_idx').on(table.userId, table.instrument),
    index('calibrations_owner_qc_status_idx').on(table.userId, table.qcStatus),
    foreignKey({
      name: 'calibrations_qc_profile_version_fk',
      columns: [table.qcProfileId, table.qcProfileVersion],
      foreignColumns: [qcCriteriaProfiles.id, qcCriteriaProfiles.version],
    })
      .onDelete('restrict')
      .onUpdate('restrict'),
    check('calibrations_analyte_nonempty', sql`cardinality(${table.analytes}) >= 1`),
    check(
      'calibrations_points_are_array',
      sql`jsonb_typeof(${table.points}) = 'array'`,
    ),
    check(
      'calibrations_sample_row_cap',
      sql`CASE WHEN jsonb_typeof(${table.samples}) = 'array' THEN jsonb_array_length(${table.samples}) <= 250 ELSE false END`,
    ),
    check('calibrations_qc_profile_version_positive', sql`${table.qcProfileVersion} >= 1`),
  ],
);

/**
 * Append-only event log. `entity_id` is not a foreign key: deleting a
 * calibration must leave the audit row in place (Invariant T6).
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
    action: varchar('action', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    index('audit_logs_user_created_idx').on(table.userId, table.createdAt),
  ],
);
