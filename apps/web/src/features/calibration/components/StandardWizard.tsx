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
  CheckCircle,
  WarningTriangle,
  Plus,
  Xmark,
  Activity,
} from 'iconoir-react';
import { StandardDataGrid } from './StandardDataGrid';
import {
  getPointsForAnalyte,
  type StandardGroup,
  type StandardGroupRow,
} from '../utils/standardGroups';
import type { components } from '@valid-ex/contracts';

type SolutionConcUnit = components['schemas']['MetrologyUnits']['solutionConcUnit'];
type Analytes = components['schemas']['CalibrationBatchRequest']['analytes'];
type SignalUnit = components['schemas']['MetrologyUnits']['signalUnit'];

export interface StandardWizardProps {
  analytes: Analytes;
  standardGroups: StandardGroup[];
  onUpdateGroupRows: (groupId: string, rows: StandardGroupRow[]) => void;
  onAssignAnalyte: (analyte: string, targetGroupId: string) => void;
  onSplitAnalyte: (analyte: string) => void;
  unit: SolutionConcUnit;
  selectedAnalyte: string;
  setSelectedAnalyte: (analyte: string) => void;
  onAddAnalyte: (rawSymbol: string) => void;
  pasteNotice: { message: string; tone: 'info' | 'warning' } | null;
  onNotice: (msg: string, tone?: 'info' | 'warning') => void;
  canProceedToStep3: boolean;
  setStep: (step: 1 | 2 | 3) => void;
  signalUnit: SignalUnit;
}

export default function StandardWizard({
  analytes,
  standardGroups,
  onUpdateGroupRows,
  onAssignAnalyte,
  onSplitAnalyte,
  unit,
  selectedAnalyte,
  setSelectedAnalyte,
  onAddAnalyte,
  pasteNotice,
  onNotice,
  canProceedToStep3,
  setStep,
  signalUnit,
}: StandardWizardProps) {
  const [quickAddAnalyteInput, setQuickAddAnalyteInput] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const handleQuickAddAnalyte = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onAddAnalyte(quickAddAnalyteInput);
    setQuickAddAnalyteInput('');
    setShowQuickAdd(false);
  };

  // Compute live OLS regression per analyte using only complete (nominalConc, signal) pairs.
  const allRegressions = useMemo(() => {
    const result: Record<
      string,
      {
        reg: ReturnType<typeof linearRegression> | null;
        lod: number;
        loq: number;
        pointCount: number;
        nonZeroLevels: number;
        hasBlank: boolean;
        error: string | null;
      }
    > = {};

    analytes.forEach((analyte) => {
      const validPoints = getPointsForAnalyte(standardGroups, analyte);
      const nonZeroCount = validPoints.filter((p) => p.nominalConc > 0).length;
      const blankPresent = validPoints.some((p) => p.nominalConc === 0);

      try {
        if (validPoints.length < 3) {
          result[analyte] = {
            reg: null,
            lod: 0,
            loq: 0,
            pointCount: validPoints.length,
            nonZeroLevels: nonZeroCount,
            hasBlank: blankPresent,
            error: `Enter at least 3 complete points for ${analyte} (${validPoints.length} filled).`,
          };
          return;
        }
        const points = validPoints.map((p) => ({
          x: p.nominalConc,
          y: p.signal,
        }));
        const reg = linearRegression(points);
        const lod = reg.slope !== 0 ? (3 * reg.syx) / Math.abs(reg.slope) : 0;
        const loq = reg.slope !== 0 ? (10 * reg.syx) / Math.abs(reg.slope) : 0;
        result[analyte] = {
          reg,
          lod,
          loq,
          pointCount: validPoints.length,
          nonZeroLevels: nonZeroCount,
          hasBlank: blankPresent,
          error: null,
        };
      } catch (err: unknown) {
        result[analyte] = {
          reg: null,
          lod: 0,
          loq: 0,
          pointCount: validPoints.length,
          nonZeroLevels: nonZeroCount,
          hasBlank: blankPresent,
          error: err instanceof Error ? err.message : 'Regression failed',
        };
      }
    });

    return result;
  }, [standardGroups, analytes]);

  const activeRegression = (selectedAnalyte && allRegressions[selectedAnalyte]) || {
    reg: null,
    lod: 0,
    loq: 0,
    pointCount: 0,
    nonZeroLevels: 0,
    hasBlank: false,
    error: 'Select an analyte to inspect its curve.',
  };

  const isInvariantD1Pass = selectedAnalyte
    ? activeRegression.nonZeroLevels >= 5 && activeRegression.hasBlank
    : false;

  const chartData = useMemo(() => {
    if (!selectedAnalyte || !activeRegression.reg) return [];
    const { slope, intercept } = activeRegression.reg;
    const validPoints = getPointsForAnalyte(standardGroups, selectedAnalyte);
    return validPoints.map((pt) => ({
      nominal: pt.nominalConc,
      actualSignal: pt.signal,
      fittedSignal: Number((slope * pt.nominalConc + intercept).toFixed(4)),
      name: pt.standardName,
    }));
  }, [standardGroups, selectedAnalyte, activeRegression]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-300 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">
              Calibration Standards &amp; Concentration Series
            </h2>
            <p className="text-xs text-slate-700 mt-0.5">
              Type a standard label to auto-fill Nominal Conc, or edit Nominal Conc directly. Split
              analytes into separate tables when they use different calibration ranges.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {showQuickAdd ? (
              <form onSubmit={handleQuickAddAnalyte} className="inline-flex items-center gap-1.5">
                <input
                  type="text"
                  autoFocus
                  aria-label="Analyte symbol"
                  value={quickAddAnalyteInput}
                  onChange={(e) => setQuickAddAnalyteInput(e.target.value)}
                  placeholder="Symbol (e.g. Hg)"
                  className="w-32 min-h-11 sm:min-h-9 px-2.5 py-1 text-xs bg-white border border-slate-400 rounded-lg font-mono text-slate-900 placeholder:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                />
                <button
                  type="submit"
                  className="min-h-11 sm:min-h-9 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  aria-label="Cancel adding analyte"
                  className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 inline-flex items-center justify-center text-slate-700 hover:text-red-800 rounded-lg border border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  <Xmark className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowQuickAdd(true)}
                className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-3 py-1.5 text-xs rounded-lg border border-slate-400 bg-white hover:bg-slate-50 font-medium text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Add Analyte
              </button>
            )}
          </div>
        </div>

        {pasteNotice && (
          <div
            role={pasteNotice.tone === 'warning' ? 'alert' : 'status'}
            aria-live="polite"
            className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              pasteNotice.tone === 'warning'
                ? 'bg-amber-50 border-amber-700 text-amber-900'
                : 'bg-emerald-50 border-emerald-700 text-emerald-900'
            }`}
          >
            {pasteNotice.tone === 'warning' ? (
              <WarningTriangle className="w-4 h-4 shrink-0 text-amber-700" aria-hidden="true" />
            ) : (
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-700" aria-hidden="true" />
            )}
            <span>{pasteNotice.message}</span>
          </div>
        )}

        <div className="space-y-5">
          {standardGroups.map((group, idx) => {
            const incompleteAnalytes = group.analytes.filter(
              (a) => (allRegressions[a]?.pointCount ?? 0) < 3,
            );
            const canSplitOut = group.analytes.length > 1;

            return (
              <section
                key={group.id}
                aria-label={`Standards Table ${idx + 1}`}
                className="rounded-xl border border-slate-300 bg-slate-50/40 p-4 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                        Table {idx + 1}: {group.analytes.join(', ') || 'No Analytes'}
                      </h3>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-slate-300 bg-white text-slate-800">
                        {group.analytes.length}{' '}
                        {group.analytes.length === 1 ? 'analyte' : 'analytes'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">
                      All checked analytes share this table&apos;s{' '}
                      <code className="font-mono text-slate-900">Nominal Conc ({unit})</code>{' '}
                      column. Uncheck an analyte to split it into a new table.
                    </p>
                  </div>

                  {analytes.length > 1 && (
                    <fieldset className="flex flex-wrap items-center gap-2">
                      <legend className="sr-only">
                        Analytes sharing Nominal Conc in Table {idx + 1}
                      </legend>
                      {analytes.map((analyte) => {
                        const isChecked = group.analytes.includes(analyte);
                        const isOnlyAnalyteHere = isChecked && !canSplitOut;
                        return (
                          <label
                            key={`${group.id}-${analyte}`}
                            title={
                              isOnlyAnalyteHere
                                ? 'Keep at least 1 analyte in this table'
                                : isChecked
                                  ? `Uncheck to split ${analyte} into a separate table`
                                  : `Move ${analyte} into Table ${idx + 1}`
                            }
                            className={`inline-flex items-center gap-2 min-h-11 sm:min-h-9 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors select-none ${
                              isChecked
                                ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                                : 'bg-white text-slate-800 border-slate-400 hover:bg-slate-100'
                            } ${isOnlyAnalyteHere ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isOnlyAnalyteHere}
                              aria-label={`Include ${analyte} in Standards Table ${idx + 1}`}
                              onChange={() => {
                                if (isChecked) {
                                  if (canSplitOut) onSplitAnalyte(analyte);
                                } else {
                                  onAssignAnalyte(analyte, group.id);
                                }
                              }}
                              className="w-4 h-4 accent-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                            />
                            <span>{analyte}</span>
                          </label>
                        );
                      })}
                    </fieldset>
                  )}
                </div>

                {incompleteAnalytes.length > 0 && (
                  <div
                    role="status"
                    className="p-2.5 rounded-lg bg-amber-50 border border-amber-700 text-amber-900 text-xs flex items-center gap-2"
                  >
                    <WarningTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                    <span>
                      Enter at least 3 complete (Nominal Conc + Signal) rows for{' '}
                      <strong className="font-mono">{incompleteAnalytes.join(', ')}</strong>.
                    </span>
                  </div>
                )}

                <StandardDataGrid
                  unit={unit}
                  rows={group.rows}
                  analytes={group.analytes}
                  onChange={(updatedRows) => onUpdateGroupRows(group.id, updatedRows)}
                  onNotice={(msg) =>
                    onNotice(
                      msg,
                      msg.startsWith('Pasted ') ? 'info' : 'warning',
                    )
                  }
                  signalUnit={signalUnit}
                />
              </section>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-300 p-4 sm:p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-700 font-semibold uppercase">
                <Activity className="w-3 h-3 text-emerald-700" aria-hidden="true" />
                Live Engine @valid-ex/math
              </span>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Calibration Curves &amp; Metrology Diagnostics
              </h2>
            </div>
            <p className="text-xs text-slate-700 mt-1">
              Select an analyte to inspect its OLS regression curve, sensitivity, and detection
              limits.
            </p>
          </div>

          <div className="inline-flex flex-wrap rounded-lg border border-slate-300 p-1 bg-slate-50 font-mono text-xs gap-1">
            {analytes.map((a) => {
              const reg = allRegressions[a]?.reg;
              const isPass = reg && reg.r >= 0.995;
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={selectedAnalyte === a}
                  onClick={() => setSelectedAnalyte(a)}
                  className={`min-h-11 sm:min-h-9 px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                    selectedAnalyte === a
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-800 hover:bg-slate-200/70'
                  }`}
                >
                  <span>{a}</span>
                  {reg && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        isPass
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-red-100 text-red-900'
                      }`}
                    >
                      {isPass ? 'OK' : 'LOW'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {selectedAnalyte && !isInvariantD1Pass && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-700 text-amber-900 text-xs flex items-start gap-2">
            <WarningTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <div className="font-semibold">Warning for {selectedAnalyte}</div>
              <div className="text-xs text-amber-900 mt-0.5">
                Linear calibration requires at least 5 non-zero levels and a reagent blank (0{' '}
                {unit}). Currently detected:{' '}
                <strong>{activeRegression.nonZeroLevels} non-zero levels</strong>{' '}
                {activeRegression.hasBlank ? '(with blank)' : `(missing 0 ${unit} blank)`}.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-slate-50/50 rounded-xl border border-slate-300 p-4 min-w-0">
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-xs font-semibold text-slate-800 font-mono">
                Calibration Curve Plot:{' '}
                <strong className="text-slate-900">{selectedAnalyte || '-'}</strong>
              </span>
              {activeRegression.reg && (
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded border ${
                    activeRegression.reg.r >= 0.995
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-700'
                      : 'bg-red-50 text-red-900 border-red-700'
                  }`}
                >
                  {activeRegression.reg.r >= 0.995 ? (
                    <CheckCircle className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <WarningTriangle className="w-3 h-3" aria-hidden="true" />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis
                      dataKey="nominal"
                      type="number"
                      unit={unit}
                      tick={{ fontSize: 10, fill: '#334155' }}
                    />
                    <YAxis
                      dataKey="actualSignal"
                      type="number"
                      unit={` ${signalUnit}`}
                      tick={{ fontSize: 10, fill: '#334155' }}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: '11px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                      }}
                      formatter={(value: unknown, name: unknown) => [
                        `${Number(value).toFixed(2)} ${signalUnit}`,
                        name === 'actualSignal' ? 'Actual Signal' : 'Regression Line',
                      ]}
                      labelFormatter={(label: unknown) => `Concentration: ${label} ${unit}`}
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
                <div className="h-full flex items-center justify-center text-xs text-slate-700 text-center px-4">
                  {activeRegression.error || 'Enter calibration standards to preview the curve.'}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4 min-w-0">
            {activeRegression.reg ? (
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-3 rounded-lg border border-slate-300 bg-white">
                  <div className="text-[11px] text-slate-700 font-sans">
                    Slope (m, sensitivity)
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {activeRegression.reg.slope.toFixed(4)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-300 bg-white">
                  <div className="text-[11px] text-slate-700 font-sans">
                    Intercept (c, 0 signal)
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {activeRegression.reg.intercept.toFixed(4)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-300 bg-white">
                  <div className="text-[11px] text-slate-700 font-sans">Det. Coeff. (R&sup2;)</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {activeRegression.reg.rSquared.toFixed(6)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-300 bg-white">
                  <div className="text-[11px] text-slate-700 font-sans">Residual (sy/x)</div>
                  <div className="text-sm font-medium text-slate-900 mt-0.5">
                    {activeRegression.reg.syx.toFixed(4)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-300 bg-white">
                  <div className="text-[11px] text-slate-700 font-sans">
                    LOD Inst (3s/m, {unit})
                  </div>
                  <div className="text-sm font-semibold text-emerald-800 mt-0.5">
                    {activeRegression.lod.toFixed(3)}
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-slate-300 bg-white">
                  <div className="text-[11px] text-slate-700 font-sans">
                    LOQ Inst (10s/m, {unit})
                  </div>
                  <div className="text-sm font-semibold text-emerald-800 mt-0.5">
                    {activeRegression.loq.toFixed(3)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 text-xs text-center">
                {activeRegression.error || 'Calibration standards incomplete'}
              </div>
            )}

            <div className="rounded-lg border border-slate-300 bg-white p-3">
              <div className="text-xs font-semibold text-slate-800 uppercase tracking-wider font-mono mb-2">
                All Analytes Summary ({analytes.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="text-[11px] text-slate-700 border-b border-slate-300">
                    <tr>
                      <th scope="col" className="pb-1.5">
                        Analyte
                      </th>
                      <th scope="col" className="pb-1.5 text-right">
                        Slope
                      </th>
                      <th scope="col" className="pb-1.5 text-right">
                        r
                      </th>
                      <th scope="col" className="pb-1.5 text-right">
                        LOD
                      </th>
                      <th scope="col" className="pb-1.5 text-center">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {analytes.map((a) => {
                      const reg = allRegressions[a]?.reg;
                      const isPass = reg && reg.r >= 0.995;
                      const isSelected = selectedAnalyte === a;
                      return (
                        <tr
                          key={a}
                          tabIndex={0}
                          aria-current={isSelected ? 'true' : undefined}
                          onClick={() => setSelectedAnalyte(a)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedAnalyte(a);
                            }
                          }}
                          className={`cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900 ${
                            isSelected
                              ? 'bg-slate-100 font-semibold text-slate-900'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <td className="py-2">{a}</td>
                          <td className="py-2 text-right">{reg ? reg.slope.toFixed(2) : '-'}</td>
                          <td className="py-2 text-right">{reg ? reg.r.toFixed(4) : '-'}</td>
                          <td className="py-2 text-right">
                            {reg ? allRegressions[a]!.lod.toFixed(2) : '-'}
                          </td>
                          <td className="py-2 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                reg
                                  ? isPass
                                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-700'
                                    : 'bg-red-50 text-red-900 border border-red-700'
                                  : 'bg-slate-100 text-slate-700 border border-slate-300'
                              }`}
                            >
                              {reg ? (isPass ? 'OK' : 'FAIL') : 'PENDING'}
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

      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-lg border border-slate-500 bg-white hover:bg-slate-50 text-slate-900 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Setup
        </button>
        <div className="flex flex-col items-stretch sm:items-end gap-1.5">
          <button
            type="button"
            onClick={() => canProceedToStep3 && setStep(3)}
            disabled={!canProceedToStep3}
            className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900 text-white text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Continue to Samples &amp; QC
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
          {!canProceedToStep3 && (
            <span className="text-xs text-amber-900 font-mono flex items-center gap-1.5">
              <WarningTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
              Fill at least 3 complete standard points for every analyte to unlock Step 3
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
