import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Users,
  FileText,
  Calendar,
  MessageSquare,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export const DoctorLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { questionThreads, fetchQuestionThreads, logout, currentUser, doctorInfo } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    void fetchQuestionThreads();
  }, [fetchQuestionThreads]);

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

  const totalUnreadQuestions = questionThreads.reduce((acc, t) => acc + t.unreadCount, 0);

  const mainNavItems = [
    { name: 'Home', path: '/doctor', icon: Home, exact: true },
    { name: 'Patients', path: '/doctor/patients', icon: Users },
    { name: 'Reports', path: '/doctor/reports', icon: FileText },
    { name: 'Appointments', path: '/doctor/appointments', icon: Calendar },
    {
      name: 'Questions',
      path: '/doctor/questions',
      icon: MessageSquare,
      badge: totalUnreadQuestions > 0 ? totalUnreadQuestions : undefined,
    },
    { name: 'My Profile', path: '/doctor/profile', icon: User },
  ];

  // Quick bottom bar items for mobile devices
  const bottomBarItems = [
    { name: 'Home', path: '/doctor', icon: Home, exact: true },
    { name: 'Patients', path: '/doctor/patients', icon: Users },
    { name: 'Reports', path: '/doctor/reports', icon: FileText },
    { name: 'Appointments', path: '/doctor/appointments', icon: Calendar },
    {
      name: 'Questions',
      path: '/doctor/questions',
      icon: MessageSquare,
      badge: totalUnreadQuestions > 0 ? totalUnreadQuestions : undefined,
    },
  ];

  const rawDoctorName = currentUser?.name || doctorInfo?.name || 'Dr. Rishabh';
  const cleanDoctorName = rawDoctorName.startsWith('Dr.') ? rawDoctorName : `Dr. ${rawDoctorName}`;
  const specialty = doctorInfo?.specialty || 'General Medicine';
  
  // Calculate initials (e.g., "Dr. Rishabh Sharma" -> "RS", "Dr. Vikram Malhotra" -> "VM")
  const nameParts = rawDoctorName.replace(/^(Dr\.|Doctor|Prof\.)\s*/i, '').trim().split(/\s+/);
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : nameParts[0]?.slice(0, 2).toUpperCase() || 'DR';

  return (
    <div className="min-h-screen bg-[#F4F6F5] flex flex-col lg:flex-row text-stone-800">
      {/* =========================================================================
       * 1. MOBILE TOP NAVBAR (Visible only on < lg)
       * ========================================================================= */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#13382E] text-white px-4 py-3 flex items-center justify-between shadow-xs border-b border-white/10">
        {/* Left: Hamburger Button & Logo */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            className="p-1.5 -ml-1.5 rounded-[4px] text-white/90 hover:text-white hover:bg-white/10 transition-colors cursor-pointer focus:outline-none"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={() => navigate('/doctor')}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <div className="w-6 h-6 rounded-[4px] bg-[#58AC8A] flex items-center justify-center text-white shadow-xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5">
                <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
                <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <span className="font-extrabold text-[15px] tracking-tight text-white font-sans leading-tight block">
                ReportSetu
              </span>
              <span className="text-[9px] text-[#58AC8A] font-semibold uppercase tracking-wider leading-none block">
                Clinician Portal
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Add Patient & Doctor Avatar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/doctor/add-patient')}
            className="h-7 px-2.5 bg-white/15 hover:bg-white/20 text-white text-[11px] font-semibold rounded-[4px] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Add Patient</span>
          </button>

          <button
            onClick={() => navigate('/doctor/profile')}
            aria-label="Doctor Profile"
            className="w-7 h-7 rounded-full bg-[#184E3F] border border-[#58AC8A]/50 text-white font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer hover:opacity-90"
          >
            {initials}
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
          <div className="relative w-72 max-w-[85vw] bg-[#13382E] text-white flex flex-col justify-between p-4 shadow-2xl z-50 h-full overflow-y-auto animate-in slide-in-from-left duration-200">
            <div className="space-y-4">
              {/* Header: Logo & Close Button */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-[4px] bg-[#58AC8A] flex items-center justify-center text-white shadow-xs">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4">
                      <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
                      <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-extrabold text-base tracking-tight text-white font-sans leading-tight block">
                      ReportSetu
                    </span>
                    <span className="text-[9.5px] text-[#58AC8A] font-semibold uppercase tracking-wider leading-none block">
                      Clinician Portal
                    </span>
                  </div>
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

              {/* Doctor Profile Badge */}
              <div
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/doctor/profile');
                }}
                className="bg-white/10 rounded-[6px] p-2.5 flex items-center gap-2.5 cursor-pointer hover:bg-white/15 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-[#184E3F] border border-[#58AC8A]/50 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {cleanDoctorName}
                  </p>
                  <p className="text-[10px] text-[#58AC8A] mt-0.5 truncate flex items-center gap-1 font-medium">
                    <Stethoscope className="w-2.5 h-2.5 shrink-0" />
                    <span>{specialty}</span>
                  </p>
                </div>
              </div>

              {/* MAIN Section Label */}
              <p className="text-[9.5px] font-bold text-white/40 tracking-wider uppercase px-2 pt-1">
                MAIN
              </p>

              {/* Navigation Links */}
              <nav className="space-y-1">
                {mainNavItems.map((item) => {
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
                          ? 'bg-[#235043] text-white font-semibold shadow-xs'
                          : 'text-white/80 hover:text-white hover:bg-white/10 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-white/80 shrink-0" />
                        <span>{item.name}</span>
                      </div>
                      {item.badge ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E5484D] text-white leading-none">
                          {item.badge}
                        </span>
                      ) : null}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* CLINIC Section Label & Bottom Actions */}
            <div className="space-y-1 pt-3 border-t border-white/10 mt-4">
              <p className="text-[9.5px] font-bold text-white/40 tracking-wider uppercase px-2 pb-1">
                CLINIC
              </p>
              <NavLink
                to="/doctor/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-xs transition-all ${
                    isActive
                      ? 'bg-[#235043] text-white font-semibold shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10 font-medium'
                  }`
                }
              >
                <Settings className="w-4 h-4 text-white/80 shrink-0" />
                <span>Settings</span>
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
      <aside className="hidden lg:flex w-[240px] bg-[#13382E] text-white flex-col justify-between p-4 flex-shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto select-none">
        <div className="space-y-5">
          {/* Logo */}
          <div className="flex items-center gap-2.5 pt-1 px-1">
            <div className="w-8 h-8 rounded-[8px] bg-[#58AC8A] flex items-center justify-center text-white shadow-2xs shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4">
                <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
                <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <span className="text-[15px] font-bold text-white tracking-tight leading-tight block">
                ReportSetu
              </span>
              <p className="text-[10px] text-white/60 leading-none mt-0.5 font-normal">
                Unified Care, Better Decisions.
              </p>
            </div>
          </div>

          {/* MAIN Section */}
          <div className="space-y-1 pt-1">
            <p className="text-[10px] font-bold text-white/40 tracking-wider uppercase px-2.5 mb-1.5">
              MAIN
            </p>
            <nav className="space-y-0.5">
              {mainNavItems.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-[8px] text-[12px] font-medium transition-all ${
                      isActive
                        ? 'bg-[#235043] text-white font-semibold shadow-2xs'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-white/80 shrink-0" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E5484D] text-white leading-none">
                        {item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* CLINIC Section */}
          <div className="space-y-1 pt-1">
            <p className="text-[10px] font-bold text-white/40 tracking-wider uppercase px-2.5 mb-1.5">
              CLINIC
            </p>
            <nav className="space-y-0.5">
              <NavLink
                to="/doctor/settings"
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-[12px] font-medium transition-all ${
                    isActive
                      ? 'bg-[#235043] text-white font-semibold'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <Settings className="w-4 h-4 text-white/80 shrink-0" />
                <span>Settings</span>
              </NavLink>

              <button
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-[12px] font-medium text-white/80 hover:text-red-300 hover:bg-white/10 transition-all text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-white/80 shrink-0" />
                <span>Log out</span>
              </button>
            </nav>
          </div>
        </div>
      </aside>

      {/* =========================================================================
       * 4. MAIN CONTENT AREA (Responsive bottom padding on mobile)
       * ========================================================================= */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#F4F6F5] min-h-screen pb-20 lg:pb-0">
        <Outlet />
      </main>

      {/* =========================================================================
       * 5. MOBILE BOTTOM NAVIGATION BAR (Visible only on < lg)
       * ========================================================================= */}
      <nav
        aria-label="Doctor Mobile Navigation"
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
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-[8px] transition-colors relative ${
                isActive
                  ? 'text-[#13382E] font-bold'
                  : 'text-stone-400 hover:text-stone-700 font-medium'
              }`}
            >
              <div
                className={`p-1 rounded-[6px] transition-all relative ${
                  isActive ? 'bg-[#EAF6F0] text-[#13382E]' : 'text-stone-500'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.badge ? (
                  <span className="w-2 h-2 rounded-full bg-[#E5484D] absolute -top-0.5 -right-0.5 ring-2 ring-white" />
                ) : null}
              </div>
              <span className={`text-[10px] mt-0.5 leading-tight ${isActive ? 'font-bold text-[#13382E]' : ''}`}>
                {item.name}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
