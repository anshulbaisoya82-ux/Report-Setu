import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  Bell,
  FileText,
  ChevronDown,
  Eye,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CheckCircle2,
  Check,
} from 'lucide-react';

interface ReportDisplayItem {
  id: string;
  name: string;
  uploadTime: string;
  patientName: string;
  patientAvatar: string;
  patientRsId: string;
  status: 'Critical' | 'Unbalanced' | 'Normal';
  reviewed: boolean;
  reviewStatus?: 'pending' | 'in_review' | 'approved';
  doctorViewed?: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
}

export const DoctorReports: React.FC = () => {
  const navigate = useNavigate();
  const { reports, fetchReports } = useStore();
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');
  const [sortBy, setSortBy] = useState<'Criticality' | 'Date' | 'Patient'>('Criticality');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  React.useEffect(() => {
    fetchReports();
  }, []);

  const displayReports: ReportDisplayItem[] = reports.map((r: any) => ({
    id: r.id || r._id,
    name: r.name || 'Lab Report',
    uploadTime: `Uploaded ${r.reportedDate || r.collectionDate || 'recently'} · ${r.labName || 'Diagnostic Lab'}`,
    patientName: r.patientName || 'Patient',
    patientAvatar: r.patientAvatar || (r.patientName ? r.patientName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'PT'),
    patientRsId: r.patientRsId || '',
    status: (r.status as any) || 'Normal',
    reviewed: Boolean(r.reviewed || r.reviewStatus === 'approved'),
    reviewStatus: r.reviewStatus,
    doctorViewed: Boolean(r.doctorViewed || r.reviewStatus === 'in_review' || r.reviewStatus === 'approved' || r.reviewed),
    reviewedAt: r.reviewedAt || r.doctorSummary?.approvedAt,
    reviewedBy: r.reviewedBy || r.doctorSummary?.doctorName,
  }));

  const reviewedCount = displayReports.filter((report) => report.reviewed).length;
  const pendingCount = displayReports.filter((report) => !report.reviewed).length;
  const reviewedPercent = displayReports.length === 0 ? 0 : Math.round((reviewedCount / displayReports.length) * 100);

  // Critical reports that require urgent attention: Critical severity, unapproved, and NOT YET VIEWED by doctor
  const unviewedCriticalReports = displayReports.filter(
    (report) => report.status === 'Critical' && !report.reviewed && !report.doctorViewed
  ).slice(0, 3);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Filter based on active tab: Awaiting Review vs Reviewed & Approved
  const tabReports = displayReports.filter((r) => {
    if (activeTab === 'pending') {
      return !r.reviewed;
    }
    return r.reviewed;
  });

  // Sorting
  const sortedReports = [...tabReports].sort((a, b) => {
    if (sortBy === 'Criticality') {
      const rank = { Critical: 1, Unbalanced: 2, Normal: 3 };
      return rank[a.status] - rank[b.status];
    }
    if (sortBy === 'Patient') {
      return a.patientName.localeCompare(b.patientName);
    }
    return 0; // default order is date descending
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#172B25] tracking-tight">Reports</h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            {today} · {pendingCount} report{pendingCount === 1 ? '' : 's'} waiting for your review
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-600 shadow-sm cursor-pointer hover:bg-stone-50 transition-colors">
            <Bell className="w-4 h-4" />
          </div>
          <div className="w-10 h-10 rounded-full bg-[#1E3F35] text-white flex items-center justify-center font-semibold text-xs shadow-sm">
            PM
          </div>
        </div>
      </div>

      {/* Two Top Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Card: Reports overview (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 shadow-2xs border border-stone-200/60 flex flex-col justify-between">
          <h3 className="font-bold text-base text-[#172B25] font-serif">Reports overview</h3>

          <div className="flex items-center gap-6 my-auto pt-4 pb-2">
            {/* SVG Donut Chart (85% reviewed) */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle (15% Awaiting review segment) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  stroke="#FCECE9"
                  strokeWidth="11"
                  fill="transparent"
                />
                {/* Reviewed segment (85% of perimeter 238.7 = ~203) */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  stroke="#1E3F35"
                  strokeWidth="11"
                  strokeDasharray={`${reviewedPercent * 2.39} 239`}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-[#172B25] leading-none">{reviewedPercent}%</span>
                <span className="text-[10px] text-stone-400 font-medium mt-1">reviewed</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs text-stone-400 font-medium block">Total reports</span>
                <p className="text-3xl font-extrabold text-[#172B25] font-serif leading-tight mt-0.5">{reports.length}</p>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1E3F35]" />
                  <span className="text-stone-600 text-xs">Reviewed <strong>{reviewedCount}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#A82B1E]" />
                  <span className="text-stone-600 text-xs">Awaiting review <strong>{pendingCount}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Needs urgent review or All Acknowledged (7 cols) */}
        {unviewedCriticalReports.length > 0 ? (
          <div className="lg:col-span-7 bg-[#FDF1EF] rounded-3xl p-6 sm:p-7 border border-[#FADCD7] flex flex-col justify-between space-y-3.5 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#A82B1E] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <AlertTriangle className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-[#9C2A1E] font-serif">Needs urgent review</h3>
                <p className="text-xs text-[#A84439]">{unviewedCriticalReports.length} unviewed critical report{unviewedCriticalReports.length === 1 ? '' : 's'}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {unviewedCriticalReports.map((report, index) => (
                <div key={report.id} className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-2xs border border-stone-100/80">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#FCECE9] text-[#A82B1E] font-bold text-xs flex items-center justify-center flex-shrink-0">{index + 1}</span>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-[#172B25]">{report.name}</h4>
                      <p className="text-[11px] text-stone-400">{report.patientName}{report.patientRsId ? ` · ${report.patientRsId}` : ''}</p>
                    </div>
                  </div>
                  <button onClick={() => navigate(`/doctor/reports/${report.id}`)} className="bg-[#A82B1E] hover:bg-[#8F2317] text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-all shadow-2xs active:scale-95">Review now</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-7 bg-[#EBF5F0] rounded-3xl p-6 sm:p-7 border border-[#CDE5D8] flex flex-col justify-between space-y-3.5 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#2E9E6B] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-[#1E3F35] font-serif">All critical alerts acknowledged</h3>
                <p className="text-xs text-[#2B5246]">No unviewed critical reports. All alerts have been reviewed or are in progress.</p>
              </div>
            </div>

            <div className="bg-white/90 rounded-2xl p-4 border border-[#D5EADF] text-xs text-stone-600 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#172B25]">Urgent Alert Status: Clear</p>
                <p className="text-[11px] text-stone-500 mt-0.5">{pendingCount} report{pendingCount === 1 ? '' : 's'} in standard review queue</p>
              </div>
              <span className="text-xs font-bold text-[#2E9E6B] bg-[#E4EDE8] px-3 py-1 rounded-full flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Acknowledged</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Review Category Tabs & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'pending'
                ? 'bg-[#1E3F35] text-white shadow-sm'
                : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200/80 hover:bg-stone-50'
            }`}
          >
            <span>Awaiting review</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-700'
              }`}
            >
              {pendingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reviewed')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              activeTab === 'reviewed'
                ? 'bg-[#1E3F35] text-white shadow-sm'
                : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200/80 hover:bg-stone-50'
            }`}
          >
            <span>Reviewed & approved</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                activeTab === 'reviewed' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-700'
              }`}
            >
              {reviewedCount}
            </span>
          </button>
        </div>

        {/* Sort Filter Dropdown */}
        <div className="flex items-center justify-start relative">
          <button
            type="button"
            onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
            className="flex items-center gap-2 bg-white border border-stone-200 text-stone-700 text-xs font-semibold py-2 px-4 rounded-full shadow-2xs hover:bg-stone-50 cursor-pointer transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-stone-500" />
            <span>Sort by: {sortBy}</span>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 ml-1" />
          </button>

          {sortDropdownOpen && (
            <div className="absolute right-0 top-11 z-20 bg-white border border-stone-200 rounded-xl shadow-lg p-1.5 text-xs w-44 space-y-1">
              {(['Criticality', 'Date', 'Patient'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setSortBy(opt);
                    setSortDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 rounded-lg transition-colors ${
                    sortBy === opt ? 'bg-[#1E3F35] text-white font-semibold' : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  Sort by: {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-12 px-6 py-1 text-xs font-semibold text-stone-500">
        <div className="col-span-12 sm:col-span-5">Report name</div>
        <div className="hidden sm:block sm:col-span-4">Patient name</div>
        <div className="hidden sm:block sm:col-span-2">Status</div>
        <div className="hidden sm:block sm:col-span-1 text-right">Action</div>
      </div>

      {/* Empty State */}
      {sortedReports.length === 0 && (
        <div className="bg-white rounded-3xl p-10 text-center border border-stone-200/60 shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
            {activeTab === 'pending' ? <CheckCircle2 className="w-6 h-6 text-[#2E9E6B]" /> : <FileText className="w-6 h-6" />}
          </div>
          <h3 className="font-bold text-stone-800 text-base">
            {activeTab === 'pending'
              ? 'No reports awaiting review'
              : 'No reviewed reports yet'}
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {activeTab === 'pending'
              ? 'All lab reports from your connected patients have been reviewed and approved.'
              : 'Once you review and approve a lab report, it will appear here.'}
          </p>
        </div>
      )}

      {/* Floating Report Cards */}
      <div className="space-y-3">
        {sortedReports.map((report) => {
          const isCritical = report.status === 'Critical';
          const isUnbalanced = report.status === 'Unbalanced';

          return (
            <div
              key={report.id}
              onClick={() => navigate(`/doctor/reports/${report.id}`)}
              className="bg-white rounded-2xl px-6 py-4 shadow-2xs hover:shadow-xs border border-stone-200/50 grid grid-cols-12 items-center gap-3 transition-all cursor-pointer group"
            >
              {/* Report Name & Lab */}
              <div className="col-span-12 sm:col-span-5 flex items-center gap-3.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isCritical
                      ? 'bg-[#FCECE9] text-[#A82B1E]'
                      : isUnbalanced
                      ? 'bg-[#FEF5DF] text-[#8C6200]'
                      : 'bg-[#E4EDE8] text-[#1E3F35]'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-[#172B25] group-hover:text-[#1E3F35] transition-colors">
                      {report.name}
                    </h4>
                    {report.reviewed ? (
                      <span className="text-[10px] font-bold text-[#2E9E6B] bg-[#E4EDE8] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Approved & sent</span>
                      </span>
                    ) : report.doctorViewed ? (
                      <span className="text-[10px] font-semibold text-[#1E3F35] bg-[#E4EDE8]/80 px-2 py-0.5 rounded-full">
                        In review
                      </span>
                    ) : isCritical ? (
                      <span className="text-[10px] font-bold text-[#B53629] bg-[#FDF2F0] px-2 py-0.5 rounded-full animate-pulse">
                        New alert
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">{report.uploadTime}</p>
                </div>
              </div>

              {/* Patient Name & Avatar */}
              <div className="col-span-12 sm:col-span-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#DCE8E2] text-[#1E3F35] font-bold text-xs flex items-center justify-center shrink-0">
                  {report.patientAvatar}
                </div>
                <div>
                  <span className="font-semibold text-stone-800 text-xs sm:text-sm block">
                    {report.patientName}
                  </span>
                  <span className="text-xs text-stone-400 font-mono">
                    RS ID: {report.patientRsId}
                  </span>
                </div>
              </div>

              {/* State Pill */}
              <div className="col-span-6 sm:col-span-2">
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full inline-block ${
                    isCritical
                      ? 'bg-[#FCECE9] text-[#A82B1E]'
                      : isUnbalanced
                      ? 'bg-[#FEF5DF] text-[#8C6200]'
                      : 'bg-[#E4EDE8] text-[#2B5246]'
                  }`}
                >
                  {report.status}
                </span>
              </div>

              {/* View / Review Button */}
              <div className="col-span-6 sm:col-span-1 text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/doctor/reports/${report.id}`);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-2xs ${
                    report.reviewed
                      ? 'border border-stone-200 text-stone-700 hover:bg-stone-50'
                      : isCritical && !report.doctorViewed
                      ? 'bg-[#A82B1E] text-white hover:bg-[#8F2317]'
                      : 'bg-[#1E3F35] text-white hover:bg-[#163028]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{report.reviewed ? 'View' : 'Review'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between text-xs text-stone-400 pt-3 px-1">
        <span>Showing {sortedReports.length > 0 ? 1 : 0}–{sortedReports.length} of {sortedReports.length} reports</span>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-400 hover:text-stone-700 shadow-2xs">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-stone-700 text-xs px-1">1 / 1</span>
          <button className="w-8 h-8 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-700 hover:text-stone-900 shadow-2xs">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
