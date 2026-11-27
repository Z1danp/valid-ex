import { useMemo, useRef, useState } from 'react';
import {
  Atom,
  WarningCircle,
  WarningTriangle,
  ArrowLeft,
  CheckCircle,
  Table2Columns,
} from 'iconoir-react';
import { SampleDataGrid } from './SampleDataGrid';
import { QcDataGrid } from './QcDataGrid';
import { QcTargetParametersPanel } from './QcTargetParametersPanel';
import {
  fillMissingCcvExpectedConc,
  getAvailableParentOptions,
  validateBatchSamples,
  type SampleRowState,
} from '../utils/sampleValidation';
import type { InputMode, SignalUnit, SolutionConcUnit } from './sampleGridShared';
import type { components } from '@valid-ex/contracts';

type Analytes = components['schemas']['CalibrationBatchRequest']['analytes'];

export interface SampleWizardProps {
  analytes: Analytes;
  sampleRows: SampleRowState[];
  setSampleRows: (updated: SampleRowState[]) => void;
  qcRows: SampleRowState[];
  setQcRows: (updated: SampleRowState[]) => void;
  defaultCcvTarget?: Record<string, number | undefined> | number;
  unit: SolutionConcUnit;
  inputMode: InputMode;
  signalUnit: SignalUnit;
  pasteNotice: string | null;
  onNotice: (msg: string) => void;
  setStep: (step: 1 | 2 | 3) => void;
  onSubmitBatch: () => void;
}

export default function SampleWizard({
  analytes,
  sampleRows,
  setSampleRows,
  qcRows,
  setQcRows,
  defaultCcvTarget,
  unit,
  inputMode,
  signalUnit,
  pasteNotice,
  onNotice,
  setStep,
  onSubmitBatch,
}: SampleWizardProps) {
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const validationBoxRef = useRef<HTMLDivElement>(null);

  const availableParents = useMemo(() => getAvailableParentOptions(sampleRows), [sampleRows]);
  const totalBatchRows = sampleRows.length + qcRows.length;

  const validationIssues = useMemo(
    () => validateBatchSamples(sampleRows, qcRows, analytes),
    [sampleRows, qcRows, analytes],
  );

  const handleQcGridChange = (updated: SampleRowState[]) => {
    setQcRows(fillMissingCcvExpectedConc(updated, analytes, defaultCcvTarget));
  };

  const handleSubmitClick = () => {
    if (validationIssues.length > 0) {
      setSubmitAttempted(true);
      window.requestAnimationFrame(() => {
        validationBoxRef.current?.focus();
      });
      return;
    }
    onSubmitBatch();
  };

  return (
    <div className="space-y-8">
      {pasteNotice && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 rounded-lg bg-emerald-50 border border-emerald-700 text-emerald-800 text-xs flex items-center gap-2"
        >
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-700" aria-hidden="true" />
          <span>{pasteNotice}</span>
        </div>
      )}

      <section className="bg-white rounded-xl border border-slate-300 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Table 1: Test Samples</h2>
            <p className="text-xs text-slate-700 mt-0.5">
              Paste cell blocks directly from Excel with Ctrl+V.
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 text-xs font-mono text-slate-800 self-start sm:self-auto">
            <Atom className="w-3.5 h-3.5 text-slate-700" aria-hidden="true" />
            {analytes.join(', ')} ({analytes.length} {analytes.length === 1 ? 'analyte' : 'analytes'})
          </span>
        </div>

        <SampleDataGrid
          samples={sampleRows}
          analytes={analytes}
          totalBatchRows={totalBatchRows}
          unit={unit}
          inputMode={inputMode}
          signalUnit={signalUnit}
          onChange={setSampleRows}
          onNotice={onNotice}
        />
      </section>

      <section className="bg-white rounded-xl border border-slate-300 p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Table 2: Quality Control / QC (Method Blank, CCV, Matrix Spike, Duplicate)
            </h2>
            <p className="text-xs text-slate-700 mt-0.5">
              Includes <code className="font-mono text-slate-900">blank_method</code> and{' '}
              <code className="font-mono text-slate-900">ccv</code> (solution QC rows without solid
              Weight, Vol, or dF), plus <code className="font-mono text-slate-900">spike</code> and{' '}
              <code className="font-mono text-slate-900">duplicate</code>. Select a{' '}
              <code className="font-mono text-slate-900">Parent</code> from Table 1 for{' '}
              <code className="font-mono text-slate-900">spike</code> and{' '}
              <code className="font-mono text-slate-900">duplicate</code>.
            </p>
          </div>
        </div>

        <QcDataGrid
          qcRows={qcRows}
          analytes={analytes}
          availableParents={availableParents}
          totalBatchRows={totalBatchRows}
          unit={unit}
          inputMode={inputMode}
          signalUnit={signalUnit}
          onChange={handleQcGridChange}
          onNotice={onNotice}
        />

        <QcTargetParametersPanel
          qcRows={qcRows}
          analytes={analytes}
          unit={unit}
          onChange={setQcRows}
        />
      </section>

      <div
        ref={validationBoxRef}
        tabIndex={-1}
        role={submitAttempted && validationIssues.length > 0 ? 'alert' : 'status'}
        aria-live="polite"
        className={`rounded-xl border p-4 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
          validationIssues.length === 0
            ? 'bg-emerald-50 border-emerald-700 text-emerald-800'
            : submitAttempted
              ? 'bg-red-50 border-red-700 text-red-700'
              : 'bg-amber-50 border-amber-700 text-amber-800'
        }`}
      >
        {validationIssues.length === 0 ? (
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Sample and QC structure validated ({totalBatchRows} rows ready to submit to gateway).
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              {submitAttempted ? (
                <WarningCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <WarningTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                {validationIssues.length}{' '}
                {validationIssues.length === 1 ? 'item requires' : 'items require'} attention before
                saving batch:
              </span>
            </div>
            <ul className="list-disc pl-5 space-y-1">
              {validationIssues.slice(0, 6).map((issue, idx) => (
                <li key={`${issue.scope}-${idx}`}>{issue.message}</li>
              ))}
              {validationIssues.length > 6 && (
                <li className="font-medium">
                  And {validationIssues.length - 6} more validation{' '}
                  {validationIssues.length - 6 === 1 ? 'issue' : 'issues'}.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2.5 rounded-lg border border-slate-500 bg-white hover:bg-slate-50 text-slate-900 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Back to Standards
        </button>
        <button
          type="button"
          onClick={handleSubmitClick}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <Table2Columns className="w-4 h-4" aria-hidden="true" />
          Save Batch
        </button>
      </div>
    </div>
  );
}
