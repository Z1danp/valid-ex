import ExcelJS from 'exceljs';
import type { calibrations, sampleRows } from '@valid-ex/db';
import type { MetrologyUnits } from '@valid-ex/db';

const CONC_FACTORS: Record<MetrologyUnits['solutionConcUnit'], number> = {
  ppm: 1,
  ppb: 1e-3,
  ppt: 1e-6,
};

const VOL_FACTORS: Record<MetrologyUnits['volumeUnit'], number> = {
  L: 1,
  mL: 1e-3,
};

const WEIGHT_FACTORS: Record<MetrologyUnits['weightUnit'], number> = {
  g: 1e-3,
  mg: 1e-6,
};

const RESULT_FACTORS: Record<MetrologyUnits['solidResultUnit'], number> = {
  'mg/kg': 1,
  'ug/kg': 1e3,
  percent: 1e-4,
};

/**
 * Menghitung faktor pengali konversi dimensi satuan (Invariant D3: Anti-Galat 1000x).
 * Contoh: ppb (1e-3) * mL (1e-3) / g (1e-3) * mg/kg (1) = 0.001 (yaitu /1000).
 */
export function computeUnitConversionFactor(units: MetrologyUnits): number {
  return (
    (CONC_FACTORS[units.solutionConcUnit] *
      VOL_FACTORS[units.volumeUnit] *
      RESULT_FACTORS[units.solidResultUnit]) /
    WEIGHT_FACTORS[units.weightUnit]
  );
}

/**
 * Anti-CWE-1236: Spreadsheet Formula Injection Guard (Invariant T1).
 *
 * TODO (Stage 4D Green - sanitizeExcelText):
 * Jika `value` tidak kosong dan karakter pertamanya (`value[0]`) adalah salah satu dari:
 * `'='`, `'+'`, `'-'`, `'@'`, `'\t'`, atau `'\r'`,
 * maka tambahkan tanda petik tunggal di AWAL string: `` `'${value}` ``.
 * Selain itu, kembalikan `value` apa adanya.
 */
  const prefix = new Set(['=', '+', '-', '\t', '\r', '@'])
export function sanitizeExcelText(value: string | null | undefined): string {
  if (!value) return '';
  // Tulis logika sanitasimu di sini:
  if (prefix.has(value[0]!)) {
    return `'${value}`
  } else return value;
}

export type SampleExportInput = {
  calibration: typeof calibrations.$inferSelect;
  targetSample: typeof sampleRows.$inferSelect;
  blankSample: typeof sampleRows.$inferSelect;
  parentSample?: typeof sampleRows.$inferSelect | null;
};

/**
 * Membangun Workbook Excel (.xlsx) in-memory (Invariant T1 & T2, ADR-0004 & ADR-0008)
 * menggunakan Kandidat Layout 1:
 * - Sheet 1: "Summary & QC" (Metadata batch, status OOS/QC, ringkasan lintas analit)
 * - Sheet per Analit: "Curve_<Analyte>" (Deret standar, rumus native SLOPE/INTERCEPT/STEYX,
 *   koreksi blanko, dan kuantifikasi 3-zona dengan rumus IF).
 */
export async function generateSampleAuditWorkbook(input: SampleExportInput): Promise<Buffer> {
  const { calibration, targetSample, blankSample, parentSample } = input;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Valid-Ex ISO/IEC 17025 Engine';
  workbook.created = new Date();

  const unitFactor = computeUnitConversionFactor(calibration.units);
  const statusBanner =
    calibration.qcStatus === 'PASSED'
      ? 'PASSED - COMPLIANT WITH QC PROFILE'
      : 'OOS / INVALID QC - FOR INVESTIGATION ONLY';

  // =========================================================================
  // SHEET 1: SUMMARY & QC
  // =========================================================================
  const summarySheet = workbook.addWorksheet('Summary & QC');
  summarySheet.addRow(['VALID-EX ISO/IEC 17025 AUDIT TRAIL REPORT']);
  summarySheet.addRow(['Batch Title', sanitizeExcelText(calibration.title)]);
  summarySheet.addRow(['Instrument', calibration.instrument]);
  summarySheet.addRow(['Input Mode', calibration.inputMode]);
  summarySheet.addRow([
    'QC Profile',
    `${sanitizeExcelText(calibration.qcProfileSnapshot.name)} (v${calibration.qcProfileVersion})`,
  ]);
  summarySheet.addRow(['Method Reference', sanitizeExcelText(calibration.qcProfileSnapshot.methodRef)]);
  summarySheet.addRow(['Regulatory QC Status', statusBanner]);
  summarySheet.addRow([]);

  // Tabel Ringkasan Hasil Sampel Target
  summarySheet.addRow([
    'Sample ID',
    'Lab Sample ID',
    'Sample Type',
    `Weight (${calibration.units.weightUnit})`,
    `Volume (${calibration.units.volumeUnit})`,
    'dF',
    ...calibration.analytes.map((a) => `${sanitizeExcelText(a)} (${calibration.units.solidResultUnit})`),
  ]);

  const targetRowNumberInCurve = parentSample ? 18 : 17;
  const targetResultCells = calibration.analytes.map((analyte) => {
    const sheetName = `Curve_${analyte}`;
    const res = targetSample.analyteResults[analyte];
    return {
      formula: `'${sheetName}'!J${targetRowNumberInCurve}`,
      result: res?.reportedValue ?? 'ND',
    };
  });

  summarySheet.addRow([
    sanitizeExcelText(targetSample.sampleId),
    sanitizeExcelText(targetSample.labSampleId ?? '-'),
    targetSample.sampleType,
    targetSample.weight,
    targetSample.volume,
    targetSample.df,
    ...targetResultCells,
  ]);

  // =========================================================================
  // SHEET PER ANALIT: Curve_<Analyte>
  // =========================================================================
  for (const analyte of calibration.analytes) {
    const sheet = workbook.addWorksheet(`Curve_${analyte}`);
    const metrics = calibration.analytesSummary[analyte]!;

    sheet.getCell('A1').value = `Analyte Calibration & Quantification: ${sanitizeExcelText(analyte)}`;
    sheet.getCell('A2').value = `Solution Unit: ${calibration.units.solutionConcUnit} | Solid Unit: ${calibration.units.solidResultUnit}`;

    // Header Deret Standar (Baris 4)
    sheet.getCell('A4').value = 'Standard Name';
    sheet.getCell('B4').value = `Nominal Conc (${calibration.units.solutionConcUnit})`;
    sheet.getCell('C4').value = `Signal (${calibration.units.signalUnit})`;

    const stdStartRow = 5;
    calibration.points.forEach((pt, idx) => {
      const r = stdStartRow + idx;
      const reading = pt.readings[analyte];
      sheet.getCell(`A${r}`).value = sanitizeExcelText(pt.standardName);
      sheet.getCell(`B${r}`).value = reading?.nominalConc ?? 0;
      sheet.getCell(`C${r}`).value = reading?.signal ?? 0;
    });
    const stdEndRow = stdStartRow + calibration.points.length - 1;
    const xRange = `B${stdStartRow}:B${stdEndRow}`;
    const yRange = `C${stdStartRow}:C${stdEndRow}`;

    // Tabel Parameter Regresi OLS (Kolom E & F, Baris 5..12)
    sheet.getCell('E4').value = 'Regression Parameter';
    sheet.getCell('F4').value = 'Live Formula Value';

    sheet.getCell('E5').value = 'Slope (m)';
    sheet.getCell('F5').value = { formula: `SLOPE(${yRange},${xRange})`, result: metrics.slope };

    sheet.getCell('E6').value = 'Intercept (c)';
    sheet.getCell('F6').value = { formula: `INTERCEPT(${yRange},${xRange})`, result: metrics.intercept };

    sheet.getCell('E7').value = 'Correlation (r)';
    sheet.getCell('F7').value = { formula: `CORREL(${yRange},${xRange})`, result: metrics.r };

    sheet.getCell('E8').value = 'R-Squared (R²)';
    sheet.getCell('F8').value = { formula: `RSQ(${yRange},${xRange})`, result: metrics.rSquared };

    sheet.getCell('E9').value = 'Residual sy/x';
    sheet.getCell('F9').value = { formula: `STEYX(${yRange},${xRange})`, result: metrics.syx };

    sheet.getCell('E10').value = `LOD Instrument (${calibration.units.solutionConcUnit})`;
    sheet.getCell('F10').value = { formula: '3*F9/F5', result: metrics.lodInstrument };

    sheet.getCell('E11').value = `LOQ Instrument (${calibration.units.solutionConcUnit})`;
    sheet.getCell('F11').value = { formula: '10*F9/F5', result: metrics.loqInstrument };

    sheet.getCell('E12').value = 'Unit Conversion Factor';
    sheet.getCell('F12').value = unitFactor;

    // Header Evaluasi Sampel (Baris 15)
    const headerRow = 15;
    const headers = [
      'Sample ID',
      `Weight (${calibration.units.weightUnit})`,
      `Volume (${calibration.units.volumeUnit})`,
      'dF',
      `Instrument Reading (${calibration.inputMode === 'raw_signal' ? calibration.units.signalUnit : calibration.units.solutionConcUnit})`,
      `C_raw (${calibration.units.solutionConcUnit})`,
      `C_net (${calibration.units.solutionConcUnit})`,
      `LOQ Method (${calibration.units.solidResultUnit})`,
      `Conc Solid (${calibration.units.solidResultUnit})`,
      'Reported Result',
    ];
    headers.forEach((h, i) => {
      sheet.getRow(headerRow).getCell(i + 1).value = h;
    });

    const sampleSequence: (typeof sampleRows.$inferSelect)[] = [blankSample];
    if (parentSample) {
      sampleSequence.push(parentSample);
    }
    sampleSequence.push(targetSample);

    const blankRowNum = 16;
    sampleSequence.forEach((sRow, idx) => {
      const r = 16 + idx;
      const readingVal = sRow.readings[analyte] ?? 0;
      const evalRes = sRow.analyteResults[analyte]!;

      sheet.getCell(`A${r}`).value = sanitizeExcelText(sRow.sampleId);
      sheet.getCell(`B${r}`).value = sRow.weight;
      sheet.getCell(`C${r}`).value = sRow.volume;
      sheet.getCell(`D${r}`).value = sRow.df;
      sheet.getCell(`E${r}`).value = readingVal;

      // F: C_raw
      const cRawFormula =
        calibration.inputMode === 'raw_signal' ? `(E${r}-$F$6)/$F$5` : `E${r}`;
      sheet.getCell(`F${r}`).value = { formula: cRawFormula, result: evalRes.cRaw };

      // G: C_net = C_raw - C_blank
      sheet.getCell(`G${r}`).value = {
        formula: `F${r}-$F$${blankRowNum}`,
        result: evalRes.cNet,
      };

      // H: LOQ Method = (LOQ_inst * V * dF * unitFactor) / W
      sheet.getCell(`H${r}`).value = {
        formula: `($F$11*C${r}*D${r}*$F$12)/B${r}`,
        result: evalRes.loqMethod,
      };

      // I: Conc Solid
      sheet.getCell(`I${r}`).value = {
        formula: `IF(G${r}>=$F$11,(G${r}*C${r}*D${r}*$F$12)/B${r},"")`,
        result: evalRes.concSolid ?? '',
      };

      // J: Reported Result (3-Zone Gating Invariant D3)
      sheet.getCell(`J${r}`).value = {
        formula: `IF(OR(G${r}<=0,G${r}<$F$10),"ND",IF(G${r}<$F$11,"< "&ROUND(H${r},4)&" ${calibration.units.solidResultUnit}",ROUND(I${r},3)&" ${calibration.units.solidResultUnit}"))`,
        result: evalRes.reportedValue,
      };
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
