import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { 
  ArrowLeft, Download, Calendar
} from 'lucide-react';
import { MedicalTrendChart } from '../../components/charts';

export const PatientReportDetail: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const { reports, fetchReports } = useStore();

  React.useEffect(() => {
    fetchReports();
  }, []);

  const report = reports.find(r => r.id === reportId || (r as any)._id === reportId) || reports[0];

  const getPlainDescription = (name: string) => {
    if (name.toLowerCase().includes('platelet')) {
      return 'Platelets are blood cells that help stop bleeding. Review the measured value and reference range below with your doctor.';
    }
    if (name.toLowerCase().includes('hemoglobin') || name.toLowerCase().includes('hb')) {
      return 'Hemoglobin carries oxygen throughout your body. Your doctor can interpret this value with your symptoms and other results.';
    }
    if (name.toLowerCase().includes('wbc') || name.toLowerCase().includes('leukocyte')) {
      return 'White blood cells support your immune system. Your doctor can interpret this result alongside symptoms and other tests.';
    }
    if (name.toLowerCase().includes('neutrophil')) {
      return 'Neutrophils are one type of white blood cell involved in immune response. Review this value with your doctor.';
    }
    if (name.toLowerCase().includes('lymphocyte')) {
      return 'Lymphocytes are immune cells. Your doctor can explain what this result means in the context of your full report.';
    }
    return 'This laboratory measurement is within acceptable clinical limits.';
  };

  if (!report) {
    return (
      <div className="p-12 text-center text-stone-500 space-y-4">
        <p className="text-base font-semibold">Loading report details...</p>
        <Link to="/patient/reports" className="text-xs text-[#1E3F35] font-semibold underline">
          Return to My Reports
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Back button & Header */}
      <div>
        <Link 
          to="/patient/reports"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-forest-700 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to My Reports
        </Link>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-forest-950 font-serif tracking-tight">{report.name}</h1>
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {report.category}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tested on <span className="font-semibold text-slate-700">{report.reportedDate}</span> at {report.labName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert(`Downloading verified PDF for ${report.name}`)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" /> Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Doctor's Note Card (Plain Language) */}
      <div className="bg-[#F2FAF9] bg-gradient-to-r from-[#F2FAF9] to-[#E8F6F4] border border-[#C6ECE7] rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#C6ECE7] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-forest-900 text-accent-teal font-bold flex items-center justify-center text-xs shadow-xs">
              PM
            </div>
            <div>
              <h3 className="text-xs font-bold text-forest-950 font-serif">Dr. Priya Mehta's Review</h3>
              <p className="text-[11px] text-forest-800">Internal Medicine · Apollo Clinic</p>
            </div>
          </div>
          <span className="text-[10px] bg-[#E0F7F5] text-[#0C736A] border border-[#80D7CE] font-semibold px-2.5 py-0.5 rounded-full shadow-2xs">
            Clinician Approved
          </span>
        </div>

        <p className="text-xs text-forest-950 leading-relaxed font-sans bg-white/70 p-4 rounded-xl border border-forest-100/80">
          "{report.doctorSummary?.text || 'Your doctor has not added a patient-facing summary yet.'}"
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs text-forest-800">
          {report.doctorSummary?.nextTestDate && <span className="text-[11px]">Next follow-up test: <strong>{report.doctorSummary.nextTestDate}</strong></span>}
          <Link
            to="/patient/ask-doctor"
            className="font-bold text-forest-900 underline flex items-center gap-1"
          >
            Reply or ask doctor a question <ArrowLeft className="w-3 h-3 rotate-180" />
          </Link>
        </div>
      </div>

      {/* What Your Values Mean (Patient Friendly Parameter Breakdown) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 font-serif">Understanding Your Lab Results</h2>
          <p className="text-xs text-slate-500">Every parameter explained in simple terms</p>
        </div>

        <div className="space-y-4 pt-2">
          {report.parameters.map(p => (
            <div 
              key={p.name} 
              className={`p-4 rounded-xl border transition-all ${
                p.status === 'Low' || p.status === 'High' || p.status === 'Critical'
                  ? 'bg-red-50/40 border-red-200' 
                  : 'bg-slate-50/50 border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{p.name}</h4>
                  <span className="text-[11px] text-slate-500">Normal Range: {p.referenceRange} {p.unit}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`text-sm font-bold font-serif ${
                      p.status === 'Low' || p.status === 'High' || p.status === 'Critical' ? 'text-red-700' : 'text-slate-900'
                    }`}>
                      {p.value}
                    </span>{' '}
                    <span className="text-xs text-slate-500">{p.unit}</span>
                  </div>

                  {p.status === 'Low' && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold border border-red-200">
                      Low
                    </span>
                  )}
                  {p.status === 'High' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                      High
                    </span>
                  )}
                  {p.status === 'Critical' && (
                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                      Critical
                    </span>
                  )}
                  {p.status === 'Normal' && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-medium border border-emerald-200">
                      Normal
                    </span>
                  )}
                </div>
              </div>

              {/* Visual meter bar */}
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-3 relative">
                <div className="absolute inset-y-0 left-[25%] right-[25%] bg-emerald-200" title="Normal Range"></div>
                {p.status === 'Low' && (
                  <div className="absolute top-0 bottom-0 left-[18%] w-2 bg-red-600 rounded-full" />
                )}
                {p.status === 'Normal' && (
                  <div className="absolute top-0 bottom-0 left-[50%] w-2 bg-emerald-600 rounded-full" />
                )}
                {p.status === 'High' && (
                  <div className="absolute top-0 bottom-0 left-[85%] w-2 bg-amber-600 rounded-full" />
                )}
                {p.status === 'Critical' && (
                  <div className="absolute top-0 bottom-0 left-[10%] w-2 bg-red-700 rounded-full" />
                )}
              </div>

              {/* Friendly Explanation */}
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                {p.whatItMeans || getPlainDescription(p.name)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Longitudinal Parameter Trajectory Chart */}
      <MedicalTrendChart
        reports={reports}
        initialKey="platelets"
        title="Longitudinal Biomarker Trajectory"
        subtitle="Tracking this parameter across all your verified reports with biological reference range"
      />

      {/* Repeat Test Reminder Box */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-forest-100 text-forest-900 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-forest-800" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 font-serif">Repeat Complete Blood Count on 26 Oct 2026</h3>
            <p className="text-[11px] text-slate-500">Dr. Priya Mehta recommended verifying that platelet count reaches &gt; 1.5 Lakh.</p>
          </div>
        </div>

        <button
          onClick={() => alert("Reminder added to your phone calendar for 26 Oct 2026!")}
          className="px-4 py-2 text-xs font-bold text-forest-900 bg-forest-50 border border-forest-200 rounded-xl hover:bg-forest-100 transition-colors"
        >
          Add to Calendar
        </button>
      </div>

      {/* Ask Question Card */}
      <div className="bg-[#1E3F35] bg-gradient-to-r from-[#1E3F35] to-[#264E42] rounded-2xl p-6 text-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold font-serif">Have questions regarding this report?</h3>
          <p className="text-xs text-forest-100/90 mt-1">
            Ask Dr. Priya Mehta directly or get instant AI answers for general questions.
          </p>
        </div>

        <Link
          to="/patient/ask-doctor"
          className="px-5 py-2.5 bg-accent-teal hover:bg-[#298d85] text-forest-950 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 shrink-0"
        >
          Ask Dr. Priya Mehta
        </Link>
      </div>
    </div>
  );
};
