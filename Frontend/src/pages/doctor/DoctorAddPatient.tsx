import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { connectionsApi } from '../../api';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  UserCheck,
  Search,
  Sparkles,
  Lock,
  Clock,
  RefreshCw,
  Send,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export const DoctorAddPatient: React.FC = () => {
  const navigate = useNavigate();
  const { patients, fetchDoctorPatients } = useStore();

  useEffect(() => {
    fetchDoctorPatients();
    loadPendingRequests();
  }, []);

  // Workflow steps: 'request' (enter RS-ID) or 'verify' (enter 6-digit code)
  const [currentStep, setCurrentStep] = useState<'request' | 'verify'>('request');

  // Input states
  const [rsId, setRsId] = useState('RS-10475');
  const [connectCode, setConnectCode] = useState<string[]>(['', '', '', '', '', '']);
  const [codeInputs, setCodeInputs] = useState<string[]>(['', '', '', '', '', '']);

  // Loading & error states
  const [requestLoading, setRequestLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [success, setSuccess] = useState(false);

  // Doctor pending requests list
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // Input refs for 6-digit boxes
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const loadPendingRequests = async () => {
    try {
      const res = await connectionsApi.getDoctorPendingRequests();
      setPendingRequests(res?.requests || []);
    } catch {
      // fallback
    }
  };

  // Matched patient preview
  const matchedPatient = patients.find(
    (p) => p.rsId.toLowerCase() === rsId.trim().toLowerCase()
  ) || patients[0];

  // ─── Step 1: Send Connection Request ──────────────────────────────────────
  const handleSendRequest = async () => {
    const cleanRsId = rsId.trim().toUpperCase();
    if (!cleanRsId) {
      setErrorMessage('Please enter a patient ReportSetu ID (e.g. RS-10475)');
      return;
    }

    try {
      setRequestLoading(true);
      setErrorMessage('');
      const res = await connectionsApi.sendRequest(cleanRsId);

      setSuccessMessage(
        res?.message || 'Connection request sent to patient. Ask them to approve in their app.'
      );
      // Advance to Step 2 (Verification code entry)
      setCurrentStep('verify');
      loadPendingRequests();
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Failed to send connection request. Please verify the RS-ID.'
      );
    } finally {
      setRequestLoading(false);
    }
  };

  // ─── Step 2: Doctor Verifies Patient's 6-Digit Code ───────────────────────
  const handleVerifyCode = async () => {
    const code = codeInputs.join('').trim().toUpperCase();
    if (code.length < 6) {
      setErrorMessage('Please enter the full 6-digit verification code provided by the patient.');
      return;
    }

    const cleanRsId = rsId.trim().toUpperCase();

    try {
      setVerifyLoading(true);
      setErrorMessage('');
      const res = await connectionsApi.verifyDoctorConnectCode(cleanRsId, code);

      setSuccess(true);
      setSuccessMessage('Patient connected successfully! Clinical access is now active.');
      await fetchDoctorPatients();

      setTimeout(() => {
        const found = patients.find((p) => p.rsId.toLowerCase() === cleanRsId.toLowerCase());
        navigate(found ? `/doctor/patients/${found.id}` : '/doctor/patients');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Invalid or expired code. Please verify the code with your patient.'
      );
    } finally {
      setVerifyLoading(false);
    }
  };

  // Code input handler (auto-advancing)
  const handleCodeChange = (index: number, val: string) => {
    const clean = val.slice(-1).toUpperCase();
    const next = [...codeInputs];
    next[index] = clean;
    setCodeInputs(next);

    // Auto-advance
    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeInputs[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (pasted.length >= 6) {
      const next = pasted.slice(0, 6).split('');
      setCodeInputs(next);
      inputRefs.current[5]?.focus();
    }
  };

  const selectPendingRequest = (req: any) => {
    setRsId(req.patientRsId || rsId);
    setCurrentStep('verify');
    setErrorMessage('');
    setSuccessMessage('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Back button */}
      <button
        onClick={() => navigate('/doctor/patients')}
        className="flex items-center gap-2 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Patients</span>
      </button>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#172B25] tracking-tight">
          Connect new patient
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          Request access with the patient's ReportSetu ID, then verify using their temporary 2-minute approval code.
        </p>
      </div>

      {/* Progress Indicators */}
      <div className="flex items-center gap-3">
        <div
          onClick={() => setCurrentStep('request')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
            currentStep === 'request'
              ? 'bg-[#1E3F35] text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 text-center text-[10px] leading-4 font-bold">1</span>
          <span>Send Request</span>
        </div>

        <div className="w-6 h-0.5 bg-stone-300" />

        <div
          onClick={() => setCurrentStep('verify')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
            currentStep === 'verify'
              ? 'bg-[#1E3F35] text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 text-center text-[10px] leading-4 font-bold">2</span>
          <span>Verify 2-Min Code</span>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-xs text-rose-700 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
            <div className="space-y-0.5">
              <span className="font-bold block">Verification Notice</span>
              <span>{errorMessage}</span>
            </div>
          </div>
          {(errorMessage.toLowerCase().includes('expired') ||
            errorMessage.toLowerCase().includes('unauthorized') ||
            errorMessage.toLowerCase().includes('token')) && (
            <Link
              to="/login"
              className="px-3.5 py-1.5 bg-[#B53629] text-white font-semibold rounded-xl hover:bg-[#962B20] transition-colors whitespace-nowrap text-xs shadow-xs flex-shrink-0"
            >
              Log in again
            </Link>
          )}
          {errorMessage.toLowerCase().includes('pending medical council verification') && (
            <Link
              to="/admin"
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold rounded-xl transition-colors whitespace-nowrap text-xs shadow-xs flex-shrink-0 flex items-center gap-1"
            >
              <span>Approve in Admin Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {successMessage && !errorMessage && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-xs text-emerald-800 flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Form (7 cols) */}
        <div className="md:col-span-7 bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/70 space-y-6">
          {/* STEP 1: SEND REQUEST */}
          {currentStep === 'request' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#1E3F35] text-white flex items-center justify-center font-bold text-xs">
                    1
                  </span>
                  <h3 className="font-bold text-sm text-[#172B25]">Enter patient's ReportSetu ID</h3>
                </div>
                <p className="text-xs text-stone-500 pl-8">
                  Ask the patient for their ReportSetu ID (found on their home screen or profile).
                </p>

                <div className="pl-8 pt-1 flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={rsId}
                      onChange={(e) => setRsId(e.target.value.toUpperCase())}
                      placeholder="e.g. RS-10475"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 font-mono text-sm text-[#172B25] focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendRequest}
                    disabled={requestLoading}
                    className="bg-[#1E3F35] hover:bg-[#16322A] text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {requestLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-[#52B788]" />
                    )}
                    <span>Send Request</span>
                  </button>
                </div>
              </div>

              {/* Informational Workflow Callout */}
              <div className="pl-8">
                <div className="bg-[#EBF4F0] border border-[#C6DBD0] rounded-2xl p-4 text-xs text-[#2A554A] space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-[#1E3F35]">
                    <ShieldCheck className="w-4 h-4" />
                    <span>How the connection protocol works:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#2A554A]/90 pl-1">
                    <li>You send a request with the patient's RS-ID.</li>
                    <li>Patient receives an in-app alert under <strong>Doctor Requests</strong>.</li>
                    <li>Patient reviews your credentials and taps <strong>Approve</strong>.</li>
                    <li>A temporary <strong>2-minute code</strong> is revealed to the patient.</li>
                    <li>Patient reads this code to you, and you enter it to finalize consent.</li>
                  </ol>
                </div>
              </div>

              {/* Direct skip if doctor already has patient's code */}
              <div className="pl-8 pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                <span>Already requested or patient has code ready?</span>
                <button
                  type="button"
                  onClick={() => setCurrentStep('verify')}
                  className="font-bold text-[#1E3F35] hover:underline flex items-center gap-1"
                >
                  <span>Enter Code →</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CODE VERIFICATION (DEDICATED VIEW) */}
          {currentStep === 'verify' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#1E3F35] text-white flex items-center justify-center font-bold text-xs">
                      2
                    </span>
                    <h3 className="font-bold text-sm text-[#172B25]">
                      Enter patient's 2-minute verification code
                    </h3>
                  </div>

                  <button
                    onClick={() => setCurrentStep('request')}
                    className="text-[11px] font-semibold text-stone-500 hover:text-stone-800"
                  >
                    Change RS-ID ({rsId})
                  </button>
                </div>

                <p className="text-xs text-stone-500 pl-8">
                  Patient must open their ReportSetu app → tap <strong>Doctor Requests</strong> → tap <strong>Approve</strong> to reveal the 6-digit code.
                </p>
              </div>

              {/* 6-digit inputs */}
              <div className="pl-8 space-y-4">
                <div className="flex items-center gap-2" onPaste={handlePaste}>
                  {codeInputs.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (inputRefs.current[idx] = el)}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-11 h-12 text-center text-lg font-bold font-mono rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/30 focus:border-[#1E3F35] bg-stone-50 uppercase"
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-stone-400">
                  <Clock className="w-3.5 h-3.5 text-[#52B788]" />
                  <span>Codes are valid for 2 minutes from when the patient approves.</span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleVerifyCode}
                    disabled={verifyLoading || success}
                    className="w-full py-3 bg-[#1E3F35] hover:bg-[#16322A] text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                  >
                    {verifyLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying with Patient...</span>
                      </>
                    ) : success ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[#52B788]" />
                        <span>Connected! Redirecting...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 text-[#52B788]" />
                        <span>Verify Code & Connect Patient</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Pending Requests Sent & Security Info (5 cols) */}
        <div className="md:col-span-5 space-y-5">
          {/* Pending Requests Card */}
          <div className="bg-white rounded-3xl p-6 shadow-card border border-stone-200/70 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Pending Requests Sent
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                {pendingRequests.length} pending
              </span>
            </div>

            {pendingRequests.length === 0 ? (
              <p className="text-xs text-stone-400 py-2">
                No connection requests currently awaiting patient approval.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <div
                    key={req.connectionId}
                    className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-stone-800 block">
                        {req.patientName || 'Patient'}
                      </span>
                      <span className="font-mono text-[10px] text-stone-500">
                        {req.patientRsId}
                      </span>
                    </div>

                    <button
                      onClick={() => selectPendingRequest(req)}
                      className="px-2.5 py-1 bg-[#1E3F35] text-white text-[11px] font-semibold rounded-lg hover:bg-[#16322A] transition-colors"
                    >
                      Enter Code
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Privacy & Clinical Consent Card */}
          <div className="bg-[#1E3F35] text-white rounded-3xl p-6 shadow-card space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#52B788]" />
              <h4 className="font-bold text-sm">Doctor-Patient Consent</h4>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">
              ReportSetu enforces the Digital Personal Data Protection (DPDP) Act. Medical records are encrypted at rest and accessible only when active consent is validated via single-use verification codes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorAddPatient;
