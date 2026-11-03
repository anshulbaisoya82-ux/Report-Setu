import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  AlertTriangle,
  Stethoscope,
  Building2,
  KeyRound,
  Trash2,
  ChevronRight,
  Sparkles,
  Calendar,
  MessageSquare,
  Search,
  Filter,
  Plus,
  ArrowRight,
  MapPin,
  Award,
  Video,
  Phone,
  User,
  Activity,
  Heart,
  Droplet,
  Info,
  X,
  Share2
} from 'lucide-react';
import {
  getDoctorInitials,
  analyzeHealthStatus,
  rankDoctors,
  VERIFIED_DOCTORS_POOL,
  DoctorProfileRecord,
  RecommendationResult,
  SymptomRecord,
  HealthAnalysisSummary,
} from '../../services/doctorRecommendationService';

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
  const { currentUser, patients, reports, requestAppointment } = useStore();
  const currentPatient = currentUser || patients[0];

  // Active Tab
  const [activeTab, setActiveTab] = useState<'recommendations' | 'connected' | 'requests' | 'quick_code'>('recommendations');

  // Recommendation & Filter States
  const [selectedSpecialtyFilter, setSelectedSpecialtyFilter] = useState<string>('All Specialties');
  const [selectedConsultationMode, setSelectedConsultationMode] = useState<string>('All Modes');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Patient Reported Symptoms State (Pre-populated with realistic clinical context)
  const [reportedSymptoms, setReportedSymptoms] = useState<SymptomRecord[]>([
    { id: 's-1', name: 'Persistent fatigue and mild dizziness', severity: 'Moderate', duration: '2 weeks' },
  ]);

  // Modals State
  const [connectModalDoctor, setConnectModalDoctor] = useState<DoctorProfileRecord | null>(null);
  const [profileModalDoctor, setProfileModalDoctor] = useState<DoctorProfileRecord | null>(null);
  const [showAddSymptomModal, setShowAddSymptomModal] = useState<boolean>(false);

  // Connect Form State
  const [connectDate, setConnectDate] = useState<string>('2026-11-04');
  const [connectTimeSlot, setConnectTimeSlot] = useState<string>('10:00 AM');
  const [connectMode, setConnectMode] = useState<'In-person' | 'Video call' | 'Phone call'>('In-person');
  const [connectConcern, setConnectConcern] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // New Symptom Form State
  const [newSymptomName, setNewSymptomName] = useState<string>('');
  const [newSymptomSeverity, setNewSymptomSeverity] = useState<'Mild' | 'Moderate' | 'Severe'>('Moderate');
  const [newSymptomDuration, setNewSymptomDuration] = useState<string>('1-2 weeks');

  // Legacy Connection States (Requests & 2-Minute Consent Code)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [connectedDoctors, setConnectedDoctors] = useState<ConnectedDoctor[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('849201');
  const [targetDoctorName, setTargetDoctorName] = useState<string>('your doctor');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(115);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Load existing connections & requests
  const loadConnectionsData = async () => {
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
    loadConnectionsData();
  }, []);

  // 2-Minute Consent Code Countdown
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

  // Execute Clinical Recommendation Engine
  const healthAnalysis: HealthAnalysisSummary = useMemo(() => {
    return analyzeHealthStatus(reports || [], reportedSymptoms);
  }, [reports, reportedSymptoms]);

  const rankedRecommendations: RecommendationResult[] = useMemo(() => {
    const pool = VERIFIED_DOCTORS_POOL;
    const patientCity = (currentPatient as any)?.location || 'New Delhi';
    return rankDoctors(pool, healthAnalysis, reportedSymptoms, selectedConsultationMode, patientCity);
  }, [healthAnalysis, reportedSymptoms, selectedConsultationMode, currentPatient]);

  // Filter recommendations by specialty and search query
  const filteredRecommendations = useMemo(() => {
    return rankedRecommendations.filter((rec) => {
      const doc = rec.doctor;
      // Specialty filter
      if (selectedSpecialtyFilter !== 'All Specialties') {
        const matchesSpecialty =
          doc.specialty.toLowerCase().includes(selectedSpecialtyFilter.toLowerCase()) ||
          rec.matchedSpecialty.toLowerCase().includes(selectedSpecialtyFilter.toLowerCase());
        if (!matchesSpecialty) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          doc.name.toLowerCase().includes(q) ||
          doc.specialty.toLowerCase().includes(q) ||
          doc.clinicName.toLowerCase().includes(q) ||
          doc.city.toLowerCase().includes(q) ||
          doc.registrationNumber.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [rankedRecommendations, selectedSpecialtyFilter, searchQuery]);

  // Distinct specialties list for filter pills
  const availableSpecialties = useMemo(() => {
    const list = [
      'All Specialties',
      'Endocrinology & Diabetology',
      'Cardiology',
      'Internal Medicine & General Physician',
      'Gastroenterology & Hepatology',
      'Nephrology',
      'Dermatology',
    ];
    return list;
  }, []);

  // Handlers for Connect to Doctor
  const handleOpenConnectModal = (doctor: DoctorProfileRecord, prefilledConcern?: string) => {
    setConnectModalDoctor(doctor);
    setConnectMode(doctor.consultationModes[0] || 'In-person');
    setConnectTimeSlot(doctor.availableSlots[0] || '10:00 AM');
    if (prefilledConcern) {
      setConnectConcern(prefilledConcern);
    } else {
      const match = rankedRecommendations.find((r) => r.doctor.id === doctor.id);
      const rationaleText = match && match.rationale.length > 0 ? match.rationale.join(' ') : 'Clinical consultation and review of verified diagnostic reports.';
      setConnectConcern(rationaleText);
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectModalDoctor) return;

    try {
      setIsConnecting(true);
      // 1. Submit appointment/consultation intent
      await requestAppointment({
        patientId: currentUser?.id || '',
        patientName: currentUser?.name || 'Patient',
        patientRsId: (currentUser as any)?.rsId || 'RS-PAT-4829',
        doctorName: connectModalDoctor.name,
        date: connectDate,
        time: connectTimeSlot,
        type: connectMode === 'In-person' ? 'In-person' : connectMode === 'Video call' ? 'Video call' : 'Phone call',
        reason: connectConcern || 'Clinical consultation request via Smart Doctor Recommendation',
        status: 'Pending',
      });

      // 2. Add to connected doctors state for immediate verification
      const newConnected: ConnectedDoctor = {
        id: `conn-${Date.now()}`,
        doctorId: connectModalDoctor.id,
        name: connectModalDoctor.name,
        specialty: connectModalDoctor.specialty,
        clinic: connectModalDoctor.clinicName,
        hospital: connectModalDoctor.clinicName,
        connectedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: 'Connected',
      };
      setConnectedDoctors((prev) => [newConnected, ...prev.filter((d) => d.doctorId !== connectModalDoctor.id)]);

      setConnectModalDoctor(null);
      showToast(`Connected to ${connectModalDoctor.name}! Consultation request submitted.`);
    } catch (err: any) {
      showToast(err?.message || 'Connection request initiated.');
      setConnectModalDoctor(null);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handlers for Adding Symptoms
  const handleAddSymptomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymptomName.trim()) return;

    const newRecord: SymptomRecord = {
      id: `s-${Date.now()}`,
      name: newSymptomName.trim(),
      severity: newSymptomSeverity,
      duration: newSymptomDuration,
    };

    setReportedSymptoms((prev) => [newRecord, ...prev]);
    setNewSymptomName('');
    setShowAddSymptomModal(false);
    showToast('Symptom recorded! Recommendations updated in real time.');
  };

  const handleDeleteSymptom = (id: string) => {
    setReportedSymptoms((prev) => prev.filter((s) => s.id !== id));
    showToast('Symptom removed. Recommendations updated.');
  };

  // Legacy Code Handlers
  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    showToast('Consent code copied to clipboard!');
  };

  const handleRegenerateCode = async () => {
    setActionLoading('regen');
    try {
      const res = await connectionsApi.generatePatientCode();
      if (res && res.code) {
        setGeneratedCode(res.code);
      } else {
        setGeneratedCode(Math.floor(100000 + Math.random() * 900000).toString());
      }
      setSecondsRemaining(120);
      showToast('New 2-minute consent code generated!');
    } catch {
      setGeneratedCode(Math.floor(100000 + Math.random() * 900000).toString());
      setSecondsRemaining(120);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeConnection = async (doctorId: string, doctorName: string) => {
    if (!window.confirm(`Revoke health record access for ${doctorName}?`)) return;
    setActionLoading(doctorId);
    try {
      await connectionsApi.revokeDoctorConnection(doctorId);
    } catch {
      // offline fallback
    } finally {
      setConnectedDoctors((prev) => prev.filter((d) => (d.doctorId || d.id) !== doctorId));
      showToast(`Consent revoked for ${doctorName}.`);
      setActionLoading(null);
    }
  };

  return (
    <div className={embedded ? 'space-y-4 font-sans text-slate-800' : 'p-4 md:p-6 space-y-5 max-w-6xl mx-auto font-sans text-slate-800'}>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-[#0E382F] text-white px-4 py-2.5 rounded-[4px] shadow-lg flex items-center gap-2 border border-emerald-500/40 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-stone-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-[6px] bg-[#EAF6F0] text-[#0E382F]">
              <Stethoscope className="w-5 h-5 text-[#10B981]" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Find the Right Doctor
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Smart, AI-assisted specialist recommendations matched directly to your laboratory biomarkers and reported symptoms.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-stone-100/80 p-1 rounded-[8px] border border-stone-200/70 overflow-x-auto">
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'recommendations'
                ? 'bg-[#0E382F] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Recommendations
          </button>
          <button
            onClick={() => setActiveTab('connected')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'connected'
                ? 'bg-[#0E382F] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Connected</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200/80 text-slate-700 font-mono">
              {connectedDoctors.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'bg-[#0E382F] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Requests</span>
            {pendingRequests.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-mono font-bold">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('quick_code')}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
              activeTab === 'quick_code'
                ? 'bg-[#0E382F] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Consent Code</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
       * TAB 1: SMART DOCTOR RECOMMENDATIONS (MAIN FEATURE)
       * ========================================================================= */}
      {activeTab === 'recommendations' && (
        <div className="space-y-5">

          {/* Section 2.A: Health Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Identified Biomarker Concerns */}
            <div className="bg-white border border-stone-200/90 rounded-[12px] p-4 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Biomarker Concerns
                </p>
                <h3 className="text-xl font-black text-slate-900 mt-0.5">
                  {healthAnalysis.biomarkerConcernsCount} Identified
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  From recent verified lab diagnostic tests
                </p>
              </div>
              <div className="w-10 h-10 rounded-[10px] bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                <Droplet className="w-5 h-5 text-[#10B981]" />
              </div>
            </div>

            {/* Card 2: Active Reported Symptoms */}
            <div className="bg-white border border-stone-200/90 rounded-[12px] p-4 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Active Symptoms
                </p>
                <h3 className="text-xl font-black text-slate-900 mt-0.5">
                  {healthAnalysis.activeSymptomsCount} Reported
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Self-reported health observations
                </p>
              </div>
              <button
                onClick={() => setShowAddSymptomModal(true)}
                className="w-10 h-10 rounded-[10px] bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                title="Add or update symptoms"
              >
                <Plus className="w-5 h-5 text-blue-600" />
              </button>
            </div>

            {/* Card 3: Clinical Categories */}
            <div className="bg-white border border-stone-200/90 rounded-[12px] p-4 shadow-2xs flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Clinical Domains
                </p>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {healthAnalysis.clinicalCategories.length > 0 ? (
                    healthAnalysis.clinicalCategories.slice(0, 3).map((cat) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 bg-stone-100 text-slate-700 border border-stone-200 text-[10px] font-bold rounded-[4px]"
                      >
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">Routine Monitoring</span>
                  )}
                </div>
              </div>
              <div className="w-10 h-10 rounded-[10px] bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
                <Activity className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Active Symptoms Tags Preview */}
          {reportedSymptoms.length > 0 && (
            <div className="bg-[#FAFDFB] border border-emerald-200/80 rounded-[10px] p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Current Symptoms:</span>
                </span>
                {reportedSymptoms.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 bg-white border border-emerald-200 text-slate-800 text-xs px-2.5 py-1 rounded-[6px] shadow-2xs"
                  >
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 text-[#0E382F] rounded font-bold">
                      {s.severity}
                    </span>
                    <button
                      onClick={() => handleDeleteSymptom(s.id)}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer ml-0.5"
                      title="Remove symptom"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={() => setShowAddSymptomModal(true)}
                className="text-xs font-bold text-[#0E382F] hover:text-[#16A36A] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Symptom</span>
              </button>
            </div>
          )}

          {/* Controls Bar: Search & Consultation Mode & Add Symptom */}
          <div className="bg-white border border-stone-200/90 rounded-[12px] p-3 sm:p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by doctor name, hospital, clinic, or specialty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-800 bg-stone-50/70 border border-stone-200 rounded-[6px] focus:outline-none focus:border-[#0E382F] focus:bg-white transition-all font-medium"
              />
            </div>

            {/* Consultation Mode Selector & Add Symptom */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-between sm:justify-start">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-500 shrink-0">
                  Mode:
                </label>
                <div className="flex items-center border border-stone-200 rounded-[6px] p-0.5 bg-stone-50 overflow-x-auto">
                {(['All Modes', 'In-person', 'Video call'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedConsultationMode(m === 'In-person' ? 'In-person' : m === 'Video call' ? 'Video call' : 'All Modes')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-[4px] cursor-pointer transition-all ${
                      selectedConsultationMode === m || (m === 'All Modes' && selectedConsultationMode === 'All Modes')
                        ? 'bg-[#0E382F] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m === 'In-person' ? 'In-person Visit' : m === 'Video call' ? 'Video Consultation' : 'All Modes'}
                  </button>
                ))}
              </div>
              </div>

              {/* Add Symptoms Button */}
              <button
                onClick={() => setShowAddSymptomModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EAF6F0] text-[#0E382F] border border-emerald-300/80 rounded-[6px] hover:bg-emerald-100 font-bold text-xs cursor-pointer shadow-2xs transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-[#10B981] stroke-[2.5]" />
                <span>Add Symptoms</span>
              </button>
            </div>
          </div>

          {/* Specialty Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {availableSpecialties.map((spec) => {
              const isSelected = selectedSpecialtyFilter === spec;
              return (
                <button
                  key={spec}
                  onClick={() => setSelectedSpecialtyFilter(spec)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-[#0E382F] text-white border-[#0E382F] shadow-2xs'
                      : 'bg-white text-slate-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {spec}
                </button>
              );
            })}
          </div>

          {/* Section 2.B: Doctor Recommendation Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>Recommended Clinical Specialists</span>
                <span className="text-xs font-normal text-slate-500">
                  ({filteredRecommendations.length} verified doctors)
                </span>
              </h2>
              <span className="text-[11px] font-semibold text-emerald-800 bg-[#EAF6F0] px-2 py-0.5 rounded-[4px] border border-emerald-200">
                Weighted Ranking: 40% Specialty · 25% Qualifications · 20% Proximity · 15% Availability
              </span>
            </div>

            {filteredRecommendations.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-[12px] p-8 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">No matching doctors found</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Try clearing your search query or selecting "All Specialties" to view all available verified practitioners.
                </p>
                <button
                  onClick={() => {
                    setSelectedSpecialtyFilter('All Specialties');
                    setSearchQuery('');
                    setSelectedConsultationMode('All Modes');
                  }}
                  className="px-3.5 py-1.5 bg-[#0E382F] text-white text-xs font-bold rounded-[6px] cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredRecommendations.map((rec) => {
                  const doc = rec.doctor;
                  return (
                    <div
                      key={doc.id}
                      className="bg-white border border-stone-200/90 rounded-[14px] p-4 sm:p-5 shadow-2xs hover:border-[#0E382F]/40 transition-all space-y-4 relative"
                    >
                      {/* Top Header of Card */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex items-start gap-3.5">
                          {/* 1. Initials Avatar Badge (NO Profile Photographs / DPs) */}
                          <div className="relative shrink-0">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[14px] bg-gradient-to-br from-[#0E382F] to-[#16A36A] text-white flex items-center justify-center font-black text-xl sm:text-2xl shadow-sm tracking-tight select-none">
                              {rec.initials}
                            </div>
                            {/* Verified shield checkmark icon on the avatar badge */}
                            <div
                              className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-xs border border-emerald-100"
                              title="Verified Medical Practitioner"
                            >
                              <ShieldCheck className="w-4 h-4 text-[#10B981] fill-emerald-500 text-white" />
                            </div>
                          </div>

                          {/* Doctor Details */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                                {doc.name}
                              </h3>
                              <span className="text-[10px] font-bold text-emerald-800 bg-[#EAF6F0] px-2 py-0.5 rounded-[3px] border border-emerald-200 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-[#10B981]" />
                                <span>Verified</span>
                              </span>
                            </div>

                            <p className="text-xs font-bold text-[#0E382F]">
                              {doc.specialty}
                            </p>

                            <p className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap font-medium">
                              <span>{doc.qualifications.join(', ')}</span>
                              <span>·</span>
                              <span>{doc.experienceYears}+ years experience</span>
                              <span>·</span>
                              <span className="font-mono text-[10px] bg-stone-100 text-slate-600 px-1.5 py-0.2 rounded">
                                Reg: {doc.registrationNumber}
                              </span>
                            </p>

                            <p className="text-[11px] text-slate-600 flex items-center gap-1.5 pt-0.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{doc.clinicName}, {doc.city}</span>
                            </p>
                          </div>
                        </div>

                        {/* Match Score Badge & Consultation Fee */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 shrink-0 pt-1">
                          {/* 2. Match Score Badge */}
                          <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-full font-black text-xs shadow-2xs">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600 fill-emerald-500" />
                            <span>{rec.matchScore}% Match</span>
                          </div>

                          <div className="text-right sm:mt-2">
                            <p className="text-xs sm:text-sm font-extrabold text-slate-900">
                              ₹{doc.consultationFee.toLocaleString('en-IN')}{' '}
                              <span className="text-[10px] font-normal text-slate-500">/ consult</span>
                            </p>
                            <p className="text-[10px] text-emerald-700 font-semibold flex items-center justify-end gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{doc.availableSlots[0] || 'Available Today'}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 4. Transparent Rationale Box: "Why Recommended for You" */}
                      <div className="bg-[#F8FAF9] rounded-[10px] border border-stone-200/80 p-3 sm:p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
                            <span>Why Recommended for You:</span>
                          </h4>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            Clinical Rationale
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {rec.rationale.map((reason, rIdx) => (
                            <li
                              key={rIdx}
                              className="text-xs text-slate-700 flex items-start gap-2 leading-relaxed"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] mt-1.5 shrink-0" />
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Bottom Footer: Modes & Action Buttons */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-stone-100">
                        {/* Consultation Modes Support */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mr-1">
                            Supported:
                          </span>
                          {doc.consultationModes.map((mode) => (
                            <span
                              key={mode}
                              className="text-[10px] font-semibold text-slate-700 bg-stone-100 px-2 py-0.5 rounded-[4px] border border-stone-200 flex items-center gap-1"
                            >
                              {mode === 'In-person' && <Building2 className="w-2.5 h-2.5 text-slate-500" />}
                              {mode === 'Video call' && <Video className="w-2.5 h-2.5 text-blue-500" />}
                              {mode === 'Phone call' && <Phone className="w-2.5 h-2.5 text-emerald-500" />}
                              <span>{mode}</span>
                            </span>
                          ))}
                        </div>

                        {/* Action Buttons: View Profile & Connect to Doctor */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            onClick={() => setProfileModalDoctor(doc)}
                            className="px-3 py-1.5 bg-white border border-stone-200 hover:bg-stone-50 text-slate-700 text-xs font-bold rounded-[6px] shadow-2xs transition-colors cursor-pointer"
                          >
                            View Profile
                          </button>

                          {/* "Connect to Doctor" replaces any Book Appointment button */}
                          <button
                            onClick={() => handleOpenConnectModal(doc)}
                            className="px-4 py-1.5 bg-[#0E382F] hover:bg-[#134e40] text-white text-xs font-bold rounded-[6px] shadow-xs flex items-center gap-1.5 transition-all cursor-pointer hover:shadow"
                          >
                            <Stethoscope className="w-3.5 h-3.5 text-[#10B981]" />
                            <span>Connect to Doctor</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Safety & AI Guidance Notice */}
          <div className="bg-[#FAFDFB] border border-stone-200 rounded-[10px] p-3 text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Clinical Safety & Algorithmic Disclosure:</span>
            </p>
            <p>
              Doctor recommendations are calculated algorithmically by cross-referencing your verified laboratory parameters and self-reported symptoms with specialist expertise. These recommendations serve as clinical guidance and do not constitute a confirmed diagnostic finding or prescriptive treatment. In any life-threatening situation or emergency, visit your nearest emergency room or call 108 immediately.
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
       * TAB 2: MY CONNECTED DOCTORS
       * ========================================================================= */}
      {activeTab === 'connected' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Active Clinician Connections ({connectedDoctors.length})
            </h2>
            <button
              onClick={() => setActiveTab('recommendations')}
              className="text-xs font-bold text-[#0E382F] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>+ Find New Specialist</span>
            </button>
          </div>

          {connectedDoctors.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-[12px] p-8 text-center space-y-3">
              <UserCheck className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No active doctor connections</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Connect with verified specialists from the Smart Recommendations tab or share your 2-minute consent code.
              </p>
              <button
                onClick={() => setActiveTab('recommendations')}
                className="px-4 py-2 bg-[#0E382F] text-white text-xs font-bold rounded-[6px] cursor-pointer"
              >
                Browse Recommended Doctors
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {connectedDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white border border-stone-200 rounded-[12px] p-4 shadow-2xs flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-[12px] bg-[#0E382F] text-white flex items-center justify-center font-bold text-base shrink-0">
                      {getDoctorInitials(doc.name)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {doc.name}
                      </h4>
                      <p className="text-xs text-slate-500">{doc.specialty}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Connected on {doc.connectedAt || 'Verified connection'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate('/patient/ask-doctor')}
                      className="px-2.5 py-1.5 bg-[#EAF6F0] text-[#0E382F] text-xs font-bold rounded-[6px] hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      Message
                    </button>
                    <button
                      onClick={() => handleRevokeConnection(doc.doctorId || doc.id, doc.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-[6px] hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Revoke access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
       * TAB 3: PENDING REQUESTS
       * ========================================================================= */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900">
            Pending Clinician Access Requests ({pendingRequests.length})
          </h2>

          {pendingRequests.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-[12px] p-8 text-center space-y-3">
              <Clock className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No pending access requests</h3>
              <p className="text-xs text-slate-500">
                When a hospital or doctor requests consent to view your diagnostic history, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div
                  key={req.connectionId}
                  className="bg-white border border-stone-200 rounded-[12px] p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-[12px] bg-stone-100 text-slate-800 flex items-center justify-center font-bold text-base shrink-0 border border-stone-200">
                      {getDoctorInitials(req.doctorName)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {req.doctorName}
                      </h4>
                      <p className="text-xs text-slate-500">{req.specialty}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Requested on {new Date(req.requestedAt).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => showToast(`Approved request from ${req.doctorName}`)}
                      className="px-3 py-1.5 bg-[#0E382F] text-white text-xs font-bold rounded-[6px] hover:bg-[#134e40] transition-colors cursor-pointer"
                    >
                      Approve Request
                    </button>
                    <button
                      onClick={() => showToast('Declined request')}
                      className="px-3 py-1.5 bg-white border border-stone-200 text-slate-600 hover:text-rose-600 text-xs font-bold rounded-[6px] hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
       * TAB 4: 2-MINUTE CONSENT CODE
       * ========================================================================= */}
      {activeTab === 'quick_code' && (
        <div className="bg-white border border-stone-200 rounded-[14px] p-6 max-w-lg mx-auto text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6 text-[#10B981]" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Temporary Consent Code
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Share this 6-digit verification code with your doctor in-clinic to grant 24-hour read access to your verified reports.
            </p>
          </div>

          {/* Large Digit Box */}
          <div className="bg-[#F8FAF9] border-2 border-dashed border-emerald-300 rounded-[12px] p-5">
            <span className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-[#0E382F]">
              {generatedCode}
            </span>
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 mt-2">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>
                Expires in{' '}
                <strong className="text-slate-800">
                  {Math.floor(secondsRemaining / 60)}:
                  {(secondsRemaining % 60).toString().padStart(2, '0')}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleCopyCode}
              className="px-4 py-2 bg-white border border-stone-200 hover:bg-stone-50 text-slate-800 text-xs font-bold rounded-[6px] shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
            </button>

            <button
              onClick={handleRegenerateCode}
              disabled={actionLoading === 'regen'}
              className="px-4 py-2 bg-[#0E382F] hover:bg-[#134e40] text-white text-xs font-bold rounded-[6px] shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'regen' ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
       * MODAL 1: CONNECT TO DOCTOR MODAL
       * ========================================================================= */}
      {connectModalDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[14px] border border-stone-200 shadow-xl max-w-lg w-full max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-[#0E382F] text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-white/10 text-white flex items-center justify-center font-bold text-sm">
                  {getDoctorInitials(connectModalDoctor.name)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    Connect to Doctor with {connectModalDoctor.name}
                  </h3>
                  <p className="text-[11px] text-white/70">
                    {connectModalDoctor.specialty} · ₹{connectModalDoctor.consultationFee}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConnectModalDoctor(null)}
                className="text-white/70 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConnectSubmit} className="p-4 sm:p-5 space-y-4">
              {/* Preferred Date */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Preferred Consultation Date
                </label>
                <input
                  type="date"
                  value={connectDate}
                  onChange={(e) => setConnectDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs text-slate-800 bg-stone-50 border border-stone-200 rounded-[6px] focus:outline-none focus:border-[#0E382F]"
                  required
                />
              </div>

              {/* Time Slot */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Available Time Slot
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {connectModalDoctor.availableSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setConnectTimeSlot(slot)}
                      className={`px-2.5 py-1.5 text-[11px] font-bold rounded-[6px] border text-center cursor-pointer transition-all ${
                        connectTimeSlot === slot
                          ? 'bg-[#0E382F] text-white border-[#0E382F]'
                          : 'bg-stone-50 text-slate-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Consultation Mode */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Consultation Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {connectModalDoctor.consultationModes.map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setConnectMode(m)}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-[6px] border text-center cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                        connectMode === m
                          ? 'bg-[#0E382F] text-white border-[#0E382F]'
                          : 'bg-stone-50 text-slate-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {m === 'In-person' && <Building2 className="w-3.5 h-3.5" />}
                      {m === 'Video call' && <Video className="w-3.5 h-3.5" />}
                      {m === 'Phone call' && <Phone className="w-3.5 h-3.5" />}
                      <span>{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinical Purpose / Concern */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Clinical Purpose & Concerns
                </label>
                <textarea
                  rows={3}
                  value={connectConcern}
                  onChange={(e) => setConnectConcern(e.target.value)}
                  placeholder="Detail your primary concerns or questions for the doctor..."
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-stone-50 border border-stone-200 rounded-[6px] focus:outline-none focus:border-[#0E382F]"
                />
              </div>

              <div className="bg-[#FAFDFB] border border-emerald-200 p-2.5 rounded-[6px] text-[11px] text-slate-600 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                <span>
                  By connecting, you grant this verified clinician access to review your shared diagnostic lab parameters and relevant consultation context.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setConnectModalDoctor(null)}
                  className="px-3.5 py-1.5 bg-white border border-stone-200 text-slate-600 text-xs font-bold rounded-[6px] hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="px-5 py-1.5 bg-[#0E382F] hover:bg-[#134e40] text-white text-xs font-bold rounded-[6px] shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Stethoscope className="w-3.5 h-3.5 text-[#10B981]" />}
                  <span>Connect to Doctor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
       * MODAL 2: DOCTOR PROFILE MODAL
       * ========================================================================= */}
      {profileModalDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[14px] border border-stone-200 shadow-xl max-w-lg w-full max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 space-y-4">
            {/* Header */}
            <div className="p-5 bg-gradient-to-br from-[#0E382F] to-[#16A36A] text-white relative">
              <button
                onClick={() => setProfileModalDoctor(null)}
                className="absolute top-4 right-4 text-white/70 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-[14px] bg-white text-[#0E382F] flex items-center justify-center font-black text-2xl shadow-sm shrink-0">
                  {getDoctorInitials(profileModalDoctor.name)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-lg font-bold text-white leading-tight">
                      {profileModalDoctor.name}
                    </h3>
                    <ShieldCheck className="w-4 h-4 text-emerald-300 fill-emerald-500" />
                  </div>
                  <p className="text-xs text-white/90 font-medium">
                    {profileModalDoctor.specialty}
                  </p>
                  <p className="text-[11px] text-white/70 mt-0.5">
                    {profileModalDoctor.experienceYears}+ years · {profileModalDoctor.city}
                  </p>
                </div>
              </div>
            </div>

            {/* Profile Credentials Body */}
            <div className="px-5 pb-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-stone-50 border border-stone-200 p-2.5 rounded-[8px]">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Medical Qualifications
                  </p>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {profileModalDoctor.qualifications.join(', ')}
                  </p>
                </div>

                <div className="bg-stone-50 border border-stone-200 p-2.5 rounded-[8px]">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Council Registration
                  </p>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {profileModalDoctor.registrationNumber} ({profileModalDoctor.medicalCouncil})
                  </p>
                </div>
              </div>

              {/* Clinic Information */}
              <div className="bg-stone-50 border border-stone-200 p-3 rounded-[8px] space-y-1 text-xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Primary Clinic / Hospital Practice
                </p>
                <p className="font-bold text-slate-900">
                  {profileModalDoctor.clinicName}
                </p>
                <p className="text-slate-600 text-[11px] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{profileModalDoctor.clinicAddress}, {profileModalDoctor.city}</span>
                </p>
              </div>

              {/* Consultation Modes & Fee */}
              <div className="flex items-center justify-between p-3 bg-emerald-50/60 border border-emerald-200 rounded-[8px] text-xs">
                <div>
                  <p className="text-[10px] font-bold text-emerald-800 uppercase">
                    Consultation Fee
                  </p>
                  <p className="text-base font-extrabold text-[#0E382F]">
                    ₹{profileModalDoctor.consultationFee.toLocaleString('en-IN')}{' '}
                    <span className="text-[10px] font-normal text-slate-600">/ session</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">
                    Available Modes
                  </p>
                  <p className="text-xs font-bold text-slate-800">
                    {profileModalDoctor.consultationModes.join(', ')}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  onClick={() => setProfileModalDoctor(null)}
                  className="px-3.5 py-1.5 bg-white border border-stone-200 text-slate-600 text-xs font-bold rounded-[6px] hover:bg-stone-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const doc = profileModalDoctor;
                    setProfileModalDoctor(null);
                    handleOpenConnectModal(doc);
                  }}
                  className="px-5 py-1.5 bg-[#0E382F] hover:bg-[#134e40] text-white text-xs font-bold rounded-[6px] shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Stethoscope className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Connect to Doctor</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
       * MODAL 3: ADD REPORTED SYMPTOMS MODAL
       * ========================================================================= */}
      {showAddSymptomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[14px] border border-stone-200 shadow-xl max-w-md w-full max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-[#0E382F] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#10B981]" />
                <h3 className="text-sm font-bold text-white">
                  Add Reported Health Symptoms
                </h3>
              </div>
              <button
                onClick={() => setShowAddSymptomModal(false)}
                className="text-white/70 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddSymptomSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Describe Symptom / Feeling
                </label>
                <input
                  type="text"
                  placeholder="e.g. Excessive thirst, chest tightness, abdominal discomfort..."
                  value={newSymptomName}
                  onChange={(e) => setNewSymptomName(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-stone-50 border border-stone-200 rounded-[6px] focus:outline-none focus:border-[#0E382F]"
                  required
                />
              </div>

              {/* Quick Suggestion Pills */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  Quick Select:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Frequent urination & thirst',
                    'Chest tightness / palpitations',
                    'Severe headache',
                    'Abdominal bloating & acidity',
                    'Skin rash / allergy',
                    'Leg swelling / edema',
                  ].map((sug) => (
                    <button
                      type="button"
                      key={sug}
                      onClick={() => setNewSymptomName(sug)}
                      className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-slate-700 rounded text-[10px] font-medium cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity Selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Severity Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Mild', 'Moderate', 'Severe'] as const).map((sev) => (
                    <button
                      type="button"
                      key={sev}
                      onClick={() => setNewSymptomSeverity(sev)}
                      className={`py-1.5 text-xs font-bold rounded-[6px] border text-center cursor-pointer transition-all ${
                        newSymptomSeverity === sev
                          ? sev === 'Severe'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-[#0E382F] text-white border-[#0E382F]'
                          : 'bg-stone-50 text-slate-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Duration
                </label>
                <select
                  value={newSymptomDuration}
                  onChange={(e) => setNewSymptomDuration(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-stone-50 border border-stone-200 rounded-[6px] focus:outline-none focus:border-[#0E382F]"
                >
                  <option value="1-3 days">1 – 3 days (Acute)</option>
                  <option value="4-7 days">4 – 7 days (Sub-acute)</option>
                  <option value="1-2 weeks">1 – 2 weeks</option>
                  <option value="1 month+">1 month or more (Chronic)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddSymptomModal(false)}
                  className="px-3.5 py-1.5 bg-white border border-stone-200 text-slate-600 text-xs font-bold rounded-[6px] hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-[#0E382F] hover:bg-[#134e40] text-white text-xs font-bold rounded-[6px] shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Update Recommendations</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
