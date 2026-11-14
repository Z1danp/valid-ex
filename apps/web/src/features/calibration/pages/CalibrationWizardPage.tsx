import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FileSpreadsheet,
  X,
  Info,
  Edit2,
  Activity,
  Layers,
  Lock,
} from 'lucide-react';
import { StandardDataGrid, type StandardRowItem } from '../components/StandardDataGrid';
import { SampleDataGrid, type SampleRowState } from '../components/SampleDataGrid';

import type { components } from '@valid-ex/contracts';

type SolutionConcUnit = components['schemas']['MetrologyUnits']['solutionConcUnit'];
type signalUnit = components['schemas']['MetrologyUnits']['signalUnit']

const INITIAL_ANALYTES: string[] = [];

const DEFAULT_LEVELS = [
  { name: 'Blank', nominal: 0 },
  { name: 'Std 10', nominal: 10 },
  { name: 'Std 50', nominal: 50 },
  { name: 'Std 100', nominal: 100 },
  { name: 'Std 300', nominal: 300 },
  { name: 'Std 500', nominal: 500 },
];

const INITIAL_STANDARDS: StandardRowItem[] = DEFAULT_LEVELS.map((lvl) => ({
  standardName: lvl.name,
  nominalConc: lvl.nominal,
  readings: {},
}));

const INITIAL_SAMPLES: SampleRowState[] = [
  { id: 'MB', type: 'blank_method', parent: '', weight: 0.2000, vol: 50, df: 1, readings: {} },
  { id: 'S1', type: 'sample', parent: '', weight: 0.2014, vol: 50, df: 1, readings: {} },
  { id: 'S2', type: 'sample', parent: '', weight: 0.2005, vol: 50, df: 1, readings: {} },
  { id: 'CCV1', type: 'ccv', parent: '', weight: 0.2000, vol: 50, df: 1, readings: {} },
  { id: 'SP1', type: 'spike', parent: 'S1', weight: 0.2000, vol: 50, df: 1, readings: {} },
  { id: 'D1', type: 'duplicate', parent: 'S1', weight: 0.2010, vol: 50, df: 1, readings: {} },
];

export default function CalibrationWizardPage() {
  /// state section
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [title, setTitle] = useState('Pengujian ICP-MS Logam Berat Beras Putih');
  const [instrument, setInstrument] = useState('ICP-MS');
  const [inputMode, setInputMode] = useState<'raw_signal' | 'in_vial_concentration'>('raw_signal');
  const [unit, setUnit] = useState<SolutionConcUnit>('ppm')
  const [signalUnit, setSignalUnit] = useState<signalUnit>('cps')

  const [analytes, setAnalytes] = useState<string[]>(INITIAL_ANALYTES);
  const [newAnalyteInput, setNewAnalyteInput] = useState('');
  const [editingAnalyte, setEditingAnalyte] = useState<string | null>(null);

  const [selectedAnalyte, setSelectedAnalyte] = useState<string>('');
  const [quickAddAnalyteInput, setQuickAddAnalyteInput] = useState('');
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [standards, setStandards] = useState<StandardRowItem[]>(INITIAL_STANDARDS);
  const [samples, setSamples] = useState<SampleRowState[]>(INITIAL_SAMPLES);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  // Progressive Wizard Gating: Step 2 requires >= 1 analyte, Step 3 requires standards filled
  const canProceedToStep2 = analytes.length > 0;

  const isStandardsFilled = useMemo(() => {
    if (standards.length < 3 || analytes.length === 0) return false;
    return analytes.every((analyte) => {
      const filledPoints = standards.filter((s) => {
        const reading = s.readings[analyte];
        return (
          reading !== undefined &&
          typeof reading.signal === 'number' &&
          !isNaN(reading.signal)
        );
      });
      return filledPoints.length >= 3;
    });
  }, [standards, analytes]);

  const canProceedToStep3 = canProceedToStep2 && isStandardsFilled;

  // Auto-redirect to valid step if dependencies are deleted
  useEffect(() => {
    if (analytes.length === 0 && step > 1) {
      setStep(1);
    } else if (!canProceedToStep3 && step === 3) {
      setStep(2);
    }
  }, [analytes.length, canProceedToStep3, step]);

  const handleAddAnalyteWithSymbol = (rawSymbol: string) => {
    const raw = rawSymbol.trim();
    if (!raw) return;
    
    const formatted = raw.charAt(0).toUpperCase() + raw.slice(1);
    if (analytes.includes(formatted)) {
      setSelectedAnalyte(formatted);
      return;
    }

    setAnalytes((prev) => [...prev, formatted]);

    // const sensitivityMap: Record<string, { slope: number; intercept: number }> = {
    //   Al: { slope: 2.0, intercept: 5.0 },
    //   Cd: { slope: 12.0, intercept: 10.0 },
    //   Mn: { slope: 20.0, intercept: 15.0 },
    //   Pb: { slope: 10.0, intercept: 100.0 },
    // };
    // const sens = sensitivityMap[formatted] || { slope: 10.0, intercept: 10.0 };

    // setStandards((prev) =>
    //   prev.map((row) => ({
    //     ...row,
    //     readings: {
    //       ...row.readings,
    //       [formatted]: {
    //         nominalConc: row.nominalConc,
    //         signal:
    //           row.nominalConc === 0
    //             ? sens.intercept
    //             : Number((row.nominalConc * sens.slope + sens.intercept).toFixed(1)),
    //       },
    //     },
    //   }))
    // );

    // setSamples((prev) =>
    //   prev.map((s) => ({
    //     ...s,
    //     readings: {
    //       ...s.readings,
    //       [formatted]:
    //         s.type === 'blank_method'
    //           ? Number((sens.intercept * 1.2).toFixed(1))
    //           : Number((sens.slope * 15 + sens.intercept).toFixed(1)),
    //     },
    //   }))
    // );

    setSelectedAnalyte((prev) => (prev ? prev : formatted));
  };

  const handleAddAnalyte = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    handleAddAnalyteWithSymbol(newAnalyteInput);
    setNewAnalyteInput('');
  };

  const handleQuickAddAnalyte = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    handleAddAnalyteWithSymbol(quickAddAnalyteInput);
    setQuickAddAnalyteInput('');
    setShowQuickAdd(false);
  };

  const handleRenameAnalyte = (oldSymbol: string, newSymbolRaw: string) => {
    const clean = newSymbolRaw.trim();
    if (!clean) {
      setEditingAnalyte(null);
      return;
    }
    const formatted = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (formatted === oldSymbol) {
      setEditingAnalyte(null);
      return;
    }
    if (analytes.includes(formatted)) {
      alert(`Analit ${formatted} sudah ada dalam daftar.`);
      return;
    }

    setAnalytes((prev) => prev.map((a) => (a === oldSymbol ? formatted : a)));

    setStandards((prev) =>
      prev.map((row) => {
        const readings = { ...row.readings };
        if (readings[oldSymbol]) {
          readings[formatted] = readings[oldSymbol]!;
          delete readings[oldSymbol];
        }
        return { ...row, readings };
      })
    );

    setSamples((prev) =>
      prev.map((s) => {
        const readings = { ...s.readings };
        if (readings[oldSymbol] !== undefined) {
          readings[formatted] = readings[oldSymbol]!;
          delete readings[oldSymbol];
        }
        return { ...s, readings };
      })
    );

    if (selectedAnalyte === oldSymbol) {
      setSelectedAnalyte(formatted);
    }
    setEditingAnalyte(null);
  };

  const handleRemoveAnalyte = (symbol: string) => {
    const updated = analytes.filter((a) => a !== symbol);
    setAnalytes(updated);

    setStandards((prev) =>
      prev.map((row) => {
        const readings = { ...row.readings };
        delete readings[symbol];
        return { ...row, readings };
      })
    );

    setSamples((prev) =>
      prev.map((s) => {
        const readings = { ...s.readings };
        delete readings[symbol];
        return { ...s, readings };
      })
    );

    if (selectedAnalyte === symbol) {
      setSelectedAnalyte(updated[0] || '');
    }
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
    ? standards.filter(
        (s) => (s.readings[selectedAnalyte]?.nominalConc ?? s.nominalConc) > 0
      ).length
    : 0;

  const hasBlank = selectedAnalyte
    ? standards.some(
        (s) => (s.readings[selectedAnalyte]?.nominalConc ?? s.nominalConc) === 0
      )
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

  const handleSubmitBatch = () => {
    navigate('/calibrations/batch-demo-1');
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            Form Wizard Kalibrasi &amp; Kuantifikasi
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
            {step === 1 && 'Langkah 1: Metadata & Konfigurasi Unit Metrologi'}
            {step === 2 && 'Langkah 2: DataGrid Standar & Live Preview Kurva'}
            {step === 3 && 'Langkah 3: DataGrid Sampel Uji & Kontrol Mutu'}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              step === 1 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Metadata
          </button>
          <span className="text-slate-300">/</span>
          <button
            type="button"
            onClick={() => canProceedToStep2 && setStep(2)}
            disabled={!canProceedToStep2}
            title={!canProceedToStep2 ? 'Tambahkan minimal 1 analit terlebih dahulu' : undefined}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-md font-medium transition-colors ${
              step === 2
                ? 'bg-slate-900 text-white'
                : canProceedToStep2
                ? 'bg-slate-100 text-slate-600 hover:text-slate-900'
                : 'bg-slate-100/60 text-slate-300 cursor-not-allowed'
            }`}
          >
            {!canProceedToStep2 && <Lock className="w-2.5 h-2.5" />}
            2. Standar
          </button>
          <span className="text-slate-300">/</span>
          <button
            type="button"
            onClick={() => canProceedToStep3 && setStep(3)}
            disabled={!canProceedToStep3}
            title={!canProceedToStep3 ? 'Lengkapi deret standar terlebih dahulu' : undefined}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-md font-medium transition-colors ${
              step === 3
                ? 'bg-slate-900 text-white'
                : canProceedToStep3
                ? 'bg-slate-100 text-slate-600 hover:text-slate-900'
                : 'bg-slate-100/60 text-slate-300 cursor-not-allowed'
            }`}
          >
            {!canProceedToStep3 && <Lock className="w-2.5 h-2.5" />}
            3. Sampel
          </button>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                Informasi Pengujian
              </h2>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Judul Batch Kalibrasi</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Instrumen</label>
                  <select
                    value={instrument}
                    onChange={(e) => setInstrument(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="ICP-MS">ICP-MS</option>
                    <option value="ICP-OES">ICP-OES</option>
                    <option value="AAS">AAS</option>
                    <option value="HPLC">HPLC</option>
                    <option value="GC-MS">GC-MS</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Input Mode</label>
                  <select
                    value={inputMode}
                    onChange={(e) => setInputMode(e.target.value as 'raw_signal' | 'in_vial_concentration')}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="raw_signal">Raw Signal</option>
                    <option value="in_vial_concentration">In-Vial Concentration</option>
                  </select>
                </div>
              </div>

              
                <div className='space-y-1.5'>
                <label className='text-xs font-medium text-slate-700'>Raw Signal Unit</label>
                <select
                value={signalUnit}
                onChange={(e) => setSignalUnit(e.target.value as signalUnit)}
                 className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900">
                  <option value="cps">cps</option>
                  <option value="abs">absorbance</option>
                </select>
              </div>
              

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Profil Kriteria QC (SOP)</label>
                <select className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900">
                  <option value="sop-rev1">SOP-LAB-QC-01 Rev.1 (r &ge; 0.995, CCV 90-110%, Spike 60-115%, RPD &le; 25%)</option>
                </select>
              </div>

              <div className='space-y-1.5'>
                <label className='text-xs font-medium text-slate-700'>Concentration Unit</label>
                <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as SolutionConcUnit)}
                 className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900">
                  <option value="ppm">ppm</option>
                  <option value="ppb">ppb</option>
                  <option value="ppt">ppt</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                  Daftar Elemen Analit (Multi-Analyte)
                </h2>
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${analytes.length > 0 ? 'bg-slate-100 text-slate-700 font-medium' : 'bg-amber-50 text-amber-700 font-semibold'}`}>
                  {analytes.length} elemen aktif
                </span>
              </div>

              <div className="space-y-3">
                <form onSubmit={handleAddAnalyte} className="flex gap-2">
                  <input
                    type="text"
                    value={newAnalyteInput}
                    onChange={(e) => setNewAnalyteInput(e.target.value)}
                    placeholder="Simbol analit baru (mis. Al, Cd, Mn, Pb, As)..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!newAnalyteInput.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah
                  </button>
                </form>

                {analytes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 text-center space-y-1 min-h-20">
                    <span className="text-xs font-mono font-medium text-slate-500">Belum ada elemen analit</span>
                    <p className="text-[11px] text-slate-400 max-w-sm">
                      Ketik simbol analit (misal <strong className="text-slate-600 font-mono">Al</strong>, <strong className="text-slate-600 font-mono">Cd</strong>, <strong className="text-slate-600 font-mono">Mn</strong>, atau <strong className="text-slate-600 font-mono">Pb</strong>) lalu klik <strong>+ Tambah</strong> untuk membuka deret standar.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50/50 min-h-20 items-center">
                    {analytes.map((symbol) => {
                      const isEditing = editingAnalyte === symbol;
                      return (
                        <span
                          key={symbol}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-xs font-mono font-medium text-slate-800 shadow-2xs"
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              defaultValue={symbol}
                              onBlur={(e) => handleRenameAnalyte(symbol, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameAnalyte(symbol, (e.target as HTMLInputElement).value);
                                if (e.key === 'Escape') setEditingAnalyte(null);
                              }}
                              className="w-16 px-1 py-0.5 border border-blue-500 rounded text-xs bg-white focus:outline-none"
                            />
                          ) : (
                            <>
                              <span>{symbol}</span>
                              <button
                                type="button"
                                onClick={() => setEditingAnalyte(symbol)}
                                className="text-slate-400 hover:text-blue-600 transition-colors"
                                title="Ubah nama simbol"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveAnalyte(symbol)}
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title={`Hapus ${symbol}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="text-[11px] text-slate-500 flex items-start gap-1.5 leading-relaxed font-sans">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    Sebelum lanjut ke Step 2, Anda harus memasukkan minimal 1 elemen analit. Kolom spreadsheet deret standar dan sampel uji akan langsung disesuaikan dengan analit aktif di sini.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-3">
            {!canProceedToStep2 && (
              <span className="text-[11px] text-amber-600 font-mono flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Tambahkan minimal 1 elemen analit untuk mengaktifkan Step 2
              </span>
            )}
            <button
              type="button"
              onClick={() => canProceedToStep2 && setStep(2)}
              disabled={!canProceedToStep2}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900 text-white text-xs font-medium transition-colors shadow-2xs"
            >
              Lanjut ke Step 2: Deret Standar &amp; Kurva
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {/* SECTION 1: Full-Width Standards Spreadsheet matching Label | Al | Cd | Mn | Pb */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                  Spreadsheet DataGrid Deret Standar (Multi-Elemen)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Format Kolom: <code className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">Label | {analytes.join(' | ')}</code>. Blok di Excel &rarr; Ctrl+C &rarr; Ctrl+V ke dalam tabel.
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
                    <button type="submit" className="ml-1 text-slate-700 hover:text-slate-900 font-medium text-xs">
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
              unit = {unit}
              standards={standards}
              analytes={analytes}
              onChange={setStandards}
              onNotice={(msg) => {
                setPasteNotice(msg);
                setTimeout(() => setPasteNotice(null), 4000);
              }}
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
                  Pilih elemen analit di bawah untuk meninjau kurva kalibrasi regresi OLS, sensitivitas, dan batas deteksi:
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
                  <div className="font-semibold">Peringatan Invariant D1 (ISO 17025) untuk {selectedAnalyte}</div>
                  <div className="text-[11px] text-amber-800 mt-0.5">
                    Kurva linear wajib memiliki minimal 5 konsentrasi non-zero dan titik blanko (0 {unit}). Saat ini terdeteksi{' '}
                    <strong>{nonZeroLevels} level non-zero</strong> {hasBlank ? '(dengan blanko)' : '(tanpa blanko 0 {unit})'}.
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Curve Chart */}
              <div className="lg:col-span-7 bg-slate-50/50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 font-mono">
                    Plot Kurva Kalibrasi: <strong className="text-slate-900">{selectedAnalyte || '-'}</strong>
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
                      <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="nominal"
                          type="number"
                          unit= {unit}
                          tick={{ fontSize: 10, fill: '#64748b' }}
                        />
                        <YAxis
                          dataKey="actualSignal"
                          type="number"
                          unit=" cps"
                          tick={{ fontSize: 10, fill: '#64748b' }}
                        />
                        <Tooltip
                          contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                          formatter={(value: any, name: any) => [
                            `${Number(value).toFixed(2)} cps`,
                            name === 'actualSignal' ? 'Signal Aktual' : 'Garis Regresi',
                          ]}
                          labelFormatter={(label: any) => `Konsentrasi: ${label} ${unit}`}
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
                      <div className="text-[10px] text-slate-500 uppercase font-sans">Slope (m, sensitivitas)</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {activeRegression.reg.slope.toFixed(4)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs">
                      <div className="text-[10px] text-slate-500 uppercase font-sans">Intercept (c, sinyal 0)</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {activeRegression.reg.intercept.toFixed(4)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs">
                      <div className="text-[10px] text-slate-500 uppercase font-sans">Korelasi (R&sup2;)</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        {activeRegression.reg.rSquared.toFixed(6)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs">
                      <div className="text-[10px] text-slate-500 uppercase font-sans">Residual (sy/x)</div>
                      <div className="text-sm font-medium text-slate-800 mt-0.5">
                        {activeRegression.reg.syx.toFixed(4)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs">
                      <div className="text-[10px] text-slate-500 uppercase font-sans">LOD Inst (3s/m, {unit})</div>
                      <div className="text-sm font-semibold text-emerald-700 mt-0.5">
                        {activeRegression.lod.toFixed(3)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs">
                      <div className="text-[10px] text-slate-500 uppercase font-sans">LOQ Inst (10s/m, {unit})</div>
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
                                isSelected ? 'bg-slate-100 font-semibold text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <td className="py-1.5">{a}</td>
                              <td className="py-1.5 text-right">{reg ? reg.slope.toFixed(2) : '-'}</td>
                              <td className="py-1.5 text-right">{reg ? reg.r.toFixed(4) : '-'}</td>
                              <td className="py-1.5 text-right">{allRegressions[a]?.lod.toFixed(2) ?? '-'}</td>
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
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                  Spreadsheet Sampel Pengujian (Maks 250 Baris &mdash; Invariant T2)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Blok sel atau seluruh tabel di Excel lalu tempel (<kbd className="px-1 py-0.2 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">Ctrl+V</kbd>) langsung ke dalam grid.
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
              onNotice={(msg) => {
                setPasteNotice(msg);
                setTimeout(() => setPasteNotice(null), 4000);
              }}
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
              onClick={handleSubmitBatch}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Validasi &amp; Simpan Batch (Submit ACID)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
