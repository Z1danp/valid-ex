import { useMemo, useState } from 'react';
import { linearRegression } from '@valid-ex/math';
import {
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
  Activity,
} from 'lucide-react';
import { StandardDataGrid, type StandardRowItem } from './StandardDataGrid';
import type { components } from '@valid-ex/contracts';

// OpenAPI types
type SolutionConcUnit = components['schemas']['MetrologyUnits']['solutionConcUnit'];
type Analytes = components['schemas']['CalibrationBatchRequest']['analytes'];

export interface StandardWizardProps {
  analytes: Analytes;
  standards: StandardRowItem[];
  setStandards: (updated: StandardRowItem[]) => void;
  unit: SolutionConcUnit;
  selectedAnalyte: string;
  setSelectedAnalyte: (analyte: string) => void;
  onAddAnalyte: (rawSymbol: string) => void;
  pasteNotice: string | null;
  onNotice: (msg: string) => void;
  canProceedToStep3: boolean;
  setStep: (step: 1 | 2 | 3) => void;
}

export default function StandardWizard({
  analytes,
  standards,
  setStandards,
  unit,
  selectedAnalyte,
  setSelectedAnalyte,
  onAddAnalyte,
  pasteNotice,
  onNotice,
  canProceedToStep3,
  setStep,
}: StandardWizardProps) {
  const [quickAddAnalyteInput, setQuickAddAnalyteInput] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const handleQuickAddAnalyte = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onAddAnalyte(quickAddAnalyteInput);
    setQuickAddAnalyteInput('');
    setShowQuickAdd(false);
  };

  // Live Linear Regression Engine for all analytes simultaneously via @valid-ex/math
  const allRegressions = useMemo(() => {
    const result: Record<
      string,
      {
        reg: ReturnType<typeof linearRegression> | null;
        lod: number;
        loq: number;
        error: string | null;
      }
    > = {};

    analytes.forEach((analyte) => {
      try {
        if (standards.length < 3) {
          result[analyte] = { reg: null, lod: 0, loq: 0, error: 'Kurang dari 3 titik data.' };
          return;
        }
        const points = standards.map((s) => ({
          x: s.readings[analyte]?.nominalConc ?? s.nominalConc,
          y: s.readings[analyte]?.signal ?? 0,
        }));
        const reg = linearRegression(points);
        const lod = reg.slope !== 0 ? (3 * reg.syx) / Math.abs(reg.slope) : 0;
        const loq = reg.slope !== 0 ? (10 * reg.syx) / Math.abs(reg.slope) : 0;
        result[analyte] = { reg, lod, loq, error: null };
      } catch (err: unknown) {
        result[analyte] = {
          reg: null,
          lod: 0,
          loq: 0,
          error: err instanceof Error ? err.message : 'Gagal regresi',
        };
      }
    });

    return result;
  }, [standards, analytes]);

  const activeRegression = (selectedAnalyte && allRegressions[selectedAnalyte]) || {
    reg: null,
    lod: 0,
    loq: 0,
    error: 'Pilih analit',
  };

  const nonZeroLevels = selectedAnalyte
    ? standards.filter((s) => (s.readings[selectedAnalyte]?.nominalConc ?? s.nominalConc) > 0)
        .length
    : 0;

  const hasBlank = selectedAnalyte
    ? standards.some((s) => (s.readings[selectedAnalyte]?.nominalConc ?? s.nominalConc) === 0)
    : false;

  const isInvariantD1Pass = selectedAnalyte ? nonZeroLevels >= 5 && hasBlank : false;

  const chartData = useMemo(() => {
    if (!selectedAnalyte || !activeRegression.reg) return [];
    const { slope, intercept } = activeRegression.reg;
    return standards.map((s) => {
      const nom = s.readings[selectedAnalyte]?.nominalConc ?? s.nominalConc;
      const act = s.readings[selectedAnalyte]?.signal ?? 0;
      return {
        nominal: nom,
        actualSignal: act,
        fittedSignal: Number((slope * nom + intercept).toFixed(4)),
        name: s.standardName,
      };
    });
  }, [standards, selectedAnalyte, activeRegression]);

  return (
    <div className="space-y-6">
      {/* SECTION 1: Full-Width Standards Spreadsheet matching Label | Al | Cd | Mn | Pb */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
              Spreadsheet DataGrid Deret Standar (Multi-Elemen)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Format Kolom:{' '}
              <code className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                Label | {analytes.join(' | ')}
              </code>
              . Blok di Excel &rarr; Ctrl+C &rarr; Ctrl+V ke dalam tabel.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {showQuickAdd ? (
              <form onSubmit={handleQuickAddAnalyte} className="inline-flex items-center px-1">
                <input
                  type="text"
                  autoFocus
                  value={quickAddAnalyteInput}
                  onChange={(e) => setQuickAddAnalyteInput(e.target.value)}
                  placeholder="Simbol analit..."
                  className="w-24 px-2 py-1 text-xs bg-white border border-slate-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <button
                  type="submit"
                  className="ml-1 text-slate-700 hover:text-slate-900 font-medium text-xs"
                >
                  + Tambah
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="ml-1 text-slate-400 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowQuickAdd(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-medium text-slate-700 transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Analit
              </button>
            )}
          </div>
        </div>

        {pasteNotice && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{pasteNotice}</span>
          </div>
        )}

        <StandardDataGrid
          unit={unit}
          standards={standards}
          analytes={analytes}
          onChange={setStandards}
          onNotice={onNotice}
        />
      </div>

      {/* SECTION 2: Calibration Curves & Metrology Below the Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold uppercase">
                <Activity className="w-3 h-3 text-emerald-600" />
                Live Engine @valid-ex/math
              </span>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Kurva Kalibrasi &amp; Diagnostik Metrologi
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih elemen analit di bawah untuk meninjau kurva kalibrasi regresi OLS, sensitivitas,
              dan batas deteksi:
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 font-mono text-xs">
            {analytes.map((a) => {
              const reg = allRegressions[a]?.reg;
              const isPass = reg && reg.r >= 0.995;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setSelectedAnalyte(a)}
                  className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                    selectedAnalyte === a
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{a}</span>
                  {reg && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isPass ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {selectedAnalyte && !isInvariantD1Pass && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">
                Peringatan Invariant D1 (ISO 17025) untuk {selectedAnalyte}
              </div>
              <div className="text-[11px] text-amber-800 mt-0.5">
                Kurva linear wajib memiliki minimal 5 konsentrasi non-zero dan titik blanko (0{' '}
                {unit}). Saat ini terdeteksi <strong>{nonZeroLevels} level non-zero</strong>{' '}
                {hasBlank ? '(dengan blanko)' : '(tanpa blanko 0 {unit})'}.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Curve Chart */}
          <div className="lg:col-span-7 bg-slate-50/50 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 font-mono">
                Plot Kurva Kalibrasi:{' '}
                <strong className="text-slate-900">{selectedAnalyte || '-'}</strong>
              </span>
              {activeRegression.reg && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded ${
                    activeRegression.reg.r >= 0.995
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {activeRegression.reg.r >= 0.995 ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  r = {activeRegression.reg.r.toFixed(6)}
                </span>
              )}
            </div>

            <div className="h-64 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 10, right: 10, bottom: 20, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="nominal"
                      type="number"
                      unit={unit}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                    />
                    <YAxis
                      dataKey="actualSignal"
                      type="number"
                      unit=" cps"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: '11px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                      }}
                      formatter={(value: any, name: any) => [
                        `${Number(value).toFixed(2)} cps`,
                        name === 'actualSignal' ? 'Signal Aktual' : 'Garis Regresi',
                      ]}
                      labelFormatter={(label: any) => `Konsentrasi: ${label} ${unit}`}
                    />
                    <Scatter
                      name="actualSignal"
                      dataKey="actualSignal"
                      fill="#0f172a"
                      shape="circle"
                    />
                    <Line
                      name="fittedSignal"
                      type="linear"
                      dataKey="fittedSignal"
                      stroke="#0284c7"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  {activeRegression.error || 'Memuat kurva kalibrasi...'}
                </div>
              )}
            </div>
          </div>

          {/* Regression Metrology Cards */}
          <div className="lg:col-span-5 space-y-4">
            {activeRegression.reg ? (
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase font-sans">
                    Slope (m, sensitivitas)
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {activeRegression.reg.slope.toFixed(4)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase font-sans">
                    Intercept (c, sinyal 0)
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {activeRegression.reg.intercept.toFixed(4)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase font-sans">
                    Korelasi (R&sup2;)
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {activeRegression.reg.rSquared.toFixed(6)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase font-sans">
                    Residual (sy/x)
                  </div>
                  <div className="text-sm font-medium text-slate-800 mt-0.5">
                    {activeRegression.reg.syx.toFixed(4)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase font-sans">
                    LOD Inst (3s/m, {unit})
                  </div>
                  <div className="text-sm font-semibold text-emerald-700 mt-0.5">
                    {activeRegression.lod.toFixed(3)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="text-[10px] text-slate-500 uppercase font-sans">
                    LOQ Inst (10s/m, {unit})
                  </div>
                  <div className="text-sm font-semibold text-emerald-700 mt-0.5">
                    {activeRegression.loq.toFixed(3)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-xs text-center">
                {activeRegression.error || 'Data deret belum lengkap'}
              </div>
            )}

            {/* Multi-Analyte Scorecard */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider font-mono mb-2">
                Ringkasan Semua Analit ({analytes.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="text-[10px] text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="pb-1">Analit</th>
                      <th className="pb-1 text-right">Slope</th>
                      <th className="pb-1 text-right">r</th>
                      <th className="pb-1 text-right">LOD</th>
                      <th className="pb-1 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytes.map((a) => {
                      const reg = allRegressions[a]?.reg;
                      const isPass = reg && reg.r >= 0.995;
                      const isSelected = selectedAnalyte === a;
                      return (
                        <tr
                          key={a}
                          onClick={() => setSelectedAnalyte(a)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-slate-100 font-semibold text-slate-900'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <td className="py-1.5">{a}</td>
                          <td className="py-1.5 text-right">{reg ? reg.slope.toFixed(2) : '-'}</td>
                          <td className="py-1.5 text-right">{reg ? reg.r.toFixed(4) : '-'}</td>
                          <td className="py-1.5 text-right">
                            {allRegressions[a]?.lod.toFixed(2) ?? '-'}
                          </td>
                          <td className="py-1.5 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.2 rounded text-[10px] ${
                                isPass ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {isPass ? 'OK' : 'FAIL'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Metadata
        </button>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => canProceedToStep3 && setStep(3)}
            disabled={!canProceedToStep3}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900 text-white text-xs font-medium transition-colors shadow-2xs"
          >
            Lanjut ke Step 3: Sampel Uji
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          {!canProceedToStep3 && (
            <span className="text-[11px] text-amber-600 font-mono flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              Lengkapi minimal 3 titik deret standar untuk semua analit untuk membuka Step 3
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
