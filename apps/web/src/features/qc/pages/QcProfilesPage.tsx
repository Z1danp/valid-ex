import { ShieldCheck, Plus, BookOpen, Layers } from 'lucide-react';

export default function QcProfilesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Master Profil Kriteria Kontrol Mutu (QC)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen profil kriteria penerimaan ISO/IEC 17025 yang ber-versi, governed, dan bersitasi metode SOP
          </p>
        </div>

        <button
          onClick={() => alert('Fitur pembuatan versi profil baru akan memanggil POST /qc-profiles')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Versi Profil Baru
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">SOP-LAB-QC-01</h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Rev. 1 (Active)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>Sitasi: SOP Pengujian Spektrometri Emisi &amp; Massa Lab No. MET-04/Rev.3</span>
              </p>
            </div>
          </div>

          <span className="text-xs font-mono text-slate-500">
            Immutable Snapshot (ADR-0007)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
            <div className="text-[10px] uppercase font-sans text-slate-500">Linearitas Minimum (r)</div>
            <div className="text-sm font-bold text-slate-900">&ge; 0.9950</div>
            <div className="text-[10px] text-slate-500 font-sans">Koefisien korelasi Pearson</div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
            <div className="text-[10px] uppercase font-sans text-slate-500">CCV Recovery Target</div>
            <div className="text-sm font-bold text-slate-900">90.0% – 110.0%</div>
            <div className="text-[10px] text-slate-500 font-sans">Continuing Calibration Verification</div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
            <div className="text-[10px] uppercase font-sans text-slate-500">Matrix Spike Recovery</div>
            <div className="text-sm font-bold text-slate-900">60.0% – 115.0%</div>
            <div className="text-[10px] text-slate-500 font-sans">Uji temu balik matriks sampel</div>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
            <div className="text-[10px] uppercase font-sans text-slate-500">Duplo Max RPD</div>
            <div className="text-sm font-bold text-slate-900">&le; 25.0%</div>
            <div className="text-[10px] text-slate-500 font-sans">Relative Percent Difference</div>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/30 text-xs text-slate-600 flex items-start gap-2.5">
          <Layers className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <p className="leading-relaxed">
            Profil ini di-snapshot ke setiap batch kalibrasi saat submit. Mengubah ambang toleransi di atas secara otomatis akan menerbitkan versi baru (Rev. 2) tanpa mengubah hasil audit batch terdahulu.
          </p>
        </div>
      </div>
    </div>
  );
}
