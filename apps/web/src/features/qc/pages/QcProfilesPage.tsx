import { useState } from 'react';
import { ShieldCheck, Plus, OpenBook, MultiplePages, InfoCircle } from 'iconoir-react';

export default function QcProfilesPage() {
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);

  const handleNewVersion = () => {
    // TODO: Connect to POST /api/v1/qc-profiles once gateway endpoint is wired
    setPreviewNotice(
      'New profile version creation is in UI preview mode (planned: POST /qc-profiles).',
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Quality Control (QC) Criteria Profiles
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Versioned, governed ISO/IEC 17025 acceptance criteria profiles with SOP citations
          </p>
        </div>

        <button
          type="button"
          onClick={handleNewVersion}
          className="inline-flex items-center gap-1.5 min-h-10 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          New Profile Version (Preview)
        </button>
      </div>

      {previewNotice && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-slate-300 bg-slate-100 px-3.5 py-2.5 text-xs text-slate-800 flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <InfoCircle className="w-4 h-4 text-slate-700 shrink-0" aria-hidden="true" />
            {previewNotice}
          </span>
          <button
            type="button"
            onClick={() => setPreviewNotice(null)}
            className="text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800">
              <ShieldCheck className="w-5 h-5 text-emerald-700" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">SOP-LAB-QC-01</h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Rev. 1 (Active)
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
                <OpenBook className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                <span>
                  Citation: Emission &amp; Mass Spectrometry Testing SOP No. MET-04/Rev.3
                </span>
              </p>
            </div>
          </div>

          <span className="text-xs font-mono text-slate-600">Immutable Snapshot (ADR-0007)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
            <div className="text-[10px] uppercase font-sans text-slate-600">
              Minimum Linearity (r)
            </div>
            <div className="text-sm font-bold text-slate-900">&ge; 0.9950</div>
            <div className="text-[10px] text-slate-600 font-sans">Pearson correlation coefficient</div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
            <div className="text-[10px] uppercase font-sans text-slate-600">
              CCV Recovery Target
            </div>
            <div className="text-sm font-bold text-slate-900">90.0% – 110.0%</div>
            <div className="text-[10px] text-slate-600 font-sans">
              Continuing Calibration Verification
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
            <div className="text-[10px] uppercase font-sans text-slate-600">
              Matrix Spike Recovery
            </div>
            <div className="text-sm font-bold text-slate-900">60.0% – 115.0%</div>
            <div className="text-[10px] text-slate-600 font-sans">
              Sample matrix spike recovery
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
            <div className="text-[10px] uppercase font-sans text-slate-600">Duplicate Max RPD</div>
            <div className="text-sm font-bold text-slate-900">&le; 25.0%</div>
            <div className="text-[10px] text-slate-600 font-sans">Relative Percent Difference</div>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/30 text-xs text-slate-700 flex items-start gap-2.5">
          <MultiplePages className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">
            This profile is snapshotted onto each calibration batch on submission. Updating these
            thresholds automatically issues a new version (Rev. 2) without altering past batch
            audit records.
          </p>
        </div>
      </div>
    </div>
  );
}
