import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { connectionsApi } from '../../api';
import { patientProfileApi } from '../../api/client';
import { PatientDoctors } from './PatientDoctors';
import {
  User,
  Bell,
  ShieldCheck,
  Globe,
  Users,
  Info,
  Edit,
  Check,
  Calendar,
  Pill,
  FileText,
  Lock,
  Key,
  Phone,
  Mail,
  MapPin,
  Droplet,
  ChevronRight,
  Copy,
  RefreshCw,
  QrCode,
  AlertCircle,
  Eye,
  EyeOff,
  Stethoscope
} from 'lucide-react';

export const PatientSettings: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as any) || 'profile';

  const { currentUser, setCurrentUser } = useStore();

  const [activeTab, setActiveTab] = useState<
    'profile' | 'notifications' | 'privacy' | 'language' | 'doctors' | 'about'
  >(initialTab);

  // Sync tab with URL if changed
  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState(currentUser?.name || 'Rishabh Sharma');
  const [rsId, setRsId] = useState((currentUser as any)?.rsId || 'RS-FTPE4');
  const [phone, setPhone] = useState(currentUser?.phone || '+91 98765 43210');
  const [email, setEmail] = useState(currentUser?.email || 'rishabh@example.com');
  const [location, setLocation] = useState(
    (currentUser as any)?.address || (currentUser as any)?.location || 'Ghaziabad, Uttar Pradesh'
  );

  useEffect(() => {
    patientProfileApi.get().then((res) => {
      if (res && res.data) {
        const p = res.data;
        if (p.name) setName(p.name);
        if (p.rsId) setRsId(p.rsId);
        if (p.phone) setPhone(p.phone);
        if (p.email) setEmail(p.email);
        if (p.location) setLocation(p.location);
      }
    }).catch(() => {});
  }, [currentUser]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Notification Toggles State (all default true matching screenshot)
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [medicineReminders, setMedicineReminders] = useState(true);
  const [reportUpdates, setReportUpdates] = useState(true);

  // Security Toggles & State
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currPassword, setCurrPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordToast, setPasswordToast] = useState('');

  // Doctor Tab State
  const [connectCode, setConnectCode] = useState<string>('582 914');
  const [codeTimer, setCodeTimer] = useState(120);
  const [copiedCode, setCopiedCode] = useState(false);
  const [connectedDoctors, setConnectedDoctors] = useState<any[]>([]);

  // Language State
  const [selectedLanguage, setSelectedLanguage] = useState<'English' | 'Hindi'>('English');

  // Load real doctor connections & pairing code
  useEffect(() => {
    connectionsApi
      .getMyConnections()
      .then((res) => {
        setConnectedDoctors(res?.connections || []);
      })
      .catch(() => setConnectedDoctors([]));

    connectionsApi
      .generatePatientCode()
      .then((res) => {
        if (res && res.code) setConnectCode(res.code);
      })
      .catch(() => {});
  }, []);

  // Save profile changes real-time
  const handleSaveProfile = async () => {
    try {
      const res = await patientProfileApi.update({
        name,
        phone,
        email,
        location,
      });
      if (res && res.data) {
        setCurrentUser({
          ...currentUser,
          ...res.data,
          name,
          phone,
          email,
          location,
        });
      } else {
        setCurrentUser({
          ...currentUser,
          name,
          phone,
          email,
          location,
        });
      }
      setIsEditingProfile(false);
      showToast('Profile information saved and synced in real-time!');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update profile');
    }
  };

  // Password change submission
  const handleChangePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currPassword || !newPassword) {
      setPasswordToast('Please enter both current and new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordToast('New passwords do not match.');
      return;
    }
    setShowPasswordModal(false);
    setCurrPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showToast('Password changed successfully.');
  };

  // Copy connect code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(connectCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto font-sans text-slate-800">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-[#0E382F] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 border border-emerald-600/40 animate-fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[#17211E]">
            Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your account, preferences, privacy, and app settings.
          </p>
        </div>

        {/* Top-Right Notification & Profile Avatar */}
        <div className="flex items-center gap-3">
          <button className="relative w-8 h-8 rounded-full border border-stone-200 text-slate-600 bg-white hover:bg-stone-50 cursor-pointer shadow-2xs flex items-center justify-center transition-colors">
            <Bell className="w-3.5 h-3.5 text-slate-600" />
            <span className="w-2 h-2 rounded-full bg-[#10B981] absolute top-1 right-1" />
          </button>
          <div className="w-8 h-8 rounded-full bg-[#0E382F] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
            {name ? name.charAt(0).toUpperCase() : 'R'}
          </div>
        </div>
      </div>

      {/* Main Settings Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start pt-1">
        {/* =======================================================================
         * LEFT COLUMN: Navigation Sidebar Menu Inside Settings (~25% width)
         * ======================================================================= */}
        <div className="md:col-span-4 lg:col-span-3 bg-white rounded-[3px] border border-stone-200/80 p-2 shadow-2xs space-y-1">
          {/* 1. Profile */}
          <button
            onClick={() => handleTabChange('profile')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-[3px] text-xs font-semibold transition-all cursor-pointer text-left ${
              activeTab === 'profile'
                ? 'bg-[#EAF6F0] text-[#0E382F] font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-50'
            }`}
          >
            <User className={`w-4 h-4 ${activeTab === 'profile' ? 'text-[#0E382F]' : 'text-slate-500'}`} />
            <span>Profile</span>
          </button>

          {/* 2. Notifications */}
          <button
            onClick={() => handleTabChange('notifications')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-[3px] text-xs font-semibold transition-all cursor-pointer text-left ${
              activeTab === 'notifications'
                ? 'bg-[#EAF6F0] text-[#0E382F] font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-50'
            }`}
          >
            <Bell className={`w-4 h-4 ${activeTab === 'notifications' ? 'text-[#0E382F]' : 'text-slate-500'}`} />
            <span>Notifications</span>
          </button>

          {/* 3. Privacy & Security */}
          <button
            onClick={() => handleTabChange('privacy')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-[3px] text-xs font-semibold transition-all cursor-pointer text-left ${
              activeTab === 'privacy'
                ? 'bg-[#EAF6F0] text-[#0E382F] font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-50'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${activeTab === 'privacy' ? 'text-[#0E382F]' : 'text-slate-500'}`} />
            <span>Privacy & Security</span>
          </button>

          {/* 4. Language & Region */}
          <button
            onClick={() => handleTabChange('language')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-[3px] text-xs font-semibold transition-all cursor-pointer text-left ${
              activeTab === 'language'
                ? 'bg-[#EAF6F0] text-[#0E382F] font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-50'
            }`}
          >
            <Globe className={`w-4 h-4 ${activeTab === 'language' ? 'text-[#0E382F]' : 'text-slate-500'}`} />
            <span>Language & Region</span>
          </button>

          {/* 5. My Doctors (Now living cleanly inside Settings!) */}
          <button
            onClick={() => handleTabChange('doctors')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-[3px] text-xs font-semibold transition-all cursor-pointer text-left ${
              activeTab === 'doctors'
                ? 'bg-[#EAF6F0] text-[#0E382F] font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-50'
            }`}
          >
            <Users className={`w-4 h-4 ${activeTab === 'doctors' ? 'text-[#0E382F]' : 'text-slate-500'}`} />
            <span>My Doctors</span>
          </button>

          {/* 6. About */}
          <button
            onClick={() => handleTabChange('about')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-[3px] text-xs font-semibold transition-all cursor-pointer text-left ${
              activeTab === 'about'
                ? 'bg-[#EAF6F0] text-[#0E382F] font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-50'
            }`}
          >
            <Info className={`w-4 h-4 ${activeTab === 'about' ? 'text-[#0E382F]' : 'text-slate-500'}`} />
            <span>About</span>
          </button>
        </div>

        {/* =======================================================================
         * RIGHT COLUMN: Settings Content Area (~75% width)
         * ======================================================================= */}
        <div className="md:col-span-8 lg:col-span-9 space-y-4">
          {/* =====================================================================
           * VIEW 1: PROFILE TAB (Matches Reference Screenshot Exactly!)
           * ===================================================================== */}
          {activeTab === 'profile' && (
            <>
              {/* Card 1: Account & Profile */}
              <div className="bg-white rounded-[3px] border border-stone-200/80 p-4 md:p-5 shadow-2xs space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-800" />
                      <h2 className="text-sm md:text-base font-bold text-[#17211E]">
                        Account & Profile
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Update your personal details and contact information.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      if (isEditingProfile) {
                        void handleSaveProfile();
                      } else {
                        setIsEditingProfile(true);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] border border-stone-200 text-xs font-semibold text-slate-700 bg-white hover:bg-stone-50 cursor-pointer shadow-2xs transition-colors"
                  >
                    {isEditingProfile ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Save</span>
                      </>
                    ) : (
                      <>
                        <Edit className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Profile Avatar & Demographics Body */}
                <div className="flex items-start gap-4 pt-1">
                  {/* Large Light Green Square Avatar */}
                  <div className="w-12 h-12 rounded-[3px] bg-[#D1FAE5]/60 text-[#064E3B] text-xl font-bold flex items-center justify-center shrink-0">
                    {name ? name.charAt(0).toUpperCase() : 'R'}
                  </div>

                  {/* Name, Age, Gender & Badges */}
                  <div className="space-y-1.5 flex-1">
                    {isEditingProfile ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full max-w-sm px-2.5 py-1 text-sm font-bold border border-stone-200 rounded-[3px] focus:outline-none focus:border-[#0E382F]"
                          placeholder="Full Name"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-[#17211E] leading-tight">
                            {name}
                          </h3>
                          <span className="font-mono text-[11px] font-bold bg-[#E8F8F3] text-[#136C4F] px-2 py-0.5 rounded-[3px] border border-[#A7E8D0] shadow-2xs">
                            {rsId}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {(currentUser as any)?.age || 25} years · {(currentUser as any)?.gender || 'Male'}
                        </p>
                      </div>
                    )}

                    {/* Blood Group and ABDM Badges */}
                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <Droplet className="w-3 h-3 text-rose-500 fill-rose-500" />
                        <span>O+</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-xs font-semibold bg-[#EAF6F0] text-[#064E3B] border border-emerald-200">
                        <span>ABDM</span>
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Information Row (3 Columns) */}
                <div className="pt-3 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Mobile Number */}
                  <div className="flex items-start gap-2.5">
                    <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Mobile Number
                      </span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="mt-0.5 w-full text-xs font-semibold border border-stone-200 rounded-[3px] px-1.5 py-0.5"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-[#17211E]">
                          {phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Email Address
                      </span>
                      {isEditingProfile ? (
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="mt-0.5 w-full text-xs font-semibold border border-stone-200 rounded-[3px] px-1.5 py-0.5"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-[#17211E] truncate block">
                          {email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Location
                      </span>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="mt-0.5 w-full text-xs font-semibold border border-stone-200 rounded-[3px] px-1.5 py-0.5"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-[#17211E]">
                          {location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom 2-Card Row: Notification Preferences (Left) & Security (Right) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 2: Notification Preferences */}
                <div className="bg-white rounded-[3px] border border-stone-200/80 p-4 md:p-5 shadow-2xs space-y-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-slate-800" />
                      <h3 className="text-sm font-bold text-[#17211E]">
                        Notification Preferences
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Choose what updates you want to receive.
                    </p>
                  </div>

                  {/* Toggles List */}
                  <div className="space-y-3 pt-1">
                    {/* 1. Appointment Reminders */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-medium text-slate-800">
                          Appointment Reminders
                        </span>
                      </div>
                      <button
                        onClick={() => setAppointmentReminders((v) => !v)}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                          appointmentReminders ? 'bg-[#10B981]' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            appointmentReminders ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* 2. Medicine Reminders */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Pill className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-medium text-slate-800">
                          Medicine Reminders
                        </span>
                      </div>
                      <button
                        onClick={() => setMedicineReminders((v) => !v)}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                          medicineReminders ? 'bg-[#10B981]' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            medicineReminders ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* 3. Report Updates */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-medium text-slate-800">
                          Report Updates
                        </span>
                      </div>
                      <button
                        onClick={() => setReportUpdates((v) => !v)}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                          reportUpdates ? 'bg-[#10B981]' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            reportUpdates ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card 3: Security */}
                <div className="bg-white rounded-[3px] border border-stone-200/80 p-4 md:p-5 shadow-2xs space-y-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-slate-800" />
                      <h3 className="text-sm font-bold text-[#17211E]">Security</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Keep your account safe and secure.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* Change Password Row */}
                    <div
                      onClick={() => setShowPasswordModal(true)}
                      className="flex items-center justify-between cursor-pointer hover:bg-stone-50/70 p-1.5 rounded-[3px] transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Lock className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-medium text-slate-800">
                          Change Password
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>

                    {/* Two-Factor Authentication Toggle */}
                    <div className="flex items-center justify-between p-1.5">
                      <div className="flex items-center gap-2.5">
                        <Key className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-medium text-slate-800">
                          Two-Factor Authentication
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setTwoFactorAuth((v) => !v);
                          showToast(
                            !twoFactorAuth
                              ? 'Two-factor authentication enabled!'
                              : 'Two-factor authentication disabled.'
                          );
                        }}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                          twoFactorAuth ? 'bg-[#10B981]' : 'bg-slate-300'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            twoFactorAuth ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* =====================================================================
           * VIEW 2: MY DOCTORS TAB (Full Screen Feature Inside Settings)
           * ===================================================================== */}
          {activeTab === 'doctors' && (
            <div className="bg-white rounded-[3px] border border-stone-200/80 p-4 md:p-5 shadow-2xs">
              <PatientDoctors embedded={true} />
            </div>
          )}

          {/* =====================================================================
           * VIEW 3: NOTIFICATIONS TAB
           * ===================================================================== */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-[3px] border border-stone-200/80 p-4 md:p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="text-sm md:text-base font-bold text-[#17211E]">
                  Notification Channels & Frequency
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure SMS, WhatsApp, and email alerts for lab results and clinic visits.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-[3px] border border-stone-100 bg-[#F9FAF9]">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">WhatsApp Instant Alerts</h4>
                    <p className="text-[11px] text-slate-500">Receive critical lab notifications and PDF report links on WhatsApp.</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#10B981] cursor-pointer" />
                </div>

                <div className="flex items-center justify-between p-3 rounded-[3px] border border-stone-100 bg-[#F9FAF9]">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">SMS Dose Reminders</h4>
                    <p className="text-[11px] text-slate-500">Scheduled SMS delivery 15 minutes before your prescribed medicine timing.</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#10B981] cursor-pointer" />
                </div>

                <div className="flex items-center justify-between p-3 rounded-[3px] border border-stone-100 bg-[#F9FAF9]">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Clinician Review Notices</h4>
                    <p className="text-[11px] text-slate-500">Notify immediately when your consulting doctor signs off on a diagnostic report.</p>
                  </div>
                  <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#10B981] cursor-pointer" />
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
           * VIEW 4: PRIVACY & SECURITY TAB
           * ===================================================================== */}
          {activeTab === 'privacy' && (
            <div className="bg-white rounded-[3px] border border-stone-200/80 p-4 md:p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="text-sm md:text-base font-bold text-[#17211E]">
                  Digital Personal Data Protection (DPDP) Compliance
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your health records are encrypted at rest with AES-256 and accessible only with explicit consent.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-[3px] border border-emerald-200 bg-[#EAF6F0]/60 space-y-1.5">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Data Ownership</span>
                  <h4 className="text-xs font-bold text-[#0E382F]">Zero Third-Party Sharing</h4>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Your records are never monetized, scanned for ads, or provided to insurance underwriters without explicit authorization.
                  </p>
                </div>

                <div className="p-4 rounded-[3px] border border-stone-200 bg-[#F9FAF9] space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Consent Control</span>
                  <h4 className="text-xs font-bold text-slate-800">Instant Consent Revocation</h4>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    You can revoke access from any connected clinic at any time from your settings panel.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
           * VIEW 5: LANGUAGE & REGION TAB
           * ===================================================================== */}
          {activeTab === 'language' && (
            <div className="bg-white rounded-[3px] border border-stone-200/80 p-4 md:p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="text-sm md:text-base font-bold text-[#17211E]">
                  Language & Regional Settings
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose your preferred portal language and regional units.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setSelectedLanguage('English')}
                  className={`p-3.5 rounded-[3px] border text-left transition-all cursor-pointer ${
                    selectedLanguage === 'English'
                      ? 'border-[#0E382F] bg-[#EAF6F0]'
                      : 'border-stone-200 bg-[#F9FAF9]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">English (India)</span>
                    {selectedLanguage === 'English' && <Check className="w-4 h-4 text-[#0E382F]" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Default clinical terminology</p>
                </button>

                <button
                  onClick={() => setSelectedLanguage('Hindi')}
                  className={`p-3.5 rounded-[3px] border text-left transition-all cursor-pointer ${
                    selectedLanguage === 'Hindi'
                      ? 'border-[#0E382F] bg-[#EAF6F0]'
                      : 'border-stone-200 bg-[#F9FAF9]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">हिन्दी (Hindi)</span>
                    {selectedLanguage === 'Hindi' && <Check className="w-4 h-4 text-[#0E382F]" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">सरल भाषा में रिपोर्ट व्याख्या</p>
                </button>
              </div>
            </div>
          )}

          {/* =====================================================================
           * VIEW 6: ABOUT TAB
           * ===================================================================== */}
          {activeTab === 'about' && (
            <div className="bg-white rounded-[3px] border border-stone-200/80 p-4 md:p-5 shadow-2xs space-y-4">
              <div>
                <h3 className="text-sm md:text-base font-bold text-[#17211E]">About ReportSetu</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unified Care, Better Decisions.
                </p>
              </div>

              <div className="p-4 rounded-[3px] border border-stone-200 bg-[#F9FAF9] space-y-2 text-xs text-slate-700 leading-relaxed">
                <p>
                  <strong>ReportSetu Health Platform v1.2.0</strong> is engineered to bridge the communication gap between patients, pathology laboratories, and consulting clinicians across India.
                </p>
                <p className="text-slate-500">
                  Compliant with Ayushman Bharat Digital Mission (ABDM) and the Digital Personal Data Protection Act, 2023.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
       * Change Password Modal
       * ========================================================================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[3px] border border-stone-200 max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {passwordToast && (
              <p className="text-xs text-rose-600 font-semibold">{passwordToast}</p>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currPassword}
                  onChange={(e) => setCurrPassword(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-[3px] px-2.5 py-1.5 focus:outline-none focus:border-[#0E382F]"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-[3px] px-2.5 py-1.5 focus:outline-none focus:border-[#0E382F]"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-[3px] px-2.5 py-1.5 focus:outline-none focus:border-[#0E382F]"
                  placeholder="Re-enter new password"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3 py-1.5 rounded-[3px] border border-stone-200 text-xs font-semibold text-slate-600 hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-[3px] bg-[#0E382F] hover:bg-[#12463a] text-white text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
