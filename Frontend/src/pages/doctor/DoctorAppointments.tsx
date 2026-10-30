import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import {
  Calendar,
  Calendar as CalendarIcon,
  Clock,
  Video,
  Phone,
  User,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Bell,
  CheckCircle2,
  AlertCircle,
  MapPin,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Radio,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { Appointment } from '../../types';

export const DoctorAppointments: React.FC = () => {
  const {
    appointments,
    updateAppointmentStatus,
    requestAppointment,
    patients,
    currentUser,
    fetchAppointments,
    fetchDoctorPatients,
  } = useStore();

  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [reason, setReason] = useState('Routine checkup & Lab report evaluation');
  const [dateInput, setDateInput] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [timeInput, setTimeInput] = useState('10:30 AM');
  const [visitType, setVisitType] = useState<'In-person' | 'Video call' | 'Phone call'>('In-person');
  const [notesInput, setNotesInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter and Search States
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [confirmModalApt, setConfirmModalApt] = useState<Appointment | null>(null);
  const [confirmNotes, setConfirmNotes] = useState('');

  const [rescheduleModalApt, setRescheduleModalApt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('11:00 AM');
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  const [cancelModalApt, setCancelModalApt] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchAppointments();
    fetchDoctorPatients();
  }, []);

  // Set default selected patient once patients load
  useEffect(() => {
    if (patients && patients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchAppointments(), fetchDoctorPatients()]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const pendingRequests = appointments.filter((a) => a.status === 'Pending');
  const confirmedAppointments = appointments.filter((a) => a.status === 'Confirmed');
  const completedAppointments = appointments.filter((a) => a.status === 'Completed');
  const cancelledAppointments = appointments.filter((a) => a.status === 'Cancelled');

  const todayStr = new Date().toISOString().split('T')[0];
  const todayVisits = appointments.filter((a) => {
    if (a.status === 'Cancelled') return false;
    // Check if slot matches today
    return a.date.includes(todayStr) || a.date.toLowerCase().includes('today');
  });

  // Time slot chips for easy selection
  const commonTimeSlots = [
    '09:00 AM',
    '09:30 AM',
    '10:00 AM',
    '10:30 AM',
    '11:00 AM',
    '11:30 AM',
    '02:00 PM',
    '02:30 PM',
    '03:00 PM',
    '03:30 PM',
    '04:00 PM',
    '04:30 PM',
    '05:00 PM',
  ];

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const patient = patients.find((p) => p.id === selectedPatientId) || patients[0];
    if (!patient) {
      setActionError('Please connect with a patient before scheduling an appointment.');
      return;
    }
    if (!reason.trim()) {
      setActionError('Please enter a clinical reason for the appointment.');
      return;
    }
    if (!timeInput.trim()) {
      setActionError('Please specify a time slot.');
      return;
    }

    try {
      setIsSubmitting(true);
      await requestAppointment({
        patientId: patient.id,
        patientName: patient.name,
        patientRsId: patient.rsId,
        doctorName: currentUser?.name || 'Dr. Doctor',
        reason: reason.trim(),
        date: dateInput,
        time: timeInput.trim(),
        type: visitType,
        status: 'Confirmed',
        notes: notesInput.trim() || undefined,
      });

      setBookingSuccess(true);
      setNotesInput('');
      setTimeout(() => setBookingSuccess(false), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to schedule appointment. Concurrency or slot conflict.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1-Click Quick Accept
  const handleQuickAccept = async (req: Appointment) => {
    try {
      await updateAppointmentStatus(req.id, 'Confirmed');
    } catch (err: any) {
      setActionError(err.message || 'Failed to accept appointment');
    }
  };

  // Accept with Clinical Notes
  const handleConfirmWithNotes = async () => {
    if (!confirmModalApt) return;
    try {
      setIsSubmitting(true);
      await updateAppointmentStatus(confirmModalApt.id, 'Confirmed', {
        notes: confirmNotes.trim() || undefined,
      });
      setConfirmModalApt(null);
      setConfirmNotes('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to confirm appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Reschedule
  const handleRescheduleSubmit = async () => {
    if (!rescheduleModalApt) return;
    if (!rescheduleDate.trim() || !rescheduleTime.trim()) {
      setActionError('Please select both date and time for rescheduling');
      return;
    }
    try {
      setIsSubmitting(true);
      await updateAppointmentStatus(rescheduleModalApt.id, 'Confirmed', {
        date: rescheduleDate,
        time: rescheduleTime,
        notes: rescheduleNotes.trim()
          ? `Rescheduled by clinician: ${rescheduleNotes.trim()}`
          : 'Rescheduled by clinician',
      });
      setRescheduleModalApt(null);
      setRescheduleNotes('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to reschedule appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Cancel / Decline
  const handleCancelSubmit = async () => {
    if (!cancelModalApt) return;
    try {
      setIsSubmitting(true);
      await updateAppointmentStatus(cancelModalApt.id, 'Cancelled', {
        notes: cancelReason.trim() ? `Declined/Cancelled: ${cancelReason.trim()}` : 'Declined by doctor',
      });
      setCancelModalApt(null);
      setCancelReason('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Appointments
  const filteredAppointments = appointments.filter((apt) => {
    // Tab filter
    if (activeTab === 'pending' && apt.status !== 'Pending') return false;
    if (activeTab === 'confirmed' && apt.status !== 'Confirmed') return false;
    if (activeTab === 'completed' && apt.status !== 'Completed') return false;
    if (activeTab === 'cancelled' && apt.status !== 'Cancelled') return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = apt.patientName?.toLowerCase().includes(q);
      const matchRsId = apt.patientRsId?.toLowerCase().includes(q);
      const matchReason = apt.reason?.toLowerCase().includes(q);
      const matchDate = apt.date?.toLowerCase().includes(q);
      if (!matchName && !matchRsId && !matchReason && !matchDate) return false;
    }

    // Calendar date filter
    if (selectedCalendarDate) {
      if (!apt.date.includes(selectedCalendarDate)) return false;
    }

    return true;
  });

  const getTypeBadge = (type: Appointment['type']) => {
    switch (type) {
      case 'Video call':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
            <Video className="w-3.5 h-3.5 text-indigo-600" />
            Video Consultation
          </span>
        );
      case 'Phone call':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/60">
            <Phone className="w-3.5 h-3.5 text-sky-600" />
            Phone Consultation
          </span>
        );
      case 'In-person':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            In-Clinic Visit
          </span>
        );
    }
  };

  const getStatusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'Confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#E8F5F1] text-[#1E3F35] border border-[#2E9E6B]/30">
            <span className="w-2 h-2 rounded-full bg-[#2E9E6B]" />
            Confirmed
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#FEF3D6] text-[#8C6200] border border-[#8C6200]/20 animate-pulse">
            <Clock className="w-3 h-3 text-[#8C6200]" />
            Pending Review
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-600 border border-stone-200">
            <CheckCircle2 className="w-3 h-3 text-stone-500" />
            Completed
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <X className="w-3 h-3 text-rose-600" />
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200/70 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172B25] tracking-tight">
              Clinical Appointments
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/70 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live Realtime Sync</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Manage your schedule, incoming patient requests, and consultations in real-time
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-60"
            title="Refresh appointments"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#1E3F35]' : 'text-stone-500'}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Now'}</span>
          </button>

          {pendingRequests.length > 0 && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <Bell className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
              <span>{pendingRequests.length} Needs Review</span>
            </div>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {actionError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs font-medium text-rose-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-500 hover:text-rose-800 text-xs font-bold px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Key Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Visits */}
        <div className="bg-white rounded-3xl p-5 shadow-card border border-stone-200/70 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Today's Schedule
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#2E9E6B] flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <h2 className="text-3xl font-black text-[#172B25]">{todayVisits.length}</h2>
            <span className="text-xs font-semibold text-[#2E9E6B] bg-[#E4EDE8] px-2.5 py-0.5 rounded-full">
              Visits
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-2 truncate">
            {todayVisits[0] ? `Next: ${todayVisits[0].patientName} at ${todayVisits[0].time}` : 'No remaining visits today'}
          </p>
        </div>

        {/* Pending Requests */}
        <div
          className={`rounded-3xl p-5 shadow-card border transition-all ${
            pendingRequests.length > 0
              ? 'bg-amber-50/60 border-amber-200/90 hover:shadow-md ring-2 ring-amber-400/20'
              : 'bg-white border-stone-200/70'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8C6200] uppercase tracking-wider">
              Pending Requests
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-[#8C6200] flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <h2 className="text-3xl font-black text-[#8C6200]">{pendingRequests.length}</h2>
            {pendingRequests.length > 0 && (
              <span className="text-xs font-bold text-[#8C6200] bg-[#FEF3D6] px-2.5 py-0.5 rounded-full">
                Needs Action
              </span>
            )}
          </div>
          <p className="text-xs text-stone-600 mt-2">
            {pendingRequests.length > 0 ? 'Patients waiting for slot approval' : 'All requests responded to'}
          </p>
        </div>

        {/* Confirmed Visits */}
        <div className="bg-white rounded-3xl p-5 shadow-card border border-stone-200/70 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Confirmed Visits
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#32A299] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <h2 className="text-3xl font-black text-[#172B25]">{confirmedAppointments.length}</h2>
            <span className="text-xs font-medium text-stone-500">Upcoming</span>
          </div>
          <p className="text-xs text-stone-500 mt-2">Prepared for consultation</p>
        </div>

        {/* Completed Consultations */}
        <div className="bg-white rounded-3xl p-5 shadow-card border border-stone-200/70 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <h2 className="text-3xl font-black text-stone-700">{completedAppointments.length}</h2>
            <span className="text-xs font-medium text-stone-500">Total Visits</span>
          </div>
          <p className="text-xs text-stone-500 mt-2">Archived consultation records</p>
        </div>
      </div>

      {/* Prominent Pending Requests Review Queue */}
      {pendingRequests.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/70 to-white rounded-3xl p-6 sm:p-7 border border-amber-300 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                <h3 className="text-lg font-black text-amber-950">
                  Incoming Patient Appointment Requests
                </h3>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Review and accept requested consultation slots or propose a reschedule
              </p>
            </div>
            <span className="text-xs font-extrabold bg-amber-200/80 text-amber-900 px-3 py-1 rounded-full w-fit">
              {pendingRequests.length} Awaiting Response
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-sm hover:shadow transition-all space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#1E3F35] to-[#2B5246] text-white font-black text-sm flex items-center justify-center shadow-sm">
                      {req.patientName?.slice(0, 2).toUpperCase() || 'PT'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-[#172B25]">{req.patientName}</h4>
                        <span className="text-[11px] font-mono font-semibold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md">
                          {req.patientRsId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {getTypeBadge(req.type)}
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] text-stone-400 font-medium">
                    {req.requestedAt || 'Just now'}
                  </span>
                </div>

                <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/60 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-stone-800 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-[#1E3F35]" />
                    <span>{req.date} at {req.time}</span>
                  </div>
                  <div className="text-stone-600">
                    <span className="font-medium text-stone-700">Reason: </span>
                    {req.reason}
                  </div>
                  {req.notes && (
                    <div className="text-stone-500 text-[11px] italic">
                      Note: "{req.notes}"
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleQuickAccept(req)}
                    className="flex-1 bg-[#1E3F35] hover:bg-[#16322A] text-white py-2 px-3 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>

                  <button
                    onClick={() => {
                      setConfirmModalApt(req);
                      setConfirmNotes('');
                    }}
                    className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold transition-all"
                    title="Accept with instructions for patient"
                  >
                    + Instructions
                  </button>

                  <button
                    onClick={() => {
                      setRescheduleModalApt(req);
                      setRescheduleDate(req.date);
                      setRescheduleTime(req.time);
                    }}
                    className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-all"
                  >
                    Reschedule
                  </button>

                  <button
                    onClick={() => {
                      setCancelModalApt(req);
                      setCancelReason('');
                    }}
                    className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    title="Decline request"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Left Schedule & Management vs Right Calendar & Create Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Appointments Schedule List (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Controls Bar: Tabs & Search */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-card border border-stone-200/70 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Tab Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { id: 'all', label: 'All Visits', count: appointments.length },
                  { id: 'pending', label: 'Pending', count: pendingRequests.length },
                  { id: 'confirmed', label: 'Confirmed', count: confirmedAppointments.length },
                  { id: 'completed', label: 'Completed', count: completedAppointments.length },
                  { id: 'cancelled', label: 'Cancelled', count: cancelledAppointments.length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      activeTab === tab.id
                        ? 'bg-[#1E3F35] text-white shadow-sm'
                        : 'bg-stone-100/70 text-stone-600 hover:bg-stone-200/60'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                        activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Date Filter Indicator if set */}
              {selectedCalendarDate && (
                <div className="flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                  <span>Filtered: {selectedCalendarDate}</span>
                  <button
                    onClick={() => setSelectedCalendarDate(null)}
                    className="hover:text-teal-950 font-bold"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search appointments by patient name, RS ID, reason, or date..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Appointments List */}
          <div className="space-y-3">
            {filteredAppointments.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-stone-200/70 shadow-card space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
                  <CalendarDays className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-base text-[#172B25]">No appointments found</h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  {searchQuery || selectedCalendarDate
                    ? 'No appointments matched your search or date filter. Try clearing filters.'
                    : 'There are no appointments in this status category.'}
                </p>
                {(searchQuery || selectedCalendarDate) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCalendarDate(null);
                    }}
                    className="text-xs font-bold text-[#1E3F35] hover:underline"
                  >
                    Reset all filters
                  </button>
                )}
              </div>
            ) : (
              filteredAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className={`bg-white rounded-3xl p-5 sm:p-6 shadow-card border transition-all hover:shadow-md ${
                    apt.status === 'Confirmed'
                      ? 'border-[#2E9E6B]/30 hover:border-[#2E9E6B]'
                      : apt.status === 'Pending'
                      ? 'border-amber-300 bg-amber-50/20'
                      : 'border-stone-200/70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Patient & Consultation Details */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#E4EDE8] text-[#1E3F35] font-black text-sm flex items-center justify-center flex-shrink-0 shadow-sm">
                        {apt.patientName?.slice(0, 2).toUpperCase() || 'PT'}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="font-extrabold text-sm sm:text-base text-[#172B25]">
                            {apt.patientName}
                          </h4>
                          <span className="text-xs font-mono font-semibold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md">
                            {apt.patientRsId}
                          </span>
                          {getStatusBadge(apt.status)}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-stone-600 flex-wrap">
                          <span className="flex items-center gap-1.5 font-bold text-stone-900 bg-stone-100 px-2.5 py-1 rounded-xl">
                            <Clock className="w-3.5 h-3.5 text-[#1E3F35]" />
                            {apt.date} · {apt.time}
                          </span>
                          {getTypeBadge(apt.type)}
                        </div>

                        <div className="text-xs text-stone-700 font-medium pt-1">
                          <span className="text-stone-400">Reason: </span>
                          {apt.reason}
                        </div>

                        {apt.notes && (
                          <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl p-2.5 text-xs text-emerald-950 flex items-start gap-2 mt-2">
                            <FileText className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="font-bold">Clinician Preparation Notes: </span>
                              <span>{apt.notes}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons based on status */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                      {apt.status === 'Confirmed' && (
                        <>
                          <button
                            onClick={() => updateAppointmentStatus(apt.id, 'Completed')}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Mark Completed</span>
                          </button>

                          <button
                            onClick={() => {
                              setRescheduleModalApt(apt);
                              setRescheduleDate(apt.date);
                              setRescheduleTime(apt.time);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold transition-all"
                          >
                            Reschedule
                          </button>

                          <button
                            onClick={() => {
                              setCancelModalApt(apt);
                              setCancelReason('');
                            }}
                            className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-medium transition-all"
                          >
                            Cancel Visit
                          </button>
                        </>
                      )}

                      {apt.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleQuickAccept(apt)}
                            className="px-4 py-2 rounded-xl bg-[#1E3F35] hover:bg-[#16322A] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>

                          <button
                            onClick={() => {
                              setRescheduleModalApt(apt);
                              setRescheduleDate(apt.date);
                              setRescheduleTime(apt.time);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold transition-all"
                          >
                            Reschedule
                          </button>

                          <button
                            onClick={() => {
                              setCancelModalApt(apt);
                              setCancelReason('');
                            }}
                            className="px-3 py-1.5 rounded-xl text-stone-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-medium transition-all"
                          >
                            Decline
                          </button>
                        </>
                      )}

                      {apt.status === 'Completed' && (
                        <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Consultation Done</span>
                        </div>
                      )}

                      {apt.status === 'Cancelled' && (
                        <div className="text-xs font-medium text-stone-400 bg-stone-100 px-3 py-1.5 rounded-xl">
                          Visit Cancelled
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Calendar Picker & Direct Booking Form (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Mini Calendar Picker Card */}
          <div className="bg-white rounded-3xl p-6 shadow-card border border-stone-200/70 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-[#172B25]">Calendar Overview</h3>
                <p className="text-[11px] text-stone-400">October 2026</p>
              </div>
              {selectedCalendarDate && (
                <button
                  onClick={() => setSelectedCalendarDate(null)}
                  className="text-xs font-bold text-[#1E3F35] hover:underline"
                >
                  Show All
                </button>
              )}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => (
                <span key={idx} className="font-bold text-stone-400 py-1 text-[11px]">
                  {day}
                </span>
              ))}

              {[
                { day: '28', prev: true },
                { day: '29', prev: true },
                { day: '30', prev: true },
                { day: '1' },
                { day: '2' },
                { day: '3' },
                { day: '4' },
                { day: '5' },
                { day: '6' },
                { day: '7' },
                { day: '8' },
                { day: '9' },
                { day: '10' },
                { day: '11' },
                { day: '12', hasDot: true },
                { day: '13' },
                { day: '14' },
                { day: '15' },
                { day: '16' },
                { day: '17' },
                { day: '18' },
                { day: '19' },
                { day: '20' },
                { day: '21' },
                { day: '22' },
                { day: '23', today: true },
                { day: '24' },
                { day: '25' },
                { day: '26', hasDot: true },
                { day: '27', hasDot: true },
                { day: '28' },
                { day: '29' },
                { day: '30' },
                { day: '31', hasDot: true },
                { day: '1', next: true },
              ].map((item, idx) => {
                const dateKey = `2026-10-${item.day.padStart(2, '0')}`;
                const isSelected = selectedCalendarDate === dateKey;
                const hasAppointments = appointments.some(
                  (a) => a.date.includes(item.day) || a.date.includes(dateKey)
                );

                return (
                  <button
                    key={idx}
                    disabled={item.prev || item.next}
                    onClick={() => {
                      if (!item.prev && !item.next) {
                        setSelectedCalendarDate(isSelected ? null : dateKey);
                      }
                    }}
                    className={`w-8 h-8 mx-auto rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all relative ${
                      item.today
                        ? 'bg-[#1E3F35] text-white shadow-sm ring-2 ring-[#1E3F35]/30'
                        : isSelected
                        ? 'bg-teal-600 text-white shadow-sm'
                        : item.prev || item.next
                        ? 'text-stone-300 cursor-not-allowed'
                        : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span>{item.day}</span>
                    {hasAppointments && !item.today && !isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2E9E6B] absolute bottom-1" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-500 pt-3 border-t border-stone-100">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2E9E6B]" />
                <span>Has Consultations</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#1E3F35]" />
                <span>Today</span>
              </span>
            </div>
          </div>

          {/* Clinician Quick Book Appointment Card */}
          <div className="bg-white rounded-3xl p-6 shadow-card border border-stone-200/70 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#1E3F35]/10 text-[#1E3F35] flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#172B25]">Direct Appointment Booking</h3>
                <p className="text-[11px] text-stone-400">Schedule directly for connected patient</p>
              </div>
            </div>

            {bookingSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Appointment scheduled & notified to patient in real-time!</span>
              </div>
            )}

            <form onSubmit={handleBook} className="space-y-3.5 text-xs">
              {/* Select Patient */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Select Patient</label>
                {patients && patients.length > 0 ? (
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35]"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.rsId})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-500 text-xs">
                    No connected patients yet. Connect with patients via RS ID to schedule appointments.
                  </div>
                )}
              </div>

              {/* Consultation Type */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Consultation Mode</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'In-person', label: 'In-Clinic', icon: MapPin },
                    { id: 'Video call', label: 'Video', icon: Video },
                    { id: 'Phone call', label: 'Phone', icon: Phone },
                  ].map((mode) => {
                    const Icon = mode.icon;
                    const isSelected = visitType === mode.id;
                    return (
                      <button
                        type="button"
                        key={mode.id}
                        onClick={() => setVisitType(mode.id as any)}
                        className={`p-2 rounded-xl text-center flex flex-col items-center gap-1 font-semibold transition-all border ${
                          isSelected
                            ? 'bg-[#1E3F35] text-white border-[#1E3F35] shadow-sm'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-[11px]">{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Input */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Date</label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 font-medium"
                />
              </div>

              {/* Time Slots */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Time Slot</label>
                <input
                  type="text"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  placeholder="e.g. 10:30 AM"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 font-medium mb-1.5"
                />
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-stone-50 rounded-xl border border-stone-100">
                  {commonTimeSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setTimeInput(slot)}
                      className={`text-[10px] px-2 py-1 rounded-lg font-semibold transition-all ${
                        timeInput === slot
                          ? 'bg-[#1E3F35] text-white'
                          : 'bg-white text-stone-600 hover:bg-stone-200 border border-stone-200'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">Clinical Purpose / Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. CBC report review & medication adjustments"
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 font-medium"
                />
              </div>

              {/* Instructions / Notes */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Preparation Instructions for Patient <span className="font-normal text-stone-400">(optional)</span>
                </label>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  rows={2}
                  placeholder="e.g. Fasting 10-12 hrs required, bring physical reports..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 text-xs font-normal resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !patients.length}
                className="w-full bg-[#1E3F35] hover:bg-[#16322A] text-white py-3 rounded-2xl font-bold shadow-md transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Scheduling Visit...</span>
                  </>
                ) : (
                  <>
                    <CalendarIcon className="w-4 h-4" />
                    <span>Confirm & Schedule</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* MODAL 1: Confirm with Clinician Notes */}
      {confirmModalApt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-[#172B25]">Confirm Appointment</h3>
              </div>
              <button
                onClick={() => setConfirmModalApt(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-stone-900">{confirmModalApt.patientName} ({confirmModalApt.patientRsId})</div>
              <div className="text-stone-600">{confirmModalApt.date} at {confirmModalApt.time} · {confirmModalApt.type}</div>
              <div className="text-stone-500 italic">"{confirmModalApt.reason}"</div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Preparation Instructions / Clinician Notes for Patient
              </label>
              <textarea
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Please bring recent CBC & fasting blood glucose lab reports. If video call, link will be active 5 min prior."
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModalApt(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWithNotes}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#1E3F35] hover:bg-[#16322A] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm & Send to Patient</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reschedule Appointment */}
      {rescheduleModalApt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-[#172B25]">Reschedule Appointment</h3>
              </div>
              <button
                onClick={() => setRescheduleModalApt(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-stone-900">{rescheduleModalApt.patientName} ({rescheduleModalApt.patientRsId})</div>
              <div className="text-stone-500">Currently: {rescheduleModalApt.date} at {rescheduleModalApt.time}</div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">New Time Slot</label>
                <input
                  type="text"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  placeholder="e.g. 11:30 AM"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 font-medium mb-1.5"
                />
                <div className="flex flex-wrap gap-1">
                  {commonTimeSlots.slice(0, 8).map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setRescheduleTime(slot)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold ${
                        rescheduleTime === slot
                          ? 'bg-[#1E3F35] text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Reason for Rescheduling <span className="font-normal text-stone-400">(optional)</span>
                </label>
                <textarea
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Moved slot due to clinic operating room schedule."
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRescheduleModalApt(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#1E3F35] hover:bg-[#16322A] text-white text-xs font-bold shadow-sm transition-all"
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Decline / Cancel Appointment */}
      {cancelModalApt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center">
                  <X className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-rose-950">Decline / Cancel Appointment</h3>
              </div>
              <button
                onClick={() => setCancelModalApt(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Are you sure you want to decline or cancel this visit with{' '}
              <span className="font-bold text-stone-900">{cancelModalApt.patientName}</span>? The patient will be notified in real-time.
            </p>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Reason / Note for Patient <span className="font-normal text-stone-400">(optional)</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                placeholder="e.g. Doctor unavailable on this day. Please pick a slot next Tuesday."
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelModalApt(null)}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold"
              >
                Keep Appointment
              </button>
              <button
                onClick={handleCancelSubmit}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all"
              >
                Decline & Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
