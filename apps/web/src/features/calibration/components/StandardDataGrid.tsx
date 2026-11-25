import { useCallback, useMemo, useState } from 'react';
import {
  DataEditor,
  GridCellKind,
  CompactSelection,
  type GridColumn,
  type GridCell,
  type Item,
  type EditableGridCell,
  type GridSelection,
  type Theme,
} from '@glideapps/glide-data-grid';
import { Plus, Trash, ViewGrid, PasteClipboard } from 'iconoir-react';
import type { components } from '@valid-ex/contracts';

type SignalUnit = components['schemas']['MetrologyUnits']['signalUnit']
export interface StandardReading {
  nominalConc: number;
  signal: number;
}

export interface StandardRowItem {
  standardName: string;
  nominalConc: number;
  readings: Record<string, StandardReading>;
}

interface StandardDataGridProps {
  standards: StandardRowItem[];
  analytes: string[];
  onChange: (updated: StandardRowItem[]) => void;
  onNotice?: (message: string) => void;
  unit: string;
  signalUnit: SignalUnit
}

const GRID_THEME: Partial<Theme> = {
  accentColor: '#0f172a',
  accentLight: 'rgba(15, 23, 42, 0.08)',
  textDark: '#0f172a',
  textMedium: '#64748b',
  textHeader: '#334155',
  bgHeader: '#f8fafc',
  bgHeaderHovered: '#f1f5f9',
  bgCell: '#ffffff',
  bgCellMedium: '#fcfcfd',
  borderColor: '#e2e8f0',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  headerFontStyle: '600 12px',
  baseFontStyle: '12px',
  editorFontSize: '12px',
};

export function parseNominalFromName(name: string, fallback: number): number {
  const lower = name.toLowerCase().trim();
  if (lower === 'blank' || lower === 'blanko' || lower === '0' || lower === 'calblank') {
    return 0;
  }
  const match = name.match(/(\d+(\.\d+)?)/);
  if (match && match[1]) {
    return parseFloat(match[1]);
  }
  return fallback;
}

export function StandardDataGrid({
  standards,
  analytes,
  onChange,
  onNotice,
  unit,
  signalUnit
}: StandardDataGridProps) {
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    label: 150,
  });

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const columns: GridColumn[] = useMemo(() => {
    const cols: GridColumn[] = [
      {
        id: 'label',
        title: `Standard Label (${unit})`,
        width: colWidths.label ?? 150,
      },
    ];

    analytes.forEach((analyte) => {
      cols.push({
        id: analyte,
        title: `${analyte} (${signalUnit})`,
        width: colWidths[analyte] ?? 130,
      });
    });

    return cols;
  }, [analytes, colWidths, signalUnit, unit]);

  const handleColumnResize = useCallback((column: GridColumn, newSize: number) => {
    if (column.id) {
      setColWidths((prev) => ({
        ...prev,
        [column.id!]: Math.max(80, newSize),
      }));
    }
  }, []);

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = standards[row];

      if (!item) {
        return {
          kind: GridCellKind.Loading,
          allowOverlay: false,
        };
      }

      if (col === 0) {
        return {
          kind: GridCellKind.Text,
          data: item.standardName,
          displayData: item.standardName,
          allowOverlay: true,
          readonly: false,
        };
      }

      const analyteIndex = col - 1;
      const analyte = analytes[analyteIndex];
      const reading = analyte ? (item.readings[analyte]?.signal ?? 0) : 0;

      return {
        kind: GridCellKind.Number,
        data: reading,
        displayData: String(reading),
        allowOverlay: true,
        readonly: false,
      };
    },
    [standards, analytes],
  );

  const handleCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell;
      const updated = [...standards];
      const target = updated[row];
      if (!target) return;

      const targetRow: StandardRowItem = {
        ...target,
        readings: { ...target.readings },
      };

      if (col === 0 && newValue.kind === GridCellKind.Text) {
        const cleanName = newValue.data.trim();
        targetRow.standardName = cleanName;
        const parsedNom = parseNominalFromName(cleanName, targetRow.nominalConc);
        targetRow.nominalConc = parsedNom;
        analytes.forEach((a) => {
          targetRow.readings[a] = {
            nominalConc: parsedNom,
            signal: targetRow.readings[a]?.signal ?? 0,
          };
        });
      } else if (col >= 1) {
        const analyteIndex = col - 1;
        const analyte = analytes[analyteIndex];
        if (analyte) {
          let val = 0;
          if (newValue.kind === GridCellKind.Number) {
            val = typeof newValue.data === 'number' && !isNaN(newValue.data) ? newValue.data : 0;
          } else if (newValue.kind === GridCellKind.Text) {
            val = parseFloat(newValue.data) || 0;
          }
          targetRow.readings[analyte] = {
            nominalConc: targetRow.nominalConc,
            signal: val,
          };
        }
      }

      updated[row] = targetRow;
      onChange(updated);
    },
    [standards, analytes, onChange],
  );

  const handlePaste = useCallback(
    (target: Item, values: readonly (readonly string[])[]) => {
      if (values.length === 0 || values[0]?.length === 0) return false;

      const [startCol, startRow] = target;
      const updated = [...standards];

      values.forEach((rowVals, rOffset) => {
        const targetRow = startRow + rOffset;

        while (updated.length <= targetRow) {
          const prev = updated[updated.length - 1];
          const nextNom = prev ? prev.nominalConc + 50 : 10;
          const defaultReadings: Record<string, StandardReading> = {};
          analytes.forEach((a) => {
            defaultReadings[a] = { nominalConc: nextNom, signal: 0 };
          });

          updated.push({
            standardName: `Std ${nextNom}`,
            nominalConc: nextNom,
            readings: defaultReadings,
          });
        }

        const rowItem: StandardRowItem = {
          ...updated[targetRow]!,
          readings: { ...updated[targetRow]!.readings },
        };

        rowVals.forEach((val, cOffset) => {
          const targetCol = startCol + cOffset;
          const clean = val.trim();

          if (targetCol === 0) {
            rowItem.standardName = clean;
            const parsedNom = parseNominalFromName(clean, rowItem.nominalConc);
            rowItem.nominalConc = parsedNom;
            analytes.forEach((a) => {
              rowItem.readings[a] = {
                nominalConc: parsedNom,
                signal: rowItem.readings[a]?.signal ?? 0,
              };
            });
          } else if (targetCol >= 1) {
            const aIdx = targetCol - 1;
            const analyte = analytes[aIdx];
            if (analyte) {
              rowItem.readings[analyte] = {
                nominalConc: rowItem.nominalConc,
                signal: parseFloat(clean) || 0,
              };
            }
          }
        });

        updated[targetRow] = rowItem;
      });

      onChange(updated);

      if (onNotice) {
        const colTitle =
          startCol === 0 ? 'Label' : (analytes[startCol - 1] ?? `Column ${startCol + 1}`);
        onNotice(
          `Pasted ${values.length} rows x ${values[0]?.length} columns from clipboard at row ${startRow + 1}, ${colTitle}.`,
        );
      }

      return false;
    },
    [standards, analytes, onChange, onNotice],
  );

  const handleAddRow = useCallback(() => {
    const last = standards[standards.length - 1];
    const nextNominal = last ? last.nominalConc + 100 : 10;
    const defaultReadings: Record<string, StandardReading> = {};
    analytes.forEach((a) => {
      defaultReadings[a] = { nominalConc: nextNominal, signal: 0 };
    });

    const newPoint: StandardRowItem = {
      standardName: `Std ${nextNominal}`,
      nominalConc: nextNominal,
      readings: defaultReadings,
    };
    onChange([...standards, newPoint]);
  }, [standards, analytes, onChange]);

  const handleDeleteSelected = useCallback(() => {
    const selectedRows = selection.rows.toArray();
    const minPointsMsg = 'Calibration curve requires at least 3 data points (df >= 1).';

    if (selectedRows.length > 0) {
      if (standards.length - selectedRows.length < 3) {
        if (onNotice) onNotice(minPointsMsg);
        else alert(minPointsMsg);
        return;
      }
      const updated = standards.filter((_, i) => !selectedRows.includes(i));
      onChange(updated);
      setSelection({
        columns: CompactSelection.empty(),
        rows: CompactSelection.empty(),
      });
      return;
    }

    if (selection.current) {
      const targetRow = selection.current.cell[1];
      if (standards.length <= 3) {
        if (onNotice) onNotice(minPointsMsg);
        else alert(minPointsMsg);
        return;
      }
      const updated = standards.filter((_, i) => i !== targetRow);
      onChange(updated);
    }
  }, [standards, selection, onChange, onNotice]);

  const handleDeleteCallback = useCallback(
    (sel: GridSelection) => {
      const minPointsMsg = 'Calibration curve requires at least 3 data points (df >= 1).';
      if (sel.rows.length > 0) {
        const selectedRows = sel.rows.toArray();
        if (standards.length - selectedRows.length < 3) {
          if (onNotice) onNotice(minPointsMsg);
          else alert(minPointsMsg);
          return false;
        }
        const updated = standards.filter((_, i) => !selectedRows.includes(i));
        onChange(updated);
        setSelection({
          columns: CompactSelection.empty(),
          rows: CompactSelection.empty(),
        });
        return true;
      }

      if (sel.current) {
        const [col, row] = sel.current.cell;
        const updated = [...standards];
        const target = updated[row];
        if (target) {
          const newTarget = { ...target, readings: { ...target.readings } };
          if (col === 0) {
            newTarget.standardName = '';
          } else if (col >= 1) {
            const aIdx = col - 1;
            const a = analytes[aIdx];
            if (a) {
              newTarget.readings[a] = { nominalConc: target.nominalConc, signal: 0 };
            }
          }
          updated[row] = newTarget;
          onChange(updated);
        }
        return true;
      }

      return false;
    },
    [standards, analytes, onChange, onNotice],
  );

  const selectedRowCount = selection.rows.length;
  const activeCellDesc = useMemo(() => {
    if (selection.current) {
      const [col, row] = selection.current.cell;
      const colTitle =
        col === 0
          ? `Standard Label (${unit})`
          : analytes[col - 1]
            ? `${analytes[col - 1]} (${signalUnit})`
            : `Column ${col + 1}`;
      return `Active cell: Row ${row + 1}, ${colTitle}`;
    }
    return 'Select a cell or range to copy/paste';
  }, [selection, analytes, signalUnit, unit]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1 min-h-9 px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-medium text-slate-800 transition-colors shadow-2xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Add Row
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={standards.length <= 3}
            className={`inline-flex items-center gap-1 min-h-9 px-2.5 py-1 text-xs rounded-lg border transition-colors shadow-2xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              selectedRowCount > 0
                ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 font-medium'
                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40'
            }`}
          >
            <Trash className="w-3.5 h-3.5" aria-hidden="true" />
            {selectedRowCount > 0
              ? `Delete ${selectedRowCount} ${selectedRowCount === 1 ? 'Row' : 'Rows'}`
              : 'Delete Row'}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600">
          <span className="flex items-center gap-1">
            <ViewGrid className="w-3 h-3 text-slate-600" aria-hidden="true" />
            {activeCellDesc}
          </span>
          <span className="text-slate-400" aria-hidden="true">|</span>
          <span className="text-slate-600">
            {standards.length} rows &times; {columns.length} columns
          </span>
        </div>
      </div>

      <div className="w-full h-[280px] rounded-lg border border-slate-200 overflow-hidden bg-white shadow-2xs relative">
        <DataEditor
          width="100%"
          height="100%"
          columns={columns}
          rows={standards.length}
          getCellContent={getCellContent}
          onCellEdited={handleCellEdited}
          onPaste={handlePaste}
          onRowAppended={handleAddRow}
          trailingRowOptions={{
            tint: true,
            hint: 'Add row...',
            sticky: false,
          }}
          rowMarkers="number"
          getCellsForSelection={true}
          gridSelection={selection}
          onGridSelectionChange={setSelection}
          onColumnResize={handleColumnResize}
          onDelete={handleDeleteCallback}
          theme={GRID_THEME}
          editOnType={true}
          cellActivationBehavior="second-click"
          keybindings={{ downFill: true, rightFill: true }}
        />
      </div>
    </div>
  );
}
