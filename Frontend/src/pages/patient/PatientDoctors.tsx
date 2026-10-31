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
  ArrowLeft,
  Stethoscope,
  Building2,
  KeyRound,
  Trash2,
  ChevronRight,
  Sparkles,
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

export const PatientDoctors: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, patients } = useStore();
  const currentPatient = currentUser || patients[0];

  // Screen modes: 'main' (tabs: requests & connected) or 'code_screen' (dedicated 2-min code view)
  const [screenMode, setScreenMode] = useState<'main' | 'code_screen'>('main');
  const [activeTab, setActiveTab] = useState<'requests' | 'connected' | 'quick_code'>('requests');

  // Requests and connections state
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [connectedDoctors, setConnectedDoctors] = useState<ConnectedDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');

  // Active Code Screen state (2-minute temporary code)
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [targetDoctorName, setTargetDoctorName] = useState<string>('');
  const [targetConnectionId, setTargetConnectionId] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSuccessConnected, setIsSuccessConnected] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

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

  // ─── 2-Minute Countdown Timer ─────────────────────────────────────────────
  useEffect(() => {
    if (screenMode === 'code_screen' && !isSuccessConnected) {
      if (secondsRemaining > 0) {
        timerRef.current = setTimeout(() => {
          setSecondsRemaining((prev) => prev - 1);
        }, 1000);
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [screenMode, secondsRemaining, isSuccessConnected]);

  // ─── Poll for connection completion while on code screen ──────────────────
  useEffect(() => {
    if (screenMode === 'code_screen' && !isSuccessConnected && secondsRemaining > 0) {
      pollRef.current = setInterval(async () => {
        try {
          const res = await connectionsApi.getMyConnections();
          const activeList = res?.connections || [];
          // If a new connection appears or doctor matches
          const match = activeList.find(
            (c: any) =>
              c.name === targetDoctorName ||
              c.doctorId === targetConnectionId ||
              c.id === targetConnectionId
          );
          if (match || (activeList.length > connectedDoctors.length && connectedDoctors.length >= 0)) {
            setIsSuccessConnected(true);
            setConnectedDoctors(activeList);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {
          // ignore polling error
        }
      }, 2500);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [screenMode, isSuccessConnected, secondsRemaining, targetDoctorName, targetConnectionId, connectedDoctors]);

  // ─── Action: Patient Approves Request ─────────────────────────────────────
  const handleApprove = async (req: PendingRequest) => {
    try {
      setActionLoading(req.connectionId);
      const res = await connectionsApi.approveRequest(req.connectionId);
      if (res?.code) {
        setGeneratedCode(res.code);
        setTargetDoctorName(req.doctorName);
        setTargetConnectionId(req.connectionId);

        // Calculate timer (valid 2 mins = 120s)
        const expTime = res.expiresAt ? new Date(res.expiresAt).getTime() : Date.now() + 120000;
        const diff = Math.max(10, Math.min(120, Math.floor((expTime - Date.now()) / 1000)));
        setSecondsRemaining(diff > 0 ? diff : 120);

        setIsSuccessConnected(false);
        // Switch to the dedicated code screen!
        setScreenMode('code_screen');
        showToast('Request approved! Tell the 2-minute code to your doctor.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to approve connection request.');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Action: Patient Rejects Request ──────────────────────────────────────
  const handleReject = async (connectionId: string, doctorName: string) => {
    if (!window.confirm(`Decline connection request from ${doctorName}?`)) return;
    try {
      setActionLoading(connectionId);
      await connectionsApi.rejectRequest(connectionId);
      setPendingRequests((prev) => prev.filter((r) => r.connectionId !== connectionId));
      showToast(`Declined request from ${doctorName}.`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to reject request.');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Action: Revoke Connected Doctor ──────────────────────────────────────
  const handleRevoke = async (doctorId: string, doctorName: string) => {
    if (!window.confirm(`Revoke medical record access for ${doctorName}? They will no longer be able to see your lab reports.`)) {
      return;
    }
    try {
      await connectionsApi.revokeDoctorConnection(doctorId);
      setConnectedDoctors((prev) => prev.filter((d) => d.doctorId !== doctorId && d.id !== doctorId));
      showToast(`Revoked access for ${doctorName}.`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to revoke access.');
    }
  };

  // ─── Action: Generate In-Clinic Quick Code ────────────────────────────────
  const handleGenerateQuickCode = async () => {
    try {
      setActionLoading('quick');
      const res = await connectionsApi.generatePatientCode();
      if (res?.code) {
        setGeneratedCode(res.code);
        setTargetDoctorName('In-Clinic Doctor / Receptionist');
        setTargetConnectionId('');
        const expTime = res.expiresAt ? new Date(res.expiresAt).getTime() : Date.now() + 120000;
        const diff = Math.max(10, Math.min(120, Math.floor((expTime - Date.now()) / 1000)));
        setSecondsRemaining(diff > 0 ? diff : 120);
        setIsSuccessConnected(false);
        setScreenMode('code_screen');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate code.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const timerPercent = Math.max(0, Math.min(100, (secondsRemaining / 120) * 100));
  const isExpiringSoon = secondsRemaining <= 30;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 2: DEDICATED VERIFICATION CODE SCREEN (User requested different screen)
  // ═══════════════════════════════════════════════════════════════════════════
  if (screenMode === 'code_screen') {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        {/* Toast */}
        {toastMsg && (
          <div className="fixed top-6 right-6 z-50 bg-[#1E3F35] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-[#2E9E6B]/30 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-[#52B788]" />
            <span className="text-xs font-semibold">{toastMsg}</span>
          </div>
        )}

        {/* Top Back Navigation */}
        <button
          onClick={() => {
            setScreenMode('main');
            loadData();
          }}
          className="flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors bg-white px-3.5 py-2 rounded-xl border border-stone-200/80 shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4 text-stone-500" />
          <span>Back to Doctor Requests</span>
        </button>

        {/* Success Connected State */}
        {isSuccessConnected ? (
          <div className="bg-white rounded-3xl p-8 border border-emerald-200 shadow-card text-center space-y-6 animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                Connection Verified & Active
              </span>
              <h2 className="text-2xl font-bold text-stone-900">
                You are now connected with {targetDoctorName}!
              </h2>
              <p className="text-sm text-stone-500 max-w-md mx-auto">
                {targetDoctorName} can now securely review your verified lab reports, analyze trends, and provide clinical summaries.
              </p>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => {
                  setScreenMode('main');
                  setActiveTab('connected');
                  loadData();
                }}
                className="px-6 py-3 bg-[#1E3F35] hover:bg-[#16322A] text-white font-semibold text-sm rounded-xl shadow-sm transition-all"
              >
                View Connected Doctors
              </button>
              <button
                onClick={() => navigate('/patient/reports')}
                className="px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-sm rounded-xl transition-all"
              >
                My Reports
              </button>
            </div>
          </div>
        ) : (
          /* Active Code Display Card */
          <div className="bg-white rounded-3xl border border-stone-200/80 shadow-card overflow-hidden">
            {/* Header banner */}
            <div className="bg-[#1E3F35] p-6 text-white space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-[#2E9E6B]/20 text-[#52B788] border border-[#2E9E6B]/30 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  TEMPORARY VERIFICATION CODE
                </span>
                <span className="text-xs text-white/70 flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-4 h-4 text-[#52B788]" />
                  DPDP Protected
                </span>
              </div>

              <h2 className="text-xl font-bold">
                Share this code with {targetDoctorName || 'your doctor'}
              </h2>
              <p className="text-xs text-white/80 max-w-lg leading-relaxed">
                The doctor must enter this 6-digit code on their screen within <strong>2 minutes</strong> to establish clinical consent.
              </p>
            </div>

            {/* Main Code Box Area */}
            <div className="p-8 text-center space-y-6">
              {/* Doctor target pill */}
              <div className="inline-flex items-center gap-2 bg-stone-100 px-4 py-1.5 rounded-full text-xs font-semibold text-stone-700">
                <Stethoscope className="w-3.5 h-3.5 text-[#1E3F35]" />
                <span>Target Doctor: {targetDoctorName || 'Doctor'}</span>
              </div>

              {/* 6-Digit Code Presentation */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-widest text-stone-400 block">
                  One-Time 6-Digit Code
                </span>

                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {generatedCode.split('').map((digit, idx) => (
                    <div
                      key={idx}
                      className="w-12 h-14 sm:w-14 sm:h-16 rounded-2xl bg-stone-50 border-2 border-[#1E3F35]/30 flex items-center justify-center text-2xl sm:text-3xl font-extrabold font-mono text-[#1E3F35] shadow-xs"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-center">
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-all shadow-2xs"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Code Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-stone-500" />
                        <span>Copy 6-Digit Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 2-Minute Live Timer */}
              <div className="max-w-md mx-auto bg-stone-50 p-5 rounded-2xl border border-stone-200/80 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-stone-600">
                    <Clock className={`w-4 h-4 ${isExpiringSoon ? 'text-rose-500 animate-pulse' : 'text-[#1E3F35]'}`} />
                    <span>Time Remaining</span>
                  </span>
                  <span
                    className={`font-mono font-bold text-sm ${
                      isExpiringSoon ? 'text-rose-600' : 'text-[#1E3F35]'
                    }`}
                  >
                    {Math.floor(secondsRemaining / 60)}:
                    {(secondsRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                {/* Animated progress bar */}
                <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      isExpiringSoon ? 'bg-rose-500' : 'bg-[#1E3F35]'
                    }`}
                    style={{ width: `${timerPercent}%` }}
                  />
                </div>

                {secondsRemaining === 0 ? (
                  <div className="text-xs text-rose-600 font-semibold space-y-2 pt-1">
                    <p>This code has expired. Please approve the request again or generate a new code.</p>
                    <button
                      onClick={() => setScreenMode('main')}
                      className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-bold hover:bg-rose-100 transition-colors"
                    >
                      Return to Requests
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-500 leading-normal">
                    This temporary code automatically self-destructs after 2 minutes for your security.
                  </p>
                )}
              </div>

              {/* Live status waiting badge */}
              {secondsRemaining > 0 && (
                <div className="flex items-center justify-center gap-2 text-xs font-medium text-stone-500 pt-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                  <span>Waiting for doctor to enter verification code...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN 1: DOCTOR REQUESTS & CONNECTED DOCTORS LIST
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-[#1E3F35] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-[#2E9E6B]/30 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#52B788]" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
              Doctor Consent & Access
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#172B25] tracking-tight mt-1">
            My Doctors & Clinical Access
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Manage which doctors can review your lab reports. Doctors can only connect with your explicit approval.
          </p>
        </div>

        {/* Patient RS-ID Badge */}
        <div className="bg-stone-50 border border-stone-200 px-4 py-2.5 rounded-2xl text-right self-start sm:self-center">
          <span className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">Your ReportSetu ID</span>
          <span className="font-mono font-extrabold text-base text-[#1E3F35]">
            {currentPatient?.rsId || 'RS-10475'}
          </span>
        </div>
      </div>

      {/* Top Tabs */}
      <div className="flex border-b border-stone-200 gap-2">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === 'requests'
              ? 'text-[#1E3F35] border-b-2 border-[#1E3F35]'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <span>Incoming Requests</span>
          {pendingRequests.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B53629] text-white">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('connected')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === 'connected'
              ? 'text-[#1E3F35] border-b-2 border-[#1E3F35]'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <span>Connected Doctors</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700">
            {connectedDoctors.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('quick_code')}
          className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition-all relative flex items-center gap-1.5 ${
            activeTab === 'quick_code'
              ? 'text-[#1E3F35] border-b-2 border-[#1E3F35]'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Walk-in Quick Code</span>
        </button>
      </div>

      {/* ─── TAB 1: INCOMING REQUESTS ────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Informational banner */}
          <div className="bg-[#EBF4F0] border border-[#C6DBD0] rounded-2xl p-4 text-xs text-[#2A554A] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#1E3F35] flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-[#1E3F35]">How doctor connection works:</p>
              <p className="leading-relaxed">
                When a doctor requests access, you review their profile. When you tap <strong>Approve</strong>, a <strong>2-minute temporary code</strong> is generated. You share this code with the doctor to complete the connection.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs text-stone-400">Loading requests...</div>
          ) : pendingRequests.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200/80 p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
                <UserCheck className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-stone-800">No pending doctor requests</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                When a doctor enters your ReportSetu ID ({currentPatient?.rsId || 'RS-XXXXX'}), their connection request will appear here for you to review and approve.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div
                  key={req.connectionId}
                  className="bg-white rounded-3xl p-6 border border-stone-200/80 shadow-xs hover:border-[#1E3F35]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-[#1E3F35] text-white flex items-center justify-center font-bold text-xs">
                        DR
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-stone-900 text-sm sm:text-base">
                            {req.doctorName}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Verified Doctor
                          </span>
                        </div>
                        <p className="text-xs text-stone-500">
                          {req.specialty} · {typeof req.clinic === 'string' ? req.clinic : req.clinic?.name || 'Clinic'}
                        </p>
                      </div>
                    </div>

                    <p className="text-[11px] text-stone-400 pl-12">
                      Requested: {new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Wants access to review lab reports
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center pl-12 sm:pl-0">
                    <button
                      onClick={() => handleReject(req.connectionId, req.doctorName)}
                      disabled={actionLoading === req.connectionId}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                    >
                      Decline
                    </button>

                    <button
                      onClick={() => handleApprove(req)}
                      disabled={actionLoading === req.connectionId}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#1E3F35] hover:bg-[#16322A] shadow-sm flex items-center gap-2 transition-all active:scale-95"
                    >
                      {actionLoading === req.connectionId ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <KeyRound className="w-3.5 h-3.5 text-[#52B788]" />
                      )}
                      <span>Approve & Get Code</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: CONNECTED DOCTORS ──────────────────────────────────────── */}
      {activeTab === 'connected' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-stone-200/80 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">Authorized Doctors</h3>
              <p className="text-xs text-stone-500">
                These doctors currently have your digital consent to access your lab records and suggest clinical summaries.
              </p>
            </div>

            {loading ? (
              <div className="text-center py-8 text-xs text-stone-400">Loading connected doctors...</div>
            ) : connectedDoctors.length === 0 ? (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                <ShieldCheck className="w-8 h-8 text-stone-400 mx-auto" />
                <p className="text-xs font-semibold text-stone-600">No connected doctors</p>
                <p className="text-[11px] text-stone-400">Your lab records are private to you.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {connectedDoctors.map((doc) => (
                  <div
                    key={doc.id || doc.doctorId}
                    className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1E3F35] text-white flex items-center justify-center font-bold text-xs">
                        DR
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-stone-900">{doc.name}</h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                            Active Consent
                          </span>
                        </div>
                        <p className="text-xs text-stone-600">
                          {doc.specialty} · {doc.hospital || (typeof doc.clinic === 'string' ? doc.clinic : doc.clinic?.name) || 'Hospital'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRevoke(doc.doctorId || doc.id, doc.name)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors self-start sm:self-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Revoke Access</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: WALK-IN QUICK CODE ─────────────────────────────────────── */}
      {activeTab === 'quick_code' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs space-y-6">
            <div className="space-y-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                In-Person Walk-in
              </span>
              <h3 className="text-lg font-bold text-stone-900">Generate In-Clinic Quick Code</h3>
              <p className="text-xs text-stone-500 max-w-lg leading-relaxed">
                Visiting a clinic in person? Generate a 2-minute temporary code to share with the doctor or receptionist on the spot.
              </p>
            </div>

            <div className="bg-[#1E3F35] text-white p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/70">Single-use clinic pairing</span>
                <span className="text-xs font-mono text-[#52B788]">Valid 2 minutes</span>
              </div>

              <button
                onClick={handleGenerateQuickCode}
                disabled={actionLoading === 'quick'}
                className="w-full py-3 bg-[#52B788] hover:bg-[#40966F] text-[#172B25] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {actionLoading === 'quick' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                <span>Generate 2-Minute In-Clinic Code</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDoctors;
