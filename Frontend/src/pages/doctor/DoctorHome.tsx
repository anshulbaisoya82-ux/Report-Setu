import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, FileText, Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { formatDate } from '../../utils/format';
import { isDemoMode } from '../../demo/flags';
import { Avatar, Card, EmptyState, ListRow, Metric, PageHeader, SectionTitle, Tag, btn } from '../../components/ui/kit';

/** "Sat, 31 Oct" / "31 Oct 2026" / ISO → { day, month } */
const dayMonth = (raw?: string) => {
  const m = (raw || '').match(/(\d{1,2})\s+([A-Za-z]{3})/);
  if (m) return { day: m[1].padStart(2, '0'), month: m[2] };
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime())
    ? { day: String(d.getDate()).padStart(2, '0'), month: d.toLocaleString('en-GB', { month: 'short' }) }
    : { day: '–', month: '' };
};

const isToday = (raw?: string) => {
  if (!raw) return false;
  const now = new Date();
  const m = raw.match(/(\d{1,2})\s+([A-Za-z]{3})/);
  if (m) return +m[1] === now.getDate() && m[2].toLowerCase() === now.toLocaleString('en-GB', { month: 'short' }).toLowerCase();
  const d = new Date(raw);
  return !Number.isNaN(d.getTime()) && d.toDateString() === now.toDateString();
};

const statusTag = (status: string) =>
  status === 'Critical' ? <Tag tone="critical">Critical</Tag> : status === 'Unbalanced' ? <Tag tone="attention">Out of range</Tag> : <Tag tone="ok">Normal</Tag>;

export const DoctorHome: React.FC = () => {
  const { patients, reports, appointments, doctorInfo, fetchDoctorPatients, fetchReports, fetchAppointments } = useStore();

  useEffect(() => {
    fetchDoctorPatients();
    fetchReports();
    fetchAppointments();
  }, [fetchDoctorPatients, fetchReports, fetchAppointments]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = doctorInfo.name ? doctorInfo.name.replace(/^(Dr\.?\s+\S+).*$/, '$1') : '';

  const pending = reports
    .filter((r) => !r.reviewed && r.reviewStatus !== 'approved')
    .sort((a, b) => (a.status === 'Critical' ? 0 : a.status === 'Unbalanced' ? 1 : 2) - (b.status === 'Critical' ? 0 : b.status === 'Unbalanced' ? 1 : 2));
  const urgent = pending.filter((r) => r.status === 'Critical' && !r.doctorViewed);

  const today = appointments.filter((a) => a.status !== 'Cancelled' && isToday(a.date));
  const remainingToday = today.filter((a) => a.status === 'Confirmed' || a.status === 'Pending');
  const requests = appointments.filter((a) => a.status === 'Pending');

  // Coming up: visits plus repeat tests the doctor set when approving a report.
  const comingUp = [
    ...appointments
      .filter((a) => a.status === 'Confirmed' || a.status === 'Pending')
      .map((a) => ({
        key: `apt-${a.id}`,
        ...dayMonth(a.date),
        title: a.patientName,
        meta: `${a.reason} · ${a.time} · ${a.type}`,
        tag: a.status === 'Pending' ? <Tag tone="attention">Request</Tag> : null,
        to: '/doctor/appointments',
      })),
    ...reports
      .filter((r) => r.doctorSummary?.nextTestDate)
      .map((r) => ({
        key: `test-${r.id}`,
        ...dayMonth(r.doctorSummary!.nextTestDate),
        title: r.patientName,
        meta: `Repeat ${r.category} test due`,
        tag: <Tag>Test</Tag>,
        to: `/doctor/patients/${r.patientId}`,
      })),
  ].slice(0, 6);

  return (
    <div>
      <PageHeader
        title={`${greeting}${firstName ? `, ${firstName}` : ''}`}
        subtitle={
          <>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {isDemoMode && <span className="text-stone-400"> · demo data</span>}
          </>
        }
        actions={
          <Link to="/doctor/add-patient" className={btn('primary')}>
            <Plus className="h-4 w-4" /> Add patient
          </Link>
        }
      />

      {urgent.length > 0 && (
        <Card className="mb-6 flex flex-col gap-3 border-red-200 bg-red-50/60 p-4 sm:flex-row sm:items-center sm:px-5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-red-800">
              {urgent.length === 1 ? '1 report has a critical value' : `${urgent.length} reports have critical values`} you haven't opened
            </p>
            <p className="mt-0.5 truncate text-sm text-red-700/80">{urgent.map((r) => `${r.patientName} · ${r.name}`).join('  ·  ')}</p>
          </div>
          <Link to={`/doctor/reports/${urgent[0].id}`} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
            Review now
          </Link>
        </Card>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Metric label="Reports to review" value={pending.length} hint={urgent.length ? `${urgent.length} critical` : 'None critical'} tone={urgent.length ? 'attention' : 'default'} to="/doctor/reports" />
        <Metric label="Visits today" value={today.length} hint={remainingToday.length ? `${remainingToday.length} still to come` : 'None remaining'} to="/doctor/appointments" />
        <Metric label="Patients" value={patients.length} hint={requests.length ? `${requests.length} appointment requests` : 'No new requests'} to="/doctor/patients" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="px-5 pt-5">
            <SectionTitle title="Reports to review" subtitle="Most urgent first" action={{ to: '/doctor/reports', label: 'All reports' }} />
          </div>
          {pending.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState icon={FileText} title="You're all caught up" body="New reports appear here as soon as a patient confirms their values." />
            </div>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {pending.slice(0, 6).map((r) => (
                <ListRow
                  key={r.id}
                  to={`/doctor/reports/${r.id}`}
                  leading={<Avatar name={r.patientName} size="sm" />}
                  title={r.patientName}
                  meta={`${r.name} · ${r.labName} · ${formatDate(r.collectionDate, { day: '2-digit', month: 'short' })}`}
                  trailing={statusTag(r.status)}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 pt-5">
            <SectionTitle title="Coming up" subtitle="Visits and repeat tests" action={{ to: '/doctor/appointments', label: 'Calendar' }} />
          </div>
          {comingUp.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState icon={CalendarDays} title="Nothing scheduled" />
            </div>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {comingUp.map((f) => (
                <ListRow
                  key={f.key}
                  to={f.to}
                  leading={
                    <span className="flex w-10 shrink-0 flex-col items-center leading-none">
                      <span className="text-xs font-medium uppercase text-stone-500">{f.month}</span>
                      <span className="mt-1 text-lg font-semibold text-ink">{f.day}</span>
                    </span>
                  }
                  title={f.title}
                  meta={f.meta}
                  trailing={f.tag}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-8 text-sm text-stone-500">
        AI summaries support your review and do not replace clinical judgement. Always confirm against the original report.
      </p>
    </div>
  );
};
