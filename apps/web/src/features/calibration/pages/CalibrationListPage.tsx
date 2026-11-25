import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Plus, Search, Trash, WarningTriangle, CheckCircle } from 'iconoir-react';

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
    title: 'ICP-MS Heavy Metals Analysis: White Rice',
    instrument: 'ICP-MS',
    analytes: ['Al', 'Pb'],
    sampleCount: 6,
    qcStatus: 'INVALID_QC',
    createdAt: '11 Nov 2026 13:45',
  },
  {
    id: 'batch-demo-2',
    title: 'AAS Cadmium Method Validation: Industrial Wastewater',
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

  const filteredBatches = batches.filter(
    (b) =>
      b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.instrument.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Delete batch "${title}" and all of its samples (CASCADE)?`)) {
      setBatches(batches.filter((b) => b.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Analytical Batch History
          </h1>
        </div>

        <NavLink
          to="/calibrations/new"
          className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          New Batch
        </NavLink>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label="Search batch title or instrument"
              placeholder="Search batch title or instrument..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-9 pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            />
          </div>
          <span className="text-xs font-mono text-slate-600">
            Total: {filteredBatches.length}
          </span>
        </div>

        {filteredBatches.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              {batches.length === 0
                ? 'No analytical batches yet'
                : `No batches match "${searchTerm}"`}
            </p>
            <p className="text-xs text-slate-600">
              {batches.length === 0
                ? 'Create a calibration batch to record standards, samples, and QC evaluations.'
                : 'Try a different title or instrument keyword, or clear the search filter.'}
            </p>
            <div>
              {batches.length === 0 ? (
                <NavLink
                  to="/calibrations/new"
                  className="inline-flex items-center gap-1.5 min-h-10 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Create New Batch
                </NavLink>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="inline-flex items-center min-h-10 px-4 py-2 rounded-lg border border-slate-400 bg-white hover:bg-slate-50 text-slate-900 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-mono">
                <tr>
                  <th scope="col" className="p-3 font-semibold">Batch Title</th>
                  <th scope="col" className="p-3 font-semibold">Instrument</th>
                  <th scope="col" className="p-3 font-semibold">Analytes</th>
                  <th scope="col" className="p-3 font-semibold text-right">Samples</th>
                  <th scope="col" className="p-3 font-semibold text-center">QC Status</th>
                  <th scope="col" className="p-3 font-semibold">Run Date</th>
                  <th scope="col" className="p-3 font-semibold text-center">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-medium text-slate-900">
                      <NavLink
                        to={`/calibrations/${batch.id}`}
                        className="hover:underline rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                      >
                        {batch.title}
                      </NavLink>
                    </td>
                    <td className="p-3 font-mono text-slate-700">
                      <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50">
                        {batch.instrument}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-700">
                      <div className="flex gap-1 flex-wrap">
                        {batch.analytes.map((a) => (
                          <span
                            key={a}
                            className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-medium"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-700">{batch.sampleCount}</td>
                    <td className="p-3 text-center">
                      {batch.qcStatus === 'PASSED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" aria-hidden="true" />
                          PASSED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-300">
                          <WarningTriangle className="w-3 h-3" aria-hidden="true" />
                          INVALID_QC
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-600 text-[11px]">{batch.createdAt}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(batch.id, batch.title)}
                          className="min-h-9 min-w-9 inline-flex items-center justify-center p-1.5 rounded hover:bg-red-50 text-slate-600 hover:text-red-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                          title="Delete Batch"
                          aria-label={`Delete batch ${batch.title}`}
                        >
                          <Trash className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
