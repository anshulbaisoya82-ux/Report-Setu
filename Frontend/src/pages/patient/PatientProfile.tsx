import React, { useState, useEffect } from 'react';
import { 
  User, QrCode, Phone, Mail, 
  MapPin, Heart, AlertCircle, Save, CheckCircle, 
  FileText, Pill, Calendar, Users, Edit2, Plus, X,
  Droplet, Check, Home, Copy
} from 'lucide-react';
import { patientProfileApi } from '../../api/client';
import { useStore } from '../../store/useStore';

export const PatientProfile: React.FC = () => {
  const { currentUser, setCurrentUser, reports, prescriptions, appointments } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [copiedRsId, setCopiedRsId] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [newConditionInput, setNewConditionInput] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: 'Rishabh Sharma',
    rsId: 'RS-FTPE4',
    abdmId: 'ABHA-98-7654-3210',
    phone: '+91 98765 43210',
    email: 'rishabh@example.com',
    age: 25,
    gender: 'Male',
    bloodGroup: 'O+',
    location: 'Ghaziabad, Uttar Pradesh',
    conditions: [] as string[],
    emergencyName: 'Suman Sharma',
    emergencyRelation: 'Mother',
    emergencyPhone: '+91 98765 43210',
  });

  const [stats, setStats] = useState({
    reportsCount: 0,
    prescriptionsCount: 0,
    appointmentsCount: 0,
    connectedDoctorsCount: 0,
  });

  useEffect(() => {
    let isMounted = true;
    async function fetchProfile() {
      try {
        setLoading(true);
        const res = await patientProfileApi.get();
        if (res && res.data && isMounted) {
          const p = res.data;
          setFormData((prev) => ({
            ...prev,
            name: p.name || prev.name,
            rsId: p.rsId || prev.rsId,
            abdmId: p.abdmId || prev.abdmId,
            phone: p.phone || prev.phone,
            email: p.email || prev.email,
            age: p.age !== undefined && p.age !== null ? p.age : prev.age,
            gender: p.gender || prev.gender,
            bloodGroup: p.bloodGroup || prev.bloodGroup,
            location: p.location || prev.location,
            conditions: Array.isArray(p.conditions) ? p.conditions : prev.conditions,
            emergencyName: p.emergencyContact?.name || prev.emergencyName,
            emergencyRelation: p.emergencyContact?.relation || prev.emergencyRelation,
            emergencyPhone: p.emergencyContact?.phone || prev.emergencyPhone,
          }));
          if (p.stats) {
            setStats(p.stats);
          }
        }
      } catch (err: any) {
        console.warn('Failed to load profile from backend, using store fallback:', err);
        if (currentUser && isMounted) {
          setFormData((prev) => ({
            ...prev,
            name: currentUser.name || prev.name,
            rsId: (currentUser as any).rsId || prev.rsId,
            phone: (currentUser as any).phone || prev.phone,
            email: currentUser.email || prev.email,
            age: (currentUser as any).age || prev.age,
            gender: (currentUser as any).gender || prev.gender,
            bloodGroup: (currentUser as any).bloodGroup || prev.bloodGroup,
            location: (currentUser as any).location || prev.location,
          }));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchProfile();
    return () => { isMounted = false; };
  }, [currentUser]);

  const handleCopyRsId = () => {
    const idToCopy = formData.rsId || 'RS-FTPE4';
    navigator.clipboard.writeText(idToCopy);
    setCopiedRsId(true);
    setToastMsg(`RS-ID (${idToCopy}) copied to clipboard!`);
    setTimeout(() => setCopiedRsId(false), 2000);
    setTimeout(() => setToastMsg(''), 3000);
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

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const res = await patientProfileApi.update({
        name: formData.name,
        phone: formData.phone,
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
        const p = res.data;
        setCurrentUser({
          ...currentUser,
          ...p,
        });
        setFormData((prev) => ({
          ...prev,
          name: p.name || prev.name,
          phone: p.phone || prev.phone,
          email: p.email || prev.email,
          age: p.age !== undefined && p.age !== null ? p.age : prev.age,
          gender: p.gender || prev.gender,
          bloodGroup: p.bloodGroup || prev.bloodGroup,
          location: p.location || prev.location,
          conditions: Array.isArray(p.conditions) ? p.conditions : prev.conditions,
          emergencyName: p.emergencyContact?.name || prev.emergencyName,
          emergencyRelation: p.emergencyContact?.relation || prev.emergencyRelation,
          emergencyPhone: p.emergencyContact?.phone || prev.emergencyPhone,
        }));
      }

      setIsEditing(false);
      setToastMsg('Profile changes saved and synced in real-time!');
      setTimeout(() => setToastMsg(''), 3000);
    } catch (err: any) {
      setToastMsg(err?.message || 'Failed to update profile.');
      setTimeout(() => setToastMsg(''), 3500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="w-8 h-8 rounded-[3px] border-3 border-[#0E382F]/20 border-t-[#0E382F] animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading patient profile...</p>
      </div>
    );
  }

  // Derive counts live from store or fetched stats
  const displayReportsCount = stats.reportsCount || reports.length;
  const displayPrescriptionsCount = stats.prescriptionsCount || prescriptions.length;
  const displayAppointmentsCount = stats.appointmentsCount || appointments.length;
  const displayConnectedDoctorsCount = stats.connectedDoctorsCount;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-[#0E382F] text-white px-4 py-2 rounded-[3px] shadow-lg flex items-center gap-2 border border-emerald-500/30 text-xs font-semibold animate-in fade-in duration-150">
          <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-[3px] max-w-xs w-full p-5 text-center space-y-3 shadow-xl border border-stone-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <span className="text-xs font-bold text-slate-900 font-sans">Digital Health Card</span>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-[2px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="p-3 bg-stone-50 border border-stone-200/80 rounded-[3px] flex flex-col items-center">
              <div className="w-36 h-36 bg-white rounded-[2px] border border-stone-200 p-2 shadow-2xs flex items-center justify-center">
                <QrCode className="w-32 h-32 text-[#0E382F]" />
              </div>
              <span className="text-xs font-bold font-mono text-[#0E382F] mt-2.5">{formData.rsId}</span>
              <span className="text-[10px] text-slate-500">{formData.name} · {formData.bloodGroup}</span>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              Scan during clinical triage or lab registration to link reports seamlessly.
            </p>
          </div>
        </div>
      )}

      {/* Breadcrumb & Header */}
      <div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-0.5">
          <Home className="w-3.5 h-3.5 text-slate-400" />
          <span>My Profile</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">Patient Profile</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your personal, medical, and emergency information.
        </p>
      </div>

      {/* Top Profile Summary Card */}
      <div className="bg-white rounded-[3px] border border-stone-200/90 p-4 shadow-2xs space-y-4">
        {/* Top Info Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-[3px] bg-[#DFF1E7] text-[#0E382F] font-bold text-xl flex items-center justify-center font-sans shadow-2xs">
              {formData.name ? formData.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">{formData.name}</h2>
                {/* PROMINENT RS-ID BADGE */}
                <span className="font-mono text-[11px] font-bold bg-[#E8F8F3] text-[#136C4F] px-2 py-0.5 rounded-[3px] border border-[#A7E8D0] flex items-center gap-1 shadow-2xs">
                  <span>{formData.rsId}</span>
                  <button
                    type="button"
                    onClick={handleCopyRsId}
                    title="Copy ReportSetu ID"
                    className="text-[#136C4F] hover:text-[#0E382F] cursor-pointer ml-0.5"
                  >
                    {copiedRsId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {formData.age} years <span className="mx-1">·</span> {formData.gender}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FDF2F0] text-[#D92D20] text-[10px] font-semibold rounded-[3px] border border-red-200/50">
                  <Droplet className="w-2.5 h-2.5 fill-current" />
                  {formData.bloodGroup}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EAF6F0] text-[#0E382F] text-[10px] font-semibold rounded-[3px] border border-emerald-200/50">
                  ABDM <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              </div>
            </div>
          </div>

          <div>
            <button
              onClick={() => setShowQrModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] border border-stone-200 text-xs font-medium text-slate-700 bg-white hover:bg-stone-50 shadow-2xs transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-slate-600" />
              <span>Digital Health Card</span>
            </button>
          </div>
        </div>

        {/* 4 Stats Grid */}
        <div className="pt-3 border-t border-stone-100 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 font-medium">Lab Reports</p>
              <p className="text-xs font-bold text-slate-800">{displayReportsCount} verified</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Pill className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 font-medium">Active Prescriptions</p>
              <p className="text-xs font-bold text-slate-800">{displayPrescriptionsCount} active</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 font-medium">Appointments</p>
              <p className="text-xs font-bold text-slate-800">{displayAppointmentsCount} scheduled</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 font-medium">Connected Doctors</p>
              <p className="text-xs font-bold text-slate-800">{displayConnectedDoctorsCount} clinicians</p>
            </div>
          </div>
        </div>
      </div>

      {/* Middle 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Demographics & Contact Information (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-[3px] border border-stone-200/90 p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-900">Demographics & Contact Information</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E382F] hover:underline cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                <span>{isEditing ? 'Cancel Edit' : 'Edit Details'}</span>
              </button>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full h-8 px-2.5 rounded-[3px] border border-stone-200 text-slate-800 focus:outline-none focus:border-[#0E382F] ${
                    isEditing ? 'bg-white ring-1 ring-[#0E382F]/20' : 'bg-stone-50/70 text-slate-700'
                  }`}
                />
              </div>

              {/* REPORTSETU ID FIELD */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  ReportSetu ID (RS-ID)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={formData.rsId}
                    className="w-full h-8 pl-2.5 pr-14 rounded-[3px] border border-emerald-200/80 bg-emerald-50/30 text-[#0E382F] font-mono font-bold text-xs cursor-default"
                  />
                  <button
                    type="button"
                    onClick={handleCopyRsId}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#0E382F] hover:underline flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer"
                  >
                    {copiedRsId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedRsId ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  ABDM / Health ID
                </label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.abdmId}
                  onChange={(e) => setFormData({ ...formData, abdmId: e.target.value })}
                  placeholder="ABHA ID"
                  className={`w-full h-8 px-2.5 rounded-[3px] border border-stone-200 text-slate-800 focus:outline-none focus:border-[#0E382F] ${
                    isEditing ? 'bg-white ring-1 ring-[#0E382F]/20' : 'bg-stone-50/70 text-slate-700'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Age (Years)
                </label>
                <input
                  type="number"
                  min={1}
                  max={130}
                  disabled={!isEditing}
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) || 0 })}
                  className={`w-full h-8 px-2.5 rounded-[3px] border border-stone-200 text-slate-800 focus:outline-none focus:border-[#0E382F] ${
                    isEditing ? 'bg-white ring-1 ring-[#0E382F]/20' : 'bg-stone-50/70 text-slate-700'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Gender
                </label>
                <select
                  disabled={!isEditing}
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className={`w-full h-8 px-2 rounded-[3px] border border-stone-200 text-slate-800 focus:outline-none focus:border-[#0E382F] ${
                    isEditing ? 'bg-white ring-1 ring-[#0E382F]/20' : 'bg-stone-50/70 text-slate-700'
                  }`}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Blood Group
                </label>
                <select
                  disabled={!isEditing}
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  className={`w-full h-8 px-2 rounded-[3px] border border-stone-200 text-slate-800 focus:outline-none focus:border-[#0E382F] ${
                    isEditing ? 'bg-white ring-1 ring-[#0E382F]/20' : 'bg-stone-50/70 text-slate-700'
                  }`}
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  City / Location
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className={`w-full h-8 pl-8 pr-2.5 rounded-[3px] border border-stone-200 text-slate-800 focus:outline-none focus:border-[#0E382F] ${
                      isEditing ? 'bg-white ring-1 ring-[#0E382F]/20' : 'bg-stone-50/70 text-slate-700'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full h-8 pl-8 pr-2.5 rounded-[3px] border border-stone-200 text-slate-800 focus:outline-none focus:border-[#0E382F] ${
                      isEditing ? 'bg-white ring-1 ring-[#0E382F]/20' : 'bg-stone-50/70 text-slate-700'
                    }`}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="email"
                    disabled={!isEditing}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full h-8 pl-8 pr-2.5 rounded-[3px] border border-stone-200 text-slate-800 focus:outline-none focus:border-[#0E382F] ${
                      isEditing ? 'bg-white ring-1 ring-[#0E382F]/20' : 'bg-stone-50/70 text-slate-700'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact Inside Demographics */}
            <div className="pt-3 border-t border-stone-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                  <h4 className="text-xs font-bold text-slate-900">Emergency Contact</h4>
                </div>
                <span className="text-[10px] text-slate-400">Notified in critical clinical triage</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={formData.emergencyName}
                    onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                    className={`w-full h-8 px-2.5 rounded-[3px] border border-stone-200 text-slate-800 focus:outline-none focus:border-[#0E382F] ${
                      isEditing ? 'bg-white ring-1 ring-[#0E382F]/20' : 'bg-stone-50/70 text-slate-700'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Relationship
                  </label>
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={formData.emergencyRelation}
                    onChange={(e) => setFormData({ ...formData, emergencyRelation: e.target.value })}
                    className={`w-full h-8 px-2.5 rounded-[3px] border border-stone-200 text-slate-800 focus:outline-none focus:border-[#0E382F] ${
                      isEditing ? 'bg-white ring-1 ring-[#0E382F]/20' : 'bg-stone-50/70 text-slate-700'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Emergency Phone
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={formData.emergencyPhone}
                      onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                      className={`w-full h-8 pl-8 pr-2.5 rounded-[3px] border border-stone-200 text-slate-800 focus:outline-none focus:border-[#0E382F] ${
                        isEditing ? 'bg-white ring-1 ring-[#0E382F]/20' : 'bg-stone-50/70 text-slate-700'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Medical Conditions & Save (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-[3px] border border-stone-200/90 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-stone-100">
              <div className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-900">Medical Conditions</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E382F] hover:underline cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                <span>{isEditing ? 'Cancel Edit' : 'Edit'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-normal">
              Add known chronic conditions, allergies, or past medical history.
            </p>

            {/* Condition List or Empty State */}
            {formData.conditions.length === 0 ? (
              <div className="border border-dashed border-stone-200 rounded-[3px] p-6 text-center text-slate-400 flex flex-col items-center justify-center space-y-1.5 bg-stone-50/50">
                <div className="w-7 h-7 rounded-[3px] border border-stone-300 flex items-center justify-center text-slate-400">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-xs text-slate-500 font-medium">No medical conditions added</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {formData.conditions.map((cond) => (
                    <span
                      key={cond}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] bg-stone-100 text-slate-800 text-xs font-medium border border-stone-200"
                    >
                      {cond}
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCondition(cond)}
                          className="hover:text-red-500 cursor-pointer ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Add Condition input when editing */}
            {isEditing && (
              <form onSubmit={handleAddCondition} className="flex gap-1.5 pt-1">
                <input
                  type="text"
                  placeholder="e.g. Type 2 Diabetes, Allergy"
                  value={newConditionInput}
                  onChange={(e) => setNewConditionInput(e.target.value)}
                  className="flex-1 h-8 px-2.5 rounded-[3px] border border-stone-200 text-xs focus:outline-none focus:border-[#0E382F]"
                />
                <button
                  type="submit"
                  className="px-2.5 h-8 bg-[#0E382F] text-white rounded-[3px] text-xs font-semibold hover:bg-[#092720] cursor-pointer"
                >
                  Add
                </button>
              </form>
            )}
          </div>

          {/* Save Profile Changes Button */}
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave()}
            className="w-full bg-[#0E382F] text-white rounded-[3px] py-2 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#092720] transition-colors shadow-2xs cursor-pointer disabled:opacity-70"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving changes...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
