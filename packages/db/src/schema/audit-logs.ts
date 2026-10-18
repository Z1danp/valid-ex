import { pgTable, uuid, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";

import { users } from "./users";
import { sql } from "drizzle-orm";

export const auditLogs = pgTable('audit_logs', {
    id: uuid(`id`).defaultRandom().primaryKey(),
    userId: uuid(`user_id`).notNull().references(() => users.id, { onDelete: 'restrict', onUpdate: 'restrict'}),
    action: varchar(`action`, {length: 64}).notNull(),
    entityType: varchar(`entity_type`, {length: 64}).notNull(),
    entityId: uuid(`entity_id`).notNull(),
    payload: jsonb(`payload`).$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp(`created_at`, {withTimezone: true}).notNull().defaultNow()
}, (table) => [
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    index('audit_logs_user_created_idx').on(table.userId, table.createdAt)
])