import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';
export default defineConfig({
    schema: './src/schema',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/valid-ex',
    },
})