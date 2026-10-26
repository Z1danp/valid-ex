import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { Database } from '@valid-ex/db';
import { createApp } from '../src/app';
import { createTestDb } from './helpers/test-db';

const TEST_JWT_SECRET = 'test-super-secret-jwt-key-for-vitest';

describe('Stage 4B: Authentication & JWT Middleware (/api/v1/auth/*)', () => {
  let db: Database;
  let client: PGlite;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const setup = await createTestDb();
    db = setup.db;
    client = setup.client;
    app = createApp({
      db,
      jwtSecret: TEST_JWT_SECRET,
      verifyGoogleToken: async (idToken: string) => {
        if (idToken === 'valid-google-token-zidan') {
          return {
            googleId: 'google-uid-12345',
            email: 'GoogleUser@Lab.com',
            name: 'Zidan Google',
            avatarUrl: 'https://example.com/avatar.png',
          };
        }
        throw new Error('Invalid Google ID Token');
      },
    });
  });

  afterEach(async () => {
    await client.close();
  });

  it('POST /api/v1/auth/register creates a local user (lowercased email), hashes password, and returns 201 with JWT', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: '  Analis@Lab.com ',
        password: 'SuperSecurePassword123!',
        name: 'Zidan Analis',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      user: {
        id: expect.any(String),
        email: 'analis@lab.com',
        name: 'Zidan Analis',
        avatarUrl: null,
        authProvider: 'local',
        createdAt: expect.any(String),
      },
    });
    // Ensure passwordHash is NEVER leaked in response
    expect(body.user.passwordHash).toBeUndefined();
  });

  it('POST /api/v1/auth/register returns 409 Conflict when email is already registered (case-insensitive)', async () => {
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'analis@lab.com',
        password: 'SuperSecurePassword123!',
        name: 'Zidan 1',
      }),
    });

    const dupRes = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ANALIS@LAB.COM',
        password: 'AnotherPassword123!',
        name: 'Zidan 2',
      }),
    });

    expect(dupRes.status).toBe(409);
    const body = await dupRes.json();
    expect(body.code).toBe('EMAIL_EXISTS');
  });

  it('POST /api/v1/auth/register returns 400 VALIDATION_ERROR when password < 8 chars', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'analis@lab.com',
        password: 'short',
        name: 'Zidan',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/auth/login authenticates valid local user (200) and rejects wrong password (401)', async () => {
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'analis@lab.com',
        password: 'SuperSecurePassword123!',
        name: 'Zidan Analis',
      }),
    });

    const okRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'Analis@Lab.com',
        password: 'SuperSecurePassword123!',
      }),
    });
    expect(okRes.status).toBe(200);
    const okBody = await okRes.json();
    expect(okBody.accessToken).toEqual(expect.any(String));

    const badRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'analis@lab.com',
        password: 'WrongPassword999!',
      }),
    });
    expect(badRes.status).toBe(401);
  });

  it('POST /api/v1/auth/google signs in OAuth user (200) and blocks manual password login with 400 (Invariant T5)', async () => {
    const googleRes = await app.request('/api/v1/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'valid-google-token-zidan' }),
    });
    expect(googleRes.status).toBe(200);
    const googleBody = await googleRes.json();
    expect(googleBody.user.email).toBe('googleuser@lab.com');
    expect(googleBody.user.authProvider).toBe('google');

    // Now try logging in with password using that Google account's email -> MUST be 400 per openapi.yaml & Invariant T5
    const manualLoginRes = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'googleuser@lab.com',
        password: 'AnyPassword123!',
      }),
    });
    expect(manualLoginRes.status).toBe(400);
    const errBody = await manualLoginRes.json();
    expect(errBody.code).toBe('OAUTH_ACCOUNT_ONLY');
  });

  it('GET /api/v1/auth/me returns 200 UserProfile with valid Bearer token and 401 when missing/invalid', async () => {
    const regRes = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'analis@lab.com',
        password: 'SuperSecurePassword123!',
        name: 'Zidan Analis',
      }),
    });
    const { accessToken } = await regRes.json();

    const meRes = await app.request('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.email).toBe('analis@lab.com');
    expect(meBody.passwordHash).toBeUndefined();

    const unauthRes = await app.request('/api/v1/auth/me');
    expect(unauthRes.status).toBe(401);
  });
});
