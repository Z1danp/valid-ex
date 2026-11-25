import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Flask, TaskList, LogOut, NavArrowDown } from 'iconoir-react';

export default function AppLayout() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [userMenuOpen]);

  const handleLogout = () => {
    setUserMenuOpen(false);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <NavLink
              to="/calibrations"
              className="flex items-center gap-2 font-semibold text-slate-900 tracking-tight rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center">
                <Flask className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              </div>
              <div className="leading-none">
                <div className="text-sm font-bold flex items-center gap-1.5">
                  Valid-Ex
                </div>
              </div>
            </NavLink>

            <nav aria-label="Main navigation" className="hidden sm:flex items-center gap-1 text-xs font-medium">
              <NavLink
                to="/calibrations"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                Analytical Batches
              </NavLink>
              <NavLink
                to="/qc-profiles"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                QC Profiles
              </NavLink>
            </nav>
          </div>

          <div ref={menuContainerRef} className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors text-xs text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              aria-label="Analyst account menu"
            >
              <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center font-mono font-medium text-[11px]">
                DA
              </div>
              <div className="hidden md:block leading-tight pr-1">
                <div className="font-medium text-slate-900 text-xs">Demo Analyst</div>
                <div className="text-[10px] text-slate-600 font-mono">ICP-MS Specialist</div>
              </div>
              <NavArrowDown className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg p-1.5 text-xs z-50"
              >
                <div className="px-2.5 py-2 border-b border-slate-100 mb-1">
                  <p className="font-semibold text-slate-900">Demo Analyst</p>
                  <p className="text-[11px] text-slate-600 truncate font-mono">
                    analyst@lab.iso17025.org
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Local Preview Mode
                  </span>
                </div>
                <div className="space-y-0.5">
                  <NavLink
                    to="/calibrations"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="sm:hidden flex items-center gap-2 px-2.5 py-2 rounded hover:bg-slate-50 text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
                  >
                    <Flask className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                    Analytical Batches
                  </NavLink>
                  <NavLink
                    to="/qc-profiles"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded hover:bg-slate-50 text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
                  >
                    <TaskList className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                    Lab QC SOP Catalog
                  </NavLink>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded hover:bg-red-50 text-red-700 font-medium text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    Sign Out
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

      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-600 font-mono">
        Valid-Ex Metrology Engine &bull; EURACHEM / ISO 17025 Compliant
      </footer>
    </div>
  );
}
