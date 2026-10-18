import { check, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import type { components } from "@valid-ex/contracts";
import { users } from "./users";
import { solutionConcUnitEnum } from "./enums";
import { sql } from "drizzle-orm";


export type AnalyteCriteriaMap = components['schemas']['QCCriteriaProfile']['analytes'];

export const qcCriteriaProfiles = pgTable('qc_criteria_profiles', {
    id: uuid('id').notNull(),
    version: integer('version').notNull(),
    ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, {onDelete: 'restrict', onUpdate: 'restrict'}),
    name: varchar('name', {length: 255}).notNull(),
    methodRef: text('method_ref').notNull(),
    effectiveDate: date('effective_date').notNull(),
    solutionConcUnit: solutionConcUnitEnum('solution_conc_unit'),
    linearityMinR: doublePrecision('linearity_min_r').notNull(),
    analytes: jsonb('analytes').$type<AnalyteCriteriaMap>().notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
}, (table) => [
    primaryKey({columns: [table.id, table.version]}),
    unique('qc_profile_owner_name_version_uq').on(table.ownerUserId, table.name, table.version),
    unique('qc_profile_owner_id_version_uq').on(table.ownerUserId, table.id, table.version),
    index('qc_profile_owner_name_idx').on(table.ownerUserId, table.name),
    check('qc_profiles_version_positive', sql`${table.version} > 0`)
])