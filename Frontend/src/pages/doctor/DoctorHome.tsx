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
  ChevronDown,
  Search,
  Clock,
  Zap,
  UserPlus,
  ArrowUpRight,
  MoreVertical,
  Inbox,
  CheckCircle2,
} from 'lucide-react';

export const DoctorHome: React.FC = () => {
  const navigate = useNavigate();
  const {
    patients,
    reports,
    appointments,
    doctorInfo,
    currentUser,
    fetchDoctorPatients,
    fetchReports,
    fetchAppointments,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'needs_review' | 'recent'>('all');
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [hasUnreadAlerts, setHasUnreadAlerts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  React.useEffect(() => {
    fetchDoctorPatients();
    fetchReports();
    fetchAppointments();
  }, [fetchDoctorPatients, fetchReports, fetchAppointments]);

  // Priority calculations
  const pendingReports = reports.filter((r) => !r.reviewed && r.reviewStatus !== 'approved');
  const criticalReports = reports.filter((r) => r.status === 'Critical');
  const unviewedCriticalReports = criticalReports.filter((r) => !r.doctorViewed);

  const todayAppointments = appointments.filter((a) => a.status !== 'Cancelled');
  const completedAppointments = todayAppointments.filter((a) => a.status === 'Completed').length;
  const nextAppointment = todayAppointments.find(
    (a) => a.status === 'Confirmed' || a.status === 'Pending'
  );

  // Doctor display info
  const doctorDisplayName = currentUser?.name || doctorInfo.name || 'Doctor';
  const doctorSpecialty = doctorInfo.specialty || 'General Physician';
  const doctorInitials = 'DR';

  // Sample or real patient data for the Priority Patients table
  const displayedPatients = patients;

  // Filtering for priority patients
  const filteredPatients = displayedPatients.filter((p) => {
    if (activeTab === 'critical') return p.status === 'Critical';
    if (activeTab === 'needs_review') return p.status === 'Unbalanced' || p.status === 'Needs Review';
    if (activeTab === 'recent') return true;
    return true;
  });

  // Top pending report for "Reports awaiting review"
  const awaitingReport = reports.find((r) => !r.reviewed && r.reviewStatus !== 'approved') || null;

  return (
    <div className="min-h-full flex flex-col text-stone-800">
      {/* Full-width Enterprise Application Toolbar: 60-64px height, zero outer horizontal margin, zero top margin */}
      <header className="w-full h-[62px] bg-white border-b border-stone-200/90 px-5 sm:px-6 flex items-center justify-between gap-4 box-border shrink-0 sticky top-0 z-30">
        {/* LEFT: Search bar (Flexible Width, Occupying available space) */}
        <div className="relative flex-1 max-w-[480px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                navigate(`/doctor/patients?search=${encodeURIComponent(searchQuery.trim())}`);
              }
            }}
            placeholder="Search patient by name, ID or phone number..."
            className="w-full h-[38px] bg-stone-50 border border-stone-200/80 rounded-[8px] pl-10 pr-4 text-[13px] text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:bg-white transition-all box-border"
          />
        </div>

        {/* RIGHT: Grouped Action Elements (Notification | Add Patient | Divider | Doctor Profile) */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Notification Icon with Unread Indicator */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotificationPopup(!showNotificationPopup);
                setHasUnreadAlerts(false);
              }}
              aria-label="Notifications"
              className="w-[36px] h-[36px] rounded-full bg-stone-50 hover:bg-stone-100 border border-stone-200/80 flex items-center justify-center text-stone-600 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {(hasUnreadAlerts || unviewedCriticalReports.length > 0) && (
                <span className="w-2 h-2 rounded-full bg-[#E5484D] absolute top-2 right-2 ring-2 ring-white" />
              )}
            </button>

            {showNotificationPopup && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-[10px] shadow-lg border border-stone-200 p-4 z-50 text-xs">
                <p className="font-semibold text-stone-800 mb-2">Notifications</p>
                <div className="space-y-2">
                  {unviewedCriticalReports.length > 0 ? (
                    unviewedCriticalReports.slice(0, 3).map((report) => (
                      <button
                        key={report.id}
                        onClick={() => {
                          setShowNotificationPopup(false);
                          navigate(`/doctor/reports/${report.id}`);
                        }}
                        className="w-full text-left p-2.5 bg-red-50 rounded-[8px] text-red-800 hover:bg-red-100 transition-colors"
                      >
                        <span className="font-semibold">Critical:</span> {report.patientName} · {report.name}
                      </button>
                    ))
                  ) : (
                    <div className="p-2.5 bg-stone-50 rounded-[8px] text-stone-600 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>All critical alerts acknowledged</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Add Patient Primary Button (Height: 36-38px) */}
          <button
            onClick={() => navigate('/doctor/add-patient')}
            className="h-[36px] px-3.5 bg-[#184E3F] hover:bg-[#133F33] text-white rounded-[8px] text-[13px] font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer box-border"
          >
            <Plus className="w-4 h-4" />
            <span>Add patient</span>
          </button>

          {/* Subtle Vertical Divider */}
          <div className="h-6 w-[1px] bg-stone-200 shrink-0 mx-0.5 sm:mx-1" />

          {/* Doctor Profile Chip */}
          <button
            onClick={() => navigate('/doctor/profile')}
            className="h-[36px] flex items-center gap-2 pl-1 pr-1.5 rounded-[8px] hover:bg-stone-50 transition-colors cursor-pointer select-none"
          >
            <div className="w-8 h-8 rounded-full bg-[#122B22] text-white flex items-center justify-center font-bold text-xs shrink-0">
              {doctorInitials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[13px] font-bold text-stone-900 leading-tight">
                {doctorDisplayName}
              </p>
              <p className="text-[10px] text-stone-400 leading-tight mt-0.5">
                {doctorSpecialty}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0" />
          </button>
        </div>
      </header>

      {/* Main Dashboard Content Area */}
      <div className="px-7 lg:px-8 py-5 space-y-5 max-w-[1400px] w-full mx-auto">
        {/* 3 Top Stat Cards - Target Height: 155-165px, Border Radius: 8-10px */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Patients */}
        <div
          onClick={() => navigate('/doctor/patients')}
          className="h-[160px] bg-white border border-stone-200/80 rounded-[10px] p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-[8px] bg-[#E6F5EC] text-[#1E7E49] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <span className="font-bold text-[13px] text-stone-900 ml-2.5 flex-1">
              Total Patients
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-stone-300" />
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-[28px] font-extrabold text-stone-900 tracking-tight leading-none">
                {patients.length}
              </h2>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-[#1E7E49] mt-1.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+0%</span>
              </div>
              <p className="text-[11px] text-stone-400 mt-0.5">Active records under your care</p>
            </div>

            {/* Decorative mini bar chart */}
            <div className="flex items-end gap-1 h-8 pb-0.5 opacity-80">
              <div className="w-1.5 h-2.5 rounded-xs bg-[#B8E2CB]" />
              <div className="w-1.5 h-5 rounded-xs bg-[#B8E2CB]" />
              <div className="w-1.5 h-3.5 rounded-xs bg-[#B8E2CB]" />
              <div className="w-1.5 h-7 rounded-xs bg-[#B8E2CB]" />
              <div className="w-1.5 h-4.5 rounded-xs bg-[#B8E2CB]" />
              <div className="w-1.5 h-6 rounded-xs bg-[#B8E2CB]" />
            </div>
          </div>
        </div>

        {/* Card 2: Appointments Today */}
        <div
          onClick={() => navigate('/doctor/appointments')}
          className="h-[160px] bg-white border border-stone-200/80 rounded-[10px] p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-[8px] bg-[#E8F1FC] text-[#1D68CD] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="font-bold text-[13px] text-stone-900 ml-2.5 flex-1">
              Appointments Today
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-stone-300" />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[28px] font-extrabold text-stone-900 tracking-tight leading-none">
                {todayAppointments.length}
              </h2>
              <span className="text-[11px] text-stone-400 font-medium">
                {completedAppointments} completed · {Math.max(0, todayAppointments.length - completedAppointments)} remaining
              </span>
            </div>

            <p className="text-[11px] text-stone-600 font-medium flex items-center mt-2.5">
              <Clock className="w-3.5 h-3.5 text-stone-400 mr-1.5 shrink-0" />
              <span>
                {nextAppointment
                  ? `Next visit: ${nextAppointment.patientName} at ${nextAppointment.time}`
                  : 'No upcoming visits scheduled'}
              </span>
            </p>
          </div>
        </div>

        {/* Card 3: Pending Reports */}
        <div
          onClick={() => navigate('/doctor/reports')}
          className="h-[160px] bg-white border border-stone-200/80 rounded-[10px] p-4 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-[8px] bg-[#FDECEB] text-[#D83A31] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <span className="font-bold text-[13px] text-stone-900 ml-2.5 flex-1">
              Pending Reports
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-stone-300" />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-[28px] font-extrabold text-stone-900 tracking-tight leading-none">
                {pendingReports.length}
              </h2>
              <span className="bg-[#E5F5EC] text-[#1E7E49] px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                All caught up
              </span>
            </div>

            <p className="text-[11px] text-stone-400 mt-2.5">
              All reports have been reviewed and approved
            </p>
          </div>
        </div>
      </div>

      {/* Middle Section: Priority Patients Card - Target Border Radius: 8-10px */}
      <div className="bg-white border border-stone-200/80 rounded-[10px] p-4 sm:p-5 shadow-2xs">
        {/* Header - Heading Target: 19-21px */}
        <div className="flex items-start sm:items-center justify-between gap-4 mb-3.5">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-[#FDECEB] text-[#D83A31] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-[20px] text-stone-900 leading-tight">Priority Patients</h3>
              <p className="text-[12px] text-stone-400 mt-0.5">
                Patients with active alerts or pending critical reviews
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/doctor/patients')}
            className="text-[13px] font-semibold text-[#184E3F] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>View all patients</span>
            <span className="text-sm">→</span>
          </button>
        </div>

        {/* Filter Pills & Sort Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 pb-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`h-[32px] px-3 rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#13382E] text-white'
                  : 'bg-[#F8F9FA] border border-stone-200/70 text-stone-600 hover:bg-stone-100'
              }`}
            >
              All ({displayedPatients.length})
            </button>
            <button
              onClick={() => setActiveTab('critical')}
              className={`h-[32px] px-3 rounded-[8px] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'critical'
                  ? 'bg-[#13382E] text-white'
                  : 'bg-[#F8F9FA] border border-stone-200/70 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D]" />
              <span>Critical ({displayedPatients.filter((p) => p.status === 'Critical').length})</span>
            </button>
            <button
              onClick={() => setActiveTab('needs_review')}
              className={`h-[32px] px-3 rounded-[8px] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'needs_review'
                  ? 'bg-[#13382E] text-white'
                  : 'bg-[#F8F9FA] border border-stone-200/70 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#E5A000]" />
              <span>Needs review ({displayedPatients.filter((p) => p.status === 'Unbalanced' || p.status === 'Needs Review').length})</span>
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`h-[32px] px-3 rounded-[8px] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'recent'
                  ? 'bg-[#13382E] text-white'
                  : 'bg-[#F8F9FA] border border-stone-200/70 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#6E56CF]" />
              <span>Recent activity ({displayedPatients.length})</span>
            </button>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center self-end sm:self-auto">
            <span className="text-[12px] text-stone-400 mr-2">Sort by</span>
            <button className="h-[32px] bg-white border border-stone-200 text-stone-700 px-2.5 rounded-[8px] text-[12px] font-medium flex items-center gap-1.5 hover:bg-stone-50 cursor-pointer">
              <span>Priority</span>
              <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[700px]">
            {/* Table Header */}
            <div className="bg-[#F8F9FA] border-y border-stone-100 px-4 py-2 grid grid-cols-12 text-[10px] font-bold tracking-wider text-stone-400 uppercase rounded-t-[8px]">
              <div className="col-span-3">PATIENT</div>
              <div className="col-span-3">LATEST REPORT</div>
              <div className="col-span-2">STATUS</div>
              <div className="col-span-2">LAST UPDATED</div>
              <div className="col-span-2 text-right">ACTIONS</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-stone-100">
              {filteredPatients.length > 0 ? (
                filteredPatients.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-3 grid grid-cols-12 items-center hover:bg-stone-50/70 transition-colors"
                >
                  {/* PATIENT */}
                  <div className="col-span-3 flex items-center">
                    <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-700 font-bold text-xs flex items-center justify-center mr-2.5 shrink-0">
                      {p.avatar || p.name[0] || 'P'}
                    </div>
                    <div>
                      <p className="font-bold text-[13px] sm:text-[14px] text-stone-900 leading-tight">
                        {p.name}
                      </p>
                      <p className="text-[11px] text-stone-400 font-mono mt-0.5">
                        {p.rsId || 'ReportSetu ID'}
                      </p>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        {p.gender || 'Not specified'} · {p.age ? `${p.age} years` : 'Age not recorded'}
                      </p>
                    </div>
                  </div>

                  {/* LATEST REPORT */}
                  <div className="col-span-3 pr-2">
                    {p.lastReportName ? (
                      <>
                        <p className="font-medium text-[13px] sm:text-[14px] text-stone-800 leading-tight">
                          {p.lastReportName}
                        </p>
                        {p.status === 'Critical' ? (
                          <p className="text-[11px] text-[#E5484D] flex items-center gap-1 mt-0.5 font-medium">
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            <span>Critical values detected</span>
                          </p>
                        ) : p.status === 'Unbalanced' ? (
                          <p className="text-[11px] text-[#C27D00] flex items-center gap-1 mt-0.5 font-medium">
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            <span>Values outside reference range</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-[#1E7E49] flex items-center gap-1 mt-0.5 font-medium">
                            <span>All parameters normal</span>
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-[13px] sm:text-[14px] text-stone-400 leading-tight">
                          No reports submitted
                        </p>
                        <p className="text-[11px] text-stone-400 mt-0.5">Awaiting diagnostic upload</p>
                      </>
                    )}
                  </div>

                  {/* STATUS */}
                  <div className="col-span-2">
                    {p.status ? (
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5 ${
                        p.status === 'Critical'
                          ? 'bg-[#FDECEB] text-[#D83A31]'
                          : p.status === 'Unbalanced'
                          ? 'bg-[#FEF5E7] text-[#C27D00]'
                          : 'bg-[#E5F5EC] text-[#1E7E49]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          p.status === 'Critical' ? 'bg-[#E5484D]' : p.status === 'Unbalanced' ? 'bg-[#E5A000]' : 'bg-[#1E7E49]'
                        }`} />
                        <span>{p.status}</span>
                      </span>
                    ) : (
                      <span className="bg-stone-100 text-stone-600 px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5">
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  {/* LAST UPDATED */}
                  <div className="col-span-2">
                    <p className="text-[12px] text-stone-700 font-medium">
                      {p.lastReportTime || 'No recent activity'}
                    </p>
                    {p.lastReportTime && <p className="text-[11px] text-stone-400 mt-0.5">by Patient</p>}
                  </div>

                  {/* ACTIONS */}
                  <div className="col-span-2 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => navigate(`/doctor/patients/${p.id}`)}
                      className="h-[32px] px-3 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-[8px] text-[12px] font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      View Details
                    </button>
                    <button
                      aria-label="More options"
                      className="w-7 h-7 text-stone-400 hover:text-stone-600 rounded-[6px] hover:bg-stone-100 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
              ) : (
                <div className="px-6 py-12 text-center text-stone-400">
                  <Users className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                  <p className="text-[13px] font-semibold text-stone-600">No active priority patients</p>
                  <p className="text-[11px] text-stone-400 mt-1 max-w-sm mx-auto">
                    Patients with active clinical consent and priority findings will be displayed here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Two Columns - Target Border Radius: 8-10px */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Reports awaiting review */}
        <div className="lg:col-span-7 bg-white border border-stone-200/80 rounded-[10px] p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[8px] bg-[#FFF2E8] text-[#D96B27] flex items-center justify-center shrink-0">
                  <Inbox className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-[17px] text-stone-900 leading-tight">
                    Reports awaiting review
                  </h3>
                  <p className="text-[12px] text-stone-400 mt-0.5">
                    New lab uploads synced to your clinic
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate('/doctor/reports')}
                className="text-[12px] font-semibold text-[#184E3F] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View all</span>
                <span>→</span>
              </button>
            </div>

            {/* Report Row Item */}
            {awaitingReport ? (
              <div className="border border-stone-200/80 rounded-[8px] p-3.5 flex items-center justify-between bg-white hover:bg-stone-50/50 transition-colors">
                <div>
                  <p className="font-bold text-[13px] sm:text-[14px] text-stone-900 leading-tight">
                    {awaitingReport.name}
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    {awaitingReport.patientName} · {awaitingReport.labName}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="bg-[#FEF5E7] text-[#C27D00] px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                    {awaitingReport.status || 'Unbalanced'}
                  </span>
                  <button
                    onClick={() => navigate(`/doctor/reports/${awaitingReport.id}`)}
                    className="h-[32px] px-3.5 bg-white border border-stone-200 hover:bg-stone-50 text-stone-800 rounded-[8px] text-[12px] font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    Review
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-stone-200/80 rounded-[8px] p-6 text-center bg-stone-50/50">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                <p className="font-semibold text-[13px] text-stone-700">All reports reviewed</p>
                <p className="text-[11px] text-stone-400 mt-0.5">No pending patient lab reports require clinical review.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Quick Actions */}
        <div className="lg:col-span-5 bg-white border border-stone-200/80 rounded-[10px] p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center gap-2 mb-3.5">
            <Zap className="w-4 h-4 text-stone-400" />
            <h3 className="font-bold text-[17px] text-stone-900 leading-tight">Quick Actions</h3>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {/* Add Patient */}
            <div
              onClick={() => navigate('/doctor/add-patient')}
              className="bg-[#F0FAF4] border border-[#D5EFE1] rounded-[8px] py-3.5 px-2 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-[#E6F6ED] transition-all text-center group"
            >
              <UserPlus className="w-5 h-5 text-[#1E7E49] group-hover:scale-105 transition-transform" />
              <span className="text-[11px] font-bold text-stone-800">Add Patient</span>
            </div>

            {/* View Reports */}
            <div
              onClick={() => navigate('/doctor/reports')}
              className="bg-[#F2F7FC] border border-[#D8E6F5] rounded-[8px] py-3.5 px-2 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-[#E6F0FA] transition-all text-center group"
            >
              <FileText className="w-5 h-5 text-[#1D68CD] group-hover:scale-105 transition-transform" />
              <span className="text-[11px] font-bold text-stone-800">View Reports</span>
            </div>

            {/* Manage Appointments */}
            <div
              onClick={() => navigate('/doctor/appointments')}
              className="bg-[#FEF9EE] border border-[#FDEBC8] rounded-[8px] py-3.5 px-2 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-[#FDF4DF] transition-all text-center group"
            >
              <Calendar className="w-5 h-5 text-[#D97706] group-hover:scale-105 transition-transform" />
              <span className="text-[11px] font-bold text-stone-800 leading-tight">
                Manage Appointments
              </span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
