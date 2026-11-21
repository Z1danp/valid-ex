import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { type StandardRowItem } from '../components/StandardDataGrid';
import {
  removeAnalyteKeyInRows,
  renameAnalyteKeysInRows,
  syncParentReferencesOnSampleRename,
  toSampleRowInputs,
  type SampleRowState,
} from '../utils/sampleValidation';

import type { components } from '@valid-ex/contracts';
import MetadataWizard from '../components/MetadataWizard';
import StandardWizard from '../components/StandardWizard';
import SampleWizard from '../components/SampleWizard';

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

const INITIAL_ROUTINE_SAMPLES: SampleRowState[] = [
  {
    id: 'S1',
    labSampleId: '',
    type: 'sample',
    parent: '',
    weight: 0.2014,
    vol: 50,
    df: 1,
    readings: {},
  },
  {
    id: 'S2',
    labSampleId: '',
    type: 'sample',
    parent: '',
    weight: 0.2005,
    vol: 50,
    df: 1,
    readings: {},
  },
];

const INITIAL_QC_SAMPLES: SampleRowState[] = [
  {
    id: 'MB',
    type: 'blank_method',
    parent: '',
    weight: null,
    vol: null,
    df: null,
    readings: {},
  },
  {
    id: 'CCV1',
    type: 'ccv',
    parent: '',
    weight: null,
    vol: null,
    df: null,
    expectedConc: {},
    readings: {},
  },
  {
    id: 'SP1',
    type: 'spike',
    parent: 'S1',
    weight: 0.2,
    vol: 50,
    df: 1,
    spikeAdded: {},
    readings: {},
  },
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

  const [selectedAnalyte, setSelectedAnalyte] = useState<string>(INITIAL_ANALYTES[0] ?? '');

  const [standards, setStandards] = useState<StandardRowItem[]>(INITIAL_STANDARDS);
  const [sampleRows, setSampleRows] = useState<SampleRowState[]>(INITIAL_ROUTINE_SAMPLES);
  const [qcRows, setQcRows] = useState<SampleRowState[]>(INITIAL_QC_SAMPLES);
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

    setSampleRows((prev) => renameAnalyteKeysInRows(prev, oldSymbol, formatted));
    setQcRows((prev) => renameAnalyteKeysInRows(prev, oldSymbol, formatted));

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

    setSampleRows((prev) => removeAnalyteKeyInRows(prev, symbol));
    setQcRows((prev) => removeAnalyteKeyInRows(prev, symbol));

    if (selectedAnalyte === symbol) {
      setSelectedAnalyte(updated[0] || '');
    }
  };

  const handleRoutineSamplesChange = (nextSamples: SampleRowState[]) => {
    const syncedQc = syncParentReferencesOnSampleRename(qcRows, sampleRows, nextSamples);
    setSampleRows(nextSamples);
    setQcRows(syncedQc);
  };

  const handleNotice = (msg: string) => {
    setPasteNotice(msg);
    setTimeout(() => setPasteNotice(null), 4000);
  };

  const handleSubmitBatch = () => {
    // Prepared SampleRowInput[] payload for upcoming POST /api/v1/calibrations hook integration.
    toSampleRowInputs(sampleRows, qcRows, analytes);
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
        <SampleWizard
          analytes={analytes}
          sampleRows={sampleRows}
          setSampleRows={handleRoutineSamplesChange}
          qcRows={qcRows}
          setQcRows={setQcRows}
          unit={unit}
          inputMode={inputMode}
          signalUnit={signalUnit}
          pasteNotice={pasteNotice}
          onNotice={handleNotice}
          setStep={setStep}
          onSubmitBatch={handleSubmitBatch}
        />
      )}
    </div>
  );
}
