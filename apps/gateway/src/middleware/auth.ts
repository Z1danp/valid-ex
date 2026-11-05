import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';

export const AUTH_COOKIE_NAME = 'valid_ex_token';

export type AuthVariables = {
  userId: string;
  userEmail: string;
};


export function requireAuth(jwtSecret: string) {
  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {

    const token = getCookie(c, AUTH_COOKIE_NAME);
    if (!token) {
      return c.json({ code: 'UNAUTHORIZED', message: 'Authentication token not found'}, 401);
    }
    try {
      const payload = await verify(token, jwtSecret, 'HS256');
      
      if (typeof payload.sub !== 'string') {
        return c.json({ code: 'UNAUTHORIZED', message: 'Invalid token'}, 401);
      }

      c.set('userId', String(payload.sub))
      c.set('userEmail', String(payload.email ?? ''))
      await next();
    } catch (error) {
      return c.json({ code: 'UNAUTHORIZED', message: 'Invalid token or expired'}, 401);
    }
  };
}
