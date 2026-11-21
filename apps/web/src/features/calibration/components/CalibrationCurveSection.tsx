import { useMemo } from 'react';
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
import { CheckCircle } from 'iconoir-react';

export interface StandardItem {
  name: string;
  nominal: number;
  signal: number;
}

export interface AnalyteCurveData {
  name: string;
  symbol: string;
  unit: string;
  slope: number;
  intercept: number;
  r: number;
  rSquared: number;
  syx: number;
  lodInst: number;
  loqInst: number;
  standards: StandardItem[];
}

export interface CalibrationCurveSectionProps {
  curve: AnalyteCurveData;
}

export default function CalibrationCurveSection({ curve }: CalibrationCurveSectionProps) {
  const chartData = useMemo(() => {
    return curve.standards.map((s) => ({
      nominal: s.nominal,
      actualSignal: s.signal,
      fittedSignal: Number((curve.slope * s.nominal + curve.intercept).toFixed(4)),
      name: s.name,
    }));
  }, [curve]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold uppercase">
              Kurva Kalibrasi {curve.name} ({curve.symbol})
            </span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-900 font-mono mt-1">
              Regresi OLS: y = {curve.slope.toFixed(4)}x + {curve.intercept.toFixed(4)}
            </h2>
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3" aria-hidden="true" />r = {curve.r.toFixed(6)}
          </span>
        </div>

        <div className="h-60 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="nominal"
                type="number"
                unit=" ppb"
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
                labelFormatter={(label: any) => `Konsentrasi: ${label} ppb`}
              />
              <Scatter name="actualSignal" dataKey="actualSignal" fill="#0f172a" shape="circle" />
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
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs font-mono">
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
            <div className="text-[10px] text-slate-500 uppercase font-sans">Slope (m)</div>
            <div className="text-xs font-bold text-slate-900 mt-0.5">{curve.slope.toFixed(4)}</div>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
            <div className="text-[10px] text-slate-500 uppercase font-sans">Intercept (c)</div>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              {curve.intercept.toFixed(4)}
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
            <div className="text-[10px] text-slate-500 uppercase font-sans">Korelasi (R&sup2;)</div>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              {curve.rSquared.toFixed(6)}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 font-mono">
            Deret Standar {curve.name} ({curve.symbol})
          </h2>
          <span className="text-[11px] font-mono text-slate-500">6 titik baku</span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono">
              <tr>
                <th className="p-2">Label</th>
                <th className="p-2 text-right">Nominal (ppb)</th>
                <th className="p-2 text-right">Signal (cps)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {curve.standards.map((s) => (
                <tr key={s.name} className="hover:bg-slate-50/80">
                  <td className="p-2 font-medium text-slate-700">{s.name}</td>
                  <td className="p-2 text-right">{s.nominal}</td>
                  <td className="p-2 text-right text-slate-900 font-semibold">{s.signal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-mono">
          Koreksi Blanko {curve.symbol}: {curve.standards[0]?.signal} cps
        </div>
      </div>
    </div>
  );
}
