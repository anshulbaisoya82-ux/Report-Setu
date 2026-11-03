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
  ChevronDown,
} from 'lucide-react';
import { MedicineAutocomplete, MedicineSuggestion } from '../../components/common/MedicineAutocomplete';
import { FoodRulesCard } from '../../components/foodRules/FoodRulesEditor';

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
    revokePrescription,
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
  const [newDose, setNewDose] = useState('1 Tablet');
  const [newDuration, setNewDuration] = useState('30');
  const [selectedTimings, setSelectedTimings] = useState<string[]>(['morning', 'night']);
  const [foodInstruction, setFoodInstruction] = useState('After food');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prescribedSuccess, setPrescribedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const timingOptions = [
    { id: 'morning', label: 'Morning (8:00 AM)', time: '08:00 AM', period: 'Morning' },
    { id: 'noon', label: 'Noon (1:00 PM)', time: '01:00 PM', period: 'Noon' },
    { id: 'evening', label: 'Evening (6:30 PM)', time: '06:30 PM', period: 'Evening' },
    { id: 'night', label: 'Night (9:00 PM)', time: '09:00 PM', period: 'Night' },
  ];

  const toggleTiming = (timingId: string) => {
    setSelectedTimings((prev) =>
      prev.includes(timingId) ? prev.filter((t) => t !== timingId) : [...prev, timingId]
    );
  };

  const handleSelectMedicineSuggestion = (med: MedicineSuggestion) => {
    let defaultDose = '1 Tablet';
    const formLower = (med.dosageForm || '').toLowerCase();
    if (formLower.includes('capsule')) defaultDose = '1 Capsule';
    else if (formLower.includes('syrup') || formLower.includes('suspension')) defaultDose = '5 ml';
    else if (formLower.includes('drop')) defaultDose = '1 Drop';
    else if (formLower.includes('puff') || formLower.includes('inhaler')) defaultDose = '1 Puff';
    else if (formLower.includes('sachet')) defaultDose = '1 Sachet';
    else if (formLower.includes('injection')) defaultDose = '1 Injection';

    setNewMedName(med.name);
    setNewDose(defaultDose);
  };

  const patientPrescriptions = patient
    ? prescriptions.filter((p) => p.patientId === patient.id || (patient as any)._id === p.patientId)
    : prescriptions;

  const activePrescriptions = patientPrescriptions.filter((p) => p.status === 'Active');
  const endedPrescriptions = patientPrescriptions.filter((p) => p.status === 'Ended');
  const activePrescription = activePrescriptions[0] || null;

  const handleRevokePrescription = async (id: string, name: string) => {
    const reason = window.prompt(`Discontinue / Revoke ${name} before the scheduled time period ends? Enter reason:`, 'Discontinued by Doctor');
    if (reason !== null) {
      try {
        await revokePrescription(id, reason);
        if (patient) {
          fetchPrescriptions(patient.id);
          fetchMedicineSchedule(patient.id);
        }
      } catch (e: any) {
        alert(e.message || 'Failed to revoke prescription');
      }
    }
  };

  const handleCreatePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim() || !patient) return;
    if (selectedTimings.length === 0) {
      setErrorMsg('Please select at least one time for "When to Take"');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const timingMap: Record<string, { label: string; period: string }> = {
        morning: { label: 'Morning (8:00 AM)', period: 'Morning' },
        noon: { label: 'Noon (1:00 PM)', period: 'Noon' },
        evening: { label: 'Evening (6:30 PM)', period: 'Evening' },
        night: { label: 'Night (9:00 PM)', period: 'Night' },
      };

      const orderedKeys = ['morning', 'noon', 'evening', 'night'].filter((k) =>
        selectedTimings.includes(k)
      );
      const selectedLabels = orderedKeys.map((k) => timingMap[k].label);
      const selectedPeriods = orderedKeys.map((k) => timingMap[k].period);

      const timingSummary =
        selectedPeriods.length === 1
          ? `${selectedPeriods[0]} daily`
          : selectedPeriods.length === 2
          ? `${selectedPeriods[0]} and ${selectedPeriods[1]}`
          : `${selectedPeriods.slice(0, -1).join(', ')} and ${selectedPeriods[selectedPeriods.length - 1]}`;

      const totalDays = Number(newDuration) || 30;

      await createPrescription({
        patientId: patient.id,
        doctorName: currentUser?.name || 'Dr. Rishabh',
        name: newMedName.trim(),
        dosage: newDose,
        frequency: timingSummary,
        duration: `${totalDays} days`,
        totalDays: totalDays,
        instructions: `${newDose} · ${timingSummary} · ${foodInstruction}`,
        startDate: new Date().toISOString(),
        active: true,
        medicines: [
          {
            name: newMedName.trim(),
            dose: newDose,
            timing: selectedLabels.join(', '),
            frequency: timingSummary,
            instructions: `${newDose} · ${selectedLabels.join(', ')} · ${foodInstruction}`,
            duration: `${totalDays} days`,
            totalDays: totalDays,
          },
        ],
      });

      setPrescribedSuccess(true);
      setNewMedName('');
      setTimeout(() => setPrescribedSuccess(false), 2500);
      if (patient) {
        fetchPrescriptions(patient.id);
        fetchMedicineSchedule(patient.id);
      }
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

        {/* Right Section: Add New Prescription (Matching Exact New Design) */}
        <div className="lg:col-span-4 bg-white rounded-[6px] p-5 sm:p-6 shadow-2xs border border-stone-200/90 space-y-4">
          <div className="pb-3 border-b border-stone-200">
            <h3 className="font-bold text-base text-slate-900 leading-tight">New Prescription</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {patient.name}{patient.rsId ? ` • ${patient.rsId}` : ''}
            </p>
          </div>

          {prescribedSuccess && (
            <div className="bg-[#EAF6F0] text-[#136C4F] p-3 rounded-[4px] text-xs font-semibold flex items-center gap-2 border border-[#C6EAD8]">
              <CheckCircle2 className="w-4 h-4 text-[#16A36A]" />
              <span>Prescription saved! Schedule and reminders updated.</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 text-rose-800 p-3 rounded-[4px] text-xs font-semibold flex items-center gap-2 border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreatePrescription} className="space-y-4 text-xs font-sans">
            {/* Section 1: Add Medicines */}
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-bold text-slate-900 leading-tight">
                  Medicine & Strength
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Enter the medicine name, dosage, and course duration.
                </p>
              </div>

              <MedicineAutocomplete
                value={newMedName}
                onChange={setNewMedName}
                onSelect={handleSelectMedicineSuggestion}
                placeholder="e.g. Metformin 500 mg, Dolo, Augmentin"
              />

              {/* Quick suggestions */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {[
                  'Metformin 500 mg',
                  'Vitamin D3 60,000 IU',
                  'Pantoprazole 40 mg',
                  'Paracetamol 650 mg',
                  'Amoxicillin 500 mg',
                ].map((med) => (
                  <button
                    type="button"
                    key={med}
                    onClick={() => setNewMedName(med)}
                    className="text-[10px] font-semibold bg-stone-100 hover:bg-stone-200 text-slate-700 px-2 py-0.5 rounded-[3px] transition-all cursor-pointer"
                  >
                    + {med}
                  </button>
                ))}
              </div>

              {/* Dose & Duration row */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="relative">
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Dose</label>
                  <select
                    value={newDose}
                    onChange={(e) => setNewDose(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-[4px] border border-stone-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#0E382F] cursor-pointer appearance-none pr-7"
                  >
                    <option value="1 Tablet">1 Tablet</option>
                    <option value="2 Tablets">2 Tablets</option>
                    <option value="1/2 Tablet">1/2 Tablet</option>
                    <option value="1 Capsule">1 Capsule</option>
                    <option value="2 Capsules">2 Capsules</option>
                    <option value="5 ml">5 ml</option>
                    <option value="10 ml">10 ml</option>
                    <option value="15 ml">15 ml</option>
                    <option value="1 Sachet">1 Sachet</option>
                    <option value="1 Drop">1 Drop</option>
                    <option value="1 Puff">1 Puff</option>
                    <option value="As directed">As directed</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-[calc(50%+8px)] -translate-y-1/2 pointer-events-none" />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Duration</label>
                  <div className="flex h-10 border border-stone-200 rounded-[4px] bg-white overflow-hidden focus-within:border-[#0E382F] focus-within:ring-1 focus-within:ring-[#0E382F]">
                    <input
                      type="number"
                      value={newDuration}
                      onChange={(e) => setNewDuration(e.target.value)}
                      placeholder="30"
                      min="1"
                      required
                      className="w-full h-full px-2.5 text-xs text-slate-800 focus:outline-none"
                    />
                    <span className="px-2.5 text-xs text-slate-500 bg-stone-50 border-l border-stone-200 h-full flex items-center font-medium select-none">
                      Days
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: When to Take */}
            <div className="space-y-2 pt-1 border-t border-stone-100">
              <div>
                <h4 className="text-xs font-bold text-slate-900 leading-tight">When to Take</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Select scheduled dose times.</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                {timingOptions.map((t) => {
                  const isChecked = selectedTimings.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      onClick={() => toggleTiming(t.id)}
                      className="flex items-center gap-2 cursor-pointer select-none py-1 group"
                    >
                      <div
                        className={`w-4 h-4 rounded-[3px] flex items-center justify-center transition-all ${
                          isChecked
                            ? 'bg-[#0E382F] text-white'
                            : 'border border-stone-300 bg-white group-hover:border-stone-400'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-medium text-slate-800">{t.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Food Instruction */}
            <div className="space-y-1.5 pt-1 border-t border-stone-100">
              <label className="block text-xs font-bold text-slate-900 leading-tight">
                Food Instruction
              </label>
              <div className="relative">
                <select
                  value={foodInstruction}
                  onChange={(e) => setFoodInstruction(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-stone-200 rounded-[4px] text-xs text-slate-800 focus:outline-none focus:border-[#0E382F] cursor-pointer appearance-none pr-8"
                >
                  <option value="After food">After food</option>
                  <option value="Before food">Before food</option>
                  <option value="With food / meals">With food / meals</option>
                  <option value="Empty stomach">Empty stomach</option>
                  <option value="Before bedtime">Before bedtime</option>
                  <option value="As directed">As directed</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 bg-[#0E382F] hover:bg-[#092720] text-white rounded-[6px] font-bold text-xs shadow-2xs transition-colors flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50"
            >
              <Pill className="w-4 h-4 -rotate-45" />
              <span>{isSubmitting ? 'Prescribing...' : 'Prescribe & Schedule Doses'}</span>
            </button>
          </form>
        </div>
        <FoodRulesCard className="lg:col-span-12" patient={{ id: patient.id, name: patient.name, conditions: (patient as any).conditions }} />
      </div>
    </div>
  );
};
