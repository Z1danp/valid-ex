import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodSchema } from 'zod';

/**
 * Wraps `@hono/zod-validator` so validation failures always return our
 * OpenAPI `ErrorResponse` contract (`{ code: 'VALIDATION_ERROR', message, details }`)
 * with HTTP 400.
 */
export function validateContract<
  Target extends keyof ValidationTargets,
  Schema extends ZodSchema,
>(target: Target, schema: Schema) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const details = result.error.issues.map(
        (issue) => `${issue.path.join('.') || target}: ${issue.message}`,
      );
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Request is not valid against OpenAPI contract.',
          details,
        },
        400,
      );
    }
  });
}
