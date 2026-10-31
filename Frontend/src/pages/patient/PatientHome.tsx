import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCircle2, FileText, Pill, Upload, UserPlus, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { notify } from '../../components/ui/Toast';
import { formatDate } from '../../utils/format';
import { Card, EmptyState, ListRow, Metric, PageHeader, SectionTitle, Tag, btn } from '../../components/ui/kit';

export const PatientHome: React.FC = () => {
  const { reports, appointments, medicineSchedule, toggleMedicineSchedule, currentUser, fetchReports, fetchMedicineSchedule, fetchAppointments } = useStore();
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [hideSummary, setHideSummary] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
    fetchMedicineSchedule();
    fetchAppointments();
    import('../../api').then(({ connectionsApi }) =>
      connectionsApi.getPendingRequests().then((res) => setPendingRequests(res?.requests || [])).catch(() => {})
    );
  }, [fetchReports, fetchMedicineSchedule, fetchAppointments]);

  const firstName = (currentUser?.name || '').split(' ')[0];
  const latestChecked = [...reports]
    .filter((r) => r.reviewed && r.doctorSummary?.text)
    .sort((a, b) => new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime())[0];
  const recent = [...reports].sort((a, b) => new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime()).slice(0, 4);
  const checkedCount = reports.filter((r) => r.reviewed).length;

  const taken = medicineSchedule.filter((m) => m.state === 'taken').length;
  const nextDue = medicineSchedule.find((m) => m.state !== 'taken');
  const upcoming = appointments.filter((a) => a.status === 'Confirmed' || a.status === 'Pending');
  const nextVisit = upcoming[0];

  const markTaken = async (id: string, state: 'taken' | 'due') => {
    setSaving(id);
    try {
      await toggleMedicineSchedule(id, state);
    } catch (e: any) {
      notify(e?.message || 'Could not save. Please try again.', 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={`Welcome back${firstName ? `, ${firstName}` : ''}`}
        subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={
          <Link to="/patient/upload" className={btn('primary')}>
            <Upload className="h-4 w-4" /> Upload report
          </Link>
        }
      />

      {pendingRequests.length > 0 && (
        <Card className="mb-4 flex flex-col gap-3 border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center sm:px-5">
          <UserPlus className="h-5 w-5 shrink-0 text-amber-700" />
          <p className="flex-1 text-[15px] text-amber-900">
            <span className="font-semibold">{pendingRequests[0].doctorName || 'A doctor'}</span> wants to see your reports.
          </p>
          <Link to="/patient/doctors" className={btn('secondary', 'sm')}>Review request</Link>
        </Card>
      )}

      {latestChecked && !hideSummary && (
        <Card className="mb-6 p-5">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-stone-500">
                {latestChecked.doctorSummary?.doctorName || latestChecked.reviewedBy} checked your {latestChecked.name}
              </p>
              <p className="mt-1.5 line-clamp-2 max-w-3xl text-[15px] leading-relaxed text-ink">{latestChecked.doctorSummary!.text}</p>
              <Link to={`/patient/reports/${latestChecked.id}`} className="mt-3 inline-flex text-sm font-semibold text-forest-800 hover:text-forest-950">
                Read the full summary →
              </Link>
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => setHideSummary(true)} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Metric label="My reports" value={reports.length} hint={`${checkedCount} checked by your doctor`} to="/patient/reports" />
        <Metric
          label="Today's medicines"
          value={
            <>
              {taken}
              <span className="text-stone-300"> / {medicineSchedule.length}</span>
            </>
          }
          hint={nextDue ? `Next: ${nextDue.name} at ${nextDue.scheduledTime}` : medicineSchedule.length ? 'All done for today' : 'Nothing scheduled'}
          to="/patient/medicines"
        />
        <Metric
          label="Next appointment"
          value={nextVisit ? nextVisit.time : '—'}
          hint={nextVisit ? `${nextVisit.date} · ${nextVisit.status === 'Pending' ? 'waiting for doctor' : 'confirmed'}` : 'None booked'}
          to="/patient/appointments"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="px-5 pt-5">
            <SectionTitle title="Today's medicines" subtitle="Tap when you've taken a dose" action={{ to: '/patient/medicines', label: 'All medicines' }} />
          </div>
          {medicineSchedule.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState icon={Pill} title="No medicines today" body="Medicines your doctor prescribes will show up here with reminders." />
            </div>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {medicineSchedule.map((m) => {
                const done = m.state === 'taken';
                return (
                  <li key={m.id} className="flex items-center gap-4 px-5 py-3.5">
                    <span className="w-[4.5rem] shrink-0 whitespace-nowrap text-sm font-medium text-stone-500">{m.scheduledTime}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[15px] font-medium ${done ? 'text-stone-400 line-through decoration-stone-300' : 'text-ink'}`}>{m.name}</span>
                      <span className="block truncate text-sm text-stone-500">{done && m.takenAt ? m.takenAt : `${m.dose} · ${m.instructions || m.timing}`}</span>
                    </span>
                    <button
                      type="button"
                      disabled={saving === m.id}
                      onClick={() => markTaken(m.id, done ? 'due' : 'taken')}
                      aria-pressed={done}
                      className={done ? 'inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700' : btn('secondary', 'sm')}
                    >
                      {done ? <><Check className="h-4 w-4" /> Taken</> : 'Mark taken'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="px-5 pt-5">
              <SectionTitle title="Recent reports" action={{ to: '/patient/reports', label: 'All reports' }} />
            </div>
            {recent.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState icon={FileText} title="No reports yet" action={<Link to="/patient/upload" className={btn('secondary', 'sm')}>Upload your first report</Link>} />
              </div>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {recent.map((r) => (
                  <ListRow
                    key={r.id}
                    to={`/patient/reports/${r.id}`}
                    title={r.name}
                    meta={`${r.labName} · ${formatDate(r.collectionDate)}`}
                    trailing={r.reviewed ? <Tag tone="ok">Checked</Tag> : <Tag tone="attention">Waiting</Tag>}
                  />
                ))}
              </ul>
            )}
          </Card>

          {upcoming.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-5 pt-5">
                <SectionTitle title="Upcoming visits" action={{ to: '/patient/appointments', label: 'Appointments' }} />
              </div>
              <ul className="divide-y divide-line border-t border-line">
                {upcoming.slice(0, 3).map((a) => (
                  <ListRow
                    key={a.id}
                    to="/patient/appointments"
                    title={`${a.date} · ${a.time}`}
                    meta={`${a.doctorName} · ${a.reason} · ${a.type}`}
                    trailing={a.status === 'Pending' ? <Tag tone="attention">Waiting</Tag> : <Tag tone="ok">Confirmed</Tag>}
                  />
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <p className="mt-8 text-sm text-stone-500">
        Summaries are written in simple words and approved by your doctor. ReportSetu never suggests medicines. In an emergency, call 108.
      </p>
    </div>
  );
};
