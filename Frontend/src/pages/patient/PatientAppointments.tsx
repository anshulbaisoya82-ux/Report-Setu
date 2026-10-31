import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { 
  Clock, MapPin, Video, CheckCircle, Plus, 
  X, Calendar, Phone, AlertCircle, RefreshCw,
  User, CheckCircle2, ShieldCheck, ArrowRight
} from 'lucide-react';
import { Appointment } from '../../types';
import { connectionsApi } from '../../api';

export const PatientAppointments: React.FC = () => {
  const { currentUser, appointments, requestAppointment, updateAppointmentStatus, fetchAppointments } = useStore();
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState<Appointment | null>(null);
  const [bookingSuccessToast, setBookingSuccessToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectedDoctors, setConnectedDoctors] = useState<any[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'confirmed' | 'pending' | 'completed'>('all');

  // Booking Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [consultType, setConsultType] = useState<'In-person' | 'Video call' | 'Phone call'>('In-person');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [selectedTime, setSelectedTime] = useState('10:30 AM');
  const [visitReason, setVisitReason] = useState('Follow-up CBC report review');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('11:00 AM');

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

  const handleOpenBookingModal = () => {
    fetchConnections();
    setShowBookingModal(true);
  };

  const patientAppointments = appointments.filter((a) => {
    if (!currentUser?.id && !currentUser?._id) return true;
    const uid = currentUser?.id || currentUser?._id;
    return a.patientId === uid || a.patientRsId === currentUser?.rsId || !a.patientId;
  });

  const confirmedVisits = patientAppointments.filter((a) => a.status === 'Confirmed');
  const pendingVisits = patientAppointments.filter((a) => a.status === 'Pending');
  const completedVisits = patientAppointments.filter((a) => a.status === 'Completed');
  const cancelledVisits = patientAppointments.filter((a) => a.status === 'Cancelled');

  const nextConfirmed = confirmedVisits[0];

  const filteredList = patientAppointments.filter((a) => {
    if (filterTab === 'confirmed') return a.status === 'Confirmed';
    if (filterTab === 'pending') return a.status === 'Pending';
    if (filterTab === 'completed') return a.status === 'Completed';
    return true;
  });

  const selectedDoc =
    connectedDoctors.find((c) => (c.doctorId || c.id || c.doctor?.id) === selectedDoctorId) ||
    connectedDoctors[0];

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitReason.trim()) return;

    if (!selectedDoc) {
      alert('You have no connected healthcare provider. Please connect with your doctor first on the Doctors page.');
      return;
    }

    const docName =
      selectedDoc.name ||
      selectedDoc.doctorName ||
      selectedDoc.doctor?.name ||
      'Doctor';
    const docId = selectedDoc.doctorId || selectedDoc.id || selectedDoc.doctor?.id;

    setIsSubmitting(true);
    try {
      await requestAppointment({
        patientId: currentUser?.id || (currentUser as any)?._id || '',
        patientName: currentUser?.name || 'Patient',
        patientRsId: currentUser?.rsId || '',
        doctorId: docId,
        doctorName: docName,
        date: selectedDate,
        time: selectedTime,
        type: consultType,
        status: 'Pending',
        reason: visitReason.trim(),
      });

      setShowBookingModal(false);
      setBookingSuccessToast(`Appointment requested with ${docName}! Real-time status updates enabled.`);
      setTimeout(() => setBookingSuccessToast(null), 4500);
    } catch (err: any) {
      alert(`Booking notice: ${err?.message || 'Failed to submit appointment request'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment request?')) return;
    try {
      await updateAppointmentStatus(id, 'Cancelled');
      setBookingSuccessToast('Appointment cancelled successfully.');
      setTimeout(() => setBookingSuccessToast(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel appointment');
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRescheduleModal || !rescheduleDate) return;

    setIsSubmitting(true);
    try {
      await updateAppointmentStatus(showRescheduleModal.id, 'Pending', {
        date: rescheduleDate,
        time: rescheduleTime,
        notes: `Reschedule requested by patient to ${rescheduleDate} at ${rescheduleTime}`,
      });
      setShowRescheduleModal(null);
      setBookingSuccessToast(`Reschedule request sent for ${rescheduleDate} at ${rescheduleTime}.`);
      setTimeout(() => setBookingSuccessToast(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to reschedule appointment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Toast Alert */}
      {bookingSuccessToast && (
        <div className="fixed top-6 right-6 z-50 bg-[#1E3F35] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-[#2E9E6B]/50 animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="w-5 h-5 text-accent-teal shrink-0" />
          <div>
            <p className="font-semibold text-xs leading-snug">{bookingSuccessToast}</p>
            <p className="text-[11px] text-stone-300">Your doctor will be notified via live websocket.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-forest-950 font-serif tracking-tight">Appointments & Consultations</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E4EDE8] text-[#1E3F35] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E9E6B] animate-pulse" />
              Real-time Sync
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Book visits and track clinical consultations with your connected healthcare provider
          </p>
        </div>

        <button
          onClick={handleOpenBookingModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#1E3F35] hover:bg-[#16322A] rounded-xl transition-all shadow-xs active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-accent-teal" /> Book New Appointment
        </button>
      </div>

      {/* 1. UPCOMING CONFIRMED APPOINTMENT CARD (HERO) */}
      {nextConfirmed ? (
        <div className="bg-[#1E3F35] bg-gradient-to-r from-[#1E3F35] to-[#264E42] rounded-3xl p-6 text-white shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-accent-teal/20 text-accent-teal border border-accent-teal/30 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" /> Confirmed Upcoming Visit
            </span>
            <span className="text-xs text-stone-300 font-medium">{nextConfirmed.date}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex flex-col items-center justify-center text-center shrink-0">
                <Calendar className="w-6 h-6 text-accent-teal" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-serif leading-tight">{nextConfirmed.reason}</h3>
                <p className="text-xs text-stone-200 mt-0.5">
                  With <span className="font-semibold text-white">{nextConfirmed.doctorName}</span>
                </p>
                <div className="flex items-center gap-3 text-xs text-stone-300 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-accent-teal" /> {nextConfirmed.time}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-accent-teal" /> {nextConfirmed.type}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={() => {
                  setRescheduleDate(nextConfirmed.date);
                  setRescheduleTime(nextConfirmed.time);
                  setShowRescheduleModal(nextConfirmed);
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-colors text-amber-200 cursor-pointer"
              >
                Reschedule
              </button>
              <button
                type="button"
                onClick={() => handleCancelAppointment(nextConfirmed.id)}
                className="px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-red-500/30 border border-white/20 rounded-xl transition-colors text-red-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>

          {nextConfirmed.notes && (
            <div className="bg-white/10 rounded-xl p-3 text-xs text-stone-200 border border-white/10">
              <strong className="text-accent-teal">Clinician Instructions:</strong> {nextConfirmed.notes}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-8 text-center text-stone-500 text-xs shadow-2xs space-y-2">
          <Calendar className="w-8 h-8 text-stone-300 mx-auto" />
          <p className="font-semibold text-stone-700 text-sm">No Confirmed Upcoming Appointment</p>
          <p className="text-stone-400 max-w-sm mx-auto">
            Book a consultation with your doctor to review lab reports, discuss medication adjustments, or get clinical guidance.
          </p>
          <button
            type="button"
            onClick={handleOpenBookingModal}
            className="mt-2 px-4 py-2 text-xs font-bold text-[#1E3F35] bg-[#E4EDE8] hover:bg-[#d5e4da] rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Book Consultation
          </button>
        </div>
      )}

      {/* 2. PENDING REQUESTS QUEUE (Awaiting Doctor Confirmation) */}
      {pendingVisits.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Awaiting Doctor Confirmation ({pendingVisits.length})
              </h3>
            </div>
            <span className="text-[11px] text-amber-800 font-medium">Real-time status updates active</span>
          </div>

          <div className="space-y-2.5">
            {pendingVisits.map((apt) => (
              <div
                key={apt.id}
                className="bg-white p-4 rounded-2xl border border-amber-200/70 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-900">{apt.reason}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      Pending Approval
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    With <strong>{apt.doctorName || 'Doctor'}</strong> · {apt.date} at {apt.time} ({apt.type})
                  </p>
                  {apt.requestedAt && (
                    <span className="text-[10px] text-stone-400 block mt-0.5">{apt.requestedAt}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleCancelAppointment(apt.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:text-red-600 bg-stone-100 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Withdraw Request
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. APPOINTMENTS HISTORY / LIST WITH TABS */}
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-stone-900 font-serif">All Consultations</h3>
            <p className="text-xs text-stone-400">Track current and historical clinic appointments</p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl self-start sm:self-auto text-xs font-semibold">
            {(['all', 'confirmed', 'pending', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterTab(tab)}
                className={`px-3 py-1 rounded-lg transition-all capitalize cursor-pointer ${
                  filterTab === tab
                    ? 'bg-white text-stone-900 shadow-2xs font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-1">
          {filteredList.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-400">
              No appointments found under the selected category.
            </div>
          ) : (
            filteredList.map((apt) => {
              const isConfirmed = apt.status === 'Confirmed';
              const isPending = apt.status === 'Pending';
              const isCompleted = apt.status === 'Completed';
              const isCancelled = apt.status === 'Cancelled';

              return (
                <div
                  key={apt.id}
                  className="p-4 rounded-2xl border border-stone-200/70 hover:border-stone-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isConfirmed
                        ? 'bg-[#E4EDE8] text-[#1E3F35]'
                        : isPending
                        ? 'bg-amber-100 text-amber-800'
                        : isCompleted
                        ? 'bg-teal-50 text-teal-800'
                        : 'bg-stone-100 text-stone-400'
                    }`}>
                      {apt.type === 'Video call' ? (
                        <Video className="w-5 h-5" />
                      ) : apt.type === 'Phone call' ? (
                        <Phone className="w-5 h-5" />
                      ) : (
                        <MapPin className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-stone-900">{apt.reason}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isConfirmed
                            ? 'bg-[#E4EDE8] text-[#1E3F35]'
                            : isPending
                            ? 'bg-amber-100 text-amber-800'
                            : isCompleted
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-stone-200 text-stone-600'
                        }`}>
                          {apt.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-0.5">
                        {apt.doctorName} · {apt.date} at {apt.time} ({apt.type})
                      </p>
                      {apt.notes && (
                        <p className="text-[11px] text-stone-400 mt-1 italic">
                          "{apt.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {isConfirmed && (
                      <button
                        type="button"
                        onClick={() => {
                          setRescheduleDate(apt.date);
                          setRescheduleTime(apt.time);
                          setShowRescheduleModal(apt);
                        }}
                        className="px-3 py-1 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 rounded-lg transition-colors cursor-pointer"
                      >
                        Reschedule
                      </button>
                    )}
                    {(isConfirmed || isPending) && (
                      <button
                        type="button"
                        onClick={() => handleCancelAppointment(apt.id)}
                        className="px-3 py-1 text-xs font-semibold text-stone-500 hover:text-red-600 bg-stone-50 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* BOOKING MODAL */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900 font-serif">Book Clinical Consultation</h3>
                <p className="text-xs text-stone-500">Real-time scheduling with your doctor</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBookSubmit} className="space-y-4">
              {/* Doctor Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block">
                    Select Healthcare Provider
                  </label>
                  <button
                    type="button"
                    onClick={fetchConnections}
                    className="text-[11px] font-semibold text-[#1E3F35] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                </div>

                {connectedDoctors.length > 0 ? (
                  <div className="space-y-2.5">
                    <select
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-stone-300 bg-white font-semibold text-stone-800 focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35]"
                    >
                      {connectedDoctors.map((conn) => {
                        const docId = conn.doctorId || conn.id || conn.doctor?.id;
                        const name = conn.name || conn.doctorName || conn.doctor?.name || 'Doctor';
                        const spec = conn.specialty || conn.doctor?.specialty || 'General Practitioner';
                        const clinicName = conn.clinic?.name || conn.doctor?.clinic?.name || '';
                        return (
                          <option key={docId} value={docId}>
                            {name} — {spec} {clinicName ? `(${clinicName})` : ''}
                          </option>
                        );
                      })}
                    </select>

                    {selectedDoc && (
                      <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs text-emerald-950">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#1E3F35] text-white flex items-center justify-center font-bold text-xs">
                            {(selectedDoc.name || selectedDoc.doctorName || 'Dr').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-stone-900">
                              {selectedDoc.name || selectedDoc.doctorName || 'Doctor'}
                            </div>
                            <div className="text-[11px] text-emerald-800 font-medium">
                              {selectedDoc.specialty || selectedDoc.doctor?.specialty || 'General Practitioner'}
                              {(selectedDoc.clinic?.name || selectedDoc.doctor?.clinic?.name) ? ` · ${selectedDoc.clinic?.name || selectedDoc.doctor?.clinic?.name}` : ''}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 border border-emerald-300">
                          Connected
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-900 space-y-2.5">
                    <div className="flex items-center gap-2 font-bold text-amber-950">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>No Connected Doctor Found</span>
                    </div>
                    <p className="text-amber-800 text-[11px] leading-relaxed">
                      You must be connected with a doctor to book clinical appointments. Share your RS ID or connect with your doctor on the Doctors page.
                    </p>
                    <a
                      href="/patient/doctors"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#1E3F35] hover:bg-[#16322A] px-3.5 py-1.5 rounded-xl shadow-xs transition-all w-fit"
                    >
                      <span>Go to Doctors Page</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Consultation Mode */}
              <div>
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-2">
                  Consultation Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setConsultType('In-person')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      consultType === 'In-person'
                        ? 'bg-[#1E3F35] text-white border-[#1E3F35] shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <MapPin className="w-4 h-4 mx-auto mb-1" />
                    <span className="text-xs font-bold block">In-person</span>
                    <span className="text-[10px] opacity-80 block">Clinic visit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConsultType('Video call')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      consultType === 'Video call'
                        ? 'bg-[#1E3F35] text-white border-[#1E3F35] shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <Video className="w-4 h-4 mx-auto mb-1" />
                    <span className="text-xs font-bold block">Video Call</span>
                    <span className="text-[10px] opacity-80 block">Telehealth</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConsultType('Phone call')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      consultType === 'Phone call'
                        ? 'bg-[#1E3F35] text-white border-[#1E3F35] shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <Phone className="w-4 h-4 mx-auto mb-1" />
                    <span className="text-xs font-bold block">Phone Call</span>
                    <span className="text-[10px] opacity-80 block">Direct dial</span>
                  </button>
                </div>
              </div>

              {/* Date & Time Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                    Select Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-300 font-medium bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                    Select Time Slot
                  </label>
                  <select
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-300 font-medium bg-white"
                  >
                    <option value="10:00 AM">10:00 AM (Morning)</option>
                    <option value="10:30 AM">10:30 AM (Morning)</option>
                    <option value="11:30 AM">11:30 AM (Morning)</option>
                    <option value="02:00 PM">02:00 PM (Afternoon)</option>
                    <option value="04:30 PM">04:30 PM (Evening)</option>
                    <option value="05:15 PM">05:15 PM (Evening)</option>
                  </select>
                </div>
              </div>

              {/* Consultation Reason */}
              <div>
                <label className="text-xs font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                  Reason for Consultation
                </label>
                <textarea
                  rows={2}
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                  placeholder="e.g. Follow up on platelet count, discuss recent blood test, medication query..."
                  className="w-full text-xs p-3 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || connectedDoctors.length === 0}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#1E3F35] hover:bg-[#16322A] rounded-xl shadow-xs transition-all active:scale-95 disabled:bg-stone-300 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Request...</span>
                    </>
                  ) : (
                    <span>Submit Appointment Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900 font-serif">Reschedule Appointment</h3>
                <p className="text-xs text-stone-500">Pick a new date and time for {showRescheduleModal.reason}</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowRescheduleModal(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                  New Date
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 uppercase tracking-wider block mb-1.5">
                  New Time Slot
                </label>
                <select
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-300 bg-white"
                >
                  <option value="10:00 AM">10:00 AM (Morning)</option>
                  <option value="10:30 AM">10:30 AM (Morning)</option>
                  <option value="11:30 AM">11:30 AM (Morning)</option>
                  <option value="02:00 PM">02:00 PM (Afternoon)</option>
                  <option value="04:30 PM">04:30 PM (Evening)</option>
                  <option value="05:15 PM">05:15 PM (Evening)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(null)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 font-bold text-white bg-[#1E3F35] hover:bg-[#16322A] rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
