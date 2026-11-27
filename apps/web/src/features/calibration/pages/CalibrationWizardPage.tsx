import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'iconoir-react';
import {
  assignAnalyteToGroup,
  createInitialStandardGroups,
  getDefaultCcvTargetByAnalyte,
  isAllStandardsReady,
  renameAnalyteInStandardGroups,
  splitAnalyteToNewGroup,
  syncStandardGroupsWithAnalytes,
  toStandardRowInputs,
  type StandardGroup,
  type StandardGroupRow,
} from '../utils/standardGroups';
import {
  fillMissingCcvExpectedConc,
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
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [title, setTitle] = useState('ICP-MS Heavy Metals Analysis: White Rice');
  const [instrument, setInstrument] = useState<Instrument>('ICP-MS');
  const [inputMode, setInputMode] = useState<InputMode>('raw_signal');
  const [unit, setUnit] = useState<SolutionConcUnit>('ppm');
  const [signalUnit, setSignalUnit] = useState<SignalUnit>('cps');

  const [analytes, setAnalytes] = useState<string[]>(INITIAL_ANALYTES);
  const [editingAnalyte, setEditingAnalyte] = useState<string | null>(null);
  const [analyteError, setAnalyteError] = useState<string | null>(null);
  const [selectedAnalyte, setSelectedAnalyte] = useState<string>(INITIAL_ANALYTES[0] ?? '');

  const [standardGroups, setStandardGroups] = useState<StandardGroup[]>(() =>
    createInitialStandardGroups(INITIAL_ANALYTES),
  );
  const [sampleRows, setSampleRows] = useState<SampleRowState[]>(INITIAL_ROUTINE_SAMPLES);
  const [qcRows, setQcRows] = useState<SampleRowState[]>(INITIAL_QC_SAMPLES);
  const [pasteNotice, setPasteNotice] = useState<{
    message: string;
    tone: 'info' | 'warning';
  } | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const canProceedToStep2 = analytes.length > 0;

  const isStandardsFilled = useMemo(
    () => isAllStandardsReady(standardGroups, analytes, 3),
    [standardGroups, analytes],
  );

  const canProceedToStep3 = canProceedToStep2 && isStandardsFilled;

  const defaultCcvTarget = useMemo(
    () => getDefaultCcvTargetByAnalyte(standardGroups, analytes),
    [standardGroups, analytes],
  );

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (analytes.length === 0 && step > 1) {
      setStep(1);
    } else if (!canProceedToStep3 && step === 3) {
      setStep(2);
    }
  }, [analytes.length, canProceedToStep3, step]);

  useEffect(() => {
    if (step !== 3) return;
    setQcRows((prev) => fillMissingCcvExpectedConc(prev, analytes, defaultCcvTarget));
  }, [step, analytes, defaultCcvTarget]);

  const handleAddAnalyteWithSymbol = (rawSymbol: string) => {
    const raw = rawSymbol.trim();
    if (!raw) return;

    setAnalyteError(null);
    const formatted = raw.charAt(0).toUpperCase() + raw.slice(1);
    if (analytes.includes(formatted)) {
      setSelectedAnalyte(formatted);
      return;
    }

    const nextAnalytes = [...analytes, formatted];
    setAnalytes(nextAnalytes);
    setStandardGroups((prev) => syncStandardGroupsWithAnalytes(prev, nextAnalytes));
    setSelectedAnalyte((prev) => (prev ? prev : formatted));
  };

  const handleRenameAnalyte = (oldSymbol: string, newSymbolRaw: string) => {
    const clean = newSymbolRaw.trim();
    if (!clean) {
      setEditingAnalyte(null);
      setAnalyteError(null);
      return;
    }
    const formatted = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (formatted === oldSymbol) {
      setEditingAnalyte(null);
      setAnalyteError(null);
      return;
    }
    if (analytes.includes(formatted)) {
      setAnalyteError(`Analyte ${formatted} is already in the list.`);
      return;
    }
    setAnalyteError(null);

    setAnalytes((prev) => prev.map((a) => (a === oldSymbol ? formatted : a)));
    setStandardGroups((prev) => renameAnalyteInStandardGroups(prev, oldSymbol, formatted));
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
    setStandardGroups((prev) => syncStandardGroupsWithAnalytes(prev, updated));
    setSampleRows((prev) => removeAnalyteKeyInRows(prev, symbol));
    setQcRows((prev) => removeAnalyteKeyInRows(prev, symbol));

    if (selectedAnalyte === symbol) {
      setSelectedAnalyte(updated[0] || '');
    }
  };

  const handleUpdateGroupRows = (groupId: string, rows: StandardGroupRow[]) => {
    setStandardGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, rows } : g)));
  };

  const handleAssignAnalyteToGroup = (analyte: string, targetGroupId: string) => {
    setStandardGroups((prev) => assignAnalyteToGroup(prev, analyte, targetGroupId));
  };

  const handleSplitAnalyteToNewGroup = (analyte: string) => {
    setStandardGroups((prev) => splitAnalyteToNewGroup(prev, analyte));
  };

  const handleRoutineSamplesChange = (nextSamples: SampleRowState[]) => {
    const syncedQc = syncParentReferencesOnSampleRename(qcRows, sampleRows, nextSamples);
    setSampleRows(nextSamples);
    setQcRows(syncedQc);
  };

  const handleNotice = (msg: string, tone: 'info' | 'warning' = 'info') => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setPasteNotice({ message: msg, tone });
    noticeTimerRef.current = window.setTimeout(() => {
      setPasteNotice(null);
      noticeTimerRef.current = null;
    }, 4500);
  };

  const handleSubmitBatch = () => {
    // Prepared OpenAPI StandardRowInput[] and SampleRowInput[] payloads for POST /api/v1/calibrations.
    toStandardRowInputs(standardGroups);
    toSampleRowInputs(sampleRows, qcRows, analytes);
    navigate('/calibrations/batch-demo-1');
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-600">
            CALIBRATION &amp; QUANTIFICATION WIZARD
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
            {step === 1 && 'Step 1: Batch Setup & Units'}
            {step === 2 && 'Step 2: Calibration Standards'}
            {step === 3 && 'Step 3: Sample & QC DataGrid'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`min-h-11 sm:min-h-9 px-3 py-1 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              step === 1
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-800 hover:text-slate-900'
            }`}
          >
            1. Setup
          </button>
          <span className="text-slate-500" aria-hidden="true">
            /
          </span>
          <button
            type="button"
            onClick={() => canProceedToStep2 && setStep(2)}
            disabled={!canProceedToStep2}
            title={!canProceedToStep2 ? 'Add at least 1 analyte first' : undefined}
            className={`inline-flex items-center gap-1 min-h-11 sm:min-h-9 px-3 py-1 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              step === 2
                ? 'bg-slate-900 text-white'
                : canProceedToStep2
                  ? 'bg-slate-100 text-slate-800 hover:text-slate-900'
                  : 'bg-slate-100/60 text-slate-600 cursor-not-allowed'
            }`}
          >
            {!canProceedToStep2 && <Lock className="w-3 h-3" aria-hidden="true" />}
            2. Standards
          </button>
          <span className="text-slate-500" aria-hidden="true">
            /
          </span>
          <button
            type="button"
            onClick={() => canProceedToStep3 && setStep(3)}
            disabled={!canProceedToStep3}
            title={!canProceedToStep3 ? 'Complete the calibration standards series first' : undefined}
            className={`inline-flex items-center gap-1 min-h-11 sm:min-h-9 px-3 py-1 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              step === 3
                ? 'bg-slate-900 text-white'
                : canProceedToStep3
                  ? 'bg-slate-100 text-slate-800 hover:text-slate-900'
                  : 'bg-slate-100/60 text-slate-600 cursor-not-allowed'
            }`}
          >
            {!canProceedToStep3 && <Lock className="w-3 h-3" aria-hidden="true" />}
            3. Samples
          </button>
        </div>
      </div>

      {step === 1 && (
        <MetadataWizard
          editingAnalyte={editingAnalyte}
          setEditingAnalyte={(val) => {
            setEditingAnalyte(val);
            setAnalyteError(null);
          }}
          analyteError={analyteError}
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
          standardGroups={standardGroups}
          onUpdateGroupRows={handleUpdateGroupRows}
          onAssignAnalyte={handleAssignAnalyteToGroup}
          onSplitAnalyte={handleSplitAnalyteToNewGroup}
          unit={unit}
          selectedAnalyte={selectedAnalyte}
          setSelectedAnalyte={setSelectedAnalyte}
          onAddAnalyte={handleAddAnalyteWithSymbol}
          pasteNotice={pasteNotice}
          onNotice={handleNotice}
          canProceedToStep3={canProceedToStep3}
          setStep={setStep}
          signalUnit={signalUnit}
        />
      )}

      {step === 3 && (
        <SampleWizard
          analytes={analytes}
          sampleRows={sampleRows}
          setSampleRows={handleRoutineSamplesChange}
          qcRows={qcRows}
          setQcRows={setQcRows}
          defaultCcvTarget={defaultCcvTarget}
          unit={unit}
          inputMode={inputMode}
          signalUnit={signalUnit}
          pasteNotice={pasteNotice?.message ?? null}
          onNotice={(msg) => handleNotice(msg, 'info')}
          setStep={setStep}
          onSubmitBatch={handleSubmitBatch}
        />
      )}
    </div>
  );
}
