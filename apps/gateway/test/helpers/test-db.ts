import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@valid-ex/db';
import type { Database } from '@valid-ex/db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '../../../../packages/db/drizzle');

export async function createTestDb(): Promise<{ db: Database; client: PGlite }> {
  const client = new PGlite();
  const sql0 = readFileSync(resolve(MIGRATIONS_DIR, '0000_crazy_synch.sql'), 'utf8');
  const sql1 = readFileSync(resolve(MIGRATIONS_DIR, '0001_integrity_guards.sql'), 'utf8');

  for (const statement of sql0.split('--> statement-breakpoint')) {
    if (statement.trim()) {
      await client.exec(statement);
    }
  }
  for (const statement of sql1.split('--> statement-breakpoint')) {
    if (statement.trim()) {
      await client.exec(statement);
    }
  }

  const db = drizzle(client, { schema }) as unknown as Database;
  return { db, client };
}
