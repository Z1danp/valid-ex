import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('analis@lab.iso17025.id');
  const [password, setPassword] = useState('password123');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/calibrations');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="space-y-2 text-center">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center mx-auto shadow-sm">
            <FlaskConical className="w-5 h-5 text-emerald-400" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Valid-Ex</h1>
          <p className="text-xs text-slate-500">
            Sistem Kalibrasi &amp; Validasi Metrologi ISO/IEC 17025
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label className="font-medium text-slate-700">Email Analis</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-mono text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            Masuk ke Workspace
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 text-center text-[11px] text-slate-500 font-mono">
          Demo Mockup Mode &bull; Auto Auth
        </div>
      </div>
    </div>
  );
}
