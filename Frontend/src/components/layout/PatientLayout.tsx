import React, { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  FileText,
  UploadCloud,
  Pill,
  Calendar,
  MessageSquare,
  Settings,
  LogOut,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export const PatientLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, fetchCurrentUserProfile } = useStore();

  useEffect(() => {
    void fetchCurrentUserProfile();
  }, [fetchCurrentUserProfile]);

  const navItems = [
    { name: 'Home', path: '/patient', icon: Home, exact: true },
    { name: 'Reports', path: '/patient/reports', icon: FileText },
    { name: 'Medicines', path: '/patient/medicines', icon: Pill },
    { name: 'Appointments', path: '/patient/appointments', icon: Calendar },
    { name: 'Ask Doctor', path: '/patient/ask-doctor', icon: MessageSquare },
    { name: 'Upload Report', path: '/patient/upload', icon: UploadCloud },
  ];

  return (
    <div className="min-h-screen bg-[#F6F9F7] flex text-slate-800">
      {/* Sidebar */}
      <aside className="w-56 bg-[#0E382F] text-white flex flex-col justify-between p-4 flex-shrink-0 min-h-screen sticky top-0 h-screen overflow-y-auto">
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
          {/* Settings */}
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

          {/* Log Out */}
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

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        <Outlet />
      </main>
    </div>
  );
};
