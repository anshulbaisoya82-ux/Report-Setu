import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, ShieldCheck, CheckCircle, Save, 
  Phone, Mail, MapPin, Building, Clock, DollarSign,
  Award, Users, Calendar, FileText, MessageSquare, AlertCircle
} from 'lucide-react';
import { doctorProfileApi } from '../../api/client';
import { useStore } from '../../store/useStore';

export const DoctorProfile: React.FC = () => {
  const { logout } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    phone: '',
    email: '',
    registrationNumber: '',
    medicalCouncil: '',
    verificationStatus: 'verified',
    verifiedAt: '',
    clinicName: '',
    clinicAddress: '',
    clinicPhone: '',
    clinicTimings: '',
    consultationFee: '800',
    qualifications: 'MBBS, MD (General Medicine)',
    bio: 'Dedicated to evidence-based preventive care and comprehensive chronic illness management.',
  });

  const [stats, setStats] = useState({
    activePatientsCount: 0,
    appointmentsCount: 0,
    prescriptionsIssuedCount: 0,
    reportsReviewedCount: 0,
    pendingQuestionsCount: 0,
  });

  useEffect(() => {
    let isMounted = true;
    async function fetchDoctor() {
      try {
        setLoading(true);
        const res = await doctorProfileApi.get();
        if (res && res.data && isMounted) {
          const d = res.data;
          const clinic = d.clinic || {};
          setFormData({
            name: d.name || '',
            specialty: d.specialty || 'General Physician',
            phone: d.phone || '',
            email: d.email || '',
            registrationNumber: d.registrationNumber || '',
            medicalCouncil: d.medicalCouncil || 'State Medical Council',
            verificationStatus: d.verificationStatus || 'verified',
            verifiedAt: d.verifiedAt || '',
            clinicName: clinic.name || 'City Care Health Clinic',
            clinicAddress: clinic.address || 'Suite 402, Medical Enclave, New Delhi',
            clinicPhone: clinic.phone || d.phone || '',
            clinicTimings: clinic.timings || 'Mon - Sat: 10:00 AM - 02:00 PM, 05:00 PM - 08:30 PM',
            consultationFee: String(clinic.consultationFee || '800'),
            qualifications: d.qualifications || 'MBBS, MD (General Medicine)',
            bio: d.bio || 'Dedicated to evidence-based preventive care and comprehensive chronic illness management.',
          });
          if (d.stats) setStats(d.stats);
        }
      } catch (err: any) {
        console.warn('Failed to load doctor profile from backend:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchDoctor();
    return () => { isMounted = false; };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await doctorProfileApi.update({
        name: formData.name,
        specialty: formData.specialty,
        phone: formData.phone,
        medicalCouncil: formData.medicalCouncil,
        registrationNumber: formData.registrationNumber,
        clinic: {
          name: formData.clinicName,
          address: formData.clinicAddress,
          phone: formData.clinicPhone,
          timings: formData.clinicTimings,
          consultationFee: Number(formData.consultationFee) || 800,
        },
        qualifications: formData.qualifications,
        bio: formData.bio,
      });

      setToastMsg('Doctor profile and practice info updated successfully!');
      setTimeout(() => setToastMsg(''), 3500);
    } catch (err: any) {
      setToastMsg(err?.message || 'Failed to update doctor profile. Please try again.');
      setTimeout(() => setToastMsg(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'DR';
    return name
      .replace(/^(Dr\.|Doctor)\s+/i, '')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-forest-800/20 border-t-forest-900 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading practitioner credentials...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-[#1E3F35] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-forest-600/40 animate-in fade-in duration-200">
          <CheckCircle className="w-4 h-4 text-accent-teal" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Hero Overview Banner Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Banner with dark forest healthcare gradient */}
        <div className="h-28 bg-gradient-to-r from-[#1E3F35] via-[#244E42] to-[#172B25] relative px-6 sm:px-8 flex items-end">
          <div className="absolute top-4 right-6 flex items-center gap-2">
            <span className="bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-accent-teal" /> Verified Clinician
            </span>
          </div>
        </div>

        {/* Identity Details */}
        <div className="px-6 sm:px-8 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-6">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 rounded-3xl bg-forest-900 text-accent-teal border-4 border-white shadow-md flex items-center justify-center font-bold text-3xl font-serif shrink-0">
                {getInitials(formData.name)}
              </div>
              <div className="mb-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-forest-950 font-serif leading-tight">
                    Dr. {formData.name?.replace(/^(Dr\.|Doctor)\s+/i, '') || 'Rishabh'}
                  </h1>
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3 text-emerald-700" /> NMC Verified
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500 font-medium">
                  <span className="text-forest-900 font-semibold">{formData.specialty}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-slate-600">Reg: {formData.registrationNumber || 'NMC-PENDING'}</span>
                  <span className="text-slate-300">·</span>
                  <span>{formData.medicalCouncil}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Clinical Activity Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
            <div className="bg-[#F8FAF9] p-3 rounded-2xl border border-slate-200/60">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold mb-1">
                <Users className="w-3.5 h-3.5 text-forest-700" /> Connected Patients
              </div>
              <div className="text-lg font-bold text-forest-950 font-serif">{stats.activePatientsCount} active</div>
            </div>

            <div className="bg-[#F8FAF9] p-3 rounded-2xl border border-slate-200/60">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold mb-1">
                <Calendar className="w-3.5 h-3.5 text-blue-700" /> Total Appointments
              </div>
              <div className="text-lg font-bold text-forest-950 font-serif">{stats.appointmentsCount} scheduled</div>
            </div>

            <div className="bg-[#F8FAF9] p-3 rounded-2xl border border-slate-200/60">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold mb-1">
                <FileText className="w-3.5 h-3.5 text-emerald-700" /> Reports Reviewed
              </div>
              <div className="text-lg font-bold text-forest-950 font-serif">{stats.reportsReviewedCount} verified</div>
            </div>

            <div className="bg-[#F8FAF9] p-3 rounded-2xl border border-slate-200/60">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-amber-700" /> Pending Inquiries
              </div>
              <div className="text-lg font-bold text-forest-950 font-serif">{stats.pendingQuestionsCount} in triage</div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols - Practitioner Information */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-forest-800" />
                <h3 className="text-sm font-bold text-slate-900 font-serif">Practitioner Professional Identity</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Displayed to linked patients and e-prescriptions</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Professional Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                  placeholder="e.g. Dr. Rishabh Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Specialty / Clinical Department</label>
                <input
                  type="text"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  required
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                  placeholder="e.g. General Physician, Cardiologist"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">MCI / NMC Registration Number</label>
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 bg-slate-50/50 font-mono font-semibold"
                  placeholder="e.g. NMC-294018"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">State Medical Council</label>
                <input
                  type="text"
                  value={formData.medicalCouncil}
                  onChange={(e) => setFormData({ ...formData, medicalCouncil: e.target.value })}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 bg-slate-50/50"
                  placeholder="e.g. Delhi Medical Council"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Direct Clinic Phone</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full text-xs sm:text-sm p-3 pl-9 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Practice Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full text-xs sm:text-sm p-3 pl-9 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Medical Qualifications</label>
                <input
                  type="text"
                  value={formData.qualifications}
                  onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                  placeholder="e.g. MBBS, MD (General Medicine), DNB"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Clinical Bio / Summary</label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                  placeholder="Brief clinical background and focus areas..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col - Clinic & Consultation Setup */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-forest-800" />
                <h3 className="text-sm font-bold text-slate-900 font-serif">Clinic & Practice</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">In-person visits</span>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic / Hospital Name</label>
                <input
                  type="text"
                  value={formData.clinicName}
                  onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                  placeholder="e.g. City Care Health Clinic"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic Physical Address</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                  <textarea
                    rows={2}
                    value={formData.clinicAddress}
                    onChange={(e) => setFormData({ ...formData, clinicAddress: e.target.value })}
                    className="w-full text-xs p-2.5 pl-8 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                    placeholder="Full facility address"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Consultation Timings</label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formData.clinicTimings}
                    onChange={(e) => setFormData({ ...formData, clinicTimings: e.target.value })}
                    className="w-full text-xs p-2.5 pl-8 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                    placeholder="e.g. Mon-Sat: 10am - 7pm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Consultation Fee (₹)</label>
                <div className="relative">
                  <span className="text-xs font-bold text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">₹</span>
                  <input
                    type="number"
                    value={formData.consultationFee}
                    onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                    className="w-full text-xs p-2.5 pl-7 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50 font-semibold"
                    placeholder="800"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className={`w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all ${
              saving
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-forest-900 text-accent-teal hover:bg-forest-800 active:scale-98 cursor-pointer'
            }`}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-slate-500/30 border-t-slate-600 animate-spin" />
                <span>Saving Credentials...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Doctor Profile</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DoctorProfile;
