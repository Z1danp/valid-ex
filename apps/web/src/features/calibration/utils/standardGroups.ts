import type { components } from '@valid-ex/contracts';

export type StandardRowInput = components['schemas']['StandardRowInput'];
export type StandardPointReading = components['schemas']['StandardPointReading'];

export interface StandardGroupRow {
  standardName: string;
  nominalConc?: number;
  nominalConcManual?: boolean;
  signals: Record<string, number>;
}

export interface StandardGroup {
  id: string;
  analytes: string[];
  rows: StandardGroupRow[];
}

const DEFAULT_STANDARD_LEVELS = [
  { name: 'Blank', nominal: 0, signal: 0 },
  { name: 'Std 10', nominal: 10, signal: 10 },
  { name: 'Std 50', nominal: 50, signal: 50 },
  { name: 'Std 100', nominal: 100, signal: 100 },
  { name: 'Std 300', nominal: 300, signal: 300 },
  { name: 'Std 500', nominal: 500, signal: 500 },
] as const;

export function parseNominalFromName(name: string): number | undefined {
  const lower = name.toLowerCase().trim();
  if (!lower) return undefined;
  if (lower === 'blank' || lower === 'blanko' || lower === '0' || lower === 'calblank') {
    return 0;
  }
  const match = name.match(/(\d+(?:\.\d+)?)/);
  if (match && match[1]) {
    const parsed = Number.parseFloat(match[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function parseOptionalNumberFromInput(
  raw: string | number | undefined,
  allowNegative = true,
): { value: number | undefined; valid: boolean; empty: boolean } {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { value: undefined, valid: false, empty: false };
    if (!allowNegative && raw < 0) return { value: undefined, valid: false, empty: false };
    return { value: raw, valid: true, empty: false };
  }

  const clean = String(raw ?? '').trim();
  if (clean === '') {
    return { value: undefined, valid: true, empty: true };
  }

  // Reject partial parses like "12abc" that parseFloat would silently accept.
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(clean)) {
    return { value: undefined, valid: false, empty: false };
  }

  const parsed = Number(clean);
  if (!Number.isFinite(parsed) || (!allowNegative && parsed < 0)) {
    return { value: undefined, valid: false, empty: false };
  }

  return { value: parsed, valid: true, empty: false };
}

export function createEmptyStandardRows(count = 6): StandardGroupRow[] {
  return Array.from({ length: count }, () => ({
    standardName: '',
    nominalConc: undefined,
    nominalConcManual: false,
    signals: {},
  }));
}

export function createInitialStandardGroups(analytes: readonly string[]): StandardGroup[] {
  const firstAnalyte = analytes[0];
  return [
    {
      id: 'group-1',
      analytes: [...analytes],
      rows: DEFAULT_STANDARD_LEVELS.map((lvl) => ({
        standardName: lvl.name,
        nominalConc: lvl.nominal,
        nominalConcManual: false,
        signals: firstAnalyte ? { [firstAnalyte]: lvl.signal } : {},
      })),
    },
  ];
}

function nextGroupId(groups: readonly StandardGroup[]): string {
  let maxNum = 0;
  for (const g of groups) {
    const match = g.id.match(/^group-(\d+)$/);
    if (match && match[1]) {
      maxNum = Math.max(maxNum, Number.parseInt(match[1], 10));
    }
  }
  return `group-${maxNum + 1}`;
}

export function syncStandardGroupsWithAnalytes(
  groups: readonly StandardGroup[],
  analytes: readonly string[],
): StandardGroup[] {
  const analyteSet = new Set(analytes);
  if (groups.length === 0) {
    return createInitialStandardGroups(analytes);
  }

  const assigned = new Set<string>();
  const cleaned = groups.map((group) => {
    const keptAnalytes = group.analytes.filter((a) => {
      if (!analyteSet.has(a) || assigned.has(a)) return false;
      assigned.add(a);
      return true;
    });
    const keptSet = new Set(keptAnalytes);
    const rows = group.rows.map((row) => {
      const nextSignals: Record<string, number> = {};
      for (const [key, val] of Object.entries(row.signals)) {
        if (keptSet.has(key)) nextSignals[key] = val;
      }
      return { ...row, signals: nextSignals };
    });
    return { ...group, analytes: keptAnalytes, rows };
  });

  const missingAnalytes = analytes.filter((a) => !assigned.has(a));
  if (missingAnalytes.length > 0 && cleaned[0]) {
    cleaned[0] = {
      ...cleaned[0],
      analytes: [...cleaned[0].analytes, ...missingAnalytes],
    };
  }

  const nonEmpty = cleaned.filter((g) => g.analytes.length > 0);
  if (nonEmpty.length > 0) return nonEmpty;

  // Keep the first group's concentration template if all analytes were temporarily removed.
  return [{ ...cleaned[0]!, analytes: [] }];
}

export function renameAnalyteInStandardGroups(
  groups: readonly StandardGroup[],
  oldSymbol: string,
  newSymbol: string,
): StandardGroup[] {
  return groups.map((group) => ({
    ...group,
    analytes: group.analytes.map((a) => (a === oldSymbol ? newSymbol : a)),
    rows: group.rows.map((row) => {
      const existing = row.signals[oldSymbol];
      if (existing === undefined) return row;
      const nextSignals = { ...row.signals };
      nextSignals[newSymbol] = existing;
      delete nextSignals[oldSymbol];
      return { ...row, signals: nextSignals };
    }),
  }));
}

export function assignAnalyteToGroup(
  groups: readonly StandardGroup[],
  analyte: string,
  targetGroupId: string,
): StandardGroup[] {
  const sourceGroup = groups.find((g) => g.analytes.includes(analyte));
  const targetGroup = groups.find((g) => g.id === targetGroupId);
  if (!targetGroup || sourceGroup?.id === targetGroupId) {
    return [...groups];
  }

  // Carry over entered signals whose nominalConc matches a level in the target table.
  const signalByConc = new Map<number, number>();
  if (sourceGroup) {
    for (const row of sourceGroup.rows) {
      const sig = row.signals[analyte];
      if (row.nominalConc !== undefined && typeof sig === 'number' && Number.isFinite(sig)) {
        signalByConc.set(row.nominalConc, sig);
      }
    }
  }

  const updated = groups.map((group) => {
    if (group.id === sourceGroup?.id) {
      return {
        ...group,
        analytes: group.analytes.filter((a) => a !== analyte),
        rows: group.rows.map((row) => {
          if (row.signals[analyte] === undefined) return row;
          const nextSignals = { ...row.signals };
          delete nextSignals[analyte];
          return { ...row, signals: nextSignals };
        }),
      };
    }

    if (group.id === targetGroupId) {
      return {
        ...group,
        analytes: [...group.analytes, analyte],
        rows: group.rows.map((row) => {
          if (row.nominalConc === undefined) return row;
          const matchedSig = signalByConc.get(row.nominalConc);
          if (matchedSig === undefined) return row;
          return {
            ...row,
            signals: { ...row.signals, [analyte]: matchedSig },
          };
        }),
      };
    }

    return group;
  });

  return updated.filter((g) => g.analytes.length > 0);
}

export function splitAnalyteToNewGroup(
  groups: readonly StandardGroup[],
  analyte: string,
): StandardGroup[] {
  const sourceGroup = groups.find((g) => g.analytes.includes(analyte));
  if (!sourceGroup || sourceGroup.analytes.length <= 1) {
    return [...groups];
  }

  const hasEnteredSignals = sourceGroup.rows.some(
    (row) => typeof row.signals[analyte] === 'number' && Number.isFinite(row.signals[analyte]),
  );

  const newRows: StandardGroupRow[] = hasEnteredSignals
    ? sourceGroup.rows.map((row) => {
        const sig = row.signals[analyte];
        return {
          standardName: row.standardName,
          nominalConc: row.nominalConc,
          nominalConcManual: row.nominalConcManual,
          signals:
            typeof sig === 'number' && Number.isFinite(sig) ? { [analyte]: sig } : {},
        };
      })
    : createEmptyStandardRows(6);

  const updated = groups.map((group) => {
    if (group.id !== sourceGroup.id) return group;
    return {
      ...group,
      analytes: group.analytes.filter((a) => a !== analyte),
      rows: group.rows.map((row) => {
        if (row.signals[analyte] === undefined) return row;
        const nextSignals = { ...row.signals };
        delete nextSignals[analyte];
        return { ...row, signals: nextSignals };
      }),
    };
  });

  return [
    ...updated,
    {
      id: nextGroupId(groups),
      analytes: [analyte],
      rows: newRows,
    },
  ];
}

export function getPointsForAnalyte(
  groups: readonly StandardGroup[],
  analyte: string,
): Array<{ standardName: string; nominalConc: number; signal: number }> {
  const group = groups.find((g) => g.analytes.includes(analyte));
  if (!group) return [];

  const points: Array<{ standardName: string; nominalConc: number; signal: number }> = [];
  for (const row of group.rows) {
    const sig = row.signals[analyte];
    if (
      typeof row.nominalConc === 'number' &&
      Number.isFinite(row.nominalConc) &&
      row.nominalConc >= 0 &&
      typeof sig === 'number' &&
      Number.isFinite(sig)
    ) {
      points.push({
        standardName:
          row.standardName.trim() ||
          (row.nominalConc === 0 ? 'Blank' : `Std ${row.nominalConc}`),
        nominalConc: row.nominalConc,
        signal: sig,
      });
    }
  }
  return points;
}

export function isAllStandardsReady(
  groups: readonly StandardGroup[],
  analytes: readonly string[],
  minPoints = 3,
): boolean {
  if (analytes.length === 0) return false;
  return analytes.every((analyte) => getPointsForAnalyte(groups, analyte).length >= minPoints);
}

export function getDefaultCcvTargetByAnalyte(
  groups: readonly StandardGroup[],
  analytes: readonly string[],
): Record<string, number | undefined> {
  const targets: Record<string, number | undefined> = {};

  for (const analyte of analytes) {
    const group = groups.find((g) => g.analytes.includes(analyte));
    if (!group) {
      targets[analyte] = undefined;
      continue;
    }

    const concs = group.rows
      .map((r) => r.nominalConc)
      .filter((c): c is number => typeof c === 'number' && Number.isFinite(c) && c > 0);

    if (concs.length === 0) {
      targets[analyte] = undefined;
      continue;
    }

    const min = Math.min(...concs);
    const max = Math.max(...concs);
    const midpoint = (min + max) / 2;
    targets[analyte] = concs.reduce((closest, curr) =>
      Math.abs(curr - midpoint) < Math.abs(closest - midpoint) ? curr : closest,
    );
  }

  return targets;
}

export function toStandardRowInputs(groups: readonly StandardGroup[]): StandardRowInput[] {
  const out: StandardRowInput[] = [];

  for (const group of groups) {
    for (const row of group.rows) {
      if (
        typeof row.nominalConc !== 'number' ||
        !Number.isFinite(row.nominalConc) ||
        row.nominalConc < 0
      ) {
        continue;
      }

      const readings: Record<string, StandardPointReading> = {};
      for (const analyte of group.analytes) {
        const sig = row.signals[analyte];
        if (typeof sig === 'number' && Number.isFinite(sig)) {
          readings[analyte] = {
            nominalConc: row.nominalConc,
            signal: sig,
          };
        }
      }

      if (Object.keys(readings).length === 0) continue;

      out.push({
        standardName:
          row.standardName.trim() ||
          (row.nominalConc === 0 ? 'Blank' : `Std ${row.nominalConc}`),
        readings,
      });
    }
  }

  return out;
}
