import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Layers, Lock } from 'lucide-react';
import { type StandardRowItem } from '../components/StandardDataGrid';
import { SampleDataGrid, type SampleRowState } from '../components/SampleDataGrid';

import type { components } from '@valid-ex/contracts';
import MetadataWizard from '../components/MetadataWizard';
import StandardWizard from '../components/StandardWizard';

type SolutionConcUnit = components['schemas']['MetrologyUnits']['solutionConcUnit'];
type SignalUnit = components['schemas']['MetrologyUnits']['signalUnit'];
type InputMode = components['schemas']['InputMode'];
type Instrument = components['schemas']['InstrumentType'];

const INITIAL_ANALYTES: string[] = ['Cd'];

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
  { id: 'MB', type: 'blank_method', parent: '', weight: 0.2, vol: 50, df: 1, readings: {} },
  { id: 'S1', type: 'sample', parent: '', weight: 0.2014, vol: 50, df: 1, readings: {} },
  { id: 'S2', type: 'sample', parent: '', weight: 0.2005, vol: 50, df: 1, readings: {} },
  { id: 'CCV1', type: 'ccv', parent: '', weight: 0.2, vol: 50, df: 1, readings: {} },
  { id: 'SP1', type: 'spike', parent: 'S1', weight: 0.2, vol: 50, df: 1, readings: {} },
  { id: 'D1', type: 'duplicate', parent: 'S1', weight: 0.201, vol: 50, df: 1, readings: {} },
];

export default function CalibrationWizardPage() {
  /// state section
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [title, setTitle] = useState('Pengujian ICP-MS Logam Berat Beras Putih');
  const [instrument, setInstrument] = useState<Instrument>('ICP-MS');
  const [inputMode, setInputMode] = useState<InputMode>('raw_signal');
  const [unit, setUnit] = useState<SolutionConcUnit>('ppm');
  const [signalUnit, setSignalUnit] = useState<SignalUnit>('cps');

  const [analytes, setAnalytes] = useState<string[]>(INITIAL_ANALYTES);
  const [editingAnalyte, setEditingAnalyte] = useState<string | null>(null);

  const [selectedAnalyte, setSelectedAnalyte] = useState<string>('');

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
          reading !== undefined && typeof reading.signal === 'number' && !isNaN(reading.signal)
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
    setSelectedAnalyte((prev) => (prev ? prev : formatted));
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
      }),
    );

    setSamples((prev) =>
      prev.map((s) => {
        const readings = { ...s.readings };
        if (readings[oldSymbol] !== undefined) {
          readings[formatted] = readings[oldSymbol]!;
          delete readings[oldSymbol];
        }
        return { ...s, readings };
      }),
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
      }),
    );

    setSamples((prev) =>
      prev.map((s) => {
        const readings = { ...s.readings };
        delete readings[symbol];
        return { ...s, readings };
      }),
    );

    if (selectedAnalyte === symbol) {
      setSelectedAnalyte(updated[0] || '');
    }
  };

  const handleNotice = (msg: string) => {
    setPasteNotice(msg);
    setTimeout(() => setPasteNotice(null), 4000);
  };

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
              step === 1
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
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
        <MetadataWizard
          editingAnalyte={editingAnalyte}
          setEditingAnalyte={setEditingAnalyte}
          title={title}
          analytes={analytes}
          handleRemoveAnalyte={handleRemoveAnalyte}
          handleRenameAnalyte={handleRenameAnalyte}
          inputMode={inputMode}
          instrument={instrument}
          onAddAnalyte={handleAddAnalyteWithSymbol}
          setInputMode={setInputMode}
          setInstrument={setInstrument}
          setTitle={setTitle}
          setUnit={setUnit}
          unit={unit}
          canProceedToStep2={canProceedToStep2}
          setSignalUnit={setSignalUnit}
          setStep={setStep}
          signalUnit={signalUnit}
        />
      )}

      {step === 2 && (
        <StandardWizard
          analytes={analytes}
          standards={standards}
          setStandards={setStandards}
          unit={unit}
          selectedAnalyte={selectedAnalyte}
          setSelectedAnalyte={setSelectedAnalyte}
          onAddAnalyte={handleAddAnalyteWithSymbol}
          pasteNotice={pasteNotice}
          onNotice={handleNotice}
          canProceedToStep3={canProceedToStep3}
          setStep={setStep}
        />
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
              onNotice={handleNotice}
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
