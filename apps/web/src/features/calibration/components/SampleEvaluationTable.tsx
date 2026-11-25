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
  zone: 'Zone 1 (ND)' | 'Zone 2 (< LOQ)' | 'Zone 3 (Valid)';
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
            Sample Evaluation Table: {analyteName} ({analyteSymbol})
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            3-Zone gating is evaluated in solution (ppb) &bull; Official Result reports mg/kg (solid
            samples), ND (method blank), or measured solution concentration C_raw (CCV)
          </p>
        </div>
        <span className="text-[11px] font-mono text-slate-600">
          ADR-0008 Export: 1 file = 1 sample row
        </span>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-mono">
            <tr>
              <th scope="col" className="p-2.5 font-semibold">Sample ID</th>
              <th scope="col" className="p-2.5 font-semibold">Sample Type</th>
              <th scope="col" className="p-2.5 font-semibold">Parent</th>
              <th scope="col" className="p-2.5 font-semibold text-right">Weight (g)</th>
              <th scope="col" className="p-2.5 font-semibold text-right">Vol (mL)</th>
              <th scope="col" className="p-2.5 font-semibold text-right">dF</th>
              <th scope="col" className="p-2.5 font-semibold text-right">Signal (cps)</th>
              <th scope="col" className="p-2.5 font-semibold text-right">C_raw (ppb)</th>
              <th scope="col" className="p-2.5 font-semibold text-right">C_net (ppb)</th>
              <th scope="col" className="p-2.5 font-semibold text-center">3-Zone Status</th>
              <th scope="col" className="p-2.5 font-semibold text-right">Official Result</th>
              <th scope="col" className="p-2.5 font-semibold text-center">QC Evaluation</th>
              <th scope="col" className="p-2.5 font-semibold text-center w-32">Excel Export</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {samples.map((row) => (
              <tr key={row.sampleId} className="hover:bg-slate-50/80">
                <td className="p-2.5 font-bold text-slate-900">{row.sampleId}</td>
                <td className="p-2.5 text-slate-700">
                  <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 font-medium">
                    {row.sampleType}
                  </span>
                </td>
                <td className="p-2.5 text-slate-600">{row.parentSampleId || '-'}</td>
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
                      row.zone === 'Zone 3 (Valid)'
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
                    <span className="text-slate-600">-</span>
                  )}
                </td>
                <td className="p-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => onDownload(row.sampleId)}
                    aria-label={`Download ${row.sampleId}.xlsx`}
                    className="inline-flex items-center gap-1.5 min-h-8 px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-sans font-medium text-slate-800 transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                  >
                    <Download className="w-3 h-3 text-slate-600" aria-hidden="true" />
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
