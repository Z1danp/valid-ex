import { WarningCircle, Copy } from 'iconoir-react';
import type { SampleRowState } from '../utils/sampleValidation';
import type { SolutionConcUnit } from './sampleGridShared';

interface QcTargetParametersPanelProps {
  qcRows: SampleRowState[];
  analytes: string[];
  unit: SolutionConcUnit;
  onChange: (updated: SampleRowState[]) => void;
}

interface QcTargetSubTableProps {
  title: string;
  caption: string;
  description: string;
  fieldKey: 'expectedConc' | 'spikeAdded';
  targetRows: Array<{ row: SampleRowState; originalIndex: number }>;
  allQcRows: SampleRowState[];
  analytes: string[];
  unit: SolutionConcUnit;
  showParent: boolean;
  copyButtonLabel: string;
  onChange: (updated: SampleRowState[]) => void;
}

function QcTargetSubTable({
  title,
  caption,
  fieldKey,
  targetRows,
  allQcRows,
  analytes,
  unit,
  showParent,
  copyButtonLabel,
  onChange,
}: QcTargetSubTableProps) {
  const handleValueChange = (originalIndex: number, analyte: string, rawValue: string) => {
    const updated = [...allQcRows];
    const target = updated[originalIndex];
    if (!target) return;

    const currentMap = { ...(target[fieldKey] ?? {}) };
    const trimmed = rawValue.trim();

    if (trimmed === '') {
      delete currentMap[analyte];
    } else {
      const parsed = Number.parseFloat(trimmed);
      if (Number.isFinite(parsed)) {
        currentMap[analyte] = parsed;
      }
    }

    updated[originalIndex] = {
      ...target,
      [fieldKey]: currentMap,
    };
    onChange(updated);
  };

  const handleCopyFirstRow = () => {
    const first = targetRows[0]?.row[fieldKey];
    if (!first) return;

    const updated = [...allQcRows];
    for (const item of targetRows.slice(1)) {
      const target = updated[item.originalIndex];
      if (!target) continue;
      updated[item.originalIndex] = {
        ...target,
        [fieldKey]: { ...first },
      };
    }
    onChange(updated);
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-slate-900">{title}</h3>
        </div>

        {targetRows.length > 1 && (
          <button
            type="button"
            onClick={handleCopyFirstRow}
            className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg border border-slate-500 bg-white hover:bg-slate-100 text-xs font-medium text-slate-900 transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            {copyButtonLabel}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-slate-100 border-b border-slate-300 text-slate-800 font-mono">
            <tr>
              <th scope="col" className="p-2.5 font-semibold whitespace-nowrap">
                Sample ID
              </th>
              {showParent && (
                <th scope="col" className="p-2.5 font-semibold whitespace-nowrap">
                  Parent
                </th>
              )}
              {analytes.map((analyte) => (
                <th scope="col" key={analyte} className="p-2.5 font-semibold whitespace-nowrap">
                  {analyte} ({unit})
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {targetRows.map(({ row, originalIndex }) => {
              const map = row[fieldKey] ?? {};
              return (
                <tr key={`${fieldKey}-${originalIndex}`} className="hover:bg-slate-50">
                  <th
                    scope="row"
                    className="p-2.5 font-mono font-bold text-slate-900 whitespace-nowrap"
                  >
                    {row.id || `QC #${originalIndex + 1}`}
                  </th>
                  {showParent && (
                    <td className="p-2.5 font-mono text-slate-700 whitespace-nowrap">
                      {row.parent?.trim() ? (
                        row.parent
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                          <WarningCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          Not selected
                        </span>
                      )}
                    </td>
                  )}
                  {analytes.map((analyte) => {
                    const currentVal = map[analyte];
                    const isValid =
                      typeof currentVal === 'number' &&
                      Number.isFinite(currentVal) &&
                      currentVal > 0;
                    const inputId = `${fieldKey}-${originalIndex}-${analyte}`;

                    return (
                      <td key={analyte} className="p-2 min-w-[130px]">
                        <label htmlFor={inputId} className="sr-only">
                          {title} {analyte} ({unit}) for {row.id || `row ${originalIndex + 1}`}
                        </label>
                        <input
                          id={inputId}
                          type="number"
                          step="any"
                          min="0"
                          inputMode="decimal"
                          value={currentVal ?? ''}
                          onChange={(e) =>
                            handleValueChange(originalIndex, analyte, e.target.value)
                          }
                          placeholder={`Required > 0 (${unit})`}
                          aria-invalid={!isValid}
                          className={`w-full min-h-10 px-2.5 py-1.5 rounded-md border font-mono text-xs text-slate-900 placeholder:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                            isValid ? 'border-slate-500 bg-white' : 'border-amber-700 bg-amber-50'
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function QcTargetParametersPanel({
  qcRows,
  analytes,
  unit,
  onChange,
}: QcTargetParametersPanelProps) {
  const ccvRows = qcRows
    .map((row, originalIndex) => ({ row, originalIndex }))
    .filter(({ row }) => row.type === 'ccv');

  const spikeRows = qcRows
    .map((row, originalIndex) => ({ row, originalIndex }))
    .filter(({ row }) => row.type === 'spike');

  if (ccvRows.length === 0 && spikeRows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 pt-2 border-t border-slate-200">
      {ccvRows.length > 0 && (
        <QcTargetSubTable
          title={`CCV Target Concentration (expectedConc, ${unit})`}
          caption="Theoretical target concentration table for each CCV row per analyte"
          description="Required (> 0) to calculate CCV % recovery against the QC profile."
          fieldKey="expectedConc"
          targetRows={ccvRows}
          allQcRows={qcRows}
          analytes={analytes}
          unit={unit}
          showParent={false}
          copyButtonLabel="Copy from first CCV"
          onChange={onChange}
        />
      )}

      {spikeRows.length > 0 && (
        <QcTargetSubTable
          title={`Added Spike Concentration (spikeAdded, ${unit})`}
          caption="Added spike concentration table for each Matrix Spike row per analyte"
          description="Required (> 0) to calculate matrix spike % recovery relative to its parent sample."
          fieldKey="spikeAdded"
          targetRows={spikeRows}
          allQcRows={qcRows}
          analytes={analytes}
          unit={unit}
          showParent={true}
          copyButtonLabel="Copy from first Spike"
          onChange={onChange}
        />
      )}
    </div>
  );
}
