import { ArrowLeft, CheckCircle2, FileSpreadsheet, Layers } from 'lucide-react';
import { SampleDataGrid, type SampleRowState } from './SampleDataGrid';
import type { components } from '@valid-ex/contracts';

// OpenAPI types
type Analytes = components['schemas']['CalibrationBatchRequest']['analytes'];

export interface SampleWizardProps {
  analytes: Analytes;
  samples: SampleRowState[];
  setSamples: (updated: SampleRowState[]) => void;
  pasteNotice: string | null;
  onNotice: (msg: string) => void;
  setStep: (step: 1 | 2 | 3) => void;
  onSubmitBatch: () => void;
}

export default function SampleWizard({
  analytes,
  samples,
  setSamples,
  pasteNotice,
  onNotice,
  setStep,
  onSubmitBatch,
}: SampleWizardProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
              Spreadsheet Sampel Pengujian (Maks 250 Baris &mdash; Invariant T2)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Blok sel atau seluruh tabel di Excel lalu tempel (
              <kbd className="px-1 py-0.2 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">
                Ctrl+V
              </kbd>
              ) langsung ke dalam grid.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              {analytes.join(', ')} ({analytes.length} elemen)
            </span>
          </div>
        </div>

        {pasteNotice && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{pasteNotice}</span>
          </div>
        )}

        <SampleDataGrid
          samples={samples}
          analytes={analytes}
          onChange={setSamples}
          onNotice={onNotice}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Deret Standar
        </button>
        <button
          type="button"
          onClick={onSubmitBatch}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-2xs"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Validasi &amp; Simpan Batch (Submit ACID)
        </button>
      </div>
    </div>
  );
}
