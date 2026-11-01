import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { connectionsApi, patientProfileApi, privacyApi, type NotificationPreferences } from '../../api';
import {
  ShieldCheck, Copy, Check, RefreshCw,
  Trash2, Bell, Globe, CheckCircle, Download, AlertTriangle, Loader2
} from 'lucide-react';

const DEFAULT_PREFS: NotificationPreferences = {
  medicineReminders: true,
  testDueReminders: true,
  doctorReplies: true,
  criticalAlerts: true,
  language: 'en',
};

/** The in-app notifications the server actually sends and can mute (see notificationService). */
const PREF_ROWS: { key: Exclude<keyof NotificationPreferences, 'language'>; title: string; detail: string }[] = [
  { key: 'medicineReminders', title: 'Medicine reminders', detail: 'A reminder at each dose time from your prescriptions' },
  { key: 'testDueReminders', title: 'Test due reminders', detail: 'When your doctor\'s next-test date comes up' },
  { key: 'doctorReplies', title: 'Doctor replies', detail: 'When your doctor answers a question or reviews a report' },
  { key: 'criticalAlerts', title: 'Important result alerts', detail: 'When a report has a value your doctor should look at soon' },
];

export const PatientSettings: React.FC = () => {
  const { currentUser, patients } = useStore();
  const currentPatient = currentUser || patients[0];
  const [copiedId, setCopiedId] = useState(false);
  const [connectCode, setConnectCode] = useState<string | null>(null);
  const [codeTimer, setCodeTimer] = useState(0);
  const navigate = useNavigate();
  const logout = useStore((s) => s.logout);

  // Saved on the patient profile (PUT /patient/profile → notificationPreferences)
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Privacy actions
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  useEffect(() => {
    patientProfileApi.get()
      .then((res: any) => {
        const p = res?.data ?? res;
        const stored = p?.notificationPreferences;
        if (stored && typeof stored === 'object') setPrefs({ ...DEFAULT_PREFS, ...stored });
      })
      .catch(() => { /* keep defaults; saving still works */ })
      .finally(() => setPrefsLoaded(true));
  }, []);

  const flash = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const savePref = async <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    setSavingKey(key);
    try {
      await patientProfileApi.update({ notificationPreferences: { [key]: value } as Partial<NotificationPreferences> });
      flash('Saved.');
    } catch (error) {
      setPrefs(previous);
      flash(error instanceof Error ? error.message : 'Could not save. Please try again.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await privacyApi.exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reportsetu-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash('Your data was downloaded.');
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not export your data.');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await privacyApi.deleteMyAccount();
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete the account.');
    } finally {
      setDeleting(false);
    }
  };

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
        <div className="fixed top-6 right-6 z-50 bg-forest-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-forest-700">
          <CheckCircle className="w-4 h-4 text-accent-teal" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">Account & Security Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Your health ID, clinic pairing code, doctor access, notifications and your data
        </p>
      </div>

      {/* Universal Patient ID & Instant In-Clinic Connect Code */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Universal ID Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-forest-700" />
              <h3 className="text-sm font-bold text-slate-900 font-serif">Your ReportSetu ID</h3>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
              Share only with your doctor
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Your Unique Identifier</span>
            <div className="text-3xl font-semibold font-mono text-forest-950 tracking-wider">
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

          </div>
        </div>

        {/* Temporary Doctor Connect Code (Figma highlight) */}
        <div className="bg-forest-900 rounded-2xl p-5 text-white shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-xs font-bold tracking-wider uppercase text-accent-teal">
              In-Clinic Pairing Code
            </span>
            <span className="text-xs text-forest-200 flex items-center gap-1">
              Expires in {Math.floor(codeTimer / 60)}:{(codeTimer % 60).toString().padStart(2, '0')}
            </span>
          </div>

          <div className="text-center space-y-1.5 py-1">
            <span className="text-xs text-forest-100">Tell your doctor's receptionist:</span>
            <div className="text-3xl font-mono font-semibold text-white tracking-widest bg-white/10 py-2.5 px-4 rounded-xl border border-white/15">
              {connectCode}
            </div>
            <p className="text-xs text-forest-200">
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
            type="button"
            onClick={() => navigate('/patient/doctors')}
            className="text-xs font-bold text-forest-900 hover:underline"
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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                    Consented
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{doc.hospital}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
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
            <p className="text-xs text-slate-500">Saved to your profile. Reports offer "Listen in Hindi" whenever your doctor adds a Hindi summary.</p>
          </div>
          <Globe className="w-5 h-5 text-slate-400" />
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <button
            type="button"
            onClick={() => savePref('language', 'en')}
            disabled={!prefsLoaded || savingKey === 'language'}
            aria-pressed={prefs.language === 'en'}
            className={`p-3 rounded-xl border text-left transition-all ${
              prefs.language === 'en'
                ? 'bg-forest-900 text-white border-forest-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            <span className="text-xs font-bold block">English</span>
            <span className="text-xs opacity-80 block">Default terminology</span>
          </button>

          <button
            type="button"
            onClick={() => savePref('language', 'hi')}
            disabled={!prefsLoaded || savingKey === 'language'}
            aria-pressed={prefs.language === 'hi'}
            className={`p-3 rounded-xl border text-left transition-all ${
              prefs.language === 'hi'
                ? 'bg-forest-900 text-white border-forest-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            <span className="text-xs font-bold block">हिन्दी (Hindi)</span>
            <span className="text-xs opacity-80 block">सरल हिन्दी व्याख्या</span>
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

        <p className="text-xs text-slate-500">These are in-app notifications (the bell). Text-message and WhatsApp alerts are not available yet.</p>
        <div className="space-y-3">
          {PREF_ROWS.map((row) => (
            <label key={row.key} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-900 block">{row.title}</span>
                <span className="text-xs text-slate-500">{row.detail}</span>
              </div>
              {savingKey === row.key ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <input
                  type="checkbox"
                  checked={prefs[row.key]}
                  disabled={!prefsLoaded || savingKey !== null}
                  onChange={(e) => savePref(row.key, e.target.checked)}
                  className="w-4 h-4 text-forest-700 rounded focus:ring-forest-600"
                />
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Your data */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 font-serif">Your data</h3>
          <p className="text-xs text-slate-500">Download a copy of everything ReportSetu stores about you, or delete your account.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download my data
          </button>
          <button
            type="button"
            onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setDeleteError(''); }}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete my account
          </button>
        </div>
      </div>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <h2 id="delete-title" className="text-base font-semibold text-ink">Delete your account?</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  This permanently erases your profile, reports, prescriptions, medicine records, messages and appointments, and ends your doctor connections. It cannot be undone.
                  Download your data first if you want a copy.
                </p>
              </div>
            </div>
            <label className="block text-xs font-semibold text-slate-700">
              Type DELETE to confirm
              <input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                autoFocus
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono focus:border-red-500 focus:outline-none"
              />
            </label>
            {deleteError && <p className="text-xs font-medium text-red-700" role="alert">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteOpen(false)} disabled={deleting} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
