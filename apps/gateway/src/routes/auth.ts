import { eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { sign } from 'hono/jwt';
import { z } from 'zod';
import type { components } from '@valid-ex/contracts';
import { users, type Database } from '@valid-ex/db';
import { hashPassword, verifyPassword } from '../lib/crypto';
import { AUTH_COOKIE_NAME, requireAuth, type AuthVariables } from '../middleware/auth';
import { validateContract } from '../middleware/validate';

export type GoogleTokenPayload = {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
};

export type AuthRouteDeps = {
  db: Database;
  jwtSecret: string;
  verifyGoogleToken?: (idToken: string) => Promise<GoogleTokenPayload>;
};

// ============================================================================
// Type-Anchored Zod Schemas (Opsi B: Dikunci ke @valid-ex/contracts)
// ============================================================================
const RegisterSchema: z.ZodType<components['schemas']['RegisterRequest']> = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  name: z.string().trim().min(2),
});

const LoginSchema: z.ZodType<components['schemas']['LoginRequest']> = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const GoogleAuthSchema: z.ZodType<components['schemas']['GoogleAuthRequest']> = z.object({
  idToken: z.string().min(1),
});

/**
 * Helper untuk memetakan row database `users` menjadi `UserProfile` OpenAPI
 * (Memastikan `passwordHash` TIDAK PERNAH bocor ke response JSON).
 */
function toUserProfile(row: typeof users.$inferSelect): components['schemas']['UserProfile'] {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl ?? null,
    authProvider: row.authProvider,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createAuthRoutes(deps: AuthRouteDeps) {
  const auth = new Hono<{ Variables: AuthVariables }>();

  async function issueToken(user: { id: string; email: string }): Promise<string> {
    const nowSec = Math.floor(Date.now() / 1000);
    return sign(
      {
        sub: user.id,
        email: user.email,
        iat: nowSec,
        exp: nowSec + 60 * 60 * 24, // 24 jam
      },
      deps.jwtSecret,
    );
  }

  function setAuthCookie(c: Context, token: string): void {
    setCookie(c, AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  }

  // 1. POST /register
  auth.post('/register', validateContract('json', RegisterSchema), async (c) => {
    const body = c.req.valid('json');
    const normalizedEmail = body.email.trim().toLowerCase();

    // TODO (Stage 4B Green - /register):
    // a) Cek apakah user dengan `normalizedEmail` sudah ada di `deps.db.select().from(users).where(eq(users.email, normalizedEmail))`
    //    Jika sudah ada -> return c.json({ code: 'EMAIL_EXISTS', message: 'Email sudah terdaftar.' }, 409)
    const existing = await deps.db.select().from(users).where(eq(users.email, normalizedEmail));
    if (existing.length > 0) {
      return c.json({code: 'EMAIL_EXISTS', message: "Email already exists"}, 409)
    } 
    // b) Hash password dengan `hashPassword(body.password)`
    const passwordHash = hashPassword(body.password)
    // c) Insert ke tabel `users` (`email: normalizedEmail`, `name: body.name`, `passwordHash`, `authProvider: 'local'`) menggunakan `.returning()`
    const insertedUser = await deps.db.insert(users).values({
      email: normalizedEmail,
      name: body.name,
      passwordHash: passwordHash,
      authProvider: 'local',
    }).returning()
    const user = insertedUser[0]
    // d) Buat JWT token dengan `await issueToken(insertedUser)`
    if (!user) {
      return c.json({code: 'INTERNAL_SERVER_ERROR', message: "Failed to insert user"}, 500)
    }
    const token = await issueToken(user)
    setAuthCookie(c, token)
    // e) Return 201 JSON: `{ accessToken, tokenType: 'Bearer', user: toUserProfile(insertedUser) }`
    return c.json({ user: toUserProfile(user) }, 201);
  });

  // 2. POST /login
  auth.post('/login', validateContract('json', LoginSchema), async (c) => {
    const body = c.req.valid('json');
    const normalizedEmail = body.email.trim().toLowerCase();

    // TODO (Stage 4B Green - /login):
    // a) Cari user berdasarkan `normalizedEmail`
    const userResult = await deps.db.select().from(users).where(eq(users.email, normalizedEmail));
    const user = userResult[0]
    // b) Jika user tidak ditemukan -> return c.json({ code: 'INVALID_CREDENTIALS', message: 'Email atau password salah.' }, 401)
    if (!user) {
      return c.json({ code: 'INVALID_CREDENTIALS', message: 'Wrong email or password.' }, 401)
    }
    // c) Invariant T5 Guard: Jika `user.authProvider !== 'local' || !user.passwordHash`
    if(user.authProvider !== 'local' || !user.passwordHash) {
      return c.json({ code: 'OAUTH_ACCOUNT_ONLY', message: 'This account is registered via Google OAuth.' }, 400)
    }
    //    -> return c.json({ code: 'OAUTH_ACCOUNT_ONLY', message: 'Akun ini terdaftar via Google OAuth.' }, 400)
    // d) Verifikasi password dengan `verifyPassword(body.password, user.passwordHash)`
    const isPasswordValid = verifyPassword(body.password, user.passwordHash)
    if (!isPasswordValid) {
      return c.json({ code: 'INVALID_CREDENTIALS', message: 'Wrong email or password.' }, 401)
    }
    //    Jika false -> return c.json({ code: 'INVALID_CREDENTIALS', message: 'Email atau password salah.' }, 401)
    // e) Buat JWT token dengan `await issueToken(user)` dan return 200 JSON `{ toUserProfile(user) }`
    const token = await issueToken(user)
    setAuthCookie(c, token)
    return c.json({ user: toUserProfile(user) }, 200);
  });

  // 3. POST /google
  auth.post('/google', validateContract('json', GoogleAuthSchema), async (c) => {
    const { idToken } = c.req.valid('json');
    if (!deps.verifyGoogleToken) {
      return c.json({ code: 'OAUTH_NOT_CONFIGURED', message: 'Google OAuth belum dikonfigurasi.' }, 401);
    }

    let googleProfile: GoogleTokenPayload;
    try {
      googleProfile = await deps.verifyGoogleToken(idToken);
    } catch {
      return c.json({ code: 'INVALID_GOOGLE_TOKEN', message: 'Token Google OAuth tidak valid.' }, 401);
    }

    const normalizedEmail = googleProfile.email.trim().toLowerCase();
    const existing = await deps.db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail));

    let user = existing[0];
    if (!user) {
      const inserted = await deps.db
        .insert(users)
        .values({
          email: normalizedEmail,
          name: googleProfile.name,
          avatarUrl: googleProfile.avatarUrl ?? null,
          authProvider: 'google',
          googleId: googleProfile.googleId,
          passwordHash: null,
        })
        .returning();
      user = inserted[0]!;
    } else if (user.authProvider !== 'google') {
      return c.json(
        { code: 'LOCAL_ACCOUNT_EXISTS', message: 'Email sudah terdaftar sebagai akun lokal.' },
        401,
      );
    }

    const accessToken = await issueToken(user);
    setAuthCookie(c, accessToken);
    return c.json(
      {
        user: toUserProfile(user),
      },
      200,
    );
  });

  // 4. POST /logout (ADR-0009: Hapus HttpOnly Cookie)
  auth.post('/logout', (c) => {
    deleteCookie(c, AUTH_COOKIE_NAME, { path: '/' });
    return c.body(null, 204);
  });

  // 5. GET /me (Protected by requireAuth middleware)
  auth.get('/me', requireAuth(deps.jwtSecret), async (c) => {
    // TODO (Stage 4B Green - /me):
    // a) Ambil `userId` dari context yang sudah diset oleh middleware: `const userId = c.get('userId')`
    const userId = c.get('userId') as string
    // b) Query user dari database `deps.db.select().from(users).where(eq(users.id, userId))`
    const userResult = await deps.db.select().from(users).where(eq(users.id, userId));
    const user = userResult[0]
    // c) Jika tidak ditemukan -> return 401 JSON `{ code: 'UNAUTHORIZED', message: 'Pengguna tidak ditemukan.' }`
    if (!user) {
      return c.json({ code: 'UNAUTHORIZED', message: 'User not found.' }, 401)
    }
    // d) Jika ditemukan -> return 200 JSON `toUserProfile(user)`
    return c.json(toUserProfile(user), 200);
  });

  return auth;
}
