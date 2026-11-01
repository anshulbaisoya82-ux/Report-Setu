import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pill, Plus, User } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { PrescribeDialog } from '../../components/prescriptions/PrescribeDialog';
import { PageHeader, Card, SectionTitle, EmptyState, btn } from '../../components/ui/kit';
import { AdherenceBlock, CourseCard, DoseTag, byTime, doseDetail } from '../../components/medicines/MedicineParts';
import { medicationsApi, type AdherenceSummary } from '../../api/client';
import { FoodRulesCard } from '../../components/foodRules/FoodRulesEditor';

/**
 * Doctor › patient › Medicines.
 * One clear action (New prescription), then what the patient is taking, how the week went,
 * today's doses as the patient sees them, and past courses.
 */
export const DoctorPatientMedicines: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const { patients, prescriptions, medicineSchedule, fetchDoctorPatients, fetchPrescriptions, fetchMedicineSchedule } = useStore();
  const [showPrescribe, setShowPrescribe] = useState(false);
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null);
  const [adhError, setAdhError] = useState<string | null>(null);
  const [adhLoading, setAdhLoading] = useState(true);

  useEffect(() => {
    if (patients.length === 0) fetchDoctorPatients();
  }, []);

  // Never fall back to a different patient: prescribing to the wrong person is a safety risk.
  const patient = patients.find((p) => p.id === patientId || p.rsId === patientId || (p as any)._id === patientId) || null;

  const loadAll = (id: string) => {
    fetchPrescriptions(id);
    fetchMedicineSchedule(id);
    setAdhLoading(true);
    setAdhError(null);
    medicationsApi
      .getAdherence(id)
      .then(setAdherence)
      .catch((e: any) => setAdhError(e?.message || 'Please try again.'))
      .finally(() => setAdhLoading(false));
  };

  useEffect(() => {
    if (patient) loadAll(patient.id);
  }, [patient?.id]);

  if (!patient) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <EmptyState
          icon={User}
          title="Patient not found"
          body="Open a patient from your patient list to see or prescribe medicines."
          action={<Link to="/doctor/patients" className={btn('secondary')}>Go to patients</Link>}
        />
      </div>
    );
  }

  const mine = prescriptions.filter((p) => p.patientId === patient.id || (patient as any)._id === p.patientId);
  const active = mine.filter((p) => p.status === 'Active');
  const ended = mine.filter((p) => p.status === 'Ended');
  const today = [...medicineSchedule].sort(byTime);
  const takenToday = today.filter((d) => d.state === 'taken').length;

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <PageHeader
        back={{ to: `/doctor/patients/${patient.id}`, label: patient.name }}
        title="Medicines"
        subtitle={<>{patient.name} · {patient.rsId}</>}
        actions={
          <button type="button" onClick={() => setShowPrescribe(true)} className={btn('primary')}>
            <Plus className="h-4 w-4" /> New prescription
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-7">
          <SectionTitle title="Current medicines" subtitle={active.length ? `${active.length} active course${active.length > 1 ? 's' : ''}` : undefined} />
          {active.length === 0 ? (
            <EmptyState
              icon={Pill}
              title="No active medicines"
              body={`Prescribe one or more medicines and ${patient.name.split(' ')[0]} gets a reminder at each dose time.`}
              action={<button type="button" onClick={() => setShowPrescribe(true)} className={btn('primary', 'sm')}><Plus className="h-4 w-4" /> New prescription</button>}
            />
          ) : (
            <div className="space-y-3">{active.map((rx) => <CourseCard key={rx.id} rx={rx} />)}</div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-5">
          <SectionTitle title="Last 7 days" subtitle="Doses the patient marked in the app" />
          <AdherenceBlock data={adherence} error={adhError} loading={adhLoading} />
        </Card>

        <Card className="p-5 lg:col-span-7">
          <SectionTitle title="Today" subtitle={today.length ? `${takenToday} of ${today.length} taken so far` : undefined} />
          {today.length === 0 ? (
            <p className="text-sm text-stone-500">No doses scheduled today.</p>
          ) : (
            <ul className="divide-y divide-line">
              {today.map((d) => (
                <li key={d.id} className="flex items-center gap-4 py-3">
                  <span className="w-[72px] shrink-0 text-sm font-semibold tabular-nums text-stone-600">{d.scheduledTime}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">{d.name}</span>
                    <span className="block truncate text-sm text-stone-500">{doseDetail(d)}</span>
                  </span>
                  <DoseTag item={d} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 lg:col-span-5">
          <SectionTitle title="Past courses" />
          {ended.length === 0 ? (
            <p className="text-sm text-stone-500">No finished courses yet.</p>
          ) : (
            <div className="space-y-3">{ended.map((rx) => <CourseCard key={rx.id} rx={rx} />)}</div>
          )}
        </Card>
        <FoodRulesCard className="lg:col-span-12" patient={{ id: patient.id, name: patient.name, conditions: (patient as any).conditions }} />
      </div>

      <PrescribeDialog
        open={showPrescribe}
        onClose={() => {
          setShowPrescribe(false);
          loadAll(patient.id);
        }}
        patient={{ id: patient.id, name: patient.name, rsId: patient.rsId }}
      />
    </div>
  );
};
