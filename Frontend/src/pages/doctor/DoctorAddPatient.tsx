import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { connectionsApi } from '../../api';
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  CheckCircle2,
  Calendar,
  UserCheck,
  User,
  Clock,
  RefreshCw,
  Send,
  AlertCircle,
} from 'lucide-react';

export const DoctorAddPatient: React.FC = () => {
  const navigate = useNavigate();
  const { patients, fetchDoctorPatients } = useStore();

  useEffect(() => {
    void fetchDoctorPatients();
    void loadPendingRequests();
  }, []);

  // Workflow steps: 'request' (enter RS-ID) or 'verify' (enter 6-digit code)
  const [currentStep, setCurrentStep] = useState<'request' | 'verify'>('request');

  // Input states
  const [rsId, setRsId] = useState('');
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
      void loadPendingRequests();
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
      await connectionsApi.verifyDoctorConnectCode(cleanRsId, code);

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
    <div className="p-6 lg:p-7 max-w-[1400px] w-full mx-auto space-y-4 text-slate-800">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/doctor/patients')}
          className="flex items-center gap-1.5 text-xs font-bold text-[#13382E] hover:text-[#184639] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Patients</span>
        </button>
      </div>

      {/* Main Title & Subtitle */}
      <div>
        <h1 className="text-[26px] font-black text-slate-900 tracking-tight leading-tight">
          Connect New Patient
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Request access with the patient's ReportSetu ID, then verify using their temporary 2-minute approval code.
        </p>
      </div>

      {/* Stepper Progress */}
      <div className="flex items-center gap-3 pt-1 select-none">
        {/* Step 1 */}
        <div
          onClick={() => setCurrentStep('request')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
              currentStep === 'request'
                ? 'bg-[#13382E] text-white shadow-2xs'
                : 'bg-[#D4EFE0] text-[#136C4F]'
            }`}
          >
            1
          </div>
          <span
            className={`text-xs ${
              currentStep === 'request'
                ? 'font-bold text-slate-900'
                : 'font-semibold text-slate-600'
            }`}
          >
            Send Request
          </span>
        </div>

        {/* Divider */}
        <div className="w-12 h-[1px] bg-slate-300" />

        {/* Step 2 */}
        <div
          onClick={() => setCurrentStep('verify')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
              currentStep === 'verify'
                ? 'bg-[#13382E] text-white shadow-2xs'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            2
          </div>
          <span
            className={`text-xs ${
              currentStep === 'verify'
                ? 'font-bold text-slate-900'
                : 'font-semibold text-slate-700'
            }`}
          >
            Verify 2-Min Code
          </span>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-[2px] text-xs text-rose-700 flex items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600" />
            <div>
              <span className="font-bold block">Notice</span>
              <span>{errorMessage}</span>
            </div>
          </div>
          {(errorMessage.toLowerCase().includes('expired') ||
            errorMessage.toLowerCase().includes('unauthorized') ||
            errorMessage.toLowerCase().includes('token')) && (
            <Link
              to="/login"
              className="px-3 py-1 bg-[#B53629] text-white font-semibold rounded-[2px] hover:bg-[#962B20] transition-colors whitespace-nowrap text-xs shadow-2xs flex-shrink-0"
            >
              Log in again
            </Link>
          )}
        </div>
      )}

      {successMessage && !errorMessage && (
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-[2px] text-xs text-emerald-800 flex items-center gap-2.5 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Two-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start pt-1">
        {/* LEFT COLUMN: Main Form Card (7 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-[2px] border border-stone-200/80 shadow-2xs p-6 md:p-7">
          {/* STEP 1: SEND REQUEST */}
          {currentStep === 'request' && (
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Enter Patient's ReportSetu ID
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1 mb-5">
                Ask the patient for their ReportSetu ID (found on their home screen or profile).
              </p>

              {/* Input & Send Button Row */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendRequest();
                }}
                className="flex items-center gap-3"
              >
                <div className="relative flex-1">
                  <User className="w-4 h-4 text-slate-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={rsId}
                    onChange={(e) => setRsId(e.target.value.toUpperCase())}
                    placeholder="e.g. RS-10475"
                    className="w-full h-[40px] bg-white border border-slate-200 rounded-[2px] pl-9 pr-3 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 transition-all uppercase shadow-2xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={requestLoading || !rsId.trim()}
                  className="h-[40px] px-5 bg-[#13382E] hover:bg-[#184639] text-white text-xs font-semibold rounded-[2px] flex items-center gap-2 shadow-2xs shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {requestLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Send Request</span>
                </button>
              </form>

              {/* Subtle Divider */}
              <div className="border-b border-stone-100 my-6" />

              {/* Protocol Instructions List */}
              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-3.5">
                  How the connection protocol works
                </h3>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 text-xs text-slate-700 leading-normal">
                    <span className="w-5 h-5 rounded-[2px] bg-[#D4EFE0] text-[#136C4F] flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      1
                    </span>
                    <span>You send a request with the patient's RS-ID.</span>
                  </div>

                  <div className="flex items-start gap-3 text-xs text-slate-700 leading-normal">
                    <span className="w-5 h-5 rounded-[2px] bg-[#D4EFE0] text-[#136C4F] flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Patient receives an in-app alert under{' '}
                      <strong className="font-bold text-slate-900">Doctor Requests</strong>.
                    </span>
                  </div>

                  <div className="flex items-start gap-3 text-xs text-slate-700 leading-normal">
                    <span className="w-5 h-5 rounded-[2px] bg-[#D4EFE0] text-[#136C4F] flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Patient reviews your credentials and taps{' '}
                      <strong className="font-bold text-slate-900">Approve</strong>.
                    </span>
                  </div>

                  <div className="flex items-start gap-3 text-xs text-slate-700 leading-normal">
                    <span className="w-5 h-5 rounded-[2px] bg-[#D4EFE0] text-[#136C4F] flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      4
                    </span>
                    <span>
                      A temporary <strong className="font-bold text-slate-900">2-minute code</strong> is revealed to the patient.
                    </span>
                  </div>

                  <div className="flex items-start gap-3 text-xs text-slate-700 leading-normal">
                    <span className="w-5 h-5 rounded-[2px] bg-[#D4EFE0] text-[#136C4F] flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      5
                    </span>
                    <span>
                      Patient reads this code to you, and you enter it to finalize consent.
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Jump Row */}
              <div className="border-t border-stone-100 mt-6 pt-4 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-normal">
                  Already requested or patient has code ready?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep('verify');
                    setErrorMessage('');
                  }}
                  className="font-bold text-[#13382E] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Enter Code →</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: VERIFICATION CODE ENTRY */}
          {currentStep === 'verify' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Enter Patient's 2-Minute Verification Code
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Patient must open their ReportSetu app → tap{' '}
                    <strong className="text-slate-800">Doctor Requests</strong> → tap{' '}
                    <strong className="text-slate-800">Approve</strong> to reveal the 6-digit code.
                  </p>
                </div>
              </div>

              {/* Patient RS-ID chip */}
              <div className="flex items-center justify-between bg-[#F8FAF9] border border-stone-200/80 p-2.5 px-3 rounded-[2px] text-xs">
                <div>
                  <span className="text-slate-500 font-normal">Target Patient: </span>
                  <span className="font-bold text-slate-900 font-mono">{rsId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep('request')}
                  className="text-[#13382E] font-semibold hover:underline cursor-pointer"
                >
                  Change RS-ID
                </button>
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="space-y-4">
                <div className="flex items-center gap-2.5" onPaste={handlePaste}>
                  {codeInputs.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (inputRefs.current[idx] = el)}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-11 h-12 text-center text-lg font-bold font-mono rounded-[2px] border border-slate-300 focus:outline-none focus:border-emerald-600 bg-white uppercase shadow-2xs"
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Codes are valid for 2 minutes from when the patient approves.</span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleVerifyCode}
                    disabled={verifyLoading || success || codeInputs.join('').length < 6}
                    className="w-full py-2.5 bg-[#13382E] hover:bg-[#184639] text-white font-semibold text-xs rounded-[2px] shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {verifyLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying with Patient...</span>
                      </>
                    ) : success ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Connected! Redirecting...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Verify Code & Connect Patient</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Bottom Jump Row */}
              <div className="border-t border-stone-100 mt-6 pt-4 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setCurrentStep('request')}
                  className="font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>← Back to Step 1</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Pending Requests & Consent (5 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {/* Card 1: Pending Requests Sent */}
          <div className="bg-white rounded-[2px] border border-stone-200/80 shadow-2xs p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Calendar className="w-4 h-4 text-[#136C4F]" />
                <span>Pending Requests Sent</span>
              </div>
              <span className="bg-[#D4EFE0] text-[#136C4F] text-[11px] font-semibold px-2 py-0.5 rounded-[2px]">
                {pendingRequests.length} pending
              </span>
            </div>

            {pendingRequests.length === 0 ? (
              <p className="text-xs text-slate-500 mt-3 font-normal leading-relaxed">
                No connection requests currently awaiting patient approval.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {pendingRequests.map((req) => (
                  <div
                    key={req.connectionId}
                    className="p-2.5 bg-[#F8FAF9] rounded-[2px] border border-stone-200/70 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {req.patientName || 'Patient'}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {req.patientRsId}
                      </span>
                    </div>

                    <button
                      onClick={() => selectPendingRequest(req)}
                      className="px-2.5 py-1 bg-[#13382E] text-white text-[11px] font-semibold rounded-[2px] hover:bg-[#184639] transition-colors cursor-pointer"
                    >
                      Enter Code
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Doctor-Patient Consent */}
          <div className="bg-[#EAF6F0]/70 border border-[#C6EAD8] rounded-[2px] p-5">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Shield className="w-4 h-4 text-[#136C4F]" />
              <span>Doctor–Patient Consent</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed mt-2.5 font-normal">
              ReportSetu enforces the Digital Personal Data Protection (DPDP) Act. Medical records are encrypted at rest and accessible only when active consent is validated via single-use verification codes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorAddPatient;
