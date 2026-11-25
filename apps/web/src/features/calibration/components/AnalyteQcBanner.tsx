import { WarningTriangle, CheckCircle } from 'iconoir-react';

export interface AnalyteQcBannerProps {
  analyteName: string;
  analyteSymbol: string;
}

export default function AnalyteQcBanner({ analyteName, analyteSymbol }: AnalyteQcBannerProps) {
  if (analyteSymbol === 'Al') {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs text-amber-900 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 font-semibold">
            <WarningTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
            <span>
              Quality Control Deviations for {analyteName} ({analyteSymbol})
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
            Soft-Flag Audit Trail
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 font-mono text-[11px]">
          <div className="p-2.5 rounded-lg bg-white/90 border border-amber-200">
            <div className="font-bold text-amber-900">CCV Recovery: 120.0%</div>
            <div className="text-amber-800 text-[10px] mt-0.5">SOP Limit: 90.0% – 110.0%</div>
          </div>
          <div className="p-2.5 rounded-lg bg-white/90 border border-amber-200">
            <div className="font-bold text-amber-900">Spike Recovery: 140.0%</div>
            <div className="text-amber-800 text-[10px] mt-0.5">SOP Limit: 60.0% – 115.0%</div>
          </div>
          <div className="p-2.5 rounded-lg bg-white/90 border border-amber-200">
            <div className="font-bold text-amber-900">Duplicate RPD: 80.0%</div>
            <div className="text-amber-800 text-[10px] mt-0.5">SOP Limit: &le; 25.0%</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 text-xs text-emerald-900 flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 font-medium">
        <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
        <span>
          All quality control criteria for {analyteName} ({analyteSymbol}) meet SOP limits: CCV
          (100%), Spike (100%), RPD (1.0%).
        </span>
      </div>
      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold">
        QC PASSED ({analyteSymbol})
      </span>
    </div>
  );
}
