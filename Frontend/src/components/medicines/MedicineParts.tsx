import React from 'react';
import { Tag, type Tone } from '../ui/kit';
import type { MedicineScheduleItem, Prescription } from '../../types';
import type { AdherenceSummary } from '../../api/client';

/** Dose state → label and tone. Text always carries the meaning, not colour alone. */
export const DOSE_STATE: Record<MedicineScheduleItem['state'], { label: string; tone: Tone }> = {
  taken: { label: 'Taken', tone: 'ok' },
  due: { label: 'Due', tone: 'attention' },
  snoozed: { label: 'Snoozed', tone: 'info' },
  missed: { label: 'Missed', tone: 'critical' },
};

export const DoseTag: React.FC<{ item: MedicineScheduleItem }> = ({ item }) => {
  const s = DOSE_STATE[item.state] ?? DOSE_STATE.due;
  return <Tag tone={s.tone}>{item.state === 'taken' && item.takenAt ? item.takenAt : s.label}</Tag>;
};

/** "1 tablet · After dinner" without repeating the dose when the instructions already say it. */
export const doseDetail = (d: MedicineScheduleItem): string => {
  const note = (d.instructions || d.timing || '').trim();
  const dose = (d.dose || '').trim();
  if (!dose) return note;
  if (!note) return dose;
  return note.toLowerCase().includes(dose.toLowerCase()) ? note : `${dose} · ${note}`;
};

/** Sort doses by clock time ("08:00 AM" < "09:00 PM"). Unknown times go last. */
export const byTime = (a: MedicineScheduleItem, b: MedicineScheduleItem) => toMinutes(a.scheduledTime) - toMinutes(b.scheduledTime);
function toMinutes(t?: string): number {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec((t || '').trim());
  if (!m) return 24 * 60 + 1;
  let h = Number(m[1]) % 12;
  if (m[3]?.toUpperCase() === 'PM') h += 12;
  if (!m[3] && Number(m[1]) === 12) h = 12;
  return h * 60 + Number(m[2]);
}

/** Active course with a days-left bar computed from the prescription itself. */
export const CourseCard: React.FC<{ rx: Prescription; showDoctor?: boolean }> = ({ rx, showDoctor }) => {
  const total = Math.max(rx.totalDays || 0, 0);
  const left = Math.min(Math.max(rx.remainingDays || 0, 0), total || Infinity);
  const donePct = total > 0 ? Math.round(((total - left) / total) * 100) : 0;
  return (
    <article className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{rx.name}</h3>
          {rx.instructions && <p className="mt-0.5 text-sm text-stone-600">{rx.instructions}</p>}
        </div>
        <Tag tone={rx.status === 'Active' ? 'ok' : 'neutral'}>{rx.status === 'Active' ? 'Active' : 'Ended'}</Tag>
      </div>
      {total > 0 && rx.status === 'Active' && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-stone-500">
            <span>{rx.startDate} → {rx.endDate}</span>
            <span className="font-semibold text-ink">{left} of {total} days left</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={donePct} aria-label="Course completed">
            <div className="h-full rounded-full bg-forest-800" style={{ width: `${donePct}%` }} />
          </div>
        </div>
      )}
      {rx.status !== 'Active' && (
        <p className="mt-2 text-xs text-stone-500">{rx.startDate} → {rx.endDate}{total ? ` · ${total} days` : ''}</p>
      )}
      {(showDoctor && rx.doctorName) || (rx.advice && rx.advice.length > 0) ? (
        <div className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-stone-600">
          {showDoctor && rx.doctorName && <p>Prescribed by {rx.doctorName}</p>}
          {rx.advice && rx.advice.length > 0 && <p>Advice: {rx.advice.join(' · ')}</p>}
        </div>
      ) : null}
    </article>
  );
};

/** Last-7-days summary. Shows nothing invented: no doses recorded → says so. */
export const AdherenceBlock: React.FC<{ data: AdherenceSummary | null; error?: string | null; loading?: boolean }> = ({ data, error, loading }) => {
  if (loading) return <div className="h-24 animate-pulse rounded-xl bg-stone-100" aria-label="Loading" />;
  if (error) return <p className="text-sm text-stone-500">Could not load dose history. {error}</p>;
  if (!data || !data.totalScheduled) return <p className="text-sm text-stone-500">No doses recorded in the last 7 days.</p>;
  const pct = Math.round((data.totalTaken / data.totalScheduled) * 100);
  const other = data.totalScheduled - data.totalTaken - data.totalMissed;
  return (
    <div>
      <p className="flex items-baseline gap-2">
        <span className="text-[34px] font-semibold leading-none tracking-tight text-ink">{data.totalTaken} of {data.totalScheduled}</span>
        <span className="text-sm text-stone-500">doses taken</span>
      </p>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-stone-100" role="img" aria-label={`${pct}% of doses taken`}>
        <div className="h-full bg-forest-800" style={{ width: `${pct}%` }} />
        <div className="h-full bg-red-400" style={{ width: `${Math.round((data.totalMissed / data.totalScheduled) * 100)}%` }} />
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <div className="flex gap-1.5"><dt className="text-stone-500">Taken</dt><dd className="font-semibold text-ink">{data.totalTaken}</dd></div>
        <div className="flex gap-1.5"><dt className="text-stone-500">Missed</dt><dd className="font-semibold text-ink">{data.totalMissed}</dd></div>
        {other > 0 && <div className="flex gap-1.5"><dt className="text-stone-500">Not marked</dt><dd className="font-semibold text-ink">{other}</dd></div>}
      </dl>
    </div>
  );
};
