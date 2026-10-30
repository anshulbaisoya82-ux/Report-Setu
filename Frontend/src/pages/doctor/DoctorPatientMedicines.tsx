import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import {
  ArrowLeft,
  Pill,
  Check,
  X,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Activity,
  HeartPulse,
  User,
} from 'lucide-react';

export const DoctorPatientMedicines: React.FC = () => {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  const {
    patients,
    currentUser,
    prescriptions,
    medicineSchedule,
    fetchDoctorPatients,
    fetchPrescriptions,
    fetchMedicineSchedule,
    createPrescription,
  } = useStore();

  useEffect(() => {
    fetchDoctorPatients();
  }, []);

  const patient =
    patients.find((p) => p.id === patientId || p.rsId === patientId || (p as any)._id === patientId) ||
    patients[0] ||
    null;

  useEffect(() => {
    if (patient) {
      fetchPrescriptions(patient.id);
      fetchMedicineSchedule(patient.id);
    }
  }, [patient?.id]);

  const [newMedName, setNewMedName] = useState('');
  const [newDose, setNewDose] = useState('1 tablet');
  const [newFrequency, setNewFrequency] = useState('Morning and Night');
  const [newDuration, setNewDuration] = useState('30');
  const [newAdvice, setNewAdvice] = useState('Take with water after meals. Walk 30 minutes daily.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prescribedSuccess, setPrescribedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const patientPrescriptions = patient
    ? prescriptions.filter((p) => p.patientId === patient.id || (patient as any)._id === p.patientId)
    : prescriptions;

  const activePrescriptions = patientPrescriptions.filter((p) => p.status === 'Active');
  const endedPrescriptions = patientPrescriptions.filter((p) => p.status === 'Ended');
  const activePrescription = activePrescriptions[0] || null;

  const handleCreatePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim() || !patient) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await createPrescription({
        patientId: patient.id,
        name: newMedName.trim(),
        instructions: `${newDose} · ${newFrequency} · after food`,
        totalDays: Number(newDuration) || 30,
        advice: newAdvice.trim() ? [newAdvice.trim()] : [],
        medicines: [
          {
            name: newMedName.trim(),
            dose: newDose,
            timing: newFrequency,
            instructions: 'after food',
          },
        ],
      });

      setPrescribedSuccess(true);
      setNewMedName('');
      setTimeout(() => setPrescribedSuccess(false), 2500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to issue prescription');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!patient) {
    return (
      <div className="p-12 text-center text-stone-500 space-y-4 bg-white rounded-3xl border border-stone-200/70 max-w-xl mx-auto my-8">
        <User className="w-8 h-8 text-stone-300 mx-auto" />
        <h3 className="text-base font-bold text-stone-800">No Patient Selected</h3>
        <p className="text-xs text-stone-500">Please select a patient from the patient directory to view or prescribe medication.</p>
        <button
          onClick={() => navigate('/doctor/patients')}
          className="text-xs text-[#1E3F35] font-bold underline cursor-pointer"
        >
          Return to Patients List
        </button>
      </div>
    );
  }

  const doctorName = currentUser?.name || 'Attending Physician';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Back button */}
      <button
        onClick={() => navigate(`/doctor/patients/${patient.id}`)}
        className="flex items-center gap-2 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-all cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to {patient.name}'s Profile</span>
      </button>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#172B25] tracking-tight">
          Medicines & Medication Adherence
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          Patient: <strong>{patient.name}</strong> · RS ID: <strong>{patient.rsId}</strong> · Prescribing Clinician: <strong>{doctorName}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Section: Current & Adherence (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Prescription Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                Current Active Prescription
              </span>
              {activePrescription && (
                <span className="text-xs font-bold bg-[#E4EDE8] text-[#2B5246] px-3 py-1 rounded-full">
                  {activePrescription.remainingDays} days left
                </span>
              )}
            </div>

            {!activePrescription ? (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-100 space-y-2">
                <Pill className="w-8 h-8 text-stone-300 mx-auto" />
                <h4 className="text-sm font-bold text-stone-700">No active prescription for {patient.name}</h4>
                <p className="text-xs text-stone-400 max-w-sm mx-auto">
                  Use the prescription panel on the right to add a medication course with daily reminders.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center flex-shrink-0">
                  <Pill className="w-6 h-6" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-[#172B25]">{activePrescription.name}</h3>
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">{activePrescription.instructions}</p>
                  <p className="text-[11px] text-stone-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {activePrescription.startDate} – {activePrescription.endDate} ·{' '}
                      {activePrescription.totalDays} days total
                    </span>
                  </p>
                  {activePrescription.advice && activePrescription.advice.length > 0 && (
                    <div className="pt-2 border-t border-stone-100 text-xs text-stone-600">
                      <strong>Clinical Advice:</strong> {activePrescription.advice.join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Today's Schedule Live Intake Preview */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#172B25]">Today's Scheduled Intakes</h3>
                <p className="text-xs text-stone-500">
                  Real-time reminder triggers visible on {patient.name}'s dashboard
                </p>
              </div>
              <span className="text-xs font-semibold text-stone-500">
                {medicineSchedule.filter((m) => m.state === 'taken').length} / {medicineSchedule.length} taken
              </span>
            </div>

            {medicineSchedule.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl border border-stone-100">
                No medication doses scheduled for today.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {medicineSchedule.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-stone-200/80 bg-white shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-[#172B25]">
                        {item.name} {item.dose}
                      </h4>
                      <p className="text-[11px] text-stone-500">{item.timing || item.scheduledTime}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.state === 'taken'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.state === 'taken' ? '✓ Taken' : 'Due'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Earlier Prescriptions Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70 space-y-4">
            <h3 className="text-lg font-bold text-[#172B25]">Completed / Earlier Prescriptions</h3>
            {endedPrescriptions.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl border border-stone-100">
                No past expired prescriptions for this patient.
              </div>
            ) : (
              <div className="space-y-3">
                {endedPrescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="p-4 rounded-2xl border border-stone-100 bg-stone-50/50 flex items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <span className="text-[11px] text-stone-400 font-medium">{rx.startDate}</span>
                      <h4 className="font-bold text-sm text-[#172B25] mt-0.5">{rx.name}</h4>
                      <p className="text-stone-500 text-xs mt-0.5">{rx.instructions}</p>
                    </div>
                    <span className="text-[11px] font-bold bg-[#FEF3D6] text-[#8C6200] px-2.5 py-1 rounded-full">
                      Ended
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Add New Prescription (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-6 sm:p-7 shadow-card border border-stone-200/70 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#32A299]/10 text-[#32A299] flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#172B25]">New Prescription</h3>
              <p className="text-xs text-stone-500">Prescribe medication for {patient.name}</p>
            </div>
          </div>

          {prescribedSuccess && (
            <div className="bg-[#E4EDE8] text-[#2B5246] p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2E9E6B]" />
              <span>Prescription & reminders saved successfully!</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-100 text-rose-900 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreatePrescription} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">Medicine name & strength *</label>
              <input
                type="text"
                value={newMedName}
                onChange={(e) => setNewMedName(e.target.value)}
                placeholder="e.g. Metformin 500 mg"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20 focus:border-[#1E3F35]"
              />
              <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                {[
                  'Metformin 500 mg',
                  'Amoxicillin 500 mg',
                  'Pantoprazole 40 mg',
                  'Atorvastatin 10 mg',
                  'Telmisartan 40 mg',
                  'Paracetamol 650 mg',
                ].map((med) => (
                  <button
                    type="button"
                    key={med}
                    onClick={() => setNewMedName(med)}
                    className="text-[10px] font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 px-2 py-0.5 rounded-md transition-all cursor-pointer"
                  >
                    + {med}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Dose *</label>
                <input
                  type="text"
                  value={newDose}
                  onChange={(e) => setNewDose(e.target.value)}
                  placeholder="1 tablet"
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Duration (days) *</label>
                <input
                  type="number"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  placeholder="30"
                  min="1"
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Frequency & Timing *</label>
              <select
                value={newFrequency}
                onChange={(e) => setNewFrequency(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20"
              >
                <option value="Morning and Night">Morning and Night (Twice daily)</option>
                <option value="Morning only">Morning only (8:00 AM)</option>
                <option value="Night only">Night only (9:00 PM)</option>
                <option value="Thrice daily">Thrice daily (Morning, Noon, Night)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Clinical Instructions & Advice</label>
              <textarea
                value={newAdvice}
                onChange={(e) => setNewAdvice(e.target.value)}
                rows={2}
                placeholder="e.g. Take with water after meals, walk 30 mins daily"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3F35]/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#1E3F35] hover:bg-[#16322A] text-white py-2.5 rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50"
            >
              <Pill className="w-4 h-4" />
              <span>{isSubmitting ? 'Prescribing...' : 'Prescribe & Schedule Doses'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
