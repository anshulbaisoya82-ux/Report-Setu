import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminApi, authApi, setAccessToken, setStoredUser, setStoredRole } from '../../api';
import { useStore } from '../../store/useStore';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Building2,
  Stethoscope,
  Mail,
  Phone,
  FileBadge,
  ArrowRight,
  ExternalLink,
  Users,
  FileText,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Check,
  Copy,
} from 'lucide-react';

interface DoctorItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  registrationNumber: string;
  medicalCouncil: string;
  specialty: string;
  clinic: any;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    phone: string;
    isVerified: boolean;
    createdAt: string;
  };
}

interface AdminStats {
  totalDoctors: number;
  pendingDoctors: number;
  verifiedDoctors: number;
  rejectedDoctors: number;
  totalPatients: number;
  totalReports: number;
}

export const AdminPortal: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, setRole, setCurrentUser } = useStore();

  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalDoctors: 0,
    pendingDoctors: 0,
    verifiedDoctors: 0,
    rejectedDoctors: 0,
    totalPatients: 0,
    totalReports: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [statsData, docsData] = await Promise.all([
        adminApi.getStats().catch(() => ({
          totalDoctors: 0,
          pendingDoctors: 0,
          verifiedDoctors: 0,
          rejectedDoctors: 0,
          totalPatients: 0,
          totalReports: 0,
        })),
        adminApi.getDoctors({
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: searchTerm.trim() || undefined,
        }),
      ]);

      if (statsData) setStats(statsData);
      if (docsData && Array.isArray(docsData.doctors)) {
        setDoctors(docsData.doctors);
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to load administrator data' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleVerify = async (doctorId: string, doctorName: string) => {
    try {
      setIsActionLoading(doctorId);
      setFeedbackMessage(null);
      await adminApi.verifyDoctor(doctorId);
      setFeedbackMessage({
        type: 'success',
        text: `Dr. ${doctorName} has been officially verified! They can now link and connect with patients.`,
      });
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to verify doctor' });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleReject = async (doctorId: string, doctorName: string) => {
    const reason = window.prompt(
      `Enter rejection reason for Dr. ${doctorName} (e.g. Invalid registration number):`,
      'Registration number could not be validated with state medical council registry'
    );
    if (reason === null) return;

    try {
      setIsActionLoading(doctorId);
      setFeedbackMessage(null);
      await adminApi.rejectDoctor(doctorId, reason);
      setFeedbackMessage({
        type: 'success',
        text: `Dr. ${doctorName}'s verification application was marked as rejected.`,
      });
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to reject doctor' });
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleVerifyAll = async () => {
    if (!window.confirm(`Are you sure you want to approve all ${stats.pendingDoctors} pending doctor application(s)?`)) {
      return;
    }

    try {
      setIsActionLoading('all');
      setFeedbackMessage(null);
      const res = await adminApi.verifyAllDoctors();
      setFeedbackMessage({
        type: 'success',
        text: res.message || `Successfully approved all pending doctors.`,
      });
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to batch verify doctors' });
    } finally {
      setIsActionLoading(null);
    }
  };

  const copyRegNumber = (reg: string, id: string) => {
    navigator.clipboard.writeText(reg);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredDoctors = doctors.filter((doc) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      doc.name?.toLowerCase().includes(q) ||
      doc.email?.toLowerCase().includes(q) ||
      doc.registrationNumber?.toLowerCase().includes(q) ||
      doc.specialty?.toLowerCase().includes(q) ||
      doc.medicalCouncil?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-24">
      {/* Top Admin Header */}
      <header className="bg-[#172B25] text-white border-b border-[#25463B] sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-stone-900 font-bold shadow-lg shadow-amber-500/20">
              <ShieldCheck className="w-6 h-6 text-stone-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">ReportSetu Admin</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
                  Council Triage
                </span>
              </div>
              <p className="text-xs text-stone-400">Medical Practitioner Verification & Regulatory Oversight</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/doctor"
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all flex items-center gap-1.5 border border-white/10"
            >
              <Stethoscope className="w-3.5 h-3.5 text-teal-300" />
              <span>Doctor Portal</span>
            </Link>
            <Link
              to="/patient"
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-all flex items-center gap-1.5 border border-white/10"
            >
              <Users className="w-3.5 h-3.5 text-blue-300" />
              <span>Patient Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`p-4 rounded-2xl text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-xs'
                : 'bg-rose-50 text-rose-900 border border-rose-200 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-stone-400 hover:text-stone-700 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Hero KPI Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Pending Reviews */}
          <div
            onClick={() => setStatusFilter('pending')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
              statusFilter === 'pending'
                ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-400/20 shadow-sm'
                : 'bg-white border-stone-200/80 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Awaiting Verification</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <div className="text-2xl font-black text-amber-600 tracking-tight">{stats.pendingDoctors}</div>
            <span className="text-[11px] text-stone-400 mt-1 block">Doctors awaiting review</span>
          </div>

          {/* Verified Doctors */}
          <div
            onClick={() => setStatusFilter('verified')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === 'verified'
                ? 'bg-emerald-500/10 border-emerald-400 ring-2 ring-emerald-400/20 shadow-sm'
                : 'bg-white border-stone-200/80 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Verified Doctors</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 tracking-tight">{stats.verifiedDoctors}</div>
            <span className="text-[11px] text-stone-400 mt-1 block">Active clinical access</span>
          </div>

          {/* Rejected */}
          <div
            onClick={() => setStatusFilter('rejected')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === 'rejected'
                ? 'bg-rose-500/10 border-rose-400 ring-2 ring-rose-400/20 shadow-sm'
                : 'bg-white border-stone-200/80 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Rejected</span>
              <XCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-600 tracking-tight">{stats.rejectedDoctors}</div>
            <span className="text-[11px] text-stone-400 mt-1 block">Failed council validation</span>
          </div>

          {/* Total Registered Doctors */}
          <div
            onClick={() => setStatusFilter('all')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#1E3F35]/10 border-[#1E3F35] ring-2 ring-[#1E3F35]/20 shadow-sm'
                : 'bg-white border-stone-200/80 hover:border-stone-400'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Total Doctors</span>
              <Stethoscope className="w-4 h-4 text-[#1E3F35]" />
            </div>
            <div className="text-2xl font-black text-stone-800 tracking-tight">{stats.totalDoctors}</div>
            <span className="text-[11px] text-stone-400 mt-1 block">All registered practitioners</span>
          </div>

          {/* Total Patients */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Total Patients</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-blue-700 tracking-tight">{stats.totalPatients}</div>
            <span className="text-[11px] text-stone-400 mt-1 block">Protected by consent</span>
          </div>

          {/* Total Reports */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Lab Reports</span>
              <FileText className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-indigo-700 tracking-tight">{stats.totalReports}</div>
            <span className="text-[11px] text-stone-400 mt-1 block">Encrypted health records</span>
          </div>
        </div>

        {/* Action Controls & Search Bar */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-stone-200/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-100/80 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'all' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              All ({stats.totalDoctors})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-700 hover:bg-amber-100/60'
              }`}
            >
              <span>Pending Review</span>
              {stats.pendingDoctors > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-amber-700 font-extrabold">
                  {stats.pendingDoctors}
                </span>
              )}
            </button>
            <button
              onClick={() => setStatusFilter('verified')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'verified'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Verified ({stats.verifiedDoctors})
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === 'rejected'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              Rejected ({stats.rejectedDoctors})
            </button>
          </div>

          {/* Search + Batch Button */}
          <div className="flex items-center gap-2.5">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search name, council, reg #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] transition-all"
              />
            </form>

            <button
              onClick={loadData}
              title="Refresh Queue"
              className="p-2 rounded-2xl border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#1E3F35]' : ''}`} />
            </button>

            {stats.pendingDoctors > 0 && (
              <button
                onClick={handleVerifyAll}
                disabled={isActionLoading === 'all'}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{isActionLoading === 'all' ? 'Verifying...' : `Approve All (${stats.pendingDoctors})`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Doctors List / Table */}
        <div className="bg-white rounded-3xl border border-stone-200/80 shadow-card overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#172B25]">Registered Medical Practitioners</h2>
              <p className="text-xs text-stone-500">
                Review credential authenticity against State Medical Councils (e.g. DMC, MMC, MCI)
              </p>
            </div>
            <span className="text-xs font-medium text-stone-400">
              Showing {filteredDoctors.length} {filteredDoctors.length === 1 ? 'practitioner' : 'practitioners'}
            </span>
          </div>

          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-400">
              <RefreshCw className="w-6 h-6 animate-spin text-[#1E3F35]" />
              <span className="text-xs font-medium">Fetching doctor verification registry...</span>
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <ShieldCheck className="w-10 h-10 text-stone-300 mx-auto" />
              <h3 className="text-sm font-bold text-stone-700">No doctors match this filter</h3>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">
                No practitioner profiles found under status "{statusFilter}". Change your filter or search query.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {filteredDoctors.map((doc) => {
                const isPending = doc.verificationStatus === 'pending';
                const isVerified = doc.verificationStatus === 'verified';
                const isRejected = doc.verificationStatus === 'rejected';
                const isCurrentLoggedIn = currentUser?.email === doc.email || currentUser?.id === doc.userId;

                return (
                  <div
                    key={doc.id}
                    className={`p-4 sm:p-6 transition-colors hover:bg-stone-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-6 ${
                      isCurrentLoggedIn ? 'bg-amber-500/5 border-l-4 border-l-amber-500' : ''
                    }`}
                  >
                    {/* Left: Doctor Details */}
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-[#1E3F35] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                          {doc.name?.replace('Dr. ', '').charAt(0) || 'D'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-[#172B25]">{doc.name}</h3>
                            {isCurrentLoggedIn && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold border border-amber-200">
                                Currently Logged In
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#1E3F35] font-semibold flex items-center gap-1.5">
                            <Stethoscope className="w-3 h-3 text-[#1E3F35]" />
                            <span>{doc.specialty || 'General Physician'}</span>
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div className="ml-auto lg:ml-2">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                              <Clock className="w-3.5 h-3.5 text-amber-700" />
                              <span>Pending Verification</span>
                            </span>
                          )}
                          {isVerified && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Verified Practitioner</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Rejected</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Credentials Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-stone-600 pt-1">
                        {/* Council & Reg Number */}
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-100/70 border border-stone-200/60">
                          <FileBadge className="w-4 h-4 text-stone-500 flex-shrink-0" />
                          <div className="truncate">
                            <span className="text-[10px] font-bold uppercase text-stone-400 block">Registration #</span>
                            <span className="font-mono font-bold text-stone-800">{doc.registrationNumber || 'Pending'}</span>
                          </div>
                          {doc.registrationNumber && (
                            <button
                              onClick={() => copyRegNumber(doc.registrationNumber, doc.id)}
                              className="ml-auto text-stone-400 hover:text-stone-700 p-1"
                              title="Copy Registration Number"
                            >
                              {copiedId === doc.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Medical Council */}
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-100/70 border border-stone-200/60">
                          <Building2 className="w-4 h-4 text-stone-500 flex-shrink-0" />
                          <div className="truncate">
                            <span className="text-[10px] font-bold uppercase text-stone-400 block">Medical Council</span>
                            <span className="font-semibold text-stone-800 truncate block">
                              {doc.medicalCouncil || 'State Medical Council'}
                            </span>
                          </div>
                        </div>

                        {/* Clinic & Location */}
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-stone-100/70 border border-stone-200/60">
                          <Building2 className="w-4 h-4 text-stone-500 flex-shrink-0" />
                          <div className="truncate">
                            <span className="text-[10px] font-bold uppercase text-stone-400 block">Clinic Practice</span>
                            <span className="font-semibold text-stone-800 truncate block">
                              {doc.clinic?.name || 'Private Clinic'} • {doc.clinic?.city || 'Delhi NCR'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Contact row */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-stone-400" />
                          <span>{doc.email}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{doc.phone}</span>
                        </span>
                        <span className="text-[11px] text-stone-400">
                          Submitted on {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {doc.rejectionReason && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                          <span>
                            <strong>Rejection Note:</strong> {doc.rejectionReason}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 lg:self-center">
                      {isPending && (
                        <>
                          <button
                            onClick={() => handleVerify(doc.id, doc.name)}
                            disabled={isActionLoading === doc.id}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#1E3F35] hover:bg-[#172B25] text-white text-xs font-bold shadow-md shadow-[#1E3F35]/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>{isActionLoading === doc.id ? 'Approving...' : 'Approve Doctor'}</span>
                          </button>

                          <button
                            onClick={() => handleReject(doc.id, doc.name)}
                            disabled={isActionLoading === doc.id}
                            className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4 text-rose-500" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}

                      {isVerified && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Active in Clinic Network</span>
                          </span>
                        </div>
                      )}

                      {isRejected && (
                        <button
                          onClick={() => handleVerify(doc.id, doc.name)}
                          disabled={isActionLoading === doc.id}
                          className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-all"
                        >
                          Re-evaluate & Approve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
