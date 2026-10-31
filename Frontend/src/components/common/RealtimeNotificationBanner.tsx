import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { initSocketClient } from '../../services/socketService';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, AlertTriangle, Info, X, Calendar } from 'lucide-react';

export const RealtimeNotificationBanner: React.FC = () => {
  const navigate = useNavigate();
  const { appointmentToast, clearAppointmentToast, currentRole, isAuthenticated } = useStore();

  useEffect(() => {
    // Connect Socket.IO client when user is authenticated
    const socket = initSocketClient();
    return () => {
      // Keep socket open or let service manage it
    };
  }, [isAuthenticated]);

  if (!appointmentToast) return null;

  const isDoctor = currentRole === 'doctor';
  const targetPath = isDoctor ? '/doctor/appointments' : '/patient/appointments';

  return (
    <div className="fixed top-5 right-5 z-[100] max-w-md w-full animate-in fade-in slide-in-from-top-4 duration-200">
      <div className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
        appointmentToast.type === 'success'
          ? 'bg-[#1E3F35] text-white border-[#2E9E6B]/50'
          : appointmentToast.type === 'warning'
          ? 'bg-amber-900 text-white border-amber-700/50'
          : 'bg-[#172B25] text-white border-stone-700/50'
      }`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          appointmentToast.type === 'success'
            ? 'bg-[#2E9E6B]/20 text-[#52B788]'
            : appointmentToast.type === 'warning'
            ? 'bg-amber-500/20 text-amber-300'
            : 'bg-teal-500/20 text-teal-300'
        }`}>
          {appointmentToast.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : appointmentToast.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <Calendar className="w-5 h-5" />
          )}
        </div>

        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#52B788]">
              REAL-TIME UPDATE
            </span>
          </div>
          <p className="text-xs font-semibold leading-snug mt-0.5 text-stone-100">
            {appointmentToast.message}
          </p>

          <button
            type="button"
            onClick={() => {
              clearAppointmentToast();
              navigate(targetPath);
            }}
            className="mt-2 text-[11px] font-bold text-accent-teal hover:underline flex items-center gap-1 cursor-pointer"
          >
            Open Appointments Schedule →
          </button>
        </div>

        <button
          type="button"
          onClick={clearAppointmentToast}
          className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
