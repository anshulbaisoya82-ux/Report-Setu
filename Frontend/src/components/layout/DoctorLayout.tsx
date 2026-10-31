import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Users,
  FileText,
  Calendar,
  MessageSquare,
  Clock,
  Settings,
  ShieldCheck,
  Bell,
  LogOut,
  User,
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { useStore } from '../../store/useStore';

export const DoctorLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { questionThreads, fetchQuestionThreads, logout } = useStore();

  React.useEffect(() => {
    void fetchQuestionThreads();
  }, [fetchQuestionThreads]);

  const totalUnreadQuestions = questionThreads.reduce((acc, t) => acc + t.unreadCount, 0);

  const navItems = [
    { name: 'Home', path: '/doctor', icon: Home, exact: true },
    { name: 'Patients', path: '/doctor/patients', icon: Users },
    { name: 'Reports', path: '/doctor/reports', icon: FileText },
    { name: 'Appointments', path: '/doctor/appointments', icon: Calendar },
    {
      name: 'Questions',
      path: '/doctor/questions',
      icon: MessageSquare,
      badge: totalUnreadQuestions,
    },
    { name: 'My Profile', path: '/doctor/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#ECF2ED] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1E3F35] text-white flex flex-col justify-between p-6 flex-shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-8">
          {/* Logo */}
          <div className="pt-2">
            <Logo size="md" />
          </div>

          {/* Navigation Links */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-white/50 tracking-wider uppercase px-3">
              MENU
            </p>
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path);
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white text-[#1E3F35] shadow-sm font-semibold'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#1E3F35]' : 'text-white/70'}`} />
                      <span>{item.name}</span>
                    </div>
                    {item.badge ? (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-[#D86E53] text-white'
                            : 'bg-[#D86E53] text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="space-y-4 pt-6">
          {/* Trust Badge */}
          <div className="bg-black/15 border border-white/10 rounded-2xl p-3.5 text-xs text-white/80">
            <div className="flex items-center gap-2 font-medium text-white mb-1">
              <ShieldCheck className="w-4 h-4 text-[#52B788]" />
              <span>Private by design</span>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Patient reports are visible only to you and your clinic.
            </p>
          </div>


          {/* Settings */}
          <NavLink
            to="/doctor/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white text-[#1E3F35] font-semibold'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`
            }
          >
            <Settings className="w-4 h-4 text-white/70" />
            <span>Settings</span>
          </NavLink>

          {/* Log Out */}
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/80 hover:text-red-300 hover:bg-white/10 transition-all text-left cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-white/70" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
