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
import { PrescribeDialog } from '../../components/prescriptions/PrescribeDialog';

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
    // Never fall back to a different patient: prescribing to the wrong person is a safety risk.
    patients.find((p) => p.id === patientId || p.rsId === patientId || (p as any)._id === patientId) || null;

  useEffect(() => {
    if (patient) {
      fetchPrescriptions(patient.id);
      fetchMedicineSchedule(patient.id);
    }
  }, [patient?.id]);

  const [showPrescribe, setShowPrescribe] = useState(false);

  const patientPrescriptions = patient
    ? prescriptions.filter((p) => p.patientId === patient.id || (patient as any)._id === p.patientId)
    : prescriptions;

  const activePrescriptions = patientPrescriptions.filter((p) => p.status === 'Active');
  const endedPrescriptions = patientPrescriptions.filter((p) => p.status === 'Ended');
  const activePrescription = activePrescriptions[0] || null;

  if (!patient) {
    return (
      <div className="p-12 text-center text-stone-500 space-y-4 bg-white rounded-3xl border border-stone-200/70 max-w-xl mx-auto my-8">
        <User className="w-8 h-8 text-stone-300 mx-auto" />
        <h3 className="text-base font-bold text-stone-800">No Patient Selected</h3>
        <p className="text-xs text-stone-500">Please select a patient from the patient directory to view or prescribe medication.</p>
        <button
          onClick={() => navigate('/doctor/patients')}
          className="text-xs text-forest-900 font-bold underline cursor-pointer"
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
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
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
                <span className="text-xs font-bold bg-forest-50 text-forest-800 px-3 py-1 rounded-full">
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
                    <h3 className="text-xl font-bold text-ink">{activePrescription.name}</h3>
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">{activePrescription.instructions}</p>
                  <p className="text-xs text-stone-400 flex items-center gap-1.5">
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
                <h3 className="text-lg font-bold text-ink">Today's Scheduled Intakes</h3>
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
                      <h4 className="font-bold text-xs text-ink">
                        {item.name} {item.dose}
                      </h4>
                      <p className="text-xs text-stone-500">{item.timing || item.scheduledTime}</p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
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
            <h3 className="text-lg font-bold text-ink">Completed / Earlier Prescriptions</h3>
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
                      <span className="text-xs text-stone-400 font-medium">{rx.startDate}</span>
                      <h4 className="font-bold text-sm text-ink mt-0.5">{rx.name}</h4>
                      <p className="text-stone-500 text-xs mt-0.5">{rx.instructions}</p>
                    </div>
                    <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
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
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-ink">New Prescription</h3>
              <p className="text-xs text-stone-500">Prescribe medication for {patient.name}</p>
            </div>
          </div>

          <p className="text-sm text-stone-600 leading-relaxed">
            Add one or more medicines with dose, course length, reminder times and food instructions.
            The patient gets a reminder at each time you pick.
          </p>
          <button
            type="button"
            onClick={() => setShowPrescribe(true)}
            className="w-full bg-forest-900 hover:bg-forest-850 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> New prescription
          </button>
          <PrescribeDialog open={showPrescribe} onClose={() => setShowPrescribe(false)} patient={{ id: patient.id, name: patient.name, rsId: patient.rsId }} />
        </div>
      </div>
    </div>
  );
};
