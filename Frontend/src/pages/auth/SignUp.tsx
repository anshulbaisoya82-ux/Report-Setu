import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../../components/common/Logo';
import {
  Sparkles,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  User,
  Phone,
  Mail,
  FileBadge,
  Building,
  Lock,
  Eye,
  EyeOff,
  Info,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { authApi } from '../../api/client';

const PatientSignUp: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (name.trim().length < 2 || phone.trim().length < 10) {
      setErrorMessage('Enter your full name and a valid mobile number.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await authApi.sendPatientOtp(phone);
      setOtpSent(true);
      setDevCode(result.devCode || null);
      if (result.devCode) setOtp(result.devCode);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to send verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const completeRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const result = await authApi.verifyPatientOtp(phone, otp, name.trim());
      navigate(!result.isProfileComplete ? '/patient/onboarding' : '/patient');
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ECF2ED] p-6">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-card border border-stone-200/60">
        <Logo size="lg" />
        <div className="mt-8 mb-6">
          <h1 className="text-2xl font-bold text-[#172B25]">Create your patient account</h1>
          <p className="text-sm text-stone-500 mt-1">Use your mobile number to securely access your health reports.</p>
        </div>
        {errorMessage && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>}
        {!otpSent ? (
          <form onSubmit={sendCode} className="space-y-4">
            <label className="block text-sm font-medium text-stone-700">
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} required name="name" className="mt-1.5 w-full rounded-xl border border-stone-200 px-4 py-3" placeholder="Your full name" />
            </label>
            <label className="block text-sm font-medium text-stone-700">
              Mobile number
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required name="phone" inputMode="tel" className="mt-1.5 w-full rounded-xl border border-stone-200 px-4 py-3" placeholder="10-digit mobile number" />
            </label>
            <button disabled={isLoading} className="w-full rounded-xl bg-[#1E3F35] py-3 text-sm font-semibold text-white disabled:opacity-60">
              {isLoading ? 'Sending code...' : 'Send verification code'}
            </button>
          </form>
        ) : (
          <form onSubmit={completeRegistration} className="space-y-4">
            <p className="text-sm text-stone-600">Enter the 6-digit code sent to {phone}.</p>
            {devCode && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Development code: {devCode}</p>}
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} required inputMode="numeric" pattern="\d{6}" maxLength={6} className="w-full rounded-xl border border-stone-200 px-4 py-3 text-center text-lg tracking-[0.4em]" placeholder="000000" />
            <button disabled={isLoading} className="w-full rounded-xl bg-[#1E3F35] py-3 text-sm font-semibold text-white disabled:opacity-60">
              {isLoading ? 'Creating account...' : 'Verify and create account'}
            </button>
            <button type="button" onClick={() => setOtpSent(false)} className="w-full text-sm text-stone-500 hover:text-stone-800">Use a different number</button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-stone-500">
          Already registered? <Link to="/login" className="font-semibold text-[#B53629] hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setRole } = useStore();

  if (searchParams.get('role') === 'patient') return <PatientSignUp />;

  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    regNumber: '',
    regCouncil: '',
    specialty: '',
    clinicName: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const submitted = Object.fromEntries(new FormData(e.currentTarget).entries());
    const form = {
      fullName: String(submitted.fullName || '').trim(),
      mobile: String(submitted.mobile || '').trim(),
      email: String(submitted.email || '').trim(),
      regNumber: String(submitted.regNumber || '').trim(),
      regCouncil: String(submitted.regCouncil || '').trim(),
      specialty: String(submitted.specialty || '').trim(),
      clinicName: String(submitted.clinicName || '').trim(),
      password: String(submitted.password || ''),
      confirmPassword: String(submitted.confirmPassword || ''),
      agreeTerms: submitted.agreeTerms === 'on',
    };

    if (
      !form.fullName ||
      !form.mobile ||
      !form.email ||
      !form.regNumber ||
      !form.regCouncil ||
      !form.specialty ||
      !form.clinicName ||
      !form.password ||
      !form.confirmPassword
    ) {
      setErrorMessage('Please complete every field before creating your account.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    if (!form.agreeTerms) {
      setErrorMessage('Please agree to the Terms of Use and Privacy Policy.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await (await import('../../api/client')).authApi.signupDoctor({
        name: form.fullName,
        email: form.email,
        phone: form.mobile,
        password: form.password,
        specialty: form.specialty,
        registrationNumber: form.regNumber,
        medicalCouncil: form.regCouncil,
        clinicName: form.clinicName,
      });
      setRole('doctor');
      navigate('/login', {
        state: { registrationMessage: 'Registration submitted. Sign in after your account is verified.' },
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please check details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#ECF2ED]">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-[#1E3F35] text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Logo size="lg" />

          <div className="mt-20 space-y-6 max-w-md">
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
                  <h4 className="font-semibold text-white text-sm">Review, edit and reply</h4>
                  <p className="text-white/60 text-xs mt-0.5">
                    Send patients a message you have checked yourself.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-teal-300 flex-shrink-0" />
          <p className="text-xs text-white/70">
            Private by design. Access to patient reports requires a verified medical registration.
          </p>
        </div>
      </div>

      {/* Right Registration Form */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 overflow-y-auto">
        <div className="flex justify-end items-center text-xs sm:text-sm">
          <span className="text-stone-500 mr-2">Already registered?</span>
          <Link to="/login" className="font-semibold text-[#B53629] hover:underline">
            Log in
          </Link>
        </div>

        <div className="w-full max-w-xl mx-auto my-6 bg-white rounded-3xl p-8 sm:p-10 shadow-card border border-stone-200/60">
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#172B25] tracking-tight">
              Create your doctor account
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              Join ReportSetu to review lab reports with AI support.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {errorMessage}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Full name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    name="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    placeholder="Dr. Priya Mehta"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm text-[#172B25]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Mobile number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    name="mobile"
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    required
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm text-[#172B25]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="doctor@clinic.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm text-[#172B25]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Medical registration number
                </label>
                <div className="relative">
                  <FileBadge className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    name="regNumber"
                    type="text"
                    value={formData.regNumber}
                    onChange={(e) => setFormData({ ...formData, regNumber: e.target.value })}
                    required
                    placeholder="e.g. 12345"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm text-[#172B25]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Registration council
                </label>
                <select
                  name="regCouncil"
                  value={formData.regCouncil}
                  onChange={(e) => setFormData({ ...formData, regCouncil: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm text-[#172B25] bg-white"
                >
                  <option value="Delhi Medical Council">Delhi Medical Council</option>
                  <option value="Maharashtra Medical Council">Maharashtra Medical Council</option>
                  <option value="Karnataka Medical Council">Karnataka Medical Council</option>
                  <option value="Tamil Nadu Medical Council">Tamil Nadu Medical Council</option>
                  <option value="National Medical Commission">National Medical Commission</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Specialty
                </label>
                <select
                  name="specialty"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm text-[#172B25] bg-white"
                >
                  <option value="General Physician">General Physician</option>
                  <option value="Internal Medicine">Internal Medicine</option>
                  <option value="Endocrinologist">Endocrinologist</option>
                  <option value="Cardiologist">Cardiologist</option>
                  <option value="Hematologist">Hematologist</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Clinic or hospital
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    name="clinicName"
                    type="text"
                    value={formData.clinicName}
                    onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                    required
                    placeholder="Name of your clinic"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm text-[#172B25]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    placeholder="Create a password"
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

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                  <input
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    placeholder="Re-enter password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm text-[#172B25]"
                  />
                </div>
              </div>
            </div>

            {/* Verification Info Box */}
            <div className="bg-[#EBF4F0] border border-[#C6DBD0] rounded-xl p-3.5 flex items-start gap-3 text-xs text-[#2A554A]">
              <Info className="w-4 h-4 text-[#35695C] flex-shrink-0 mt-0.5" />
              <span>
                We verify your registration number before you can access patient data. Use at least 8
                characters with a number and a symbol.
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 text-xs text-stone-600">
              <input
                type="checkbox"
                name="agreeTerms"
                id="terms"
                checked={formData.agreeTerms}
                onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                required
                className="rounded text-[#1E3F35] focus:ring-[#1E3F35]"
              />
              <label htmlFor="terms">
                I agree to the <span className="font-semibold text-stone-800">Terms of Use</span>{' '}
                and <span className="font-semibold text-stone-800">Privacy Policy</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1E3F35] hover:bg-[#16322A] text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all mt-2"
            >
              <span>{isLoading ? 'Creating account...' : 'Create account'}</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-stone-400 flex items-center justify-center gap-1.5 pb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Never share your password. ReportSetu staff will never ask for it.</span>
        </div>
      </div>
    </div>
  );
};
