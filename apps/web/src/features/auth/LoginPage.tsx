import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flask } from 'iconoir-react';

export default function LoginPage() {
  const [email, setEmail] = useState('analyst@lab.iso17025.org');
  const [password, setPassword] = useState('password123');
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Sign In | Valid-Ex';
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/calibrations');
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
        <header className="space-y-2 text-center">
          <div
            aria-hidden="true"
            className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center mx-auto shadow-sm"
          >
            <Flask className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Valid-Ex</h1>
          <p className="text-xs text-slate-600">
            ISO/IEC 17025 Calibration &amp; Metrology Validation
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="space-y-1">
            <label htmlFor="login-email" className="block font-medium text-slate-700">
              Analyst Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-11 px-3 py-2 rounded-lg border border-slate-400 bg-white font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="login-password" className="block font-medium text-slate-700">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-11 px-3 py-2 rounded-lg border border-slate-400 bg-white font-mono text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full min-h-11 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm flex items-center justify-center transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Sign in to Workspace
          </button>
        </form>

        <div className="pt-2 border-t border-slate-200 space-y-1 text-center">
          <p className="text-xs text-slate-600">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="inline-flex items-center min-h-11 px-1 font-semibold text-slate-900 underline underline-offset-4 hover:text-slate-700 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Create an account
            </Link>
          </p>
          <p className="text-[11px] text-slate-600 font-mono">
            UI Preview Mode (Not connected to auth API)
          </p>
        </div>
      </div>
    </main>
  );
}
