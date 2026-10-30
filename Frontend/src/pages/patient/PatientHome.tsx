import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { 
  FileText, Pill, Calendar, ArrowUpRight, Check, X, 
  ChevronRight, Activity, Bell, Plus, Info, Clock
} from 'lucide-react';
import { MedicalTrendChart } from '../../components/charts';

export const PatientHome: React.FC = () => {
  const navigate = useNavigate();
  const { reports, appointments, medicineSchedule, toggleMedicineSchedule, currentUser, fetchReports, fetchMedicineSchedule, fetchAppointments } = useStore();
  const [dismissBanner, setDismissBanner] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  React.useEffect(() => {
    fetchReports();
    fetchMedicineSchedule();
    fetchAppointments();
    import('../../api').then(({ connectionsApi }) => {
      connectionsApi.getPendingRequests().then((res) => {
        setPendingRequests(res?.requests || []);
      }).catch(() => {});
    });
  }, []);

  const latestReviewedReport = reports.find(r => r.reviewed) || reports[0];
  const nightMed = medicineSchedule[1] || medicineSchedule[0];
  const isNightTaken = nightMed?.state === 'taken';
  const dueMedicines = medicineSchedule.filter((m) => m.state !== 'taken');
  const nextDueMed = dueMedicines[0] || null;
  const nextAppointment = appointments.find((appointment) =>
    appointment.status === 'Confirmed' || appointment.status === 'Pending'
  );
  const takenMedicines = medicineSchedule.filter((medicine) => medicine.state === 'taken').length;
  const medicineCount = medicineSchedule.length;
  const reportLabs = new Set(reports.map((report) => report.labName)).size;

  const handleToggleNight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nightMed) {
      toggleMedicineSchedule(nightMed.id, isNightTaken ? 'due' : 'taken');
    }
  };

  const patientName = currentUser?.name || 'there';
  const patientFirstName = patientName.split(' ')[0];
  const patientAvatar = currentUser?.avatar || patientName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const patientRsId = currentUser?.rsId;

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* 1. TOP HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#172B25] font-serif tracking-tight">
            Welcome back, {patientFirstName}
          </h1>
          <p className="text-xs sm:text-sm text-[#5F736C] mt-0.5 font-sans">
            Here's what's new with your health records
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Bell Icon button */}
          <button 
            onClick={() => alert("No unread alerts")}
            className="w-10 h-10 rounded-full bg-white border border-stone-200 shadow-2xs flex items-center justify-center text-[#172B25] hover:bg-stone-50 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* + Upload report CTA */}
          <Link
            to="/patient/upload"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#32A299] hover:bg-[#288E86] text-white font-semibold text-xs rounded-xl shadow-xs transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Upload report
          </Link>

          {/* User profile chip */}
          <div className="flex items-center gap-2.5 bg-white border border-stone-200/80 rounded-2xl py-1 px-3 shadow-2xs">
            <div className="w-8 h-8 rounded-full bg-[#1E3F35] text-white font-bold text-xs flex items-center justify-center">
              {patientAvatar}
            </div>
            <div className="text-left text-xs">
              <span className="font-bold text-[#172B25] block leading-tight">{patientName}</span>
              <span className="text-[10px] text-[#5F736C] font-mono">RS ID · {patientRsId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 1.5. DOCTOR CONNECTION REQUEST ALERT BANNER */}
      {pendingRequests.length > 0 && (
        <div className="bg-[#1E3F35] text-white rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md border border-[#2E9E6B]/30 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#2E9E6B]/20 text-[#52B788] flex items-center justify-center shrink-0 border border-[#2E9E6B]/40">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#52B788]">
                  DOCTOR ACCESS REQUEST
                </span>
              </div>
              <p className="text-xs font-semibold text-white mt-0.5">
                {pendingRequests[0].doctorName} ({pendingRequests[0].specialty}) requested access to your reports
              </p>
            </div>
          </div>

          <Link
            to="/patient/doctors"
            className="px-4 py-2 text-xs font-bold text-[#1E3F35] bg-[#52B788] hover:bg-[#40966F] rounded-xl transition-all shadow-xs shrink-0"
          >
            Review & Get Code →
          </Link>
        </div>
      )}

      {/* 1.6. ACTIVE MEDICINE REMINDER BANNER */}
      {nextDueMed && (
        <div className="bg-gradient-to-r from-[#EBF4F0] to-[#E0F7F5] text-[#172B25] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs border border-[#80D7CE]/60 animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#1E3F35] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Pill className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0C736A] bg-white px-2 py-0.5 rounded-md border border-[#80D7CE]/40">
                  Dose Reminder · {nextDueMed.timing || nextDueMed.scheduledTime}
                </span>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-full">
                  Due Today
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#172B25] mt-1">
                {nextDueMed.name} ({nextDueMed.dose})
              </h3>
              <p className="text-xs text-stone-600">
                {nextDueMed.instructions || 'Take as prescribed by your doctor'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={() => toggleMedicineSchedule(nextDueMed.id, 'taken')}
              className="px-4 py-2 text-xs font-bold text-white bg-[#1E3F35] hover:bg-[#16322A] rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Mark Taken</span>
            </button>
            <Link
              to="/patient/medicines"
              className="px-3 py-2 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-white border border-stone-200 rounded-xl transition-all shadow-2xs"
            >
              All Doses →
            </Link>
          </div>
        </div>
      )}

      {/* 2. REPORT CHECKED ALERT BANNER */}
      {!dismissBanner && latestReviewedReport && (
        <div className="bg-[#E4EDE8] border border-[#CAD8CF] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1E3F35] text-[#32A299] flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E3F35]">
                  REPORT CHECKED · 10 MIN AGO
                </span>
              </div>
              <p className="text-xs font-semibold text-[#172B25] mt-0.5">
                Your doctor reviewed {latestReviewedReport.name} from {latestReviewedReport.labName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Link
              to={`/patient/reports/${latestReviewedReport.id}`}
              className="px-4 py-1.5 text-xs font-bold text-white bg-[#1E3F35] hover:bg-[#16322A] rounded-xl transition-colors shadow-2xs"
            >
              View summary
            </Link>
            <button
              onClick={() => setDismissBanner(true)}
              className="p-1 text-[#5F736C] hover:text-[#172B25] rounded-lg transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. THREE STAT METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: My reports */}
        <Link 
          to="/patient/reports"
          className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs hover:shadow-xs hover:border-[#32A299] transition-all space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-[#E4EDE8] text-[#1E3F35] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-[#1E3F35] transition-colors" />
          </div>
          <div>
            <span className="text-xs font-medium text-[#5F736C] block">My reports</span>
            <span className="text-3xl font-extrabold text-[#172B25] font-serif block mt-0.5">{reports.length}</span>
            <span className="text-[11px] text-[#5F736C] block mt-1">
              {reportLabs} lab{reportLabs === 1 ? '' : 's'} · {reports.filter((report) => report.reviewed).length} checked
            </span>
          </div>
        </Link>

        {/* Card 2: Today's medicines */}
        <Link 
          to="/patient/medicines"
          className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs hover:shadow-xs hover:border-[#32A299] transition-all space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-[#FDF2F0] text-[#B53629] flex items-center justify-center">
              <Pill className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-[#1E3F35] transition-colors" />
          </div>
          <div>
            <span className="text-xs font-medium text-[#5F736C] block">Today's medicines</span>
            <span className="text-3xl font-extrabold text-[#172B25] font-serif block mt-0.5">
              {takenMedicines} / {medicineCount}
            </span>
            <span className="text-[11px] text-[#5F736C] block mt-1">
              {medicineCount === 0 ? 'No medicines scheduled' : isNightTaken ? 'All recorded doses taken' : 'Doses remain due'}
            </span>
          </div>
        </Link>

        {/* Card 3: Next appointment */}
        <Link 
          to="/patient/appointments"
          className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs hover:shadow-xs hover:border-[#32A299] transition-all space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-[#FEF3D6] text-[#8C6200] flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-stone-400 group-hover:text-[#1E3F35] transition-colors" />
          </div>
          <div>
            <span className="text-xs font-medium text-[#5F736C] block">Next appointment</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-[#172B25] font-serif block mt-0.5">
              {nextAppointment?.time || '—'}
            </span>
            <span className="text-[11px] text-[#5F736C] block mt-1">
              {nextAppointment?.status || 'No upcoming appointment'}
            </span>
          </div>
        </Link>
      </div>

      {/* 4. TODAY'S MEDICINES SECTION */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
          <div>
            <h2 className="text-sm font-bold text-[#172B25] font-serif">Today's medicines</h2>
            <p className="text-xs text-[#5F736C]">Your current medication schedule</p>
          </div>
          <Link to="/patient/medicines" className="text-xs font-bold text-[#1E3F35] hover:underline flex items-center gap-0.5">
            View all &gt;
          </Link>
        </div>

        <div className="space-y-2 pt-1">
          {medicineSchedule.length === 0 && (
            <div className="rounded-xl border border-dashed border-stone-200 p-5 text-sm text-stone-500">
              No medicines or care reminders have been added yet.
            </div>
          )}
          {medicineSchedule.map((medicine) => (
            <div key={medicine.id} className="p-3.5 rounded-xl border border-stone-100 bg-[#FAFCFA] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#FCE8E2] text-[#D86E53] flex items-center justify-center shrink-0"><Pill className="w-4 h-4" /></div>
                <div><h4 className="text-xs font-bold text-[#172B25]">{medicine.name} {medicine.dose}</h4><p className="text-[11px] text-[#5F736C]">{medicine.timing || medicine.scheduledTime || 'Schedule not provided'}</p></div>
              </div>
              <button type="button" onClick={() => toggleMedicineSchedule(medicine.id, medicine.state === 'taken' ? 'due' : 'taken')} className="text-[11px] font-semibold text-[#2B5246] bg-[#E4EDE8] px-3 py-1 rounded-full">
                {medicine.state === 'taken' ? 'Taken' : 'Mark taken'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 5. LONGITUDINAL TRENDS VS PREVIOUS REPORTS */}
      <MedicalTrendChart
        reports={reports}
        initialKey="platelets"
        title="Trends vs Previous Reports"
        subtitle="Longitudinal tracking of key blood counts & biological biomarkers"
        onClickReport={(repId) => navigate(`/patient/reports/${repId}`)}
      />

      {/* 6. BOTTOM SECTION: MY RECENT REPORTS & UPCOMING */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: My recent reports */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-[#172B25] font-serif">My recent reports</h3>
              <p className="text-xs text-[#5F736C]">Checked by your doctor</p>
            </div>
            <Link to="/patient/reports" className="text-xs font-bold text-[#1E3F35] hover:underline flex items-center gap-0.5">
              View all &gt;
            </Link>
          </div>

          <div className="space-y-2.5 pt-1">
            {reports.length === 0 ? (
              <div className="p-4 text-center text-xs text-stone-400">
                No reports uploaded yet.
              </div>
            ) : (
              reports.slice(0, 3).map((rep) => (
                <div
                  key={rep.id || (rep as any)._id}
                  className="p-3 rounded-xl border border-stone-100 hover:border-stone-200 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#E4EDE8] text-[#1E3F35] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#172B25]">{rep.name}</h4>
                      <p className="text-[11px] text-[#5F736C]">
                        {rep.labName} · {rep.collectionDate || rep.reportedDate}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/patient/reports/${rep.id || (rep as any)._id}`}
                    className="px-3 py-1 text-xs font-semibold text-[#1E3F35] bg-[#E4EDE8] hover:bg-[#d5e3da] rounded-lg transition-colors"
                  >
                    View
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Upcoming */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-[#172B25] font-serif">Upcoming</h3>
              <p className="text-xs text-[#5F736C]">Visits and tests set by your doctor</p>
            </div>
            <Link to="/patient/appointments" className="text-xs font-bold text-[#1E3F35] hover:underline flex items-center gap-0.5">
              View all &gt;
            </Link>
          </div>

          <div className="space-y-2.5 pt-1">
            {/* Event 1: Requested visit */}
            <Link 
              to="/patient/appointments"
              className="p-3 rounded-xl border border-stone-100 hover:border-stone-200 transition-all flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E4EDE8] text-[#1E3F35] flex flex-col items-center justify-center shrink-0 font-bold">
                  <span className="text-[13px] leading-tight font-extrabold">23</span>
                  <span className="text-[9px] uppercase tracking-wider text-[#2B5246]">OCT</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#172B25]">Requested visit · CBC report discussion</h4>
                  <p className="text-[11px] text-[#5F736C]">12:15 PM · In-person · waiting for confirmation</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-[#172B25] transition-colors" />
            </Link>

            {/* Event 2: Repeat CBC test */}
            <div className="p-3 rounded-xl border border-stone-100 hover:border-stone-200 transition-all flex items-center justify-between gap-3 group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E4EDE8] text-[#1E3F35] flex flex-col items-center justify-center shrink-0 font-bold">
                  <span className="text-[13px] leading-tight font-extrabold">06</span>
                  <span className="text-[9px] uppercase tracking-wider text-[#2B5246]">NOV</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#172B25]">Repeat CBC test</h4>
                  <p className="text-[11px] text-[#5F736C]">Any lab · upload when done</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-[#172B25] transition-colors" />
            </div>
          </div>
        </div>
      </div>

      {/* 6. BOTTOM LEGAL DISCLAIMER */}
      <div className="text-[11px] text-[#5F736C] flex items-center gap-2 pt-2 px-1">
        <Info className="w-3.5 h-3.5 text-[#5F736C] shrink-0" />
        <span>
          Summaries are shown only after a connected doctor approves them.
        </span>
      </div>
    </div>
  );
};
