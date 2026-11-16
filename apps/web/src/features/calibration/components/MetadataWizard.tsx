import { useState } from 'react';
import { Plus, Edit2, X, Info, AlertTriangle, ArrowRight } from 'lucide-react';
import type { components } from '@valid-ex/contracts';

export type InstrumentType = components['schemas']['InstrumentType'];
export type InputMode = components['schemas']['InputMode'];
export type SolutionConcUnit = components['schemas']['MetrologyUnits']['solutionConcUnit'];
export type SignalUnit = components['schemas']['MetrologyUnits']['signalUnit'];

export interface MetadataWizardProps {
    title: components['schemas']['CalibrationBatchRequest']['title'];
    setTitle: (title: string) => void;
    instrument: InstrumentType;
    setInstrument: (instrument: InstrumentType) => void;
    inputMode: InputMode;
    setInputMode: (inputMode: InputMode) => void;
    signalUnit: SignalUnit;
    setSignalUnit: (signalUnit: SignalUnit) => void;
    unit: SolutionConcUnit;
    setUnit: (unit: SolutionConcUnit) => void;
    analytes: components['schemas']['CalibrationBatchRequest']['analytes'];
    onAddAnalyte: (symbol: string) => void;
    onRenameAnalyte: (oldSymbol: string, newSymbol: string) => void;
    onRemoveAnalyte: (symbol: string) => void;
    canProceedToStep2: boolean;
    onNextStep: () => void;
}

export default function MetadataWizard({
    title,
    setTitle,
    instrument,
    setInstrument,
    inputMode,
    setInputMode,
    signalUnit,
    setSignalUnit,
    unit,
    setUnit,
    analytes,
    onAddAnalyte,
    onRenameAnalyte,
    onRemoveAnalyte,
    canProceedToStep2,
    onNextStep,
}: MetadataWizardProps) {
    const [newAnalyteInput, setNewAnalyteInput] = useState('');
    const [editingAnalyte, setEditingAnalyte] = useState<string | null>(null);

    const handleAddAnalyte = (e: React.FormEvent) => {
        e.preventDefault();
        onAddAnalyte(newAnalyteInput);
        setNewAnalyteInput('');
    };

    const submitRenameAnalyte = (oldSymbol: string, newSymbolRaw: string) => {
        onRenameAnalyte(oldSymbol, newSymbolRaw);
        setEditingAnalyte(null);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                        Informasi Pengujian
                    </h2>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700">Judul Batch Kalibrasi</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-sans"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-700">Instrumen</label>
                            <select
                                value={instrument}
                                onChange={(e) => setInstrument(e.target.value as InstrumentType)}
                                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                            >
                                <option value="ICP-MS">ICP-MS</option>
                                <option value="ICP-OES">ICP-OES</option>
                                <option value="AAS">AAS</option>
                                <option value="HPLC">HPLC</option>
                                <option value="GC-MS">GC-MS</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-700">Input Mode</label>
                            <select
                                value={inputMode}
                                onChange={(e) => setInputMode(e.target.value as InputMode)}
                                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                            >
                                <option value="raw_signal">Raw Signal</option>
                                <option value="in_vial_concentration">In-Vial Concentration</option>
                            </select>
                        </div>
                    </div>


                    <div className='space-y-1.5'>
                        <label className='text-xs font-medium text-slate-700'>Raw Signal Unit</label>
                        <select
                            value={signalUnit}
                            onChange={(e) => setSignalUnit(e.target.value as SignalUnit)}
                            className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900">
                            <option value="cps">cps</option>
                            <option value="abs">absorbance</option>
                        </select>
                    </div>


                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700">Profil Kriteria QC (SOP)</label>
                        <select className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900">
                            <option value="sop-rev1">SOP-LAB-QC-01 Rev.1 (r &ge; 0.995, CCV 90-110%, Spike 60-115%, RPD &le; 25%)</option>
                        </select>
                    </div>

                    <div className='space-y-1.5'>
                        <label className='text-xs font-medium text-slate-700'>Concentration Unit</label>
                        <select
                            value={unit}
                            onChange={(e) => setUnit(e.target.value as SolutionConcUnit)}
                            className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900">
                            <option value="ppm">ppm</option>
                            <option value="ppb">ppb</option>
                            <option value="ppt">ppt</option>
                        </select>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
                            Daftar Elemen Analit (Multi-Analyte)
                        </h2>
                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${analytes.length > 0 ? 'bg-slate-100 text-slate-700 font-medium' : 'bg-amber-50 text-amber-700 font-semibold'}`}>
                            {analytes.length} elemen aktif
                        </span>
                    </div>

                    <div className="space-y-3">
                        <form onSubmit={handleAddAnalyte} className="flex gap-2">
                            <input
                                type="text"
                                value={newAnalyteInput}
                                onChange={(e) => setNewAnalyteInput(e.target.value)}
                                placeholder="Simbol analit baru (mis. Al, Cd, Mn, Pb, As)..."
                                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                            />
                            <button
                                type="submit"
                                disabled={!newAnalyteInput.trim()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Tambah
                            </button>
                        </form>

                        {analytes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-6 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 text-center space-y-1 min-h-20">
                                <span className="text-xs font-mono font-medium text-slate-500">Belum ada elemen analit</span>
                                <p className="text-[11px] text-slate-400 max-w-sm">
                                    Ketik simbol analit (misal <strong className="text-slate-600 font-mono">Al</strong>, <strong className="text-slate-600 font-mono">Cd</strong>, <strong className="text-slate-600 font-mono">Mn</strong>, atau <strong className="text-slate-600 font-mono">Pb</strong>) lalu klik <strong>+ Tambah</strong> untuk membuka deret standar.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50/50 min-h-20 items-center">
                                {analytes.map((symbol) => {
                                    const isEditing = editingAnalyte === symbol;
                                    return (
                                        <span
                                            key={symbol}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-xs font-mono font-medium text-slate-800 shadow-2xs"
                                        >
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    defaultValue={symbol}
                                                    onBlur={(e) => submitRenameAnalyte(symbol, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') submitRenameAnalyte(symbol, (e.target as HTMLInputElement).value);
                                                        if (e.key === 'Escape') setEditingAnalyte(null);
                                                    }}
                                                    className="w-16 px-1 py-0.5 border border-blue-500 rounded text-xs bg-white focus:outline-none"
                                                />
                                            ) : (
                                                <>
                                                    <span>{symbol}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingAnalyte(symbol)}
                                                        className="text-slate-400 hover:text-blue-600 transition-colors"
                                                        title="Ubah nama simbol"
                                                    >
                                                        <Edit2 className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onRemoveAnalyte(symbol)}
                                                        className="text-slate-400 hover:text-red-600 transition-colors"
                                                        title={`Hapus ${symbol}`}
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                        <div className="text-[11px] text-slate-500 flex items-start gap-1.5 leading-relaxed font-sans">
                            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span>
                                Sebelum lanjut ke Step 2, Anda harus memasukkan minimal 1 elemen analit. Kolom spreadsheet deret standar dan sampel uji akan langsung disesuaikan dengan analit aktif di sini.
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-3">
                {!canProceedToStep2 && (
                    <span className="text-[11px] text-amber-600 font-mono flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        Tambahkan minimal 1 elemen analit untuk mengaktifkan Step 2
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => canProceedToStep2 && onNextStep()}
                    disabled={!canProceedToStep2}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900 text-white text-xs font-medium transition-colors shadow-2xs"
                >
                    Lanjut ke Step 2: Deret Standar &amp; Kurva
                    <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
