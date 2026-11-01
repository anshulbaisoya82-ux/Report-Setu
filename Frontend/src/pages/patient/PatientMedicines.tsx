import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pill } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { notify } from '../../components/ui/Toast';
import { PageHeader, Card, SectionTitle, EmptyState, btn } from '../../components/ui/kit';
import { AdherenceBlock, CourseCard, DoseTag, byTime, doseDetail } from '../../components/medicines/MedicineParts';
import { medicationsApi, type AdherenceSummary } from '../../api/client';
import type { MedicineScheduleItem } from '../../types';

type DoseState = MedicineScheduleItem['state'];

/**
 * Patient › Medicines: today's doses with Taken / Snooze / Missed (and Undo),
 * the last 7 days, and the prescriptions. Only the doctor can change medicines.
 */
export const PatientMedicines: React.FC = () => {
  const { medicineSchedule, prescriptions, toggleMedicineSchedule, fetchMedicineSchedule, fetchPrescriptions } = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null);
  const [adhError, setAdhError] = useState<string | null>(null);
  const [adhLoading, setAdhLoading] = useState(true);

  const loadAdherence = () => {
    setAdhError(null);
    medicationsApi
      .getAdherence()
      .then(setAdherence)
      .catch((e: any) => setAdhError(e?.message || 'Please try again.'))
      .finally(() => setAdhLoading(false));
  };

  useEffect(() => {
    fetchMedicineSchedule();
    fetchPrescriptions();
    loadAdherence();
  }, []);

  const act = async (id: string, state: DoseState, done: string) => {
    setBusy(id);
    try {
      await toggleMedicineSchedule(id, state);
      notify(done, 'success');
      loadAdherence();
    } catch (e: any) {
      notify(e?.message || 'Could not save. Please try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const today = [...medicineSchedule].sort(byTime);
  const doneCount = today.filter((d) => d.state === 'taken').length;
  const active = prescriptions.filter((p) => p.status === 'Active');
  const ended = prescriptions.filter((p) => p.status === 'Ended');
  const doctorName = active[0]?.doctorName || prescriptions[0]?.doctorName;

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <PageHeader
        title="Medicines"
        subtitle={doctorName ? `As prescribed by ${doctorName}. Only your doctor can change them.` : 'Medicines your doctor prescribes appear here.'}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="p-5 lg:col-span-7">
          <SectionTitle
            title="Today"
            subtitle={today.length ? `${doneCount} of ${today.length} done` : undefined}
          />
          {today.length > 0 && (
            <div className="mb-2 flex gap-1" aria-hidden="true">
              {today.map((d) => (
                <span key={d.id} className={`h-1.5 flex-1 rounded-full ${d.state === 'taken' ? 'bg-forest-800' : d.state === 'missed' ? 'bg-red-300' : 'bg-stone-200'}`} />
              ))}
            </div>
          )}
          {today.length === 0 ? (
            <EmptyState icon={Pill} title="Nothing scheduled today" body="When your doctor prescribes a medicine, each dose time shows up here with a reminder." />
          ) : (
            <ul className="divide-y divide-line">
              {today.map((d) => {
                const isBusy = busy === d.id;
                const open = d.state === 'due' || d.state === 'snoozed';
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                    <span className="w-[72px] shrink-0 text-sm font-semibold tabular-nums text-stone-600">{d.scheduledTime}</span>
                    <span className="min-w-[150px] flex-1">
                      <span className={`block text-[15px] font-medium ${d.state === 'taken' ? 'text-stone-500' : 'text-ink'}`}>{d.name}</span>
                      <span className="block text-sm text-stone-500">{doseDetail(d)}</span>
                    </span>
                    {open ? (
                      <span className="flex basis-full flex-wrap gap-2 pl-[88px] sm:basis-auto sm:pl-0">
                        {d.state === 'snoozed' && <DoseTag item={d} />}
                        <button type="button" disabled={isBusy} onClick={() => act(d.id, 'missed', 'Marked as missed')} className={btn('secondary', 'sm')}>Missed</button>
                        {d.state !== 'snoozed' && (
                          <button type="button" disabled={isBusy} onClick={() => act(d.id, 'snoozed', 'Snoozed. We will remind you again.')} className={btn('secondary', 'sm')}>Snooze</button>
                        )}
                        <button type="button" disabled={isBusy} onClick={() => act(d.id, 'taken', 'Marked as taken')} className={btn('primary', 'sm')}>
                          <Check className="h-4 w-4" /> Taken
                        </button>
                      </span>
                    ) : (
                      <span className="flex basis-full items-center gap-2 pl-[88px] sm:basis-auto sm:pl-0">
                        <DoseTag item={d} />
                        <button type="button" disabled={isBusy} onClick={() => act(d.id, 'due', 'Undone')} className="rounded-md px-2 py-1 text-sm font-medium text-forest-800 underline-offset-2 hover:underline">
                          Undo
                        </button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col p-5 lg:col-span-5">
          <SectionTitle title="Last 7 days" subtitle="From the doses you mark here" />
          <AdherenceBlock data={adherence} error={adhError} loading={adhLoading} />
          <p className="mt-4 text-sm text-stone-500">Missed a dose? Mark it honestly so your doctor sees the real picture.</p>
          <Link to="/patient/ask-doctor" className={`${btn('secondary')} mt-auto w-full`} style={{ marginTop: 20 }}>
            Ask your doctor about a medicine
          </Link>
        </Card>

        <Card className="p-5 lg:col-span-12">
          <SectionTitle title="Prescriptions" subtitle={active.length ? `${active.length} active` : undefined} />
          {prescriptions.length === 0 ? (
            <p className="text-sm text-stone-500">No prescriptions yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[...active, ...ended].map((rx) => <CourseCard key={rx.id} rx={rx} showDoctor />)}
            </div>
          )}
          <p className="mt-4 text-sm text-stone-500">
            Never stop or change a medicine on your own. If something feels wrong, message your doctor. Emergency: call 108.
          </p>
        </Card>
      </div>
    </div>
  );
};
