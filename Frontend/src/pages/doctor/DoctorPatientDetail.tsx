import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { MedicalTrendChart, findBiomarkerDefinition } from '../../components/charts';
import {
  ArrowLeft,
  Calendar,
  Pill,
  FileText,
  Clock,
  Sparkles,
  TrendingDown,
  Info,
  ChevronRight,
  ChevronDown,
  Plus,
  ExternalLink,
  AlertCircle,
  UploadCloud,
  CheckCircle2,
  User,
  MapPin,
  Phone,
  Check,
  X,
  Activity,
  Bell,
  HeartPulse,
  Video,
  Building2,
  Filter,
  ArrowUpDown,
  Search,
  CheckCircle,
} from 'lucide-react';

interface DoctorPatientDetailProps {
  initialTab?: 'Overview' | 'Lab Reports' | 'Appointments' | 'Medicines' | 'Notes';
}

export const DoctorPatientDetail: React.FC<DoctorPatientDetailProps> = ({ initialTab }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const {
    patients,
    reports,
    appointments,
    prescriptions,
    medicineSchedule,
    currentUser,
    fetchDoctorPatients,
    fetchReports,
    fetchAppointments,
    fetchPrescriptions,
    fetchMedicineSchedule,
    createPrescription,
    requestAppointment,
    updateAppointmentStatus,
  } = useStore();

  useEffect(() => {
    fetchDoctorPatients();
    fetchReports();
    fetchAppointments();
  }, []);

  const patient =
    patients.find((p) => p.id === id || p.rsId === id) ||
    patients.find((p) => (p as any)._id === id) ||
    patients.find((p) => (p as any).userId === id);

  const patientReports = patient
    ? reports.filter(
        (r) =>
          r.patientId === patient.id ||
          (r as any).patientId === (patient as any)._id ||
          (r as any).patientId === (patient as any).userId ||
          (patient as any).userId === r.patientId
      )
    : [];

  const patientPrescriptions = patient
    ? prescriptions.filter(
        (p) =>
          p.patientId === patient.id ||
          (patient as any)._id === p.patientId ||
          (patient as any).userId === p.patientId
      )
    : [];

  const patientAppointments = patient
    ? appointments.filter(
        (a) =>
          a.patientId === patient.id ||
          (patient as any)._id === a.patientId ||
          (patient as any).userId === a.patientId ||
          a.patientRsId === patient.rsId ||
          (a.patientName && patient.name && a.patientName.toLowerCase() === patient.name.toLowerCase())
      )
    : [];

  // Determine initial active tab
  const getInitialTab = (): 'Overview' | 'Lab Reports' | 'Appointments' | 'Medicines' | 'Notes' => {
    if (initialTab) return initialTab;
    const tabParam = searchParams.get('tab')?.toLowerCase();
    if (tabParam === 'appointments') return 'Appointments';
    if (tabParam === 'reports' || tabParam === 'lab-reports' || tabParam === 'lab reports') return 'Lab Reports';
    if (tabParam === 'medicines') return 'Medicines';
    if (tabParam === 'notes') return 'Notes';
    if (location.pathname.endsWith('/appointments')) return 'Appointments';
    if (location.pathname.endsWith('/reports')) return 'Lab Reports';
    if (location.pathname.endsWith('/medicines')) return 'Medicines';
    return 'Overview';
  };

  const [activeTab, setActiveTab] = useState<'Overview' | 'Lab Reports' | 'Appointments' | 'Medicines' | 'Notes'>(getInitialTab);

  // Sync if prop or URL tab changes
  useEffect(() => {
    const desired = getInitialTab();
    if (desired && desired !== activeTab) {
      setActiveTab(desired);
    }
  }, [initialTab, location.pathname, searchParams]);

  useEffect(() => {
    if (patient) {
      fetchPrescriptions(patient.id);
      fetchMedicineSchedule(patient.id);
    }
  }, [patient?.id]);

  // Selected parameter for overview spotlight
  const [selectedParamId, setSelectedParamId] = useState<string>('param-platelets');

  // Chronological reports sorting & filtering
  const [reportSortOrder, setReportSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [reportFilter, setReportFilter] = useState<'all' | 'critical' | 'unbalanced' | 'normal' | 'pending'>('all');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const chronologicalReports = [...patientReports].sort((a, b) => {
    const dateA = new Date(a.reportedDate || a.collectionDate || (a as any).uploadedAt || (a as any).createdAt || 0).getTime();
    const dateB = new Date(b.reportedDate || b.collectionDate || (b as any).uploadedAt || (b as any).createdAt || 0).getTime();
    return reportSortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const filteredReports = chronologicalReports.filter((r) => {
    if (reportFilter === 'critical') return r.status === 'Critical';
    if (reportFilter === 'unbalanced') return r.status === 'Unbalanced';
    if (reportFilter === 'normal') return r.status === 'Normal';
    if (reportFilter === 'pending') return !r.reviewed && r.reviewStatus !== 'approved';
    return true;
  });

  const latestReport = chronologicalReports[0] || null;

  // Chronological appointments sorting & filtering
  const [appointmentFilter, setAppointmentFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [appointmentTime, setAppointmentTime] = useState('10:30 AM');
  const [appointmentType, setAppointmentType] = useState<'In-person' | 'Video call' | 'Phone call'>('In-person');
  const [appointmentReason, setAppointmentReason] = useState('Routine checkup & Lab report evaluation');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);
  const [appointmentSuccess, setAppointmentSuccess] = useState(false);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);

  const chronologicalAppointments = [...patientAppointments].sort((a, b) => {
    const dateA = new Date(`${a.date} ${a.time || '00:00'}`).getTime();
    const dateB = new Date(`${b.date} ${b.time || '00:00'}`).getTime();
    return dateB - dateA;
  });

  const filteredAppointments = chronologicalAppointments.filter((a) => {
    if (appointmentFilter === 'upcoming') return a.status === 'Confirmed' || a.status === 'Pending';
    if (appointmentFilter === 'completed') return a.status === 'Completed';
    if (appointmentFilter === 'cancelled') return a.status === 'Cancelled';
    return true;
  });

  // Prescribe form states
  const [showPrescribeModal, setShowPrescribeModal] = useState(false);
  const [prescribeName, setPrescribeName] = useState('');
  const [prescribeDose, setPrescribeDose] = useState('1 tablet');
  const [prescribeFrequency, setPrescribeFrequency] = useState('Morning and Night');
  const [prescribeTimings, setPrescribeTimings] = useState<string[]>(['Morning', 'Night']);
  const [prescribeMeal, setPrescribeMeal] = useState('After food');
  const [prescribeDuration, setPrescribeDuration] = useState('30');
  const [prescribeAdvice, setPrescribeAdvice] = useState('Take with full glass of water. Maintain consistent daily timing.');
  const [isPrescribing, setIsPrescribing] = useState(false);
  const [prescribeSuccess, setPrescribeSuccess] = useState(false);
  const [prescribeError, setPrescribeError] = useState<string | null>(null);

  const toggleTiming = (t: string) => {
    if (prescribeTimings.includes(t)) {
      if (prescribeTimings.length > 1) {
        setPrescribeTimings(prescribeTimings.filter((item) => item !== t));
      }
    } else {
      setPrescribeTimings([...prescribeTimings, t]);
    }
  };

  const handlePrescribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient || !prescribeName.trim()) return;

    setIsPrescribing(true);
    setPrescribeError(null);

    const timingStr = prescribeTimings.join(' and ');
    const fullInstructions = `${prescribeDose} · ${timingStr || prescribeFrequency} · ${prescribeMeal}`;

    try {
      await createPrescription({
        patientId: patient.id,
        name: prescribeName.trim(),
        instructions: fullInstructions,
        totalDays: Number(prescribeDuration) || 30,
        advice: prescribeAdvice.trim() ? [prescribeAdvice.trim()] : [],
        medicines: [
          {
            name: prescribeName.trim(),
            dose: prescribeDose,
            timing: timingStr || prescribeFrequency,
            instructions: prescribeMeal,
          },
        ],
      });

      setPrescribeSuccess(true);
      setPrescribeName('');
      setTimeout(() => {
        setPrescribeSuccess(false);
        setShowPrescribeModal(false);
      }, 1500);
    } catch (err: any) {
      setPrescribeError(err?.message || 'Failed to issue prescription');
    } finally {
      setIsPrescribing(false);
    }
  };

  const handleScheduleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    if (!appointmentReason.trim()) {
      setAppointmentError('Please enter a clinical reason for the appointment.');
      return;
    }
    if (!appointmentTime.trim()) {
      setAppointmentError('Please specify an appointment time.');
      return;
    }

    try {
      setIsSubmittingAppointment(true);
      setAppointmentError(null);
      await requestAppointment({
        patientId: patient.id,
        patientName: patient.name,
        patientRsId: patient.rsId,
        doctorName: currentUser?.name || 'Dr. Attending Physician',
        reason: appointmentReason.trim(),
        date: appointmentDate,
        time: appointmentTime.trim(),
        type: appointmentType,
        status: 'Confirmed',
        notes: appointmentNotes.trim() || undefined,
      });

      setAppointmentSuccess(true);
      setAppointmentNotes('');
      setTimeout(() => {
        setAppointmentSuccess(false);
        setShowAppointmentModal(false);
      }, 1500);
    } catch (err: any) {
      setAppointmentError(err.message || 'Failed to schedule appointment');
    } finally {
      setIsSubmittingAppointment(false);
    }
  };

  const handleConfirmAppointment = async (aptId: string) => {
    try {
      await updateAppointmentStatus(aptId, 'Confirmed');
    } catch (err: any) {
      console.warn('Failed to confirm appointment:', err);
    }
  };

  const handleCompleteAppointment = async (aptId: string) => {
    try {
      await updateAppointmentStatus(aptId, 'Completed');
    } catch (err: any) {
      console.warn('Failed to complete appointment:', err);
    }
  };

  const handleCancelAppointment = async (aptId: string) => {
    try {
      await updateAppointmentStatus(aptId, 'Cancelled');
    } catch (err: any) {
      console.warn('Failed to cancel appointment:', err);
    }
  };

  const selectedParam =
    latestReport?.parameters?.find((p) => p.id === selectedParamId) ||
    latestReport?.parameters?.find((p) => p.name.toLowerCase().includes('platelet')) ||
    latestReport?.parameters?.[0] ||
    null;

  if (!patient) {
    return (
      <div className="p-12 text-center text-stone-500 space-y-4 bg-white rounded-3xl border border-stone-200/70 shadow-sm max-w-xl mx-auto my-8">
        <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
          <User className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-stone-800">Patient profile not found or loading...</h3>
        <p className="text-xs text-stone-500">
          The requested clinical profile may have been updated or is retrieving database records.
        </p>
        <button
          onClick={() => navigate('/doctor/patients')}
          className="text-xs text-[#1E3F35] font-bold underline cursor-pointer"
        >
          Return to Patients List
        </button>
      </div>
    );
  }

  const initials = (patient.name || 'PT').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Back button */}
      <button
        onClick={() => navigate('/doctor/patients')}
        className="flex items-center gap-2 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-all cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Patients List</span>
      </button>

      {/* Patient Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/70">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1E3F35] to-[#2B5246] text-white font-extrabold text-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              {patient.avatar || initials}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172B25] tracking-tight">
                  {patient.name || 'Unnamed Patient'}
                </h1>
                <span className="text-xs font-mono font-semibold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-md">
                  {patient.rsId}
                </span>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    patient.status === 'Critical'
                      ? 'bg-[#FDF2F0] text-[#B53629] border border-[#F6C4C0]'
                      : 'bg-[#FEF3D6] text-[#8C6200]'
                  }`}
                >
                  {patient.status || 'Active'}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-2 text-xs text-stone-500 flex-wrap">
                <span>{patient.gender || 'Gender not specified'}</span>
                <span>·</span>
                <span>{patient.age ? `${patient.age} years` : 'Age not specified'}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  {patient.phone || 'No phone'}
                </span>
                {patient.location && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-stone-400" />
                      {patient.location}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-stone-100 flex-wrap text-xs">
                <div>
                  <span className="text-stone-400">Blood group: </span>
                  <strong className="text-stone-700">{patient.bloodGroup || 'Not specified'}</strong>
                </div>
                <div>
                  <span className="text-stone-400">Known conditions: </span>
                  <strong className="text-[#2A554A] bg-[#EBF4F0] px-2 py-0.5 rounded-full font-semibold">
                    {patient.conditions && patient.conditions.length > 0
                      ? patient.conditions.join(', ')
                      : 'None recorded'}
                  </strong>
                </div>
                <div>
                  <span className="text-stone-400">Last visit: </span>
                  <strong className="text-stone-700">{patient.lastVisitDate || 'First consultation'}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setActiveTab('Medicines')}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
                activeTab === 'Medicines'
                  ? 'bg-[#1E3F35] text-white shadow-sm'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
              }`}
            >
              <Pill className="w-4 h-4 text-emerald-600" />
              <span>Medicines ({patientPrescriptions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('Appointments')}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all cursor-pointer ${
                activeTab === 'Appointments'
                  ? 'bg-[#1E3F35] text-white shadow-sm'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
              }`}
            >
              <Calendar className="w-4 h-4 text-[#1E3F35]" />
              <span>Appointments ({chronologicalAppointments.length})</span>
            </button>
            <button
              onClick={() => setShowAppointmentModal(true)}
              className="flex items-center gap-1.5 bg-[#1E3F35] hover:bg-[#16322A] text-white px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Appointment</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-t border-stone-200/70 mt-6 pt-4 overflow-x-auto text-xs font-semibold">
          {(['Overview', 'Lab Reports', 'Appointments', 'Medicines', 'Notes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-[#1E3F35] text-white shadow-sm'
                  : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
              }`}
            >
              {tab}
              {tab === 'Lab Reports' && ` (${chronologicalReports.length})`}
              {tab === 'Appointments' && ` (${chronologicalAppointments.length})`}
              {tab === 'Medicines' && ` (${patientPrescriptions.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB CONTENT: LAB REPORTS (Chronological Order)                        */}
      {/* ==================================================================== */}
      {activeTab === 'Lab Reports' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70 space-y-6">
            {/* Header with Sort and Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
              <div>
                <h3 className="text-lg font-bold text-[#172B25] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#1E3F35]" />
                  <span>Patient Diagnostic Lab Reports ({chronologicalReports.length})</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Complete laboratory history for {patient.name} in chronological sequence with parameter extraction and clinical review status
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Sort Toggle */}
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-semibold text-stone-600">
                  <button
                    onClick={() => setReportSortOrder('newest')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      reportSortOrder === 'newest' ? 'bg-white text-[#172B25] shadow-xs' : 'hover:text-stone-900'
                    }`}
                  >
                    Newest First
                  </button>
                  <button
                    onClick={() => setReportSortOrder('oldest')}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      reportSortOrder === 'oldest' ? 'bg-white text-[#172B25] shadow-xs' : 'hover:text-stone-900'
                    }`}
                  >
                    Oldest First
                  </button>
                </div>

                {/* Filter Selector */}
                <select
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value as any)}
                  className="px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 cursor-pointer"
                >
                  <option value="all">All Severity ({chronologicalReports.length})</option>
                  <option value="critical">Critical Only</option>
                  <option value="unbalanced">Unbalanced Only</option>
                  <option value="normal">Normal Only</option>
                  <option value="pending">Awaiting Review</option>
                </select>
              </div>
            </div>

            {/* Reports List */}
            {filteredReports.length === 0 ? (
              <div className="p-10 text-center bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-stone-200/60 text-stone-500 mx-auto flex items-center justify-center">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-[#172B25]">No Laboratory Reports Match Selected Filter</h4>
                  <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                    {chronologicalReports.length === 0
                      ? 'This patient has not yet uploaded any blood tests or diagnostic reports. Once submitted, OCR-extracted parameters, reference ranges, and AI clinical summaries will appear here.'
                      : 'Try clearing the filter to view all historical lab records.'}
                  </p>
                </div>
                {chronologicalReports.length === 0 && (
                  <div className="pt-2">
                    <button
                      onClick={() => setShowAppointmentModal(true)}
                      className="px-4 py-2 bg-[#1E3F35] hover:bg-[#16322A] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Order Labs via Consultation</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReports.map((r, index) => {
                  const isExpanded = expandedReportId === r.id;
                  const abnormalParams = r.parameters?.filter(
                    (p) => p.status === 'Critical' || p.status === 'High' || p.status === 'Low'
                  ) || [];

                  return (
                    <div
                      key={r.id}
                      className="bg-white rounded-2xl border border-stone-200 hover:border-stone-300 shadow-2xs hover:shadow-xs transition-all p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                              r.status === 'Critical'
                                ? 'bg-[#FDF2F0] text-[#B53629] border border-[#F6C4C0]'
                                : r.status === 'Unbalanced'
                                ? 'bg-[#FEF3D6] text-[#8C6200] border border-[#FAD689]'
                                : 'bg-[#E4EDE8] text-[#2B5246] border border-[#CAD8CF]'
                            }`}
                          >
                            <FileText className="w-5 h-5" />
                          </div>

                          <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h4 className="font-extrabold text-sm sm:text-base text-[#172B25] font-serif">
                                {r.name || 'Laboratory Test Report'}
                              </h4>
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                                  r.status === 'Critical'
                                    ? 'bg-[#FDF2F0] text-[#B53629]'
                                    : r.status === 'Unbalanced'
                                    ? 'bg-[#FEF3D6] text-[#8C6200]'
                                    : 'bg-[#E4EDE8] text-[#2B5246]'
                                }`}
                              >
                                {r.status}
                              </span>

                              {r.reviewed || r.reviewStatus === 'approved' ? (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-200">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  <span>Approved & Sent</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1 border border-amber-200">
                                  <Clock className="w-3 h-3" />
                                  <span>Pending Doctor Review</span>
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-stone-500 mt-1">
                              <strong>Collected:</strong> {r.collectionDate || r.reportedDate || 'Recent'} ·{' '}
                              <strong>Reported:</strong> {r.reportedDate || 'Verified'} ·{' '}
                              <strong>Lab:</strong> {r.labName || 'Diagnostic Pathology Lab'}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            onClick={() => setExpandedReportId(isExpanded ? null : r.id)}
                            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <span>Biomarkers ({r.parameters?.length || 0})</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>

                          <button
                            onClick={() => navigate(`/doctor/reports/${r.id}`)}
                            className="px-3.5 py-1.5 bg-[#1E3F35] hover:bg-[#16322A] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <span>Open Viewer</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Abnormal Biomarker Highlight Chips */}
                      {abnormalParams.length > 0 && (
                        <div className="bg-[#FFF8F7] border border-[#F8D7D3] rounded-xl p-3 text-xs space-y-1.5">
                          <span className="font-bold text-[#B53629] text-[11px] uppercase tracking-wider flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-[#B53629]" />
                            <span>Flagged Out-of-Range Parameters ({abnormalParams.length})</span>
                          </span>
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            {abnormalParams.map((p, pIdx) => (
                              <span
                                key={pIdx}
                                className="px-2.5 py-1 bg-white border border-[#F6C4C0] rounded-lg text-xs font-semibold text-[#8B2318] shadow-2xs"
                              >
                                {p.name}: <strong>{p.value} {p.unit}</strong> ({p.status})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Expandable Parameter Table */}
                      {isExpanded && r.parameters && r.parameters.length > 0 && (
                        <div className="border-t border-stone-100 pt-4 animate-in fade-in duration-150">
                          <h5 className="font-bold text-xs text-stone-700 mb-2">All Extracted Biomarkers</h5>
                          <div className="overflow-x-auto rounded-xl border border-stone-200">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold text-[11px]">
                                <tr>
                                  <th className="py-2.5 px-3">Parameter</th>
                                  <th className="py-2.5 px-3">Result</th>
                                  <th className="py-2.5 px-3">Reference Range</th>
                                  <th className="py-2.5 px-3">Clinical Evaluation</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {r.parameters.map((p, idx) => (
                                  <tr key={idx} className="hover:bg-stone-50/50">
                                    <td className="py-2.5 px-3 font-semibold text-stone-800">{p.name}</td>
                                    <td className="py-2.5 px-3 font-bold text-stone-900">
                                      {p.value} {p.unit}
                                    </td>
                                    <td className="py-2.5 px-3 text-stone-500 font-mono text-[11px]">
                                      {p.referenceRange} {p.unit}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                          p.status === 'Critical'
                                            ? 'bg-rose-100 text-rose-800'
                                            : p.status === 'High' || p.status === 'Low'
                                            ? 'bg-amber-100 text-amber-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                      >
                                        {p.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Longitudinal Trend Chart across all chronological reports */}
          {chronologicalReports.length > 0 && selectedParam && (
            <MedicalTrendChart
              reports={chronologicalReports}
              initialKey={findBiomarkerDefinition(selectedParam.name).key}
              title="Longitudinal Laboratory Trend Analysis"
              subtitle="Chronological biomarker progression across patient's verified laboratory reports"
              onClickReport={(repId) => navigate(`/doctor/reports/${repId}`)}
            />
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB CONTENT: APPOINTMENTS & SCHEDULING                               */}
      {/* ==================================================================== */}
      {activeTab === 'Appointments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70 space-y-6">
            {/* Header with Schedule Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
              <div>
                <h3 className="text-lg font-bold text-[#172B25] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#1E3F35]" />
                  <span>Appointments with {patient.name} ({chronologicalAppointments.length})</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Scheduled clinical consultations, video evaluations, and laboratory review sessions
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAppointmentModal(true)}
                  className="px-4 py-2.5 bg-[#1E3F35] hover:bg-[#16322A] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Set New Appointment</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold">
              {(['all', 'upcoming', 'completed', 'cancelled'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setAppointmentFilter(filterKey)}
                  className={`px-3.5 py-1.5 rounded-xl capitalize transition-all cursor-pointer ${
                    appointmentFilter === filterKey
                      ? 'bg-[#1E3F35] text-white shadow-xs'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  {filterKey === 'all'
                    ? `All (${chronologicalAppointments.length})`
                    : filterKey === 'upcoming'
                    ? `Upcoming & Active (${chronologicalAppointments.filter((a) => a.status === 'Confirmed' || a.status === 'Pending').length})`
                    : filterKey === 'completed'
                    ? `Completed (${chronologicalAppointments.filter((a) => a.status === 'Completed').length})`
                    : `Cancelled (${chronologicalAppointments.filter((a) => a.status === 'Cancelled').length})`}
                </button>
              ))}
            </div>

            {/* Appointments List */}
            {filteredAppointments.length === 0 ? (
              <div className="p-10 text-center bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-stone-200/60 text-stone-500 mx-auto flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-[#172B25]">No Appointments Found</h4>
                  <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                    {chronologicalAppointments.length === 0
                      ? `There are no consultations scheduled with ${patient.name} yet. Schedule a checkup or follow-up evaluation.`
                      : 'No appointments match the current status filter.'}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setShowAppointmentModal(true)}
                    className="px-4 py-2 bg-[#1E3F35] hover:bg-[#16322A] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Schedule First Appointment</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredAppointments.map((apt) => {
                  const isPending = apt.status === 'Pending';
                  const isConfirmed = apt.status === 'Confirmed';
                  const isCompleted = apt.status === 'Completed';
                  const isCancelled = apt.status === 'Cancelled';

                  return (
                    <div
                      key={apt.id}
                      className="bg-white rounded-2xl border border-stone-200 hover:border-stone-300 shadow-2xs hover:shadow-xs p-5 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 border font-bold ${
                              isConfirmed
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : isPending
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : isCompleted
                                ? 'bg-slate-50 text-slate-700 border-slate-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            <Calendar className="w-5 h-5" />
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <h4 className="font-bold text-sm sm:text-base text-[#172B25] font-serif">
                                {apt.date} · <span className="text-[#1E3F35] font-sans">{apt.time}</span>
                              </h4>

                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                                  isConfirmed
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isPending
                                    ? 'bg-amber-100 text-amber-800'
                                    : isCompleted
                                    ? 'bg-slate-100 text-slate-700'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {apt.status}
                              </span>

                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 flex items-center gap-1.5 border border-stone-200/60">
                                {apt.type === 'Video call' ? (
                                  <Video className="w-3.5 h-3.5 text-blue-600" />
                                ) : apt.type === 'Phone call' ? (
                                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Building2 className="w-3.5 h-3.5 text-stone-600" />
                                )}
                                <span>{apt.type}</span>
                              </span>
                            </div>

                            <p className="text-xs font-medium text-stone-800">
                              <strong>Clinical Reason:</strong> {apt.reason || 'General Health Consultation'}
                            </p>

                            {apt.notes && (
                              <p className="text-xs text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                                <strong>Instructions / Notes:</strong> {apt.notes}
                              </p>
                            )}

                            <div className="text-[11px] text-stone-400 pt-0.5">
                              <span>Attending Doctor: <strong>{apt.doctorName || currentUser?.name || 'Dr. Physician'}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Status Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleConfirmAppointment(apt.id)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Confirm</span>
                              </button>
                              <button
                                onClick={() => handleCancelAppointment(apt.id)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                              >
                                Decline
                              </button>
                            </>
                          )}

                          {isConfirmed && (
                            <>
                              <button
                                onClick={() => handleCompleteAppointment(apt.id)}
                                className="px-3.5 py-1.5 bg-[#1E3F35] hover:bg-[#16322A] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Mark Completed</span>
                              </button>
                              <button
                                onClick={() => handleCancelAppointment(apt.id)}
                                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {isCompleted && (
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
                              ✓ Consultation Completed
                            </span>
                          )}

                          {isCancelled && (
                            <span className="text-xs font-bold text-rose-500 bg-rose-50 px-3 py-1.5 rounded-xl">
                              Cancelled
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB CONTENT: MEDICINES & PRESCRIPTIONS                               */}
      {/* ==================================================================== */}
      {activeTab === 'Medicines' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
              <div>
                <h3 className="text-lg font-bold text-[#172B25] flex items-center gap-2">
                  <Pill className="w-5 h-5 text-emerald-700" />
                  <span>Prescriptions & Medication Reminders ({patientPrescriptions.length})</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Prescribe courses, schedule daily intake reminders, and monitor adherence for {patient.name}
                </p>
              </div>

              <button
                onClick={() => setShowPrescribeModal(true)}
                className="px-4 py-2.5 bg-[#1E3F35] hover:bg-[#16322A] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-2 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Prescribe Medicine</span>
              </button>
            </div>

            {/* Active Prescriptions List */}
            {patientPrescriptions.length === 0 ? (
              <div className="p-8 sm:p-10 text-center bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-stone-200/60 text-stone-500 mx-auto flex items-center justify-center">
                  <Pill className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-[#172B25]">No Active Prescriptions Issued</h4>
                  <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                    Set up medications with daily dose schedules (morning, noon, night), meal instructions, and duration.
                    Reminders will automatically sync to {patient.name}'s mobile dashboard.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setShowPrescribeModal(true)}
                    className="px-4 py-2 bg-[#1E3F35] hover:bg-[#16322A] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Prescribe Medication Now</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {patientPrescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="p-5 rounded-2xl border border-stone-200 hover:border-stone-300 bg-white shadow-2xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-sm sm:text-base text-[#172B25] font-serif">{rx.name}</h4>
                        <p className="text-xs text-stone-600 mt-0.5">
                          <strong>Instructions:</strong> {rx.instructions}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full ${
                            rx.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {rx.status} · {rx.remainingDays} days left
                        </span>
                      </div>
                    </div>

                    {rx.advice && rx.advice.length > 0 && (
                      <div className="text-xs text-emerald-900 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/60">
                        <strong>Clinical & Lifestyle Advice:</strong> {rx.advice.join(' · ')}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-stone-400 pt-1 border-t border-stone-100">
                      <span>Course: {rx.startDate} → {rx.endDate} ({rx.totalDays} days total)</span>
                      <span>Doctor: <strong>{rx.doctorName}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Today's Schedule Adherence Live Preview */}
            <div className="pt-4 border-t border-stone-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-stone-700 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-700" />
                  <span>Today's Live Intake Schedule ({medicineSchedule.length} doses scheduled)</span>
                </h4>
                <span className="text-xs text-stone-500">Live Adherence Status</span>
              </div>

              {medicineSchedule.length === 0 ? (
                <p className="text-xs text-stone-400 bg-stone-50 p-4 rounded-xl text-center">
                  No scheduled doses logged for today yet. Doses will automatically populate when an active prescription is issued.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {medicineSchedule.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/60 flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <h5 className="font-bold text-xs text-[#172B25]">
                          {item.name} {item.dose}
                        </h5>
                        <p className="text-[11px] text-stone-500">{item.timing || item.scheduledTime}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.state === 'taken'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.state === 'taken' ? '✓ Taken' : 'Due'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB CONTENT: NOTES                                                   */}
      {/* ==================================================================== */}
      {activeTab === 'Notes' && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70 space-y-4">
          <h3 className="text-lg font-bold text-[#172B25]">Clinician Notes & Care Observations</h3>
          <p className="text-xs text-stone-500">Private clinical records encrypted and visible only to attending clinicians.</p>
          <div className="p-8 text-center text-xs text-stone-500 bg-stone-50 rounded-2xl border border-stone-200/70 space-y-2">
            <FileText className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="font-semibold text-stone-700">No private notes recorded for {patient.name}</p>
            <p className="text-stone-400">Add clinical annotations during review or consultation.</p>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB CONTENT: OVERVIEW (Spotlight, Key Metrics & Trends)               */}
      {/* ==================================================================== */}
      {activeTab === 'Overview' && (
        <>
          {/* Quick Stat Widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => setActiveTab('Lab Reports')}
              className="bg-white rounded-2xl p-5 border border-stone-200 hover:border-stone-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-stone-500">Diagnostic Reports</p>
                <h4 className="text-2xl font-extrabold text-[#172B25] mt-0.5">{chronologicalReports.length}</h4>
                <p className="text-[11px] text-stone-400 mt-1">
                  {latestReport ? `Latest: ${latestReport.collectionDate || latestReport.reportedDate}` : 'No reports yet'}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-stone-100 text-[#1E3F35] flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => setActiveTab('Appointments')}
              className="bg-white rounded-2xl p-5 border border-stone-200 hover:border-stone-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-stone-500">Appointments</p>
                <h4 className="text-2xl font-extrabold text-[#172B25] mt-0.5">{chronologicalAppointments.length}</h4>
                <p className="text-[11px] text-stone-400 mt-1">
                  {chronologicalAppointments[0] ? `Next: ${chronologicalAppointments[0].date} ${chronologicalAppointments[0].time}` : 'None scheduled'}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-stone-100 text-[#1E3F35] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => setActiveTab('Medicines')}
              className="bg-white rounded-2xl p-5 border border-stone-200 hover:border-stone-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-stone-500">Active Prescriptions</p>
                <h4 className="text-2xl font-extrabold text-[#172B25] mt-0.5">{patientPrescriptions.length}</h4>
                <p className="text-[11px] text-stone-400 mt-1">
                  {patientPrescriptions.length > 0 ? `${patientPrescriptions[0].name}` : 'No active prescriptions'}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-stone-100 text-emerald-700 flex items-center justify-center">
                <Pill className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Latest Report Breakdown & AI Context */}
          {latestReport && selectedParam ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Parameter Table (8 cols) */}
              <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#172B25]">Latest Lab Report: {latestReport.name}</h3>
                    <p className="text-xs text-stone-500">
                      Reported {latestReport.reportedDate} · {latestReport.labName}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/doctor/reports/${latestReport.id}`)}
                    className="text-xs font-semibold bg-[#32A299] hover:bg-[#288E86] text-white px-3 py-1.5 rounded-lg shadow-sm cursor-pointer"
                  >
                    Compose patient reply
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-400 uppercase font-semibold text-[10px] tracking-wider">
                        <th className="pb-3">Parameter</th>
                        <th className="pb-3">Value</th>
                        <th className="pb-3">Unit</th>
                        <th className="pb-3">Reference</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {latestReport.parameters?.map((param) => {
                        const isSelected = (param.id || param.name) === (selectedParam.id || selectedParam.name);
                        return (
                          <tr
                            key={param.id || param.name}
                            onClick={() => setSelectedParamId(param.id || param.name)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-[#EBF4F0] font-bold' : 'hover:bg-stone-50'
                            }`}
                          >
                            <td className="py-3 px-2 font-medium text-stone-900">{param.name}</td>
                            <td className="py-3 px-2 font-bold text-[#172B25]">{param.value}</td>
                            <td className="py-3 px-2 text-stone-500">{param.unit}</td>
                            <td className="py-3 px-2 text-stone-500 font-mono text-[11px]">{param.referenceRange}</td>
                            <td className="py-3 px-2">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  param.status === 'Critical'
                                    ? 'bg-[#FDF2F0] text-[#B53629]'
                                    : param.status === 'High' || param.status === 'Low'
                                    ? 'bg-[#FEF3D6] text-[#8C6200]'
                                    : 'bg-[#E4EDE8] text-[#2B5246]'
                                }`}
                              >
                                {param.status}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right font-medium">
                              <span
                                className={
                                  param.change?.includes('↓')
                                    ? 'text-[#B53629]'
                                    : param.change?.includes('↑')
                                    ? 'text-[#2E9E6B]'
                                    : 'text-stone-400'
                                }
                              >
                                {param.change || '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Selected Parameter AI Context (4 cols) */}
              <div className="lg:col-span-4 bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-base text-[#172B25]">{selectedParam.name}</h4>
                  <span className="text-[11px] font-semibold bg-[#E0F7F5] text-[#0C736A] border border-[#80D7CE] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs">
                    <Sparkles className="w-3 h-3 text-[#0A887D]" />
                    <span>AI analysis</span>
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[#172B25]">{selectedParam.value}</span>
                  <span className="text-xs text-stone-500 font-medium">{selectedParam.unit}</span>
                  <span className="text-[11px] font-bold text-[#B53629] bg-[#FDF2F0] px-2 py-0.5 rounded-full ml-auto">
                    {selectedParam.status}
                  </span>
                </div>

                <p className="text-xs text-stone-500">
                  Reference range: <strong>{selectedParam.referenceRange} {selectedParam.unit}</strong>
                </p>

                <div className="space-y-3 pt-3 border-t border-stone-100 text-xs">
                  <div>
                    <h5 className="font-bold text-stone-800 mb-1">Clinical Context</h5>
                    <p className="text-stone-600 leading-relaxed">
                      {selectedParam.whatItMeans ||
                        'Parameters outside reference intervals warrant clinical correlation with patient symptoms and history.'}
                    </p>
                  </div>

                  <div>
                    <h5 className="font-bold text-stone-800 mb-1">Points to Consider</h5>
                    <p className="text-stone-600 leading-relaxed">
                      {selectedParam.pointsToConsider || 'Clinical correlation recommended.'}
                    </p>
                  </div>
                </div>

                <div className="bg-stone-50 border border-stone-200/70 rounded-2xl p-3 text-[11px] text-stone-500 flex items-start gap-2">
                  <Info className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5" />
                  <span>AI-generated reference. Confirm against laboratory report.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 sm:p-10 text-center bg-white rounded-3xl border border-stone-200/80 shadow-card space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-500 mx-auto flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-[#172B25]">No Laboratory Reports Uploaded Yet</h4>
              <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                Once {patient.name} submits diagnostic test results, complete parameter breakdowns and historical trends will be summarized here.
              </p>
            </div>
          )}

          {/* Longitudinal Trend Chart */}
          {chronologicalReports.length > 0 && selectedParam && (
            <MedicalTrendChart
              reports={chronologicalReports}
              initialKey={findBiomarkerDefinition(selectedParam.name).key}
              title="Longitudinal Laboratory Trend Analysis"
              subtitle="Chronological biomarker progression across verified laboratory reports"
              onClickReport={(repId) => navigate(`/doctor/reports/${repId}`)}
            />
          )}
        </>
      )}

      {/* ==================================================================== */}
      {/* MODAL: PRESCRIBE MEDICINE                                            */}
      {/* ==================================================================== */}
      {showPrescribeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#172B25] flex items-center gap-2">
                  <Pill className="w-5 h-5 text-emerald-700" />
                  <span>Prescribe Medicine</span>
                </h3>
                <p className="text-xs text-stone-500">Patient: {patient.name} ({patient.rsId})</p>
              </div>
              <button
                onClick={() => setShowPrescribeModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {prescribeSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Prescription saved! Doses and reminders dispatched to patient.</span>
              </div>
            )}

            {prescribeError && (
              <div className="p-3.5 rounded-xl bg-rose-100 text-rose-900 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{prescribeError}</span>
              </div>
            )}

            <form onSubmit={handlePrescribeSubmit} className="space-y-4 text-xs">
              {/* Medicine Name */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Medicine & Strength *</label>
                <input
                  type="text"
                  value={prescribeName}
                  onChange={(e) => setPrescribeName(e.target.value)}
                  placeholder="e.g. Metformin 500 mg, Amoxicillin 500 mg"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35] text-sm"
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {[
                    'Metformin 500 mg',
                    'Amoxicillin 500 mg',
                    'Pantoprazole 40 mg',
                    'Atorvastatin 10 mg',
                    'Telmisartan 40 mg',
                    'Paracetamol 650 mg',
                  ].map((med) => (
                    <button
                      type="button"
                      key={med}
                      onClick={() => setPrescribeName(med)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium cursor-pointer"
                    >
                      {med}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dosage & Course Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block">Dosage Quantity</label>
                  <input
                    type="text"
                    value={prescribeDose}
                    onChange={(e) => setPrescribeDose(e.target.value)}
                    placeholder="e.g. 1 tablet, 5 ml"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block">Course (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={prescribeDuration}
                    onChange={(e) => setPrescribeDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20"
                  />
                </div>
              </div>

              {/* Timings Multi-select */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Dose Timing Slots (Creates daily reminders)</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Morning', time: '08:00 AM' },
                    { label: 'Noon', time: '01:00 PM' },
                    { label: 'Evening', time: '06:30 PM' },
                    { label: 'Night', time: '09:00 PM' },
                  ].map((slot) => {
                    const active = prescribeTimings.includes(slot.label);
                    return (
                      <button
                        type="button"
                        key={slot.label}
                        onClick={() => toggleTiming(slot.label)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          active
                            ? 'bg-[#1E3F35] text-white border-[#1E3F35] shadow-xs'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        <p className="font-bold text-xs">{slot.label}</p>
                        <p className={`text-[10px] ${active ? 'text-emerald-200' : 'text-stone-400'}`}>
                          {slot.time}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Meal Relationship */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Food / Meal Instructions</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {['After food', 'Before food', 'With meals', 'Empty stomach'].map((meal) => (
                    <button
                      type="button"
                      key={meal}
                      onClick={() => setPrescribeMeal(meal)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                        prescribeMeal === meal
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      {meal}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinical & Lifestyle Advice */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Lifestyle & Clinical Advice for Patient</label>
                <textarea
                  rows={2}
                  value={prescribeAdvice}
                  onChange={(e) => setPrescribeAdvice(e.target.value)}
                  placeholder="e.g. Maintain hydration. Avoid high sodium. Monitor fasting glucose."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowPrescribeModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPrescribing}
                  className="px-5 py-2.5 rounded-xl bg-[#1E3F35] hover:bg-[#16322A] text-white font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Pill className="w-4 h-4" />
                  <span>{isPrescribing ? 'Prescribing...' : 'Prescribe & Set Reminders'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: SCHEDULE NEW APPOINTMENT WITH PATIENT                         */}
      {/* ==================================================================== */}
      {showAppointmentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#172B25] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#1E3F35]" />
                  <span>Schedule Appointment</span>
                </h3>
                <p className="text-xs text-stone-500">
                  Patient: <strong>{patient.name}</strong> ({patient.rsId})
                </p>
              </div>
              <button
                onClick={() => setShowAppointmentModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {appointmentSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Appointment scheduled & confirmed! Dispatched notification to patient.</span>
              </div>
            )}

            {appointmentError && (
              <div className="p-3.5 rounded-xl bg-rose-100 text-rose-900 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{appointmentError}</span>
              </div>
            )}

            <form onSubmit={handleScheduleAppointmentSubmit} className="space-y-4 text-xs">
              {/* Date Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Consultation Date *</label>
                <input
                  type="date"
                  value={appointmentDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 text-xs font-semibold"
                />
                {/* Date Quick Shortcuts */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {[
                    { label: 'Today', days: 0 },
                    { label: 'Tomorrow', days: 1 },
                    { label: 'In 3 Days', days: 3 },
                    { label: 'Next Week', days: 7 },
                  ].map((shortcut) => (
                    <button
                      type="button"
                      key={shortcut.label}
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + shortcut.days);
                        setAppointmentDate(d.toISOString().split('T')[0]);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium cursor-pointer"
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slot Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Time Slot *</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[
                    '09:00 AM',
                    '09:30 AM',
                    '10:30 AM',
                    '11:30 AM',
                    '02:00 PM',
                    '03:00 PM',
                    '04:00 PM',
                    '05:00 PM',
                  ].map((slot) => {
                    const active = appointmentTime === slot;
                    return (
                      <button
                        type="button"
                        key={slot}
                        onClick={() => setAppointmentTime(slot)}
                        className={`py-2 px-1 text-center rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                          active
                            ? 'bg-[#1E3F35] text-white border-[#1E3F35] shadow-xs'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  placeholder="Or enter custom time (e.g. 10:45 AM)"
                  className="w-full mt-2 px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20"
                />
              </div>

              {/* Consultation Type */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Consultation Format *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'In-person', icon: Building2, desc: 'Clinic Visit' },
                    { type: 'Video call', icon: Video, desc: 'Telehealth' },
                    { type: 'Phone call', icon: Phone, desc: 'Audio Call' },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const active = appointmentType === opt.type;
                    return (
                      <button
                        type="button"
                        key={opt.type}
                        onClick={() => setAppointmentType(opt.type as any)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          active
                            ? 'bg-[#1E3F35] text-white border-[#1E3F35] shadow-xs'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        <Icon className="w-4 h-4 mx-auto mb-1" />
                        <p className="font-bold text-xs">{opt.type}</p>
                        <p className={`text-[10px] ${active ? 'text-emerald-200' : 'text-stone-400'}`}>
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reason for Appointment */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Clinical Reason / Purpose *</label>
                <input
                  type="text"
                  value={appointmentReason}
                  onChange={(e) => setAppointmentReason(e.target.value)}
                  placeholder="e.g. Follow-up on CBC platelet count & review medications"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20"
                />
                {/* Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {[
                    'Follow-up on CBC Lab Report',
                    'Review Platelet Count',
                    'Medication Adjustment Review',
                    'Routine Clinical Consultation',
                  ].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setAppointmentReason(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clinical Preparation Notes */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Preparation Notes for Patient</label>
                <textarea
                  rows={2}
                  value={appointmentNotes}
                  onChange={(e) => setAppointmentNotes(e.target.value)}
                  placeholder="e.g. Please bring recent prescriptions. Fasting required for repeat blood sample."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAppointmentModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAppointment}
                  className="px-5 py-2.5 rounded-xl bg-[#1E3F35] hover:bg-[#16322A] text-white font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Calendar className="w-4 h-4" />
                  <span>{isSubmittingAppointment ? 'Scheduling...' : 'Confirm Appointment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorPatientDetail;
