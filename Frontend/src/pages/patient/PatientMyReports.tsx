import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { 
  FileText, Volume2, ArrowUpRight, Check, Info, ChevronDown
} from 'lucide-react';

export const PatientMyReports: React.FC = () => {
  const { reports, currentUser, fetchReports } = useStore();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [isPlayingHindi, setIsPlayingHindi] = useState(false);

  React.useEffect(() => {
    fetchReports();
  }, []);

  const patientReports = reports.filter(r => 
    !currentUser?.id || r.patientId === currentUser.id || r.patientId === (currentUser as any)._id || reports.length > 0
  );

  const filteredReports = patientReports.filter(rep => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'cbc') return rep.category === 'CBC';
    if (selectedFilter === 'lipid') return rep.category === 'Lipid';
    if (selectedFilter === 'hba1c') return rep.category === 'Diabetes' || rep.category === 'HbA1c';
    if (selectedFilter === 'lft') return rep.category === 'LFT';
    return true;
  });

  const handleListenHindi = () => {
    setIsPlayingHindi(true);
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        patientReports[0]?.doctorSummary?.text ?? 'आपकी रिपोर्ट की समीक्षा आपके डॉक्टर ने की है।'
      );
      utterance.lang = 'hi-IN';
      utterance.onend = () => setIsPlayingHindi(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsPlayingHindi(false), 3000);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#172B25] font-serif tracking-tight">
          My reports
        </h1>
        <p className="text-xs sm:text-sm text-[#5F736C] mt-0.5 font-sans">
          {patientReports.length} report{patientReports.length === 1 ? '' : 's'} available
        </p>
      </div>

      {/* 2. Latest Doctor's Note Hero Card */}
      {patientReports[0]?.doctorSummary && <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[#172B25] font-serif">Latest doctor's note</h2>
          <p className="text-xs text-[#5F736C]">{patientReports[0].name} · {patientReports[0].labName}</p>
        </div>

        <div className="bg-[#FAFCFA] border border-[#CAD8CF] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[#1E3F35] text-[#32A299] flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
            <span className="text-xs font-bold text-[#2B5246]">
              Checked by {patientReports[0].doctorSummary.doctorName} · {patientReports[0].doctorSummary.approvedAt}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-[#172B25] leading-relaxed">
            {patientReports[0].doctorSummary.text}
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleListenHindi}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-all ${
              isPlayingHindi
                ? 'bg-[#E4EDE8] border-[#2B5246] text-[#2B5246]'
                : 'bg-white border-stone-200 text-[#172B25] hover:bg-stone-50'
            }`}
          >
            <Volume2 className="w-4 h-4 text-[#1E3F35]" />
            {isPlayingHindi ? 'Playing Hindi Audio...' : 'Listen in Hindi'}
          </button>

          <Link
            to={`/patient/reports/${patientReports[0].id}`}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1E3F35] hover:bg-[#16322A] rounded-xl transition-all shadow-2xs"
          >
            <ArrowUpRight className="w-4 h-4 text-[#32A299]" /> Open report
          </Link>
        </div>
      </div>}

      {/* 3. Filter Pills and Sort Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#5F736C] flex items-center gap-1">
            Sort by: <span className="font-bold text-[#172B25]">Newest</span>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: `All reports · ${patientReports.length}` },
            { id: 'cbc', label: `CBC · ${patientReports.filter(report => report.category === 'CBC').length}` },
            { id: 'lipid', label: `Lipid · ${patientReports.filter(report => report.category === 'Lipid').length}` },
            { id: 'hba1c', label: `HbA1c · ${patientReports.filter(report => report.category === 'Diabetes' || report.category === 'HbA1c').length}` },
            { id: 'lft', label: `LFT · ${patientReports.filter(report => report.category === 'LFT').length}` },
          ].map(pill => (
            <button
              key={pill.id}
              onClick={() => setSelectedFilter(pill.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedFilter === pill.id
                  ? 'bg-[#1E3F35] text-white shadow-2xs'
                  : 'bg-white border border-stone-200 text-[#5F736C] hover:bg-stone-50'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Reports Table / List */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs divide-y divide-stone-100 overflow-hidden">
        {filteredReports.map(report => (
          <Link
            key={report.id}
            to={`/patient/reports/${report.id}`}
            className="p-4 hover:bg-[#FAFCFA] transition-colors flex items-center justify-between gap-4 group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-[#E4EDE8] text-[#1E3F35] flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#172B25] group-hover:text-[#1E3F35] transition-colors">
                  {report.name}
                </h4>
                <p className="text-[11px] text-[#5F736C]">
                  Collected {report.collectionDate} · {report.labName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                report.reviewed 
                  ? 'bg-[#E4EDE8] text-[#2B5246]' 
                  : 'bg-[#FEF3D6] text-[#8C6200]'
              }`}>
                {report.reviewed ? 'Checked by doctor' : 'Pending review'}
              </span>
              <ArrowUpRight className="w-4 h-4 text-stone-300 group-hover:text-[#1E3F35] transition-colors" />
            </div>
          </Link>
        ))}
      </div>

      {/* Footer Info */}
      <div className="space-y-1 text-[11px] text-[#5F736C] px-1">
        <p>Showing {filteredReports.length} of {patientReports.length} reports</p>
        <p className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0" />
          Only reports checked by your doctor show a summary.
        </p>
      </div>
    </div>
  );
};
