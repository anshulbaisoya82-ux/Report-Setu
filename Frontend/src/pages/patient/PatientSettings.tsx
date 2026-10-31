import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { connectionsApi } from '../../api';
import { 
  ShieldCheck, Copy, Check, RefreshCw, QrCode, 
  Trash2, Bell, Globe, CheckCircle
} from 'lucide-react';

export const PatientSettings: React.FC = () => {
  const { currentUser, patients } = useStore();
  const currentPatient = currentUser || patients[0];
  const [copiedId, setCopiedId] = useState(false);
  const [connectCode, setConnectCode] = useState<string | null>(null);
  const [codeTimer, setCodeTimer] = useState(0);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');

  // Notification toggles
  const [waAlerts, setWaAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [medReminders, setMedReminders] = useState(true);

  // Connected Doctors List
  const [connectedDoctors, setConnectedDoctors] = useState<any[]>([]);

  const [toastMsg, setToastMsg] = useState('');

  const calculateRemainingSeconds = (expiresAtStr?: string) => {
    if (!expiresAtStr) return 600;
    const diffSec = Math.floor((new Date(expiresAtStr).getTime() - Date.now()) / 1000);
    return diffSec > 0 ? diffSec : 600;
  };

  useEffect(() => {
    Promise.all([connectionsApi.generatePatientCode(), connectionsApi.getMyConnections()])
      .then(([codeRes, connectionRes]) => {
        const res = codeRes;
        if (res?.code) {
          setConnectCode(res.code);
          setCodeTimer(calculateRemainingSeconds(res.expiresAt));
        }
        setConnectedDoctors(connectionRes.connections || []);
      })
      .catch((error) => setToastMsg(error instanceof Error ? error.message : 'Unable to load connection settings.'));
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleRegenerateCode = async () => {
    try {
      const res = await connectionsApi.generatePatientCode();
      if (res?.code) {
        setConnectCode(res.code);
        setCodeTimer(calculateRemainingSeconds(res.expiresAt));
        setToastMsg('Generated a new doctor connection code.');
        setTimeout(() => setToastMsg(''), 3000);
        return;
      }
    } catch {
      // graceful fallback
    }
    setToastMsg('Unable to generate a connection code. Please try again.');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleRevoke = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to revoke health record access for ${name}?`)) {
      connectionsApi.revokeDoctorConnection(id)
        .then(() => {
          setConnectedDoctors(prev => prev.filter(d => d.id !== id && d.doctorId !== id));
          setToastMsg(`Access revoked for ${name}.`);
          setTimeout(() => setToastMsg(''), 3000);
        })
        .catch((error) => setToastMsg(error instanceof Error ? error.message : 'Unable to revoke access.'));
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-[#1E3F35] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-forest-700 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-accent-teal" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h1 className="text-2xl font-bold text-forest-950 font-serif tracking-tight">Account & Security Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Control your Universal Health ID, clinic pairing codes, consent permissions, and notifications
        </p>
      </div>

      {/* Universal Patient ID & Instant In-Clinic Connect Code */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Universal ID Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-forest-700" />
              <h3 className="text-sm font-bold text-slate-900 font-serif">Universal Setu Health ID</h3>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
              ABDM Compliant
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Your Unique Identifier</span>
            <div className="text-3xl font-extrabold font-mono text-forest-950 tracking-wider">
              {currentPatient?.rsId || 'Not available'}
            </div>
            <p className="text-xs text-slate-500">
              {currentPatient ? `${currentPatient.name} · ${currentPatient.age || '—'}y / ${currentPatient.gender || '—'} · Blood: ${currentPatient.bloodGroup || '—'}` : 'Patient profile is loading'}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => currentPatient?.rsId && handleCopy(currentPatient.rsId)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-2xs"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-accent-teal" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              {copiedId ? 'Copied ID' : 'Copy Health ID'}
            </button>

            <button
              onClick={() => setToastMsg('QR code generation is not available yet. Use the Health ID copy action.')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-forest-900 bg-forest-50 border border-forest-200 rounded-xl hover:bg-forest-100"
            >
              <QrCode className="w-3.5 h-3.5 text-forest-800" /> View QR Code
            </button>
          </div>
        </div>

        {/* Temporary Doctor Connect Code (Figma highlight) */}
        <div className="bg-[#1E3F35] bg-gradient-to-br from-[#1E3F35] to-[#264E42] rounded-2xl p-5 text-white shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-[10px] font-bold tracking-wider uppercase text-accent-teal">
              In-Clinic Pairing Code
            </span>
            <span className="text-xs text-forest-200 flex items-center gap-1">
              Expires in {Math.floor(codeTimer / 60)}:{(codeTimer % 60).toString().padStart(2, '0')}
            </span>
          </div>

          <div className="text-center space-y-1.5 py-1">
            <span className="text-xs text-forest-100">Tell your doctor's receptionist:</span>
            <div className="text-3xl font-mono font-extrabold text-white tracking-widest bg-white/10 py-2.5 px-4 rounded-xl border border-white/15">
              {connectCode}
            </div>
            <p className="text-[11px] text-forest-200">
              Allows any authorized clinic to securely pull your report history for 1 consultation.
            </p>
          </div>

          <button
            onClick={handleRegenerateCode}
            className="w-full py-2.5 px-4 bg-white/15 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 border border-white/20"
          >
            <RefreshCw className="w-3.5 h-3.5 text-accent-teal" /> Generate Fresh 10-Minute Code
          </button>
        </div>
      </div>

      {/* Connected Doctors & Consented Access Management */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-serif">Authorized Healthcare Providers</h3>
            <p className="text-xs text-slate-500">
              Doctors who currently have your explicit digital consent to access your lab records
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/patient/doctors'}
            className="text-xs font-bold text-[#1E3F35] hover:underline"
          >
            Manage in My Doctors →
          </button>
        </div>

        <div className="space-y-3">
          {connectedDoctors.map(doc => (
            <div 
              key={doc.id}
              className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 font-serif">{doc.name}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                    Consented
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{doc.hospital}</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                  <span>Scope: {doc.access}</span>
                  <span>·</span>
                  <span>Granted: {doc.grantedDate}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRevoke(doc.doctorId, doc.name)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors self-start sm:self-center"
              >
                <Trash2 className="w-3.5 h-3.5" /> Revoke Access
              </button>
            </div>
          ))}

          {connectedDoctors.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">No connected doctors. Your records are private.</p>
          )}
        </div>
      </div>

      {/* Language & Interface Preferences */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-serif">Language / भाषा</h3>
            <p className="text-xs text-slate-500">Choose the language for AI report explanations and notifications</p>
          </div>
          <Globe className="w-5 h-5 text-slate-400" />
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`p-3 rounded-xl border text-left transition-all ${
              language === 'en'
                ? 'bg-forest-900 text-white border-forest-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            <span className="text-xs font-bold block">English</span>
            <span className="text-[10px] opacity-80 block">Default terminology</span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage('hi')}
            className={`p-3 rounded-xl border text-left transition-all ${
              language === 'hi'
                ? 'bg-forest-900 text-white border-forest-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            <span className="text-xs font-bold block">हिन्दी (Hindi)</span>
            <span className="text-[10px] opacity-80 block">सरल हिन्दी व्याख्या</span>
          </button>
        </div>
      </div>

      {/* Communication & Alert Channels */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-serif">Notification Preferences</h3>
            <p className="text-xs text-slate-500">Control how and when you receive critical health updates</p>
          </div>
          <Bell className="w-5 h-5 text-slate-400" />
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
            <div>
              <span className="text-xs font-bold text-slate-900 block">WhatsApp Report & Prescription Updates</span>
              <span className="text-[11px] text-slate-500">Receive verified PDF reports and doctor summaries directly on WhatsApp</span>
            </div>
            <input
              type="checkbox"
              checked={waAlerts}
              onChange={(e) => setWaAlerts(e.target.checked)}
              className="w-4 h-4 text-forest-700 rounded focus:ring-forest-600"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
            <div>
              <span className="text-xs font-bold text-slate-900 block">SMS Critical Lab Alerts</span>
              <span className="text-[11px] text-slate-500">Immediate SMS alerts for out-of-range parameters (e.g. low platelets)</span>
            </div>
            <input
              type="checkbox"
              checked={smsAlerts}
              onChange={(e) => setSmsAlerts(e.target.checked)}
              className="w-4 h-4 text-forest-700 rounded focus:ring-forest-600"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Daily Medication Dosage Reminders</span>
              <span className="text-[11px] text-slate-500">Morning, afternoon and bedtime alerts to maintain adherence streak</span>
            </div>
            <input
              type="checkbox"
              checked={medReminders}
              onChange={(e) => setMedReminders(e.target.checked)}
              className="w-4 h-4 text-forest-700 rounded focus:ring-forest-600"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
