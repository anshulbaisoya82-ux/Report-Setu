import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { 
  FileText, Check, Clock, AlertTriangle, 
  Search, ChevronDown, Eye, Bell, UploadCloud,
  Printer, ArrowUpRight, Activity, Calendar, ShieldCheck
} from 'lucide-react';

export const PatientMyReports: React.FC = () => {
  const navigate = useNavigate();
  const { reports, currentUser, fetchReports } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'reviewed' | 'pending' | 'critical'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetchReports().finally(() => {
      if (isMounted) setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [fetchReports]);

  const activeReports = useMemo(() => reports || [], [reports]);

  // Compute Categories dynamically from available reports
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    activeReports.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [activeReports]);

  // Filter and sort reports
  const filteredReports = useMemo(() => {
    return activeReports
      .filter((rep) => {
        // Search filter
        const q = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !q ||
          (rep.name || '').toLowerCase().includes(q) ||
          (rep.labName || '').toLowerCase().includes(q) ||
          (rep.category || '').toLowerCase().includes(q) ||
          (rep.parameters && rep.parameters.some((p: any) => (p.name || '').toLowerCase().includes(q)));

        if (!matchesSearch) return false;

        // Category filter
        if (categoryFilter !== 'all' && (rep.category || '').toLowerCase() !== categoryFilter.toLowerCase()) {
          return false;
        }

        // Status filter
        const isCritical =
          rep.status === 'Critical' ||
          (rep.parameters && rep.parameters.some((p: any) => p.status === 'Critical'));

        if (statusFilter === 'reviewed') return !!rep.reviewed;
        if (statusFilter === 'pending') return !rep.reviewed;
        if (statusFilter === 'critical') return isCritical;

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.reportedDate || a.collectionDate || (a as any).createdAt || 0).getTime();
        const dateB = new Date(b.reportedDate || b.collectionDate || (b as any).createdAt || 0).getTime();
        return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
      });
  }, [activeReports, searchTerm, statusFilter, categoryFilter, sortBy]);

  // Statistics
  const totalCount = activeReports.length;
  const verifiedCount = activeReports.filter((r) => r.reviewed).length;
  const underReviewCount = activeReports.filter((r) => !r.reviewed).length;
  const actionRequiredCount = activeReports.filter(
    (r) => r.status === 'Critical' || (r.parameters && r.parameters.some((p: any) => p.status === 'Critical'))
  ).length;

  const formatDateFriendly = (dateStr?: string) => {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    } catch {}
    return dateStr.replace(/T.*$/, '');
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto font-sans text-slate-800">
      {/* =========================================================================
       * 1. Top Header Area
       * ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              My Lab Reports
            </h1>
            <span className="text-[11px] font-mono font-bold bg-[#EAF6F0] text-[#0E382F] px-2 py-0.5 rounded-[3px] border border-emerald-200">
              {totalCount} {totalCount === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            View all uploaded diagnostic tests, verified biomarker findings, and consulting doctor reviews.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/patient/upload"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0E382F] hover:bg-[#092720] text-white text-xs font-semibold rounded-[3px] shadow-2xs transition-colors cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload New Report</span>
          </Link>

          <div className="w-8 h-8 rounded-[3px] bg-[#0E382F] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'P'}
          </div>
        </div>
      </div>

      {/* =========================================================================
       * 2. 4 Stat Summary Cards
       * ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Reports */}
        <div
          onClick={() => setStatusFilter('all')}
          className={`bg-white rounded-[3px] border p-3.5 shadow-2xs flex items-center gap-3 cursor-pointer transition-all ${
            statusFilter === 'all' ? 'border-[#0E382F] ring-1 ring-[#0E382F]/20' : 'border-stone-200/90 hover:border-stone-300'
          }`}
        >
          <div className="w-8 h-8 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-none">{totalCount}</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Total Reports</p>
          </div>
        </div>

        {/* Reviewed by Doctor */}
        <div
          onClick={() => setStatusFilter('reviewed')}
          className={`bg-white rounded-[3px] border p-3.5 shadow-2xs flex items-center gap-3 cursor-pointer transition-all ${
            statusFilter === 'reviewed' ? 'border-emerald-600 ring-1 ring-emerald-600/20' : 'border-stone-200/90 hover:border-stone-300'
          }`}
        >
          <div className="w-8 h-8 rounded-[3px] bg-[#EAF6F0] text-emerald-700 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-none">{verifiedCount}</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Doctor Reviewed</p>
          </div>
        </div>

        {/* Under Review */}
        <div
          onClick={() => setStatusFilter('pending')}
          className={`bg-white rounded-[3px] border p-3.5 shadow-2xs flex items-center gap-3 cursor-pointer transition-all ${
            statusFilter === 'pending' ? 'border-amber-600 ring-1 ring-amber-600/20' : 'border-stone-200/90 hover:border-stone-300'
          }`}
        >
          <div className="w-8 h-8 rounded-[3px] bg-[#FEF3C7] text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-none">{underReviewCount}</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Pending Review</p>
          </div>
        </div>

        {/* Action Required */}
        <div
          onClick={() => setStatusFilter('critical')}
          className={`bg-white rounded-[3px] border p-3.5 shadow-2xs flex items-center gap-3 cursor-pointer transition-all ${
            statusFilter === 'critical' ? 'border-rose-600 ring-1 ring-rose-600/20' : 'border-stone-200/90 hover:border-stone-300'
          }`}
        >
          <div className="w-8 h-8 rounded-[3px] bg-[#FDF2F0] text-[#D92D20] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-none">{actionRequiredCount}</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Abnormal / Critical</p>
          </div>
        </div>
      </div>

      {/* =========================================================================
       * 3. Search and Filter Bar
       * ========================================================================= */}
      <div className="bg-white rounded-[3px] border border-stone-200/90 p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search reports by test name, lab, or biomarker (e.g. CBC, Hemoglobin, Lipid)..."
            className="w-full h-8.5 pl-9 pr-3 rounded-[3px] border border-stone-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0E382F] shadow-2xs"
          />
        </div>

        {/* Filters & Sorter */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter Chips */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-[3px] text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-[2px] font-semibold transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('reviewed')}
              className={`px-2.5 py-1 rounded-[2px] font-semibold transition-all cursor-pointer ${
                statusFilter === 'reviewed' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Reviewed
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2.5 py-1 rounded-[2px] font-semibold transition-all cursor-pointer ${
                statusFilter === 'pending' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter('critical')}
              className={`px-2.5 py-1 rounded-[2px] font-semibold transition-all cursor-pointer ${
                statusFilter === 'critical' ? 'bg-white text-rose-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Critical
            </button>
          </div>

          {/* Category Dropdown */}
          {availableCategories.length > 0 && (
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8.5 px-3 pr-7 rounded-[3px] border border-stone-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#0E382F] appearance-none shadow-2xs cursor-pointer"
              >
                <option value="all">All Categories</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8.5 px-3 pr-7 rounded-[3px] border border-stone-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#0E382F] appearance-none shadow-2xs cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* =========================================================================
       * 4. Reports List & Cards
       * ========================================================================= */}
      {isLoading ? (
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-12 text-center space-y-3 shadow-2xs">
          <div className="w-8 h-8 rounded-full border-2 border-[#0E382F] border-t-transparent animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Retrieving diagnostic records from clinical vault...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-12 text-center space-y-3.5 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-100">
            <FileText className="w-6 h-6 text-[#0E382F]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'No matching reports found'
                : 'No Diagnostic Reports Uploaded Yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try adjusting your search terms or clearing your status and category filters to locate your diagnostic report.'
                : 'Upload your lab test PDFs or photos (such as CBC, Metabolic Panels, or Lipid Profiles) to view parameters, trend analytics, and consulting doctor reviews.'}
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-2.5">
            {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                }}
                className="px-3.5 py-1.5 rounded-[3px] border border-stone-200 text-xs font-semibold text-slate-700 bg-white hover:bg-stone-50 cursor-pointer shadow-2xs"
              >
                Clear All Filters
              </button>
            ) : (
              <Link
                to="/patient/upload"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0E382F] hover:bg-[#092720] text-white text-xs font-semibold rounded-[3px] shadow-2xs transition-colors cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Your First Report</span>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => {
            const isCritical =
              report.status === 'Critical' ||
              (report.parameters && report.parameters.some((p: any) => p.status === 'Critical'));
            const paramCount = (report.parameters || []).length;
            const doctorNote = report.doctorSummary?.text || (report as any).doctorReview?.text;

            return (
              <div
                key={report.id}
                className="bg-white rounded-[3px] border border-stone-200/90 p-4 sm:p-5 shadow-2xs hover:border-emerald-600/40 transition-all flex flex-col justify-between gap-3.5"
              >
                {/* Upper Row: Test Details & Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-[4px] bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center shrink-0 border border-emerald-100">
                      <FileText className="w-5 h-5 text-[#0E382F]" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight">
                          {report.name}
                        </h2>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[2px] bg-slate-100 text-slate-700 uppercase tracking-wider">
                          {report.category || 'Diagnostic'}
                        </span>
                        {paramCount > 0 && (
                          <span className="text-[10.5px] font-medium text-emerald-800 bg-[#EAF6F0] px-2 py-0.5 rounded-[2px]">
                            {paramCount} {paramCount === 1 ? 'parameter' : 'parameters'} analyzed
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-slate-500 font-normal flex-wrap">
                        <span className="font-medium text-slate-700">
                          {report.labName || 'Diagnostic Laboratory'}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Reported: {formatDateFriendly(report.reportedDate || report.collectionDate)}</span>
                        </span>
                        {(report as any).patientRsId && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-[10.5px] text-slate-500">
                              ID: {(report as any).patientRsId}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 self-start">
                    {isCritical ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
                        <AlertTriangle className="w-3 h-3" />
                        Critical Biomarkers
                      </span>
                    ) : report.reviewed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                        <Check className="w-3 h-3 stroke-[3]" />
                        Reviewed by Doctor
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                        <Clock className="w-3 h-3" />
                        Pending Doctor Review
                      </span>
                    )}
                  </div>
                </div>

                {/* Optional Doctor Note Preview */}
                {doctorNote && (
                  <div className="bg-[#FAFBFB] border-l-2 border-emerald-600 p-2.5 rounded-r-[3px] text-xs text-slate-700">
                    <p className="font-semibold text-slate-900 mb-0.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Doctor's Clinical Assessment:</span>
                    </p>
                    <p className="text-slate-600 italic line-clamp-2">"{doctorNote}"</p>
                  </div>
                )}

                {/* Bottom Row: Actions */}
                <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>256-bit AES Clinical Encryption</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] border border-stone-200 text-xs font-medium text-slate-700 bg-white hover:bg-stone-50 cursor-pointer shadow-2xs"
                    >
                      <Printer className="w-3 h-3 text-slate-500" />
                      <span>Print</span>
                    </button>

                    <Link
                      to={`/patient/reports/${report.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[3px] bg-[#0E382F] hover:bg-[#092720] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <span>View Full Report</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
