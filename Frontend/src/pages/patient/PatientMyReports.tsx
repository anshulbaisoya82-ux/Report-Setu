import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { 
  FileText, Check, Clock, AlertTriangle, 
  Search, ChevronDown, Eye, MoreVertical, Bell
} from 'lucide-react';
import { LabReport } from '../../types';

export const PatientMyReports: React.FC = () => {
  const { reports, currentUser, fetchReports } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  // Standard verified default reports matching the exact image
  const defaultReports: LabReport[] = [
    {
      id: 'rep-cbc-1',
      name: 'Complete Blood Count (CBC)',
      category: 'CBC',
      patientId: currentUser?.id || 'p-1',
      patientName: currentUser?.name || 'Rishabh Sharma',
      patientAvatar: 'R',
      labName: 'Labsmart Software',
      collectionDate: '2026-10-31',
      reportedDate: '31 Oct 2026, 10:41 AM',
      status: 'Normal',
      reviewed: true,
      parameters: [
        { id: 'p-1', name: 'Hemoglobin', value: 15.0, unit: 'g/dL', referenceRange: '13.0 - 17.0', status: 'Normal' },
        { id: 'p-2', name: 'Platelet Count', value: 3.5, unit: 'lakhs/cumm', referenceRange: '1.5 - 4.1', status: 'Normal' },
        { id: 'p-3', name: 'Total Leukocyte Count', value: 5100, unit: 'cumm', referenceRange: '4,800 - 10,800', status: 'Normal' },
      ],
      aiOverview: {
        summary: 'CBC readings within normal reference parameters.',
        pointsToConsider: ['Normal baseline'],
        keyFindings: [],
        generatedAt: '31 Oct 2026',
      },
    },
    {
      id: 'rep-cbc-2',
      name: 'Complete Blood Count (CBC)',
      category: 'CBC',
      patientId: currentUser?.id || 'p-1',
      patientName: currentUser?.name || 'Rishabh Sharma',
      patientAvatar: 'R',
      labName: 'Dr Lal PathLabs',
      collectionDate: '2026-10-31',
      reportedDate: '31 Oct 2026',
      status: 'Normal',
      reviewed: true,
      parameters: [
        { id: 'p-1', name: 'Hemoglobin', value: 14.8, unit: 'g/dL', referenceRange: '13.0 - 17.0', status: 'Normal' },
        { id: 'p-2', name: 'Platelet Count', value: 3.4, unit: 'lakhs/cumm', referenceRange: '1.5 - 4.1', status: 'Normal' },
      ],
      aiOverview: {
        summary: 'CBC readings within normal reference parameters.',
        pointsToConsider: ['Normal baseline'],
        keyFindings: [],
        generatedAt: '31 Oct 2026',
      },
    },
    {
      id: 'rep-cbc-3',
      name: 'Complete Blood Count (CBC)',
      category: 'CBC',
      patientId: currentUser?.id || 'p-1',
      patientName: currentUser?.name || 'Rishabh Sharma',
      patientAvatar: 'R',
      labName: 'Adarsh Pathology Center',
      collectionDate: '2026-10-30',
      reportedDate: '30 Oct 2026',
      status: 'Normal',
      reviewed: true,
      parameters: [
        { id: 'p-1', name: 'Hemoglobin', value: 14.5, unit: 'g/dL', referenceRange: '13.0 - 17.0', status: 'Normal' },
        { id: 'p-2', name: 'Platelet Count', value: 1.85, unit: 'lakhs/cumm', referenceRange: '1.5 - 4.1', status: 'Normal' },
      ],
      aiOverview: {
        summary: 'CBC readings within normal reference parameters.',
        pointsToConsider: ['Normal baseline'],
        keyFindings: [],
        generatedAt: '31 Oct 2026',
      },
    },
  ];

  const activeReports = reports.length > 0 ? reports : defaultReports;

  const filteredReports = activeReports.filter((rep) => {
    const q = searchTerm.toLowerCase();
    return (
      rep.name.toLowerCase().includes(q) ||
      rep.labName.toLowerCase().includes(q) ||
      rep.category.toLowerCase().includes(q)
    );
  });

  const totalCount = activeReports.length;
  const verifiedCount = activeReports.filter((r) => r.reviewed || r.status === 'Normal').length;
  const underReviewCount = activeReports.filter((r) => !r.reviewed && r.status === 'Normal').length;
  const actionRequiredCount = activeReports.filter((r) => r.status === 'Critical' || r.status === 'Unbalanced').length;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            My Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View and manage all your lab reports in one place.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="relative p-1.5 rounded-[3px] border border-stone-200 text-slate-600 bg-white hover:bg-stone-50 cursor-pointer shadow-2xs">
            <Bell className="w-3.5 h-3.5" />
            <span className="w-2 h-2 rounded-full bg-[#10B981] absolute top-1 right-1" />
          </button>
          <div className="w-7 h-7 rounded-[3px] bg-[#0E382F] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'R'}
          </div>
        </div>
      </div>

      {/* 4 Stat Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Reports */}
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-none">{totalCount}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Total Reports</p>
          </div>
        </div>

        {/* Verified */}
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-none">{verifiedCount}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Verified</p>
          </div>
        </div>

        {/* Under Review */}
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-[3px] bg-[#FEF3C7] text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-none">{underReviewCount}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Under Review</p>
          </div>
        </div>

        {/* Action Required */}
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-[3px] bg-[#FDF2F0] text-[#D92D20] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-none">{actionRequiredCount}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Action Required</p>
          </div>
        </div>
      </div>

      {/* Search and Sort Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search reports (e.g. CBC, Lipid)..."
            className="w-full h-8.5 pl-9 pr-3 rounded-[3px] border border-stone-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0E382F] shadow-2xs"
          />
        </div>

        <div className="relative shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-8.5 px-3 pr-8 rounded-[3px] border border-stone-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#0E382F] appearance-none shadow-2xs cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-[3px] border border-stone-200/90 shadow-2xs divide-y divide-stone-100">
        {filteredReports.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No lab reports found matching "{searchTerm}".
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              className="p-3.5 flex items-center justify-between gap-3 hover:bg-stone-50/60 transition-colors relative"
            >
              {/* Left: Icon & Details */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-8 h-8 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 truncate tracking-tight">
                    {report.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {report.labName} <span className="mx-1">·</span> {report.reportedDate || report.collectionDate}
                  </p>
                </div>
              </div>

              {/* Right: Status, View Button & Options */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] text-[10.5px] font-semibold border border-emerald-200/50">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                  Checked by doctor
                </span>

                <Link
                  to={`/patient/reports/${report.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-stone-200 rounded-[3px] text-xs font-medium text-slate-700 hover:bg-stone-50 shadow-2xs transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>View Report</span>
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setActiveMenuId(activeMenuId === report.id ? null : report.id)}
                    className="p-1 rounded-[2px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {activeMenuId === report.id && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-stone-200 rounded-[3px] shadow-lg py-1 z-20 text-xs">
                      <Link
                        to={`/patient/reports/${report.id}`}
                        className="block px-3 py-1.5 hover:bg-stone-50 text-slate-700"
                        onClick={() => setActiveMenuId(null)}
                      >
                        Details
                      </Link>
                      <button
                        onClick={() => {
                          window.print();
                          setActiveMenuId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-stone-50 text-slate-700"
                      >
                        Print / PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
