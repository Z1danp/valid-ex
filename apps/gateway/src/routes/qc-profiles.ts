import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { components } from '@valid-ex/contracts';
import { qcCriteriaProfiles, type Database } from '@valid-ex/db';
import { validateProfile, type QcCriteriaProfile } from '@valid-ex/math';
import { requireAuth, type AuthVariables } from '../middleware/auth';
import { validateContract } from '../middleware/validate';

export type QcProfileRouteDeps = {
  db: Database;
  jwtSecret: string;
};

const RecoveryBandSchema: z.ZodType<components['schemas']['RecoveryBand']> = z.object({
  maxConc: z.number().nullable(),
  minRecovery: z.number(),
  maxRecovery: z.number(),
});

const RpdBandSchema: z.ZodType<components['schemas']['RpdBand']> = z.object({
  maxConc: z.number().nullable(),
  maxRpd: z.number(),
});

const AnalyteCriteriaSchema: z.ZodType<components['schemas']['AnalyteCriteria']> = z.object({
  ccv: z.object({ bands: z.array(RecoveryBandSchema).min(1) }),
  spike: z.object({ bands: z.array(RecoveryBandSchema).min(1) }),
  duplicate: z.object({ bands: z.array(RpdBandSchema).min(1) }),
});

const QcProfileInputSchema: z.ZodType<components['schemas']['QCCriteriaProfileInput']> = z.object({
  name: z.string().trim().min(1),
  methodRef: z.string().trim().min(1),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  solutionConcUnit: z.enum(['ppb', 'ppm', 'ppt']).nullable().optional(),
  linearity: z.object({
    minR: z.number(),
  }),
  analytes: z.record(z.string(), AnalyteCriteriaSchema),
});

export function toQcProfileDto(
  row: typeof qcCriteriaProfiles.$inferSelect,
): components['schemas']['QCCriteriaProfile'] {
  return {
    id: row.id,
    name: row.name,
    methodRef: row.methodRef,
    version: row.version,
    effectiveDate: row.effectiveDate,
    solutionConcUnit: row.solutionConcUnit ?? null,
    linearity: { minR: row.linearityMinR },
    analytes: row.analytes,
  };
}

export function createQcProfileRoutes(deps: QcProfileRouteDeps) {
  const router = new Hono<{ Variables: AuthVariables }>();

  router.use('*', requireAuth(deps.jwtSecret));

  // 1. POST /qc-profiles (Buat profil baru atau versi baru bila nama sudah ada)
  router.post('/', validateContract('json', QcProfileInputSchema), async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');

    const existing = await deps.db.select().from(qcCriteriaProfiles).where(and(eq(qcCriteriaProfiles.ownerUserId, userId), eq(qcCriteriaProfiles.name, body.name))).orderBy(desc(qcCriteriaProfiles.version))
    const latest = existing[0]
    const profileId = latest?.id ?? randomUUID()
    const nextVersion = latest?.version ? latest.version + 1 : 1
    const candidateProfile: QcCriteriaProfile = {
      id: profileId,
      name: body.name,
      analytes: body.analytes,
      effectiveDate: body.effectiveDate,
      linearity: body.linearity,
      methodRef: body.methodRef,
      version: nextVersion,
      solutionConcUnit: body.solutionConcUnit
    }
    try {
      validateProfile(candidateProfile)
    } catch (err) {
      return c.json({ code: 'INVALID_QC_PROFILE', message: (err as Error).message }, 422)
    }
    const inserted = await deps.db.insert(qcCriteriaProfiles)
      .values({
        id: profileId,
        version: nextVersion,
        ownerUserId: userId,
        name: body.name,
        methodRef: body.methodRef,
        effectiveDate: body.effectiveDate,
        solutionConcUnit: body.solutionConcUnit,
        linearityMinR: body.linearity.minR,
        analytes: body.analytes
      })
      .returning()
    return c.json(toQcProfileDto(inserted[0]!), 201)
});

  // 2. GET /qc-profiles (Ambil daftar profil milik user, diurutkan versi terbaru)
  router.get('/', async (c) => {
    const userId = c.get('userId');
    const rows = await deps.db
      .select()
      .from(qcCriteriaProfiles)
      .where(eq(qcCriteriaProfiles.ownerUserId, userId))
      .orderBy(desc(qcCriteriaProfiles.createdAt), desc(qcCriteriaProfiles.version));

    const latestById = new Map<string, typeof qcCriteriaProfiles.$inferSelect>();
    for (const row of rows) {
      const prev = latestById.get(row.id);
      if (!prev || row.version > prev.version) {
        latestById.set(row.id, row);
      }
    }
    return c.json(Array.from(latestById.values()).map(toQcProfileDto), 200);
  });

  // 3. GET /qc-profiles/:id (Ambil versi terbaru dari satu profil QC)
  router.get('/:id', async (c) => {
    const userId = c.get('userId');
    const profileId = c.req.param('id');

    const rows = await deps.db.select()
      .from(qcCriteriaProfiles)
      .where(and(eq(qcCriteriaProfiles.ownerUserId, userId), eq(qcCriteriaProfiles.id, profileId))).orderBy(desc(qcCriteriaProfiles.version))

    if (!rows[0]) {
      return c.json({code: 'NOT_FOUND', message: 'QC Profile note found'}, 404)
    }
    
    return c.json(toQcProfileDto(rows[0]), 200);
  });

  return router;
}
