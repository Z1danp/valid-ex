import { sql } from "drizzle-orm";
import { authProviderEnum } from "./enums";
import { check, pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";


export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', {length: 255}).notNull().unique(),
    name: varchar('name', {length: 255}).notNull(),
    passwordHash: text('password_hash'),
    avatarUrl: text('avatar_url'),
    authProvider: authProviderEnum('auth_provider').notNull().default('local'),
    googleId: varchar('google_id', {length: 255}).unique(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow(),
}, (table) => [
    check('check_provider_identity', sql`
       (${table.authProvider} = 'local' AND ${table.passwordHash} IS NOT NULL AND ${table.googleId} IS NULL) OR
        (${table.authProvider} = 'google' AND ${table.googleId} IS NOT NULL AND ${table.passwordHash} IS NULL)`),
    check('check_email_lowercase', sql`LOWER(${table.email}) = ${table.email}`),
])