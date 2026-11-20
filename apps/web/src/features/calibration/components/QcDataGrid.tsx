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
import { Plus, Trash2, Grid, ClipboardCopy, ShieldCheck } from 'lucide-react';
import {
  MAX_BATCH_SAMPLE_ROWS,
  QC_SAMPLE_TYPES,
  isParentAllowed,
  isWeightRequired,
  parseSampleTypeFromSet,
  sanitizeSampleRow,
  type SampleRowState,
} from '../utils/sampleValidation';
import { gridDropdownRenderer, type DropdownCellOption } from './gridDropdownCell';
import {
  SAMPLE_GRID_THEME,
  buildAnalyteReadingHeader,
  buildBlockedTextCell,
  buildDropdownCell,
  buildSampleTypeOptions,
  extractCellNumber,
  parseNumberFromInput,
  type InputMode,
  type SignalUnit,
  type SolutionConcUnit,
} from './sampleGridShared';

interface QcDataGridProps {
  qcRows: SampleRowState[];
  analytes: string[];
  availableParents: string[];
  totalBatchRows: number;
  unit?: SolutionConcUnit;
  inputMode?: InputMode;
  signalUnit?: SignalUnit;
  onChange: (updated: SampleRowState[]) => void;
  onNotice?: (message: string) => void;
}

const QC_TYPE_OPTIONS = buildSampleTypeOptions(QC_SAMPLE_TYPES);

export function QcDataGrid({
  qcRows,
  analytes,
  availableParents,
  totalBatchRows,
  unit = 'ppb',
  inputMode = 'raw_signal',
  signalUnit = 'cps',
  onChange,
  onNotice,
}: QcDataGridProps) {
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    id: 125,
    type: 135,
    parent: 135,
    weight: 92,
    vol: 84,
    df: 68,
  });

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const analyteStartCol = 1;
  const typeCol = analyteStartCol + analytes.length;
  const parentCol = typeCol + 1;
  const weightCol = typeCol + 2;
  const volCol = typeCol + 3;
  const dfCol = typeCol + 4;

  const parentDropdownOptions: DropdownCellOption[] = useMemo(
    () =>
      availableParents.map((sampleId) => ({
        value: sampleId,
        label: sampleId,
        description: 'Sampel acuan dari Tabel Sampel',
        tone: 'neutral',
      })),
    [availableParents],
  );

  const columns: GridColumn[] = useMemo(() => {
    const cols: GridColumn[] = [{ id: 'id', title: 'Sample ID', width: colWidths.id ?? 125 }];

    analytes.forEach((analyte) => {
      const colId = `analyte_${analyte}`;
      cols.push({
        id: colId,
        title: buildAnalyteReadingHeader(analyte, inputMode, unit, signalUnit),
        width: colWidths[colId] ?? 120,
      });
    });

    cols.push(
      { id: 'type', title: 'Tipe QC', width: colWidths.type ?? 135 },
      { id: 'parent', title: 'Parent', width: colWidths.parent ?? 135 },
      { id: 'weight', title: 'Bobot (g)', width: colWidths.weight ?? 92 },
      { id: 'vol', title: 'Vol (mL)', width: colWidths.vol ?? 84 },
      { id: 'df', title: 'dF', width: colWidths.df ?? 68 },
    );

    return cols;
  }, [analytes, colWidths, inputMode, signalUnit, unit]);

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
      const item = qcRows[row];
      if (!item) {
        return { kind: GridCellKind.Loading, allowOverlay: false };
      }

      if (col === 0) {
        return {
          kind: GridCellKind.Text,
          data: item.id,
          displayData: item.id,
          allowOverlay: true,
          readonly: false,
        };
      }

      if (col >= analyteStartCol && col < typeCol) {
        const analyteName = analytes[col - analyteStartCol];
        const reading = analyteName ? item.readings[analyteName] : undefined;
        return {
          kind: GridCellKind.Number,
          data: reading,
          displayData: reading !== undefined ? String(reading) : '',
          allowOverlay: true,
          readonly: false,
        };
      }

      if (col === typeCol) {
        return buildDropdownCell({
          value: item.type,
          options: QC_TYPE_OPTIONS,
          ariaLabel: `Pilih tipe QC untuk ${item.id || `baris ${row + 1}`}`,
        });
      }

      if (col === parentCol) {
        if (!isParentAllowed(item.type)) {
          return buildBlockedTextCell('--');
        }
        return buildDropdownCell({
          value: item.parent ?? '',
          options: parentDropdownOptions,
          placeholder: 'Pilih sample...',
          emptyMessage: 'Belum ada baris bertipe sample di Tabel Sampel.',
          ariaLabel: `Pilih Parent sampel untuk ${item.id || `baris ${row + 1}`}`,
          warnIfUnlisted: true,
        });
      }

      if (col === weightCol) {
        if (!isWeightRequired(item.type)) {
          return buildBlockedTextCell('--');
        }
        return {
          kind: GridCellKind.Number,
          data: item.weight,
          displayData: item.weight.toFixed(4),
          allowOverlay: true,
          readonly: false,
        };
      }

      if (col === volCol) {
        return {
          kind: GridCellKind.Number,
          data: item.vol,
          displayData: String(item.vol),
          allowOverlay: true,
          readonly: false,
        };
      }

      return {
        kind: GridCellKind.Number,
        data: item.df,
        displayData: String(item.df),
        allowOverlay: true,
        readonly: false,
      };
    },
    [analytes, parentCol, parentDropdownOptions, qcRows, typeCol, volCol, weightCol],
  );

  const validateCell = useCallback(
    (cell: Item): boolean => {
      const [col, row] = cell;
      const target = qcRows[row];
      if (!target) return false;
      if (col === parentCol && !isParentAllowed(target.type)) {
        return false;
      }
      if (col === weightCol && !isWeightRequired(target.type)) {
        return false;
      }
      return true;
    },
    [parentCol, qcRows, weightCol],
  );

  const handleCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell;
      const updated = [...qcRows];
      const target = updated[row];
      if (!target) return;

      if (col === 0 && newValue.kind === GridCellKind.Text) {
        updated[row] = { ...target, id: newValue.data.trim() };
      } else if (col >= analyteStartCol && col < typeCol) {
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
      } else if (col === typeCol) {
        let rawType = '';
        if (newValue.kind === GridCellKind.Custom) {
          rawType = String((newValue.data as { value?: string }).value ?? '');
        } else if (newValue.kind === GridCellKind.Text) {
          rawType = newValue.data;
        }
        const nextType = parseSampleTypeFromSet(rawType, QC_SAMPLE_TYPES, target.type);
        const restoredWeight =
          !isWeightRequired(target.type) && isWeightRequired(nextType) && target.weight <= 0
            ? 0.2
            : target.weight;
        updated[row] = sanitizeSampleRow({
          ...target,
          type: nextType,
          weight: restoredWeight,
        });
      } else if (col === parentCol) {
        if (!isParentAllowed(target.type)) {
          return;
        }
        let nextParent = '';
        if (newValue.kind === GridCellKind.Custom) {
          nextParent = String((newValue.data as { value?: string }).value ?? '').trim();
        } else if (newValue.kind === GridCellKind.Text) {
          const clean = newValue.data.trim();
          nextParent = clean === '-' || clean === '--' ? '' : clean;
        }
        updated[row] = { ...target, parent: nextParent };
      } else if (col === weightCol) {
        if (!isWeightRequired(target.type)) {
          return;
        }
        updated[row] = {
          ...target,
          weight: extractCellNumber(newValue, target.weight, true),
        };
      } else if (col === volCol) {
        updated[row] = {
          ...target,
          vol: extractCellNumber(newValue, target.vol, true),
        };
      } else if (col === dfCol) {
        updated[row] = {
          ...target,
          df: extractCellNumber(newValue, target.df, true),
        };
      }

      onChange(updated);
    },
    [analytes, dfCol, onChange, parentCol, qcRows, typeCol, volCol, weightCol],
  );

  const handlePaste = useCallback(
    (target: Item, values: readonly (readonly string[])[]) => {
      if (values.length === 0 || values[0]?.length === 0) return false;

      const [startCol, startRow] = target;
      const updated = [...qcRows];
      const maxQcRowsAllowed = Math.max(
        qcRows.length,
        MAX_BATCH_SAMPLE_ROWS - (totalBatchRows - qcRows.length),
      );
      let appliedRows = 0;

      values.forEach((rowVals, rOffset) => {
        const targetRow = startRow + rOffset;
        if (targetRow >= maxQcRowsAllowed) return;

        while (updated.length <= targetRow) {
          const nextIdx = updated.length + 1;
          updated.push({
            id: `QC${nextIdx}`,
            type: 'ccv',
            parent: '',
            weight: 0.2,
            vol: 50,
            df: 1,
            readings: {},
          });
        }

        const rowItem: SampleRowState = {
          ...updated[targetRow]!,
          readings: { ...updated[targetRow]!.readings },
        };

        rowVals.forEach((val, cOffset) => {
          const targetCol = startCol + cOffset;
          const clean = val.trim();

          if (targetCol === 0) {
            rowItem.id = clean || rowItem.id;
          } else if (targetCol >= analyteStartCol && targetCol < typeCol) {
            const analyteName = analytes[targetCol - analyteStartCol];
            if (analyteName && clean !== '') {
              rowItem.readings[analyteName] = parseNumberFromInput(
                clean,
                rowItem.readings[analyteName] ?? 0,
                false,
              );
            }
          } else if (targetCol === typeCol) {
            rowItem.type = parseSampleTypeFromSet(clean, QC_SAMPLE_TYPES, rowItem.type);
          } else if (targetCol === parentCol) {
            if (isParentAllowed(rowItem.type)) {
              rowItem.parent = clean === '-' || clean === '--' ? '' : clean;
            }
          } else if (targetCol === weightCol) {
            if (isWeightRequired(rowItem.type)) {
              rowItem.weight = parseNumberFromInput(clean, rowItem.weight, true);
            }
          } else if (targetCol === volCol) {
            rowItem.vol = parseNumberFromInput(clean, rowItem.vol, true);
          } else if (targetCol === dfCol) {
            rowItem.df = parseNumberFromInput(clean, rowItem.df, true);
          }
        });

        updated[targetRow] = sanitizeSampleRow(rowItem);
        appliedRows++;
      });

      onChange(updated);

      if (onNotice) {
        onNotice(
          `Berhasil menempelkan ${appliedRows} baris QC dari clipboard ke baris ${startRow + 1}.`,
        );
      }

      return false;
    },
    [
      analytes,
      dfCol,
      onChange,
      onNotice,
      parentCol,
      qcRows,
      totalBatchRows,
      typeCol,
      volCol,
      weightCol,
    ],
  );

  const handleAddQcRow = useCallback(() => {
    if (totalBatchRows >= MAX_BATCH_SAMPLE_ROWS) {
      onNotice?.(
        `Batas maksimum ${MAX_BATCH_SAMPLE_ROWS} baris gabungan sampel dan QC tercapai (Invariant T2).`,
      );
      return;
    }

    const nextIdx = qcRows.length + 1;
    const newRow: SampleRowState = {
      id: `CCV${nextIdx}`,
      type: 'ccv',
      parent: '',
      weight: 0.2,
      vol: 50,
      df: 1,
      readings: {},
    };

    onChange([...qcRows, newRow]);
  }, [onChange, onNotice, qcRows, totalBatchRows]);

  const handleDeleteSelected = useCallback(() => {
    const selectedRows = selection.rows.toArray();

    if (selectedRows.length > 0) {
      onChange(qcRows.filter((_, i) => !selectedRows.includes(i)));
      setSelection({
        columns: CompactSelection.empty(),
        rows: CompactSelection.empty(),
      });
      return;
    }

    if (selection.current) {
      const targetRow = selection.current.cell[1];
      onChange(qcRows.filter((_, i) => i !== targetRow));
    }
  }, [onChange, qcRows, selection]);

  const handleDeleteCallback = useCallback(
    (sel: GridSelection) => {
      if (sel.rows.length > 0) {
        const selectedRows = sel.rows.toArray();
        onChange(qcRows.filter((_, i) => !selectedRows.includes(i)));
        setSelection({
          columns: CompactSelection.empty(),
          rows: CompactSelection.empty(),
        });
        return true;
      }

      if (sel.current) {
        const [col, row] = sel.current.cell;
        const target = qcRows[row];
        if (!target) return false;

        if (col === parentCol) {
          if (!isParentAllowed(target.type)) return false;
          const updated = [...qcRows];
          updated[row] = { ...target, parent: '' };
          onChange(updated);
          return true;
        }

        if (col >= analyteStartCol && col < typeCol) {
          const analyteName = analytes[col - analyteStartCol];
          if (analyteName) {
            const updated = [...qcRows];
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
    [analytes, onChange, parentCol, qcRows, typeCol],
  );

  const selectedRowCount = selection.rows.length;
  const activeCellDesc = useMemo(() => {
    if (selection.current) {
      const [col, row] = selection.current.cell;
      const colTitle = columns[col]?.title ?? `Kolom ${col + 1}`;
      return `Sel Aktif: Baris ${row + 1}, ${colTitle}`;
    }
    return 'Pilih sel atau blok rentang QC';
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
            onClick={handleAddQcRow}
            disabled={totalBatchRows >= MAX_BATCH_SAMPLE_ROWS}
            className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs rounded-lg border border-slate-500 bg-white hover:bg-slate-50 font-medium text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Tambah Baris QC
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={qcRows.length === 0}
            className={`inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              selectedRowCount > 0
                ? 'border-red-700 bg-red-50 text-red-700 hover:bg-red-100 font-medium'
                : 'border-slate-500 bg-white hover:bg-slate-50 text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            {selectedRowCount > 0 ? `Hapus (${selectedRowCount}) Baris` : 'Hapus Baris'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-700">
          <span className="flex items-center gap-1">
            <Grid className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            {activeCellDesc}
          </span>
          <span className="text-slate-400" aria-hidden="true">
            |
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            {qcRows.length} Baris QC
          </span>
        </div>
      </div>

      {qcRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-400 bg-slate-50 p-6 text-center space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              Belum ada baris kontrol mutu (Blanko Metode, CCV, Spike, Duplo)
            </p>
            <p className="text-xs text-slate-700 max-w-lg mx-auto">
              Tambahkan minimal 1 baris{' '}
              <code className="font-mono text-slate-900">blank_method</code> untuk koreksi blanko,
              serta baris <code className="font-mono text-slate-900">ccv</code>,{' '}
              <code className="font-mono text-slate-900">spike</code>, atau{' '}
              <code className="font-mono text-slate-900">duplicate</code> sesuai profil QC.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddQcRow}
            disabled={totalBatchRows >= MAX_BATCH_SAMPLE_ROWS}
            className="inline-flex items-center gap-1.5 min-h-11 px-4 py-2 text-xs rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Tambah Baris QC Pertama
          </button>
        </div>
      ) : (
        <div className="w-full h-[240px] rounded-lg border border-slate-300 overflow-hidden bg-white">
          <DataEditor
            width="100%"
            height="100%"
            columns={columns}
            rows={qcRows.length}
            getCellContent={getCellContent}
            validateCell={validateCell}
            onCellEdited={handleCellEdited}
            onPaste={handlePaste}
            onRowAppended={handleAddQcRow}
            trailingRowOptions={{
              tint: true,
              hint: 'Tambah QC...',
              sticky: false,
            }}
            rowMarkers="both"
            getCellsForSelection={true}
            gridSelection={selection}
            onGridSelectionChange={setSelection}
            onColumnResize={handleColumnResize}
            onDelete={handleDeleteCallback}
            customRenderers={[gridDropdownRenderer]}
            theme={SAMPLE_GRID_THEME}
            editOnType={true}
            cellActivationBehavior="second-click"
            keybindings={{ downFill: true, rightFill: true }}
          />
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-300">
        <ClipboardCopy className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1 leading-relaxed">
          <div>
            <strong>Format Kolom Excel (Tabel QC):</strong>{' '}
            <code className="font-mono text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-300">
              Sample ID | {readingHeaderPreview.join(' | ')} | Tipe QC | Parent | Bobot (g) | Vol
              (mL) | dF
            </code>
          </div>
          <div className="text-slate-600">
            Kolom <strong>Parent</strong> diblokir (<code className="font-mono">--</code>) untuk{' '}
            <code className="font-mono text-slate-900">blank_method</code> dan{' '}
            <code className="font-mono text-slate-900">ccv</code>. Kolom <strong>Bobot (g)</strong>{' '}
            diblokir (<code className="font-mono">--</code>) untuk{' '}
            <code className="font-mono text-slate-900">blank_method</code> karena blanko metode
            tidak memiliki bobot sampel padatan.
          </div>
        </div>
      </div>
    </div>
  );
}
