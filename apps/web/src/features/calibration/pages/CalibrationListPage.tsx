import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Plus, Search, Eye, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface BatchSummary {
  id: string;
  title: string;
  instrument: string;
  analytes: string[];
  sampleCount: number;
  qcStatus: 'PASSED' | 'INVALID_QC';
  createdAt: string;
}

const INITIAL_BATCHES: BatchSummary[] = [
  {
    id: 'batch-demo-1',
    title: 'Pengujian ICP-MS Logam Berat Beras Putih',
    instrument: 'ICP-MS',
    analytes: ['Al', 'Pb'],
    sampleCount: 6,
    qcStatus: 'INVALID_QC',
    createdAt: '11 Nov 2026 13:45',
  },
  {
    id: 'batch-demo-2',
    title: 'Validasi Metode AAS Kadmium Air Limbah Industri',
    instrument: 'AAS',
    analytes: ['Cd'],
    sampleCount: 14,
    qcStatus: 'PASSED',
    createdAt: '08 Nov 2026 09:20',
  },
];

export default function CalibrationListPage() {
  const [batches, setBatches] = useState<BatchSummary[]>(INITIAL_BATCHES);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBatches = batches.filter((b) =>
    b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.instrument.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Hapus batch "${title}" beserta seluruh sampelnya (CASCADE)?`)) {
      setBatches(batches.filter((b) => b.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Riwayat Batch Kalibrasi</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen pengujian kurva kalibrasi regresi OLS dan evaluasi kontrol mutu ISO 17025
          </p>
        </div>

        <NavLink
          to="/calibrations/new"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Batch Kalibrasi Baru
        </NavLink>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari judul batch atau instrumen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
          <span className="text-xs font-mono text-slate-500">
            Total: {filteredBatches.length} batch
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono">
              <tr>
                <th className="p-3 font-semibold">Judul Batch</th>
                <th className="p-3 font-semibold">Instrumen</th>
                <th className="p-3 font-semibold">Elemen Analit</th>
                <th className="p-3 font-semibold text-right">Sampel</th>
                <th className="p-3 font-semibold text-center">Status QC</th>
                <th className="p-3 font-semibold">Tanggal Uji</th>
                <th className="p-3 font-semibold text-center w-28">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredBatches.map((batch) => (
                <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-medium text-slate-900">
                    <NavLink to={`/calibrations/${batch.id}`} className="hover:underline">
                      {batch.title}
                    </NavLink>
                  </td>
                  <td className="p-3 font-mono text-slate-600">
                    <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50">
                      {batch.instrument}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-600">
                    <div className="flex gap-1 flex-wrap">
                      {batch.analytes.map((a) => (
                        <span key={a} className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-medium">
                          {a}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono text-slate-700">
                    {batch.sampleCount}
                  </td>
                  <td className="p-3 text-center">
                    {batch.qcStatus === 'PASSED' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        PASSED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3 h-3" />
                        INVALID_QC
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-slate-500 text-[11px]">
                    {batch.createdAt}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <NavLink
                        to={`/calibrations/${batch.id}`}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                        title="Lihat Detail Evaluasi"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </NavLink>
                      <button
                        onClick={() => handleDelete(batch.id, batch.title)}
                        className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                        title="Hapus Batch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
