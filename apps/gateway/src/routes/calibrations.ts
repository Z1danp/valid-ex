import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { components } from '@valid-ex/contracts';
import {
  calibrations,
  deleteCalibration,
  persistCalibrationBatch,
  qcCriteriaProfiles,
  sampleRows,
  type Database,
} from '@valid-ex/db';
import { evaluateCalibration } from '@valid-ex/math';
import { requireAuth, type AuthVariables } from '../middleware/auth';
import { validateContract } from '../middleware/validate';
import { toQcProfileDto } from './qc-profiles';

export type CalibrationRouteDeps = {
  db: Database;
  jwtSecret: string;
};

// ============================================================================
// Type-Anchored Zod Schemas (Opsi B: Dikunci ke @valid-ex/contracts)
// ============================================================================
const MetrologyUnitsSchema: z.ZodType<components['schemas']['MetrologyUnits']> = z.object({
  solutionConcUnit: z.enum(['ppb', 'ppm', 'ppt']),
  solidResultUnit: z.enum(['mg/kg', 'ug/kg', 'percent']),
  weightUnit: z.enum(['g', 'mg']),
  volumeUnit: z.enum(['mL', 'L']),
  signalUnit: z.enum(['cps', 'intensity', 'peak_area']),
});

const StandardPointReadingSchema: z.ZodType<components['schemas']['StandardPointReading']> =
  z.object({
    nominalConc: z.number(),
    signal: z.number(),
  });

const StandardRowInputSchema: z.ZodType<components['schemas']['StandardRowInput']> = z.object({
  standardName: z.string().min(1),
  readings: z.record(z.string(), StandardPointReadingSchema),
});

const SampleRowInputSchema: z.ZodType<components['schemas']['SampleRowInput']> = z.object({
  sampleId: z.string().min(1),
  labSampleId: z.string().nullable().optional(),
  sampleType: z.enum(['sample', 'blank_method', 'ccv', 'spike', 'duplicate']),
  parentSampleId: z.string().nullable().optional(),
  spikeAdded: z.record(z.string(), z.number()).nullable().optional(),
  expectedConc: z.record(z.string(), z.number()).nullable().optional(),
  weight: z.number().positive(),
  volume: z.number().positive(),
  df: z.number().positive(),
  readings: z.record(z.string(), z.number()),
});

const CalibrationBatchRequestSchema: z.ZodType<components['schemas']['CalibrationBatchRequest']> =
  z.object({
    title: z.string().trim().min(1),
    instrument: z.enum(['ICP-MS', 'ICP-OES', 'AAS', 'HPLC', 'GC-MS']),
    inputMode: z.enum(['raw_signal', 'in_vial_concentration']),
    units: MetrologyUnitsSchema,
    qcProfileId: z.string().uuid(),
    analytes: z.array(z.string().min(1)).min(1),
    standards: z.array(StandardRowInputSchema).min(4),
    samples: z.array(SampleRowInputSchema).max(250),
  });

/**
 * Helper untuk merakit response `CalibrationBatchResponse` dari row database
 * `calibrations` dan `sample_rows`.
 */
export function toCalibrationBatchResponse(
  cal: typeof calibrations.$inferSelect,
  rows: (typeof sampleRows.$inferSelect)[],
): components['schemas']['CalibrationBatchResponse'] {
  return {
    id: cal.id,
    title: cal.title,
    instrument: cal.instrument,
    inputMode: cal.inputMode,
    units: cal.units,
    qcProfileRef: {
      id: cal.qcProfileId,
      version: cal.qcProfileVersion,
    },
    qcProfileSnapshot: cal.qcProfileSnapshot,
    qcStatus: cal.qcStatus,
    qcViolations: cal.qcViolations,
    analytesSummary: cal.analytesSummary,
    evaluatedSamples: rows.map((r) => ({
      id: r.id,
      sampleId: r.sampleId,
      labSampleId: r.labSampleId ?? null,
      sampleType: r.sampleType,
      parentSampleId: r.parentSampleId ?? null,
      weight: r.weight,
      volume: r.volume,
      df: r.df,
      analytes: r.analyteResults,
    })),
    createdAt: cal.createdAt.toISOString(),
    updatedAt: cal.updatedAt.toISOString(),
  };
}

export function createCalibrationRoutes(deps: CalibrationRouteDeps) {
  const router = new Hono<{ Variables: AuthVariables }>();

  router.use('*', requireAuth(deps.jwtSecret));

  // 1. POST /calibrations — Validasi Metrologi + Simpan Transaksi ACID
  router.post('/', validateContract('json', CalibrationBatchRequestSchema), async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');

    // a) Ambil versi terbaru profil QC milik user berdasarkan `body.qcProfileId`
    const profileRows = await deps.db
      .select()
      .from(qcCriteriaProfiles)
      .where(
        and(
          eq(qcCriteriaProfiles.ownerUserId, userId),
          eq(qcCriteriaProfiles.id, body.qcProfileId),
        ),
      )
      .orderBy(desc(qcCriteriaProfiles.version));

    const profileRow = profileRows[0];
    if (!profileRow) {
      return c.json({ code: 'QC_PROFILE_NOT_FOUND', message: 'QC Profile not found' }, 404);
    }
    const qcProfile = toQcProfileDto(profileRow);

    // TODO (Stage 4C Green - POST /calibrations):
    // b) Jalankan `evaluateCalibration({ inputMode: body.inputMode, units: body.units, analytes: body.analytes, standards: body.standards, samples: body.samples, qcProfile })`
    //    di dalam blok `try { ... } catch (err) { ... }`.
    //    Jika `evaluateCalibration` melempar error -> return 422 JSON `{ code: 'METROLOGY_ERROR', message: (err as Error).message }`
    // c) Petakan `body.samples` + `evaluated.evaluatedSamples` menjadi `sampleRows` untuk `persistCalibrationBatch`:
    //    ```ts
    //    const sampleRowInputs = body.samples.map((rawSample, idx) => ({
    //      sampleId: rawSample.sampleId,
    //      labSampleId: rawSample.labSampleId ?? null,
    //      sampleType: rawSample.sampleType,
    //      parentSampleId: rawSample.parentSampleId ?? null,
    //      weight: rawSample.weight,
    //      volume: rawSample.volume,
    //      df: rawSample.df,
    //      spikeAdded: rawSample.spikeAdded ?? null,
    //      expectedConc: rawSample.expectedConc ?? null,
    //      readings: rawSample.readings,
    //      analyteResults: evaluated.evaluatedSamples[idx]!.analytes,
    //    }));
    //    ```
    // d) Panggil transaksi ACID `const persisted = await persistCalibrationBatch(deps.db, { ... })`
    // e) Query kembali row `calibrations` dan `sampleRows` yang baru disimpan, lalu return 201 JSON `toCalibrationBatchResponse(calRow, savedSampleRows)`
    return c.json({ code: 'NOT_IMPLEMENTED', message: 'TODO' }, 501);
  });

  // 2. GET /calibrations — Daftar riwayat batch kalibrasi milik user
  router.get('/', async (c) => {
    const userId = c.get('userId');
    const page = Math.max(1, Number(c.req.query('page') ?? 1));
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 20)));

    const allRows = await deps.db
      .select()
      .from(calibrations)
      .where(eq(calibrations.userId, userId))
      .orderBy(desc(calibrations.createdAt));

    const totalItems = allRows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const offset = (page - 1) * limit;
    const paged = allRows.slice(offset, offset + limit);

    return c.json(
      {
        data: paged.map((row) => ({
          id: row.id,
          title: row.title,
          instrument: row.instrument,
          qcStatus: row.qcStatus,
          createdAt: row.createdAt.toISOString(),
        })),
        meta: {
          page,
          limit,
          totalItems,
          totalPages,
        },
      },
      200,
    );
  });

  // 3. GET /calibrations/:id — Detail lengkap 1 batch + sample_rows
  router.get('/:id', async (c) => {
    const userId = c.get('userId');
    const calibrationId = c.req.param('id');

    const calRows = await deps.db
      .select()
      .from(calibrations)
      .where(and(eq(calibrations.id, calibrationId), eq(calibrations.userId, userId)));

    const cal = calRows[0];
    if (!cal) {
      return c.json({ code: 'NOT_FOUND', message: 'Calibration batch not found' }, 404);
    }

    const rows = await deps.db
      .select()
      .from(sampleRows)
      .where(eq(sampleRows.calibrationId, cal.id));

    return c.json(toCalibrationBatchResponse(cal, rows), 200);
  });

  // 4. DELETE /calibrations/:id — Hapus batch secara ACID + catat audit log
  router.delete('/:id', async (c) => {
    const userId = c.get('userId');
    const calibrationId = c.req.param('id');

    // TODO (Stage 4C Green - DELETE /calibrations/:id):
    // Panggil `await deleteCalibration(deps.db, { calibrationId, userId })` di dalam `try { ... } catch { ... }`.
    // - Jika berhasil -> return `c.body(null, 204)`
    // - Jika melempar error ('Calibration not found') -> return 404 JSON `{ code: 'NOT_FOUND', message: 'Calibration batch not found' }`
    return c.json({ code: 'NOT_IMPLEMENTED', message: 'TODO' }, 501);
  });

  return router;
}
