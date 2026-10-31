import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Calendar, CheckCircle2, Clock3, Eye, FileText, Info, MessageSquare, TriangleAlert, Volume2, X,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MedicalTrendChart } from '../../components/charts';
import { notify } from '../../components/ui/Toast';
import { describeParameter, explainParameter, StatusLabel, StatusPill } from '../../components/ui/status';
import { formatDate } from '../../utils/format';
import { speakHindi, stopSpeaking } from '../../utils/speech';
import type { LabParameter } from '../../types';

export const PatientReportDetail: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const { reports, fetchReports } = useStore();
  const [loaded, setLoaded] = useState(reports.length > 0);
  const [selected, setSelected] = useState<LabParameter | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    fetchReports().finally(() => setLoaded(true));
    return () => stopSpeaking();
  }, [fetchReports]);

  // Never fall back to a different report: showing someone the wrong results is worse than "not found".
  const report = reports.find((r) => r.id === reportId || (r as any)._id === reportId);
  const params = report?.parameters ?? [];
  const outside = useMemo(() => params.filter((p) => p.status !== 'Normal'), [params]);

  useEffect(() => {
    if (!selected && params.length) setSelected(outside[0] ?? params[0]);
  }, [params, outside, selected]);

  if (!report) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-10 text-center">
        {loaded ? (
          <>
            <FileText className="mx-auto h-8 w-8 text-stone-400" />
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">Report not found</h1>
            <p className="mt-1 text-sm text-stone-500">It may have been removed, or the link is incorrect.</p>
          </>
        ) : (
          <p className="text-sm text-stone-500" role="status">Loading report…</p>
        )}
        <Link to="/patient/reports" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-900 underline">
          <ArrowLeft className="h-4 w-4" /> Back to My reports
        </Link>
      </div>
    );
  }

  const summary = report.doctorSummary;
  const checked = Boolean(report.reviewed && summary?.text);
  const nextTest = summary?.nextTestDate;

  const listen = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (!summary?.hindiText) return;
    if (speakHindi(summary.hindiText, () => setSpeaking(false))) setSpeaking(true);
    else notify('Your browser cannot read text aloud.', 'warning');
  };

  const sel = selected ? describeParameter(selected) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/patient/reports" className="inline-flex items-center gap-2 text-sm font-semibold text-forest-900 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to My reports
        </Link>
        <Link to="/patient/ask-doctor" className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-600">
          <MessageSquare className="h-4 w-4" /> Ask about this report
        </Link>
      </div>

      {/* Header */}
      <section className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-5 sm:p-6 md:flex-row md:items-center">
        <div className="flex flex-1 items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-terracotta-500/15 text-terracotta-600">
            <FileText className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">{report.name}</h1>
            <p className="mt-1 text-sm text-stone-500">
              {report.labName} · Collected {formatDate(report.collectionDate)}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 border-t border-stone-200 pt-4 text-sm md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div>
            <dt className="text-xs text-stone-500">Status</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-semibold text-ink">
              {checked ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Clock3 className="h-4 w-4 text-amber-600" />}
              {checked ? 'Checked by doctor' : 'Waiting for doctor'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Outside normal range</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-semibold text-ink">
              {outside.length > 0 && <TriangleAlert className="h-4 w-4 text-amber-600" />}
              {outside.length} {outside.length === 1 ? 'value' : 'values'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Next test</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-semibold text-ink">
              <Calendar className="h-4 w-4 text-stone-500" />
              {nextTest ? formatDate(nextTest) : '—'}
            </dd>
          </div>
        </dl>
      </section>

      {/* Doctor's summary */}
      {checked ? (
        <section className="rounded-3xl border border-sage-300 bg-sage-50 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">Doctor's summary</h2>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-forest-800">
              <CheckCircle2 className="h-3.5 w-3.5" /> Approved by {summary!.doctorName || report.reviewedBy}
              {summary!.approvedAt ? ` · ${formatDate(summary!.approvedAt)}` : ''}
            </p>
          </div>
          <p className="mt-3 max-w-4xl text-[15px] leading-relaxed text-ink">{summary!.text}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {summary!.hindiText && (
              <button type="button" onClick={listen} aria-pressed={speaking} className="inline-flex items-center gap-2 rounded-xl border border-sage-300 bg-white px-4 py-2 text-sm font-semibold text-forest-900 hover:border-forest-900">
                <Volume2 className="h-4 w-4" /> {speaking ? 'Stop' : 'Listen in Hindi'}
              </button>
            )}
            <button type="button" onClick={() => notify('Viewing the original uploaded file is not available yet.', 'info')} className="inline-flex items-center gap-2 rounded-xl border border-sage-300 bg-white px-4 py-2 text-sm font-semibold text-forest-900 hover:border-forest-900">
              <Eye className="h-4 w-4" /> View original report
            </button>
          </div>
        </section>
      ) : (
        <section className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Your doctor hasn't checked this report yet</p>
            <p className="mt-0.5 text-amber-800">A summary in simple words will appear here once they approve it. You can still see the values you confirmed below.</p>
          </div>
        </section>
      )}

      {/* Results + explanation */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-line bg-white p-4 sm:p-6">
          <h2 className="text-base font-semibold text-ink">Your results</h2>
          <p className="text-xs text-stone-500">Tap a value to see what it means</p>

          {params.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-sage-50 p-6 text-center text-sm text-stone-500">No values recorded for this report.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-sage-50 text-xs text-stone-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Parameter</th>
                    <th className="px-3 py-3 font-medium">Value</th>
                    <th className="hidden px-3 py-3 font-medium sm:table-cell">Normal range</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {params.map((p) => {
                    const d = describeParameter(p);
                    const active = selected?.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        tabIndex={0}
                        onClick={() => setSelected(p)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelected(p))}
                        aria-selected={active}
                        className={`cursor-pointer transition-colors ${active ? 'bg-sage-100' : 'hover:bg-sage-50'}`}
                      >
                        <td className={`px-4 py-3 ${active ? 'font-semibold' : ''} text-ink`}>{p.name}</td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span className="font-semibold text-ink">{p.value}</span>{' '}
                          <span className="text-xs text-stone-500">{p.unit}</span>
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-3 text-stone-600 sm:table-cell">{p.referenceRange}</td>
                        <td className="px-3 py-3"><StatusLabel {...d} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selected && sel && (
          <aside className="h-fit rounded-2xl border border-line bg-stone-50 p-5 lg:sticky lg:top-6" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">{selected.name}</h2>
              <button type="button" aria-label="Close explanation" onClick={() => setSelected(null)} className="rounded-lg p-1 text-stone-500 hover:bg-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-4xl font-bold tracking-tight text-ink">{selected.value}</span>
              <span className="text-sm text-stone-500">{selected.unit}</span>
              <StatusPill {...sel} />
            </div>
            <p className="mt-2 text-xs text-stone-500">Normal range: {selected.referenceRange} {selected.unit}</p>
            <hr className="my-4 border-stone-200" />
            <h3 className="text-sm font-semibold text-ink">What is this?</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-700">
              {explainParameter(selected.name)}{' '}
              {sel.severity === 'normal'
                ? 'Your value is within the usual range in this report.'
                : `Your value is ${selected.status === 'Low' ? 'lower' : 'higher'} than the usual range in this report.`}
            </p>
            {checked && (
              <div className="mt-4 rounded-2xl bg-white p-4">
                <p className="text-xs font-semibold text-forest-800">What your doctor said</p>
                <p className="mt-1 text-sm leading-relaxed text-ink">“{summary!.text}”</p>
              </div>
            )}
            <p className="mt-4 flex items-start gap-2 rounded-2xl bg-white/70 p-3 text-xs text-stone-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This explanation helps you understand your report. It is not a diagnosis.
            </p>
          </aside>
        )}
      </div>

      <MedicalTrendChart
        reports={reports}
        initialKey={/hba1c/i.test(report.category) ? 'hba1c' : 'hemoglobin'}
        title="Trends over time"
        subtitle="How this value has changed across your reports, with the normal range shaded"
      />

      <p className="flex items-center gap-2 rounded-2xl bg-sage-50 px-4 py-3 text-xs text-stone-500">
        <Info className="h-3.5 w-3.5 shrink-0" />
        Values come from your lab report and were checked by you and your doctor. ReportSetu is a decision-support tool and does not diagnose.
      </p>
    </div>
  );
};
