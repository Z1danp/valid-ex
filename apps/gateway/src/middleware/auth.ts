import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';

export type AuthVariables = {
  userId: string;
  userEmail: string;
};


export function requireAuth(jwtSecret: string) {
  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    // get auth header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer')) {
      return c.json({ code: 'UNAUTHORIZE', message: 'Authentication token not found'}, 401);
    }

    // get token from auth header
    const token = authHeader.slice(7);
    try {
      // get payload from token
      const payload = await verify(token, jwtSecret, 'HS256');
      if (typeof payload.sub !== 'string') {
        return c.json({ code: 'UNAUTHORIZED', message: 'Invalid token'}, 401);
      }
      // set user id and email to context
      c.set('userId', String(payload.sub))
      c.set('userEmail', String(payload.email ?? ''))
      // forward request to next routes
      await next();
    } catch (error) {
      // if error, return 401
      return c.json({ code: 'UNAUTHORIZED', message: 'Invalid token or expired'}, 401);
    }
  };
}
