import React, { useState, useEffect } from 'react';
import { 
  User, ShieldCheck, Copy, Check, QrCode, Phone, Mail, 
  MapPin, Heart, AlertCircle, Save, CheckCircle, 
  FileText, Pill, Calendar, UserCheck, Stethoscope, Sparkles, Plus, X
} from 'lucide-react';
import { patientProfileApi } from '../../api/client';
import { useStore } from '../../store/useStore';

export const PatientProfile: React.FC = () => {
  const { currentUser, setCurrentUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [newConditionInput, setNewConditionInput] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    rsId: '',
    phone: '',
    email: '',
    age: 25,
    gender: 'Male',
    bloodGroup: 'O+',
    location: '',
    conditions: [] as string[],
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
  });

  const [stats, setStats] = useState({
    reportsCount: 0,
    prescriptionsCount: 0,
    appointmentsCount: 0,
    connectedDoctorsCount: 0,
  });

  const [primaryDoctor, setPrimaryDoctor] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchProfile() {
      try {
        setLoading(true);
        const res = await patientProfileApi.get();
        if (res && res.data && isMounted) {
          const p = res.data;
          setFormData({
            name: p.name || '',
            rsId: p.rsId || '',
            phone: p.phone || '',
            email: p.email || '',
            age: p.age || 25,
            gender: p.gender || 'Male',
            bloodGroup: p.bloodGroup || 'O+',
            location: p.location || '',
            conditions: Array.isArray(p.conditions) ? p.conditions : [],
            emergencyName: p.emergencyContact?.name || '',
            emergencyRelation: p.emergencyContact?.relation || '',
            emergencyPhone: p.emergencyContact?.phone || '',
          });
          if (p.stats) setStats(p.stats);
          if (p.primaryDoctor) setPrimaryDoctor(p.primaryDoctor);
        }
      } catch (err: any) {
        console.warn('Failed to load profile from backend, using store fallback:', err);
        if (currentUser && isMounted) {
          setFormData({
            name: currentUser.name || 'Patient',
            rsId: currentUser.rsId || 'RS-PATIENT',
            phone: currentUser.phone || '',
            email: currentUser.email || '',
            age: currentUser.age || 25,
            gender: currentUser.gender || 'Male',
            bloodGroup: currentUser.bloodGroup || 'O+',
            location: currentUser.location || 'India',
            conditions: Array.isArray(currentUser.conditions) ? currentUser.conditions : [],
            emergencyName: '',
            emergencyRelation: '',
            emergencyPhone: '',
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchProfile();
    return () => { isMounted = false; };
  }, [currentUser]);

  const handleCopyId = () => {
    if (!formData.rsId) return;
    navigator.clipboard.writeText(formData.rsId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleAddCondition = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newConditionInput.trim();
    if (!trimmed) return;
    if (formData.conditions.includes(trimmed)) {
      setNewConditionInput('');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      conditions: [...prev.conditions, trimmed],
    }));
    setNewConditionInput('');
  };

  const handleRemoveCondition = (conditionToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((c) => c !== conditionToRemove),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await patientProfileApi.update({
        name: formData.name,
        age: Number(formData.age),
        gender: formData.gender,
        bloodGroup: formData.bloodGroup,
        conditions: formData.conditions,
        location: formData.location,
        email: formData.email,
        emergencyContact: {
          name: formData.emergencyName,
          relation: formData.emergencyRelation,
          phone: formData.emergencyPhone,
        },
      });

      if (res && res.data) {
        setCurrentUser({ ...currentUser, ...res.data });
      }

      setToastMsg('Patient profile updated successfully!');
      setTimeout(() => setToastMsg(''), 3500);
    } catch (err: any) {
      setToastMsg(err?.message || 'Failed to update profile. Please try again.');
      setTimeout(() => setToastMsg(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-forest-800/20 border-t-forest-900 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading clinical health profile...</p>
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

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-forest-950 font-serif">Universal Health QR</span>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col items-center">
              <div className="w-44 h-44 bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex items-center justify-center">
                <QrCode className="w-36 h-36 text-forest-950" />
              </div>
              <span className="text-xs font-bold font-mono text-forest-900 mt-3">{formData.rsId}</span>
              <span className="text-[10px] text-slate-500">{formData.name} · {formData.bloodGroup}</span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Scan during clinic registration to securely link lab reports with Dr. verified consent.
            </p>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 bg-forest-900 text-accent-teal rounded-xl text-xs font-bold hover:bg-forest-800 transition-colors"
            >
              Close QR Code
            </button>
          </div>
        </div>
      )}

      {/* Hero Profile Overview Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Banner with emerald healthcare gradient */}
        <div className="h-28 bg-gradient-to-r from-[#17382E] via-[#1E3F35] to-[#2B5749] relative px-6 sm:px-8 flex items-end">
          <div className="absolute top-4 right-6 flex items-center gap-2">
            <span className="bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-accent-teal" /> ABDM Compliant
            </span>
          </div>
        </div>

        {/* Profile Identity Bar */}
        <div className="px-6 sm:px-8 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 mb-6">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 rounded-3xl bg-forest-900 text-accent-teal border-4 border-white shadow-md flex items-center justify-center font-bold text-3xl font-serif shrink-0">
                {formData.name.charAt(0) || 'P'}
              </div>
              <div className="mb-1">
                <h1 className="text-xl sm:text-2xl font-bold text-forest-950 font-serif leading-tight">
                  {formData.name || 'Patient Profile'}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {/* Health ID Chip */}
                  <div className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 px-2.5 py-0.5 rounded-lg border border-slate-200/80 text-xs font-mono font-bold transition-colors">
                    <span>{formData.rsId}</span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="text-slate-400 hover:text-slate-700"
                      title="Copy Health ID"
                    >
                      {copiedId ? <Check className="w-3 h-3 text-accent-teal" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  <span className="text-slate-300">·</span>

                  {/* Blood Group Badge */}
                  <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold px-2 py-0.5 rounded-md">
                    <Heart className="w-3 h-3 text-red-600 fill-red-600" /> {formData.bloodGroup}
                  </span>

                  {/* Age & Gender */}
                  <span className="text-xs text-slate-500 font-medium">
                    {formData.age} yrs · {formData.gender}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition-colors shadow-2xs cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-slate-600" /> Digital Card
              </button>
            </div>
          </div>

          {/* Quick Metrics Portfolio Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
            <div className="bg-[#F8FAF9] p-3 rounded-2xl border border-slate-200/60">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold mb-1">
                <FileText className="w-3.5 h-3.5 text-forest-700" /> Lab Reports
              </div>
              <div className="text-lg font-bold text-forest-950 font-serif">{stats.reportsCount} verified</div>
            </div>

            <div className="bg-[#F8FAF9] p-3 rounded-2xl border border-slate-200/60">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold mb-1">
                <Pill className="w-3.5 h-3.5 text-emerald-700" /> Active Prescriptions
              </div>
              <div className="text-lg font-bold text-forest-950 font-serif">{stats.prescriptionsCount} active</div>
            </div>

            <div className="bg-[#F8FAF9] p-3 rounded-2xl border border-slate-200/60">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold mb-1">
                <Calendar className="w-3.5 h-3.5 text-blue-700" /> Appointments
              </div>
              <div className="text-lg font-bold text-forest-950 font-serif">{stats.appointmentsCount} logged</div>
            </div>

            <div className="bg-[#F8FAF9] p-3 rounded-2xl border border-slate-200/60">
              <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold mb-1">
                <UserCheck className="w-3.5 h-3.5 text-amber-700" /> Connected Doctors
              </div>
              <div className="text-lg font-bold text-forest-950 font-serif">{stats.connectedDoctorsCount} clinicians</div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Grid */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) - Personal Information & Demographics */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-forest-800" />
                <h3 className="text-sm font-bold text-slate-900 font-serif">Demographics & Contact Information</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Used in doctor reports & consultation summaries</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Legal Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                  placeholder="e.g. Rishabh Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Universal Health ID (ABDM)</label>
                <input
                  type="text"
                  value={formData.rsId}
                  disabled
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-mono font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Age (Years)</label>
                <input
                  type="number"
                  min="0"
                  max="125"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                  required
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Blood Group</label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50 font-bold text-red-700"
                >
                  {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">City / Location</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full text-xs sm:text-sm p-3 pl-9 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                    placeholder="e.g. New Delhi, India"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Verified Mobile Phone</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formData.phone}
                    disabled
                    className="w-full text-xs sm:text-sm p-3 pl-9 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full text-xs sm:text-sm p-3 pl-9 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                    placeholder="patient@example.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900 font-serif">Emergency Contact</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Notified in critical clinical triage</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Contact Person Name</label>
                <input
                  type="text"
                  value={formData.emergencyName}
                  onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                  placeholder="e.g. Suman Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Relationship</label>
                <input
                  type="text"
                  value={formData.emergencyRelation}
                  onChange={(e) => setFormData({ ...formData, emergencyRelation: e.target.value })}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                  placeholder="e.g. Mother / Spouse"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Emergency Phone</label>
                <input
                  type="tel"
                  value={formData.emergencyPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 bg-slate-50/50"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 Col) - Known Conditions & Care Team */}
        <div className="space-y-6">
          {/* Known Conditions & Allergies */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900 font-serif">Medical Conditions</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Grounded in AI triage</span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Add known chronic ailments, allergies, or past medical histories. These are shared with connected clinicians.
            </p>

            {/* Condition Tags */}
            <div className="flex flex-wrap gap-2 min-h-[48px] p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80">
              {formData.conditions.length > 0 ? (
                formData.conditions.map((cond, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 bg-[#E0F7F5] text-[#0C736A] border border-[#80D7CE] text-xs font-semibold px-3 py-1 rounded-xl shadow-2xs"
                  >
                    <span>{cond}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(cond)}
                      className="hover:text-red-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic py-1 px-1">
                  No declared chronic conditions. Add tags below.
                </span>
              )}
            </div>

            {/* Add Condition Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newConditionInput}
                onChange={(e) => setNewConditionInput(e.target.value)}
                placeholder="e.g. Hypertension, Asthma"
                className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700"
              />
              <button
                type="button"
                onClick={handleAddCondition}
                className="px-3 py-2.5 bg-forest-900 text-accent-teal rounded-xl text-xs font-bold hover:bg-forest-800 transition-colors shrink-0 flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {/* Primary Doctor Care Card */}
          {primaryDoctor && (
            <div className="bg-gradient-to-br from-[#1E3F35] to-[#264E42] rounded-3xl p-6 text-white shadow-xs space-y-3">
              <span className="text-[10px] font-bold tracking-wider uppercase text-accent-teal block">
                Primary Treating Clinician
              </span>

              <div className="flex items-center gap-3 pt-1">
                <div className="w-10 h-10 rounded-full bg-white/10 text-accent-teal font-bold text-sm flex items-center justify-center shrink-0 border border-white/20">
                  <Stethoscope className="w-5 h-5 text-accent-teal" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm font-serif">Dr. {primaryDoctor.name?.replace(/^(Dr\.|Doctor)\s+/i, '')}</h4>
                  <span className="text-xs text-forest-200">{primaryDoctor.specialty}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 text-xs text-forest-100 flex items-center justify-between">
                <span>Direct Clinical Bridge</span>
                <span className="text-accent-teal font-semibold">Active & Verified</span>
              </div>
            </div>
          )}

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
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PatientProfile;
