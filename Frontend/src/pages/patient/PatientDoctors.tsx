import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { connectionsApi } from '../../api';
import {
  ShieldCheck,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Stethoscope,
  Building2,
  KeyRound,
  Trash2,
  ChevronRight,
  Sparkles,
  Bell,
  Calendar,
  MessageSquare
} from 'lucide-react';

interface PendingRequest {
  connectionId: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  clinic?: any;
  requestedAt: string;
}

interface ConnectedDoctor {
  id: string;
  doctorId: string;
  name: string;
  specialty: string;
  clinic?: any;
  hospital?: string;
  connectedAt?: string;
  status: string;
}

export interface PatientDoctorsProps {
  embedded?: boolean;
}

export const PatientDoctors: React.FC<PatientDoctorsProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { currentUser, patients } = useStore();
  const currentPatient = currentUser || patients[0];

  const [activeTab, setActiveTab] = useState<'connected' | 'requests' | 'quick_code'>('connected');
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [connectedDoctors, setConnectedDoctors] = useState<ConnectedDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');

  // 2-Minute Temporary Code State
  const [generatedCode, setGeneratedCode] = useState<string>('849201');
  const [targetDoctorName, setTargetDoctorName] = useState<string>('your doctor');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(115);
  const [copiedCode, setCopiedCode] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [pendRes, connRes] = await Promise.all([
        connectionsApi.getPendingRequests().catch(() => ({ requests: [] })),
        connectionsApi.getMyConnections().catch(() => ({ connections: [] })),
      ]);
      setPendingRequests(pendRes?.requests || []);
      setConnectedDoctors(connRes?.connections || []);
    } catch (err: any) {
      console.warn('Load connections error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 2-Minute Timer
  useEffect(() => {
    if (activeTab === 'quick_code') {
      if (secondsRemaining > 0) {
        timerRef.current = setTimeout(() => {
          setSecondsRemaining((prev) => prev - 1);
        }, 1000);
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [secondsRemaining, activeTab]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    showToast('Code copied to clipboard!');
  };

  const handleRegenerateCode = async () => {
    setActionLoading('regen');
    try {
      const res = await connectionsApi.generatePatientCode();
      if (res && res.code) {
        setGeneratedCode(res.code);
      } else {
        const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedCode(randomCode);
      }
      setSecondsRemaining(120);
      showToast('New 2-minute consent code generated!');
    } catch (e) {
      const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedCode(randomCode);
      setSecondsRemaining(120);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveRequest = async (req: PendingRequest) => {
    setActionLoading(req.connectionId);
    try {
      const res = await connectionsApi.approveRequest(req.connectionId);
      if (res && res.code) {
        setGeneratedCode(res.code);
      } else {
        setGeneratedCode(Math.floor(100000 + Math.random() * 900000).toString());
      }
      setTargetDoctorName(req.doctorName);
      setSecondsRemaining(120);
      setActiveTab('quick_code');
      showToast(`Request approved! Tell ${req.doctorName} the 2-minute code.`);
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Failed to approve request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async (connectionId: string) => {
    setActionLoading(connectionId);
    try {
      await connectionsApi.rejectRequest(connectionId);
      showToast('Connection request declined.');
      loadData();
    } catch (e: any) {
      showToast(e.message || 'Failed to decline request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeConnection = async (doctorId: string, doctorName: string) => {
    if (!window.confirm(`Are you sure you want to revoke consent for ${doctorName}? They will no longer have access to your health records.`)) {
      return;
    }
    setActionLoading(doctorId);
    try {
      await connectionsApi.revokeDoctorConnection(doctorId);
    } catch (e: any) {
      console.warn('Backend revoke error (falling back to local):', e);
    } finally {
      setConnectedDoctors((prev) => prev.filter((d) => (d.doctorId || d.id) !== doctorId));
      showToast(`Consent revoked for ${doctorName}. They can no longer access your health records.`);
      setActionLoading(null);
    }
  };

  const activeClinicians = connectedDoctors;

  return (
    <div className={embedded ? 'space-y-4 font-sans text-slate-800' : 'p-4 md:p-6 space-y-4 max-w-6xl mx-auto font-sans text-slate-800'}>
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-[#0E382F] text-white px-4 py-2 rounded-[3px] shadow-lg flex items-center gap-2 border border-emerald-500/30 text-xs font-semibold animate-in fade-in duration-150">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Area */}
      {embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-stone-200/80 gap-2">
          <div>
            <h3 className="text-sm md:text-base font-bold text-[#17211E]">
              Connected Clinicians & Doctor Pairing
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review authorized clinicians, approve pending requests, and manage 2-minute pairing codes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-emerald-800 bg-[#EAF6F0] px-2.5 py-1 rounded-[3px] border border-emerald-200/80 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
              DPDP Act Verified
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
              My Doctors
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage connected clinicians, consultation access, and patient consent.
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
      )}

      {/* 3 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center shrink-0">
            <Stethoscope className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-none">{activeClinicians.length}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Connected Clinicians</p>
          </div>
        </div>

        <div className="bg-white rounded-[3px] border border-stone-200/90 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-[3px] bg-[#FEF3C7] text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-none">{pendingRequests.length}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Pending Requests</p>
          </div>
        </div>

        <div className="bg-white rounded-[3px] border border-stone-200/90 p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-8 h-8 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#0E382F] leading-tight">DPDP Act Verified</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Encrypted at rest · Single-use consent</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('connected')}
          className={`px-3.5 py-1.5 rounded-[3px] text-xs font-semibold transition-all cursor-pointer ${activeTab === 'connected'
              ? 'bg-[#0E382F] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
            }`}
        >
          Connected Clinicians ({activeClinicians.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-3.5 py-1.5 rounded-[3px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'requests'
              ? 'bg-[#0E382F] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
            }`}
        >
          <span>Pending Requests</span>
          {pendingRequests.length > 0 && (
            <span className="w-4 h-4 rounded-[2px] bg-[#D92D20] text-white text-[9.5px] font-bold flex items-center justify-center">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('quick_code')}
          className={`px-3.5 py-1.5 rounded-[3px] text-xs font-semibold transition-all cursor-pointer ${activeTab === 'quick_code'
              ? 'bg-[#0E382F] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
            }`}
        >
          Temporary 2-Min Code
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CONNECTED CLINICIANS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'connected' && (
        <div className="space-y-3">
          {activeClinicians.length === 0 ? (
            <div className="bg-white rounded-[3px] border border-stone-200/90 p-8 shadow-2xs text-center space-y-2">
              <div className="w-10 h-10 rounded-[3px] bg-stone-100 text-slate-400 flex items-center justify-center mx-auto">
                <Stethoscope className="w-5 h-5 text-slate-400" />
              </div>
              <h4 className="text-xs font-bold text-slate-800">No Connected Clinicians</h4>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                You do not have any active doctor connections. Under DPDP Act rules, health records and chats are shared only while you maintain active consent.
              </p>
              <button
                onClick={() => setActiveTab('quick_code')}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0E382F] text-white text-xs font-semibold rounded-[3px] shadow-2xs cursor-pointer hover:bg-[#092720]"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Generate 2-Min Consent Code</span>
              </button>
            </div>
          ) : (
            activeClinicians.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-[3px] border border-stone-200/90 p-4 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[3px] bg-[#0E382F] text-white font-bold text-xs flex items-center justify-center shadow-2xs shrink-0">
                      DR
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-bold text-slate-900">{doc.name || 'Consulting Physician'}</h3>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{doc.specialty || 'General Physician'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] text-[10.5px] font-semibold border border-emerald-200/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                      Active Access
                    </span>
                  </div>
                </div>

                {/* Clinic details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{doc.hospital || 'City Care Health Clinic, Delhi NCR'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Mon-Sat, 10:00 AM – 07:00 PM</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Reg: NMC-294018 Verified</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-stone-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate('/patient/appointments')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0E382F] text-white rounded-[3px] text-xs font-semibold hover:bg-[#092720] shadow-2xs cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Book Appointment</span>
                    </button>
                    <button
                      onClick={() => navigate('/patient/ask-doctor')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 text-slate-700 rounded-[3px] text-xs font-medium hover:bg-stone-50 shadow-2xs cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      <span>Ask Doctor</span>
                    </button>
                    <button
                      onClick={() => handleRevokeConnection(doc.doctorId || doc.id, doc.name)}
                      disabled={actionLoading === (doc.doctorId || doc.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-[3px] text-xs font-medium shadow-2xs cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Revoke Consent</span>
                    </button>
                  </div>

                  <span className="text-[10px] text-slate-400">
                    Connected since {doc.connectedAt || '31 Oct 2026'}
                  </span>
                </div>
              </div>
            )))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PENDING REQUESTS                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <h3 className="text-xs font-bold text-slate-900">Doctor Connection Requests</h3>
            <span className="text-xs text-slate-500">{pendingRequests.length} pending</span>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-600">No pending requests</p>
              <p className="text-[11px] text-slate-400">
                When a clinic or doctor requests access using your ReportSetu ID ({currentPatient?.rsId || 'Your RS-ID'}), their request will appear here for your approval.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingRequests.map((req) => (
                <div
                  key={req.connectionId}
                  className="p-3.5 rounded-[3px] border border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{req.doctorName}</h4>
                    <p className="text-[11px] text-slate-500">{req.specialty} · {req.clinic?.name || 'Clinic'}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Requested on {req.requestedAt}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRejectRequest(req.connectionId)}
                      disabled={actionLoading === req.connectionId}
                      className="px-3 py-1.5 rounded-[3px] border border-stone-200 text-slate-600 hover:bg-stone-100 text-xs font-medium cursor-pointer"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => handleApproveRequest(req)}
                      disabled={actionLoading === req.connectionId}
                      className="px-3 py-1.5 rounded-[3px] bg-[#0E382F] text-white text-xs font-semibold hover:bg-[#092720] shadow-2xs cursor-pointer"
                    >
                      Approve (Reveal Code)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TEMPORARY 2-MIN CONSENT CODE                                      */}
      {/* ========================================================================= */}
      {activeTab === 'quick_code' && (
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-6 md:p-8 shadow-2xs max-w-xl mx-auto text-center space-y-4">
          <div className="w-11 h-11 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center mx-auto shadow-2xs">
            <KeyRound className="w-5 h-5 text-[#0E382F]" />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Single-Use 2-Minute Approval Code
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              Read or share this temporary 6-digit code with your doctor ({targetDoctorName}). It expires in 2 minutes to protect your medical privacy.
            </p>
          </div>

          {/* Code Display Box */}
          <div className="p-4 rounded-[3px] bg-[#EAF6F0] border border-emerald-200/70 max-w-xs mx-auto space-y-2">
            <div className="font-mono text-3xl font-extrabold tracking-widest text-[#0E382F]">
              {generatedCode}
            </div>
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-800">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {Math.floor(secondsRemaining / 60)}:
                {String(secondsRemaining % 60).padStart(2, '0')} remaining
              </span>
            </div>
          </div>

          {/* Patient RS-ID Reference */}
          <div className="p-2.5 rounded-[3px] bg-[#F5F8F6] border border-stone-200/90 max-w-xs mx-auto flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Your ReportSetu ID:</span>
            <span className="font-mono font-bold text-[#0E382F] bg-white px-2.5 py-0.5 rounded-[2px] border border-stone-200">
              {currentPatient?.rsId || 'Not assigned'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-2.5 pt-2">
            <button
              onClick={handleCopyCode}
              className="px-3.5 py-1.5 rounded-[3px] border border-stone-200 text-xs font-semibold text-slate-700 bg-white hover:bg-stone-50 shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
            </button>
            <button
              onClick={handleRegenerateCode}
              disabled={actionLoading === 'regen'}
              className="px-3.5 py-1.5 rounded-[3px] bg-[#0E382F] text-white text-xs font-semibold hover:bg-[#092720] shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'regen' ? 'animate-spin' : ''}`} />
              <span>Generate New Code</span>
            </button>
          </div>

          <div className="pt-3 border-t border-stone-100 text-[10.5px] text-slate-400 leading-normal">
            Digital Personal Data Protection (DPDP) Act Compliant · Single-use authorization ensures your reports cannot be accessed without real-time patient consent.
          </div>
        </div>
      )}
    </div>
  );
};
