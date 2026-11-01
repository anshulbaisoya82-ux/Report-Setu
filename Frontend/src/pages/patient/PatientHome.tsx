import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  Pill,
  Calendar,
  MessageSquare,
  Activity,
  UploadCloud,
  Bell,
  Clock,
  Check,
  Plus,
  Layers,
  BarChart2,
  FileText,
  Phone,
} from 'lucide-react';

export const PatientHome: React.FC = () => {
  const navigate = useNavigate();
  const {
    appointments,
    currentUser,
    reports,
    fetchReports,
    fetchAppointments,
    fetchPrescriptions,
    medicineSchedule,
    fetchMedicineSchedule,
    toggleMedicineSchedule,
  } = useStore();

  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    void fetchReports();
    void fetchAppointments();
    void fetchPrescriptions();
    void fetchMedicineSchedule();
  }, [fetchReports, fetchAppointments, fetchPrescriptions, fetchMedicineSchedule]);

  // Clean Patient Name: Strip out any "Dr." or "Dr " prefix if present on patient account
  const rawPatientName = currentUser?.name?.trim() || '';
  const strippedName = rawPatientName.replace(/^Dr\.?\s*/i, '').trim();
  const cleanPatientName = strippedName || (rawPatientName.toLowerCase().startsWith('dr') ? 'Patient' : rawPatientName) || 'Patient';
  const patientFirstName = cleanPatientName.split(' ')[0] || 'Patient';
  const patientInitial = (patientFirstName.charAt(0) || 'P').toUpperCase();

  // Real-time Medicine Schedule statistics from PostgreSQL database
  const totalMedsCount = (medicineSchedule || []).length;
  const takenCount = (medicineSchedule || []).filter((m) => m.state === 'taken').length;
  const progressPercentage = totalMedsCount > 0 ? (takenCount / totalMedsCount) * 100 : 0;

  // Upcoming appointment resolution from real database state
  const upcomingList = (appointments || []).filter(
    (a) => a.status === 'Confirmed' || a.status === 'Pending'
  );
  const upcomingAppointmentsCount = upcomingList.length;
  const nextApt = upcomingList[0] || null;

  const formatAptDate = (dateStr?: string) => {
    if (!dateStr) return { day: '—', month: '—' };
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const mIdx = parseInt(parts[1], 10) - 1;
      return {
        day: parts[2].padStart(2, '0'),
        month: monthNames[mIdx] || 'NOV',
      };
    }
    return { day: '—', month: '—' };
  };

  const { day: aptDay, month: aptMonth } = formatAptDate(nextApt?.date);
  const aptReason = nextApt?.reason || 'Clinical Consultation';
  const aptDoctor = nextApt?.doctorName
    ? `${nextApt.doctorName} • Consulting Physician`
    : 'Consulting Physician';
  const aptTime = nextApt?.time || '10:30 AM';
  const aptType = nextApt?.type || 'In-person';

  const renderMedicineIcon = (type: 'capsule-blue' | 'capsule-yellow' | 'tablet-white') => {
    if (type === 'capsule-blue') {
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" className="shrink-0 -rotate-45">
          <rect x="4" y="9" width="10" height="10" rx="5" fill="#3B82F6" />
          <rect x="14" y="9" width="10" height="10" rx="5" fill="#BFDBFE" />
        </svg>
      );
    }
    if (type === 'capsule-yellow') {
      return (
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" className="shrink-0 -rotate-45">
          <rect x="4" y="9" width="10" height="10" rx="5" fill="#F59E0B" />
          <rect x="14" y="9" width="10" height="10" rx="5" fill="#FDE68A" />
        </svg>
      );
    }
    return (
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none" className="shrink-0">
        <circle cx="14" cy="14" r="8.5" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
        <line x1="14" y1="6.5" x2="14" y2="21.5" stroke="#CBD5E1" strokeWidth="1.2" />
      </svg>
    );
  };

  return (
    <div className="w-full px-5 py-4 sm:px-6 sm:py-5 space-y-3.5 font-sans text-slate-800">
      {/* =========================================================================
       * 1. Top Header Area
       * ========================================================================= */}
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">Welcome back,</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {patientFirstName}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your medicines, appointments, and healthcare in one place.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Notification Button */}
          <div className="relative">
            <button
              onClick={() => setShowNotification(!showNotification)}
              aria-label="Notifications"
              className="w-9 h-9 rounded-[6px] bg-white border border-stone-200/90 shadow-2xs flex items-center justify-center text-slate-600 hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4 text-slate-600" />
              {upcomingAppointmentsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-2 ring-2 ring-white" />
              )}
            </button>

            {showNotification && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-[6px] shadow-lg border border-stone-200 p-3 z-50 text-xs animate-in fade-in duration-150">
                <p className="font-bold text-slate-900 mb-2">Notifications</p>
                <div className="space-y-1.5">
                  {totalMedsCount > 0 ? (
                    <div className="p-2 bg-[#F0FDF4] rounded-[4px] text-emerald-800">
                      <p className="font-semibold text-[11px]">Medication Schedule</p>
                      <p className="text-[10px] text-emerald-600 mt-0.5">{takenCount} of {totalMedsCount} doses taken today.</p>
                    </div>
                  ) : (
                    <div className="p-2 bg-stone-50 rounded-[4px] text-slate-700">
                      <p className="font-semibold text-[11px]">No Active Reminders</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Your prescription notifications will appear here.</p>
                    </div>
                  )}
                  {nextApt && (
                    <div className="p-2 bg-blue-50 rounded-[4px] text-blue-900">
                      <p className="font-semibold text-[11px]">Upcoming Visit</p>
                      <p className="text-[10px] text-blue-700 mt-0.5">{aptReason} on {nextApt.date} at {aptTime}.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Upload Report Button */}
          <button
            onClick={() => navigate('/patient/upload')}
            className="h-9 px-3.5 bg-[#0E382F] hover:bg-[#092720] text-white text-xs font-semibold rounded-[6px] flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Report</span>
          </button>

          {/* User Avatar Circle */}
          <button
            onClick={() => navigate('/patient/profile')}
            aria-label="Profile"
            className="w-9 h-9 rounded-full bg-[#0E382F] text-white font-bold text-xs flex items-center justify-center shadow-2xs hover:opacity-90 transition-opacity cursor-pointer"
          >
            {patientInitial}
          </button>
        </div>
      </div>

      {/* =========================================================================
       * 2. ROW 1: 4 Metric Cards (Left) + Quick Actions & Upcoming Features (Right)
       * ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* LEFT: 4 Metric Cards in 2x2 Grid */}
        <div className="lg:col-span-6 grid grid-cols-2 gap-3">
          {/* Card 1: Medicines Today */}
          <div
            onClick={() => navigate('/patient/medicines')}
            className="bg-white border border-stone-200/90 rounded-[6px] p-3.5 sm:p-4 shadow-2xs flex items-center gap-3.5 hover:border-emerald-300/80 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-[6px] bg-[#EAF6F0] text-[#16A36A] flex items-center justify-center shrink-0">
              <Pill className="w-5 h-5 -rotate-45" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">
                {totalMedsCount > 0 ? `${takenCount} / ${totalMedsCount}` : '0'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">Medicines Today</p>
            </div>
          </div>

          {/* Card 2: Upcoming Appointments */}
          <div
            onClick={() => navigate('/patient/appointments')}
            className="bg-white border border-stone-200/90 rounded-[6px] p-3.5 sm:p-4 shadow-2xs flex items-center gap-3.5 hover:border-blue-300/80 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-[6px] bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">
                {upcomingAppointmentsCount}
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-medium leading-tight">
                Upcoming<br />Appointments
              </p>
            </div>
          </div>

          {/* Card 3: Ask Doctor */}
          <div
            onClick={() => navigate('/patient/ask-doctor')}
            className="bg-white border border-stone-200/90 rounded-[6px] p-3.5 sm:p-4 shadow-2xs flex items-center gap-3.5 hover:border-purple-300/80 transition-all cursor-pointer"
          >
            <div className="w-10 h-10 rounded-[6px] bg-[#FAF5FF] text-[#7C3AED] flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[14px] font-extrabold text-slate-900 leading-tight">Ask Doctor</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Get medical guidance</p>
            </div>
          </div>

          {/* Card 4: Diagnostic Reports */}
          <div
            onClick={() => navigate('/patient/reports')}
            className="bg-white border border-stone-200/90 rounded-[6px] p-3.5 sm:p-4 shadow-2xs flex items-center gap-3.5 hover:border-emerald-500/50 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-[6px] bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5 text-[#0E382F]" />
            </div>
            <div>
              <h3 className="text-[14px] font-extrabold text-slate-900 leading-tight">
                {(reports || []).length} {(reports || []).length === 1 ? 'Report' : 'Reports'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Diagnostic Reports →</p>
            </div>
          </div>
        </div>

        {/* RIGHT: Quick Actions + Upcoming Features */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-3">
          {/* Quick Actions Card */}
          <div className="bg-white border border-stone-200/90 rounded-[6px] p-3 sm:p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[#16A36A] font-bold text-sm">⚡</span>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">Quick Actions</h3>
              </div>
              <span className="text-[11px] text-slate-400">Common tasks, one click away.</span>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
              {/* Action 1: Upload Report */}
              <button
                onClick={() => navigate('/patient/upload')}
                className="bg-[#EAF6F0] border border-[#C6EAD8] rounded-[6px] py-2 px-1 text-center flex flex-col items-center justify-center space-y-1 hover:bg-[#D5F0E2] transition-colors cursor-pointer"
              >
                <UploadCloud className="w-4 h-4 text-[#16A36A]" />
                <span className="text-[10.5px] sm:text-[11px] font-semibold text-slate-800 leading-tight text-center">
                  Upload<br />Report
                </span>
              </button>

              {/* Action 2: Book Appointment */}
              <button
                onClick={() => navigate('/patient/appointments')}
                className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-[6px] py-2 px-1 text-center flex flex-col items-center justify-center space-y-1 hover:bg-[#DBEAFE]/70 transition-colors cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-[#2563EB]" />
                <span className="text-[10.5px] sm:text-[11px] font-semibold text-slate-800 leading-tight text-center">
                  Book<br />Appointment
                </span>
              </button>

              {/* Action 3: Ask Doctor */}
              <button
                onClick={() => navigate('/patient/ask-doctor')}
                className="bg-[#FAF5FF] border border-[#F3E8FF] rounded-[6px] py-2 px-1 text-center flex flex-col items-center justify-center space-y-1 hover:bg-[#F3E8FF]/70 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-[#7C3AED]" />
                <span className="text-[10.5px] sm:text-[11px] font-semibold text-slate-800 leading-tight text-center">
                  Ask<br />Doctor
                </span>
              </button>

              {/* Action 4: Set Reminder */}
              <button
                onClick={() => navigate('/patient/medicines')}
                className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-[6px] py-2 px-1 text-center flex flex-col items-center justify-center space-y-1 hover:bg-[#FEF3C7]/70 transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4 text-[#D97706]" />
                <span className="text-[10.5px] sm:text-[11px] font-semibold text-slate-800 leading-tight text-center">
                  Set<br />Reminder
                </span>
              </button>
            </div>
          </div>

          {/* Upcoming Features Card */}
          <div className="bg-white border border-stone-200/90 rounded-[6px] p-3 sm:p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-900" />
                <h3 className="text-sm font-bold text-slate-900 leading-tight">Upcoming Features</h3>
              </div>
              <span className="text-[11px] text-slate-400">New features coming soon.</span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {/* Feature 1: Health Insights */}
              <div className="border border-stone-200/80 rounded-[6px] py-2 px-1.5 text-center flex flex-col items-center justify-between space-y-1.5 bg-white">
                <BarChart2 className="w-4 h-4 text-slate-700" />
                <span className="text-[11px] font-bold text-slate-800 leading-tight">Health Insights</span>
                <span className="text-[9.5px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-[4px]">
                  Coming Soon
                </span>
              </div>

              {/* Feature 2: AI Report Summary */}
              <div className="border border-stone-200/80 rounded-[6px] py-2 px-1.5 text-center flex flex-col items-center justify-between space-y-1.5 bg-white">
                <FileText className="w-4 h-4 text-slate-700" />
                <span className="text-[11px] font-bold text-slate-800 leading-tight">AI Report Summary</span>
                <span className="text-[9.5px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-[4px]">
                  Coming Soon
                </span>
              </div>

              {/* Feature 3: Emergency Contacts */}
              <div className="border border-stone-200/80 rounded-[6px] py-2 px-1.5 text-center flex flex-col items-center justify-between space-y-1.5 bg-white">
                <Phone className="w-4 h-4 text-slate-700" />
                <span className="text-[11px] font-bold text-slate-800 leading-tight">Emergency Contacts</span>
                <span className="text-[9.5px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-[4px]">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
       * 3. ROW 2: Today's Medications (Left ~60%) + Upcoming Appointment (Right ~40%)
       * ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* LEFT: Today's Medications */}
        <div className="lg:col-span-7 bg-white border border-stone-200/90 rounded-[6px] p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between space-y-3">
          <div>
            {/* Header with doses taken pill & progress bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-[#16A36A] -rotate-45" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Today's Medications</h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#16A36A]">
                  {takenCount} / {totalMedsCount} doses taken
                </span>
                <div className="w-16 sm:w-20 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#16A36A] rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* List of Medications */}
            {totalMedsCount === 0 ? (
              <div className="py-7 text-center space-y-2 bg-[#FAFBFB] rounded-lg border border-dashed border-stone-200 my-2">
                <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                  <Pill className="w-4 h-4 -rotate-45" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">No Medicines Scheduled Today</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mx-auto">
                    Your daily medicines will appear here once prescribed by your consulting doctor.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {medicineSchedule.slice(0, 4).map((med, idx) => {
                  const isTaken = med.state === 'taken';
                  const iconType = idx % 3 === 0 ? 'capsule-blue' : idx % 3 === 1 ? 'capsule-yellow' : 'tablet-white';

                  return (
                    <div
                      key={med.id || idx}
                      className="py-2.5 flex items-center justify-between gap-3 hover:bg-stone-50/60 rounded-[4px] px-1 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {renderMedicineIcon(iconType)}
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 leading-tight truncate">
                            {med.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {med.dose} · {med.instructions || med.timing}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{med.scheduledTime || '08:00 AM'}</span>
                        </div>

                        <button
                          onClick={() => void toggleMedicineSchedule(med.id, isTaken ? 'due' : 'taken')}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-xs font-semibold cursor-pointer transition-colors ${
                            isTaken
                              ? 'bg-[#EAF6F0] text-[#16A36A] hover:bg-emerald-100'
                              : 'bg-[#FEF3C7] text-[#D97706] hover:bg-amber-100'
                          }`}
                        >
                          {isTaken && <Check className="w-3 h-3 stroke-[3]" />}
                          <span>{isTaken ? 'Taken' : 'Pending'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* View Full Schedule Link */}
          <div className="pt-0.5">
            <Link
              to="/patient/medicines"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#16A36A] hover:underline"
            >
              <span>View Full Schedule</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* RIGHT: Upcoming Appointment */}
        <div className="lg:col-span-5 bg-white border border-stone-200/90 rounded-[6px] p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between space-y-3">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
              <Calendar className="w-4 h-4 text-[#16A36A]" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">Upcoming Appointment</h3>
            </div>

            {/* Appointment Box or Empty State */}
            {!nextApt ? (
              <div className="py-7 text-center space-y-2.5 bg-[#FAFBFB] rounded-lg border border-dashed border-stone-200">
                <div className="w-9 h-9 rounded-full bg-stone-100 text-slate-500 flex items-center justify-center mx-auto">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">No Upcoming Appointments</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">You have no pending or scheduled consultations.</p>
                </div>
              </div>
            ) : (
              <div className="border border-stone-200/80 rounded-[6px] p-3 flex items-center gap-3 bg-white shadow-2xs">
                {/* Date Badge */}
                <div className="w-12 h-12 rounded-[6px] bg-[#EAF6F0] flex flex-col items-center justify-center text-[#16A36A] shrink-0 font-sans">
                  <span className="text-lg font-extrabold leading-none">{aptDay}</span>
                  <span className="text-[9.5px] font-bold tracking-wider uppercase mt-0.5">{aptMonth}</span>
                </div>

                {/* Appointment Content */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 leading-tight truncate">
                    {aptReason}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {aptDoctor}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-600 mt-1 font-medium">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{aptTime}</span>
                    <span>•</span>
                    <span>{aptType}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Book New Appointment Button */}
          <button
            onClick={() => navigate('/patient/appointments')}
            className="w-full h-9 bg-[#0E382F] hover:bg-[#092720] text-white text-xs font-semibold rounded-[6px] flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Book New Appointment</span>
          </button>
        </div>
      </div>
      {/* =========================================================================
       * 4. ROW 3: Recent Diagnostic Reports
       * ========================================================================= */}
      <div className="bg-white border border-stone-200/90 rounded-[6px] p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0E382F]" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              Recent Lab Reports
            </h3>
          </div>
          <Link
            to="/patient/reports"
            className="text-xs font-bold text-[#16A36A] hover:underline flex items-center gap-1"
          >
            <span>View All Reports ({(reports || []).length})</span>
            <span>→</span>
          </Link>
        </div>

        {(reports || []).length === 0 ? (
          <div className="py-7 text-center space-y-2 bg-[#FAFBFB] rounded-lg border border-dashed border-stone-200">
            <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
              <FileText className="w-4 h-4 text-[#0E382F]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">No Diagnostic Reports Uploaded</p>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mx-auto">
                Upload your CBC, metabolic panel, or lab test to track biomarkers and receive clinical assessments.
              </p>
            </div>
            <Link
              to="/patient/upload"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0E382F] hover:bg-[#0c241e] text-white text-xs font-semibold rounded-[4px] shadow-2xs transition-colors mt-1"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload Report</span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {(reports || []).slice(0, 3).map((rep) => {
              const isCritical =
                rep.status === 'Critical' ||
                (rep.parameters && rep.parameters.some((p: any) => p.status === 'Critical'));
              return (
                <div
                  key={rep.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/60 rounded-[4px] px-1 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-[6px] bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-[#0E382F]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-900 leading-tight truncate">
                          {rep.name}
                        </h4>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px] bg-slate-100 text-slate-600">
                          {rep.category || 'Diagnostic'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {rep.labName || 'Diagnostic Lab'} · {rep.reportedDate || rep.collectionDate || 'Recent'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                    {isCritical ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-rose-50 text-rose-700 text-[10.5px] font-semibold border border-rose-200">
                        Critical Values
                      </span>
                    ) : rep.reviewed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-emerald-50 text-emerald-700 text-[10.5px] font-semibold border border-emerald-200">
                        <Check className="w-2.5 h-2.5 stroke-[3]" /> Reviewed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-amber-50 text-amber-700 text-[10.5px] font-semibold border border-amber-200">
                        <Clock className="w-2.5 h-2.5" /> Under Review
                      </span>
                    )}

                    <Link
                      to={`/patient/reports/${rep.id}`}
                      className="px-2.5 py-1 rounded-[3px] border border-stone-200 text-xs font-semibold text-slate-700 bg-white hover:bg-stone-50 shadow-2xs"
                    >
                      View Report →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
