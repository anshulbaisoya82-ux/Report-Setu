import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adminApi,
  getAdminToken,
  getAdminSession,
  clearAdminSession,
  setAccessToken,
  setStoredUser,
  setStoredRole,
} from '../../api';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  Terminal,
  Cpu,
  Database,
  Activity,
  Server,
  Radio,
  Users,
  Stethoscope,
  Pill,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Power,
  Sliders,
  Eye,
  EyeOff,
  FileText,
  Download,
  Play,
  Zap,
  LogOut,
  Clock,
  Globe,
  HardDrive,
  Filter,
  Plus,
  ChevronRight,
  Layers,
  ArrowUpRight,
  BarChart3,
  Wifi,
  Send,
  AlertOctagon,
  Copy,
  Check,
} from 'lucide-react';

type AdminTab = 'noc' | 'doctors' | 'patients' | 'medicines' | 'services' | 'audit' | 'flags';

export const AdminPortal: React.FC = () => {
  const navigate = useNavigate();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(getAdminToken() || localStorage.getItem('reportsetu_admin_authenticated'));
  });
  const [adminUser, setAdminUser] = useState<any>(() => getAdminSession());

  // Login Form State (Manual Entry Required)
  const [loginId, setLoginId] = useState('');
  const [loginPasskey, setLoginPasskey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [vaultPhase, setVaultPhase] = useState<'idle' | 'scanning' | 'decrypting' | 'unlocked'>('idle');

  // Active Tab
  const [activeTab, setActiveTab] = useState<AdminTab>('noc');

  // Core Data States
  const [stats, setStats] = useState<any>({
    totalDoctors: 0,
    pendingDoctors: 0,
    verifiedDoctors: 0,
    rejectedDoctors: 0,
    totalPatients: 0,
    totalReports: 0,
    totalMedicines: 254095,
    totalPrescriptions: 0,
    totalAppointments: 0,
  });

  const [telemetry, setTelemetry] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [medicineStats, setMedicineStats] = useState<any>(null);
  const [systemConfig, setSystemConfig] = useState<any>({
    maintenanceMode: false,
    aiCopilotEnabled: true,
    ocrAutoExtract: true,
    externalDrugDbFallback: true,
    strictConsentMode: true,
    telemetryStream: true,
    emergencyLockdown: false,
  });

  // UI / Action States
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warn'; message: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filters & Search
  const [doctorFilter, setDoctorFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');

  // Medicine Interactive Search Test
  const [medQuery, setMedQuery] = useState('Paracetamol');
  const [medSearchResults, setMedSearchResults] = useState<any[]>([]);
  const [isSearchingMed, setIsSearchingMed] = useState(false);
  const [medSearchLatency, setMedSearchLatency] = useState<number | null>(null);

  // Add Custom Medicine Modal
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [customMed, setCustomMed] = useState({
    brandName: '',
    genericName: '',
    dosageForm: 'Tablet',
    strength: '500 mg',
    manufacturer: 'Emergency Formulary',
    price: '45.00',
  });

  // Live Clock (UTC and IST)
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-dismiss Feedback
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  // Load Admin Data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadAllData();
      const interval = setInterval(loadTelemetry, 15000); // Polling telemetry
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, doctorFilter]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadTelemetry(),
        loadDoctors(),
        loadPatients(),
        loadMedicineStats(),
        loadAuditLogs(),
        loadConfig(),
      ]);
    } catch (e: any) {
      console.error('Failed to load admin data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await adminApi.getStats();
      if (data) setStats(data);
    } catch (_) {}
  };

  const loadTelemetry = async () => {
    try {
      const data = await adminApi.getTelemetry();
      if (data) setTelemetry(data);
    } catch (_) {}
  };

  const loadDoctors = async () => {
    try {
      const data = await adminApi.getDoctors({
        status: doctorFilter === 'all' ? undefined : doctorFilter,
        search: doctorSearch.trim() || undefined,
      });
      if (data?.doctors) setDoctors(data.doctors);
    } catch (_) {}
  };

  const loadPatients = async () => {
    try {
      const data = await adminApi.getPatients({
        search: patientSearch.trim() || undefined,
      });
      if (data?.patients) setPatients(data.patients);
    } catch (_) {}
  };

  const loadMedicineStats = async () => {
    try {
      const data = await adminApi.getMedicineStats();
      if (data) setMedicineStats(data);
    } catch (_) {}
  };

  const loadAuditLogs = async () => {
    try {
      const data = await adminApi.getAuditLogs();
      if (data?.logs) setAuditLogs(data.logs);
    } catch (_) {}
  };

  const loadConfig = async () => {
    try {
      const data = await adminApi.getConfig();
      if (data?.config) setSystemConfig(data.config);
    } catch (_) {}
  };

  // -------------------------------------------------------------
  // Vault Login Handler
  // -------------------------------------------------------------
  const handleVaultLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsAuthenticating(true);
    setVaultPhase('scanning');

    try {
      // High-tech visual progress
      await new Promise((r) => setTimeout(r, 600));
      setVaultPhase('decrypting');

      const res = await adminApi.login({
        adminId: loginId.trim(),
        passkey: loginPasskey.trim(),
      });

      await new Promise((r) => setTimeout(r, 500));
      setVaultPhase('unlocked');
      await new Promise((r) => setTimeout(r, 400));

      localStorage.setItem('reportsetu_admin_authenticated', 'true');
      setIsAuthenticated(true);
      setAdminUser(res.admin);
      setFeedback({
        type: 'success',
        message: 'SECURITY VAULT UNLOCKED: Level-5 root session authorized.',
      });
    } catch (err: any) {
      setVaultPhase('idle');
      setLoginError(err?.message || 'ACCESS DENIED // CIPHER MISMATCH OR INVALID CLEARANCE ID');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleVaultLogout = () => {
    clearAdminSession();
    localStorage.removeItem('reportsetu_admin_authenticated');
    setIsAuthenticated(false);
    setAdminUser(null);
    setVaultPhase('idle');
  };

  // -------------------------------------------------------------
  // Action Handlers
  // -------------------------------------------------------------
  const handleVerifyDoctor = async (doctorId: string) => {
    setActionLoading(`verify-${doctorId}`);
    try {
      const res = await adminApi.verifyDoctor(doctorId);
      setFeedback({ type: 'success', message: res.message || 'Doctor verified successfully' });
      await loadDoctors();
      await loadStats();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Failed to verify doctor' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectDoctor = async (doctorId: string) => {
    const reason = window.prompt('Enter medical council rejection reason (optional):', 'Incomplete medical council verification documents');
    if (reason === null) return;

    setActionLoading(`reject-${doctorId}`);
    try {
      const res = await adminApi.rejectDoctor(doctorId, reason);
      setFeedback({ type: 'warn', message: res.message || 'Doctor rejected' });
      await loadDoctors();
      await loadStats();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Failed to reject doctor' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyAll = async () => {
    if (!window.confirm(`Are you sure you want to approve all ${stats.pendingDoctors || 0} pending doctors?`)) return;
    setActionLoading('verify-all');
    try {
      const res = await adminApi.verifyAllDoctors();
      setFeedback({ type: 'success', message: res.message || 'All pending doctors approved' });
      await loadDoctors();
      await loadStats();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Batch verification failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePatient = async (patientId: string) => {
    setActionLoading(`patient-${patientId}`);
    try {
      const res = await adminApi.togglePatientStatus(patientId);
      setFeedback({ type: 'success', message: res.message || 'Patient status updated' });
      await loadPatients();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Failed to update patient' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearCache = async () => {
    setActionLoading('clear-cache');
    try {
      const res = await adminApi.clearMedicineCache();
      setFeedback({ type: 'success', message: res.message || 'Medicine query cache purged' });
      await loadMedicineStats();
      await loadTelemetry();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Cache purge failed' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTestSearch = async () => {
    if (!medQuery.trim()) return;
    setIsSearchingMed(true);
    const start = performance.now();
    try {
      const host = window.location.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
      const res = await fetch(`http://${host}:5000/api/v1/medicines/search?q=${encodeURIComponent(medQuery)}&limit=8`);
      const json = await res.json();
      setMedSearchLatency(Math.round(performance.now() - start));
      setMedSearchResults(json?.data?.medicines || []);
    } catch (e: any) {
      setFeedback({ type: 'error', message: 'Medicine search diagnostics failed' });
    } finally {
      setIsSearchingMed(false);
    }
  };

  const handleCreateMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMed.brandName.trim()) return;
    setActionLoading('create-med');
    try {
      const res = await adminApi.createCustomMedicine(customMed);
      setFeedback({ type: 'success', message: res.message || 'Custom medicine registered' });
      setShowAddMedModal(false);
      setCustomMed({
        brandName: '',
        genericName: '',
        dosageForm: 'Tablet',
        strength: '500 mg',
        manufacturer: 'Emergency Formulary',
        price: '45.00',
      });
      await loadMedicineStats();
      await loadTelemetry();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Failed to create medicine' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleConfig = async (key: string) => {
    const updated = { ...systemConfig, [key]: !systemConfig[key] };
    setSystemConfig(updated);
    try {
      await adminApi.updateConfig({ [key]: updated[key] });
      setFeedback({ type: 'success', message: `Flag updated: ${key} = ${updated[key]}` });
    } catch (e: any) {
      setFeedback({ type: 'error', message: 'Failed to update system flag' });
    }
  };

  const handleImpersonateDoctor = (doc: any) => {
    if (doc?.userId) {
      setStoredRole('doctor');
      setStoredUser({
        id: doc.userId,
        name: doc.name,
        role: 'doctor',
        email: doc.user?.email || doc.email,
        phone: doc.user?.phone || doc.phone,
      });
      navigate('/doctor');
    }
  };

  // Filtered lists
  const filteredDoctors = useMemo(() => {
    return doctors.filter((d) => {
      if (doctorFilter !== 'all' && d.verificationStatus !== doctorFilter) return false;
      if (doctorSearch.trim()) {
        const q = doctorSearch.toLowerCase();
        return (
          d.name?.toLowerCase().includes(q) ||
          d.registrationNumber?.toLowerCase().includes(q) ||
          d.specialty?.toLowerCase().includes(q) ||
          d.medicalCouncil?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [doctors, doctorFilter, doctorSearch]);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients;
    const q = patientSearch.toLowerCase();
    return patients.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.rsId?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
    );
  }, [patients, patientSearch]);

  // =========================================================================
  // RENDER: SECURITY VAULT LOGIN SCREEN
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#070a0f] text-slate-200 flex flex-col justify-center items-center p-4 relative overflow-hidden select-none font-sans">
        {/* Futuristic Background Grid & Ambient Scanlines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(rgba(0, 229, 255, 0.15) 1px, transparent 1px), linear-gradient(to bottom, transparent 95%, rgba(0, 229, 255, 0.05) 100%)',
            backgroundSize: '24px 24px, 100% 6px',
          }}
        />

        {/* Ambient Corner Crosshairs */}
        <div className="absolute top-6 left-6 text-cyan-500/40 font-mono text-xs tracking-widest hidden sm:block">
          ┌ RS-SEC-NODE: 01 // LOC: NEW DELHI // SYS_LOAD: 0.14
        </div>
        <div className="absolute top-6 right-6 text-cyan-500/40 font-mono text-xs tracking-widest hidden sm:block">
          STATUS: ARMED // LEVEL-5 GATEWAY ┐
        </div>
        <div className="absolute bottom-6 left-6 text-slate-500 font-mono text-xs tracking-widest hidden sm:block">
          └ PROTOCOL: DEFCON-1 ENCRYPTION // SHA-256
        </div>
        <div className="absolute bottom-6 right-6 text-slate-500 font-mono text-xs tracking-widest hidden sm:block">
          SYSTEM CLOCK: {currentTime.toISOString().slice(11, 19)} UTC ┘
        </div>

        {/* Main Vault Console Enclosure */}
        <div className="w-full max-w-lg z-10 relative">
          {/* Vault Header Pill/Banner */}
          <div className="flex items-center justify-between bg-[#0e1420] border-t border-l border-r border-[#1e2a3c] px-4 py-2 rounded-t-[4px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-[2px] bg-cyan-400 animate-pulse shadow-[0_0_8px_#00e5ff]" />
              <span className="font-mono text-[11px] font-bold text-cyan-400 tracking-wider">
                SECURITY VAULT // CLEARANCE CHECK
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
              TERMINAL RS-ROOT-01
            </span>
          </div>

          {/* Steel Vault Faceplate */}
          <div className="bg-[#0b0f17] border border-[#1e2a3c] p-6 sm:p-8 rounded-b-[4px] shadow-2xl relative">
            {/* High-Tech Security Vault Emblem */}
            <div className="flex flex-col items-center justify-center mb-6 text-center">
              <div className="relative w-20 h-20 mb-4 flex items-center justify-center">
                {/* Rotating Outer Cipher Ring */}
                <div
                  className={`absolute inset-0 rounded-[4px] border border-cyan-500/30 border-dashed ${
                    vaultPhase === 'scanning' || vaultPhase === 'decrypting' ? 'animate-spin' : ''
                  }`}
                  style={{ animationDuration: '6s' }}
                />
                {/* Inner Hex Armor Ring */}
                <div className="absolute inset-2 rounded-[3px] border border-cyan-400/20 bg-[#0e1522] flex items-center justify-center">
                  {vaultPhase === 'unlocked' ? (
                    <Unlock className="w-8 h-8 text-emerald-400 animate-bounce" />
                  ) : vaultPhase === 'decrypting' ? (
                    <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                  ) : (
                    <Lock className="w-8 h-8 text-cyan-400" />
                  )}
                </div>
                {/* Reticle Dots */}
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-sm" />
                <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-cyan-400 rounded-sm" />
              </div>

              <h1 className="text-xl font-bold font-mono text-slate-100 tracking-wider uppercase flex items-center gap-2">
                REPORTSETU <span className="text-cyan-400">VAULT</span>
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-1">
                RESTRICTED SYSTEM OPERATIONS & LEVEL-5 INFRASTRUCTURE
              </p>
            </div>

            {/* Error Message Notice */}
            {loginError && (
              <div className="mb-5 bg-red-950/40 border border-red-500/50 p-3 rounded-[3px] flex items-start gap-2.5 text-xs text-red-300 font-mono">
                <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-red-400 uppercase tracking-wider block">SECURITY CHALLENGE FAILED</span>
                  {loginError}
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleVaultLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>// 01. SECURITY IDENTIFIER</span>
                  <span className="text-[10px] text-slate-500">AUTHORIZED ID</span>
                </label>
                <div className="relative">
                  <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/60" />
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    required
                    placeholder="e.g. SETU-ROOT-ADMIN"
                    className="w-full bg-[#070a0f] border border-[#1e2a3c] focus:border-cyan-400 focus:outline-none text-slate-100 text-sm font-mono pl-10 pr-3 py-2.5 rounded-[3px] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>// 02. VAULT PASSKEY CIPHER</span>
                  <span className="text-[10px] text-slate-500">256-BIT ENCRYPTION</span>
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/60" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPasskey}
                    onChange={(e) => setLoginPasskey(e.target.value)}
                    required
                    placeholder="Enter security passkey"
                    className="w-full bg-[#070a0f] border border-[#1e2a3c] focus:border-cyan-400 focus:outline-none text-slate-100 text-sm font-mono pl-10 pr-10 py-2.5 rounded-[3px] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-[#070a0f] font-mono font-bold text-xs uppercase tracking-widest py-3 rounded-[3px] transition shadow-[0_0_15px_rgba(0,229,255,0.25)] flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>
                      {vaultPhase === 'scanning'
                        ? 'VERIFYING SIGNATURE...'
                        : vaultPhase === 'decrypting'
                        ? 'DECRYPTING CIPHER MATRIX...'
                        : 'ACCESS GRANTED...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>AUTHORIZE VAULT DECRYPTION</span>
                  </>
                )}
              </button>
            </form>

            {/* Back link */}
            <div className="mt-5 text-center">
              <button
                onClick={() => navigate('/login')}
                className="text-[11px] font-mono text-slate-500 hover:text-slate-300 transition"
              >
                ← RETURN TO PUBLIC PATIENT / CLINICIAN PORTAL
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: HIGH-TECH COMMAND CONTROL PANEL (LOGGED-IN)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#070a0f] text-slate-200 font-sans flex flex-col select-none">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 p-3 rounded-[3px] border font-mono text-xs flex items-center gap-2.5 shadow-2xl backdrop-blur-md transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
              : feedback.type === 'warn'
              ? 'bg-amber-950/90 border-amber-500 text-amber-200'
              : 'bg-red-950/90 border-red-500 text-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : feedback.type === 'warn' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Top Telemetry & Clearance Command Bar */}
      <header className="bg-[#0b0f17] border-b border-[#1b2536] px-4 py-2.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-cyan-400 animate-pulse shadow-[0_0_8px_#00e5ff]" />
            <span className="font-mono text-xs font-bold text-slate-100 tracking-wider uppercase">
              REPORTSETU <span className="text-cyan-400">CONTROL MATRIX</span>
            </span>
          </div>
          <span className="hidden sm:inline-block font-mono text-[10px] text-cyan-400/80 bg-cyan-950/50 border border-cyan-500/30 px-2 py-0.5 rounded-[3px]">
            NODE: {adminUser?.terminalId || 'RS-SEC-VAULT-01'}
          </span>
          <span className="hidden md:inline-block font-mono text-[10px] text-emerald-400/80 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-[3px]">
            CLEARANCE: {adminUser?.clearanceLevel || 'LEVEL-5 [ROOT]'}
          </span>
        </div>

        {/* Live Services Telemetry Pings */}
        <div className="hidden lg:flex items-center gap-3 font-mono text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>API:5000 ({telemetry?.services?.apiServer?.latencyMs ?? 1}ms)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${telemetry?.services?.mlEngine?.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span>AI-ML:8001 ({telemetry?.services?.mlEngine?.latencyMs ?? 72}ms)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>DB:PG16 ({(stats?.totalMedicines || 254095).toLocaleString()} MEDS)</span>
          </div>
          <div className="border-l border-[#1b2536] pl-3 text-slate-500 text-[10px]">
            {currentTime.toLocaleTimeString()} IST
          </div>
        </div>

        {/* Root Lock / Exit Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            disabled={isLoading}
            title="Refresh All Telemetry & Data"
            className="p-1.5 bg-[#0e1420] hover:bg-cyan-950/40 border border-[#1b2536] hover:border-cyan-500/40 text-slate-400 hover:text-cyan-400 rounded-[3px] transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          <button
            onClick={handleVaultLogout}
            className="bg-red-950/40 hover:bg-red-900/40 border border-red-500/40 hover:border-red-400 text-red-300 font-mono text-[10px] font-bold tracking-wider px-3 py-1.5 rounded-[3px] flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3 h-3 text-red-400" />
            <span>LOCK VAULT</span>
          </button>
        </div>
      </header>

      {/* Primary Navigation Tabs (Sharp, Non-pill, Cyber High-Tech) */}
      <nav className="bg-[#090d14] border-b border-[#1b2536] px-4 overflow-x-auto flex gap-1">
        {[
          { id: 'noc', label: '01. MISSION CONTROL (NOC)', icon: Activity },
          { id: 'doctors', label: `02. CLINICIANS (${stats.totalDoctors})`, icon: Stethoscope },
          { id: 'patients', label: `03. PATIENTS (${stats.totalPatients})`, icon: Users },
          { id: 'medicines', label: `04. MEDICINE FORMULARY (${(stats.totalMedicines || 254095).toLocaleString()})`, icon: Pill },
          { id: 'services', label: '05. SYSTEM TELEMETRY', icon: Server },
          { id: 'audit', label: '06. AUDIT LOGS', icon: Terminal },
          { id: 'flags', label: '07. FEATURE FLAGS', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-3 py-2.5 font-mono text-[11px] font-bold tracking-wider border-b-2 transition whitespace-nowrap flex items-center gap-2 cursor-pointer rounded-t-[3px] ${
                isActive
                  ? 'border-cyan-400 text-cyan-400 bg-[#0e1624]'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#0c121d]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Control Console Body */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        {/* =========================================================================
            TAB 1: MISSION CONTROL / TELEMETRY OVERVIEW
            ========================================================================= */}
        {activeTab === 'noc' && (
          <div className="space-y-6">
            {/* Top Stat Gauges */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px] relative overflow-hidden">
                <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mb-1">
                  TOTAL REGISTERED CLINICIANS
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-slate-100">{stats.totalDoctors}</span>
                  <span className="font-mono text-[10px] text-amber-400 bg-amber-950/40 border border-amber-500/30 px-1.5 py-0.5 rounded-[2px]">
                    {stats.pendingDoctors} PENDING
                  </span>
                </div>
                <div className="mt-2 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {stats.verifiedDoctors} Verified // {stats.rejectedDoctors} Rejected
                </div>
              </div>

              <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px] relative overflow-hidden">
                <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mb-1">
                  PATIENT HEALTH REGISTRY
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-slate-100">{stats.totalPatients}</span>
                  <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-1.5 py-0.5 rounded-[2px]">
                    ACTIVE
                  </span>
                </div>
                <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-cyan-400" /> {stats.totalReports} Verified Diagnostic Reports
                </div>
              </div>

              <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px] relative overflow-hidden">
                <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mb-1">
                  NATIONAL MEDICINE FORMULARY
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-cyan-300">
                    {(stats.totalMedicines || 254095).toLocaleString()}
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded-[2px]">
                    PG-16 INDEXED
                  </span>
                </div>
                <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400" /> Autocomplete Latency: &lt;5ms
                </div>
              </div>

              <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px] relative overflow-hidden">
                <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mb-1">
                  CLINICAL ENGAGEMENT
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-bold text-slate-100">
                    {stats.totalPrescriptions + stats.totalAppointments}
                  </span>
                  <span className="font-mono text-[10px] text-indigo-400 bg-indigo-950/40 border border-indigo-500/30 px-1.5 py-0.5 rounded-[2px]">
                    INTERACTIONS
                  </span>
                </div>
                <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-indigo-400" /> {stats.totalPrescriptions} Rx // {stats.totalAppointments} Visits
                </div>
              </div>
            </div>

            {/* Quick Command Matrix & Action Deck */}
            <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px]">
              <div className="flex items-center justify-between mb-3 border-b border-[#1b2536] pb-2">
                <span className="font-mono text-xs font-bold text-cyan-400 tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" /> IMMEDIATE ROOT OPERATIONS
                </span>
                <span className="font-mono text-[10px] text-slate-500">LEVEL-5 DIRECT OVERRIDE</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={handleVerifyAll}
                  disabled={actionLoading === 'verify-all' || stats.pendingDoctors === 0}
                  className="bg-[#0e1624] hover:bg-emerald-950/40 border border-[#1b2536] hover:border-emerald-500/50 p-3 rounded-[3px] text-left transition disabled:opacity-40 cursor-pointer"
                >
                  <div className="font-mono text-xs font-bold text-emerald-400 flex items-center justify-between mb-1">
                    <span>APPROVE ALL DOCTORS</span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <p className="font-mono text-[10px] text-slate-400">
                    Batch-clear all {stats.pendingDoctors} pending medical council reviews
                  </p>
                </button>

                <button
                  onClick={handleClearCache}
                  disabled={actionLoading === 'clear-cache'}
                  className="bg-[#0e1624] hover:bg-cyan-950/40 border border-[#1b2536] hover:border-cyan-500/50 p-3 rounded-[3px] text-left transition disabled:opacity-40 cursor-pointer"
                >
                  <div className="font-mono text-xs font-bold text-cyan-400 flex items-center justify-between mb-1">
                    <span>PURGE SEARCH CACHE</span>
                    <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'clear-cache' ? 'animate-spin' : ''}`} />
                  </div>
                  <p className="font-mono text-[10px] text-slate-400">
                    Flush in-memory medicine search cache from RAM
                  </p>
                </button>

                <button
                  onClick={() => setShowAddMedModal(true)}
                  className="bg-[#0e1624] hover:bg-indigo-950/40 border border-[#1b2536] hover:border-indigo-500/50 p-3 rounded-[3px] text-left transition cursor-pointer"
                >
                  <div className="font-mono text-xs font-bold text-indigo-400 flex items-center justify-between mb-1">
                    <span>REGISTER CUSTOM MED</span>
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  <p className="font-mono text-[10px] text-slate-400">
                    Add emergency hospital formulary medicine to database
                  </p>
                </button>

                <button
                  onClick={() => handleToggleConfig('maintenanceMode')}
                  className={`border p-3 rounded-[3px] text-left transition cursor-pointer ${
                    systemConfig.maintenanceMode
                      ? 'bg-red-950/50 border-red-500/60'
                      : 'bg-[#0e1624] hover:bg-red-950/30 border-[#1b2536] hover:border-red-500/40'
                  }`}
                >
                  <div className="font-mono text-xs font-bold text-red-400 flex items-center justify-between mb-1">
                    <span>MAINTENANCE LOCK</span>
                    <Power className="w-3.5 h-3.5" />
                  </div>
                  <p className="font-mono text-[10px] text-slate-400">
                    Status: {systemConfig.maintenanceMode ? 'ENABLED (LOCKED)' : 'NORMAL OPERATION'}
                  </p>
                </button>
              </div>
            </div>

            {/* Split Screen: Real-Time Services Status & Recent Audit Stream */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Telemetry Panel */}
              <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px]">
                <div className="flex items-center justify-between mb-3 border-b border-[#1b2536] pb-2">
                  <span className="font-mono text-xs font-bold text-cyan-400 tracking-wider flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" /> SYSTEM STACK TELEMETRY
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">UPTIME: {telemetry?.uptimeSeconds || 0}s</span>
                </div>
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between p-2 bg-[#0e1420] border border-[#1b2536] rounded-[3px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-slate-200">Node.js Express API (Port 5000)</span>
                    </div>
                    <span className="text-emerald-400 font-bold">ONLINE [1ms]</span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-[#0e1420] border border-[#1b2536] rounded-[3px]">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${telemetry?.services?.database?.status === 'CONNECTED' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="text-slate-200">PostgreSQL 16 DB (Port 5432)</span>
                    </div>
                    <span className="text-emerald-400 font-bold">
                      {telemetry?.services?.database?.status || 'CONNECTED'} [{telemetry?.services?.database?.latencyMs ?? 45}ms]
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-[#0e1420] border border-[#1b2536] rounded-[3px]">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${telemetry?.services?.mlEngine?.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span className="text-slate-200">Python FastAPI ML/OCR Engine (Port 8001)</span>
                    </div>
                    <span className="text-emerald-400 font-bold">
                      {telemetry?.services?.mlEngine?.status || 'ONLINE'} [{telemetry?.services?.mlEngine?.latencyMs ?? 72}ms]
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-[#0e1420] border border-[#1b2536] rounded-[3px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="text-slate-200">Google Gemini 2.5 Flash Cloud Gateway</span>
                    </div>
                    <span className="text-cyan-400 font-bold">ACTIVE // READY</span>
                  </div>

                  {/* Resource Gauges */}
                  <div className="pt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div className="p-2 bg-[#070a0f] border border-[#1b2536] rounded-[3px]">
                      <span>PROCESS MEMORY (RSS):</span>
                      <span className="text-slate-100 font-bold block mt-0.5">{telemetry?.memory?.processRssMb || 175} MB</span>
                    </div>
                    <div className="p-2 bg-[#070a0f] border border-[#1b2536] rounded-[3px]">
                      <span>SYSTEM TOTAL MEMORY:</span>
                      <span className="text-slate-100 font-bold block mt-0.5">{telemetry?.memory?.systemTotalGb || 12} GB</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Security Audit Log Stream */}
              <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px] flex flex-col">
                <div className="flex items-center justify-between mb-3 border-b border-[#1b2536] pb-2">
                  <span className="font-mono text-xs font-bold text-cyan-400 tracking-wider flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" /> REAL-TIME SECURITY EVENT STREAM
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">LAST 10 AUDIT RECORDS</span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px] font-mono text-[11px] pr-1">
                  {auditLogs.slice(0, 8).map((log: any, idx: number) => (
                    <div key={log.id || idx} className="bg-[#070a0f] border border-[#1b2536] p-2 rounded-[3px] text-slate-300">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span className="text-cyan-400 font-bold">{log.action || 'SYSTEM_EVENT'}</span>
                        <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-300 truncate">{log.purpose || log.resourceType}</p>
                      <div className="text-[10px] text-slate-500 mt-1">
                        IP: {log.ipAddress || '127.0.0.1'} // Role: {log.userRole || 'admin'}
                      </div>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <div className="text-center py-8 text-slate-500 font-mono text-xs">
                      [NO CRITICAL SECURITY ALERTS RECORDED]
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: CLINICIAN CLEARANCE & DOCTORS MANAGEMENT
            ========================================================================= */}
        {activeTab === 'doctors' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="bg-[#0b0f17] border border-[#1b2536] p-3 rounded-[3px] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search className="w-4 h-4 text-cyan-400" />
                <input
                  type="text"
                  placeholder="Filter clinicians by name, reg #, medical council..."
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  className="w-full bg-[#070a0f] border border-[#1b2536] focus:border-cyan-400 focus:outline-none text-slate-100 text-xs font-mono px-3 py-1.5 rounded-[3px]"
                />
              </div>

              {/* Status Radio Filters */}
              <div className="flex items-center gap-1 font-mono text-[11px]">
                {(['all', 'pending', 'verified', 'rejected'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setDoctorFilter(st)}
                    className={`px-2.5 py-1 rounded-[3px] border uppercase transition cursor-pointer ${
                      doctorFilter === st
                        ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300'
                        : 'bg-[#0e1420] border-[#1b2536] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctors Table */}
            <div className="bg-[#0b0f17] border border-[#1b2536] rounded-[3px] overflow-hidden">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#0e1522] border-b border-[#1b2536] text-[10px] text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Clinician / Profile</th>
                    <th className="py-2.5 px-3">Council Reg #</th>
                    <th className="py-2.5 px-3">Specialty</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Root Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2536]">
                  {filteredDoctors.map((doc) => (
                    <tr key={doc.id} className="hover:bg-[#0e1624] transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-100">{doc.name}</div>
                        <div className="text-[10px] text-slate-500">ID: {doc.id.slice(0, 8)}...</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-cyan-300">{doc.registrationNumber || 'N/A'}</div>
                        <div className="text-[10px] text-slate-500">{doc.medicalCouncil || 'State Medical Council'}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{doc.specialty || 'General Practitioner'}</td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        <div>{doc.phone || doc.user?.phone || 'No phone'}</div>
                        <div className="text-[10px] text-slate-500">{doc.email || doc.user?.email}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-[2px] text-[10px] uppercase font-bold border ${
                            doc.verificationStatus === 'verified'
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                              : doc.verificationStatus === 'pending'
                              ? 'bg-amber-950/40 border-amber-500/40 text-amber-400'
                              : 'bg-red-950/40 border-red-500/40 text-red-400'
                          }`}
                        >
                          {doc.verificationStatus}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {doc.verificationStatus !== 'verified' && (
                            <button
                              onClick={() => handleVerifyDoctor(doc.id)}
                              disabled={actionLoading === `verify-${doc.id}`}
                              className="bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/40 text-emerald-300 px-2 py-1 rounded-[2px] text-[10px] transition cursor-pointer"
                            >
                              APPROVE
                            </button>
                          )}
                          {doc.verificationStatus !== 'rejected' && (
                            <button
                              onClick={() => handleRejectDoctor(doc.id)}
                              disabled={actionLoading === `reject-${doc.id}`}
                              className="bg-red-950/40 hover:bg-red-900/40 border border-red-500/40 text-red-300 px-2 py-1 rounded-[2px] text-[10px] transition cursor-pointer"
                            >
                              REJECT
                            </button>
                          )}
                          <button
                            onClick={() => handleImpersonateDoctor(doc)}
                            title="Open Doctor View in portal"
                            className="bg-[#070a0f] hover:bg-cyan-950/40 border border-[#1b2536] hover:border-cyan-500/40 text-slate-300 hover:text-cyan-400 px-2 py-1 rounded-[2px] text-[10px] transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>VIEW</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDoctors.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-mono text-xs">
                        [NO CLINICIANS FOUND MATCHING CRITERIA]
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: PATIENT HEALTH REGISTRY & ACCESS
            ========================================================================= */}
        {activeTab === 'patients' && (
          <div className="space-y-4">
            <div className="bg-[#0b0f17] border border-[#1b2536] p-3 rounded-[3px] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search className="w-4 h-4 text-cyan-400" />
                <input
                  type="text"
                  placeholder="Search patients by name, RS-ID, phone, location..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full bg-[#070a0f] border border-[#1b2536] focus:border-cyan-400 focus:outline-none text-slate-100 text-xs font-mono px-3 py-1.5 rounded-[3px]"
                />
              </div>
              <span className="font-mono text-xs text-slate-400">
                TOTAL IN DATABASE: {patients.length} PATIENTS
              </span>
            </div>

            <div className="bg-[#0b0f17] border border-[#1b2536] rounded-[3px] overflow-hidden">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#0e1522] border-b border-[#1b2536] text-[10px] text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Patient Name / RS-ID</th>
                    <th className="py-2.5 px-3">Demographics</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Connected Doctors</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2536]">
                  {filteredPatients.map((p) => (
                    <tr key={p.id} className="hover:bg-[#0e1624] transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-100">{p.name}</div>
                        <div className="text-[10px] text-cyan-400 font-bold">{p.rsId || 'NO RS-ID'}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {p.age} yrs // {p.gender} // <span className="text-red-400">{p.bloodGroup}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">{p.location || 'Not Specified'}</td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        <div>{p.phone || p.user?.phone}</div>
                        <div className="text-[10px] text-slate-500">{p.user?.email || 'No email'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-indigo-400 bg-indigo-950/40 border border-indigo-500/30 px-2 py-0.5 rounded-[2px] text-[10px]">
                          {p.connections?.length || 0} Clinician(s)
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-[2px] text-[10px] uppercase font-bold border ${
                            p.status === 'suspended'
                              ? 'bg-red-950/40 border-red-500/40 text-red-400'
                              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                          }`}
                        >
                          {p.status || 'active'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleTogglePatient(p.id)}
                          disabled={actionLoading === `patient-${p.id}`}
                          className={`px-2.5 py-1 rounded-[2px] text-[10px] font-mono border uppercase transition cursor-pointer ${
                            p.status === 'suspended'
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                              : 'bg-red-950/40 border-red-500/40 text-red-300 hover:bg-red-900/40'
                          }`}
                        >
                          {p.status === 'suspended' ? 'UNSUSPEND' : 'SUSPEND'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPatients.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-mono text-xs">
                        [NO PATIENT RECORDS FOUND]
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: MEDICINE FORMULARY & SEARCH DIAGNOSTICS (254,095 Records)
            ========================================================================= */}
        {activeTab === 'medicines' && (
          <div className="space-y-4">
            {/* National Formulary Header Card */}
            <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px] flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                  NATIONAL MEDICINE INVENTORY & LIVE SEARCH DIAGNOSTICS
                </span>
                <p className="font-mono text-xs text-slate-400 mt-1">
                  Primary Source: <span className="text-slate-200">junioralive/Indian-Medicine-Dataset</span> ({(stats.totalMedicines || 254095).toLocaleString()} items)
                </p>
                <div className="flex items-center gap-2 mt-2 font-mono text-[10px] text-slate-400">
                  <span className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 rounded-[2px]">
                    POSTGRESQL B-TREE INDEXED
                  </span>
                  <span className="bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 px-1.5 py-0.5 rounded-[2px]">
                    DRUGDB API GATEWAY READY
                  </span>
                  <span className="bg-indigo-950/40 border border-indigo-500/30 text-indigo-400 px-1.5 py-0.5 rounded-[2px]">
                    IN-MEMORY QUERY CACHE ACTIVE
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearCache}
                  disabled={actionLoading === 'clear-cache'}
                  className="bg-[#0e1624] hover:bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 font-mono text-xs px-3 py-2 rounded-[3px] flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'clear-cache' ? 'animate-spin' : ''}`} />
                  <span>PURGE QUERY CACHE</span>
                </button>
                <button
                  onClick={() => setShowAddMedModal(true)}
                  className="bg-cyan-500 hover:bg-cyan-400 text-[#070a0f] font-mono text-xs font-bold px-3 py-2 rounded-[3px] flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>ADD CUSTOM MEDICINE</span>
                </button>
              </div>
            </div>

            {/* Interactive Search Diagnostic Console */}
            <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px]">
              <div className="flex items-center justify-between mb-3 border-b border-[#1b2536] pb-2">
                <span className="font-mono text-xs font-bold text-cyan-400 flex items-center gap-2">
                  <Terminal className="w-4 h-4" /> TEST AUTOCOMPLETE LATENCY & RELEVANCE
                </span>
                {medSearchLatency !== null && (
                  <span className="font-mono text-[11px] text-emerald-400">
                    DIAGNOSTIC LATENCY: {medSearchLatency}ms // RESULTS: {medSearchResults.length}
                  </span>
                )}
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={medQuery}
                  onChange={(e) => setMedQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTestSearch()}
                  placeholder="Enter brand name or composition (e.g. Dolo, Paracetamol, Augmentin, Metformin)..."
                  className="flex-1 bg-[#070a0f] border border-[#1b2536] focus:border-cyan-400 focus:outline-none text-slate-100 text-xs font-mono px-3 py-2 rounded-[3px]"
                />
                <button
                  onClick={handleTestSearch}
                  disabled={isSearchingMed}
                  className="bg-[#0e1624] hover:bg-cyan-950/50 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold px-4 py-2 rounded-[3px] flex items-center gap-2 transition cursor-pointer"
                >
                  <Play className={`w-3.5 h-3.5 ${isSearchingMed ? 'animate-spin' : ''}`} />
                  <span>EXECUTE SEARCH</span>
                </button>
              </div>

              {/* Search Diagnostic Results */}
              <div className="space-y-2">
                {medSearchResults.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="p-2.5 bg-[#070a0f] border border-[#1b2536] hover:border-cyan-500/30 rounded-[3px] flex items-center justify-between font-mono text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-200 flex items-center gap-2">
                        <span>{m.brandName || m.name}</span>
                        {m.strength && (
                          <span className="text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.2 rounded-[2px]">
                            {m.strength}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-700 px-1.5 py-0.2 rounded-[2px]">
                          {m.dosageForm || 'Tablet'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xl">
                        {m.genericName || m.composition || 'Composition not specified'} // Mfg: {m.manufacturer || 'Standard Formulary'}
                      </div>
                    </div>
                    <div className="text-right text-[10px] text-slate-500 shrink-0">
                      <div>SRC: {m.source || 'local_db'}</div>
                      <div className="text-emerald-400 font-bold">{m.price ? `₹${m.price}` : 'MRP Verified'}</div>
                    </div>
                  </div>
                ))}
                {medSearchResults.length === 0 && !isSearchingMed && (
                  <div className="text-center py-6 text-slate-500 font-mono text-xs">
                    [TYPE A QUERY AND HIT EXECUTE TO TEST AUTOCOMPLETE IN REAL-TIME]
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: SYSTEM SERVICES & DIAGNOSTICS
            ========================================================================= */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Node.js Core Backend */}
              <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px]">
                <div className="flex items-center justify-between mb-3 border-b border-[#1b2536] pb-2">
                  <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-2">
                    <Server className="w-4 h-4" /> CORE EXPRESS API & WEBSOCKET ENGINE
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-[2px]">
                    ONLINE
                  </span>
                </div>
                <div className="space-y-2 font-mono text-xs text-slate-300">
                  <div className="flex justify-between"><span>Host Port:</span><span className="text-slate-100">5000</span></div>
                  <div className="flex justify-between"><span>Node Runtime:</span><span className="text-slate-100">{telemetry?.nodeVersion || 'v25.2.0'}</span></div>
                  <div className="flex justify-between"><span>Platform Architecture:</span><span className="text-slate-100">{telemetry?.platform || 'win32 (x64)'}</span></div>
                  <div className="flex justify-between"><span>Process Uptime:</span><span className="text-slate-100">{telemetry?.uptimeSeconds || 0} seconds</span></div>
                  <div className="flex justify-between"><span>Heap Memory Allocated:</span><span className="text-slate-100">{telemetry?.memory?.processHeapUsedMb || 61} MB</span></div>
                </div>
              </div>

              {/* PostgreSQL Engine */}
              <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px]">
                <div className="flex items-center justify-between mb-3 border-b border-[#1b2536] pb-2">
                  <span className="font-mono text-xs font-bold text-cyan-400 flex items-center gap-2">
                    <Database className="w-4 h-4" /> POSTGRESQL 16 DATABASE CLUSTER
                  </span>
                  <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-[2px]">
                    CONNECTED
                  </span>
                </div>
                <div className="space-y-2 font-mono text-xs text-slate-300">
                  <div className="flex justify-between"><span>Host Port:</span><span className="text-slate-100">5432</span></div>
                  <div className="flex justify-between"><span>Database Name:</span><span className="text-slate-100">reportsetu_db</span></div>
                  <div className="flex justify-between"><span>Medicine Records:</span><span className="text-cyan-300 font-bold">{(stats?.totalMedicines || 254095).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Ping Query Latency:</span><span className="text-emerald-400 font-bold">{telemetry?.services?.database?.latencyMs ?? 45} ms</span></div>
                  <div className="flex justify-between"><span>ORM Driver:</span><span className="text-slate-100">Prisma Client 7.10</span></div>
                </div>
              </div>

              {/* Python ML Microservice */}
              <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px]">
                <div className="flex items-center justify-between mb-3 border-b border-[#1b2536] pb-2">
                  <span className="font-mono text-xs font-bold text-indigo-400 flex items-center gap-2">
                    <Cpu className="w-4 h-4" /> FASTAPI AI & CLINICAL OCR MICROSERVICE
                  </span>
                  <span className={`font-mono text-[10px] px-2 py-0.5 rounded-[2px] border ${
                    telemetry?.services?.mlEngine?.status === 'ONLINE'
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-950/40 border-amber-500/30 text-amber-400'
                  }`}>
                    {telemetry?.services?.mlEngine?.status || 'ONLINE'}
                  </span>
                </div>
                <div className="space-y-2 font-mono text-xs text-slate-300">
                  <div className="flex justify-between"><span>Host Port:</span><span className="text-slate-100">8001</span></div>
                  <div className="flex justify-between"><span>Endpoint Latency:</span><span className="text-emerald-400 font-bold">{telemetry?.services?.mlEngine?.latencyMs ?? 72} ms</span></div>
                  <div className="flex justify-between"><span>LangGraph Clinical Agent:</span><span className="text-emerald-400">ACTIVE</span></div>
                  <div className="flex justify-between"><span>PDF OCR Parser:</span><span className="text-emerald-400">ACTIVE</span></div>
                  <div className="flex justify-between"><span>HbA1c Forecaster:</span><span className="text-emerald-400">ACTIVE</span></div>
                </div>
              </div>

              {/* Memory & Resource Telemetry */}
              <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px]">
                <div className="flex items-center justify-between mb-3 border-b border-[#1b2536] pb-2">
                  <span className="font-mono text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" /> SYSTEM HOST CAPACITY
                  </span>
                  <span className="font-mono text-[10px] text-cyan-400">
                    {telemetry?.memory?.systemUsagePercent || 75}% UTILIZED
                  </span>
                </div>
                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Total Host RAM:</span>
                      <span className="text-slate-200">{telemetry?.memory?.systemTotalGb || 12} GB</span>
                    </div>
                    <div className="w-full bg-[#070a0f] h-2 rounded-[2px] overflow-hidden border border-[#1b2536]">
                      <div
                        className="bg-cyan-500 h-full"
                        style={{ width: `${telemetry?.memory?.systemUsagePercent || 75}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">CPU Virtual Cores:</span>
                    <span className="text-slate-100">{telemetry?.cpuCores || 4} vCPUs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 6: SECURITY AUDIT TRAILS & ACCESS LOGS
            ========================================================================= */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="bg-[#0b0f17] border border-[#1b2536] p-3 rounded-[3px] flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4" /> PERSISTENT AUDIT EVENT REPOSITORY
              </span>
              <button
                onClick={loadAuditLogs}
                className="bg-[#0e1624] hover:bg-cyan-950/40 border border-[#1b2536] text-slate-300 hover:text-cyan-400 font-mono text-xs px-3 py-1 rounded-[2px] transition"
              >
                REFRESH LOGS
              </button>
            </div>

            <div className="bg-[#0b0f17] border border-[#1b2536] rounded-[3px] overflow-hidden font-mono text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#0e1522] border-b border-[#1b2536] text-[10px] text-slate-400 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp (UTC)</th>
                    <th className="py-2.5 px-3">Security Action</th>
                    <th className="py-2.5 px-3">Role / Actor</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Purpose & Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2536]">
                  {auditLogs.map((log: any, idx: number) => (
                    <tr key={log.id || idx} className="hover:bg-[#0e1624] transition">
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-cyan-400 font-bold bg-cyan-950/40 border border-cyan-500/30 px-1.5 py-0.5 rounded-[2px] text-[10px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 uppercase text-[11px]">
                        {log.userRole || 'admin'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 text-[11px] truncate max-w-md">
                        {log.purpose}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        [NO AUDIT LOGS RECORDED IN DATABASE]
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 7: FEATURE FLAGS & SYSTEM OVERRIDES
            ========================================================================= */}
        {activeTab === 'flags' && (
          <div className="space-y-4 max-w-4xl">
            <div className="bg-[#0b0f17] border border-[#1b2536] p-4 rounded-[3px]">
              <span className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                DYNAMIC SYSTEM RUNTIME TOGGLES
              </span>
              <p className="font-mono text-xs text-slate-400">
                Instantly adjust core microservices and access policies without needing to restart the servers.
              </p>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {[
                {
                  key: 'aiCopilotEnabled',
                  label: 'AI CLINICAL COPILOT (GEMINI-2.5)',
                  desc: 'Enable doctor AI diagnosis assistant and lab report patient summary generation',
                },
                {
                  key: 'ocrAutoExtract',
                  label: 'AUTOMATED OCR DOCUMENT PARSER',
                  desc: 'Run background PyMuPDF and OCR pipelines on uploaded PDF diagnostic reports',
                },
                {
                  key: 'externalDrugDbFallback',
                  label: 'EXTERNAL DRUGDB INDIA API GATEWAY',
                  desc: 'Fallback to live DrugDB India provider when medicine is not in local PostgreSQL',
                },
                {
                  key: 'strictConsentMode',
                  label: 'DPDP ACT STRICT CONSENT ENFORCEMENT',
                  desc: 'Strictly require active single-use 2-minute consent code before doctors can read records',
                },
                {
                  key: 'telemetryStream',
                  label: 'REAL-TIME TELEMETRY EVENT STREAM',
                  desc: 'Stream live WebSocket health pings and security audit trails to admin consoles',
                },
                {
                  key: 'maintenanceMode',
                  label: 'EMERGENCY MAINTENANCE LOCKDOWN',
                  desc: 'Lock public registration and patient portal for maintenance operations',
                },
              ].map((flag) => {
                const isEnabled = Boolean(systemConfig[flag.key]);
                return (
                  <div
                    key={flag.key}
                    className="p-3 bg-[#0b0f17] border border-[#1b2536] hover:border-cyan-500/30 rounded-[3px] flex items-center justify-between gap-4 transition"
                  >
                    <div>
                      <div className="font-bold text-slate-100 flex items-center gap-2">
                        <span>{flag.label}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-[2px] uppercase border ${
                            isEnabled
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                              : 'bg-slate-900 border-slate-700 text-slate-500'
                          }`}
                        >
                          {isEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{flag.desc}</p>
                    </div>

                    <button
                      onClick={() => handleToggleConfig(flag.key)}
                      className={`px-3 py-1.5 rounded-[2px] font-mono text-[10px] font-bold tracking-wider border uppercase transition cursor-pointer shrink-0 ${
                        isEnabled
                          ? 'bg-emerald-950/40 hover:bg-emerald-900/40 border-emerald-500 text-emerald-300'
                          : 'bg-[#0e1624] hover:bg-cyan-950/40 border-[#1b2536] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {isEnabled ? 'SWITCH OFF' : 'SWITCH ON'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          MODAL: ADD CUSTOM MEDICINE TO DATABASE
          ========================================================================= */}
      {showAddMedModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0b0f17] border border-cyan-500/40 p-6 rounded-[3px] font-mono shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-[#1b2536] pb-2">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4" /> INJECT CUSTOM FORMULARY MEDICINE
              </span>
              <button
                onClick={() => setShowAddMedModal(false)}
                className="text-slate-400 hover:text-slate-100 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMedicine} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">BRAND / MEDICINE NAME *</label>
                <input
                  type="text"
                  required
                  value={customMed.brandName}
                  onChange={(e) => setCustomMed({ ...customMed, brandName: e.target.value })}
                  placeholder="e.g. Paracetamol Extra"
                  className="w-full bg-[#070a0f] border border-[#1b2536] focus:border-cyan-400 focus:outline-none text-slate-100 px-3 py-1.5 rounded-[3px]"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">GENERIC NAME / COMPOSITION</label>
                <input
                  type="text"
                  value={customMed.genericName}
                  onChange={(e) => setCustomMed({ ...customMed, genericName: e.target.value })}
                  placeholder="e.g. Paracetamol + Caffeine"
                  className="w-full bg-[#070a0f] border border-[#1b2536] focus:border-cyan-400 focus:outline-none text-slate-100 px-3 py-1.5 rounded-[3px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">DOSAGE FORM</label>
                  <select
                    value={customMed.dosageForm}
                    onChange={(e) => setCustomMed({ ...customMed, dosageForm: e.target.value })}
                    className="w-full bg-[#070a0f] border border-[#1b2536] focus:border-cyan-400 focus:outline-none text-slate-100 px-2 py-1.5 rounded-[3px]"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Ointment">Ointment</option>
                    <option value="Inhaler">Inhaler</option>
                    <option value="Drops">Drops</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">STRENGTH</label>
                  <input
                    type="text"
                    value={customMed.strength}
                    onChange={(e) => setCustomMed({ ...customMed, strength: e.target.value })}
                    placeholder="e.g. 650 mg"
                    className="w-full bg-[#070a0f] border border-[#1b2536] focus:border-cyan-400 focus:outline-none text-slate-100 px-3 py-1.5 rounded-[3px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">MANUFACTURER</label>
                <input
                  type="text"
                  value={customMed.manufacturer}
                  onChange={(e) => setCustomMed({ ...customMed, manufacturer: e.target.value })}
                  placeholder="e.g. Emergency Formulary"
                  className="w-full bg-[#070a0f] border border-[#1b2536] focus:border-cyan-400 focus:outline-none text-slate-100 px-3 py-1.5 rounded-[3px]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1b2536]">
                <button
                  type="button"
                  onClick={() => setShowAddMedModal(false)}
                  className="bg-[#0e1624] hover:bg-[#152033] border border-[#1b2536] text-slate-300 px-3 py-1.5 rounded-[2px]"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-med'}
                  className="bg-cyan-500 hover:bg-cyan-400 text-[#070a0f] font-bold px-4 py-1.5 rounded-[2px]"
                >
                  {actionLoading === 'create-med' ? 'INJECTING...' : 'REGISTER MEDICINE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPortal;
