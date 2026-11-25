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
} from '@glideapps/glide-data-grid';
import { Plus, Trash, ViewGrid, PasteClipboard, ShieldCheck } from 'iconoir-react';
import {
  MAX_BATCH_SAMPLE_ROWS,
  sanitizeSampleRow,
  type SampleRowState,
  type SampleType,
} from '../utils/sampleValidation';
import {
  SAMPLE_GRID_THEME,
  buildAnalyteReadingHeader,
  extractCellNumber,
  parseNumberFromInput,
  type InputMode,
  type SignalUnit,
  type SolutionConcUnit,
} from './sampleGridShared';

export type { SampleRowState, SampleType };

interface SampleDataGridProps {
  samples: SampleRowState[];
  analytes: string[];
  totalBatchRows: number;
  unit?: SolutionConcUnit;
  inputMode?: InputMode;
  signalUnit?: SignalUnit;
  onChange: (updated: SampleRowState[]) => void;
  onNotice?: (message: string) => void;
}

export function SampleDataGrid({
  samples,
  analytes,
  totalBatchRows,
  unit = 'ppb',
  inputMode = 'raw_signal',
  signalUnit = 'cps',
  onChange,
  onNotice,
}: SampleDataGridProps) {
  const [showLabSampleId, setShowLabSampleId] = useState(false);
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    id: 125,
    labSampleId: 120,
    weight: 92,
    vol: 84,
    df: 68,
  });

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const labOffset = showLabSampleId ? 1 : 0;
  const analyteStartCol = 1 + labOffset;
  const weightCol = analyteStartCol + analytes.length;
  const volCol = weightCol + 1;
  const dfCol = weightCol + 2;

  const columns: GridColumn[] = useMemo(() => {
    const cols: GridColumn[] = [{ id: 'id', title: 'Sample ID', width: colWidths.id ?? 125 }];

    if (showLabSampleId) {
      cols.push({
        id: 'labSampleId',
        title: 'Lab Sample ID',
        width: colWidths.labSampleId ?? 120,
      });
    }

    analytes.forEach((analyte) => {
      const colId = `analyte_${analyte}`;
      cols.push({
        id: colId,
        title: buildAnalyteReadingHeader(analyte, inputMode, unit, signalUnit),
        width: colWidths[colId] ?? 120,
      });
    });

    cols.push(
      { id: 'weight', title: 'Weight (g)', width: colWidths.weight ?? 92 },
      { id: 'vol', title: 'Vol (mL)', width: colWidths.vol ?? 84 },
      { id: 'df', title: 'dF', width: colWidths.df ?? 68 },
    );

    return cols;
  }, [analytes, colWidths, inputMode, showLabSampleId, signalUnit, unit]);

  const handleColumnResize = useCallback((column: GridColumn, newSize: number) => {
    if (column.id) {
      setColWidths((prev) => ({
        ...prev,
        [column.id!]: Math.max(60, newSize),
      }));
    }
  }, []);

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const sample = samples[row];
      if (!sample) {
        return { kind: GridCellKind.Loading, allowOverlay: false };
      }

      if (col === 0) {
        return {
          kind: GridCellKind.Text,
          data: sample.id,
          displayData: sample.id,
          allowOverlay: true,
          readonly: false,
        };
      }

      if (showLabSampleId && col === 1) {
        const labId = sample.labSampleId ?? '';
        return {
          kind: GridCellKind.Text,
          data: labId,
          displayData: labId || '-',
          allowOverlay: true,
          readonly: false,
        };
      }

      if (col >= analyteStartCol && col < weightCol) {
        const analyteName = analytes[col - analyteStartCol];
        const reading = analyteName ? sample.readings[analyteName] : undefined;
        return {
          kind: GridCellKind.Number,
          data: reading,
          displayData: reading !== undefined ? String(reading) : '',
          allowOverlay: true,
          readonly: false,
        };
      }

      if (col === weightCol) {
        const weight = sample.weight ?? 0.2;
        return {
          kind: GridCellKind.Number,
          data: weight,
          displayData: weight.toFixed(4),
          allowOverlay: true,
          readonly: false,
        };
      }

      if (col === volCol) {
        const vol = sample.vol ?? 50;
        return {
          kind: GridCellKind.Number,
          data: vol,
          displayData: String(vol),
          allowOverlay: true,
          readonly: false,
        };
      }

      const df = sample.df ?? 1;
      return {
        kind: GridCellKind.Number,
        data: df,
        displayData: String(df),
        allowOverlay: true,
        readonly: false,
      };
    },
    [analyteStartCol, analytes, samples, showLabSampleId, volCol, weightCol],
  );

  const handleCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell;
      const updated = [...samples];
      const target = updated[row];
      if (!target) return;

      if (col === 0 && newValue.kind === GridCellKind.Text) {
        updated[row] = { ...target, id: newValue.data.trim() };
      } else if (showLabSampleId && col === 1 && newValue.kind === GridCellKind.Text) {
        const clean = newValue.data.trim();
        updated[row] = { ...target, labSampleId: clean === '-' ? '' : clean };
      } else if (col >= analyteStartCol && col < weightCol) {
        const analyteName = analytes[col - analyteStartCol];
        if (analyteName) {
          const val = extractCellNumber(newValue, target.readings[analyteName] ?? 0, false);
          updated[row] = {
            ...target,
            readings: {
              ...target.readings,
              [analyteName]: val,
            },
          };
        }
      } else if (col === weightCol) {
        updated[row] = {
          ...target,
          weight: extractCellNumber(newValue, target.weight ?? 0.2, true),
        };
      } else if (col === volCol) {
        updated[row] = {
          ...target,
          vol: extractCellNumber(newValue, target.vol ?? 50, true),
        };
      } else if (col === dfCol) {
        updated[row] = {
          ...target,
          df: extractCellNumber(newValue, target.df ?? 1, true),
        };
      }

      onChange(updated);
    },
    [analyteStartCol, analytes, dfCol, onChange, samples, showLabSampleId, volCol, weightCol],
  );

  const handlePaste = useCallback(
    (target: Item, values: readonly (readonly string[])[]) => {
      if (values.length === 0 || values[0]?.length === 0) return false;

      const [startCol, startRow] = target;
      const updated = [...samples];
      const maxRoutineRowsAllowed = Math.max(
        samples.length,
        MAX_BATCH_SAMPLE_ROWS - (totalBatchRows - samples.length),
      );
      let appliedRows = 0;

      values.forEach((rowVals, rOffset) => {
        const targetRow = startRow + rOffset;
        if (targetRow >= maxRoutineRowsAllowed) return;

        while (updated.length <= targetRow) {
          const nextIdx = updated.length + 1;
          updated.push({
            id: `S${nextIdx}`,
            labSampleId: '',
            type: 'sample',
            parent: '',
            weight: 0.2,
            vol: 50,
            df: 1,
            readings: {},
          });
        }

        const rowItem: SampleRowState = {
          ...updated[targetRow]!,
          type: 'sample',
          readings: { ...updated[targetRow]!.readings },
        };

        rowVals.forEach((val, cOffset) => {
          const targetCol = startCol + cOffset;
          const clean = val.trim();

          if (targetCol === 0) {
            rowItem.id = clean || rowItem.id;
          } else if (showLabSampleId && targetCol === 1) {
            rowItem.labSampleId = clean === '-' ? '' : clean;
          } else if (targetCol >= analyteStartCol && targetCol < weightCol) {
            const analyteName = analytes[targetCol - analyteStartCol];
            if (analyteName && clean !== '') {
              rowItem.readings[analyteName] = parseNumberFromInput(
                clean,
                rowItem.readings[analyteName] ?? 0,
                false,
              );
            }
          } else if (targetCol === weightCol) {
            rowItem.weight = parseNumberFromInput(clean, rowItem.weight ?? 0.2, true);
          } else if (targetCol === volCol) {
            rowItem.vol = parseNumberFromInput(clean, rowItem.vol ?? 50, true);
          } else if (targetCol === dfCol) {
            rowItem.df = parseNumberFromInput(clean, rowItem.df ?? 1, true);
          }
        });

        updated[targetRow] = sanitizeSampleRow(rowItem);
        appliedRows++;
      });

      onChange(updated);

      if (onNotice) {
        onNotice(
          `Pasted ${appliedRows} sample ${appliedRows === 1 ? 'row' : 'rows'} from clipboard at row ${startRow + 1}.`,
        );
      }

      return false;
    },
    [
      analyteStartCol,
      analytes,
      dfCol,
      onChange,
      onNotice,
      samples,
      showLabSampleId,
      totalBatchRows,
      volCol,
      weightCol,
    ],
  );

  const handleAddSample = useCallback(() => {
    if (totalBatchRows >= MAX_BATCH_SAMPLE_ROWS) {
      onNotice?.(
        `Maximum limit of ${MAX_BATCH_SAMPLE_ROWS} combined sample and QC rows reached.`,
      );
      return;
    }

    const nextIdx = samples.length + 1;
    const newSample: SampleRowState = {
      id: `S${nextIdx}`,
      labSampleId: '',
      type: 'sample',
      parent: '',
      weight: 0.2,
      vol: 50,
      df: 1,
      readings: {},
    };

    onChange([...samples, newSample]);
  }, [onChange, onNotice, samples, totalBatchRows]);

  const handleDeleteSelected = useCallback(() => {
    const selectedRows = selection.rows.toArray();

    if (selectedRows.length > 0) {
      if (samples.length - selectedRows.length < 1) {
        onNotice?.('Sample Table must contain at least 1 test sample row.');
        return;
      }
      onChange(samples.filter((_, i) => !selectedRows.includes(i)));
      setSelection({
        columns: CompactSelection.empty(),
        rows: CompactSelection.empty(),
      });
      return;
    }

    if (selection.current) {
      const targetRow = selection.current.cell[1];
      if (samples.length <= 1) {
        onNotice?.('Sample Table must contain at least 1 test sample row.');
        return;
      }
      onChange(samples.filter((_, i) => i !== targetRow));
    }
  }, [onChange, onNotice, samples, selection]);

  const handleDeleteCallback = useCallback(
    (sel: GridSelection) => {
      if (sel.rows.length > 0) {
        const selectedRows = sel.rows.toArray();
        if (samples.length - selectedRows.length < 1) {
          onNotice?.('Sample Table must contain at least 1 test sample row.');
          return false;
        }
        onChange(samples.filter((_, i) => !selectedRows.includes(i)));
        setSelection({
          columns: CompactSelection.empty(),
          rows: CompactSelection.empty(),
        });
        return true;
      }

      if (sel.current) {
        const [col, row] = sel.current.cell;
        const target = samples[row];
        if (!target) return false;

        if (showLabSampleId && col === 1) {
          const updated = [...samples];
          updated[row] = { ...target, labSampleId: '' };
          onChange(updated);
          return true;
        }

        if (col >= analyteStartCol && col < weightCol) {
          const analyteName = analytes[col - analyteStartCol];
          if (analyteName) {
            const updated = [...samples];
            const nextReadings = { ...target.readings };
            delete nextReadings[analyteName];
            updated[row] = { ...target, readings: nextReadings };
            onChange(updated);
            return true;
          }
        }
      }

      return false;
    },
    [analyteStartCol, analytes, onChange, onNotice, samples, showLabSampleId, weightCol],
  );

  const selectedRowCount = selection.rows.length;
  const activeCellDesc = useMemo(() => {
    if (selection.current) {
      const [col, row] = selection.current.cell;
      const colTitle = columns[col]?.title ?? `Column ${col + 1}`;
      return `Active Cell: Row ${row + 1}, ${colTitle}`;
    }
    return 'Select a cell or range to copy/paste';
  }, [columns, selection]);

  const readingHeaderPreview = analytes.map((a) =>
    buildAnalyteReadingHeader(a, inputMode, unit, signalUnit),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddSample}
            disabled={totalBatchRows >= MAX_BATCH_SAMPLE_ROWS}
            className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs rounded-lg border border-slate-500 bg-white hover:bg-slate-50 font-medium text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Add Sample Row
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={samples.length <= 1}
            className={`inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              selectedRowCount > 0
                ? 'border-red-700 bg-red-50 text-red-700 hover:bg-red-100 font-medium'
                : 'border-slate-500 bg-white hover:bg-slate-50 text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <Trash className="w-3.5 h-3.5" aria-hidden="true" />
            {selectedRowCount > 0
              ? `Delete ${selectedRowCount} ${selectedRowCount === 1 ? 'Row' : 'Rows'}`
              : 'Delete Row'}
          </button>
          <label className="inline-flex items-center gap-2 min-h-9 px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showLabSampleId}
              onChange={(e) => setShowLabSampleId(e.target.checked)}
              className="w-3.5 h-3.5 accent-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            />
            <span>Show Lab Sample ID Column</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-700">
          <span className="flex items-center gap-1">
            <ViewGrid className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            {activeCellDesc}
          </span>
          <span className="text-slate-400" aria-hidden="true">
            |
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            {totalBatchRows} / {MAX_BATCH_SAMPLE_ROWS} Total Rows
          </span>
        </div>
      </div>

      <div className="w-full h-[300px] rounded-lg border border-slate-300 overflow-hidden bg-white">
        <DataEditor
          width="100%"
          height="100%"
          columns={columns}
          rows={samples.length}
          getCellContent={getCellContent}
          onCellEdited={handleCellEdited}
          onPaste={handlePaste}
          onRowAppended={handleAddSample}
          trailingRowOptions={{
            tint: true,
            hint: 'Add row...',
            sticky: false,
          }}
          rowMarkers="both"
          getCellsForSelection={true}
          gridSelection={selection}
          onGridSelectionChange={setSelection}
          onColumnResize={handleColumnResize}
          onDelete={handleDeleteCallback}
          theme={SAMPLE_GRID_THEME}
          editOnType={true}
          cellActivationBehavior="second-click"
          keybindings={{ downFill: true, rightFill: true }}
        />
      </div>

      <div className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-300">
        <div className="space-y-1 leading-relaxed">
          <div className="text-slate-600">
            <strong>Method blanks</strong> are managed in the Quality Control / QC Table below.
          </div>
        </div>
      </div>
    </div>
  );
}
