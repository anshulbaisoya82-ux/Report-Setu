import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/common/Logo';
import {
  Sparkles,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  ArrowRight,
  Stethoscope,
  User,
  KeyRound,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { authApi } from '../../api/client';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setRole, setCurrentUser } = useStore();

  const [activeTab, setActiveTab] = useState<'doctor' | 'patient'>('doctor');

  // Doctor credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  // Patient credentials
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [dispatchedDevCode, setDispatchedDevCode] = useState<string | null>(null);

  // Status & Error
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const registrationMessage = (location.state as { registrationMessage?: string } | null)?.registrationMessage;

  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await authApi.loginDoctor(email, password);
      setRole('doctor');
      setCurrentUser(res.doctor || res.user);
      navigate('/doctor');
    } catch (err: any) {
      setErrorMessage(err.message || 'Doctor login failed. Check email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await authApi.sendPatientOtp(phone);
      setOtpSent(true);
      if (res.devCode) {
        setDispatchedDevCode(res.devCode);
        setOtp(res.devCode);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await authApi.verifyPatientOtp(phone, otp);
      setRole('patient');
      setCurrentUser(res.patient || res.user);
      navigate(!res.isProfileComplete ? '/patient/onboarding' : '/patient');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#ECF2ED]">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-[#1E3F35] text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decorative curved wave */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Logo size="lg" />

          <div className="mt-24 space-y-6 max-w-md">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
              Lab reports,
              <br />
              understood in seconds.
            </h1>
            <p className="text-white/70 text-base leading-relaxed">
              Review every report with an AI overview, compare it with past tests, and reply to your
              patients, all in one place.
            </p>

            <div className="pt-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-teal-300">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">AI overview of every report</h4>
                  <p className="text-white/60 text-xs mt-0.5">
                    Key findings and points to consider, ready when you open a file.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-teal-300">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">Trends against past tests</h4>
                  <p className="text-white/60 text-xs mt-0.5">
                    See how each value has moved since the last report.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 text-teal-300">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">Doctor-approved communication</h4>
                  <p className="text-white/60 text-xs mt-0.5">
                    Draft, approve, and send patient messages in English and Hindi.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="relative z-10 pt-8 border-t border-white/10 flex items-center gap-3 text-xs text-white/60">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <span>ABDM Compliant · 256-bit AES Clinical Encryption</span>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 overflow-y-auto">
        {/* Top Header / Switch Mode */}
        <div className="flex items-center justify-end text-xs sm:text-sm">
          <span className="text-stone-500 mr-2">Need an account?</span>
          <Link to={activeTab === 'patient' ? '/signup?role=patient' : '/signup'} className="font-semibold text-[#B53629] hover:underline">
            Register as {activeTab === 'patient' ? 'Patient' : 'Doctor'}
          </Link>
        </div>

        {/* Center Card */}
        <div className="w-full max-w-md mx-auto my-8 bg-white rounded-3xl p-8 sm:p-10 shadow-card border border-stone-200/60">
          {/* Role Tabs */}
          <div className="flex bg-stone-100 p-1.5 rounded-2xl mb-8">
            <button
              type="button"
              onClick={() => {
                setActiveTab('doctor');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'doctor'
                  ? 'bg-white text-[#1E3F35] shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>Doctor Portal</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('patient');
                setErrorMessage(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'patient'
                  ? 'bg-[#1E3F35] text-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Patient Portal</span>
            </button>
          </div>

          {/* Error Banner */}
          {registrationMessage && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs">
              {registrationMessage}
            </div>
          )}
          {errorMessage && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'doctor' ? (
            /* Doctor Login Form */
            <div>
              <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#172B25] tracking-tight">
                  Doctor log in
                </h2>
                <p className="text-sm text-stone-500 mt-2">
                  Review patient lab reports, track trends, and manage clinical triage.
                </p>
              </div>

              <form onSubmit={handleDoctorSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="priya.mehta@reportsetu.in"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm text-[#172B25]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Password / Dev Code
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm text-[#172B25]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-stone-400 hover:text-stone-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-stone-600">
                    <input
                      type="checkbox"
                      checked={keepLoggedIn}
                      onChange={(e) => setKeepLoggedIn(e.target.checked)}
                      className="rounded text-[#1E3F35] focus:ring-[#1E3F35]"
                    />
                    <span>Remember this device</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#1E3F35] hover:bg-[#16322A] text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Log in to Clinician Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Patient Login Form (Mobile OTP) */
            <div>
              <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-[#172B25] tracking-tight">
                  Patient log in
                </h2>
                <p className="text-sm text-stone-500 mt-2">
                  Access your lab reports, medicines, and connect with your doctor via SMS OTP.
                </p>
              </div>

              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Mobile number
                    </label>
                    <div className="relative">
                      <Smartphone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                      <div className="flex items-center">
                        <span className="absolute left-10 text-sm font-semibold text-stone-500">
                          +91
                        </span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                          pattern="[0-9]{10}"
                          maxLength={10}
                          placeholder="98765 43210"
                          className="w-full pl-20 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm text-[#172B25]"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1.5">
                      Enter your mobile number to receive an instant verification code.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#1E3F35] hover:bg-[#16322A] text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-70"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Dispatching SMS...</span>
                      </>
                    ) : (
                      <>
                        <span>Send verification code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div className="bg-teal-50 border border-teal-200/80 rounded-2xl p-3 text-xs text-teal-800 flex items-center justify-between">
                    <span>Code dispatched to +91 {phone}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setDispatchedDevCode(null);
                      }}
                      className="font-semibold text-teal-900 underline ml-2"
                    >
                      Change
                    </button>
                  </div>

                  {dispatchedDevCode && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs flex items-center justify-between">
                      <span>SMS Dev Code:</span>
                      <span className="font-mono font-bold tracking-widest text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                        {dispatchedDevCode}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Enter 6-digit verification code
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        required
                        maxLength={6}
                        placeholder="123456"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm text-[#172B25] tracking-widest font-mono text-center font-bold"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#1E3F35] hover:bg-[#16322A] text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-70"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Continue to Patient Portal</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center text-xs text-stone-400 flex items-center justify-center gap-1.5 pb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>ReportSetu strictly protects your medical information and authentication credentials.</span>
        </div>
      </div>
    </div>
  );
};
