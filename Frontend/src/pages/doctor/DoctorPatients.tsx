import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  Search,
  Plus,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  MoreVertical,
  CheckCircle2,
} from 'lucide-react';

// Formats ISO string (e.g. 2026-10-30T20:47:12.804Z) to display format: 30 Oct 2026, 08:47 PM
const formatDisplayDate = (dateStr?: string) => {
  if (!dateStr) return '30 Oct 2026, 08:47 PM';
  if (!dateStr.includes('T') && dateStr.includes(',')) return dateStr;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
};

export const DoctorPatients: React.FC = () => {
  const navigate = useNavigate();
  const { patients, reports, doctorInfo, fetchDoctorPatients, fetchReports } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Needs review' | 'Follow-up due' | 'Up to date'>('All');
  const [sortBy, setSortBy] = useState<'Criticality' | 'Name' | 'Recent'>('Criticality');
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [hasUnreadAlerts, setHasUnreadAlerts] = useState(true);

  React.useEffect(() => {
    fetchDoctorPatients(searchQuery);
    fetchReports();
  }, [fetchDoctorPatients, fetchReports, searchQuery]);

  const criticalReports = reports.filter((r) => r.status === 'Critical');
  const unviewedCriticalReports = criticalReports.filter((r) => !r.doctorViewed);

  // Doctor display info
  const doctorDisplayName = doctorInfo.name || 'Dr. Rishabh';
  const doctorSpecialty = doctorInfo.specialty || 'General Physician';
  const doctorInitials = 'DR';

  // Real patient data from database (no mock fallback when patient disconnects)
  const displayedPatients = patients;

  // Filter calculations
  const criticalCount = displayedPatients.filter((p) => p.status === 'Critical').length;
  const followUpCount = displayedPatients.filter((p) => p.status === 'Unbalanced' || p.status === 'Needs Review').length;
  const upToDateCount = displayedPatients.filter((p) => p.status === 'Normal').length;

  // Filtered patients list
  const filteredPatients = displayedPatients.filter((patient) => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.rsId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.conditions.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeFilter === 'Needs review') return patient.status === 'Critical';
    if (activeFilter === 'Follow-up due') return patient.status === 'Unbalanced' || patient.status === 'Needs Review';
    if (activeFilter === 'Up to date') return patient.status === 'Normal';
    return true;
  });

  return (
    <div className="min-h-full flex flex-col text-stone-800">
      {/* Top Header - Full Width Edge-to-Edge Toolbar */}
      <header className="w-full h-[62px] bg-white border-b border-stone-200/90 px-6 flex items-center justify-between gap-4 box-border shrink-0 sticky top-0 z-30">
        {/* LEFT: Page Title */}
        <h1 className="text-xl font-bold text-stone-900 tracking-tight">Patients</h1>

        {/* RIGHT: Grouped Action Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Notification Button */}
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

          {/* Add Patient Primary Button */}
          <button
            onClick={() => navigate('/doctor/add-patient')}
            className="h-[36px] px-3.5 bg-[#184E3F] hover:bg-[#133F33] text-white rounded-[8px] text-[13px] font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer box-border"
          >
            <Plus className="w-4 h-4" />
            <span>Add patient</span>
          </button>

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

      {/* Main Body Content Container */}
      <div className="px-7 lg:px-8 py-5 space-y-4 max-w-[1400px] w-full mx-auto">
        {/* White Card: Search, Filters, and Patients Table */}
        <div className="bg-white border border-stone-200/80 rounded-[2px] shadow-2xs overflow-hidden">
          {/* Top Row: Search Input + Sort Dropdown */}
          <div className="p-4 sm:p-5 pb-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient by name, RS ID, or condition..."
                className="w-full h-[38px] bg-white border border-stone-200/90 rounded-[2px] pl-10 pr-4 text-[13px] text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-700 shadow-2xs transition-all"
              />
            </div>

            {/* Sort Control */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <div className="relative">
                <button
                  type="button"
                  className="h-[38px] bg-white border border-stone-200 text-stone-700 px-3 rounded-[2px] text-[12px] font-medium flex items-center gap-2 hover:bg-stone-50 cursor-pointer shadow-2xs"
                >
                  <span>Sort by: {sortBy}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Filter Pills Row */}
          <div className="px-4 sm:px-5 pb-4 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveFilter('All')}
              className={`px-3.5 py-1.5 rounded-[2px] text-[12px] font-semibold transition-colors cursor-pointer ${
                activeFilter === 'All'
                  ? 'bg-[#13382E] text-white shadow-2xs'
                  : 'bg-[#F8F9FA] border border-stone-200/70 text-stone-600 hover:bg-stone-100'
              }`}
            >
              All patients · {displayedPatients.length}
            </button>
            <button
              onClick={() => setActiveFilter('Needs review')}
              className={`px-3 py-1.5 rounded-[2px] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeFilter === 'Needs review'
                  ? 'bg-[#13382E] text-white shadow-2xs'
                  : 'bg-[#F8F9FA] border border-stone-200/70 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#E5484D]" />
              <span>Needs review · {criticalCount}</span>
            </button>
            <button
              onClick={() => setActiveFilter('Follow-up due')}
              className={`px-3 py-1.5 rounded-[2px] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeFilter === 'Follow-up due'
                  ? 'bg-[#13382E] text-white shadow-2xs'
                  : 'bg-[#F8F9FA] border border-stone-200/70 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#E5A000]" />
              <span>Follow-up due · {followUpCount}</span>
            </button>
            <button
              onClick={() => setActiveFilter('Up to date')}
              className={`px-3 py-1.5 rounded-[2px] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeFilter === 'Up to date'
                  ? 'bg-[#13382E] text-white shadow-2xs'
                  : 'bg-[#F8F9FA] border border-stone-200/70 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#6E56CF]" />
              <span>Up to date · {upToDateCount}</span>
            </button>
          </div>

          {/* Table View */}
          <div className="overflow-x-auto">
            <div className="min-w-[750px]">
              {/* Table Header */}
              <div className="bg-[#F8F9FA] border-y border-stone-200/80 px-5 py-2.5 grid grid-cols-12 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                <div className="col-span-3">PATIENT</div>
                <div className="col-span-3">LATEST REPORT</div>
                <div className="col-span-2">STATUS</div>
                <div className="col-span-2">LAST UPDATED</div>
                <div className="col-span-2 text-right">ACTIONS</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-stone-100">
                {filteredPatients.length === 0 ? (
                  <div className="py-12 px-4 text-center space-y-2">
                    <p className="text-xs font-semibold text-stone-600">No connected patients found</p>
                    <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                      {searchQuery
                        ? 'No patients matched your search query.'
                        : 'You do not have any active patient connections. Connect a new patient with their ReportSetu ID to review their health records.'}
                    </p>
                    {!searchQuery && (
                      <button
                        onClick={() => navigate('/doctor/add-patient')}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#13382E] text-white rounded-[2px] text-xs font-semibold hover:bg-[#0c241e] cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Connect New Patient</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredPatients.map((p) => (
                    <div
                      key={p.id}
                      className="px-5 py-3.5 grid grid-cols-12 items-center hover:bg-stone-50/70 transition-colors"
                    >
                      {/* PATIENT */}
                      <div className="col-span-3 flex items-center">
                        <div className="w-9 h-9 rounded-full bg-[#E2EBE6] text-[#2A554A] font-bold text-sm flex items-center justify-center mr-3 shrink-0">
                          {p.avatar || p.name[0] || 'R'}
                        </div>
                        <div>
                          <p className="font-bold text-[13px] sm:text-[14px] text-stone-900 leading-tight">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-stone-400 font-mono mt-0.5">
                            {p.rsId || 'RS-FTPE4'}
                          </p>
                          <p className="text-[11px] text-stone-400 mt-0.5">
                            {p.gender || 'Male'} · {p.age ? `${p.age} years` : '23 years'}
                          </p>
                        </div>
                      </div>

                      {/* LATEST REPORT */}
                      <div className="col-span-3 pr-2">
                        <p className="font-medium text-[13px] sm:text-[14px] text-stone-800 leading-tight">
                          {p.lastReportName || 'Complete Blood Count (CBC)'}
                        </p>
                        <p className="text-[11px] text-[#E5484D] flex items-center gap-1 mt-0.5 font-medium">
                          <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                          <span>1 value outside reference range</span>
                        </p>
                      </div>

                      {/* STATUS */}
                      <div className="col-span-2">
                        <span className="bg-[#FEF5E7] text-[#C27D00] border border-[#FDE5B5] px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E5A000]" />
                          <span>{p.status || 'Unbalanced'}</span>
                        </span>
                      </div>

                      {/* LAST UPDATED */}
                      <div className="col-span-2">
                        <p className="text-[12px] text-stone-700 font-medium">
                          {formatDisplayDate(p.lastReportTime)}
                        </p>
                        <p className="text-[11px] text-stone-400 mt-0.5">by Patient</p>
                      </div>

                      {/* ACTIONS */}
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/doctor/patients/${p.id}`)}
                          className="h-[32px] px-3 bg-white border border-stone-200 hover:bg-stone-50 text-[#184E3F] rounded-[2px] text-[12px] font-semibold shadow-2xs transition-colors cursor-pointer"
                        >
                          View File
                        </button>
                        <button
                          aria-label="More options"
                          className="w-7 h-7 text-stone-400 hover:text-stone-600 rounded-[2px] hover:bg-stone-100 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pagination Row */}
        <div className="flex items-center justify-between text-stone-500 pt-2 px-1">
          <span className="text-[12px]">
            Showing {filteredPatients.length} of {displayedPatients.length} patients
          </span>
          <div className="flex items-center gap-1.5">
            <button
              aria-label="Previous page"
              disabled
              className="w-7 h-7 rounded-[2px] border border-stone-200/80 bg-white flex items-center justify-center text-stone-400 hover:text-stone-700 disabled:opacity-40 transition-colors shadow-2xs cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[12px] font-semibold text-stone-700 px-2">1 / 1</span>
            <button
              aria-label="Next page"
              disabled
              className="w-7 h-7 rounded-[2px] border border-stone-200/80 bg-white flex items-center justify-center text-stone-400 hover:text-stone-700 disabled:opacity-40 transition-colors shadow-2xs cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
