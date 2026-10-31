import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  FileText,
  UploadCloud,
  Pill,
  Calendar,
  MessageSquare,
  Settings,
  ShieldCheck,
  LogOut,
  UserCheck,
  User,
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { connectionsApi } from '../../api';
import { useStore } from '../../store/useStore';

export const PatientLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useStore();
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    connectionsApi
      .getPendingRequests()
      .then((res) => {
        setPendingCount(res?.requests?.length || 0);
      })
      .catch(() => {});
  }, [location.pathname]);

  const navItems = [
    { name: 'Home', path: '/patient', icon: Home, exact: true },
    { name: 'My Reports', path: '/patient/reports', icon: FileText },
    { name: 'Upload Report', path: '/patient/upload', icon: UploadCloud },
    { name: 'Medicines', path: '/patient/medicines', icon: Pill },
    { name: 'Appointments', path: '/patient/appointments', icon: Calendar },
    { name: 'Ask Doctor', path: '/patient/ask-doctor', icon: MessageSquare },
    {
      name: 'My Doctors',
      path: '/patient/doctors',
      icon: UserCheck,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    { name: 'My Profile', path: '/patient/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#F6F9F7] flex text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0E382F] text-white flex flex-col justify-between p-5 flex-shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-6">
          {/* Logo */}
          <div className="pt-2 flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-[6px] bg-[#10B981] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              +
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white font-sans">
              ReportSetu
            </span>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-bold text-white/40 tracking-wider uppercase px-3 pb-1">
              PATIENT PORTAL
            </p>
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
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all ${
                      isActive
                        ? 'bg-white text-[#0E382F] shadow-sm font-bold'
                        : 'text-white/75 hover:text-white hover:bg-white/10 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#0E382F]' : 'text-white/70'}`} />
                      <span>{item.name}</span>
                    </div>
                    {item.badge ? (
                      <span className="w-5 h-5 rounded-full bg-[#B53629] text-white text-[10px] font-bold flex items-center justify-center">
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
        <div className="space-y-3 pt-4">
          {/* Trust Badge */}
          <div className="bg-[#092720]/70 border border-white/10 rounded-2xl p-3.5 text-xs text-white/90">
            <div className="flex items-center gap-2 font-bold text-white mb-1">
              <ShieldCheck className="w-4 h-4 text-[#10B981]" />
              <span>Your data is private</span>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Encrypted, secure and shared only with your doctors.
            </p>
          </div>

          {/* Settings */}
          <NavLink
            to="/patient/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white text-[#0E382F] font-bold'
                  : 'text-white/75 hover:text-white hover:bg-white/10'
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
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-white/70 hover:text-red-300 hover:bg-white/10 transition-all text-left cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-white/60" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 min-h-screen">
        {location.pathname.startsWith('/patient/ask-doctor') ? (
          <div className="w-full h-screen overflow-hidden">
            <Outlet />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
};
