import React from 'react';
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
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export const DoctorLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { questionThreads, fetchQuestionThreads, logout } = useStore();

  React.useEffect(() => {
    void fetchQuestionThreads();
  }, [fetchQuestionThreads]);

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
      badge: totalUnreadQuestions > 0 ? totalUnreadQuestions : 2,
    },
    { name: 'My Profile', path: '/doctor/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F5] flex">
      {/* Sidebar - Target Width: 240px */}
      <aside className="w-[240px] bg-[#13382E] text-white flex flex-col justify-between p-4 flex-shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto select-none">
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#F4F6F5]">
        <Outlet />
      </main>
    </div>
  );
};
