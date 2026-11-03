import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  FileText,
  UploadCloud,
  Pill,
  Salad,
  Calendar,
  MessageSquare,
  Stethoscope,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  ShieldCheck,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export const PatientLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, fetchCurrentUserProfile, currentUser } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    void fetchCurrentUserProfile();
  }, [fetchCurrentUserProfile]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent background body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const navItems = [
    { name: 'Home', path: '/patient', icon: Home, exact: true },
    { name: 'Reports', path: '/patient/reports', icon: FileText },
    { name: 'Medicines', path: '/patient/medicines', icon: Pill },
    { name: 'Food Check', path: '/patient/food-check', icon: Salad },
    { name: 'Appointments', path: '/patient/appointments', icon: Calendar },
    { name: 'Find Doctors', path: '/patient/doctors', icon: Stethoscope },
    { name: 'Ask Doctor', path: '/patient/ask-doctor', icon: MessageSquare },
    { name: 'Upload Report', path: '/patient/upload', icon: UploadCloud },
  ];

  // Quick bottom bar items for mobile
  const bottomBarItems = [
    { name: 'Home', path: '/patient', icon: Home, exact: true },
    { name: 'Reports', path: '/patient/reports', icon: FileText },
    { name: 'Medicines', path: '/patient/medicines', icon: Pill },
    { name: 'Food Check', path: '/patient/food-check', icon: Salad },
    { name: 'Doctors', path: '/patient/doctors', icon: Stethoscope },
  ];

  const rawPatientName = currentUser?.name?.trim() || 'Patient';
  const cleanPatientName = rawPatientName.replace(/^Dr\.?\s*/i, '').trim() || 'Patient';
  const patientInitial = (cleanPatientName.charAt(0) || 'P').toUpperCase();
  const patientRsId = (currentUser as any)?.rsId || 'RS-PAT-4829';

  return (
    <div className="min-h-screen bg-[#F6F9F7] flex flex-col lg:flex-row text-slate-800">
      {/* =========================================================================
       * 1. MOBILE TOP NAVBAR (Visible only on < lg)
       * ========================================================================= */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#0E382F] text-white px-4 py-3 flex items-center justify-between shadow-xs border-b border-white/10">
        {/* Left: Hamburger Button & Logo */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open mobile navigation menu"
            className="p-1.5 -ml-1.5 rounded-[4px] text-white/90 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus:outline-none"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={() => navigate('/patient')}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <div className="w-6 h-6 rounded-[3px] bg-[#10B981] flex items-center justify-center text-white font-bold text-sm shadow-xs">
              +
            </div>
            <span className="font-extrabold text-[15px] tracking-tight text-white font-sans">
              ReportSetu
            </span>
          </div>
        </div>

        {/* Right: Quick Upload & Profile Circle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/patient/upload')}
            className="h-7 px-2.5 bg-white/15 hover:bg-white/20 text-white text-[11px] font-semibold rounded-[4px] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Upload</span>
          </button>

          <button
            onClick={() => navigate('/patient/profile')}
            aria-label="View Profile"
            className="w-7 h-7 rounded-full bg-[#10B981] text-[#0E382F] font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer hover:opacity-90"
          >
            {patientInitial}
          </button>
        </div>
      </header>

      {/* =========================================================================
       * 2. MOBILE DRAWER (Off-canvas Slide-out Menu)
       * ========================================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop Blur Overlay */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            aria-hidden="true"
          />

          {/* Drawer Body */}
          <div className="relative w-72 max-w-[85vw] bg-[#0E382F] text-white flex flex-col justify-between p-4 shadow-2xl z-50 h-full overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="space-y-4">
              {/* Header: Logo & Close Button */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-[3px] bg-[#10B981] flex items-center justify-center text-white font-bold text-base shadow-xs">
                    +
                  </div>
                  <span className="font-extrabold text-base tracking-tight text-white font-sans">
                    ReportSetu
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 rounded-[4px] text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Patient Badge */}
              <div
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/patient/profile');
                }}
                className="bg-white/10 rounded-[6px] p-2.5 flex items-center gap-2.5 cursor-pointer hover:bg-white/15 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-[#10B981] text-[#0E382F] font-bold text-sm flex items-center justify-center shrink-0">
                  {patientInitial}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {cleanPatientName}
                  </p>
                  <p className="text-[10px] font-mono text-emerald-300 mt-0.5 truncate flex items-center gap-1">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>{patientRsId}</span>
                  </p>
                </div>
              </div>

              {/* Portal Section Label */}
              <p className="text-[9.5px] font-bold text-white/40 tracking-wider uppercase px-2 pt-1">
                PATIENT PORTAL
              </p>

              {/* Navigation Links */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = item.exact
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.name}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-[6px] text-xs transition-all ${
                        isActive
                          ? 'bg-white text-[#0E382F] shadow-xs font-bold'
                          : 'text-white/80 hover:text-white hover:bg-white/10 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#0E382F]' : 'text-white/70'}`} />
                        <span>{item.name}</span>
                      </div>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-1 pt-3 border-t border-white/10 mt-4">
              <NavLink
                to="/patient/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-xs transition-all ${
                    isActive
                      ? 'bg-white text-[#0E382F] shadow-xs font-bold'
                      : 'text-white/80 hover:text-white hover:bg-white/10 font-medium'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Settings className={`w-4 h-4 ${isActive ? 'text-[#0E382F]' : 'text-white/70'}`} />
                    <span>Settings</span>
                  </>
                )}
              </NavLink>

              <button
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await logout();
                  navigate('/login');
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-xs font-medium text-white/80 hover:text-rose-300 hover:bg-white/10 transition-all text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-white/70" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
       * 3. DESKTOP SIDEBAR (Visible only on lg and above)
       * ========================================================================= */}
      <aside className="hidden lg:flex w-56 bg-[#0E382F] text-white flex-col justify-between p-4 flex-shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-5">
          {/* Logo */}
          <div className="pt-1 flex items-center gap-2 px-1.5">
            <div className="w-7 h-7 rounded-[3px] bg-[#10B981] flex items-center justify-center text-white font-bold text-base shadow-xs">
              +
            </div>
            <span className="font-extrabold text-base tracking-tight text-white font-sans">
              ReportSetu
            </span>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1 pt-1">
            <p className="text-[9.5px] font-bold text-white/40 tracking-wider uppercase px-2.5 pb-1">
              PATIENT PORTAL
            </p>
            <nav className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    className={`flex items-center justify-between px-3 py-2 rounded-[3px] text-xs transition-all ${
                      isActive
                        ? 'bg-white text-[#0E382F] shadow-xs font-bold'
                        : 'text-white/75 hover:text-white hover:bg-white/10 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#0E382F]' : 'text-white/70'}`} />
                      <span>{item.name}</span>
                    </div>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="space-y-1 pt-3 border-t border-white/10">
          <NavLink
            to="/patient/settings"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-[3px] text-xs transition-all ${
                isActive
                  ? 'bg-white text-[#0E382F] shadow-xs font-bold'
                  : 'text-white/75 hover:text-white hover:bg-white/10 font-medium'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Settings className={`w-3.5 h-3.5 ${isActive ? 'text-[#0E382F]' : 'text-white/70'}`} />
                <span>Settings</span>
              </>
            )}
          </NavLink>

          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[3px] text-xs font-medium text-white/75 hover:text-red-300 hover:bg-white/10 transition-all text-left cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-white/70" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* =========================================================================
       * 4. MAIN CONTENT AREA (Responsive padding for mobile bottom bar)
       * ========================================================================= */}
      <main className="flex-1 overflow-y-auto min-h-screen pb-20 lg:pb-6">
        <Outlet />
      </main>

      {/* =========================================================================
       * 5. MOBILE BOTTOM NAVIGATION BAR (Visible only on < lg)
       * ========================================================================= */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200/90 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] px-1 py-1.5 flex items-center justify-around safe-bottom"
      >
        {bottomBarItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-[8px] transition-colors ${
                isActive
                  ? 'text-[#0E382F] font-bold'
                  : 'text-slate-400 hover:text-slate-700 font-medium'
              }`}
            >
              <div
                className={`p-1 rounded-[6px] transition-all ${
                  isActive ? 'bg-[#EAF6F0] text-[#0E382F]' : 'text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-[10px] mt-0.5 leading-tight ${isActive ? 'font-bold text-[#0E382F]' : ''}`}>
                {item.name}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
