import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Database } from '@valid-ex/db';
import { createAuthRoutes, type GoogleTokenPayload } from './routes/auth';

export type AppDeps = {
  db?: Database;
  jwtSecret?: string;
  verifyGoogleToken?: (idToken: string) => Promise<GoogleTokenPayload>;
};

export function createApp(deps: AppDeps = {}) {
  const app = new Hono().basePath('/api/v1');

  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok' }, 200));

  if (deps.db) {
    const jwtSecret = deps.jwtSecret ?? process.env.JWT_SECRET ?? 'dev-fallback-secret';
    app.route(
      '/auth',
      createAuthRoutes({
        db: deps.db,
        jwtSecret,
        verifyGoogleToken: deps.verifyGoogleToken,
      }),
    );
  }

  app.notFound((c) => c.json({ code: 'NOT_FOUND', message: 'Endpoint not found' }, 404));
  app.onError((err, c) => c.json({ code: 'INTERNAL_ERROR', message: err.message }, 500));

  return app;
}

export const app = createApp();