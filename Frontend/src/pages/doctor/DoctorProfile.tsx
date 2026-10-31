import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Save,
  Phone,
  Mail,
  MapPin,
  Building2,
  Clock,
  User,
  Users,
  Calendar,
  FileText,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { doctorProfileApi } from '../../api/client';
import { useStore } from '../../store/useStore';

export const DoctorProfile: React.FC = () => {
  const {
    currentUser,
    setCurrentUser,
    doctorInfo,
    patients,
    appointments,
    reports,
    questionThreads,
    fetchDoctorPatients,
    fetchAppointments,
    fetchReports,
    fetchQuestionThreads,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    phone: '',
    email: '',
    registrationNumber: '',
    medicalCouncil: '',
    verificationStatus: 'verified',
    clinicName: '',
    clinicAddress: '',
    clinicPhone: '',
    clinicTimings: '',
    consultationFee: '800',
    qualifications: 'MBBS, MD (General Medicine)',
    bio: 'Dedicated to evidence-based preventive care and comprehensive chronic illness management.',
  });

  const [backendStats, setBackendStats] = useState({
    activePatientsCount: 0,
    appointmentsCount: 0,
    reportsReviewedCount: 0,
    pendingQuestionsCount: 0,
  });

  // Doctor Display Name in Hero Banner (realtime derived from form or session)
  const doctorDisplayName =
    formData.name.trim() ||
    currentUser?.name ||
    doctorInfo.name ||
    'Dr. Rishabh';

  const doctorRegistration =
    formData.registrationNumber.trim() ||
    currentUser?.registrationNumber ||
    doctorInfo.regNumber ||
    'NMC-PENDING';

  // Fetch doctor profile and realtime metrics
  useEffect(() => {
    let isMounted = true;

    // Refresh realtime counts from store
    void fetchDoctorPatients();
    void fetchAppointments();
    void fetchReports();
    void fetchQuestionThreads();

    async function loadProfile() {
      try {
        const res = await doctorProfileApi.get();
        if (res && res.data && isMounted) {
          const d = res.data;
          const clinic = d.clinic || {};
          setFormData((prev) => ({
            ...prev,
            name: d.name || '',
            specialty: d.specialty || '',
            phone: d.phone || '',
            email: d.email || '',
            registrationNumber: d.registrationNumber || '',
            medicalCouncil: d.medicalCouncil || '',
            verificationStatus: d.verificationStatus || 'verified',
            clinicName: clinic.name || '',
            clinicAddress: clinic.address || '',
            clinicPhone: clinic.phone || '',
            clinicTimings: clinic.timings || '',
            consultationFee: String(clinic.consultationFee || '800'),
            qualifications: d.qualifications || 'MBBS, MD (General Medicine)',
            bio: d.bio || 'Dedicated to evidence-based preventive care and comprehensive chronic illness management.',
          }));

          if (d.stats) {
            setBackendStats({
              activePatientsCount: d.stats.activePatientsCount ?? 0,
              appointmentsCount: d.stats.appointmentsCount ?? 0,
              reportsReviewedCount: d.stats.reportsReviewedCount ?? 0,
              pendingQuestionsCount: d.stats.pendingQuestionsCount ?? 0,
            });
          }
        }
      } catch (err: any) {
        console.warn('Backend doctor profile fetch note (using active session):', err?.message);
      }
    }

    void loadProfile();
    return () => {
      isMounted = false;
    };
  }, [fetchDoctorPatients, fetchAppointments, fetchReports, fetchQuestionThreads]);

  // Realtime calculated statistics
  const realPatientsCount = Math.max(backendStats.activePatientsCount, patients.length);
  const realAppointmentsCount = Math.max(backendStats.appointmentsCount, appointments.length);
  const realReportsCount = Math.max(
    backendStats.reportsReviewedCount,
    reports.filter((r) => r.reviewed || r.reviewStatus === 'approved').length
  );
  const realPendingCount = Math.max(
    backendStats.pendingQuestionsCount,
    questionThreads.reduce((acc, t) => acc + (t.unreadCount || 0), 0)
  );

  const getInitials = (name?: string) => {
    if (!name) return 'DR';
    const clean = name.replace(/^(Dr\.|Doctor)\s*/i, '').trim();
    if (clean.length > 0) {
      return `D${clean[0].toUpperCase()}`;
    }
    return 'DR';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setToastMsg(null);

      // Build update payload
      const payload: any = {
        name: formData.name.trim(),
        specialty: formData.specialty.trim(),
        medicalCouncil: formData.medicalCouncil.trim(),
        registrationNumber: formData.registrationNumber.trim(),
        clinic: {
          name: formData.clinicName.trim(),
          address: formData.clinicAddress.trim(),
          phone: formData.clinicPhone.trim(),
          timings: formData.clinicTimings.trim(),
          consultationFee: Number(formData.consultationFee) || 800,
        },
        qualifications: formData.qualifications.trim(),
        bio: formData.bio.trim(),
      };

      if (formData.phone.trim().length >= 8) {
        payload.phone = formData.phone.trim();
      }

      await doctorProfileApi.update(payload);

      // Synchronize updated profile into store & local storage for instant application-wide realtime reflection
      const updatedUser = {
        ...currentUser,
        name: formData.name.trim(),
        specialty: formData.specialty.trim(),
        registrationNumber: formData.registrationNumber.trim(),
        medicalCouncil: formData.medicalCouncil.trim(),
        phone: formData.phone.trim() || currentUser?.phone,
        clinic: {
          ...(currentUser?.clinic || {}),
          name: formData.clinicName.trim(),
          address: formData.clinicAddress.trim(),
          phone: formData.clinicPhone.trim(),
          timings: formData.clinicTimings.trim(),
          consultationFee: Number(formData.consultationFee) || 800,
        },
        qualifications: formData.qualifications.trim(),
        bio: formData.bio.trim(),
      };

      setCurrentUser(updatedUser);
      localStorage.setItem('reportsetu_user', JSON.stringify(updatedUser));

      setToastMsg({ type: 'success', text: 'Doctor profile and practice info updated successfully!' });
      setTimeout(() => setToastMsg(null), 3500);
    } catch (err: any) {
      console.error('Failed to update doctor profile:', err);
      setToastMsg({
        type: 'error',
        text: err?.message || 'Failed to update doctor profile. Please try again.',
      });
      setTimeout(() => setToastMsg(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-[1400px] w-full mx-auto space-y-5 text-stone-800">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-[8px] shadow-lg flex items-center gap-2.5 border transition-all ${
            toastMsg.type === 'success'
              ? 'bg-[#13382E] text-white border-emerald-700/60'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="text-xs font-semibold">{toastMsg.text}</span>
        </div>
      )}

      {/* Hero Overview Banner Card */}
      <div className="relative overflow-hidden rounded-[14px] border border-[#D0E5DC] bg-gradient-to-r from-[#DFEEE7] via-[#EBF4F0] to-[#E2F0EA] p-6 shadow-2xs">
        {/* Subtle decorative background wave */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-35 pointer-events-none">
          <svg viewBox="0 0 400 160" fill="none" className="w-full h-full object-cover">
            <path
              d="M0,100 C150,160 250,20 400,80 L400,0 L0,0 Z"
              fill="url(#waveGrad)"
            />
            <defs>
              <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#A8D5C2" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#76B599" stopOpacity="0.2" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Top Right Verified Clinician Badge */}
        <div className="absolute top-5 right-5 sm:top-6 sm:right-6 z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/85 backdrop-blur-xs text-[#136C4F] border border-emerald-200/80 text-xs font-semibold shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#136C4F]" />
            <span>Verified Clinician</span>
          </span>
        </div>

        {/* Clinician Identity Row */}
        <div className="flex items-center gap-5 relative z-10">
          {/* Dark Green Square Avatar */}
          <div className="w-[74px] h-[74px] rounded-[16px] bg-[#13382E] text-white flex items-center justify-center font-bold text-2xl tracking-wider shadow-md shrink-0">
            {getInitials(doctorDisplayName)}
          </div>

          {/* Name, NMC Verified Badge & Reg info */}
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-extrabold text-[#13382E] tracking-tight">
                {doctorDisplayName.startsWith('Dr.') ? doctorDisplayName : `Dr. ${doctorDisplayName}`}
              </h1>
              <span className="inline-flex items-center gap-1 bg-[#D4EFE3] text-[#136C4F] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#9BE1C3]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#136C4F]" />
                <span>NMC Verified</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              · Reg: <span className="font-mono">{doctorRegistration}</span> ·
            </p>
          </div>
        </div>
      </div>

      {/* 4 Realtime Clinical Activity Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Connected Patients */}
        <div className="bg-white rounded-[10px] p-4 border border-stone-200/80 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-semibold text-slate-700">Connected Patients</span>
          </div>
          <div className="text-xl font-bold text-slate-900">
            {realPatientsCount} active
          </div>
        </div>

        {/* Card 2: Total Appointments */}
        <div className="bg-white rounded-[10px] p-4 border border-stone-200/80 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-semibold text-slate-700">Total Appointments</span>
          </div>
          <div className="text-xl font-bold text-slate-900">
            {realAppointmentsCount} scheduled
          </div>
        </div>

        {/* Card 3: Reports Reviewed */}
        <div className="bg-white rounded-[10px] p-4 border border-stone-200/80 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-semibold text-slate-700">Reports Reviewed</span>
          </div>
          <div className="text-xl font-bold text-slate-900">
            {realReportsCount} verified
          </div>
        </div>

        {/* Card 4: Pending Inquiries */}
        <div className="bg-white rounded-[10px] p-4 border border-stone-200/80 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-semibold text-slate-700">Pending Inquiries</span>
          </div>
          <div className="text-xl font-bold text-slate-900">
            {realPendingCount} in triage
          </div>
        </div>
      </div>

      {/* Main Two-Column Forms Section */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Practitioner Professional Identity */}
        <div className="lg:col-span-8 bg-white rounded-[10px] p-6 border border-stone-200/80 shadow-2xs space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Practitioner Professional Identity
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              Displayed to linked patients and e-prescriptions
            </span>
          </div>

          {/* Form Fields Grid */}
          <div className="space-y-4 pt-2">
            {/* Row 1: Full Name & Specialty */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Full Professional Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Dr. Rishabh Sharma"
                  required
                  className="w-full h-[38px] bg-[#FAFAFA] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Specialty / Clinical Department
                </label>
                <input
                  type="text"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="e.g. General Physician, Cardiologist"
                  required
                  className="w-full h-[38px] bg-[#FAFAFA] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs transition-all"
                />
              </div>
            </div>

            {/* Row 2: Registration & Council */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  MCI / NMC Registration Number
                </label>
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  placeholder="e.g. NMC-294018"
                  className="w-full h-[38px] bg-[#FAFAFA] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs font-mono transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  State Medical Council
                </label>
                <input
                  type="text"
                  value={formData.medicalCouncil}
                  onChange={(e) => setFormData({ ...formData, medicalCouncil: e.target.value })}
                  placeholder="e.g. Delhi Medical Council"
                  className="w-full h-[38px] bg-[#FAFAFA] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs transition-all"
                />
              </div>
            </div>

            {/* Row 3: Phone & Practice Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Direct Clinic Phone
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full h-[38px] bg-[#FAFAFA] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Practice Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. doctor@clinic.com"
                    className="w-full h-[38px] bg-[#FAFAFA] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Medical Qualifications */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Medical Qualifications
              </label>
              <input
                type="text"
                value={formData.qualifications}
                onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                placeholder="e.g. MBBS, MD (General Medicine)"
                className="w-full h-[38px] bg-[#FAFAFA] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs transition-all"
              />
            </div>

            {/* Row 5: Clinical Bio / Summary */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Clinical Bio / Summary
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                placeholder="Brief clinical background and focus areas..."
                className="w-full h-20 bg-[#FAFAFA] border border-slate-200 rounded-[6px] p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white resize-none shadow-2xs transition-all"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Clinic & Practice */}
        <div className="lg:col-span-4 bg-white rounded-[10px] p-6 border border-stone-200/80 shadow-2xs space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-700" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Clinic & Practice
              </h2>
            </div>
            <span className="text-xs text-slate-400">In-person visits</span>
          </div>

          {/* Form Fields */}
          <div className="space-y-4 pt-2">
            {/* Field 1: Clinic Name */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Clinic / Hospital Name
              </label>
              <input
                type="text"
                value={formData.clinicName}
                onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                placeholder="e.g. City Care Health Clinic"
                className="w-full h-[38px] bg-[#FAFAFA] border border-slate-200 rounded-[6px] px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs transition-all"
              />
            </div>

            {/* Field 2: Clinic Physical Address */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Clinic Physical Address
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <textarea
                  value={formData.clinicAddress}
                  onChange={(e) => setFormData({ ...formData, clinicAddress: e.target.value })}
                  placeholder="Full facility address"
                  className="w-full h-18 bg-[#FAFAFA] border border-slate-200 rounded-[6px] pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white resize-none shadow-2xs transition-all"
                />
              </div>
            </div>

            {/* Field 3: Consultation Timings */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Consultation Timings
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={formData.clinicTimings}
                  onChange={(e) => setFormData({ ...formData, clinicTimings: e.target.value })}
                  placeholder="e.g. Mon-Sat: 10am - 7pm"
                  className="w-full h-[38px] bg-[#FAFAFA] border border-slate-200 rounded-[6px] pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs transition-all"
                />
              </div>
            </div>

            {/* Field 4: Consultation Fee */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Consultation Fee (₹)
              </label>
              <div className="relative">
                <span className="text-xs font-semibold text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  ₹
                </span>
                <input
                  type="number"
                  value={formData.consultationFee}
                  onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                  placeholder="800"
                  className="w-full h-[38px] bg-[#FAFAFA] border border-slate-200 rounded-[6px] pl-7 pr-3 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white shadow-2xs transition-all"
                />
              </div>
            </div>

            {/* Field 5: Save Doctor Profile Button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full h-[40px] bg-[#13382E] hover:bg-[#184639] text-white rounded-[6px] text-xs font-bold flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-colors mt-6 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Doctor Profile'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default DoctorProfile;
