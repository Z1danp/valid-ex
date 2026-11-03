import { handle } from 'hono/vercel';
import { createDb } from '@valid-ex/db';
import { createApp } from '../src/app';

const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET ?? '';

const db = databaseUrl ? createDb(databaseUrl) : undefined;
const app = createApp({ db, jwtSecret });

export default handle(app);
