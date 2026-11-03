import { serve } from '@hono/node-server';
import { createDb } from '@valid-ex/db';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

const db = databaseUrl ? createDb(databaseUrl) : undefined;
const app = createApp({ db, jwtSecret });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Valid-Ex Gateway listening on http://localhost:${info.port}/api/v1`);
});
