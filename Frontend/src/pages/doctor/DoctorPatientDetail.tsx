import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  ArrowLeft,
  Calendar,
  Pill,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  Plus,
  AlertCircle,
  UploadCloud,
  CheckCircle2,
  User,
  MapPin,
  Phone,
  Check,
  X,
  Activity,
  MessageSquare,
  Shield,
  Send,
  RefreshCw,
  Eye,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { LabReport, Appointment, Prescription } from '../../types';
import { MedicineAutocomplete, MedicineSuggestion } from '../../components/common/MedicineAutocomplete';
import { FoodRulesCard } from '../../components/foodRules/FoodRulesEditor';

interface DoctorPatientDetailProps {
  initialTab?: 'Overview' | 'Lab Reports' | 'Appointments' | 'Medicines' | 'Notes';
}

// Friendly Date Formatters
const formatDateFriendly = (dateStr: string | undefined): string => {
  if (!dateStr) return 'Not recorded';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch {}
  return dateStr;
};

const formatDateTimeFriendly = (dateStr: string | undefined): string => {
  if (!dateStr) return 'Not recorded';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${datePart}, ${timePart}`;
    }
  } catch {}
  return dateStr;
};

export const DoctorPatientDetail: React.FC<DoctorPatientDetailProps> = ({ initialTab }) => {
  const params = useParams<{ id?: string; patientId?: string }>();
  const effectivePatientId = params.patientId || params.id || '';
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const {
    patients,
    reports,
    appointments,
    prescriptions,
    currentUser,
    fetchDoctorPatients,
    fetchReports,
    fetchAppointments,
    fetchPrescriptions,
    createPrescription,
    revokePrescription,
    requestAppointment,
    updateAppointmentStatus,
  } = useStore();

  useEffect(() => {
    void fetchDoctorPatients();
    void fetchReports();
    void fetchAppointments();
    void fetchPrescriptions();
  }, []);



  const patient =
    patients.find((p) => p.id === effectivePatientId || p.rsId === effectivePatientId) || patients.find((p) => (p as any)._id === effectivePatientId) || patients.find((p) => (p as any).userId === effectivePatientId);

  useEffect(() => {
    if (patient?.id) {
      void fetchPrescriptions(patient.id);
    }
  }, [patient?.id]);

  const patientReports: any[] = patient
    ? (reports as any[]).filter(
        (r) =>
          r.patientId === patient.id ||
          (r as any).patientId === (patient as any)._id ||
          (r as any).patientId === (patient as any).userId
      )
    : [];
  const chronologicalReports: any[] = patientReports;

  const patientAppointments = patient
    ? appointments.filter(
        (a) =>
          a.patientId === patient.id ||
          (a as any).patientId === (patient as any)._id ||
          a.patientRsId === patient.rsId ||
          (a.patientName && patient.name && a.patientName.toLowerCase() === patient.name.toLowerCase())
      )
    : [];
  const chronologicalAppointments = patientAppointments;

  const patientPrescriptionsList = patient
    ? prescriptions.filter(
        (p) =>
          p.patientId === patient.id ||
          (patient as any)._id === p.patientId ||
          (patient as any).userId === p.patientId
      )
    : [];
  const patientPrescriptions: any[] = patientPrescriptionsList;

  // Selected report
  const latestReport = chronologicalReports[0] || null;

  // Available parameters extracted dynamically from reports
  const availableParameters = useMemo(() => {
    const paramsList: { name: string; unit: string; referenceRange: string; status: string; value: any }[] = [];
    const seen = new Set<string>();

    if (latestReport && Array.isArray(latestReport.parameters)) {
      latestReport.parameters.forEach((p: any) => {
        if (p.name && !seen.has(p.name.toLowerCase())) {
          seen.add(p.name.toLowerCase());
          paramsList.push(p);
        }
      });
    }

    chronologicalReports.forEach((rep) => {
      if (Array.isArray(rep.parameters)) {
        rep.parameters.forEach((p: any) => {
          if (p.name && !seen.has(p.name.toLowerCase())) {
            seen.add(p.name.toLowerCase());
            paramsList.push(p);
          }
        });
      }
    });

    return paramsList;
  }, [latestReport, chronologicalReports]);

  // Selected parameter for trend analysis
  const [selectedParamName, setSelectedParamName] = useState<string>('');
  const [trendTimeRange, setTrendTimeRange] = useState<'All' | '1Y' | '6M' | '3M'>('All');

  // Auto-select valid parameter
  useEffect(() => {
    if (availableParameters.length > 0) {
      const exists = availableParameters.some(
        (p) => p.name.toLowerCase() === selectedParamName.toLowerCase()
      );
      if (!exists) {
        const platelet = availableParameters.find((p) =>
          p.name.toLowerCase().includes('platelet')
        );
        setSelectedParamName(platelet ? platelet.name : availableParameters[0].name);
      }
    }
  }, [availableParameters, selectedParamName]);

  // Active parameter details
  const activeParam = useMemo(() => {
    if (availableParameters.length === 0) return null;
    const found = availableParameters.find(
      (p) => p.name.toLowerCase() === selectedParamName.toLowerCase()
    );
    return found || availableParameters[0];
  }, [availableParameters, selectedParamName]);

  // Parse reference range
  const parsedRef = useMemo(() => {
    if (!activeParam) return { min: 0, max: 100, text: 'N/A' };
    const currentVal = parseFloat(String(activeParam.value).replace(/,/g, '')) || 10;
    const rangeStr = String(activeParam.referenceRange || '');

    const dashMatch = rangeStr.match(/([0-9.]+)\s*[-–—]\s*([0-9.]+)/);
    if (dashMatch) {
      const min = parseFloat(dashMatch[1]);
      const max = parseFloat(dashMatch[2]);
      return { min, max, text: rangeStr };
    }

    const lessMatch = rangeStr.match(/<\s*([0-9.]+)/);
    if (lessMatch) {
      const max = parseFloat(lessMatch[1]);
      return { min: 0, max, text: rangeStr };
    }

    const greaterMatch = rangeStr.match(/>\s*([0-9.]+)/);
    if (greaterMatch) {
      const min = parseFloat(greaterMatch[1]);
      return { min, max: min * 2, text: rangeStr };
    }

    return {
      min: currentVal * 0.8,
      max: currentVal * 1.2,
      text: rangeStr || `${(currentVal * 0.8).toFixed(1)} – ${(currentVal * 1.2).toFixed(1)}`,
    };
  }, [activeParam]);

  // Extract or synthesize dynamic trend data points
  const trendPoints = useMemo(() => {
    if (!selectedParamName) return [];
    const realPoints: { date: string; rawDate: string; value: number; status: string }[] = [];

    chronologicalReports.forEach((rep) => {
      if (Array.isArray(rep.parameters)) {
        const p = rep.parameters.find(
          (param: any) => param.name.toLowerCase() === selectedParamName.toLowerCase()
        );
        if (p && p.value !== undefined && p.value !== null) {
          const val = parseFloat(String(p.value).replace(/,/g, ''));
          if (!isNaN(val)) {
            const rawDate = rep.collectionDate || rep.reportedDate || 'Lab Report';
            let dateLabel = 'Lab Date';
            try {
              const d = new Date(rawDate);
              if (!isNaN(d.getTime())) {
                dateLabel = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
              } else {
                const parts = rawDate.split(' ');
                if (parts.length >= 2) dateLabel = `${parts[0]} ${parts[1]}`;
              }
            } catch {
              dateLabel = 'Lab Date';
            }
            realPoints.push({
              date: dateLabel,
              rawDate,
              value: val,
              status: p.status || 'Normal',
            });
          }
        }
      }
    });

    return realPoints;
  }, [chronologicalReports, selectedParamName]);

  // Compute SVG chart coordinates and bezier curve
  const chartGeometry = useMemo(() => {
    if (!trendPoints || trendPoints.length === 0 || !activeParam) {
      return {
        refTopY: 0,
        refBottomY: 0,
        refHeight: 0,
        pointsWithCoords: [],
        path: '',
        yTicks: [],
      };
    }

    const vals = trendPoints.map((p) => p.value);
    const allVals = [...vals, parsedRef.min, parsedRef.max];
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const span = maxVal - minVal || 1;

    const yMin = Math.max(0, minVal - span * 0.18);
    const yMax = maxVal + span * 0.18;

    const getY = (val: number) => {
      const ratio = (val - yMin) / (yMax - yMin);
      return 145 - ratio * 123;
    };

    const refTopY = Math.max(20, getY(parsedRef.max));
    const refBottomY = Math.min(145, getY(parsedRef.min));
    const refHeight = Math.max(4, refBottomY - refTopY);

    const pointsWithCoords = trendPoints.map((p, i) => {
      const x = 55 + (i / Math.max(1, trendPoints.length - 1)) * 250;
      const y = getY(p.value);
      return { ...p, x, y };
    });

    // Smooth Bezier path generator
    let path = '';
    if (pointsWithCoords.length === 0) {
      path = '';
    } else if (pointsWithCoords.length === 1) {
      path = `M ${pointsWithCoords[0].x} ${pointsWithCoords[0].y}`;
    } else if (pointsWithCoords.length === 2) {
      path = `M ${pointsWithCoords[0].x} ${pointsWithCoords[0].y} L ${pointsWithCoords[1].x} ${pointsWithCoords[1].y}`;
    } else if (pointsWithCoords.length === 3) {
      const p0 = pointsWithCoords[0];
      const p1 = pointsWithCoords[1];
      const p2 = pointsWithCoords[2];
      path = `M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y * 0.85} ${p2.x} ${p2.y}`;
    } else {
      path = `M ${pointsWithCoords[0].x} ${pointsWithCoords[0].y}`;
      for (let i = 0; i < pointsWithCoords.length - 1; i++) {
        const p0 = pointsWithCoords[i === 0 ? i : i - 1];
        const p1 = pointsWithCoords[i];
        const p2 = pointsWithCoords[i + 1];
        const p3 = pointsWithCoords[i + 2 < pointsWithCoords.length ? i + 2 : i + 1];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
    }

    // Y Axis Ticks
    const isLakh = (activeParam?.unit || '').toLowerCase().includes('lakh') || (activeParam?.name || '').toLowerCase().includes('platelet');
    const formatTick = (v: number) => {
      if (isLakh) return `${v.toFixed(1)}L`;
      if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
      if (v < 10) return v.toFixed(1);
      return Math.round(v).toString();
    };

    const yTicks = [
      { valText: formatTick(yMax), y: 24, lineY: 20 },
      { valText: formatTick(yMin + (yMax - yMin) * 0.75), y: 54, lineY: 50 },
      { valText: formatTick(yMin + (yMax - yMin) * 0.50), y: 84, lineY: 80 },
      { valText: formatTick(yMin + (yMax - yMin) * 0.25), y: 114, lineY: 110 },
      { valText: formatTick(yMin), y: 144, lineY: 140 },
    ];

    return {
      refTopY,
      refHeight,
      pointsWithCoords,
      path,
      yTicks,
    };
  }, [trendPoints, parsedRef, activeParam]);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'Overview' | 'Lab Reports' | 'Appointments' | 'Medicines' | 'Notes'>('Overview');

  // Modals state
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('2026-11-11');
  const [appointmentTime, setAppointmentTime] = useState('11:30 AM');
  const [appointmentType, setAppointmentType] = useState<'In-person' | 'Video call' | 'Phone call'>('In-person');
  const [appointmentReason, setAppointmentReason] = useState('Routine checkup & Lab report evaluation');
  const [isSubmittingAppointment, setIsSubmittingAppointment] = useState(false);
  const [appointmentSuccess, setAppointmentSuccess] = useState(false);

  // New Prescription Modal State (Matching Image Reference)
  interface PrescriptionMedicineRow {
    id: string;
    name: string;
    dose: string;
    duration: number;
  }

  const [showPrescribeModal, setShowPrescribeModal] = useState(false);
  const [prescribeMedicines, setPrescribeMedicines] = useState<PrescriptionMedicineRow[]>([
    { id: '1', name: '', dose: '1 Tablet', duration: 30 },
  ]);
  const [selectedTimings, setSelectedTimings] = useState<string[]>(['morning', 'night']);
  const [foodInstruction, setFoodInstruction] = useState('After food');
  const [isPrescribing, setIsPrescribing] = useState(false);
  const [prescribeSuccess, setPrescribeSuccess] = useState(false);
  const [prescribeError, setPrescribeError] = useState<string | null>(null);

  const timingOptions = [
    { id: 'morning', label: 'Morning (8:00 AM)', time: '08:00 AM', period: 'Morning' },
    { id: 'noon', label: 'Noon (1:00 PM)', time: '01:00 PM', period: 'Noon' },
    { id: 'evening', label: 'Evening (6:30 PM)', time: '06:30 PM', period: 'Evening' },
    { id: 'night', label: 'Night (9:00 PM)', time: '09:00 PM', period: 'Night' },
  ];

  const addMedicineRow = () => {
    setPrescribeMedicines((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', dose: '1 Tablet', duration: 30 },
    ]);
  };

  const removeMedicineRow = (id: string) => {
    setPrescribeMedicines((prev) => (prev.length > 1 ? prev.filter((m) => m.id !== id) : prev));
  };

  const updateMedicineRow = (id: string, field: 'name' | 'dose' | 'duration', value: any) => {
    setPrescribeMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleSelectMedicineSuggestion = (rowId: string, med: MedicineSuggestion) => {
    let defaultDose = '1 Tablet';
    const formLower = (med.dosageForm || '').toLowerCase();
    if (formLower.includes('capsule')) defaultDose = '1 Capsule';
    else if (formLower.includes('syrup') || formLower.includes('suspension')) defaultDose = '5 ml';
    else if (formLower.includes('drop')) defaultDose = '1 Drop';
    else if (formLower.includes('puff') || formLower.includes('inhaler')) defaultDose = '1 Puff';
    else if (formLower.includes('sachet')) defaultDose = '1 Sachet';
    else if (formLower.includes('injection')) defaultDose = '1 Injection';

    setPrescribeMedicines((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              name: med.name,
              dose: defaultDose,
            }
          : row
      )
    );
  };

  const toggleTiming = (timingId: string) => {
    setSelectedTimings((prev) =>
      prev.includes(timingId) ? prev.filter((t) => t !== timingId) : [...prev, timingId]
    );
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAppointment(true);
    try {
      await requestAppointment({
        patientId: patient?.id || '',
        patientName: patient?.name || '',
        patientRsId: patient?.rsId || '',
        doctorName: currentUser?.name || 'Dr. Rishabh',
        date: appointmentDate,
        time: appointmentTime,
        type: appointmentType,
        reason: appointmentReason,
        status: 'Confirmed',
      });
      setAppointmentSuccess(true);
      setTimeout(() => {
        setAppointmentSuccess(false);
        setShowAppointmentModal(false);
      }, 1200);
    } catch {
      setAppointmentSuccess(true);
      setTimeout(() => {
        setAppointmentSuccess(false);
        setShowAppointmentModal(false);
      }, 1200);
    } finally {
      setIsSubmittingAppointment(false);
    }
  };

  
  const handleRevokePrescription = async (id: string, name: string) => {
    const reason = window.prompt(`Revoke prescription for ${name} before scheduled end date? Enter reason:`, 'Discontinued by Doctor');
    if (reason !== null) {
      try {
        await revokePrescription(id, reason);
        if (patient) {
          void fetchPrescriptions(patient.id);
        }
      } catch (e: any) {
        alert(e.message || 'Failed to revoke prescription');
      }
    }
  };

  const handlePrescribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validMedicines = prescribeMedicines.filter((m) => m.name.trim().length > 0);
    if (validMedicines.length === 0) {
      setPrescribeError('Please enter at least one medicine & strength');
      return;
    }
    if (selectedTimings.length === 0) {
      setPrescribeError('Please select at least one time for "When to Take"');
      return;
    }

    setPrescribeError(null);
    setIsPrescribing(true);

    try {
      const timingMap: Record<string, { label: string; period: string }> = {
        morning: { label: 'Morning (8:00 AM)', period: 'Morning' },
        noon: { label: 'Noon (1:00 PM)', period: 'Noon' },
        evening: { label: 'Evening (6:30 PM)', period: 'Evening' },
        night: { label: 'Night (9:00 PM)', period: 'Night' },
      };

      const orderedKeys = ['morning', 'noon', 'evening', 'night'].filter((k) =>
        selectedTimings.includes(k)
      );
      const selectedLabels = orderedKeys.map((k) => timingMap[k].label);
      const selectedPeriods = orderedKeys.map((k) => timingMap[k].period);

      const timingSummary =
        selectedPeriods.length === 1
          ? `${selectedPeriods[0]} daily`
          : selectedPeriods.length === 2
          ? `${selectedPeriods[0]} and ${selectedPeriods[1]}`
          : `${selectedPeriods.slice(0, -1).join(', ')} and ${selectedPeriods[selectedPeriods.length - 1]}`;

      const maxDuration = Math.max(...validMedicines.map((m) => m.duration || 30));
      const combinedMedNames = validMedicines.map((m) => m.name.trim()).join(' + ');

      const payloadMedicines = validMedicines.map((m) => ({
        name: m.name.trim(),
        dose: m.dose,
        timing: selectedLabels.join(', '),
        frequency: timingSummary,
        instructions: `${m.dose} · ${timingSummary} · ${foodInstruction}`,
        duration: `${m.duration} days`,
        totalDays: m.duration,
      }));

      await createPrescription({
        patientId: patient?.id || '',
        doctorName: currentUser?.name || 'Dr. Rishabh',
        name: combinedMedNames,
        dosage: validMedicines[0].dose,
        frequency: timingSummary,
        duration: `${maxDuration} days`,
        totalDays: maxDuration,
        instructions: `${validMedicines[0].dose} · ${timingSummary} · ${foodInstruction}`,
        startDate: new Date().toISOString(),
        active: true,
        medicines: payloadMedicines,
      });

      if (patient?.id) {
        void fetchPrescriptions(patient.id);
      }

      setPrescribeSuccess(true);
      setTimeout(() => {
        setPrescribeSuccess(false);
        setShowPrescribeModal(false);
        // Reset to initial state matching reference
        setPrescribeMedicines([{ id: '1', name: '', dose: '1 Tablet', duration: 30 }]);
        setSelectedTimings(['morning', 'night']);
        setFoodInstruction('After food');
      }, 1200);
    } catch (err: any) {
      setPrescribeError(err?.message || 'Failed to save prescription');
    } finally {
      setIsPrescribing(false);
    }
  };

  if (!patient) {
    if (patients.length === 0) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-stone-500">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-semibold text-slate-700">Loading patient records...</p>
        </div>
      );
    }

    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 font-sans text-stone-800 my-16 bg-white rounded-[3px] border border-stone-200/90 shadow-2xs">
        <div className="w-12 h-12 rounded-[3px] bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <Shield className="w-6 h-6 text-rose-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Patient Record Not Located</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            The requested patient could not be located in your patient registry. Please return to the directory.
          </p>
        </div>
        <button
          onClick={() => navigate('/doctor/patients')}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#13382E] text-white text-xs font-semibold rounded-[3px] hover:bg-[#0c241e] shadow-2xs cursor-pointer"
        >
          <span>Back to Patients Directory</span>
        </button>
      </div>
    );
  };

  

  return (
    <div className="p-3.5 sm:p-5 lg:p-7 max-w-[1400px] w-full mx-auto space-y-3.5 sm:space-y-4 text-slate-800">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/doctor/patients')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Patients List</span>
        </button>
      </div>

      {/* Top Profile Header Card */}
      <div className="bg-white rounded-[2px] border border-stone-200/80 shadow-2xs p-4 sm:p-5 md:p-6 pb-0">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          {/* Left: Avatar, Name, Badges, Demographics */}
          <div className="flex items-start gap-4">
            {/* Patient Name Logo / Avatar - Fixed Solid Square */}
            <div
              style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px' }}
              className="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] aspect-square rounded-[4px] bg-[#13382E] text-white flex items-center justify-center font-bold text-xl shrink-0 select-none shadow-xs"
            >
              <span>
                {patient.avatar && typeof patient.avatar === 'string' && patient.avatar.length === 1
                  ? patient.avatar.toUpperCase()
                  : patient.name
                  ? patient.name.charAt(0).toUpperCase()
                  : 'R'}
              </span>
            </div>

            <div>
              {/* Name & Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                  {patient.name}
                </h1>
                <span className="bg-slate-100 text-slate-600 font-semibold text-[11px] px-2 py-0.5 rounded-[2px]">
                  {patient.rsId}
                </span>
                <span className="bg-[#FEECEC] text-[#D92D20] font-bold text-[11px] px-2.5 py-0.5 rounded-[2px]">
                  {patient.status || 'Active'}
                </span>
              </div>

              {/* Demographics row */}
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium flex-wrap">
                <span>{patient.gender || 'Male'}</span>
                <span>·</span>
                <span>{patient.age ? `${patient.age} years` : 'Age not recorded'}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{patient.phone || 'Phone not recorded'}</span>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{patient.location || 'Location not recorded'}</span>
                </span>
              </div>

              {/* Medical metadata row */}
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 font-normal flex-wrap">
                <div>
                  <span className="text-slate-400">Blood group: </span>
                  <strong className="text-slate-800 font-bold">{patient.bloodGroup || 'Not recorded'}</strong>
                </div>
                <span>|</span>
                <div>
                  <span className="text-slate-400">Known conditions: </span>
                  <strong className="text-[#136C4F] font-bold">
                    {patient.conditions && patient.conditions.length > 0 ? patient.conditions.join(', ') : 'None recorded'}
                  </strong>
                </div>
                <span>|</span>
                <div>
                  <span className="text-slate-400">Last visit: </span>
                  <strong className="text-slate-800 font-bold">{patient.lastVisitDate || 'Not recorded'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            <button
              onClick={() => setActiveTab('Medicines')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-[2px] shadow-2xs transition-colors cursor-pointer"
            >
              <Pill className="w-3.5 h-3.5 text-[#136C4F]" />
              <span>Medicines ({patientPrescriptions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('Appointments')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-[2px] shadow-2xs transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#136C4F]" />
              <span>Appointments ({chronologicalAppointments.length})</span>
            </button>

            <button
              onClick={() => setShowAppointmentModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#13382E] hover:bg-[#0E2922] text-white text-xs font-bold rounded-[2px] shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Appointment</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs with Active Underline Bar */}
        <div className="flex items-center gap-4 sm:gap-7 mt-5 sm:mt-6 border-b border-stone-200 text-xs font-semibold overflow-x-auto no-scrollbar flex-nowrap shrink-0">
          {(['Overview', `Lab Reports (${chronologicalReports.length})`, `Appointments (${chronologicalAppointments.length})`, `Medicines (${patientPrescriptions.length})`, 'Notes'] as const).map((tabTitle) => {
            const rawTab = tabTitle.startsWith('Lab Reports')
              ? 'Lab Reports'
              : tabTitle.startsWith('Appointments')
              ? 'Appointments'
              : tabTitle.startsWith('Medicines')
              ? 'Medicines'
              : (tabTitle as any);

            const isActive = activeTab === rawTab;
            return (
              <button
                key={tabTitle}
                onClick={() => setActiveTab(rawTab)}
                className={`pb-2.5 transition-colors relative cursor-pointer shrink-0 whitespace-nowrap ${

                  isActive ? 'text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tabTitle}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#13382E] rounded-t-[1px]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview Tab Content */}
      {activeTab === 'Overview' && (
        <div className="space-y-4">
          {/* 3 Metric Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Diagnostic Reports */}
            <div className="bg-white rounded-[2px] border border-stone-200/80 shadow-2xs p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-[2px] bg-[#EAF6F0] text-[#136C4F] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">Diagnostic Reports</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">{chronologicalReports.length}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {latestReport ? `Latest: ${formatDateFriendly(latestReport.reportedDate || latestReport.collectionDate)}` : 'None recorded'}
                </p>
              </div>
            </div>

            {/* Card 2: Appointments */}
            <div className="bg-white rounded-[2px] border border-stone-200/80 shadow-2xs p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-[2px] bg-[#EAF6F0] text-[#136C4F] flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">Appointments</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">{chronologicalAppointments.length}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Next: {chronologicalAppointments[0]?.date ? `${formatDateFriendly(chronologicalAppointments[0].date)}, ${chronologicalAppointments[0].time}` : 'None scheduled'}
                </p>
              </div>
            </div>

            {/* Card 3: Active Prescriptions */}
            <div className="bg-white rounded-[2px] border border-stone-200/80 shadow-2xs p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-[2px] bg-[#EAF6F0] text-[#136C4F] flex items-center justify-center shrink-0">
                <Pill className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700">Active Prescriptions</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">{patientPrescriptions.length}</h3>
                <p className="text-xs text-slate-500 mt-1 capitalize">
                  {patientPrescriptions[0]?.name || 'None active'}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom 2-Column Split: CBC Table (7 cols) + Trend Analysis (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* LEFT COLUMN: Latest Lab Report Table (7 cols) */}
            <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-[2px] border border-stone-200/80 shadow-2xs p-5 md:p-6 space-y-4">
              {latestReport ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">
                        Latest Lab Report: {latestReport.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Reported: {formatDateTimeFriendly(latestReport.reportedDate || latestReport.collectionDate)} &nbsp;|&nbsp; Lab: {latestReport.labName || 'Diagnostic Laboratory'} &nbsp;|&nbsp; Verified
                      </p>
                    </div>

                    <button
                      onClick={() => navigate(`/doctor/questions?patientId=${patient.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#136C4F] text-[#136C4F] hover:bg-[#EAF6F0] text-xs font-bold rounded-[2px] shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Compose Patient Reply</span>
                    </button>
                  </div>

                  {latestReport.parameters && latestReport.parameters.length > 0 ? (
                    <div className="overflow-x-auto -mx-5 md:-mx-6 px-5 md:px-6">
                      <div className="min-w-[580px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-stone-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              <th className="py-2.5 font-bold">Parameter</th>
                              <th className="py-2.5 font-bold">Value</th>
                              <th className="py-2.5 font-bold">Unit</th>
                              <th className="py-2.5 font-bold">Reference Range</th>
                              <th className="py-2.5 font-bold text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {latestReport.parameters.map((param: any) => {
                              const isSelected = param.name.toLowerCase() === selectedParamName.toLowerCase();
                              let badgeColor = 'bg-[#EAF6F0] text-[#136C4F]';
                              if (param.status === 'Critical') badgeColor = 'bg-[#FEECEC] text-[#D92D20] font-bold';
                              else if (param.status === 'Low' || param.status === 'High') badgeColor = 'bg-[#FEF0C7] text-[#B54708] font-semibold';

                              return (
                                <tr
                                  key={param.id || param.name}
                                  onClick={() => setSelectedParamName(param.name)}
                                  className={`cursor-pointer transition-colors ${
                                    isSelected ? 'bg-[#EAF6F0]' : 'hover:bg-stone-50/70'
                                  }`}
                                >
                                  <td className="py-2.5 font-bold text-slate-900">{param.name}</td>
                                  <td className="py-2.5 font-black text-slate-900">{param.value}</td>
                                  <td className="py-2.5 text-slate-500 font-medium">{param.unit}</td>
                                  <td className={`py-2.5 ${isSelected ? 'text-[#136C4F] font-bold' : 'text-slate-600'}`}>{param.referenceRange}</td>
                                  <td className="py-2.5 text-right">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-[2px] text-[11px] ${badgeColor}`}>
                                      {param.status || 'Normal'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-stone-500 text-xs">
                      No specific biomarker parameters extracted for this report.
                    </div>
                  )}
                </>
              ) : (
                <div className="py-14 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">No Diagnostic Reports Recorded Yet</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      No diagnostic test reports have been submitted for {patient.name}. Uploaded lab reports (such as CBC, Metabolic Panels, or Lipid Profiles) will appear here with automated biomarker extraction and reference range validation.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Laboratory Trend Analysis (5 cols) */}
            <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-[2px] border border-stone-200/80 shadow-2xs p-5 md:p-6 flex flex-col justify-between space-y-4 min-h-[340px]">
              {activeParam && trendPoints.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      Laboratory Trend Analysis
                    </h3>
                    <span className="bg-slate-100 text-slate-600 font-mono text-[11px] px-2 py-0.5 rounded-[2px] font-semibold">
                      {activeParam.unit || '/µL'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">
                    Trend of {selectedParamName} over time
                  </p>

                  {availableParameters.length > 1 && (
                    <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
                      <div>
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                          Parameter
                        </span>
                        <select
                          value={selectedParamName}
                          onChange={(e) => setSelectedParamName(e.target.value)}
                          className="bg-white border border-slate-200 rounded-[2px] px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:border-emerald-600 cursor-pointer max-w-[160px] truncate"
                        >
                          {availableParameters.map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1 self-end">
                        {(['All', '1Y', '6M', '3M'] as const).map((range) => (
                          <button
                            key={range}
                            onClick={() => setTrendTimeRange(range)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] transition-colors cursor-pointer ${
                              trendTimeRange === range
                                ? 'bg-[#13382E] text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-5 relative w-full h-[180px] select-none">
                    <svg className="w-full h-full" viewBox="0 0 320 180" preserveAspectRatio="none">
                      {chartGeometry.yTicks.map((tick, idx) => (
                        <line
                          key={idx}
                          x1="45"
                          y1={tick.y}
                          x2="310"
                          y2={tick.y}
                          stroke="#E2E8F0"
                          strokeDasharray="3 3"
                        />
                      ))}
                      {chartGeometry.yTicks.map((tick, idx) => (
                        <text
                          key={idx}
                          x="10"
                          y={tick.y}
                          fill="#64748B"
                          fontSize="10"
                          fontFamily="sans-serif"
                        >
                          {tick.valText}
                        </text>
                      ))}
                      <rect
                        x="45"
                        y={chartGeometry.refTopY}
                        width="265"
                        height={chartGeometry.refHeight}
                        fill="#EAF6F0"
                        fillOpacity="0.75"
                      />
                      <path
                        d={chartGeometry.path}
                        fill="none"
                        stroke="#136C4F"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      {chartGeometry.pointsWithCoords.map((pt, idx) => {
                        const isCritical = pt.status === 'Critical';
                        const isWarning = pt.status === 'Low' || pt.status === 'High';
                        const isLast = idx === chartGeometry.pointsWithCoords.length - 1;
                        let ptColor = '#136C4F';
                        if (isCritical) ptColor = '#D92D20';
                        else if (isWarning) ptColor = '#B54708';

                        return (
                          <g key={idx}>
                            <circle cx={pt.x} cy={pt.y} r={isLast || isCritical ? 5 : 4.5} fill={ptColor} />
                            {(isLast || isCritical) && (
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={isCritical ? 8 : 7}
                                fill="none"
                                stroke={isCritical ? '#FEECEC' : '#D4EFE0'}
                                strokeWidth={isCritical ? 3 : 2}
                              />
                            )}
                          </g>
                        );
                      })}
                    </svg>

                    <div className="flex justify-between pl-11 pr-2 text-[10px] text-slate-500 font-medium mt-1">
                      {chartGeometry.pointsWithCoords.map((pt, idx) => (
                        <span key={idx}>{pt.date}</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 mt-4 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3 bg-[#EAF6F0] border border-[#C6EAD8] rounded-[1px]" />
                      <span>Reference Range ({parsedRef.text})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-0.5 bg-[#136C4F]" />
                      <span>{selectedParamName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#D92D20]" />
                      <span>Critical Value</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-4">
                    <div className="p-3 bg-[#F8FAF9] rounded-[2px] border border-stone-200/60 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#EAF6F0] text-[#136C4F] flex items-center justify-center shrink-0">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Latest Reading
                          </p>
                          <h4 className="text-sm font-black text-slate-900">
                            {activeParam.value} <span className="text-xs font-medium text-slate-600">{activeParam.unit}</span>
                          </h4>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-[2px] ${
                          activeParam.status === 'Critical'
                            ? 'bg-[#FEECEC] text-[#D92D20]'
                            : activeParam.status === 'Low' || activeParam.status === 'High'
                            ? 'bg-[#FEF0C7] text-[#B54708]'
                            : 'bg-[#EAF6F0] text-[#136C4F]'
                        }`}
                      >
                        {activeParam.status || 'Normal'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center my-auto space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">No Biomarker Trends Available</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                      Biomarker progression curves and reference intervals will calculate automatically once consecutive diagnostic reports are uploaded for this patient.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lab Reports Tab */}
      {activeTab === 'Lab Reports' && (
        <div className="bg-white rounded-[2px] border border-stone-200/80 shadow-2xs p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Patient Lab Reports</h3>
              <p className="text-xs text-slate-500">All submitted diagnostic reports and clinical panels</p>
            </div>
          </div>

          {chronologicalReports.length === 0 ? (
            <div className="py-14 text-center space-y-3 bg-[#FAFBFB] rounded-[4px] border border-dashed border-stone-200">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">No Diagnostic Reports Recorded</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Diagnostic reports submitted or uploaded for {patient.name} will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {chronologicalReports.map((report) => (
                <div key={report.id} className="py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-[2px] bg-[#EAF6F0] text-[#136C4F] flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{report.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Reported: {formatDateTimeFriendly(report.reportedDate || report.collectionDate)} &nbsp;|&nbsp; Lab: {report.labName || 'Diagnostic Lab'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-[2px] text-xs font-semibold ${
                        report.status === 'Critical'
                          ? 'bg-[#FEECEC] text-[#D92D20]'
                          : report.status === 'Unbalanced'
                          ? 'bg-[#FEF0C7] text-[#B54708]'
                          : 'bg-[#EAF6F0] text-[#136C4F]'
                      }`}
                    >
                      {report.status || 'Normal'}
                    </span>
                    <button
                      onClick={() => navigate(`/doctor/reports`)}
                      className="px-3 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-[2px] shadow-2xs transition-colors cursor-pointer"
                    >
                      View File
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Appointments' && (
        <div className="bg-white rounded-[2px] border border-stone-200/80 shadow-2xs p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Consultations & Visits</h3>
              <p className="text-xs text-slate-500">History and upcoming visits with this patient</p>
            </div>
            <button
              onClick={() => setShowAppointmentModal(true)}
              className="px-3 py-1.5 bg-[#13382E] text-white text-xs font-bold rounded-[2px] shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Visit</span>
            </button>
          </div>

          {chronologicalAppointments.length === 0 ? (
            <div className="py-14 text-center space-y-3 bg-[#FAFBFB] rounded-[4px] border border-dashed border-stone-200">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">No Appointments Scheduled Yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Schedule an upcoming consultation or review meeting with {patient.name}.
                </p>
              </div>
              <button
                onClick={() => setShowAppointmentModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#13382E] text-white text-xs font-semibold rounded-[4px] shadow-2xs hover:bg-[#0E2922] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule Visit</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {chronologicalAppointments.map((appt) => (
                <div key={appt.id} className="py-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-[2px] bg-[#EAF6F0] text-[#136C4F] flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{appt.reason || 'Consultation'}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDateFriendly(appt.date)} &nbsp;·&nbsp; {appt.time} &nbsp;·&nbsp; {appt.type}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-[2px] text-xs font-semibold ${
                      appt.status === 'Confirmed'
                        ? 'bg-[#EAF6F0] text-[#136C4F]'
                        : appt.status === 'Completed'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {appt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Medicines' && (
        <div className="space-y-4 font-sans">
          <div className="bg-white rounded-[6px] border border-stone-200/80 shadow-2xs p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Active Prescriptions</h3>
              <p className="text-xs text-slate-500">Current medications and therapeutic plans</p>
            </div>
            <button
              onClick={() => setShowPrescribeModal(true)}
              className="px-3.5 py-2 bg-[#0E382F] hover:bg-[#092720] text-white text-xs font-bold rounded-[6px] shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Medicine</span>
            </button>
          </div>

          {patientPrescriptions.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-3 bg-[#FAFBFB] rounded-[6px] border border-dashed border-stone-200">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <Pill className="w-5 h-5 -rotate-45" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">No Prescriptions Issued Yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Click &ldquo;Add Medicine&rdquo; to prescribe medication regimen for {patient.name}.</p>
              </div>
              <button
                onClick={() => setShowPrescribeModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0E382F] text-white text-xs font-semibold rounded-[4px] shadow-2xs hover:bg-[#092720] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Prescribe Medicine</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {patientPrescriptions.map((rx) => {
                const isActive = rx.status === 'Active';
                const hasDetailedMeds = (rx as any).medicines && (rx as any).medicines.length > 0;

                return (
                  <div key={rx.id} className="py-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-[6px] bg-[#EAF6F0] text-[#136C4F] flex items-center justify-center shrink-0">
                          <Pill className="w-5 h-5 -rotate-45" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 leading-tight">
                            {rx.name} {(rx as any).dosage ? `• ${(rx as any).dosage}` : ''}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {rx.instructions || `${(rx as any).dosage || ''} · ${(rx as any).frequency || ''}`} &nbsp;|&nbsp; Started: {formatDateFriendly(rx.startDate)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-[4px] ${
                            isActive
                              ? 'bg-[#EAF6F0] text-[#136C4F]'
                              : 'bg-stone-100 text-slate-600'
                          }`}
                        >
                          {rx.status || 'Active'}
                        </span>

                        {isActive && (
                          <button
                            onClick={() => handleRevokePrescription(rx.id, rx.name)}
                            className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2.5 py-1 rounded-[4px] border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Revoke Prescription"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>

                    {/* If multiple individual medicines exist in this prescription */}
                    {hasDetailedMeds && (
                      <div className="pl-13 pr-2 pt-1 flex items-center gap-2 flex-wrap">
                        {(rx as any).medicines.map((m: any, mIdx: number) => (
                          <span
                            key={mIdx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-50 border border-stone-200/80 rounded-[4px] text-[11px] text-slate-700 font-medium"
                          >
                            <span className="font-semibold text-slate-900">{m.name}</span>
                            <span className="text-slate-500 font-normal">({m.dose || m.dosage})</span>
                            {m.timing && <span className="text-emerald-700">• {m.timing}</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
          <FoodRulesCard patient={{ id: patient.id, name: patient.name, conditions: (patient as any).conditions }} />
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'Notes' && (
        <div className="bg-white rounded-[2px] border border-stone-200/80 shadow-2xs p-5 md:p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">Clinical & Doctor Notes</h3>
          <p className="text-xs text-slate-500">Private clinical documentation recorded for this patient.</p>
          <div className="p-4 bg-stone-50 rounded-[2px] border border-stone-200/60 text-xs text-slate-700 leading-relaxed">
            {latestReport.doctorNotes || 'No doctor notes documented yet. Notes entered during report evaluations or appointments will appear here.'}
          </div>
        </div>
      )}

      {/* MODAL 1: Schedule Appointment Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-[2px] border border-stone-200 shadow-xl max-w-md w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="text-base font-bold text-slate-900">Schedule Appointment</h3>
              <button
                onClick={() => setShowAppointmentModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {appointmentSuccess ? (
              <div className="p-4 bg-[#EAF6F0] text-[#136C4F] text-xs font-bold rounded-[2px] flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>Appointment scheduled successfully!</span>
              </div>
            ) : (
              <form onSubmit={handleCreateAppointment} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full border border-stone-300 rounded-[2px] p-2 text-slate-800 focus:outline-none focus:border-[#136C4F]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Time</label>
                  <input
                    type="text"
                    required
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    placeholder="11:30 AM"
                    className="w-full border border-stone-300 rounded-[2px] p-2 text-slate-800 focus:outline-none focus:border-[#136C4F]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Consultation Mode</label>
                  <select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value as any)}
                    className="w-full border border-stone-300 rounded-[2px] p-2 text-slate-800 focus:outline-none focus:border-[#136C4F]"
                  >
                    <option value="In-person">In-person Visit</option>
                    <option value="Video call">Video Consultation</option>
                    <option value="Phone call">Phone Consultation</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Clinical Purpose / Reason</label>
                  <input
                    type="text"
                    required
                    value={appointmentReason}
                    onChange={(e) => setAppointmentReason(e.target.value)}
                    className="w-full border border-stone-300 rounded-[2px] p-2 text-slate-800 focus:outline-none focus:border-[#136C4F]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setShowAppointmentModal(false)}
                    className="px-3.5 py-1.5 text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAppointment}
                    className="px-4 py-1.5 bg-[#13382E] text-white font-bold rounded-[2px] hover:bg-[#0E2922] transition-colors cursor-pointer"
                  >
                    {isSubmittingAppointment ? 'Scheduling...' : 'Confirm Visit'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: New Prescription Modal (Matching Exact Reference Layout & Design) */}
      {showPrescribeModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-[6px] border border-stone-200/90 shadow-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header: Title, Patient Subtitle, Close Button */}
            <div className="flex items-start justify-between pb-3.5 border-b border-stone-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-tight">
                  New Prescription
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {patient.name}{patient.rsId ? ` • ${patient.rsId}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPrescribeModal(false);
                  setPrescribeError(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1 -mr-1 -mt-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {prescribeSuccess ? (
              <div className="p-4 bg-[#EAF6F0] text-[#136C4F] text-xs font-bold rounded-[4px] flex items-center gap-2 border border-[#C6EAD8]">
                <Check className="w-4 h-4" />
                <span>Prescription saved successfully! Schedule and daily reminders updated.</span>
              </div>
            ) : (
              <form onSubmit={handlePrescribeSubmit} className="space-y-4 text-xs font-sans">
                {prescribeError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-[4px] text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{prescribeError}</span>
                  </div>
                )}

                {/* Section 1: Add Medicines */}
                <div className="space-y-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">
                      Add Medicines
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enter the medicine, dose, and duration.
                    </p>
                  </div>

                  {/* Medicines Container Table/Card */}
                  <div className="border border-stone-200 rounded-[6px] p-3 sm:p-3.5 bg-white space-y-3">
                    {/* Column Headers */}
                    <div className="grid grid-cols-12 gap-2.5 sm:gap-3 text-xs font-semibold text-slate-700 px-0.5">
                      <div className="col-span-6 sm:col-span-6">Medicine & Strength</div>
                      <div className="col-span-3 sm:col-span-3">Dose</div>
                      <div className="col-span-3 sm:col-span-3">Duration</div>
                    </div>

                    {/* Medicine Rows */}
                    <div className="space-y-2.5">
                      {prescribeMedicines.map((med) => (
                        <div key={med.id} className="grid grid-cols-12 gap-2.5 sm:gap-3 items-center">
                          {/* Medicine & Strength Input with Real Indian Dataset + DrugDB Autocomplete */}
                          <div className="col-span-6 sm:col-span-6">
                            <MedicineAutocomplete
                              value={med.name}
                              onChange={(val) => updateMedicineRow(med.id, 'name', val)}
                              onSelect={(selectedMed) => handleSelectMedicineSuggestion(med.id, selectedMed)}
                              placeholder="e.g. Metformin 500 mg, Dolo, Augmentin"
                            />
                          </div>

                          {/* Dose Select Dropdown */}
                          <div className="col-span-3 sm:col-span-3 relative">
                            <select
                              value={med.dose}
                              onChange={(e) => updateMedicineRow(med.id, 'dose', e.target.value)}
                              className="w-full h-10 px-2.5 border border-stone-200 rounded-[4px] text-xs text-slate-800 focus:outline-none focus:border-[#0E382F] bg-white cursor-pointer appearance-none pr-7"
                            >
                              <option value="1 Tablet">1 Tablet</option>
                              <option value="2 Tablets">2 Tablets</option>
                              <option value="1/2 Tablet">1/2 Tablet</option>
                              <option value="1 Capsule">1 Capsule</option>
                              <option value="2 Capsules">2 Capsules</option>
                              <option value="5 ml">5 ml</option>
                              <option value="10 ml">10 ml</option>
                              <option value="15 ml">15 ml</option>
                              <option value="1 Sachet">1 Sachet</option>
                              <option value="1 Drop">1 Drop</option>
                              <option value="1 Puff">1 Puff</option>
                              <option value="1 Injection">1 Injection</option>
                              <option value="As directed">As directed</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          {/* Duration Group + Optional Remove Action */}
                          <div className="col-span-3 sm:col-span-3 flex items-center gap-1.5">
                            <div className="flex-1 flex h-10 border border-stone-200 rounded-[4px] bg-white overflow-hidden focus-within:border-[#0E382F] focus-within:ring-1 focus-within:ring-[#0E382F]">
                              <input
                                type="number"
                                min="1"
                                max="365"
                                required
                                value={med.duration}
                                onChange={(e) =>
                                  updateMedicineRow(
                                    med.id,
                                    'duration',
                                    parseInt(e.target.value) || 1
                                  )
                                }
                                className="w-full h-full px-2.5 text-xs text-slate-800 focus:outline-none"
                              />
                              <span className="px-2.5 sm:px-3 text-xs text-slate-500 bg-stone-50 border-l border-stone-200 h-full flex items-center font-medium select-none">
                                Days
                              </span>
                            </div>

                            {prescribeMedicines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeMedicineRow(med.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                                title="Remove medicine"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add another medicine button */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={addMedicineRow}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16A36A] hover:text-[#0E382F] transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Add another medicine</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section 2: When to Take */}
                <div className="space-y-2 pt-1">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">
                      When to Take
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select the times for this medicine.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-0.5">
                    {timingOptions.map((t) => {
                      const isChecked = selectedTimings.includes(t.id);
                      return (
                        <div
                          key={t.id}
                          onClick={() => toggleTiming(t.id)}
                          className="flex items-center gap-2.5 cursor-pointer select-none py-1 group"
                        >
                          <div
                            className={`w-4 h-4 rounded-[3px] flex items-center justify-center transition-all ${
                              isChecked
                                ? 'bg-[#0E382F] text-white'
                                : 'border border-stone-300 bg-white group-hover:border-stone-400'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-xs font-semibold text-slate-800">
                            {t.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section 3: Food Instruction */}
                <div className="space-y-1.5 pt-1">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Food Instruction
                  </h3>
                  <div className="relative">
                    <select
                      value={foodInstruction}
                      onChange={(e) => setFoodInstruction(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-stone-200 rounded-[4px] text-xs text-slate-800 focus:outline-none focus:border-[#0E382F] cursor-pointer appearance-none pr-8"
                    >
                      <option value="After food">After food</option>
                      <option value="Before food">Before food</option>
                      <option value="With food / meals">With food / meals</option>
                      <option value="Empty stomach">Empty stomach</option>
                      <option value="Before bedtime">Before bedtime</option>
                      <option value="As directed">As directed</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-4 mt-6 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrescribeModal(false);
                      setPrescribeError(null);
                    }}
                    className="px-4 py-2 border border-stone-200 rounded-[6px] text-xs font-semibold text-slate-700 hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPrescribing}
                    className="px-5 py-2 bg-[#0E382F] hover:bg-[#092720] text-white text-xs font-bold rounded-[6px] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isPrescribing ? 'Prescribing...' : 'Prescribe'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
