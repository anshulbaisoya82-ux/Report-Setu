import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  Calendar,
  Calendar as CalendarIcon,
  Clock,
  Video,
  Phone,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Bell,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Search,
  ArrowUpDown,
  MoreVertical,
  ChevronDown,
} from 'lucide-react';
import { Appointment } from '../../types';

export const DoctorAppointments: React.FC = () => {
  const navigate = useNavigate();
  const {
    appointments,
    updateAppointmentStatus,
    requestAppointment,
    patients,
    doctorInfo,
    fetchAppointments,
    fetchDoctorPatients,
  } = useStore();

  // Active filter tab
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'Date (Latest)' | 'Patient Name' | 'Status'>('Date (Latest)');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Notifications popup
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [hasUnreadAlerts, setHasUnreadAlerts] = useState(true);

  // Booking Form State
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [visitType, setVisitType] = useState<'In-person' | 'Video call' | 'Phone call'>('In-person');
  const [dateInput, setDateInput] = useState('01-11-2026');
  const [timeInput, setTimeInput] = useState('10:30 AM');
  const [reason, setReason] = useState('Routine checkup & Lab report evaluation');
  const [notesInput, setNotesInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Active Calendar Month Navigation State
  const [currentMonthName, setCurrentMonthName] = useState('October 2026');

  // Modals for actions
  const [confirmModalApt, setConfirmModalApt] = useState<Appointment | null>(null);
  const [rescheduleModalApt, setRescheduleModalApt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('11:00 AM');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [cancelModalApt, setCancelModalApt] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchAppointments();
    fetchDoctorPatients();
  }, [fetchAppointments, fetchDoctorPatients]);

  // Doctor display info
  const doctorDisplayName = doctorInfo.name || 'Dr. Rishabh';
  const doctorSpecialty = doctorInfo.specialty || 'General Physician';
  const doctorInitials = 'DR';

  // Available patients
  const availablePatients = patients || [];

  // Set default selected patient once available
  useEffect(() => {
    if (availablePatients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(availablePatients[0].id);
    }
  }, [availablePatients, selectedPatientId]);

  // Common time slots
  const commonTimeSlots = [
    '09:00 AM',
    '09:30 AM',
    '10:00 AM',
    '10:30 AM',
    '11:00 AM',
    '11:30 AM',
    '12:00 PM',
    '02:00 PM',
    '02:30 PM',
    '03:00 PM',
    '03:30 PM',
    '04:00 PM',
    '04:30 PM',
    '05:00 PM',
    '05:30 PM',
  ];

  const displayedAppointments: Appointment[] = appointments || [];

  // Calculated Stats
  const pendingRequests = displayedAppointments.filter((a) => a.status === 'Pending');
  const confirmedAppointments = displayedAppointments.filter((a) => a.status === 'Confirmed');
  const completedAppointments = displayedAppointments.filter((a) => a.status === 'Completed');
  const cancelledAppointments = displayedAppointments.filter((a) => a.status === 'Cancelled');

  const todayStr = '2026-10-31';
  const todayVisits = displayedAppointments.filter((a) => {
    if (a.status === 'Cancelled') return false;
    return a.date?.includes(todayStr) || a.date?.includes('2026-10-31') || a.date?.toLowerCase().includes('today');
  });

  const nextAppointment = todayVisits[0] || displayedAppointments[0];

  // Filtered and Sorted Appointments
  const filteredAppointments = displayedAppointments
    .filter((apt) => {
      if (activeTab === 'pending' && apt.status !== 'Pending') return false;
      if (activeTab === 'confirmed' && apt.status !== 'Confirmed') return false;
      if (activeTab === 'completed' && apt.status !== 'Completed') return false;
      if (activeTab === 'cancelled' && apt.status !== 'Cancelled') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = apt.patientName?.toLowerCase().includes(q);
        const matchRsId = apt.patientRsId?.toLowerCase().includes(q);
        const matchReason = apt.reason?.toLowerCase().includes(q);
        const matchDate = apt.date?.toLowerCase().includes(q);
        if (!matchName && !matchRsId && !matchReason && !matchDate) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'Patient Name') {
        return (a.patientName || '').localeCompare(b.patientName || '');
      }
      if (sortBy === 'Status') {
        return (a.status || '').localeCompare(b.status || '');
      }
      return 0; // Default: Date (Latest)
    });

  // Handle Direct Booking
  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    const patient = availablePatients.find((p) => p.id === selectedPatientId) || availablePatients[0];
    if (!patient) {
      setActionError('Please select a patient before scheduling.');
      return;
    }
    if (!reason.trim()) {
      setActionError('Please enter a clinical purpose / reason.');
      return;
    }

    try {
      setIsSubmitting(true);
      await requestAppointment({
        patientId: patient.id,
        patientName: patient.name,
        patientRsId: patient.rsId,
        doctorName: doctorDisplayName,
        reason: reason.trim(),
        date: dateInput,
        time: timeInput.trim(),
        type: visitType,
        status: 'Confirmed',
        notes: notesInput.trim() || undefined,
      });

      setBookingSuccess(true);
      setNotesInput('');
      setTimeout(() => setBookingSuccess(false), 3500);
    } catch (err: any) {
      setActionError(err.message || 'Failed to schedule appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Reschedule
  const handleRescheduleSubmit = async () => {
    if (!rescheduleModalApt) return;
    try {
      setIsSubmitting(true);
      await updateAppointmentStatus(rescheduleModalApt.id, 'Confirmed', {
        date: rescheduleDate,
        time: rescheduleTime,
        notes: rescheduleNotes.trim() || 'Rescheduled by clinician',
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
        notes: cancelReason.trim() || 'Cancelled by clinician',
      });
      setCancelModalApt(null);
      setCancelReason('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col text-stone-800">
      {/* Top Header - Full Width Edge-to-Edge Toolbar */}
      <header className="w-full h-[62px] bg-white border-b border-stone-200/90 px-6 flex items-center justify-between gap-4 box-border shrink-0 sticky top-0 z-30">
        {/* LEFT: Page Title */}
        <h1 className="text-xl font-bold text-stone-900 tracking-tight">Clinical Appointments</h1>

        {/* RIGHT: Grouped Action Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Notification Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotificationPopup(!showNotificationPopup);
                setHasUnreadAlerts(false);
              }}
              aria-label="Notifications"
              className="w-[36px] h-[36px] rounded-full bg-stone-50 hover:bg-stone-100 border border-stone-200/80 flex items-center justify-center text-stone-600 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {hasUnreadAlerts && (
                <span className="w-2 h-2 rounded-full bg-[#E5484D] absolute top-2 right-2 ring-2 ring-white" />
              )}
            </button>

            {showNotificationPopup && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-[6px] shadow-lg border border-stone-200 p-4 z-50 text-xs">
                <p className="font-semibold text-stone-800 mb-2">Notifications</p>
                <div className="p-2.5 bg-stone-50 rounded-[4px] text-stone-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>All appointment notifications up to date</span>
                </div>
              </div>
            )}
          </div>

          {/* Add Patient Primary Button */}
          <button
            onClick={() => navigate('/doctor/add-patient')}
            className="h-[36px] px-3.5 bg-[#184E3F] hover:bg-[#133F33] text-white rounded-[8px] text-[13px] font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer box-border"
          >
            <Plus className="w-4 h-4" />
            <span>Add patient</span>
          </button>

          {/* Doctor Profile Chip */}
          <button
            onClick={() => navigate('/doctor/profile')}
            className="h-[36px] flex items-center gap-2 pl-1 pr-1.5 rounded-[8px] hover:bg-stone-50 transition-colors cursor-pointer select-none"
          >
            <div className="w-8 h-8 rounded-full bg-[#122B22] text-white flex items-center justify-center font-bold text-xs shrink-0">
              {doctorInitials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[13px] font-bold text-stone-900 leading-tight">{doctorDisplayName}</p>
              <p className="text-[10px] text-stone-400 leading-tight mt-0.5">{doctorSpecialty}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="px-6 py-5 space-y-5 bg-[#F4F6F5] flex-1">
        {/* Global Error Banner */}
        {actionError && (
          <div className="bg-rose-50 border border-rose-200 rounded-[6px] p-3 text-xs font-medium text-rose-800 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-500 hover:text-rose-800 font-semibold text-xs px-2 py-0.5"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Booking Success Banner */}
        {bookingSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-[6px] p-3 text-xs font-medium text-emerald-800 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Appointment successfully booked and added to schedule!</span>
            </div>
            <button
              onClick={() => setBookingSuccess(false)}
              className="text-emerald-700 hover:text-emerald-900 font-semibold text-xs px-2 py-0.5"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today's Schedule */}
          <div className="bg-white rounded-[8px] p-4 border border-stone-200/80 shadow-2xs flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-[8px] bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-slate-500">Today's Schedule</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-bold text-slate-800">{todayVisits.length > 0 ? todayVisits.length : 1}</span>
                <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  Visits
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 truncate">
                {nextAppointment ? `Next: ${nextAppointment.patientName} at ${nextAppointment.time}` : 'No upcoming visits today'}
              </p>
            </div>
          </div>

          {/* Card 2: Pending Requests */}
          <div className="bg-white rounded-[8px] p-4 border border-stone-200/80 shadow-2xs flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-[8px] bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-slate-500">Pending Requests</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-bold text-slate-800">{pendingRequests.length}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {pendingRequests.length > 0 ? `${pendingRequests.length} requests awaiting approval` : 'All requests responded to'}
              </p>
            </div>
          </div>

          {/* Card 3: Confirmed Visits */}
          <div className="bg-white rounded-[8px] p-4 border border-stone-200/80 shadow-2xs flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-[8px] bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shrink-0">
              <div className="flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-slate-500">Confirmed Visits</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-bold text-slate-800">{confirmedAppointments.length}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Upcoming consultations</p>
            </div>
          </div>

          {/* Card 4: Completed */}
          <div className="bg-white rounded-[8px] p-4 border border-stone-200/80 shadow-2xs flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-[8px] bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-slate-500">Completed</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl font-bold text-slate-800">{completedAppointments.length > 0 ? completedAppointments.length : 1}</span>
                <span className="text-[11px] text-slate-400 font-normal">Total visits</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Archived consultation records</p>
            </div>
          </div>
        </div>

        {/* Main Two-Column Layout */}
        <div className="flex flex-col lg:flex-row gap-5 items-stretch">
          {/* LEFT COLUMN: Appointments List inside large white card */}
          <div className="flex-1 min-w-0 bg-white rounded-[8px] p-5 sm:p-6 border border-stone-200/80 shadow-2xs flex flex-col justify-between">
            <div>
              {/* Horizontal Filter Tabs */}
              <div className="flex items-center gap-6 border-b border-stone-200 overflow-x-auto select-none">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 -mb-[1px] ${
                    activeTab === 'all'
                      ? 'border-[#13382E] text-[#13382E] font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>All Visits</span>
                  <span className="bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    {displayedAppointments.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('pending')}
                  className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 -mb-[1px] ${
                    activeTab === 'pending'
                      ? 'border-[#13382E] text-[#13382E] font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Pending</span>
                  <span className="text-slate-500 text-[11px] font-semibold px-1.5 py-0.5">
                    {pendingRequests.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('confirmed')}
                  className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 -mb-[1px] ${
                    activeTab === 'confirmed'
                      ? 'border-[#13382E] text-[#13382E] font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Confirmed</span>
                  <span className="text-slate-500 text-[11px] font-semibold px-1.5 py-0.5">
                    {confirmedAppointments.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('completed')}
                  className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 -mb-[1px] ${
                    activeTab === 'completed'
                      ? 'border-[#13382E] text-[#13382E] font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Completed</span>
                  <span className="text-slate-500 text-[11px] font-semibold px-1.5 py-0.5">
                    {completedAppointments.length > 0 ? completedAppointments.length : 1}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('cancelled')}
                  className={`pb-3 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-b-2 -mb-[1px] ${
                    activeTab === 'cancelled'
                      ? 'border-[#13382E] text-[#13382E] font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Cancelled</span>
                  <span className="text-slate-500 text-[11px] font-semibold px-1.5 py-0.5">
                    {cancelledAppointments.length}
                  </span>
                </button>
              </div>

              {/* Search and Sort Toolbar */}
              <div className="flex items-center gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Appointments by patient name, RS ID, reason, or date..."
                    className="w-full h-[38px] bg-white border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className="h-[38px] px-3 bg-white border border-slate-200 rounded-[6px] text-xs font-medium text-slate-700 flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer shadow-2xs"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sort by: {sortBy}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {showSortDropdown && (
                    <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-[6px] shadow-lg py-1 z-20 text-xs">
                      {(['Date (Latest)', 'Patient Name', 'Status'] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setSortBy(opt);
                            setShowSortDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between ${
                            sortBy === opt ? 'font-bold text-emerald-800 bg-emerald-50/50' : 'text-slate-700'
                          }`}
                        >
                          <span>{opt}</span>
                          {sortBy === opt && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Appointments Card List */}
              <div className="mt-4 space-y-3">
                {filteredAppointments.length > 0 ? (
                  filteredAppointments.map((apt) => {
                    const initials = apt.patientName
                      ? apt.patientName.slice(0, 2).toUpperCase()
                      : 'RI';

                    return (
                      <div
                        key={apt.id}
                        className="bg-white border border-slate-200/90 rounded-[8px] p-4 shadow-2xs hover:border-slate-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          {/* Left: Avatar and Content */}
                          <div className="flex items-start gap-3.5 flex-1 min-w-0">
                            <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm shrink-0 mt-0.5">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Row 1: Patient Name & RS ID */}
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm">{apt.patientName}</span>
                                <span className="bg-slate-100 text-slate-500 font-medium text-[11px] px-1.5 py-0.5 rounded-[3px]">
                                  {apt.patientRsId || 'RS-FTPE4'}
                                </span>
                              </div>

                              {/* Row 2: Badges */}
                              <div className="flex items-center gap-2 flex-wrap mt-2">
                                {/* Date Chip */}
                                <span className="bg-[#F8FAFC] border border-slate-200 text-slate-700 text-[11px] font-medium px-2 py-1 rounded-[6px] flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{apt.date} · {apt.time}</span>
                                </span>

                                {/* Mode Chip */}
                                <span className="bg-[#E8F8F3] border border-[#A7E8D0] text-[#136C4F] text-[11px] font-medium px-2 py-1 rounded-[6px] flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-[#136C4F]" />
                                  <span>{apt.type === 'In-person' ? 'In-Clinic Visit' : apt.type}</span>
                                </span>

                                {/* Status Chip */}
                                <span className="bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-medium px-2 py-1 rounded-[6px] flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{apt.status}</span>
                                </span>
                              </div>

                              {/* Row 3: Reason */}
                              <div className="mt-2.5 text-xs text-slate-500 font-medium">
                                Reason: <span className="text-slate-700">{apt.reason || 'Follow-up consultation'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Action Chip and More Button */}
                          <div className="flex items-center gap-2 shrink-0 pt-0.5">
                            {apt.status === 'Completed' ? (
                              <span className="bg-[#E8F8F3] border border-[#A7E8D0] text-[#136C4F] text-xs font-semibold px-3 py-1.5 rounded-[6px] flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#136C4F]" />
                                <span>Consultation Done</span>
                              </span>
                            ) : apt.status === 'Confirmed' ? (
                              <button
                                onClick={async () => {
                                  await updateAppointmentStatus(apt.id, 'Completed');
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-[6px] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Mark Completed</span>
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  await updateAppointmentStatus(apt.id, 'Confirmed');
                                }}
                                className="bg-[#13382E] hover:bg-[#1a4a3d] text-white text-xs font-semibold px-3 py-1.5 rounded-[6px] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Accept Slot</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setRescheduleModalApt(apt);
                                setRescheduleDate(apt.date);
                                setRescheduleTime(apt.time);
                              }}
                              title="Reschedule / Options"
                              className="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-100 cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No appointments match the selected filter.
                  </div>
                )}
              </div>
            </div>

            {/* Pagination Footer */}
            <div className="mt-8 pt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {filteredAppointments.length} of {displayedAppointments.length} appointments
              </span>

              <div className="flex items-center gap-1">
                <button
                  disabled
                  className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-[6px] bg-white text-slate-300 cursor-not-allowed text-xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-xs font-medium text-slate-700">1 / 1</span>
                <button
                  disabled
                  className="w-7 h-7 flex items-center justify-center border border-slate-200 rounded-[6px] bg-white text-slate-300 cursor-not-allowed text-xs"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Calendar Overview & Direct Appointment Booking */}
          <div className="w-full lg:w-[325px] xl:w-[335px] shrink-0 space-y-4">
            {/* Card 1: Calendar Overview */}
            <div className="bg-white rounded-[8px] p-5 border border-stone-200/80 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-800">Calendar Overview</h3>

              <div className="flex items-center justify-between mt-3 mb-3">
                <span className="text-xs font-semibold text-slate-700">{currentMonthName}</span>
                <div className="flex items-center gap-2">
                  <button className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Days Header */}
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400 mb-1.5 select-none">
                <span>M</span>
                <span>T</span>
                <span>W</span>
                <span>T</span>
                <span>F</span>
                <span>S</span>
                <span>S</span>
              </div>

              {/* Days Grid for October 2026 */}
              <div className="grid grid-cols-7 gap-y-1.5 text-center text-xs select-none">
                {/* Row 1: 28, 29, 30, 1, 2, 3, 4 */}
                <div className="py-1 text-slate-300 font-normal">28</div>
                <div className="py-1 text-slate-300 font-normal">29</div>
                <div className="py-1 text-slate-300 font-normal">30</div>
                <div className="py-0.5 text-slate-800 font-medium">
                  <span>1</span>
                  <div className="w-1 h-1 rounded-full bg-[#10B981] mx-auto mt-0.5" />
                </div>
                <div className="py-0.5 text-slate-800 font-medium">
                  <span>2</span>
                  <div className="w-1 h-1 rounded-full bg-[#10B981] mx-auto mt-0.5" />
                </div>
                <div className="py-1 text-slate-700 font-medium">3</div>
                <div className="py-1 text-slate-700 font-medium">4</div>

                {/* Row 2: 5, 6, 7, 8, 9, 10, 11 */}
                <div className="py-1 text-slate-700 font-medium">5</div>
                <div className="py-1 text-slate-700 font-medium">6</div>
                <div className="py-1 text-slate-700 font-medium">7</div>
                <div className="py-0.5 text-slate-800 font-medium">
                  <span>8</span>
                  <div className="w-1 h-1 rounded-full bg-[#10B981] mx-auto mt-0.5" />
                </div>
                <div className="py-0.5 text-slate-800 font-medium">
                  <span>9</span>
                  <div className="w-1 h-1 rounded-full bg-[#10B981] mx-auto mt-0.5" />
                </div>
                <div className="py-0.5 text-slate-800 font-medium">
                  <span>10</span>
                  <div className="w-1 h-1 rounded-full bg-[#10B981] mx-auto mt-0.5" />
                </div>
                <div className="py-1 text-slate-700 font-medium">11</div>

                {/* Row 3: 12, 13, 14, 15, 16, 17, 18 */}
                <div className="py-1 text-slate-700 font-medium">12</div>
                <div className="py-1 text-slate-700 font-medium">13</div>
                <div className="py-1 text-slate-700 font-medium">14</div>
                <div className="py-1 text-slate-700 font-medium">15</div>
                <div className="py-0.5 text-slate-800 font-medium">
                  <span>16</span>
                  <div className="w-1 h-1 rounded-full bg-[#10B981] mx-auto mt-0.5" />
                </div>
                <div className="py-0.5 text-slate-800 font-medium">
                  <span>17</span>
                  <div className="w-1 h-1 rounded-full bg-[#10B981] mx-auto mt-0.5" />
                </div>
                <div className="py-1 text-slate-700 font-medium">18</div>

                {/* Row 4: 19, 20, 21, 22, 23 (today), 24, 25 */}
                <div className="py-1 text-slate-700 font-medium">19</div>
                <div className="py-1 text-slate-700 font-medium">20</div>
                <div className="py-1 text-slate-700 font-medium">21</div>
                <div className="py-1 text-slate-700 font-medium">22</div>
                <div className="flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-[#13382E] text-white font-bold flex items-center justify-center mx-auto text-xs shadow-2xs">
                    23
                  </div>
                </div>
                <div className="py-1 text-slate-700 font-medium">24</div>
                <div className="py-1 text-slate-700 font-medium">25</div>

                {/* Row 5: 26, 27, 28, 29, 30, 31, 1 */}
                <div className="py-0.5 text-slate-800 font-medium">
                  <span>26</span>
                  <div className="w-1 h-1 rounded-full bg-[#10B981] mx-auto mt-0.5" />
                </div>
                <div className="py-1 text-slate-700 font-medium">27</div>
                <div className="py-1 text-slate-700 font-medium">28</div>
                <div className="py-1 text-slate-700 font-medium">29</div>
                <div className="py-1 text-slate-700 font-medium">30</div>
                <div className="py-0.5 text-slate-800 font-medium">
                  <span>31</span>
                  <div className="w-1 h-1 rounded-full bg-[#10B981] mx-auto mt-0.5" />
                </div>
                <div className="py-1 text-slate-300 font-normal">1</div>
              </div>

              {/* Bottom Legend */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium select-none">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  <span>Has Consultations</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#13382E]" />
                  <span>Today</span>
                </div>
              </div>
            </div>

            {/* Card 2: Direct Appointment Booking */}
            <div className="bg-white rounded-[8px] p-5 border border-stone-200/80 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-[6px] border border-emerald-200 text-emerald-600 flex items-center justify-center bg-emerald-50/60 shrink-0">
                  <CalendarIcon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 leading-tight">Direct Appointment Booking</h3>
                  <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                    Schedule directly for connected patient
                  </p>
                </div>
              </div>

              <form onSubmit={handleBook} className="space-y-3">
                {/* Select Patient */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Patient</label>
                  <div className="relative">
                    <select
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      className="w-full h-[36px] bg-white border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 font-medium appearance-none focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs pr-8"
                    >
                      {availablePatients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.rsId || 'RS-FTPE4'})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Consultation Mode */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Consultation Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setVisitType('In-person')}
                      className={`py-2 rounded-[6px] flex flex-col items-center justify-center gap-1 text-[11px] transition-all cursor-pointer shadow-2xs ${
                        visitType === 'In-person'
                          ? 'bg-[#13382E] text-white font-semibold'
                          : 'bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>In-Clinic</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVisitType('Video call')}
                      className={`py-2 rounded-[6px] flex flex-col items-center justify-center gap-1 text-[11px] transition-all cursor-pointer shadow-2xs ${
                        visitType === 'Video call'
                          ? 'bg-[#13382E] text-white font-semibold'
                          : 'bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Video</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVisitType('Phone call')}
                      className={`py-2 rounded-[6px] flex flex-col items-center justify-center gap-1 text-[11px] transition-all cursor-pointer shadow-2xs ${
                        visitType === 'Phone call'
                          ? 'bg-[#13382E] text-white font-semibold'
                          : 'bg-white border border-slate-200 text-slate-600 font-medium hover:bg-slate-50'
                      }`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Phone</span>
                    </button>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={dateInput}
                      onChange={(e) => setDateInput(e.target.value)}
                      placeholder="01-11-2026"
                      className="w-full h-[36px] bg-white border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 font-medium focus:outline-none focus:border-emerald-600 shadow-2xs pr-9"
                    >
                    </input>
                    <CalendarIcon className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Time Slot */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Time Slot</label>
                  <div className="relative">
                    <select
                      value={timeInput}
                      onChange={(e) => setTimeInput(e.target.value)}
                      className="w-full h-[36px] bg-white border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 font-medium appearance-none focus:outline-none focus:border-emerald-600 cursor-pointer shadow-2xs pr-8"
                    >
                      {commonTimeSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Available slots: 9:00 AM – 6:00 PM (30 min interval)
                  </p>
                </div>

                {/* Clinical Purpose / Reason */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Clinical Purpose / Reason
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Routine checkup & Lab report evaluation"
                    className="w-full h-[36px] bg-white border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 font-medium focus:outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>

                {/* Preparation Instructions for Patient (optional) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preparation Instructions for Patient <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="e.g. Fasting 10-12 hrs required, bring physical reports..."
                    className="w-full h-16 bg-white border border-slate-200 rounded-[6px] p-2.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-600 resize-none shadow-2xs"
                  />
                </div>

                {/* Confirm & Schedule Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-[38px] bg-[#13382E] hover:bg-[#184639] text-white rounded-[6px] text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer mt-4 disabled:opacity-50"
                >
                  <CalendarIcon className="w-4 h-4" />
                  <span>{isSubmitting ? 'Scheduling...' : 'Confirm & Schedule'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Reschedule Modal */}
      {rescheduleModalApt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[8px] max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-sm text-stone-800">Reschedule Consultation</h3>
              <button
                onClick={() => setRescheduleModalApt(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-stone-600">
              Rescheduling for <span className="font-bold text-stone-800">{rescheduleModalApt.patientName}</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full border border-stone-200 rounded-[6px] px-3 py-2"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">New Time Slot</label>
                <select
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full border border-stone-200 rounded-[6px] px-3 py-2 bg-white"
                >
                  {commonTimeSlots.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Reason / Note for Patient</label>
                <input
                  type="text"
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  placeholder="e.g. Schedule conflict, shifted to next slot"
                  className="w-full border border-stone-200 rounded-[6px] px-3 py-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                onClick={() => setRescheduleModalApt(null)}
                className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-[6px]"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={isSubmitting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#13382E] hover:bg-[#19483c] rounded-[6px]"
              >
                {isSubmitting ? 'Updating...' : 'Save & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
