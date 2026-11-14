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
import { Plus, Trash2, Grid, ClipboardCopy } from 'lucide-react';

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
        title: `Label Standar (${unit})`,
        width: colWidths.label ?? 150,
      },
    ];

    analytes.forEach((analyte) => {
      cols.push({
        id: analyte,
        title: `${analyte} (cps)`,
        width: colWidths[analyte] ?? 130,
      });
    });

    return cols;
  }, [analytes, colWidths]);

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
          startCol === 0 ? 'Label' : (analytes[startCol - 1] ?? `Kolom ${startCol + 1}`);
        onNotice(
          `Berhasil menempelkan ${values.length} baris x ${values[0]?.length} kolom dari Excel ke sel (baris ${startRow + 1}, ${colTitle}).`,
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

    if (selectedRows.length > 0) {
      if (standards.length - selectedRows.length < 3) {
        alert('Deret kalibrasi membutuhkan minimal 3 titik data (df >= 1).');
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
        alert('Deret kalibrasi membutuhkan minimal 3 titik data (df >= 1).');
        return;
      }
      const updated = standards.filter((_, i) => i !== targetRow);
      onChange(updated);
    }
  }, [standards, selection, onChange]);

  const handleDeleteCallback = useCallback(
    (sel: GridSelection) => {
      if (sel.rows.length > 0) {
        const selectedRows = sel.rows.toArray();
        if (standards.length - selectedRows.length < 3) {
          alert('Deret kalibrasi membutuhkan minimal 3 titik data (df >= 1).');
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
    [standards, analytes, onChange],
  );

  const selectedRowCount = selection.rows.length;
  const activeCellDesc = useMemo(() => {
    if (selection.current) {
      const [col, row] = selection.current.cell;
      const colTitle = col === 0 ? 'Label' : `${analytes[col - 1]} (cps)`;
      return `Sel Aktif: Baris ${row + 1}, ${colTitle || `Kolom ${col + 1}`}`;
    }
    return 'Pilih sel atau blok rentang untuk copy/paste';
  }, [selection, analytes]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-medium text-slate-700 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Titik Standar
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={standards.length <= 3}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border transition-colors shadow-2xs ${
              selectedRowCount > 0
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-medium'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {selectedRowCount > 0 ? `Hapus (${selectedRowCount}) Baris` : 'Hapus Baris'}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <Grid className="w-3 h-3 text-slate-400" />
            {activeCellDesc}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-400">
            {standards.length} baris &times; {columns.length} kolom
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
            hint: '+ Tambah titik standar...',
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

      <div className="flex items-start gap-2 text-[11px] font-mono text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <ClipboardCopy className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <div>
            <strong>Format Kolom Excel:</strong>{' '}
            <code className="text-slate-700 bg-white px-1 py-0.5 rounded border border-slate-200">
              Label | {analytes.join(' | ')}
            </code>
            . Blok di Excel &rarr;{' '}
            <kbd className="px-1 py-0.2 bg-white rounded border border-slate-300">Ctrl+C</kbd>{' '}
            &rarr; Klik sel target di tabel &rarr;{' '}
            <kbd className="px-1 py-0.2 bg-white rounded border border-slate-300">Ctrl+V</kbd>.
          </div>
          <div className="text-slate-400">
            Klik ganda atau ketik langsung angka pada sel untuk mengedit. Konsentrasi nominal
            otomatis diekstrak dari label (Blank &rarr; 0 ppb, Std 10 &rarr; 10 ppb, dst.).
          </div>
        </div>
      </div>
    </div>
  );
}
