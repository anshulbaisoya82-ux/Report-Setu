import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { 
  Calendar, Clock, MapPin, Video, Phone, 
  ChevronLeft, ChevronRight, MoreVertical, Plus, 
  X, CheckCircle, AlertCircle, RefreshCw, XCircle,
  ChevronDown
} from 'lucide-react';
import { Appointment } from '../../types';
import { connectionsApi } from '../../api';

export const PatientAppointments: React.FC = () => {
  const { currentUser, appointments, requestAppointment, updateAppointmentStatus, fetchAppointments } = useStore();
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState<Appointment | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<Appointment | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [bookingToast, setBookingToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectedDoctors, setConnectedDoctors] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'past'>('all');

  // Booking Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [consultType, setConsultType] = useState<'In-person' | 'Video call' | 'Phone call'>('In-person');
  const [selectedDate, setSelectedDate] = useState('2026-11-01');
  const [selectedTime, setSelectedTime] = useState('11:30 AM');
  const [visitReason, setVisitReason] = useState('Follow-up CBC report review');
  const [rescheduleDate, setRescheduleDate] = useState('2026-11-05');
  const [rescheduleTime, setRescheduleTime] = useState('11:00 AM');

  // Calendar State
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState('November 2026');

  const fetchConnections = async () => {
    try {
      const res = await connectionsApi.getMyConnections();
      const list = res?.connections || [];
      setConnectedDoctors(list);
      if (list.length > 0) {
        setSelectedDoctorId((prev) => {
          const exists = list.some((c: any) => (c.doctorId || c.id || c.doctor?.id) === prev);
          return exists && prev ? prev : (list[0].doctorId || list[0].id || list[0].doctor?.id || '');
        });
      }
      return list;
    } catch (err) {
      console.warn('Failed to fetch connections:', err);
      return [];
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchConnections();
  }, []);

  // Filter default mock visits if store is empty
  const defaultVisits: Appointment[] = [
    {
      id: 'apt-1',
      patientId: currentUser?.id || 'p-1',
      patientName: currentUser?.name || 'Rishabh Sharma',
      patientRsId: currentUser?.rsId || 'RS-FTPE4',
      doctorName: 'Dr. Rishabh',
      date: '2026-11-01',
      time: '11:30 AM',
      type: 'In-person',
      reason: 'Follow-up CBC report review',
      status: 'Confirmed',
    },
    {
      id: 'apt-2',
      patientId: currentUser?.id || 'p-1',
      patientName: currentUser?.name || 'Rishabh Sharma',
      patientRsId: currentUser?.rsId || 'RS-FTPE4',
      doctorName: 'Dr. Rishabh',
      date: '2026-10-31',
      time: '10:30 AM',
      type: 'In-person',
      reason: 'Follow-up CBC report review',
      status: 'Completed',
    },
    {
      id: 'apt-3',
      patientId: currentUser?.id || 'p-1',
      patientName: currentUser?.name || 'Rishabh Sharma',
      patientRsId: currentUser?.rsId || 'RS-FTPE4',
      doctorName: 'Dr. Rishabh',
      date: '2026-10-15',
      time: '10:30 AM',
      type: 'In-person',
      reason: 'Follow-up CBC report review',
      status: 'Completed',
    },
  ];

  const allList = appointments.length > 0 ? appointments : defaultVisits;

  const filteredAppointments = allList.filter((a) => {
    if (activeTab === 'upcoming') {
      return a.status === 'Confirmed' || a.status === 'Pending';
    }
    if (activeTab === 'past') {
      return a.status === 'Completed' || a.status === 'Cancelled';
    }
    return true;
  });

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitReason.trim()) return;

    try {
      setIsSubmitting(true);
      const docName = connectedDoctors[0]?.name || connectedDoctors[0]?.doctorName || 'Dr. Rishabh';

      await requestAppointment({
        patientId: currentUser?.id || 'p-1',
        patientName: currentUser?.name || 'Rishabh Sharma',
        patientRsId: currentUser?.rsId || 'RS-FTPE4',
        doctorName: docName,
        date: selectedDate,
        time: selectedTime,
        type: consultType,
        reason: visitReason,
        status: 'Pending',
      });

      setShowBookingModal(false);
      setBookingToast('Appointment booked successfully!');
      setTimeout(() => setBookingToast(null), 3500);
      fetchAppointments();
    } catch (err: any) {
      alert(err?.message || 'Failed to book appointment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRescheduleModal) return;

    try {
      setIsSubmitting(true);
      await updateAppointmentStatus(showRescheduleModal.id, 'Pending', {
        date: rescheduleDate,
        time: rescheduleTime,
      });
      setShowRescheduleModal(null);
      setBookingToast('Reschedule request sent to doctor!');
      setTimeout(() => setBookingToast(null), 3500);
      fetchAppointments();
    } catch (err: any) {
      alert(err?.message || 'Failed to reschedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAppointment = async (apt: Appointment) => {
    try {
      await updateAppointmentStatus(apt.id, 'Cancelled');
      setShowCancelModal(null);
      setBookingToast('Appointment cancelled.');
      setTimeout(() => setBookingToast(null), 3500);
      fetchAppointments();
    } catch (err: any) {
      alert(err?.message || 'Failed to cancel appointment.');
    }
  };

  // Helper to parse date for display: "01", "Nov"
  const getDateParts = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return {
          day: String(d.getDate()).padStart(2, '0'),
          month: d.toLocaleString('en-US', { month: 'short' }),
        };
      }
    } catch (e) {}
    return { day: '01', month: 'Nov' };
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Toast */}
      {bookingToast && (
        <div className="fixed top-5 right-5 z-50 bg-[#0E382F] text-white px-4 py-2 rounded-[3px] shadow-lg flex items-center gap-2 border border-emerald-500/30 text-xs font-semibold animate-in fade-in duration-150">
          <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
          <span>{bookingToast}</span>
        </div>
      )}

      {/* Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-0.5">
            <span className="text-xs">︽</span>
            <span>Appointments</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
            Appointments & Consultations
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Schedule visits, follow-ups, and online consultations with your doctor.
          </p>
        </div>

        <div>
          <button
            onClick={() => setShowBookingModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0E382F] text-white rounded-[3px] text-xs font-semibold hover:bg-[#092720] shadow-2xs transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Book Appointment</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200 flex items-center gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('all')}
          className={`pb-2.5 transition-colors cursor-pointer ${
            activeTab === 'all'
              ? 'border-b-2 border-[#0E382F] text-slate-900 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          All Appointments
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-2.5 transition-colors cursor-pointer ${
            activeTab === 'upcoming'
              ? 'border-b-2 border-[#0E382F] text-slate-900 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`pb-2.5 transition-colors cursor-pointer ${
            activeTab === 'past'
              ? 'border-b-2 border-[#0E382F] text-slate-900 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Past
        </button>
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Appointments List (8 cols) */}
        <div className="lg:col-span-8 space-y-2.5">
          <div className="bg-white rounded-[3px] border border-stone-200/90 divide-y divide-stone-100 shadow-2xs">
            {filteredAppointments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No appointments found for the selected filter.
              </div>
            ) : (
              filteredAppointments.map((apt) => {
                const { day, month } = getDateParts(apt.date);
                const isConfirmed = apt.status === 'Confirmed';
                const isCompleted = apt.status === 'Completed';

                return (
                  <div
                    key={apt.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-stone-50/50 transition-colors relative"
                  >
                    {/* Left: Date Box + Title & Doctor */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-[3px] bg-stone-50 border border-stone-200/60 flex flex-col items-center justify-center text-center shrink-0">
                        <span className="text-base font-bold text-slate-900 leading-none">{day}</span>
                        <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">{month}</span>
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-900 truncate tracking-tight">
                          {apt.reason || 'Follow-up consultation'}
                        </h3>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>{apt.doctorName || 'Dr. Rishabh'}</span>
                          <span>·</span>
                          <span className="flex items-center gap-0.5 text-slate-500">
                            <MapPin className="w-2.5 h-2.5" />
                            {apt.type || 'In-person'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Right: Status Badge, Time & Menu */}
                    <div className="flex items-center gap-3 shrink-0">
                      {isConfirmed && (
                        <span className="px-2 py-0.5 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] text-[10.5px] font-semibold border border-emerald-200/50">
                          Confirmed
                        </span>
                      )}
                      {isCompleted && (
                        <span className="px-2 py-0.5 rounded-[3px] bg-slate-100 text-slate-600 text-[10.5px] font-semibold border border-slate-200/60">
                          Completed
                        </span>
                      )}
                      {!isConfirmed && !isCompleted && (
                        <span className="px-2 py-0.5 rounded-[3px] bg-amber-50 text-amber-700 text-[10.5px] font-semibold border border-amber-200/50">
                          {apt.status}
                        </span>
                      )}

                      <span className="text-xs text-slate-600 font-medium min-w-[62px] text-right">
                        {apt.time || '10:30 AM'}
                      </span>

                      <div className="relative">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === apt.id ? null : apt.id)}
                          className="p-1 rounded-[2px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuId === apt.id && (
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-stone-200 rounded-[3px] shadow-lg py-1 z-20 text-xs">
                            <button
                              onClick={() => {
                                setShowRescheduleModal(apt);
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-stone-50 text-slate-700"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => {
                                setShowCancelModal(apt);
                                setActiveMenuId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-stone-50 text-red-600"
                            >
                              Cancel Visit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Calendar Overview & Quick Actions (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Mini Calendar Card */}
          <div className="bg-white rounded-[3px] border border-stone-200/90 p-4 shadow-2xs space-y-3">
            {/* Calendar Header */}
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-slate-900">{currentCalendarMonth}</span>
              <div className="flex items-center gap-1">
                <button className="p-1 text-slate-400 hover:text-slate-700 rounded-[2px] cursor-pointer">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 text-slate-400 hover:text-slate-700 rounded-[2px] cursor-pointer">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] text-slate-400 font-medium">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-700">
              {/* Day 1 highlighted in dark green */}
              <div className="w-6 h-6 mx-auto rounded-[3px] bg-[#0E382F] text-white font-bold flex items-center justify-center text-[11px] shadow-2xs">
                1
              </div>
              {Array.from({ length: 29 }, (_, i) => i + 2).map((d) => (
                <div
                  key={d}
                  className="w-6 h-6 mx-auto rounded-[3px] flex items-center justify-center text-[11px] text-slate-600 hover:bg-stone-100 cursor-pointer"
                >
                  {d}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white rounded-[3px] border border-stone-200/90 p-4 shadow-2xs space-y-2.5">
            <h3 className="text-xs font-bold text-slate-900">Quick Actions</h3>

            <div className="space-y-1.5">
              <button
                onClick={() => {
                  if (filteredAppointments.length > 0) {
                    setShowRescheduleModal(filteredAppointments[0]);
                  }
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-[3px] border border-stone-200/90 text-xs font-medium text-slate-700 hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reschedule an Appointment</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                onClick={() => {
                  if (filteredAppointments.length > 0) {
                    setShowCancelModal(filteredAppointments[0]);
                  }
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-[3px] border border-stone-200/90 text-xs font-medium text-slate-700 hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cancel an Appointment</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-[3px] max-w-sm w-full p-4 space-y-3.5 shadow-xl border border-stone-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="text-xs font-bold text-slate-900">Book Doctor Consultation</h3>
              <button
                onClick={() => setShowBookingModal(false)}
                className="p-1 rounded-[2px] text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleBookSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Reason for Consultation
                </label>
                <input
                  type="text"
                  required
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                  placeholder="e.g. Follow-up CBC report review"
                  className="w-full h-8 px-2.5 rounded-[3px] border border-stone-200 focus:outline-none focus:border-[#0E382F]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Consultation Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['In-person', 'Video call', 'Phone call'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setConsultType(mode)}
                      className={`h-8 rounded-[3px] border text-[11px] font-semibold transition-colors cursor-pointer ${
                        consultType === mode
                          ? 'bg-[#0E382F] text-white border-[#0E382F]'
                          : 'bg-white text-slate-700 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full h-8 px-2 rounded-[3px] border border-stone-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Time</label>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full h-8 px-2 rounded-[3px] border border-stone-200 text-xs"
                  >
                    <option value="09:30 AM">09:30 AM</option>
                    <option value="10:30 AM">10:30 AM</option>
                    <option value="11:30 AM">11:30 AM</option>
                    <option value="04:30 PM">04:30 PM</option>
                    <option value="05:30 PM">05:30 PM</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-3 py-1.5 rounded-[3px] border border-stone-200 text-slate-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 rounded-[3px] bg-[#0E382F] text-white font-semibold hover:bg-[#092720]"
                >
                  {isSubmitting ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-[3px] max-w-sm w-full p-4 space-y-3.5 shadow-xl border border-stone-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="text-xs font-bold text-slate-900">Reschedule Appointment</h3>
              <button
                onClick={() => setShowRescheduleModal(null)}
                className="p-1 rounded-[2px] text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-3 text-xs">
              <p className="text-slate-500 text-[11px]">
                Request a new time slot with {showRescheduleModal.doctorName || 'Dr. Rishabh'}.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">New Date</label>
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full h-8 px-2 rounded-[3px] border border-stone-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">New Time</label>
                  <select
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full h-8 px-2 rounded-[3px] border border-stone-200 text-xs"
                  >
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:00 AM">11:00 AM</option>
                    <option value="02:30 PM">02:30 PM</option>
                    <option value="04:00 PM">04:00 PM</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(null)}
                  className="px-3 py-1.5 rounded-[3px] border border-stone-200 text-slate-600 hover:bg-stone-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 rounded-[3px] bg-[#0E382F] text-white font-semibold hover:bg-[#092720]"
                >
                  {isSubmitting ? 'Saving...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-[3px] max-w-xs w-full p-4 space-y-3 shadow-xl border border-stone-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-xs font-bold text-slate-900">Cancel Appointment?</h3>
            <p className="text-[11px] text-slate-500 leading-normal">
              Are you sure you want to cancel your appointment with {showCancelModal.doctorName || 'Dr. Rishabh'}?
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(null)}
                className="px-2.5 py-1.5 rounded-[3px] border border-stone-200 text-slate-600 text-xs"
              >
                No, Keep
              </button>
              <button
                onClick={() => handleCancelAppointment(showCancelModal)}
                className="px-3 py-1.5 rounded-[3px] bg-red-600 text-white font-semibold text-xs hover:bg-red-700"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
