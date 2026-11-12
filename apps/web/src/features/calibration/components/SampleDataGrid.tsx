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
import { Plus, Trash2, Grid, ClipboardCopy, ShieldCheck } from 'lucide-react';

export interface SampleRowState {
  id: string;
  type: 'sample' | 'blank_method' | 'ccv' | 'spike' | 'duplicate';
  parent?: string;
  weight: number;
  vol: number;
  df: number;
  readings: Record<string, number>;
}

interface SampleDataGridProps {
  samples: SampleRowState[];
  analytes: string[];
  onChange: (updated: SampleRowState[]) => void;
  onNotice?: (message: string) => void;
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

const BASE_COL_NAMES = ['Sample ID', 'Tipe Sampel', 'Parent ID', 'Bobot (g)', 'Vol (mL)', 'dF'];

export function SampleDataGrid({
  samples,
  analytes,
  onChange,
  onNotice,
}: SampleDataGridProps) {
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    id: 110,
    type: 120,
    parent: 100,
    weight: 90,
    vol: 80,
    df: 60,
  });

  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  const columns: GridColumn[] = useMemo(() => {
    const cols: GridColumn[] = [
      { id: 'id', title: 'Sample ID', width: colWidths.id ?? 110 },
      { id: 'type', title: 'Tipe Sampel', width: colWidths.type ?? 120 },
      { id: 'parent', title: 'Parent ID', width: colWidths.parent ?? 100 },
      { id: 'weight', title: 'Bobot (g)', width: colWidths.weight ?? 90 },
      { id: 'vol', title: 'Vol (mL)', width: colWidths.vol ?? 80 },
      { id: 'df', title: 'dF', width: colWidths.df ?? 60 },
    ];

    analytes.forEach((analyte) => {
      const colId = `analyte_${analyte}`;
      cols.push({
        id: colId,
        title: `${analyte} (cps)`,
        width: colWidths[colId] ?? 110,
      });
    });

    return cols;
  }, [analytes, colWidths]);

  const handleColumnResize = useCallback((column: GridColumn, newSize: number) => {
    if (column.id) {
      setColWidths((prev) => ({
        ...prev,
        [column.id!]: Math.max(50, newSize),
      }));
    }
  }, []);

  const getCellContent = useCallback((cell: Item): GridCell => {
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
    if (col === 1) {
      return {
        kind: GridCellKind.Text,
        data: sample.type,
        displayData: sample.type,
        allowOverlay: true,
        readonly: false,
      };
    }
    if (col === 2) {
      const val = sample.parent || '-';
      return {
        kind: GridCellKind.Text,
        data: val,
        displayData: val,
        allowOverlay: true,
        readonly: false,
      };
    }
    if (col === 3) {
      return {
        kind: GridCellKind.Number,
        data: sample.weight,
        displayData: sample.weight.toFixed(4),
        allowOverlay: true,
        readonly: false,
      };
    }
    if (col === 4) {
      return {
        kind: GridCellKind.Number,
        data: sample.vol,
        displayData: String(sample.vol),
        allowOverlay: true,
        readonly: false,
      };
    }
    if (col === 5) {
      return {
        kind: GridCellKind.Number,
        data: sample.df,
        displayData: String(sample.df),
        allowOverlay: true,
        readonly: false,
      };
    }

    // col >= 6: readings for analytes
    const aIdx = col - 6;
    const aName = analytes[aIdx];
    const reading = aName ? (sample.readings[aName] ?? 0) : 0;

    return {
      kind: GridCellKind.Number,
      data: reading,
      displayData: String(reading),
      allowOverlay: true,
      readonly: false,
    };
  }, [samples, analytes]);

  const handleCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const updated = [...samples];
    const target = updated[row];
    if (!target) return;

    if (col === 0 && newValue.kind === GridCellKind.Text) {
      updated[row] = { ...target, id: newValue.data.trim() };
    } else if (col === 1 && newValue.kind === GridCellKind.Text) {
      const t = newValue.data.trim().toLowerCase() as SampleRowState['type'];
      const validTypes: SampleRowState['type'][] = ['sample', 'blank_method', 'ccv', 'spike', 'duplicate'];
      updated[row] = { ...target, type: validTypes.includes(t) ? t : 'sample' };
    } else if (col === 2 && newValue.kind === GridCellKind.Text) {
      const raw = newValue.data.trim();
      updated[row] = { ...target, parent: raw === '-' ? '' : raw };
    } else if (col === 3) {
      const val = typeof newValue.data === 'number' ? newValue.data : parseFloat(String(newValue.data)) || 0.2;
      updated[row] = { ...target, weight: val };
    } else if (col === 4) {
      const val = typeof newValue.data === 'number' ? newValue.data : parseFloat(String(newValue.data)) || 50;
      updated[row] = { ...target, vol: val };
    } else if (col === 5) {
      const val = typeof newValue.data === 'number' ? newValue.data : parseFloat(String(newValue.data)) || 1;
      updated[row] = { ...target, df: val };
    } else if (col >= 6) {
      const aIdx = col - 6;
      const aName = analytes[aIdx];
      if (aName) {
        const val = typeof newValue.data === 'number' ? newValue.data : parseFloat(String(newValue.data)) || 0;
        updated[row] = {
          ...target,
          readings: {
            ...target.readings,
            [aName]: val,
          },
        };
      }
    }

    onChange(updated);
  }, [samples, analytes, onChange]);

  const handlePaste = useCallback((target: Item, values: readonly (readonly string[])[]) => {
    if (values.length === 0 || values[0]?.length === 0) return false;

    const [startCol, startRow] = target;
    const updated = [...samples];

    values.forEach((rowVals, rOffset) => {
      const targetRow = startRow + rOffset;
      if (targetRow >= 250) return; // Invariant T2 Bounded Payload limit

      while (updated.length <= targetRow) {
        const nextIdx = updated.length + 1;
        const defaultReadings: Record<string, number> = {};
        analytes.forEach((a) => {
          defaultReadings[a] = 15.0;
        });

        updated.push({
          id: `S${nextIdx}`,
          type: 'sample',
          parent: '',
          weight: 0.2,
          vol: 50,
          df: 1,
          readings: defaultReadings,
        });
      }

      const sample = { ...updated[targetRow]!, readings: { ...updated[targetRow]!.readings } };

      rowVals.forEach((val, cOffset) => {
        const targetCol = startCol + cOffset;
        const clean = val.trim();

        if (targetCol === 0) {
          sample.id = clean || sample.id;
        } else if (targetCol === 1) {
          const t = clean.toLowerCase() as SampleRowState['type'];
          const validTypes: SampleRowState['type'][] = ['sample', 'blank_method', 'ccv', 'spike', 'duplicate'];
          sample.type = validTypes.includes(t) ? t : 'sample';
        } else if (targetCol === 2) {
          sample.parent = clean === '-' ? '' : clean;
        } else if (targetCol === 3) {
          sample.weight = parseFloat(clean) || 0.2;
        } else if (targetCol === 4) {
          sample.vol = parseFloat(clean) || 50;
        } else if (targetCol === 5) {
          sample.df = parseFloat(clean) || 1;
        } else if (targetCol >= 6) {
          const aIdx = targetCol - 6;
          const aName = analytes[aIdx];
          if (aName) {
            sample.readings[aName] = parseFloat(clean) || 0;
          }
        }
      });

      updated[targetRow] = sample;
    });

    onChange(updated);

    if (onNotice) {
      onNotice(
        `Berhasil menempelkan ${values.length} baris sampel dari Excel ke sel (baris ${startRow + 1}, kolom ${startCol + 1}).`
      );
    }

    return false;
  }, [samples, analytes, onChange, onNotice]);

  const handleAddSample = useCallback(() => {
    if (samples.length >= 250) {
      alert('Batas maksimum 250 baris sampel per batch (Invariant T2).');
      return;
    }
    const nextIdx = samples.length + 1;
    const defaultReadings: Record<string, number> = {};
    analytes.forEach((a) => {
      defaultReadings[a] = 15.0;
    });

    const newSample: SampleRowState = {
      id: `S${nextIdx}`,
      type: 'sample',
      parent: '',
      weight: 0.2,
      vol: 50,
      df: 1,
      readings: defaultReadings,
    };

    onChange([...samples, newSample]);
  }, [samples, analytes, onChange]);

  const handleDeleteSelected = useCallback(() => {
    const selectedRows = selection.rows.toArray();

    if (selectedRows.length > 0) {
      if (samples.length - selectedRows.length < 1) {
        alert('Minimal harus ada 1 sampel dalam batch.');
        return;
      }
      const updated = samples.filter((_, i) => !selectedRows.includes(i));
      onChange(updated);
      setSelection({
        columns: CompactSelection.empty(),
        rows: CompactSelection.empty(),
      });
      return;
    }

    if (selection.current) {
      const targetRow = selection.current.cell[1];
      if (samples.length <= 1) {
        alert('Minimal harus ada 1 sampel dalam batch.');
        return;
      }
      const updated = samples.filter((_, i) => i !== targetRow);
      onChange(updated);
    }
  }, [samples, selection, onChange]);

  const handleDeleteCallback = useCallback((sel: GridSelection) => {
    if (sel.rows.length > 0) {
      const selectedRows = sel.rows.toArray();
      if (samples.length - selectedRows.length < 1) {
        alert('Minimal harus ada 1 sampel dalam batch.');
        return false;
      }
      const updated = samples.filter((_, i) => !selectedRows.includes(i));
      onChange(updated);
      setSelection({
        columns: CompactSelection.empty(),
        rows: CompactSelection.empty(),
      });
      return true;
    }

    return false;
  }, [samples, onChange]);

  const selectedRowCount = selection.rows.length;
  const activeCellDesc = useMemo(() => {
    if (selection.current) {
      const [col, row] = selection.current.cell;
      const colTitle = col < 6 ? BASE_COL_NAMES[col] : `${analytes[col - 6]} (cps)`;
      return `Sel Aktif: Baris ${row + 1}, ${colTitle || `Kolom ${col + 1}`}`;
    }
    return 'Pilih sel atau blok rentang sampel';
  }, [selection, analytes]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleAddSample}
            disabled={samples.length >= 250}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-medium text-slate-700 transition-colors shadow-2xs disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Baris Sampel
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={samples.length <= 1}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border transition-colors shadow-2xs ${
              selectedRowCount > 0
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 font-medium'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {selectedRowCount > 0 ? `Hapus (${selectedRowCount}) Sampel` : 'Hapus Sampel'}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <Grid className="w-3 h-3 text-slate-400" />
            {activeCellDesc}
          </span>
          <span className="text-slate-300">|</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            {samples.length} / 250 Baris (Invariant T2)
          </span>
        </div>
      </div>

      <div className="w-full h-[360px] rounded-lg border border-slate-200 overflow-hidden bg-white shadow-2xs relative">
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
            hint: '+ Tambah sampel baru...',
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
            <strong>Paste Fleksibel dari Excel:</strong> Anda dapat meng-copy seluruh kolom sampel dari Excel dan klik sel Sample ID, atau hanya meng-copy kolom pembacaan sinyal (cps) lalu klik sel analit target dan tekan <kbd className="px-1 py-0.2 bg-white rounded border border-slate-300">Ctrl+V</kbd>.
          </div>
          <div className="text-slate-400">
            Tipe sampel yang didukung: <code className="text-slate-700">sample</code>, <code className="text-slate-700">blank_method</code>, <code className="text-slate-700">ccv</code>, <code className="text-slate-700">spike</code>, <code className="text-slate-700">duplicate</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
