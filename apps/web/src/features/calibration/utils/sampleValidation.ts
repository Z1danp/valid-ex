import type { components } from '@valid-ex/contracts';

export type SampleType = components['schemas']['SampleType'];
export type SampleRowInput = components['schemas']['SampleRowInput'];

export interface SampleRowState {
  id: string;
  labSampleId?: string;
  type: SampleType;
  parent?: string;
  weight: number | null;
  vol: number | null;
  df: number | null;
  expectedConc?: Record<string, number>;
  spikeAdded?: Record<string, number>;
  readings: Record<string, number>;
}

export interface SampleValidationIssue {
  scope: 'batch' | 'sample' | 'qc';
  sampleId?: string;
  message: string;
}

export const MAX_BATCH_SAMPLE_ROWS = 250;

export const ROUTINE_SAMPLE_TYPES = ['sample'] as const satisfies readonly SampleType[];

export const QC_SAMPLE_TYPES = [
  'blank_method',
  'ccv',
  'spike',
  'duplicate',
] as const satisfies readonly SampleType[];

export const ALL_SAMPLE_TYPES = [
  'sample',
  'blank_method',
  'ccv',
  'spike',
  'duplicate',
] as const satisfies readonly SampleType[];

export const SAMPLE_TYPE_META: Record<
  SampleType,
  {
    label: string;
    description: string;
    tone: 'emerald' | 'slate' | 'amber' | 'blue' | 'purple';
  }
> = {
  sample: {
    label: 'sample',
    description: 'Routine laboratory test sample',
    tone: 'emerald',
  },
  blank_method: {
    label: 'blank_method',
    description: 'Acid digestion method blank (C_blank)',
    tone: 'slate',
  },
  ccv: {
    label: 'ccv',
    description: 'Continuing Calibration Verification',
    tone: 'amber',
  },
  spike: {
    label: 'spike',
    description: 'Matrix spike (requires Parent and Spike Added)',
    tone: 'blue',
  },
  duplicate: {
    label: 'duplicate',
    description: 'Duplicate sample (requires Parent)',
    tone: 'purple',
  },
};

export function isParentAllowed(type: SampleType): boolean {
  return type === 'spike' || type === 'duplicate';
}

export function isPrepParamsRequired(type: SampleType): boolean {
  return type === 'sample' || type === 'spike' || type === 'duplicate';
}

export function parseSampleTypeFromSet(
  raw: string,
  allowed: readonly SampleType[],
  fallback: SampleType,
): SampleType {
  const normalized = raw.trim().toLowerCase() as SampleType;
  return allowed.includes(normalized) ? normalized : fallback;
}

export function sanitizeSampleRow(row: SampleRowState): SampleRowState {
  const needsPrep = isPrepParamsRequired(row.type);
  return {
    ...row,
    parent: isParentAllowed(row.type) ? (row.parent ?? '') : '',
    weight: needsPrep
      ? row.weight !== null && Number.isFinite(row.weight) && row.weight > 0
        ? row.weight
        : 0.2
      : null,
    vol: needsPrep
      ? row.vol !== null && Number.isFinite(row.vol) && row.vol > 0
        ? row.vol
        : 50
      : null,
    df: needsPrep ? (row.df !== null && Number.isFinite(row.df) && row.df > 0 ? row.df : 1) : null,
    expectedConc: row.type === 'ccv' ? row.expectedConc : undefined,
    spikeAdded: row.type === 'spike' ? row.spikeAdded : undefined,
  };
}

export function getAvailableParentOptions(sampleRows: readonly SampleRowState[]): string[] {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const row of sampleRows) {
    if (row.type !== 'sample') continue;
    const cleanId = row.id.trim();
    if (!cleanId || seen.has(cleanId)) continue;
    seen.add(cleanId);
    options.push(cleanId);
  }

  return options;
}

/**
 * Keeps QC parent links intact when an analyst renames a single routine sample ID in place.
 */
export function syncParentReferencesOnSampleRename(
  qcRows: readonly SampleRowState[],
  prevSamples: readonly SampleRowState[],
  nextSamples: readonly SampleRowState[],
): SampleRowState[] {
  if (prevSamples.length !== nextSamples.length) {
    return [...qcRows];
  }

  const renameMap = new Map<string, string>();
  const prevCounts = new Map<string, number>();

  for (const row of prevSamples) {
    const id = row.id.trim();
    if (id) prevCounts.set(id, (prevCounts.get(id) ?? 0) + 1);
  }

  for (let i = 0; i < prevSamples.length; i++) {
    const prevRow = prevSamples[i];
    const nextRow = nextSamples[i];
    if (!prevRow || !nextRow) continue;
    if (prevRow.type !== 'sample' || nextRow.type !== 'sample') continue;

    const oldId = prevRow.id.trim();
    const newId = nextRow.id.trim();
    if (oldId && newId && oldId !== newId && prevCounts.get(oldId) === 1) {
      renameMap.set(oldId, newId);
    }
  }

  if (renameMap.size === 0) {
    return [...qcRows];
  }

  return qcRows.map((row) => {
    if (!isParentAllowed(row.type)) return row;
    const currentParent = row.parent?.trim() ?? '';
    const renamedParent = renameMap.get(currentParent);
    if (!renamedParent) return row;
    return { ...row, parent: renamedParent };
  });
}

function mutateAnalyteMaps(
  row: SampleRowState,
  transform: (map: Record<string, number>) => Record<string, number>,
): SampleRowState {
  return {
    ...row,
    readings: transform({ ...row.readings }),
    expectedConc: row.expectedConc ? transform({ ...row.expectedConc }) : undefined,
    spikeAdded: row.spikeAdded ? transform({ ...row.spikeAdded }) : undefined,
  };
}

export function renameAnalyteKeysInRows(
  rows: readonly SampleRowState[],
  oldSymbol: string,
  newSymbol: string,
): SampleRowState[] {
  return rows.map((row) =>
    mutateAnalyteMaps(row, (map) => {
      if (map[oldSymbol] !== undefined) {
        map[newSymbol] = map[oldSymbol]!;
        delete map[oldSymbol];
      }
      return map;
    }),
  );
}

export function removeAnalyteKeyInRows(
  rows: readonly SampleRowState[],
  symbol: string,
): SampleRowState[] {
  return rows.map((row) =>
    mutateAnalyteMaps(row, (map) => {
      delete map[symbol];
      return map;
    }),
  );
}

function checkPositiveTargetMap(
  map: Record<string, number> | undefined,
  analytes: readonly string[],
  fieldLabel: string,
  sampleId: string,
  issues: SampleValidationIssue[],
): void {
  const missing = analytes.filter((analyte) => {
    const val = map?.[analyte];
    return typeof val !== 'number' || !Number.isFinite(val) || val <= 0;
  });

  if (missing.length > 0) {
    issues.push({
      scope: 'qc',
      sampleId,
      message: `${sampleId}: enter ${fieldLabel} (> 0) for ${missing.join(', ')}.`,
    });
  }
}

export function validateBatchSamples(
  sampleRows: readonly SampleRowState[],
  qcRows: readonly SampleRowState[],
  analytes: readonly string[],
): SampleValidationIssue[] {
  const issues: SampleValidationIssue[] = [];
  const totalRows = sampleRows.length + qcRows.length;

  if (sampleRows.length === 0) {
    issues.push({
      scope: 'sample',
      message: 'Sample Table must contain at least 1 test sample row.',
    });
  }

  if (totalRows > MAX_BATCH_SAMPLE_ROWS) {
    issues.push({
      scope: 'batch',
      message: `Total sample and QC rows (${totalRows}) exceed the maximum of ${MAX_BATCH_SAMPLE_ROWS} rows per batch.`,
    });
  }

  if (!qcRows.some((row) => row.type === 'blank_method')) {
    issues.push({
      scope: 'qc',
      message: 'QC Table must contain at least 1 blank_method row.',
    });
  }

  const allTaggedRows = [
    ...sampleRows.map((row, idx) => ({ row, scope: 'sample' as const, labelIdx: idx + 1 })),
    ...qcRows.map((row, idx) => ({ row, scope: 'qc' as const, labelIdx: idx + 1 })),
  ];

  // Database enforces unique (calibration_id, sample_id) across both routine and QC rows.
  const idCounts = new Map<string, number>();
  for (const { row } of allTaggedRows) {
    const cleanId = row.id.trim();
    if (cleanId) {
      idCounts.set(cleanId, (idCounts.get(cleanId) ?? 0) + 1);
    }
  }

  const reportedDuplicates = new Set<string>();
  const availableParents = new Set(getAvailableParentOptions(sampleRows));

  for (const { row, scope, labelIdx } of allTaggedRows) {
    const cleanId = row.id.trim();
    const displayId = cleanId || `${scope === 'sample' ? 'Sample' : 'QC'} row ${labelIdx}`;

    if (!cleanId) {
      issues.push({
        scope,
        message: `${displayId}: Sample ID is required.`,
      });
    } else if ((idCounts.get(cleanId) ?? 0) > 1 && !reportedDuplicates.has(cleanId)) {
      reportedDuplicates.add(cleanId);
      issues.push({
        scope,
        sampleId: cleanId,
        message: `Duplicate Sample ID "${cleanId}"; every row across Sample Table and QC Table must be unique.`,
      });
    }

    if (isPrepParamsRequired(row.type)) {
      if (row.weight === null || !Number.isFinite(row.weight) || row.weight <= 0) {
        issues.push({
          scope,
          sampleId: cleanId,
          message: `${displayId}: Weight must be greater than 0.`,
        });
      }
      if (row.vol === null || !Number.isFinite(row.vol) || row.vol <= 0) {
        issues.push({
          scope,
          sampleId: cleanId,
          message: `${displayId}: Volume must be greater than 0.`,
        });
      }
      if (row.df === null || !Number.isFinite(row.df) || row.df <= 0) {
        issues.push({
          scope,
          sampleId: cleanId,
          message: `${displayId}: dF must be greater than 0.`,
        });
      }
    }

    const missingReadings = analytes.filter((analyte) => {
      const val = row.readings[analyte];
      return typeof val !== 'number' || !Number.isFinite(val);
    });
    if (missingReadings.length > 0) {
      issues.push({
        scope,
        sampleId: cleanId,
        message: `${displayId}: instrument reading is missing for ${missingReadings.join(', ')}.`,
      });
    }

    if (scope === 'qc') {
      if (isParentAllowed(row.type)) {
        const parentId = row.parent?.trim() ?? '';
        if (!parentId) {
          issues.push({
            scope: 'qc',
            sampleId: cleanId,
            message: `${displayId} (${row.type}): select a Parent from the available samples.`,
          });
        } else if (parentId === cleanId || !availableParents.has(parentId)) {
          issues.push({
            scope: 'qc',
            sampleId: cleanId,
            message: `${displayId}: Parent "${parentId}" was not found as a sample row in Sample Table.`,
          });
        }
      }

      if (row.type === 'ccv') {
        checkPositiveTargetMap(row.expectedConc, analytes, 'expectedConc', displayId, issues);
      }
      if (row.type === 'spike') {
        checkPositiveTargetMap(row.spikeAdded, analytes, 'spikeAdded', displayId, issues);
      }
    }
  }

  return issues;
}

function pickAnalyteNumbers(
  source: Record<string, number> | undefined,
  analytes: readonly string[],
  fallback?: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const analyte of analytes) {
    const val = source?.[analyte];
    if (typeof val === 'number' && Number.isFinite(val)) {
      out[analyte] = val;
    } else if (fallback !== undefined) {
      out[analyte] = fallback;
    }
  }
  return out;
}

export function toSampleRowInputs(
  sampleRows: readonly SampleRowState[],
  qcRows: readonly SampleRowState[],
  analytes: readonly string[],
): SampleRowInput[] {
  return [...sampleRows, ...qcRows].map((row) => {
    const trimmedLabId = row.labSampleId?.trim();
    const parentId = isParentAllowed(row.type) ? row.parent?.trim() || null : null;
    const needsPrep = isPrepParamsRequired(row.type);

    return {
      sampleId: row.id.trim(),
      // DB CHECK constraint rejects empty strings for lab_sample_id; normalize blank values to null.
      labSampleId: trimmedLabId ? trimmedLabId : null,
      sampleType: row.type,
      parentSampleId: parentId,
      expectedConc: row.type === 'ccv' ? pickAnalyteNumbers(row.expectedConc, analytes) : null,
      spikeAdded: row.type === 'spike' ? pickAnalyteNumbers(row.spikeAdded, analytes) : null,
      weight: needsPrep ? (row.weight ?? 0.2) : null,
      volume: needsPrep ? (row.vol ?? 50) : null,
      df: needsPrep ? (row.df ?? 1) : null,
      readings: pickAnalyteNumbers(row.readings, analytes, 0),
    };
  });
}

/**
 * Computes default CCV target concentration as the calibration standard nearest
 * to the midpoint of the non-blank [min, max] standard range.
 */
export function getDefaultCcvTargetFromStandards(
  standards: ReadonlyArray<{ nominalConc: number }>,
): number | undefined {
  const concs = standards
    .map((s) => s.nominalConc)
    .filter((c) => Number.isFinite(c) && c > 0);

  if (concs.length === 0) return undefined;

  const min = Math.min(...concs);
  const max = Math.max(...concs);
  const midpoint = (min + max) / 2;

  return concs.reduce((closest, curr) =>
    Math.abs(curr - midpoint) < Math.abs(closest - midpoint) ? curr : closest,
  );
}

/**
 * Populates missing `expectedConc` entries on CCV rows without overwriting
 * existing manual values. Returns the original array reference when unchanged.
 */
export function fillMissingCcvExpectedConc(
  rows: SampleRowState[],
  analytes: readonly string[],
  defaultTargets: Record<string, number | undefined> | number | undefined,
): SampleRowState[] {
  if (defaultTargets === undefined || analytes.length === 0) return rows;

  let changed = false;
  const nextRows = rows.map((row) => {
    if (row.type !== 'ccv') return row;

    let rowChanged = false;
    const nextExpected = { ...(row.expectedConc ?? {}) };
    for (const analyte of analytes) {
      const targetVal =
        typeof defaultTargets === 'number' ? defaultTargets : defaultTargets[analyte];
      if (nextExpected[analyte] === undefined && targetVal !== undefined) {
        nextExpected[analyte] = targetVal;
        rowChanged = true;
      }
    }

    if (!rowChanged) return row;
    changed = true;
    return { ...row, expectedConc: nextExpected };
  });

  return changed ? nextRows : rows;
}
