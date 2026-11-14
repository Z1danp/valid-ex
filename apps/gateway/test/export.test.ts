import ExcelJS from 'exceljs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import type { Database } from '@valid-ex/db';
import { createApp } from '../src/app';
import { sanitizeExcelText } from '../src/lib/excel';
import { createTestDb } from './helpers/test-db';

const TEST_JWT_SECRET = 'test-super-secret-jwt-key-for-vitest';

function extractCookiePair(setCookieHeader: string | null): string {
  if (!setCookieHeader) return '';
  return setCookieHeader.split(';')[0] ?? '';
}

const VALID_QC_PROFILE_INPUT = {
  name: 'SOP Lab ICP-OES Logam Berat',
  methodRef: 'SOP-LAB-01 Rev.1 (EURACHEM)',
  effectiveDate: '2026-10-01',
  solutionConcUnit: 'ppb',
  linearity: { minR: 0.995 },
  analytes: {
    Pb: {
      ccv: { bands: [{ maxConc: null, minRecovery: 90, maxRecovery: 110 }] },
      spike: { bands: [{ maxConc: null, minRecovery: 60, maxRecovery: 115 }] },
      duplicate: { bands: [{ maxConc: null, maxRpd: 25 }] },
    },
    Cd: {
      ccv: { bands: [{ maxConc: null, minRecovery: 90, maxRecovery: 110 }] },
      spike: { bands: [{ maxConc: null, minRecovery: 60, maxRecovery: 115 }] },
      duplicate: { bands: [{ maxConc: null, maxRpd: 25 }] },
    },
  },
};

describe('Stage 4D: Server-Side Excel Generator & Anti-CWE-1236', () => {
  let db: Database;
  let client: PGlite;
  let app: ReturnType<typeof createApp>;
  let authCookie: string;

  beforeEach(async () => {
    const setup = await createTestDb();
    db = setup.db;
    client = setup.client;
    app = createApp({ db, jwtSecret: TEST_JWT_SECRET });

    const regRes = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'analis@lab.com',
        password: 'SuperSecurePassword123!',
        name: 'Zidan Analis',
      }),
    });
    authCookie = extractCookiePair(regRes.headers.get('set-cookie'));
  });

  afterEach(async () => {
    await client.close();
  });

  it('sanitizeExcelText prefixes formula-triggering characters (=, +, -, @) with a single quote (Anti-CWE-1236)', () => {
    expect(sanitizeExcelText("=CMD|'/C calc'!A0")).toBe("'=CMD|'/C calc'!A0");
    expect(sanitizeExcelText('+SUM(A1:A10)')).toBe("'+SUM(A1:A10)");
    expect(sanitizeExcelText('-10+20')).toBe("'-10+20");
    expect(sanitizeExcelText('@HYPERLINK("http://evil.com")')).toBe(
      '\'@HYPERLINK("http://evil.com")',
    );
    expect(sanitizeExcelText('Sample Normal 101')).toBe('Sample Normal 101');
  });

  it('GET /api/v1/calibrations/:id/samples/:sampleRowId/export generates a valid .xlsx with live native formulas and isolated sample rows', async () => {
    const profRes = await app.request('/api/v1/qc-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify(VALID_QC_PROFILE_INPUT),
    });
    const profile = await profRes.json();

    const calRes = await app.request('/api/v1/calibrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: authCookie },
      body: JSON.stringify({
        title: '=Batch Injeksi Berbahaya',
        instrument: 'ICP-OES',
        inputMode: 'raw_signal',
        units: {
          solutionConcUnit: 'ppb',
          solidResultUnit: 'mg/kg',
          weightUnit: 'g',
          volumeUnit: 'mL',
          signalUnit: 'cps',
        },
        qcProfileId: profile.id,
        analytes: ['Pb', 'Cd'],
        standards: [
          {
            standardName: 'Blank',
            readings: { Pb: { nominalConc: 0, signal: 10 }, Cd: { nominalConc: 0, signal: 5 } },
          },
          {
            standardName: 'Std 1',
            readings: {
              Pb: { nominalConc: 1, signal: 1010 },
              Cd: { nominalConc: 0.5, signal: 505 },
            },
          },
          {
            standardName: 'Std 2',
            readings: {
              Pb: { nominalConc: 2, signal: 2010 },
              Cd: { nominalConc: 1.0, signal: 1005 },
            },
          },
          {
            standardName: 'Std 3',
            readings: {
              Pb: { nominalConc: 5, signal: 5010 },
              Cd: { nominalConc: 2.5, signal: 2505 },
            },
          },
          {
            standardName: 'Std 4',
            readings: {
              Pb: { nominalConc: 10, signal: 10010 },
              Cd: { nominalConc: 5.0, signal: 5005 },
            },
          },
          {
            standardName: 'Std 5',
            readings: {
              Pb: { nominalConc: 20, signal: 20010 },
              Cd: { nominalConc: 10.0, signal: 10005 },
            },
          },
        ],
        samples: [
          {
            sampleId: 'Blank Mars',
            sampleType: 'blank_method',
            weight: 0.5,
            volume: 50,
            df: 1,
            readings: { Pb: 20, Cd: 10 },
          },
          {
            sampleId: '=S-101-Target',
            labSampleId: '291843',
            sampleType: 'sample',
            weight: 0.5,
            volume: 50,
            df: 1,
            readings: { Pb: 5020, Cd: 2010 },
          },
          {
            sampleId: 'S-102-OtherSample',
            sampleType: 'sample',
            weight: 0.5,
            volume: 50,
            df: 1,
            readings: { Pb: 9020, Cd: 3010 },
          },
        ],
      }),
    });

    expect(calRes.status).toBe(201);
    const batch = await calRes.json();
    const targetSampleRow = batch.evaluatedSamples.find(
      (s: { sampleId: string }) => s.sampleId === '=S-101-Target',
    );

    const exportRes = await app.request(
      `/api/v1/calibrations/${batch.id}/samples/${targetSampleRow.id}/export`,
      {
        headers: { Cookie: authCookie },
      },
    );

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-type')).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(exportRes.headers.get('content-disposition')).toContain('attachment; filename=');

    const arrayBuffer = await exportRes.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    // 1. Verify Kandidat Layout 1 Worksheets exist
    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    expect(sheetNames).toEqual(['Summary & QC', 'Curve_Pb', 'Curve_Cd']);

    // 2. Verify Anti-CWE-1236 on Summary sheet
    const summarySheet = workbook.getWorksheet('Summary & QC')!;
    expect(summarySheet.getCell('B2').value).toBe("'=Batch Injeksi Berbahaya");

    // 3. Verify Live Native Formulas on Curve_Pb (Invariant T1)
    const pbSheet = workbook.getWorksheet('Curve_Pb')!;
    const slopeCell = pbSheet.getCell('F5').value as ExcelJS.CellFormulaValue;
    const steyxCell = pbSheet.getCell('F9').value as ExcelJS.CellFormulaValue;
    expect(slopeCell.formula).toBe('SLOPE(C5:C10,B5:B10)');
    expect(steyxCell.formula).toBe('STEYX(C5:C10,B5:B10)');

    // 4. Verify ADR-0008 Sample Isolation: row 16 is Blank Mars, row 17 is '=S-101-Target, row 18 is empty (S-102-OtherSample NOT included)
    expect(pbSheet.getCell('A16').value).toBe('Blank Mars');
    expect(pbSheet.getCell('A17').value).toBe("'=S-101-Target");
    expect(pbSheet.getCell('A18').value).toBeNull();

    const cNetCell = pbSheet.getCell('G17').value as ExcelJS.CellFormulaValue;
    expect(cNetCell.formula).toBe('F17-$F$16');
  });
});
