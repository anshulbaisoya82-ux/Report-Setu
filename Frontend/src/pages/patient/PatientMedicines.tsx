import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { 
  Check, Download, 
  ShieldAlert, FileText
} from 'lucide-react';

export const PatientMedicines: React.FC = () => {
  const { medicineSchedule, prescriptions, toggleMedicineSchedule, fetchMedicineSchedule, fetchPrescriptions } = useStore();
  const [activeTab, setActiveTab] = useState<'schedule' | 'active' | 'past'>('schedule');

  React.useEffect(() => {
    fetchMedicineSchedule();
    fetchPrescriptions();
  }, []);

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header & Streak Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest-950 font-serif tracking-tight">My Medication Schedule</h1>
          <p className="text-xs text-slate-500 mt-1">
            {prescriptions.length > 0
              ? `Active regimen prescribed by ${prescriptions[0].doctorName}`
              : 'Your prescribed medicines and daily schedule will appear here.'}
          </p>
        </div>

      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === 'schedule'
              ? 'bg-white text-forest-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Daily Schedule (Morning · Noon · Night)
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === 'active'
              ? 'bg-white text-forest-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Active Prescriptions ({prescriptions.length})
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === 'past'
              ? 'bg-white text-forest-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Completed / Past Medicines ({prescriptions.filter(p => p.status === 'Ended').length})
        </button>
      </div>

      {/* SCHEDULE VIEW */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Scheduled Today</h3>
              </div>
              <span className="text-xs text-slate-500">{medicineSchedule.length} medications</span>
            </div>

            <div className="space-y-2">
              {medicineSchedule.length === 0 && (
                <div className="p-8 text-center text-xs text-stone-500 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-1">
                  <p className="font-semibold text-stone-700">No medications scheduled for today</p>
                  <p className="text-stone-400">
                    When your attending doctor prescribes medications or sets reminder alarms, your daily intake doses will appear here.
                  </p>
                </div>
              )}
              {medicineSchedule.map(med => {
                const isTaken = med.state === 'taken';
                return (
                  <div 
                    key={med.id}
                    onClick={() => toggleMedicineSchedule(med.id, isTaken ? 'due' : 'taken')}
                    className={`p-4 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                      isTaken ? 'bg-slate-50/70 border-slate-200' : 'bg-white border-forest-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        isTaken ? 'bg-[#1E3F35] text-accent-teal' : 'border-2 border-slate-300'
                      }`}>
                        {isTaken && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                      <div>
                        <h4 className={`text-xs font-bold ${isTaken ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {med.name} {med.dose}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {med.instructions || med.timing} · <span className="font-semibold text-forest-800">{med.scheduledTime}</span>
                        </p>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                      isTaken ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isTaken ? (med.takenAt || 'Taken') : 'Take Now'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE PRESCRIPTIONS TAB */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {prescriptions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">No active prescriptions yet</p>
              <p className="text-slate-400">
                Prescriptions issued by your doctor with dosage duration and lifestyle instructions will appear here.
              </p>
            </div>
          ) : (
            prescriptions.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 font-serif">{p.name}</h3>
                    <span className="text-xs font-medium text-slate-500">Doctor: {p.doctorName}</span>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {p.status} ({p.remainingDays} days left)
                  </span>
                </div>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <strong>Doctor's Advice:</strong> {p.instructions}
                </p>
                {p.advice && p.advice.length > 0 && (
                  <div className="text-xs text-emerald-800 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/60">
                    <strong>Care Advice:</strong> {p.advice.join(' · ')}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span>Start: <strong>{p.startDate}</strong></span>
                  <span>End: <strong>{p.endDate}</strong></span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PAST MEDICINES TAB */}
      {activeTab === 'past' && (
        <div className="space-y-3">
          {prescriptions.filter(p => p.status === 'Ended').map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-serif line-through text-slate-500">{p.name}</h3>
                  <span className="text-xs text-slate-400">{p.instructions}</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  Completed
                </span>
              </div>
              <p className="text-xs text-slate-500">Prescribed by {p.doctorName} from {p.startDate} to {p.endDate}.</p>
            </div>
          ))}
          {prescriptions.filter(p => p.status === 'Ended').length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-500">
              No completed medicines found.
            </div>
          )}
        </div>
      )}

      {/* Drug Safety Protocol Notice */}
      <div className="bg-[#FFF4E5] border border-[#FFD9A8] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-950 font-serif">Important Medication Safety Advice</h4>
            <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
              Never stop or change the dose of any prescription without consulting {prescriptions[0]?.doctorName || 'your attending doctor'}. If you notice nausea, rash, or dizziness, send a message immediately.
            </p>
          </div>
        </div>

        <Link
          to="/patient/ask-doctor"
          className="shrink-0 px-4 py-2 text-xs font-bold text-white bg-[#1E3F35] rounded-xl hover:bg-forest-800 transition-colors shadow-2xs whitespace-nowrap"
        >
          Ask Doctor about Medicines
        </Link>
      </div>

      {/* Official Prescription Download Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-900 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-forest-800" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 font-serif">Official Stamped Prescription (Rx-8921)</h4>
            <p className="text-[11px] text-slate-500">Signed by Dr. Priya Mehta on 15 Oct 2026 · Apollo Clinic</p>
          </div>
        </div>

        <button
          onClick={() => alert("Downloading stamped PDF prescription: Rx_RohanVerma_2026.pdf")}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <Download className="w-4 h-4 text-slate-500" /> Download PDF
        </button>
      </div>
    </div>
  );
};
