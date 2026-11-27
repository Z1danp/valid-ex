import {
  GridCellKind,
  type EditableGridCell,
  type TextCell,
  type Theme,
} from '@glideapps/glide-data-grid';
import type { components } from '@valid-ex/contracts';
import { SAMPLE_TYPE_META, type SampleType } from '../utils/sampleValidation';
import type { DropdownCellOption, GridDropdownCell } from './gridDropdownCell';

export type SolutionConcUnit = components['schemas']['MetrologyUnits']['solutionConcUnit'];
export type SignalUnit = components['schemas']['MetrologyUnits']['signalUnit'];
export type InputMode = components['schemas']['InputMode'];

export const SAMPLE_GRID_THEME: Partial<Theme> = {
  accentColor: '#0f172a',
  accentLight: 'rgba(15, 23, 42, 0.08)',
  textDark: '#0f172a',
  textMedium: '#475569',
  textHeader: '#334155',
  bgHeader: '#f8fafc',
  bgHeaderHovered: '#f1f5f9',
  bgCell: '#ffffff',
  bgCellMedium: '#fcfcfd',
  borderColor: '#cbd5e1',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  headerFontStyle: '600 12px',
  baseFontStyle: '12px',
  editorFontSize: '12px',
};

export const BLOCKED_CELL_THEME: Partial<Theme> = {
  bgCell: '#f1f5f9',
  textDark: '#475569',
};

export function buildBlockedTextCell(display = '--'): TextCell {
  return {
    kind: GridCellKind.Text,
    data: '',
    displayData: display,
    allowOverlay: false,
    readonly: true,
    style: 'faded',
    cursor: 'not-allowed',
    copyData: '',
    themeOverride: BLOCKED_CELL_THEME,
  };
}

export function buildSampleTypeOptions(types: readonly SampleType[]): DropdownCellOption[] {
  return types.map((type) => {
    const meta = SAMPLE_TYPE_META[type];
    return {
      value: type,
      label: meta.label,
      description: meta.description,
      tone: meta.tone,
    };
  });
}

export function buildDropdownCell(params: {
  value: string;
  options: readonly DropdownCellOption[];
  ariaLabel: string;
  placeholder?: string;
  emptyMessage?: string;
  warnIfUnlisted?: boolean;
}): GridDropdownCell {
  return {
    kind: GridCellKind.Custom,
    allowOverlay: true,
    readonly: false,
    copyData: params.value,
    data: {
      kind: 'valid-ex-dropdown',
      value: params.value,
      options: params.options,
      ariaLabel: params.ariaLabel,
      placeholder: params.placeholder,
      emptyMessage: params.emptyMessage,
      warnIfUnlisted: params.warnIfUnlisted,
    },
  };
}

export function buildAnalyteReadingHeader(
  analyte: string,
  inputMode: InputMode,
  unit: SolutionConcUnit,
  signalUnit: SignalUnit,
): string {
  const unitLabel = inputMode === 'in_vial_concentration' ? unit : signalUnit;
  return `${analyte} (${unitLabel})`;
}

export function parseNumberFromInput(
  raw: string | number | undefined,
  fallback: number,
  positiveOnly = false,
): number {
  const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? '').trim());
  if (!Number.isFinite(parsed)) return fallback;
  if (positiveOnly && parsed <= 0) return fallback;
  return parsed;
}

export { parseOptionalNumberFromInput } from '../utils/standardGroups';

export function extractCellNumber(
  newValue: EditableGridCell,
  fallback: number,
  positiveOnly = false,
): number {
  if (newValue.kind === GridCellKind.Number) {
    return parseNumberFromInput(newValue.data, fallback, positiveOnly);
  }
  if (newValue.kind === GridCellKind.Text) {
    return parseNumberFromInput(newValue.data, fallback, positiveOnly);
  }
  return fallback;
}
