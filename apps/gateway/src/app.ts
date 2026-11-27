import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Database } from '@valid-ex/db';
import { createAuthRoutes, type GoogleTokenPayload } from './routes/auth';
import { createCalibrationRoutes } from './routes/calibrations';
import { createQcProfileRoutes } from './routes/qc-profiles';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { swaggerUI } from '@hono/swagger-ui';

export type AppDeps = {
  db?: Database;
  jwtSecret?: string;
  verifyGoogleToken?: (idToken: string) => Promise<GoogleTokenPayload>;
};

const require = createRequire(import.meta.url);
const openApiSpec = readFileSync(require.resolve('@valid-ex/contracts/openapi.yaml'), 'utf-8');

export function createApp(deps: AppDeps = {}) {
  const app = new Hono().basePath('/api/v1');

  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok' }, 200));

  app.get('/openapi.yaml', (c) => {
    return c.text(openApiSpec, 200, {
      'Content-Type': 'application/yaml;charset=utf-8',
    })
  })

  app.get('/docs', swaggerUI({url: '/api/v1/openapi.yaml'}))

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
    app.route(
      '/qc-profiles',
      createQcProfileRoutes({
        db: deps.db,
        jwtSecret,
      }),
    );
    app.route(
      '/calibrations',
      createCalibrationRoutes({
        db: deps.db,
        jwtSecret,
      }),
    );
  }

  app.notFound((c) => c.json({ code: 'NOT_FOUND', message: 'Endpoint not found' }, 404));
  app.onError((err, c) => c.json({ code: 'INTERNAL_ERROR', message: err.message }, 500));

  return app;
}

export const app = createApp();
