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
  ArrowUpDown,
  MoreVertical,
  CheckCircle2,
  FileText,
  Clock,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface ReportDisplayItem {
  id: string;
  name: string;
  category: string;
  dateStr: string;
  timeStr: string;
  patientId: string;
  patientName: string;
  patientAvatar: string;
  patientRsId: string;
  patientGender: string;
  patientAge: number | string;
  status: 'Critical' | 'Unbalanced' | 'Normal';
  reviewed: boolean;
  reviewStatus?: 'pending' | 'in_review' | 'approved';
  doctorViewed?: boolean;
  outsideRangeText?: string;
}

// Parses date strings (e.g. ISO string 2026-10-30T20:47:12.804Z) into separate date and time parts
const formatReportDateTime = (dateStr?: string) => {
  if (!dateStr) {
    return { date: '30 Oct 2026,', time: '08:47 PM' };
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      if (dateStr.includes(',')) {
        const parts = dateStr.split(',');
        return { date: `${parts[0].trim()},`, time: parts[1]?.trim() || '08:47 PM' };
      }
      return { date: `${dateStr},`, time: '08:47 PM' };
    }
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
    return {
      date: `${day} ${month} ${year},`,
      time: `${strHours}:${minutes} ${ampm}`,
    };
  } catch {
    return { date: '30 Oct 2026,', time: '08:47 PM' };
  }
};

export const DoctorReports: React.FC = () => {
  const navigate = useNavigate();
  const { reports, patients, doctorInfo, fetchReports, fetchDoctorPatients } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'Latest' | 'Criticality' | 'Patient'>('Latest');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [hasUnreadAlerts, setHasUnreadAlerts] = useState(true);

  React.useEffect(() => {
    fetchReports();
    fetchDoctorPatients();
  }, [fetchReports, fetchDoctorPatients]);

  // Doctor display info
  const doctorDisplayName = doctorInfo.name || 'Dr. Rishabh';
  const doctorSpecialty = doctorInfo.specialty || 'General Physician';
  const doctorInitials = 'DR';

  // Sample or real reports mapped with patient details
  const displayedReports: ReportDisplayItem[] =
    reports.length > 0
      ? reports.map((r: any) => {
          const patient = patients.find(
            (p) => p.id === r.patientId || p.rsId === r.patientRsId || p.name === r.patientName
          );
          const { date, time } = formatReportDateTime(r.reportedDate || r.collectionDate || r.createdAt);
          return {
            id: r.id || r._id || 'sample-r1',
            name: r.name || 'Complete Blood Count (CBC)',
            category: r.category === 'CBC' || !r.category ? 'Blood Report' : `${r.category} Report`,
            dateStr: date,
            timeStr: time,
            patientId: r.patientId || patient?.id || 'sample-p1',
            patientName: r.patientName || patient?.name || 'Rishabh',
            patientAvatar: patient?.avatar || r.patientAvatar || 'R',
            patientRsId: r.patientRsId || patient?.rsId || 'RS-FTPE4',
            patientGender: patient?.gender || 'Male',
            patientAge: patient?.age || 23,
            status: (r.status as any) || 'Unbalanced',
            reviewed: Boolean(r.reviewed || r.reviewStatus === 'approved'),
            reviewStatus: r.reviewStatus,
            doctorViewed: Boolean(r.doctorViewed || r.reviewStatus === 'in_review' || r.reviewStatus === 'approved' || r.reviewed),
            outsideRangeText:
              r.status === 'Critical'
                ? '2 values critical'
                : r.status === 'Unbalanced'
                ? '1 value outside reference range'
                : undefined,
          };
        })
      : [
          {
            id: 'sample-r1',
            name: 'Complete Blood Count (CBC)',
            category: 'Blood Report',
            dateStr: '30 Oct 2026,',
            timeStr: '08:47 PM',
            patientId: 'sample-p1',
            patientName: 'Rishabh',
            patientAvatar: 'R',
            patientRsId: 'RS-FTPE4',
            patientGender: 'Male',
            patientAge: 23,
            status: 'Unbalanced',
            reviewed: true,
            reviewStatus: 'approved',
            doctorViewed: true,
            outsideRangeText: '1 value outside reference range',
          },
        ];

  // Critical alerts that require urgent attention
  const criticalReports = displayedReports.filter((r) => r.status === 'Critical');
  const unviewedCriticalReports = criticalReports.filter((r) => !r.doctorViewed);

  // Stats calculation
  const totalReportsCount = displayedReports.length;
  const awaitingReviewCount = displayedReports.filter((r) => !r.reviewed && r.reviewStatus !== 'approved').length;

  // Filtered & Sorted reports
  const filteredReports = displayedReports
    .filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.patientName.toLowerCase().includes(q) ||
        r.patientRsId.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'Criticality') {
        const score = { Critical: 1, Unbalanced: 2, Normal: 3 };
        return score[a.status] - score[b.status];
      }
      if (sortBy === 'Patient') {
        return a.patientName.localeCompare(b.patientName);
      }
      return 0; // Default: Latest
    });

  return (
    <div className="min-h-full flex flex-col text-stone-800">
      {/* Top Header - Full Width Edge-to-Edge Toolbar */}
      <header className="w-full h-[62px] bg-white border-b border-stone-200/90 px-6 flex items-center justify-between gap-4 box-border shrink-0 sticky top-0 z-30">
        {/* LEFT: Page Title */}
        <h1 className="text-xl font-bold text-stone-900 tracking-tight">Reports</h1>

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
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-[6px] shadow-lg border border-stone-200 p-4 z-50 text-xs">
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
                        className="w-full text-left p-2.5 bg-red-50 rounded-[4px] text-red-800 hover:bg-red-100 transition-colors"
                      >
                        <span className="font-semibold">Critical:</span> {report.patientName} · {report.name}
                      </button>
                    ))
                  ) : (
                    <div className="p-2.5 bg-stone-50 rounded-[4px] text-stone-600 flex items-center gap-2">
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
            className="h-[36px] px-3.5 bg-[#184E3F] hover:bg-[#133F33] text-white rounded-[6px] text-[13px] font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer box-border"
          >
            <Plus className="w-4 h-4" />
            <span>Add patient</span>
          </button>

          {/* Doctor Profile Chip */}
          <button
            onClick={() => navigate('/doctor/profile')}
            className="h-[36px] flex items-center gap-2 pl-1 pr-1.5 rounded-[6px] hover:bg-stone-50 transition-colors cursor-pointer select-none"
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

      {/* Main Content Layout: 2 Columns */}
      <div className="px-7 lg:px-8 py-5 max-w-[1400px] w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start w-full">
          {/* LEFT COLUMN: Reports Table Card + Pagination */}
          <div className="min-w-0 w-full space-y-3">
            {/* White Card: Search, Sort, and Reports Table */}
            <div className="bg-white border border-stone-200/80 rounded-[8px] shadow-2xs overflow-hidden">
              {/* Top Row: Search Input + Sort Dropdown */}
              <div className="p-3.5 sm:p-4 pb-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                {/* Search Input */}
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search reports by name, patient name or type..."
                    className="w-full h-[36px] bg-white border border-stone-200/90 rounded-[6px] pl-9 pr-3 text-[12px] text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-700 shadow-2xs transition-all"
                  />
                </div>

                {/* Sort Control */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 relative">
                  <button
                    type="button"
                    onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                    className="h-[36px] bg-white border border-stone-200 text-stone-700 px-2.5 rounded-[6px] text-[11.5px] font-medium flex items-center gap-1.5 hover:bg-stone-50 cursor-pointer shadow-2xs transition-colors"
                  >
                    <ArrowUpDown className="w-3 h-3 text-stone-500" />
                    <span>Sort by: {sortBy}</span>
                    <ChevronDown className="w-3 h-3 text-stone-500" />
                  </button>

                  {sortDropdownOpen && (
                    <div className="absolute right-0 top-10 z-20 bg-white border border-stone-200 rounded-[6px] shadow-lg p-1 text-[11px] w-36 space-y-0.5">
                      {(['Latest', 'Criticality', 'Patient'] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setSortBy(opt);
                            setSortDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-[4px] transition-colors ${
                            sortBy === opt
                              ? 'bg-[#184E3F] text-white font-semibold'
                              : 'text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          Sort by: {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Table View using semantic HTML table with fixed column widths */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed min-w-[660px]">
                  <colgroup>
                    <col className="w-[36%]" />
                    <col className="w-[20%]" />
                    <col className="w-[17%]" />
                    <col className="w-[13%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#F8F9FA] border-y border-stone-200/80 text-[9.5px] font-bold tracking-wider text-stone-400 uppercase">
                      <th className="py-2 pl-4 pr-2 font-bold">REPORT NAME</th>
                      <th className="py-2 px-2 font-bold">PATIENT</th>
                      <th className="py-2 px-2 font-bold">UPLOADED ON</th>
                      <th className="py-2 px-2 font-bold">STATUS</th>
                      <th className="py-2 pl-2 pr-4 font-bold text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredReports.map((report) => (
                      <tr
                        key={report.id}
                        className="hover:bg-stone-50/70 transition-colors"
                      >
                        {/* REPORT NAME */}
                        <td className="py-3 pl-4 pr-2 align-middle">
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-[5px] bg-[#E6F5EC] text-[#1E7E49] flex items-center justify-center shrink-0 mt-0.5">
                              <FileText className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 pr-1">
                              <p className="font-bold text-[12px] text-stone-900 leading-snug whitespace-nowrap">
                                {report.name}
                              </p>
                              <p className="text-[10.5px] text-stone-400 mt-0.5 font-normal">
                                {report.category}
                              </p>
                              {report.outsideRangeText && (
                                <p className="text-[10px] text-[#E5484D] flex items-center gap-0.5 mt-0.5 font-medium whitespace-nowrap">
                                  <ArrowUpRight className="w-3 h-3 shrink-0" />
                                  <span>{report.outsideRangeText}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* PATIENT */}
                        <td className="py-3 px-2 align-middle">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#E2EBE6] text-[#2A554A] font-bold text-[11px] flex items-center justify-center shrink-0">
                              {report.patientAvatar}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[12px] text-stone-900 leading-snug whitespace-nowrap">
                                {report.patientName}
                              </p>
                              <p className="text-[10px] text-stone-400 font-mono mt-0.5">
                                {report.patientRsId}
                              </p>
                              <p className="text-[10px] text-stone-400 mt-0.5 whitespace-nowrap">
                                {report.patientGender} · {report.patientAge} years
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* UPLOADED ON */}
                        <td className="py-3 px-2 align-middle whitespace-nowrap">
                          <p className="text-[11px] text-stone-700 font-medium leading-tight">
                            {report.dateStr}
                          </p>
                          <p className="text-[11px] text-stone-700 font-medium leading-tight">
                            {report.timeStr}
                          </p>
                          <p className="text-[10px] text-stone-400 mt-0.5">by Patient</p>
                        </td>

                        {/* STATUS */}
                        <td className="py-3 px-2 align-middle whitespace-nowrap">
                          {report.status === 'Critical' ? (
                            <span className="bg-[#FDECEB] text-[#D83A31] border border-[#FCD5D2] px-2 py-0.5 rounded-full text-[10.5px] font-semibold inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D]" />
                              <span>Critical</span>
                            </span>
                          ) : report.status === 'Unbalanced' ? (
                            <span className="bg-[#FEF5E7] text-[#C27D00] border border-[#FDE5B5] px-2 py-0.5 rounded-full text-[10.5px] font-semibold inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#E5A000]" />
                              <span>Unbalanced</span>
                            </span>
                          ) : (
                            <span className="bg-[#EAF5EF] text-[#1E7E49] border border-[#CDE9D9] px-2 py-0.5 rounded-full text-[10.5px] font-semibold inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#1E7E49]" />
                              <span>Normal</span>
                            </span>
                          )}
                        </td>

                        {/* ACTION */}
                        <td className="py-3 pl-2 pr-4 align-middle text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => navigate(`/doctor/reports/${report.id}`)}
                              className="h-[28px] px-2.5 bg-white border border-stone-200 hover:bg-stone-50 text-[#184E3F] rounded-[5px] text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer whitespace-nowrap inline-flex items-center justify-center"
                            >
                              View File
                            </button>
                            <button
                              aria-label="More options"
                              className="w-6 h-6 text-stone-400 hover:text-stone-600 rounded-[4px] hover:bg-stone-100 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Row */}
            <div className="flex items-center justify-between text-stone-500 pt-1 px-1">
              <span className="text-[11.5px]">
                Showing {filteredReports.length} of {displayedReports.length} reports
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  aria-label="Previous page"
                  disabled
                  className="w-6 h-6 rounded-[5px] border border-stone-200/80 bg-white flex items-center justify-center text-stone-400 hover:text-stone-700 disabled:opacity-40 transition-colors shadow-2xs cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11.5px] font-semibold text-stone-700 px-1.5">1 / 1</span>
                <button
                  aria-label="Next page"
                  disabled
                  className="w-6 h-6 rounded-[5px] border border-stone-200/80 bg-white flex items-center justify-center text-stone-400 hover:text-stone-700 disabled:opacity-40 transition-colors shadow-2xs cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Summary & Critical Alert Monitoring */}
          <div className="w-full space-y-3.5">
            {/* Card 1: Summary */}
            <div className="bg-white border border-stone-200/80 rounded-[8px] p-4 sm:p-4.5 shadow-2xs">
              <h3 className="font-bold text-[15px] text-stone-900 leading-tight">Summary</h3>
              <p className="text-[11px] text-stone-400 mt-0.5">Overview of submitted reports.</p>

              <div className="mt-4 space-y-4">
                {/* Total Reports */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-[5px] bg-[#E6F5EC] text-[#1E7E49] flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-stone-600 block">Total Reports</span>
                    <h4 className="text-[22px] font-extrabold text-stone-900 leading-none mt-1">
                      {totalReportsCount}
                    </h4>
                    <p className="text-[10.5px] text-stone-400 mt-1">All submitted reports</p>
                  </div>
                </div>

                {/* Awaiting Review */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-[5px] bg-[#FEF9EE] text-[#D97706] flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-stone-600 block">Awaiting Review</span>
                    <h4 className="text-[22px] font-extrabold text-stone-900 leading-none mt-1">
                      {awaitingReviewCount}
                    </h4>
                    <p className="text-[10.5px] text-stone-400 mt-1">Reports pending your review</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Critical Alert Monitoring */}
            <div className="bg-white border border-stone-200/80 rounded-[8px] p-4 sm:p-4.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4.5 h-4.5 text-[#1E7E49]" />
                  <h3 className="font-bold text-[14px] sm:text-[14.5px] text-stone-900 leading-tight">
                    Critical Alert Monitoring
                  </h3>
                </div>
                <button
                  aria-label="More options"
                  className="w-5 h-5 text-stone-400 hover:text-stone-600 rounded-[4px] hover:bg-stone-100 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-stone-500 mt-1.5 leading-snug">
                Monitor unacknowledged critical reports from your patients.
              </p>

              {/* Status Box */}
              {unviewedCriticalReports.length > 0 ? (
                <div className="bg-[#FDECEB] rounded-[7px] p-3.5 mt-3 space-y-2 border border-[#FCD5D2]">
                  <div className="flex items-center gap-2 text-[#D83A31]">
                    <div className="w-4.5 h-4.5 rounded-full bg-[#D83A31] text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                      !
                    </div>
                    <h4 className="font-bold text-[13px] text-stone-900">
                      {unviewedCriticalReports.length} Critical Alert{unviewedCriticalReports.length === 1 ? '' : 's'}
                    </h4>
                  </div>
                  <p className="text-[11px] text-stone-700 leading-relaxed">
                    Unacknowledged critical values found. Review immediately.
                  </p>
                  <button
                    onClick={() => navigate(`/doctor/reports/${unviewedCriticalReports[0].id}`)}
                    className="w-full mt-1 h-7 bg-[#D83A31] hover:bg-[#B72C24] text-white rounded-[5px] text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Review Critical Report
                  </button>
                </div>
              ) : (
                <div className="bg-[#EAF5EF] rounded-[7px] p-3.5 mt-3">
                  <div className="flex items-center gap-2 text-[#1E7E49]">
                    <div className="w-4.5 h-4.5 rounded-full bg-[#1E7E49] text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    <h4 className="font-bold text-[13px] text-stone-900">All clear</h4>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1.5 leading-relaxed">
                    No unacknowledged critical reports. All flagged reports have been reviewed or are in progress.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
