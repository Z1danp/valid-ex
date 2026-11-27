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
import { Plus, Trash, ViewGrid } from 'iconoir-react';
import type { components } from '@valid-ex/contracts';
import { parseOptionalNumberFromInput } from './sampleGridShared';
import { parseNominalFromName, type StandardGroupRow } from '../utils/standardGroups';

type SignalUnit = components['schemas']['MetrologyUnits']['signalUnit'];

interface StandardDataGridProps {
  rows: StandardGroupRow[];
  analytes: string[];
  onChange: (updated: StandardGroupRow[]) => void;
  onNotice?: (message: string) => void;
  unit: string;
  signalUnit: SignalUnit;
}

const GRID_THEME: Partial<Theme> = {
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

const ANALYTE_START_COL = 2;

export function StandardDataGrid({
  rows,
  analytes,
  onChange,
  onNotice,
  unit,
  signalUnit,
}: StandardDataGridProps) {
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    label: 140,
    nominalConc: 155,
  });

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const columns: GridColumn[] = useMemo(() => {
    const cols: GridColumn[] = [
      {
        id: 'label',
        title: 'Standard Name',
        width: colWidths.label ?? 140,
      },
      {
        id: 'nominalConc',
        title: `Nominal Conc (${unit})`,
        width: colWidths.nominalConc ?? 155,
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
      const item = rows[row];

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

      if (col === 1) {
        return {
          kind: GridCellKind.Number,
          data: item.nominalConc,
          displayData: item.nominalConc !== undefined ? String(item.nominalConc) : '',
          allowOverlay: true,
          readonly: false,
        };
      }

      const analyte = analytes[col - ANALYTE_START_COL];
      const reading = analyte ? item.signals[analyte] : undefined;

      return {
        kind: GridCellKind.Number,
        data: reading,
        displayData: reading !== undefined ? String(reading) : '',
        allowOverlay: true,
        readonly: false,
      };
    },
    [rows, analytes],
  );

  const handleCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell;
      const updated = [...rows];
      const target = updated[row];
      if (!target) return;

      const targetRow: StandardGroupRow = {
        ...target,
        signals: { ...target.signals },
      };

      if (col === 0 && newValue.kind === GridCellKind.Text) {
        const cleanName = newValue.data.trim();
        targetRow.standardName = cleanName;
        // Preserve manual Nominal Conc overrides unless the analyst cleared the numeric cell.
        if (!targetRow.nominalConcManual) {
          const parsed = parseNominalFromName(cleanName);
          if (parsed !== undefined) {
            targetRow.nominalConc = parsed;
          }
        }
      } else if (col === 1) {
        const raw =
          newValue.kind === GridCellKind.Number || newValue.kind === GridCellKind.Text
            ? newValue.data
            : undefined;
        const parsed = parseOptionalNumberFromInput(raw, false);
        if (!parsed.valid) {
          onNotice?.(`Nominal Conc (${unit}) must be 0 or a positive number.`);
          return;
        }
        targetRow.nominalConc = parsed.value;
        targetRow.nominalConcManual = !parsed.empty;
      } else if (col >= ANALYTE_START_COL) {
        const analyte = analytes[col - ANALYTE_START_COL];
        if (!analyte) return;
        const raw =
          newValue.kind === GridCellKind.Number || newValue.kind === GridCellKind.Text
            ? newValue.data
            : undefined;
        const parsed = parseOptionalNumberFromInput(raw, true);
        if (!parsed.valid) {
          onNotice?.(`Signal for ${analyte} must be a valid number.`);
          return;
        }
        if (parsed.empty || parsed.value === undefined) {
          delete targetRow.signals[analyte];
        } else {
          targetRow.signals[analyte] = parsed.value;
        }
      }

      updated[row] = targetRow;
      onChange(updated);
    },
    [analytes, onChange, onNotice, rows, unit],
  );

  const handlePaste = useCallback(
    (target: Item, values: readonly (readonly string[])[]) => {
      if (values.length === 0 || values[0]?.length === 0) return false;

      const [startCol, startRow] = target;
      const updated = [...rows];
      let invalidCount = 0;

      values.forEach((rowVals, rOffset) => {
        const targetRow = startRow + rOffset;

        while (updated.length <= targetRow) {
          updated.push({
            standardName: '',
            nominalConc: undefined,
            nominalConcManual: false,
            signals: {},
          });
        }

        const rowItem: StandardGroupRow = {
          ...updated[targetRow]!,
          signals: { ...updated[targetRow]!.signals },
        };

        rowVals.forEach((val, cOffset) => {
          const targetCol = startCol + cOffset;
          const clean = val.trim();

          if (targetCol === 0) {
            rowItem.standardName = clean;
            if (!rowItem.nominalConcManual) {
              const parsed = parseNominalFromName(clean);
              if (parsed !== undefined) {
                rowItem.nominalConc = parsed;
              }
            }
          } else if (targetCol === 1) {
            const parsed = parseOptionalNumberFromInput(clean, false);
            if (!parsed.valid) {
              invalidCount++;
              return;
            }
            // Explicit clipboard Nominal Conc always overrides auto-parsed Standard Name values.
            rowItem.nominalConc = parsed.value;
            rowItem.nominalConcManual = !parsed.empty;
          } else if (targetCol >= ANALYTE_START_COL) {
            const analyte = analytes[targetCol - ANALYTE_START_COL];
            if (!analyte) return;
            const parsed = parseOptionalNumberFromInput(clean, true);
            if (!parsed.valid) {
              invalidCount++;
              return;
            }
            if (parsed.empty || parsed.value === undefined) {
              delete rowItem.signals[analyte];
            } else {
              rowItem.signals[analyte] = parsed.value;
            }
          }
        });

        updated[targetRow] = rowItem;
      });

      onChange(updated);

      if (onNotice) {
        const colTitle = columns[startCol]?.title ?? `Column ${startCol + 1}`;
        const suffix =
          invalidCount > 0
            ? ` (${invalidCount} invalid ${invalidCount === 1 ? 'cell' : 'cells'} skipped)`
            : '';
        onNotice(
          `Pasted ${values.length} rows x ${values[0]?.length} columns at row ${startRow + 1}, ${colTitle}.${suffix}`,
        );
      }

      return false;
    },
    [analytes, columns, onChange, onNotice, rows],
  );

  const handleAddRow = useCallback(() => {
    const newRow: StandardGroupRow = {
      standardName: '',
      nominalConc: undefined,
      nominalConcManual: false,
      signals: {},
    };
    onChange([...rows, newRow]);
  }, [onChange, rows]);

  const handleDeleteSelected = useCallback(() => {
    const selectedRows = selection.rows.toArray();
    const minPointsMsg = 'Calibration curve requires at least 3 rows in the standards table.';

    if (selectedRows.length > 0) {
      if (rows.length - selectedRows.length < 3) {
        onNotice?.(minPointsMsg);
        return;
      }
      onChange(rows.filter((_, i) => !selectedRows.includes(i)));
      setSelection({
        columns: CompactSelection.empty(),
        rows: CompactSelection.empty(),
      });
      return;
    }

    if (selection.current) {
      const targetRow = selection.current.cell[1];
      if (rows.length <= 3) {
        onNotice?.(minPointsMsg);
        return;
      }
      onChange(rows.filter((_, i) => i !== targetRow));
    }
  }, [onChange, onNotice, rows, selection]);

  const handleDeleteCallback = useCallback(
    (sel: GridSelection) => {
      const minPointsMsg = 'Calibration curve requires at least 3 rows in the standards table.';

      if (sel.rows.length > 0) {
        const selectedRows = sel.rows.toArray();
        if (rows.length - selectedRows.length < 3) {
          onNotice?.(minPointsMsg);
          return false;
        }
        onChange(rows.filter((_, i) => !selectedRows.includes(i)));
        setSelection({
          columns: CompactSelection.empty(),
          rows: CompactSelection.empty(),
        });
        return true;
      }

      if (sel.current) {
        const { x, y, width, height } = sel.current.range;
        const updated = [...rows];
        let touched = false;

        for (let r = y; r < y + height; r++) {
          const target = updated[r];
          if (!target) continue;
          const nextRow: StandardGroupRow = {
            ...target,
            signals: { ...target.signals },
          };

          for (let c = x; c < x + width; c++) {
            if (c === 0) {
              nextRow.standardName = '';
              touched = true;
            } else if (c === 1) {
              nextRow.nominalConc = undefined;
              nextRow.nominalConcManual = false;
              touched = true;
            } else if (c >= ANALYTE_START_COL) {
              const analyte = analytes[c - ANALYTE_START_COL];
              if (analyte && nextRow.signals[analyte] !== undefined) {
                delete nextRow.signals[analyte];
                touched = true;
              }
            }
          }

          updated[r] = nextRow;
        }

        if (touched) {
          onChange(updated);
          return true;
        }
      }

      return false;
    },
    [analytes, onChange, onNotice, rows],
  );

  const selectedRowCount = selection.rows.length;
  const activeCellDesc = useMemo(() => {
    if (selection.current) {
      const [col, row] = selection.current.cell;
      const colTitle = columns[col]?.title ?? `Column ${col + 1}`;
      return `Active cell: Row ${row + 1}, ${colTitle}`;
    }
    return 'Select a cell or range to copy or paste';
  }, [columns, selection]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-3 py-1.5 text-xs rounded-lg border border-slate-400 bg-white hover:bg-slate-50 font-medium text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Add Standard Row
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={rows.length <= 3}
            className={`inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-3 py-1.5 text-xs rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              selectedRowCount > 0
                ? 'border-red-700 bg-red-50 text-red-800 hover:bg-red-100 font-medium'
                : 'border-slate-400 bg-white hover:bg-slate-50 text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <Trash className="w-3.5 h-3.5" aria-hidden="true" />
            {selectedRowCount > 0
              ? `Delete ${selectedRowCount} ${selectedRowCount === 1 ? 'Row' : 'Rows'}`
              : 'Delete Selected Row'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-700">
          <span className="flex items-center gap-1">
            <ViewGrid className="w-3.5 h-3.5 text-slate-700 shrink-0" aria-hidden="true" />
            <span>{activeCellDesc}</span>
          </span>
          <span className="text-slate-500" aria-hidden="true">
            |
          </span>
          <span className="text-slate-700">
            {rows.length} rows &times; {columns.length} columns
          </span>
        </div>
      </div>

      <div className="w-full h-[280px] rounded-lg border border-slate-300 overflow-hidden bg-white">
        <DataEditor
          width="100%"
          height="100%"
          columns={columns}
          rows={rows.length}
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
