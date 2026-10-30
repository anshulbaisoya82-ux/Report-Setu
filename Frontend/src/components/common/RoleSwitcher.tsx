import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { Stethoscope, User, ArrowRightLeft, ShieldCheck } from 'lucide-react';

export const RoleSwitcher: React.FC = () => {
  const { currentRole, setRole } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSwitch = (newRole: 'doctor' | 'patient' | 'admin') => {
    setRole(newRole);
    if (newRole === 'doctor') {
      navigate('/doctor');
    } else if (newRole === 'patient') {
      navigate('/patient');
    } else {
      navigate('/admin');
    }
  };

  // Don't show on login/signup pages unless desired
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-[#1E3F35] text-white px-3 py-2 rounded-full shadow-2xl border border-teal-500/30 text-xs font-medium backdrop-blur-md">
      <span className="flex items-center gap-1.5 opacity-80">
        <ArrowRightLeft className="w-3.5 h-3.5 text-teal-400" />
        <span>Portal:</span>
      </span>

      <button
        onClick={() => handleSwitch('doctor')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all ${
          currentRole === 'doctor' && location.pathname.startsWith('/doctor')
            ? 'bg-white text-[#1E3F35] font-semibold shadow-sm'
            : 'text-white/80 hover:text-white hover:bg-white/10'
        }`}
      >
        <Stethoscope className="w-3 h-3" />
        <span>Doctor</span>
      </button>

      <button
        onClick={() => handleSwitch('patient')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all ${
          currentRole === 'patient' && location.pathname.startsWith('/patient')
            ? 'bg-teal-500 text-white font-semibold shadow-sm'
            : 'text-white/80 hover:text-white hover:bg-white/10'
        }`}
      >
        <User className="w-3 h-3" />
        <span>Patient</span>
      </button>

      <button
        onClick={() => handleSwitch('admin')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition-all ${
          currentRole === 'admin' || location.pathname.startsWith('/admin')
            ? 'bg-amber-400 text-stone-900 font-semibold shadow-sm'
            : 'text-amber-300 hover:text-white hover:bg-white/10'
        }`}
      >
        <ShieldCheck className="w-3 h-3 text-amber-400" />
        <span>Admin</span>
      </button>
    </div>
  );
};
