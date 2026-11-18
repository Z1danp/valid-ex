import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AlertTriangle, Download, ArrowLeft, Filter } from 'lucide-react';
import AnalyteQcBanner from '../components/AnalyteQcBanner';
import CalibrationCurveSection, {
  type AnalyteCurveData,
} from '../components/CalibrationCurveSection';
import SampleEvaluationTable, {
  type SampleAnalyteResult,
} from '../components/SampleEvaluationTable';

type AnalyteKey = 'Al' | 'Pb';

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

      <AnalyteQcBanner analyteName={curve.name} analyteSymbol={curve.symbol} />

      <CalibrationCurveSection curve={curve} />

      <SampleEvaluationTable
        analyteName={curve.name}
        analyteSymbol={curve.symbol}
        samples={samples}
        onDownload={handleDownload}
      />
    </div>
  );
}
