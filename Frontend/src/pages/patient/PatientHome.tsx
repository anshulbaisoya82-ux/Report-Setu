import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  Calendar,
  UploadCloud,
  Bell,
  Check,
  FileText,
  FlaskConical,
  Droplet,
  Activity,
  ChevronRight,
  ArrowRight,
  Pill,
} from 'lucide-react';
import { MedicineCapsule } from '../../components/medicines/MedicineCapsule';
import uploadIllustration from '../../assets/upload-report-illustration.png';
import appointmentIllustration from '../../assets/appointment-illustration.png';
import askDoctorIllustration from '../../assets/ask-doctor-illustration.png';

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
  const [isMarkingTaken, setIsMarkingTaken] = useState(false);

  useEffect(() => {
    void fetchReports();
    void fetchAppointments();
    void fetchPrescriptions();
    void fetchMedicineSchedule();
  }, [fetchReports, fetchAppointments, fetchPrescriptions, fetchMedicineSchedule]);

  // Clean Patient Name
  const rawPatientName = currentUser?.name?.trim() || '';
  const strippedName = rawPatientName.replace(/^Dr\.?\s*/i, '').trim();
  const cleanPatientName = strippedName || (rawPatientName.toLowerCase().startsWith('dr') ? 'Patient' : rawPatientName) || 'Patient';
  const patientFirstName = cleanPatientName.split(' ')[0] || 'Patient';
  const patientInitial = (patientFirstName.charAt(0) || 'P').toUpperCase();

  // 100% Real-time Medicine Schedule statistics from PostgreSQL database
  const totalMedsCount = (medicineSchedule || []).length;
  const takenCount = (medicineSchedule || []).filter((m) => m.state === 'taken').length;
  const remainingDoses = Math.max(0, totalMedsCount - takenCount);

  // Dynamic props purely from real-time database
  const totalDosesDisplay = totalMedsCount;
  const dosesTakenDisplay = takenCount;

  // Next pending medicine resolution from real-time state
  const pendingMedicines = (medicineSchedule || []).filter((m) => m.state !== 'taken');
  const nextMed = pendingMedicines[0] || null;
  const nextMedName = nextMed ? `${nextMed.name} ${nextMed.dose || ''}`.trim() : '';
  const nextMedTime = nextMed?.scheduledTime || '';
  const allDosesCompleted = totalMedsCount > 0 && pendingMedicines.length === 0;

  const handleMarkNextTaken = async () => {
    if (!nextMed) return;
    setIsMarkingTaken(true);
    try {
      await toggleMedicineSchedule(nextMed.id, 'taken');
    } finally {
      setIsMarkingTaken(false);
    }
  };

  // Upcoming appointment resolution from real database state
  const upcomingList = (appointments || []).filter(
    (a) => a.status === 'Confirmed' || a.status === 'Pending'
  );
  const upcomingAppointmentsCount = upcomingList.length;
  const nextApt = upcomingList[0] || null;
  const aptReason = nextApt?.reason || 'Clinical Consultation';
  const aptTime = nextApt?.time || '10:30 AM';

  // Format date helper for reports table (e.g., "02 Nov 2026")
  const formatReportDate = (d?: string) => {
    if (!d) return 'Recent';
    try {
      const dt = new Date(d);
      if (!isNaN(dt.getTime())) {
        return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    } catch {}
    return d;
  };

  // Category badge styling helper (CBC -> blue, LIPID -> purple, HBA1C -> teal, etc.)
  const getTypeBadgeStyle = (category?: string) => {
    const cat = (category || 'Diagnostic').toUpperCase();
    if (cat.includes('LIPID') || cat.includes('CHOLESTEROL')) {
      return 'bg-[#FAF5FF] text-[#9333EA]';
    }
    if (cat.includes('HBA1C') || cat.includes('SUGAR') || cat.includes('GLUCOSE')) {
      return 'bg-[#EFF6FF] text-[#0284C7]';
    }
    return 'bg-[#EFF6FF] text-[#2563EB]';
  };

  // Status badge helper (Normal, Attention Required, Critical)
  const renderStatusBadge = (status: string) => {
    if (status === 'Critical') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]">
          <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
          Critical
        </span>
      );
    }
    if (status === 'Attention Required' || status === 'Unbalanced') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
          <span className="w-2 h-2 rounded-full bg-[#D97706]" />
          Attention Required
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EAF6F0] text-[#16A36A] border border-[#C6EAD8]">
        <span className="w-2 h-2 rounded-full bg-[#16A36A]" />
        Normal
      </span>
    );
  };

  // Report icon helper matching visual category
  const renderReportIcon = (name: string, category?: string) => {
    const s = `${name} ${category || ''}`.toLowerCase();
    if (s.includes('cbc') || s.includes('blood count') || s.includes('hemogram')) {
      return <FlaskConical className="w-4 h-4 text-[#16A36A]" />;
    }
    if (s.includes('lipid') || s.includes('cholesterol') || s.includes('hba1c') || s.includes('sugar') || s.includes('glucose')) {
      return <Droplet className="w-4 h-4 text-[#16A36A]" />;
    }
    if (s.includes('liver') || s.includes('lft') || s.includes('hepatic')) {
      return <Activity className="w-4 h-4 text-[#16A36A]" />;
    }
    return <FileText className="w-4 h-4 text-[#16A36A]" />;
  };

  // 100% Real-time user reports from database
  const userReports = reports || [];
  const displayReports = userReports.map((r) => {
    const isCrit = r.status === 'Critical' || (r.parameters && r.parameters.some((p: any) => p.status === 'Critical'));
    const isAttn = r.status === 'Unbalanced' || (r.parameters && r.parameters.some((p: any) => p.status === 'Low' || p.status === 'High'));
    return {
      id: r.id,
      name: r.name,
      labName: r.labName || 'Diagnostic Laboratory',
      category: (r.category || 'Diagnostic').toUpperCase(),
      parametersCount: r.parameters && r.parameters.length > 0 ? r.parameters.length : 0,
      reportedDate: formatReportDate(r.reportedDate || r.collectionDate),
      status: isCrit ? 'Critical' : isAttn ? 'Attention Required' : 'Normal',
    };
  });

  const totalReportsCount = userReports.length;

  return (
    <div className="w-full px-5 py-4 sm:px-6 sm:py-5 space-y-4 font-sans text-slate-800">
      {/* =========================================================================
       * 1. Top Header Area (Preserved exact design, typography & actions)
       * ========================================================================= */}
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">Welcome back,</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            {cleanPatientName}
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Notification Button */}
          <div className="relative">
            <button
              onClick={() => setShowNotification(!showNotification)}
              aria-label="View notifications"
              className="w-9 h-9 rounded-full bg-white border border-stone-200/90 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:border-stone-300 transition-colors shadow-2xs cursor-pointer"
            >
              <Bell className="w-4 h-4" />
            </button>
            {showNotification && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-[6px] shadow-lg border border-stone-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-2">
                  <span className="font-bold text-xs text-slate-800">Notifications</span>
                  <span className="text-[10px] text-slate-400">All caught up</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {nextMed ? (
                    <div className="p-2 bg-[#EAF6F0] rounded-[4px] text-slate-700">
                      <p className="font-semibold text-[11px] text-[#136C4F]">Medication Reminder</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">Take {nextMedName} at {nextMedTime}.</p>
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
            className="h-9 px-3.5 bg-[#0E382F] hover:bg-[#092720] text-white text-xs font-semibold rounded-[8px] flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
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
       * 2. TOP GRID ROW: Exact Reference Design
       * [Today's medicines Card (4 cols)] [Summary Cards (2 cols)] [Upload Report (2 cols)] [Book Appointment (2 cols)] [Ask Doctor (2 cols)]
       * ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
        {/* CARD 1: Today's Medicines Tracker (lg:col-span-4) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-[#EAF4EF] border border-[#CFE5D8] rounded-[20px] p-4 sm:p-5 flex flex-col justify-between shadow-2xs">
          <div>
            {/* 1. Today's medicines heading */}
            <h3 className="text-base sm:text-[17px] font-bold text-slate-900 tracking-tight leading-tight">
              Today's medicines
            </h3>

            {/* 2. Subtitle: Real-time dynamic count */}
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {totalMedsCount === 0
                ? 'No doses scheduled for today'
                : `${takenCount} of ${totalMedsCount} doses taken today`}
            </p>

            {/* 3. Large two-tone capsule visualization */}
            <div className="my-3 sm:my-3.5">
              <MedicineCapsule
                dosesTaken={dosesTakenDisplay}
                totalDoses={totalDosesDisplay}
                remainingDoses={remainingDoses}
              />
            </div>

            {/* 4. Legend: Taken / Planned today */}
            <div className="flex items-center justify-center gap-5 text-xs font-semibold text-slate-600 mb-3 sm:mb-3.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#CE7058]" />
                Taken ({takenCount})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F8F7F0] border border-stone-300" />
                Planned ({totalMedsCount})
              </span>
            </div>
          </div>

          {/* 5. Dark-green Next Medicine panel */}
          <div className="bg-[#0E382F] rounded-[14px] p-3 sm:p-3.5 flex items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-emerald-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
                  <line x1="9.5" y1="9.5" x2="14.5" y2="14.5" />
                </svg>
              </div>
              <div className="min-w-0">
                {totalMedsCount === 0 ? (
                  <>
                    <p className="text-[11px] text-white/70 font-medium leading-tight">No medicines</p>
                    <p className="text-[13px] font-bold text-white leading-tight mt-0.5">0 Active Prescriptions</p>
                    <p className="text-[11px] text-emerald-200/90 truncate leading-tight mt-0.5">Add medicines to track doses</p>
                  </>
                ) : allDosesCompleted ? (
                  <>
                    <p className="text-[11px] text-emerald-300 font-bold leading-tight">Completed</p>
                    <p className="text-[13px] font-extrabold text-white leading-tight mt-0.5">All Doses Taken</p>
                    <p className="text-[11px] text-emerald-100/90 truncate leading-tight mt-0.5">100% adherence today</p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-white/70 font-medium leading-tight">Next medicine at</p>
                    <p className="text-[13px] sm:text-[14px] font-extrabold text-white leading-tight mt-0.5">{nextMedTime}</p>
                    <p className="text-[11px] sm:text-xs font-semibold text-emerald-100/90 truncate leading-tight mt-0.5">{nextMedName}</p>
                  </>
                )}
              </div>
            </div>

            {/* Action button */}
            {totalMedsCount === 0 ? (
              <button
                type="button"
                onClick={() => navigate('/patient/medicines')}
                className="bg-white hover:bg-stone-100 text-[#0E382F] font-bold text-xs px-3.5 py-2 rounded-[8px] shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <span>+ Add</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isMarkingTaken || allDosesCompleted || !nextMed}
                onClick={handleMarkNextTaken}
                className="bg-white hover:bg-stone-100 text-[#0E382F] font-bold text-xs px-3.5 py-2 rounded-[8px] shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5 text-[#0E382F] stroke-[3]" />
                <span>{allDosesCompleted ? 'Done' : isMarkingTaken ? 'Saving…' : 'Mark taken'}</span>
              </button>
            )}
          </div>
        </div>

        {/* CARD 2: Summary Cards (Side-by-side on mobile, stacked on lg) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 grid grid-cols-2 lg:flex lg:flex-col justify-between gap-2.5 sm:gap-3.5 h-full">
          {/* Top: Upcoming Appointments */}
          <div
            onClick={() => navigate('/patient/appointments')}
            className="flex-1 bg-white border border-stone-200/80 rounded-[18px] p-4 sm:p-4.5 flex items-center gap-3.5 shadow-2xs hover:border-blue-300 transition-all cursor-pointer group"
          >
            <div className="w-13 h-13 rounded-2xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6 text-[#2563EB]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="12" y1="14" x2="12" y2="18" />
                <line x1="10" y1="16" x2="14" y2="16" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
                {upcomingAppointmentsCount}
              </h3>
              <p className="text-xs text-slate-700 font-bold mt-1 leading-snug">
                Upcoming<br />Appointments
              </p>
              <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
                {upcomingAppointmentsCount === 0 ? 'No pending visits' : `${upcomingAppointmentsCount} scheduled`}
              </p>
            </div>
          </div>

          {/* Bottom: Diagnostic Reports (Real-time count from database) */}
          <div
            onClick={() => navigate('/patient/reports')}
            className="flex-1 bg-white border border-stone-200/80 rounded-[18px] p-4 sm:p-4.5 flex items-center gap-3.5 shadow-2xs hover:border-emerald-300 transition-all cursor-pointer group"
          >
            <div className="w-13 h-13 rounded-2xl bg-[#EAF6F0] text-[#16A36A] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6 text-[#16A36A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="17" x2="9" y2="14" />
                <line x1="12" y1="17" x2="12" y2="12" />
                <line x1="15" y1="17" x2="15" y2="15" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
                {totalReportsCount}
              </h3>
              <p className="text-xs text-slate-700 font-bold mt-1 leading-snug">
                Diagnostic reports
              </p>
              <span className="text-xs font-bold text-[#16A36A] hover:underline mt-0.5 inline-flex items-center gap-1">
                View all →
              </span>
            </div>
          </div>
        </div>

        {/* CARDS 3, 4, 5: Action Cards (Neat 3-column subgrid on all viewports) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-6 grid grid-cols-3 gap-2.5 sm:gap-3.5 items-stretch">
          {/* Action Card 1: Upload Report */}
          <div
            onClick={() => navigate('/patient/upload')}
            className="bg-[#EDF8F2] border border-[#C8EAD6] rounded-[16px] sm:rounded-[20px] p-2.5 sm:p-4 md:p-5 flex flex-col items-center justify-between text-center cursor-pointer hover:border-[#16A36A]/60 shadow-2xs transition-all group h-full relative overflow-hidden"
          >
            <div className="absolute -bottom-8 -right-8 w-20 h-20 bg-[#D7F1E2]/60 rounded-full blur-xl pointer-events-none" />

            <div className="pt-0.5 sm:pt-1 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <img
                src={uploadIllustration}
                alt="Upload Report"
                className="h-16 sm:h-22 md:h-28 w-auto object-contain drop-shadow-xs select-none pointer-events-none"
              />
            </div>

            <div className="my-auto py-1 sm:py-2">
              <h4 className="text-xs sm:text-[15px] md:text-[17px] font-black text-slate-900 leading-tight">
                Upload<br />Report
              </h4>
              <p className="text-[9.5px] sm:text-[11px] text-[#16A36A] font-semibold mt-0.5 sm:mt-1 truncate max-w-[85px] sm:max-w-none">
                PDF, Scan
              </p>
            </div>

            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white text-[#16A36A] border border-[#C8EAD6] shadow-2xs flex items-center justify-center group-hover:bg-[#16A36A] group-hover:text-white transition-all">
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </div>
          </div>

          {/* Action Card 2: Book Appointment */}
          <div
            onClick={() => navigate('/patient/appointments')}
            className="bg-[#EFF6FF] border border-[#D2E4FE] rounded-[16px] sm:rounded-[20px] p-2.5 sm:p-4 md:p-5 flex flex-col items-center justify-between text-center cursor-pointer hover:border-[#2563EB]/60 shadow-2xs transition-all group h-full relative overflow-hidden"
          >
            <div className="absolute -bottom-8 -right-8 w-20 h-20 bg-[#DBEAFE]/60 rounded-full blur-xl pointer-events-none" />

            <div className="pt-0.5 sm:pt-1 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <img
                src={appointmentIllustration}
                alt="Book Appointment"
                className="h-16 sm:h-22 md:h-28 w-auto object-contain drop-shadow-xs select-none pointer-events-none"
              />
            </div>

            <div className="my-auto py-1 sm:py-2">
              <h4 className="text-xs sm:text-[15px] md:text-[17px] font-black text-slate-900 leading-tight">
                Book<br />Appt
              </h4>
              <p className="text-[9.5px] sm:text-[11px] text-[#2563EB] font-semibold mt-0.5 sm:mt-1 truncate max-w-[85px] sm:max-w-none">
                In-Clinic & Video
              </p>
            </div>

            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white text-[#2563EB] border border-[#DBEAFE] shadow-2xs flex items-center justify-center group-hover:bg-[#2563EB] group-hover:text-white transition-all">
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </div>
          </div>

          {/* Action Card 3: Ask Doctor */}
          <div
            onClick={() => navigate('/patient/ask-doctor')}
            className="bg-[#FAF5FF] border border-[#ECD8FC] rounded-[16px] sm:rounded-[20px] p-2.5 sm:p-4 md:p-5 flex flex-col items-center justify-between text-center cursor-pointer hover:border-[#9333EA]/60 shadow-2xs transition-all group h-full relative overflow-hidden"
          >
            <div className="absolute -bottom-8 -right-8 w-20 h-20 bg-[#F3E8FF]/60 rounded-full blur-xl pointer-events-none" />

            <div className="pt-0.5 sm:pt-1 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
              <img
                src={askDoctorIllustration}
                alt="Ask Doctor"
                className="h-16 sm:h-22 md:h-28 w-auto object-contain drop-shadow-xs select-none pointer-events-none"
              />
            </div>

            <div className="my-auto py-1 sm:py-2">
              <h4 className="text-xs sm:text-[15px] md:text-[17px] font-black text-slate-900 leading-tight">
                Ask<br />Doctor
              </h4>
              <p className="text-[9.5px] sm:text-[11px] text-[#9333EA] font-semibold mt-0.5 sm:mt-1 truncate max-w-[85px] sm:max-w-none">
                Guidance
              </p>
            </div>

            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white text-[#9333EA] border border-[#ECD8FC] shadow-2xs flex items-center justify-center group-hover:bg-[#9333EA] group-hover:text-white transition-all">
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
       * 3. BOTTOM SECTION: Real-time Reports Table (100% Real Database Reports)
       * ========================================================================= */}
      <div className="bg-white border border-stone-200/80 rounded-[20px] shadow-2xs overflow-hidden">
        {/* Reports Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-[#16A36A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
              Reports
            </h3>
            <span className="text-xs font-semibold text-slate-500 bg-stone-100 px-2 py-0.5 rounded-full">
              {displayReports.length}
            </span>
          </div>
          <Link
            to="/patient/reports"
            className="text-xs sm:text-sm font-bold text-[#16A36A] hover:underline inline-flex items-center gap-1"
          >
            <span>View All</span>
            <span>→</span>
          </Link>
        </div>

        {/* Reports Content or Real-Time Empty State */}
        {displayReports.length === 0 ? (
          <div className="p-6 sm:p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#EAF6F0] text-[#16A36A] flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">No diagnostic reports uploaded yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Upload your medical lab test reports (PDF, images) to view parameters, trend analytics, and clinical evaluations.
              </p>
            </div>
            <button
              onClick={() => navigate('/patient/upload')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0E382F] hover:bg-[#134e40] text-white text-xs font-bold rounded-[6px] shadow-xs transition-colors cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload First Report</span>
            </button>
          </div>
        ) : (
          <>
            {/* Mobile View: Touch-Friendly Card List (< sm) */}
            <div className="block sm:hidden divide-y divide-stone-100">
              {displayReports.map((rep) => (
                <div
                  key={rep.id}
                  onClick={() => navigate(`/patient/reports/${rep.id}`)}
                  className="p-3.5 hover:bg-stone-50/70 transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-[8px] bg-[#EAF6F0] flex items-center justify-center shrink-0 mt-0.5">
                      {renderReportIcon(rep.name, rep.category)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 leading-snug truncate">
                        {rep.name}
                      </h4>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5 truncate">
                        {rep.labName}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`inline-block px-2 py-0.2 rounded-[4px] text-[10px] font-bold ${getTypeBadgeStyle(rep.category)}`}>
                          {rep.category}
                        </span>
                        <span className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{rep.reportedDate}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {renderStatusBadge(rep.status)}
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Full Table (>= sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAF9] border-b border-stone-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-5">Report Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Analyzed Parameters</th>
                  <th className="py-3 px-4">Reported On</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs">
                {displayReports.map((rep) => {
                  return (
                    <tr
                      key={rep.id}
                      onClick={() => navigate(`/patient/reports/${rep.id}`)}
                      className="hover:bg-stone-50/70 transition-colors cursor-pointer group"
                    >
                      {/* Column 1: Report Name with Icon */}
                      <td className="py-3.5 px-4 sm:px-5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-[8px] bg-[#EAF6F0] flex items-center justify-center shrink-0">
                            {renderReportIcon(rep.name, rep.category)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight truncate group-hover:text-[#16A36A] transition-colors">
                              {rep.name}
                            </h4>
                            <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                              {rep.labName}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-[4px] text-[10.5px] font-bold ${getTypeBadgeStyle(rep.category)}`}>
                          {rep.category}
                        </span>
                      </td>

                      {/* Column 3: Analyzed Parameters */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {rep.parametersCount} {rep.parametersCount === 1 ? 'parameter' : 'parameters'} analyzed
                      </td>

                      {/* Column 4: Reported On */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{rep.reportedDate}</span>
                        </div>
                      </td>

                      {/* Column 5: Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(rep.status)}
                      </td>

                      {/* Column 6: Action Arrow */}
                      <td className="py-3.5 px-3 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors inline-block" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>
    </div>
  );
};
