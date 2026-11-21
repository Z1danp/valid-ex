import { Download } from 'iconoir-react';
import type { components } from '@valid-ex/contracts';

type SampleType = components['schemas']['SampleType'];

export interface SampleAnalyteResult {
  sampleId: string;
  sampleType: SampleType;
  parentSampleId?: string;
  weight: number | null;
  volume: number | null;
  df: number | null;
  signal: number;
  cRaw: number;
  cNet: number;
  zone: 'Zona 1 (ND)' | 'Zona 2 (< LOQ)' | 'Zona 3 (Sah)';
  reportedValue: string;
  qcResult?: string;
  isQcViolation?: boolean;
}

export interface SampleEvaluationTableProps {
  analyteName: string;
  analyteSymbol: string;
  samples: SampleAnalyteResult[];
  onDownload: (sampleId: string) => void;
}

export default function SampleEvaluationTable({
  analyteName,
  analyteSymbol,
  samples,
  onDownload,
}: SampleEvaluationTableProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 font-mono">
            Tabel Evaluasi Sampel untuk Analit {analyteName} ({analyteSymbol})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gating 3-Zona dilakukan di larutan (ppb) &bull; Hasil Resmi menampilkan mg/kg (sampel
            padatan), ND (blanko metode), atau konsentrasi larutan terukur C_raw (CCV)
          </p>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Ekspor ADR-0008: 1 file = 1 baris sampel
        </span>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono">
            <tr>
              <th className="p-2.5 font-semibold">Sample ID</th>
              <th className="p-2.5 font-semibold">Tipe Sampel</th>
              <th className="p-2.5 font-semibold">Parent</th>
              <th className="p-2.5 font-semibold text-right">Bobot (g)</th>
              <th className="p-2.5 font-semibold text-right">Vol (mL)</th>
              <th className="p-2.5 font-semibold text-right">dF</th>
              <th className="p-2.5 font-semibold text-right">Signal (cps)</th>
              <th className="p-2.5 font-semibold text-right">C_raw (ppb)</th>
              <th className="p-2.5 font-semibold text-right">C_net (ppb)</th>
              <th className="p-2.5 font-semibold text-center">Status 3-Zona</th>
              <th className="p-2.5 font-semibold text-right">Hasil Resmi</th>
              <th className="p-2.5 font-semibold text-center">Evaluasi QC</th>
              <th className="p-2.5 font-semibold text-center w-32">Ekspor Excel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {samples.map((row) => (
              <tr key={row.sampleId} className="hover:bg-slate-50/80">
                <td className="p-2.5 font-bold text-slate-900">{row.sampleId}</td>
                <td className="p-2.5 text-slate-600">
                  <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 font-medium">
                    {row.sampleType}
                  </span>
                </td>
                <td className="p-2.5 text-slate-500">{row.parentSampleId || '-'}</td>
                <td className="p-2.5 text-right">
                  {row.weight !== null ? row.weight.toFixed(4) : '-'}
                </td>
                <td className="p-2.5 text-right">{row.volume ?? '-'}</td>
                <td className="p-2.5 text-right">{row.df ?? '-'}</td>
                <td className="p-2.5 text-right font-medium text-slate-900">
                  {row.signal.toFixed(1)}
                </td>
                <td className="p-2.5 text-right text-slate-700">{row.cRaw.toFixed(2)}</td>
                <td className="p-2.5 text-right font-medium text-slate-900">
                  {row.cNet.toFixed(2)}
                </td>
                <td className="p-2.5 text-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      row.zone === 'Zona 3 (Sah)'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {row.zone}
                  </span>
                </td>
                <td className="p-2.5 text-right font-bold text-slate-900">{row.reportedValue}</td>
                <td className="p-2.5 text-center">
                  {row.qcResult ? (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        row.isQcViolation
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {row.qcResult}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="p-2.5 text-center">
                  <button
                    onClick={() => onDownload(row.sampleId)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-sans font-medium text-slate-700 transition-colors shadow-xs"
                  >
                    <Download className="w-3 h-3 text-slate-500" aria-hidden="true" />
                    {row.sampleId}.xlsx
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
