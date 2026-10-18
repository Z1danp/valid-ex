import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from 'ws';

import * as schema from './schema';

let webSocketConfigured = false;

function ensureWebSocketConstructor():void {
    if (webSocketConfigured) {return;}
    neonConfig.webSocketConstructor = ws;
    webSocketConfigured = true;
}

export function createDb(connectionString: string) {
    if (connectionString.trim() === '') {
        throw new Error('DATABASE_URL is empty');
    }
    ensureWebSocketConstructor();
    const pool = new Pool({connectionString});
    return drizzle(pool, {schema})
}

export type Database = ReturnType<typeof createDb>;
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];