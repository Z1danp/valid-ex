import { useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
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
import { AlertTriangle, Download, CheckCircle2, ArrowLeft, Filter } from 'lucide-react';
import SampleEvaluationTable, {
  type SampleAnalyteResult,
} from '../components/SampleEvaluationTable';

type AnalyteKey = 'Al' | 'Pb';

interface StandardItem {
  name: string;
  nominal: number;
  signal: number;
}

interface AnalyteCurveData {
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

const ANALYTE_CURVES: Record<AnalyteKey, AnalyteCurveData> = {
  Al: {
    name: 'Aluminium',
    symbol: 'Al',
    unit: 'ppb',
    slope: 2.0,
    intercept: 5.0,
    r: 1.0,
    rSquared: 1.0,
    syx: 0.0,
    lodInst: 0.0,
    loqInst: 0.0,
    standards: [
      { name: 'Blank', nominal: 0, signal: 5 },
      { name: 'Std 10', nominal: 10, signal: 25 },
      { name: 'Std 50', nominal: 50, signal: 105 },
      { name: 'Std 100', nominal: 100, signal: 205 },
      { name: 'Std 300', nominal: 300, signal: 605 },
      { name: 'Std 500', nominal: 500, signal: 1005 },
    ],
  },
  Pb: {
    name: 'Timbal',
    symbol: 'Pb',
    unit: 'ppb',
    slope: 10.0,
    intercept: 100.0,
    r: 1.0,
    rSquared: 1.0,
    syx: 0.0,
    lodInst: 0.0,
    loqInst: 0.0,
    standards: [
      { name: 'Blank', nominal: 0, signal: 100 },
      { name: 'Std 10', nominal: 10, signal: 200 },
      { name: 'Std 50', nominal: 50, signal: 600 },
      { name: 'Std 100', nominal: 100, signal: 1100 },
      { name: 'Std 300', nominal: 300, signal: 3100 },
      { name: 'Std 500', nominal: 500, signal: 5100 },
    ],
  },
};

const SAMPLE_RESULTS: Record<AnalyteKey, SampleAnalyteResult[]> = {
  Al: [
    {
      sampleId: 'MB',
      sampleType: 'blank_method',
      weight: 0.2,
      volume: 50,
      df: 1,
      signal: 6.0,
      cRaw: 0.5,
      cNet: 0.0,
      zone: 'Zona 1 (ND)',
      reportedValue: 'ND',
    },
    {
      sampleId: 'S1',
      sampleType: 'sample',
      weight: 0.2014,
      volume: 50,
      df: 1,
      signal: 27.0,
      cRaw: 11.0,
      cNet: 10.5,
      zone: 'Zona 3 (Sah)',
      reportedValue: '2.625 mg/kg',
    },
    {
      sampleId: 'S2',
      sampleType: 'sample',
      weight: 0.2005,
      volume: 50,
      df: 1,
      signal: 11.0,
      cRaw: 3.0,
      cNet: 2.5,
      zone: 'Zona 3 (Sah)',
      reportedValue: '0.625 mg/kg',
    },
    {
      sampleId: 'CCV1',
      sampleType: 'ccv',
      weight: 0.2,
      volume: 50,
      df: 1,
      signal: 245.0,
      cRaw: 120.0,
      cNet: 119.5,
      zone: 'Zona 3 (Sah)',
      reportedValue: '120.0 ppb',
      qcResult: 'Rec 120.0% (OOS)',
      isQcViolation: true,
    },
    {
      sampleId: 'SP1',
      sampleType: 'spike',
      parentSampleId: 'S1',
      weight: 0.2,
      volume: 50,
      df: 1,
      signal: 55.0,
      cRaw: 25.0,
      cNet: 24.5,
      zone: 'Zona 3 (Sah)',
      reportedValue: '24.5 ppb',
      qcResult: 'Rec 140.0% (OOS)',
      isQcViolation: true,
    },
    {
      sampleId: 'D1',
      sampleType: 'duplicate',
      parentSampleId: 'S1',
      weight: 0.201,
      volume: 50,
      df: 1,
      signal: 15.0,
      cRaw: 5.0,
      cNet: 4.5,
      zone: 'Zona 3 (Sah)',
      reportedValue: '1.125 mg/kg',
      qcResult: 'RPD 80.0% (OOS)',
      isQcViolation: true,
    },
  ],
  Pb: [
    {
      sampleId: 'MB',
      sampleType: 'blank_method',
      weight: 0.2,
      volume: 50,
      df: 1,
      signal: 120.0,
      cRaw: 2.0,
      cNet: 0.0,
      zone: 'Zona 1 (ND)',
      reportedValue: 'ND',
    },
    {
      sampleId: 'S1',
      sampleType: 'sample',
      weight: 0.2014,
      volume: 50,
      df: 1,
      signal: 220.0,
      cRaw: 12.0,
      cNet: 10.0,
      zone: 'Zona 3 (Sah)',
      reportedValue: '2.500 mg/kg',
    },
    {
      sampleId: 'S2',
      sampleType: 'sample',
      weight: 0.2005,
      volume: 50,
      df: 1,
      signal: 110.0,
      cRaw: 1.0,
      cNet: -1.0,
      zone: 'Zona 1 (ND)',
      reportedValue: 'ND',
    },
    {
      sampleId: 'CCV1',
      sampleType: 'ccv',
      weight: 0.2,
      volume: 50,
      df: 1,
      signal: 600.0,
      cRaw: 50.0,
      cNet: 48.0,
      zone: 'Zona 3 (Sah)',
      reportedValue: '50.0 ppb',
      qcResult: 'Rec 100.0% (PASS)',
      isQcViolation: false,
    },
    {
      sampleId: 'SP1',
      sampleType: 'spike',
      parentSampleId: 'S1',
      weight: 0.2,
      volume: 50,
      df: 1,
      signal: 270.0,
      cRaw: 17.0,
      cNet: 15.0,
      zone: 'Zona 3 (Sah)',
      reportedValue: '15.0 ppb',
      qcResult: 'Rec 100.0% (PASS)',
      isQcViolation: false,
    },
    {
      sampleId: 'D1',
      sampleType: 'duplicate',
      parentSampleId: 'S1',
      weight: 0.201,
      volume: 50,
      df: 1,
      signal: 221.0,
      cRaw: 12.1,
      cNet: 10.1,
      zone: 'Zona 3 (Sah)',
      reportedValue: '2.525 mg/kg',
      qcResult: 'RPD 1.0% (PASS)',
      isQcViolation: false,
    },
  ],
};

export default function CalibrationDetailPage() {
  const [selectedAnalyte, setSelectedAnalyte] = useState<AnalyteKey>('Al');
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  const curve = ANALYTE_CURVES[selectedAnalyte];
  const samples = SAMPLE_RESULTS[selectedAnalyte];

  const chartData = useMemo(() => {
    return curve.standards.map((s) => ({
      nominal: s.nominal,
      actualSignal: s.signal,
      fittedSignal: Number((curve.slope * s.nominal + curve.intercept).toFixed(4)),
      name: s.name,
    }));
  }, [curve]);

  const handleDownload = (sampleId: string) => {
    setDownloadToast(
      `Mengunduh lembar kerja ${sampleId}.xlsx (${selectedAnalyte}) dengan formula native Excel...`,
    );
    setTimeout(() => setDownloadToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <NavLink
            to="/calibrations"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors mb-1 font-mono"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Kembali ke Daftar Batch
          </NavLink>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Pengujian ICP-MS Logam Berat Beras Putih
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              INVALID_QC (OOS DETECTED)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Instrumen: <strong>ICP-MS</strong> &bull; SOP: <strong>SOP-LAB-QC-01 Rev.1</strong>{' '}
            &bull; Tanggal Uji: 11 Nov 2026
          </p>
        </div>

        <div className="flex items-center gap-2">
          <NavLink
            to="/calibrations/new"
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-xs"
          >
            + Batch Baru
          </NavLink>
        </div>
      </div>

      {downloadToast && (
        <div className="p-3.5 rounded-lg bg-slate-900 text-white text-xs flex items-center justify-between shadow-lg animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono">{downloadToast}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">ADR-0008 Export</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="font-medium text-slate-700">Filter Tampilan per Analit:</span>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 font-mono text-xs">
          <button
            onClick={() => setSelectedAnalyte('Al')}
            className={`px-4 py-1.5 rounded-md transition-colors ${
              selectedAnalyte === 'Al'
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aluminium (Al)
          </button>
          <button
            onClick={() => setSelectedAnalyte('Pb')}
            className={`px-4 py-1.5 rounded-md transition-colors ${
              selectedAnalyte === 'Pb'
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Timbal (Pb)
          </button>
        </div>
      </div>

      {selectedAnalyte === 'Al' ? (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-900 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Penyimpangan Kontrol Mutu pada Analit Aluminium (Al)</span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
              Soft-Flag Audit Trail
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-mono text-[11px]">
            <div className="p-2.5 rounded-lg bg-white/90 border border-amber-200">
              <div className="font-bold text-amber-900">CCV Recovery: 120.0%</div>
              <div className="text-amber-700 text-[10px] mt-0.5">Toleransi SOP: 90.0% – 110.0%</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white/90 border border-amber-200">
              <div className="font-bold text-amber-900">Spike Recovery: 140.0%</div>
              <div className="text-amber-700 text-[10px] mt-0.5">Toleransi SOP: 60.0% – 115.0%</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white/90 border border-amber-200">
              <div className="font-bold text-amber-900">Duplo RPD: 80.0%</div>
              <div className="text-amber-700 text-[10px] mt-0.5">Toleransi SOP: &le; 25.0%</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Semua kriteria kontrol mutu untuk Timbal (Pb) memenuhi syarat SOP: CCV (100%), Spike
              (100%), RPD (1.0%).
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold">
            QC PASSED (Pb)
          </span>
        </div>
      )}

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
              <CheckCircle2 className="w-3 h-3" />r = {curve.r.toFixed(6)}
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
              <div className="text-xs font-bold text-slate-900 mt-0.5">
                {curve.slope.toFixed(4)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
              <div className="text-[10px] text-slate-500 uppercase font-sans">Intercept (c)</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5">
                {curve.intercept.toFixed(4)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
              <div className="text-[10px] text-slate-500 uppercase font-sans">
                Korelasi (R&sup2;)
              </div>
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

      <SampleEvaluationTable
        analyteName={curve.name}
        analyteSymbol={curve.symbol}
        samples={samples}
        onDownload={handleDownload}
      />
    </div>
  );
}
