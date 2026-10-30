import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  Bell,
  Plus,
  AlertTriangle,
  Users,
  Calendar,
  FileText,
  ChevronRight,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

export const DoctorHome: React.FC = () => {
  const navigate = useNavigate();
  const { patients, reports, appointments, doctorInfo, fetchDoctorPatients, fetchReports, fetchAppointments } = useStore();
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);

  React.useEffect(() => {
    fetchDoctorPatients();
    fetchReports();
    fetchAppointments();
  }, []);

  // Critical reports awaiting first doctor review (unviewed & unapproved)
  const unviewedCriticalReports = reports.filter(
    (r) => r.status === 'Critical' && !r.reviewed && r.reviewStatus !== 'approved' && !r.doctorViewed
  );
  const pendingReports = reports.filter((r) => !r.reviewed && r.reviewStatus !== 'approved');
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayAppointments = appointments.filter((appointment) => appointment.status !== 'Cancelled');
  const completedAppointments = todayAppointments.filter((appointment) => appointment.status === 'Completed').length;
  const nextAppointment = todayAppointments.find((appointment) => appointment.status === 'Confirmed' || appointment.status === 'Pending');
  const doctorInitials = doctorInfo.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#172B25] tracking-tight">
            Good morning, {doctorInfo.name}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-stone-500 font-medium">
            <span>{today}</span>
            <span>·</span>
            <span className="flex items-center gap-1.5 text-[#2B5246]">
              <span className="w-2 h-2 rounded-full bg-[#2E9E6B] inline-block animate-pulse" />
              Live data
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotificationPopup(!showNotificationPopup)}
              className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 shadow-sm transition-all"
            >
              <Bell className="w-4 h-4" />
              {unviewedCriticalReports.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#B53629] animate-pulse" />
              )}
            </button>

            {showNotificationPopup && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-modal border border-stone-200 p-4 z-50 text-xs">
                <p className="font-semibold text-stone-800 mb-2">Notifications</p>
                <div className="space-y-2">
                  {unviewedCriticalReports.length > 0 ? unviewedCriticalReports.slice(0, 3).map((report) => (
                    <button
                      key={report.id}
                      onClick={() => navigate(`/doctor/reports/${report.id}`)}
                      className="w-full text-left p-2 bg-[#FDF2F0] rounded-xl text-[#9D3728] hover:bg-[#FBEBEA] transition-colors"
                    >
                      <span className="font-semibold">Urgent unviewed:</span> {report.patientName} · {report.name}
                    </button>
                  )) : (
                    <div className="p-2 bg-stone-50 rounded-xl text-stone-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2E9E6B]" />
                      <span>All critical alerts acknowledged</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Doctor Profile Avatar */}
          <div className="w-10 h-10 rounded-full bg-[#1E3F35] text-white flex items-center justify-center font-semibold text-xs shadow-sm">
            {doctorInitials}
          </div>

          {/* Add Patient CTA */}
          <button
            onClick={() => navigate('/doctor/add-patient')}
            className="flex items-center gap-2 bg-[#32A299] hover:bg-[#288E86] text-white px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add patient</span>
          </button>
        </div>
      </div>

      {/* Critical Alert Banner - disappears once viewed by doctor! */}
      {unviewedCriticalReports.length > 0 ? (
        <div className="bg-[#FDF2F0] border border-[#F6C4C0] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#FBEBEA] flex items-center justify-center flex-shrink-0 text-[#B53629]">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-[#9D3728] text-sm sm:text-base">
              Needs urgent review: {unviewedCriticalReports.length} report{unviewedCriticalReports.length === 1 ? '' : 's'} have unviewed critical values
            </h3>
            <p className="text-xs sm:text-sm text-[#B53629]/90 mt-0.5">
              {unviewedCriticalReports.slice(0, 3).map((report) => `${report.patientName} (${report.name})`).join(', ')}
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/doctor/reports')}
          className="bg-[#B53629] hover:bg-[#9D2D22] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-sm flex-shrink-0"
        >
          Review critical reports
        </button>
        </div>
      ) : null}

      {/* 3 Large Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Patients */}
        <div
          onClick={() => navigate('/doctor/patients')}
          className="bg-white rounded-3xl p-6 shadow-card border border-stone-200/70 hover:shadow-hover transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Total patients
            </span>
            <div className="w-8 h-8 rounded-xl bg-stone-50 flex items-center justify-center text-stone-600 group-hover:bg-[#1E3F35] group-hover:text-white transition-all">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-4xl font-extrabold text-[#172B25] tracking-tight">{patients.length}</h2>
            <span className="text-xs font-semibold text-[#2E9E6B] bg-[#E4EDE8] px-2 py-0.5 rounded-full">
              {patients.length === 0 ? 'No records yet' : 'Active records'}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-2">Active records under your clinical care</p>
        </div>

        {/* Card 2: Appointments */}
        <div
          onClick={() => navigate('/doctor/appointments')}
          className="bg-white rounded-3xl p-6 shadow-card border border-stone-200/70 hover:shadow-hover transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Appointments today
            </span>
            <div className="w-8 h-8 rounded-xl bg-stone-50 flex items-center justify-center text-stone-600 group-hover:bg-[#1E3F35] group-hover:text-white transition-all">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-4xl font-extrabold text-[#172B25] tracking-tight">{todayAppointments.length}</h2>
            <span className="text-xs font-medium text-stone-500">{completedAppointments} completed · {todayAppointments.length - completedAppointments} remaining</span>
          </div>
          <p className="text-xs text-stone-500 mt-2">{nextAppointment ? `Next visit: ${nextAppointment.patientName} at ${nextAppointment.time}` : 'No upcoming visits'}</p>
        </div>

        {/* Card 3: Pending Reports */}
        <div
          onClick={() => navigate('/doctor/reports')}
          className="bg-white rounded-3xl p-6 shadow-card border border-stone-200/70 hover:shadow-hover transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-stone-500 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Pending reports
            </span>
            <div className="w-8 h-8 rounded-xl bg-stone-50 flex items-center justify-center text-stone-600 group-hover:bg-[#1E3F35] group-hover:text-white transition-all">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-4xl font-extrabold text-[#172B25] tracking-tight">{pendingReports.length}</h2>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              unviewedCriticalReports.length > 0
                ? 'text-[#B53629] bg-[#FDF2F0]'
                : pendingReports.length > 0
                ? 'text-[#8C6200] bg-[#FEF3D6]'
                : 'text-[#2E9E6B] bg-[#E4EDE8]'
            }`}>
              {unviewedCriticalReports.length > 0
                ? `${unviewedCriticalReports.length} urgent unviewed`
                : pendingReports.length > 0
                ? `${pendingReports.length} to review`
                : 'All caught up'}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            {pendingReports.length > 0
              ? `Estimated review time: ~${Math.max(2, pendingReports.length * 3)} minutes`
              : 'All reports have been reviewed and approved'}
          </p>
        </div>
      </div>

      {/* Priority Patients List */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-[#172B25]">Priority patients</h3>
            <p className="text-xs text-stone-500">Patients with active alerts or pending critical reviews</p>
          </div>
          <button
            onClick={() => navigate('/doctor/patients')}
            className="text-xs font-semibold text-[#1E3F35] hover:text-[#32A299] flex items-center gap-1 transition-all"
          >
            <span>View all patients</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {patients.slice(0, 4).map((p) => {
            const isCritical = p.status === 'Critical';
            const isUnbalanced = p.status === 'Unbalanced';

            return (
              <div
                key={p.id}
                onClick={() => navigate(`/doctor/patients/${p.id}`)}
                className="p-4 rounded-2xl border border-stone-200/70 hover:border-[#1E3F35]/40 hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#E4EDE8] text-[#1E3F35] font-bold text-xs flex items-center justify-center">
                      {p.avatar}
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isCritical
                          ? 'bg-[#FDF2F0] text-[#B53629] border border-[#F6C4C0]'
                          : isUnbalanced
                          ? 'bg-[#FEF3D6] text-[#8C6200] border border-[#FCE299]'
                          : 'bg-[#E4EDE8] text-[#2B5246]'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-[#172B25] text-sm">{p.name}</h4>
                  <p className="text-[11px] text-stone-400 font-mono mt-0.5">{p.rsId}</p>
                  <p className="text-xs text-stone-600 mt-2 line-clamp-1">{p.lastReportName}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-[#1E3F35] font-medium">
                  <span>Open patient file</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
          {patients.length === 0 && <p className="col-span-full py-8 text-center text-xs text-stone-500">No patients are connected to your account yet.</p>}
        </div>
      </div>

      {/* Two Column Layout: Reports awaiting review vs Upcoming Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Reports awaiting review */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-[#172B25]">Reports awaiting review</h3>
                <p className="text-xs text-stone-500">New lab uploads synced to your clinic</p>
              </div>
              <button
                onClick={() => navigate('/doctor/reports')}
                className="text-xs font-semibold text-[#1E3F35] hover:text-[#32A299] flex items-center gap-1"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {reports.slice(0, 4).map((report) => (
                <div
                  key={report.id}
                  onClick={() => navigate(`/doctor/reports/${report.id}`)}
                  className="p-3.5 rounded-2xl border border-stone-100 hover:border-stone-200 hover:bg-stone-50/50 flex items-center justify-between gap-3 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        report.status === 'Critical'
                          ? 'bg-[#FDF2F0] text-[#B53629]'
                          : 'bg-[#FEF3D6] text-[#8C6200]'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-[#172B25]">{report.name}</h4>
                      <p className="text-[11px] text-stone-500">
                        {report.patientName} · {report.labName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        report.status === 'Critical'
                          ? 'bg-[#FDF2F0] text-[#B53629]'
                          : 'bg-[#FEF3D6] text-[#8C6200]'
                      }`}
                    >
                      {report.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/doctor/reports/${report.id}`);
                      }}
                      className="text-xs font-semibold bg-stone-100 hover:bg-[#1E3F35] hover:text-white px-3 py-1.5 rounded-lg transition-all"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming Follow-ups */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-[#172B25]">Upcoming follow-ups</h3>
                <p className="text-xs text-stone-500">Scheduled visits and test review reminders</p>
              </div>
              <button
                onClick={() => navigate('/doctor/appointments')}
                className="text-xs font-semibold text-[#1E3F35] hover:text-[#32A299] flex items-center gap-1"
              >
                <span>Calendar view</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl border border-stone-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#E4EDE8] text-[#1E3F35] flex flex-col items-center justify-center font-bold text-xs flex-shrink-0">
                    <span className="text-[10px] text-[#2A554A] uppercase">Oct</span>
                    <span className="text-sm">23</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-[#172B25]">
                      Rohan Verma · CBC report discussion
                    </h4>
                    <p className="text-[11px] text-stone-500">12:15 PM · In-person · RS-10475</p>
                  </div>
                </div>
                <span className="text-[11px] font-medium bg-[#FEF3D6] text-[#8C6200] px-2.5 py-1 rounded-full">
                  Requested
                </span>
              </div>

              <div className="p-3.5 rounded-2xl border border-stone-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#E4EDE8] text-[#1E3F35] flex flex-col items-center justify-center font-bold text-xs flex-shrink-0">
                    <span className="text-[10px] text-[#2A554A] uppercase">Oct</span>
                    <span className="text-sm">26</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-[#172B25]">
                      Meera Iyer · HbA1c therapy escalation
                    </h4>
                    <p className="text-[11px] text-stone-500">11:00 AM · Video call · RS-10482</p>
                  </div>
                </div>
                <span className="text-[11px] font-medium bg-[#E4EDE8] text-[#2B5246] px-2.5 py-1 rounded-full">
                  Confirmed
                </span>
              </div>

              <div className="p-3.5 rounded-2xl border border-stone-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#E4EDE8] text-[#1E3F35] flex flex-col items-center justify-center font-bold text-xs flex-shrink-0">
                    <span className="text-[10px] text-[#2A554A] uppercase">Oct</span>
                    <span className="text-sm">27</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-[#172B25]">
                      Arjun Nair · Routine blood pressure review
                    </h4>
                    <p className="text-[11px] text-stone-500">04:30 PM · In-person · RS-10448</p>
                  </div>
                </div>
                <span className="text-[11px] font-medium bg-[#E4EDE8] text-[#2B5246] px-2.5 py-1 rounded-full">
                  Confirmed
                </span>
              </div>

              <div className="p-3.5 rounded-2xl border border-stone-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-600 flex flex-col items-center justify-center font-bold text-xs flex-shrink-0">
                    <span className="text-[10px] text-stone-500 uppercase">Nov</span>
                    <span className="text-sm">06</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-[#172B25]">
                      Rohan Verma · Repeat CBC lab test due
                    </h4>
                    <p className="text-[11px] text-stone-500">Any accredited lab · Automated follow-up</p>
                  </div>
                </div>
                <span className="text-[11px] font-medium bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full">
                  Test Due
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clinical Disclaimer Footer */}
      <div className="bg-[#F2FAF9] border border-[#C6ECE7] rounded-2xl p-4 text-xs text-[#0C736A] flex items-center gap-3 shadow-2xs">
        <div className="w-6 h-6 rounded-lg bg-[#E0F7F5] border border-[#80D7CE] flex items-center justify-center shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0A887D]" />
        </div>
        <span>
          ReportSetu is a clinical decision-support tool. All AI summaries must be verified against original lab
          reports before patient communication.
        </span>
      </div>
    </div>
  );
};
