import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { FlaskConical, ClipboardList, LogOut, User, ChevronDown } from 'lucide-react';

export default function AppLayout() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    setUserMenuOpen(false);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <NavLink to="/calibrations" className="flex items-center gap-2 font-semibold text-slate-900 tracking-tight">
              <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="leading-none">
                <div className="text-sm font-bold flex items-center gap-1.5">
                  Valid-Ex
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border border-slate-200 text-slate-500 font-normal">
                    ISO 17025
                  </span>
                </div>
              </div>
            </NavLink>

            <nav className="hidden sm:flex items-center gap-1 text-xs font-medium">
              <NavLink
                to="/calibrations"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md transition-colors ${
                    isActive ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                Batch Kalibrasi
              </NavLink>
              <NavLink
                to="/qc-profiles"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md transition-colors ${
                    isActive ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                Profil QC (SOP)
              </NavLink>
            </nav>
          </div>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs text-left"
              aria-expanded={userMenuOpen}
            >
              <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-mono font-medium text-[11px]">
                ZA
              </div>
              <div className="hidden md:block leading-tight pr-1">
                <div className="font-medium text-slate-900 text-xs">Zidan Analis</div>
                <div className="text-[10px] text-slate-500 font-mono">ICP-MS Specialist</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg p-1.5 text-xs z-50 animate-in fade-in-50">
                <div className="px-2.5 py-2 border-b border-slate-100 mb-1">
                  <p className="font-semibold text-slate-900">Zidan Analis</p>
                  <p className="text-[11px] text-slate-500 truncate font-mono">analis@lab.iso17025.id</p>
                  <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Local Auth Verified
                  </span>
                </div>
                <div className="space-y-0.5">
                  <NavLink
                    to="/qc-profiles"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-slate-50 text-slate-700"
                  >
                    <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                    Katalog SOP QC Lab
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-red-50 text-red-600 font-medium text-left transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Keluar (Logout)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500 font-mono">
        Valid-Ex Metrology Engine &bull; EURACHEM / ISO 17025 Compliant
      </footer>
    </div>
  );
}
