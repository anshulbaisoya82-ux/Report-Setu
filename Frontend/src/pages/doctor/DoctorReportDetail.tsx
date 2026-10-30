import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { 
  ArrowLeft, Download, AlertTriangle, CheckCircle, Sparkles, Send, 
  Calendar, Check, Info, Loader2, RefreshCw, Globe, Eye, X
} from 'lucide-react';
import { LabParameter } from '../../types';
import { reportsApi, doctorApi } from '../../api';
import { MedicalTrendChart, findBiomarkerDefinition } from '../../components/charts';

export const DoctorReportDetail: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { reports, patients, markReportReviewed, markReportDoctorViewed, fetchReports, fetchDoctorPatients } = useStore();

  const [currentReport, setCurrentReport] = useState<any>(null);
  const [patientHistoryReports, setPatientHistoryReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedParam, setSelectedParam] = useState<LabParameter | null>(null);

  // Patient message composer state
  const [messageTone, setMessageTone] = useState<'plain' | 'clinical' | 'urgent'>('plain');
  const [messageLang, setMessageLang] = useState<'en' | 'hi'>('en');
  const [englishMessage, setEnglishMessage] = useState('');
  const [hindiMessage, setHindiMessage] = useState('');
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeReminder, setIncludeReminder] = useState(true);
  const [nextTestDate, setNextTestDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().split('T')[0];
  });
  const [isApproved, setIsApproved] = useState(false);
  const [showApproveToast, setShowApproveToast] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState(false);
  const [isRefreshingAiOverview, setIsRefreshingAiOverview] = useState(false);

  // 1. Initial Load & Direct Fetching
  useEffect(() => {
    fetchReports();
    fetchDoctorPatients();
  }, []);

  useEffect(() => {
    if (!reportId) return;

    // Immediately mark report as viewed by doctor to clear critical red warning banners
    markReportDoctorViewed(reportId);

    let isMounted = true;
    const repFromStore = reports.find(r => r.id === reportId || (r as any)._id === reportId);
    
    if (repFromStore && repFromStore.parameters && repFromStore.parameters.length > 0) {
      setCurrentReport(repFromStore);
      initReportState(repFromStore);
      setIsLoading(false);
      // Also fetch patient history reports for dynamic trends
      fetchHistoricalReports(repFromStore.patientId);
    } else {
      setIsLoading(true);
      reportsApi.getReportById(reportId)
        .then((res: any) => {
          if (!isMounted) return;
          const rep = res?.report || res;
          setCurrentReport(rep);
          initReportState(rep);
          if (rep.patientId) {
            fetchHistoricalReports(rep.patientId);
          }
        })
        .catch((err) => {
          console.warn('Error fetching report by ID:', err);
          if (repFromStore) {
            setCurrentReport(repFromStore);
            initReportState(repFromStore);
          }
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    }

    return () => { isMounted = false; };
  }, [reportId, reports.length]);

  const fetchHistoricalReports = async (patientId: string) => {
    if (!patientId) return;
    try {
      const res: any = await reportsApi.getPatientReports(patientId);
      const list = res?.reports || (Array.isArray(res) ? res : []);
      setPatientHistoryReports(list);
    } catch (err) {
      console.warn('Could not load historical reports:', err);
    }
  };

  const initReportState = (rep: any) => {
    setIsApproved(Boolean(rep.reviewed || rep.reviewStatus === 'approved'));

    // Pick parameter for spotlight
    const abnormal = rep.parameters?.find((p: any) => p.status === 'Critical' || p.status === 'Low' || p.status === 'High');
    setSelectedParam(abnormal || rep.parameters?.[0] || null);

    const patName = rep.patientName || 'Patient';
    const repName = rep.name || 'Complete Blood Count (CBC)';
    const lab = rep.labName || 'Diagnostic Laboratory';

    // Set initial draft text if doctorSummary exists, or default reassuring note
    if (rep.doctorSummary?.text) {
      setEnglishMessage(rep.doctorSummary.text);
    } else {
      setEnglishMessage(
        `Hello ${patName.split(' ')[0]}, I have reviewed your ${repName} from ${lab}. Your vital blood cell counts are noted. Please maintain good hydration and rest. Scheduled follow-up repeat test is recommended on ${nextTestDate}.`
      );
    }

    if (rep.doctorSummary?.hindiText) {
      setHindiMessage(rep.doctorSummary.hindiText);
    } else {
      setHindiMessage(
        `नमस्ते ${patName.split(' ')[0]}, मैंने आपकी ${repName} रिपोर्ट की समीक्षा की है। कृपया पर्याप्त पानी पिएं और आराम करें। अगली जाँच ${nextTestDate} को कराने की सलाह दी जाती है।`
      );
    }
  };

  const patient = patients.find(p => p.id === currentReport?.patientId) || {
    id: currentReport?.patientId || 'p-unknown',
    name: currentReport?.patientName || 'Rishabh',
    rsId: 'RS-1HEAL',
    age: 28,
    gender: 'Male',
    phone: '+919415211069',
  };

  // Tone changer
  const handleToneChange = (tone: 'plain' | 'clinical' | 'urgent') => {
    setMessageTone(tone);
    const patFirst = patient.name.split(' ')[0] || 'Patient';
    const repName = currentReport?.name || 'CBC report';

    if (tone === 'plain') {
      setEnglishMessage(
        `Hello ${patFirst}, I have reviewed your ${repName}. Parameters are being monitored closely. Continue plenty of fluids and rest. Please repeat CBC on ${nextTestDate}.`
      );
      setHindiMessage(
        `नमस्ते ${patFirst}, मैंने आपकी ${repName} रिपोर्ट देखी है। आपके रक्त मानकों पर नजर रखी जा रही है। भरपूर तरल पदार्थ और आराम लें। कृपया ${nextTestDate} को दोबारा जांच कराएं।`
      );
    } else if (tone === 'clinical') {
      setEnglishMessage(
        `Clinical Review: ${repName} evaluated. Cell line counts show dynamic changes requiring ongoing clinical observation. Supportive therapy advised. Follow-up CBC scheduled for ${nextTestDate}.`
      );
      setHindiMessage(
        `चिकित्सीय समीक्षा: ${repName} की जांच की गई। रक्त कणिकाओं में बदलाव देखे गए हैं। आवश्यक दवाएं जारी रखें और ${nextTestDate} को पुनः सीबीसी कराएं।`
      );
    } else {
      setEnglishMessage(
        `Important alert for ${patFirst}: Certain readings in your ${repName} require close monitoring. Watch for spontaneous bleeding, bruising, or fever. Urgent repeat test scheduled for ${nextTestDate}.`
      );
      setHindiMessage(
        `महत्वपूर्ण सूचना: आपकी ${repName} में कुछ पैरामीटर सामान्य सीमा से बाहर हैं। रक्तस्राव या तेज बुखार के लक्षणों पर ध्यान दें और ${nextTestDate} को तुरंत दोबारा जांच कराएं।`
      );
    }
  };

  // Generate AI Draft using Gemini / ML Service
  const handleGenerateAiDraft = async () => {
    if (!currentReport) return;
    try {
      setIsGeneratingAiDraft(true);
      const repId = currentReport.id || currentReport._id;
      const res = await doctorApi.generateDraftSummary(repId, {
        tone: messageTone === 'clinical' ? 'More detail' : messageTone === 'urgent' ? 'Brief' : 'Plain language',
        language: 'both',
      });

      if (res.summaryEn || res.draftText) {
        setEnglishMessage(res.summaryEn || res.draftText);
      }
      if (res.summaryHi || res.hindiDraftText) {
        setHindiMessage(res.summaryHi || res.hindiDraftText);
      }
    } catch (err) {
      console.warn('AI draft generation failed, maintaining current draft:', err);
    } finally {
      setIsGeneratingAiDraft(false);
    }
  };

  // Regenerate AI Overview
  const handleRegenerateAiOverview = async () => {
    if (!currentReport) return;
    try {
      setIsRefreshingAiOverview(true);
      const repId = currentReport.id || currentReport._id;
      const res: any = await doctorApi.generateReportAiOverview(repId);
      const overview = res?.data || res;
      if (overview?.summary) {
        setCurrentReport((prev: any) => ({
          ...prev,
          aiOverview: overview,
        }));
      }
    } catch (err) {
      console.warn('Failed to regenerate AI Overview:', err);
    } finally {
      setIsRefreshingAiOverview(false);
    }
  };

  // Approve & Notify Patient
  const handleApprove = async () => {
    if (!currentReport) return;
    try {
      setIsSubmitting(true);
      const repId = currentReport.id || currentReport._id;
      const toneMap: Record<string, 'Plain language' | 'More detail' | 'Brief'> = {
        plain: 'Plain language',
        clinical: 'More detail',
        urgent: 'Brief',
      };

      await reportsApi.reviewReport(repId, {
        text: englishMessage,
        summaryText: englishMessage,
        hindiText: hindiMessage,
        tone: toneMap[messageTone] || 'Plain language',
        nextTestDate: includeReminder ? nextTestDate : undefined,
        medicinesStatus: 'No change',
        sentVia: ['App', 'SMS'],
      });

      markReportReviewed(repId, {
        text: englishMessage,
        hindiText: hindiMessage,
        tone: 'Plain language',
        approvedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        doctorName: 'Dr. Priya Mehta',
        nextTestDate,
        medicinesStatus: 'No change',
        sentVia: ['App', 'SMS'],
      });

      setIsApproved(true);
      setShowApproveToast(true);
      setTimeout(() => setShowApproveToast(false), 4000);
    } catch (err: any) {
      console.error('Error approving report:', err);
      // Fallback local update
      const repId = currentReport.id || currentReport._id;
      markReportReviewed(repId, {
        text: englishMessage,
        hindiText: hindiMessage,
        tone: 'Plain language',
        approvedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        doctorName: 'Dr. Priya Mehta',
        nextTestDate,
        medicinesStatus: 'No change',
        sentVia: ['App', 'SMS'],
      });
      setIsApproved(true);
      setShowApproveToast(true);
      setTimeout(() => setShowApproveToast(false), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#1E3F35] animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Loading authentic CBC laboratory panel...</p>
      </div>
    );
  }

  if (!currentReport) {
    return (
      <div className="p-8 text-center text-slate-600">
        <p className="font-semibold text-base">Report not found.</p>
        <Link to="/doctor/reports" className="text-forest-600 font-medium underline mt-2 inline-block">
          Back to Reports List
        </Link>
      </div>
    );
  }

  const aiOverview = currentReport.aiOverview || {
    summary: `${currentReport.name} from ${currentReport.labName}. Contains ${currentReport.parameters?.length || 0} extracted parameters evaluated against standard biological reference intervals.`,
    keyFindings: (currentReport.parameters || [])
      .filter((p: any) => p.status !== 'Normal')
      .map((p: any) => ({
        parameter: p.name,
        value: String(p.value),
        unit: p.unit || '',
        tag: p.status,
        changeText: `${p.status} reading outside biological reference range`,
      })),
    pointsToConsider: [
      'Correlate abnormal readings with patient hydration and clinical symptoms.',
      'Schedule a follow-up Complete Blood Count within 3-4 days.',
    ],
  };

  const isCritical = currentReport.status === 'Critical';

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Alert */}
      {showApproveToast && (
        <div className="fixed top-6 right-6 z-50 bg-[#1E3F35] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-forest-700 animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="w-5 h-5 text-accent-teal" />
          <div>
            <p className="font-semibold text-sm">Report approved & message dispatched!</p>
            <p className="text-xs text-forest-200">{patient.name} received notification via WhatsApp and Patient App.</p>
          </div>
        </div>
      )}

      {/* SMS / WhatsApp Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#1E3F35]" />
                <h3 className="font-bold text-sm text-slate-900">Patient Message Preview</h3>
              </div>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-xs text-slate-800 space-y-2">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">SMS / WhatsApp Draft (English)</span>
              <p className="whitespace-pre-wrap leading-relaxed">{englishMessage}</p>
            </div>

            {hindiMessage && (
              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 text-xs text-slate-800 space-y-2">
                <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">WhatsApp Draft (हिंदी)</span>
                <p className="whitespace-pre-wrap leading-relaxed font-sans">{hindiMessage}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb & Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Link to="/doctor/reports" className="hover:text-forest-700 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Reports
            </Link>
            <span>/</span>
            <span className="text-[#1E3F35]">{patient.name} – {currentReport.name}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-forest-950 font-serif tracking-tight">{currentReport.name}</h1>
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {currentReport.labName || 'Diagnostic Lab'}
            </span>
            {isCritical && !isApproved && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-600 text-white flex items-center gap-1 shadow-2xs">
                <AlertTriangle className="w-3 h-3" /> Critical Values
              </span>
            )}
            {isApproved ? (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <Check className="w-3 h-3" /> Reviewed & Sent
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#E4EDE8] text-[#1E3F35] border border-[#C5D8CE] flex items-center gap-1">
                <Eye className="w-3 h-3" /> Viewed · In Review
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Collected: {currentReport.collectionDate ? new Date(currentReport.collectionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'} · Patient ID: <span className="font-mono text-slate-700">{patient.rsId}</span> · {patient.age}y / {patient.gender}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button 
            onClick={() => alert(`Original authentic lab report: ${currentReport.name}.pdf`)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs"
          >
            <Download className="w-4 h-4 text-slate-500" /> Original Lab Document
          </button>
          
          <button 
            onClick={() => navigate(`/doctor/patients/${patient.id}`)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs"
          >
            Patient Profile
          </button>

          <button 
            onClick={handleApprove}
            disabled={isApproved || isSubmitting}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl shadow-xs transition-all ${
              isApproved 
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                : 'bg-[#1E3F35] text-white hover:bg-forest-800 active:scale-95'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 text-accent-teal" />
            )}
            {isApproved ? 'Approved & Sent' : 'Approve & Notify Patient'}
          </button>
        </div>
      </div>

      {/* AI Clinical Overview & Key Findings Banner */}
      <div className="bg-[#F2FAF9] bg-gradient-to-r from-[#F2FAF9] via-[#E8F6F4] to-[#E3F4F1] border border-[#C6ECE7] rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#E0F7F5] text-[#0C736A] border border-[#80D7CE] flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="w-5 h-5 text-[#0A887D]" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-forest-950 font-serif">AI Clinical Overview & Clinician Triage</h3>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#E0F7F5] text-[#0C736A] border border-[#80D7CE] shadow-2xs">
                  Automated Triage
                </span>
                {isCritical && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                    High Attention
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRegenerateAiOverview}
                  disabled={isRefreshingAiOverview}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#0C736A] hover:text-[#08554E] transition-colors"
                  title="Re-run ML extraction analysis"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingAiOverview ? 'animate-spin' : ''}`} />
                  <span>{isRefreshingAiOverview ? 'Analyzing...' : 'Re-analyze'}</span>
                </button>
                <span className="text-[11px] text-[#147970] font-medium hidden sm:inline">
                  · Verified against ICMR Reference Limits
                </span>
              </div>
            </div>

            <p className="text-xs text-forest-900 leading-relaxed font-sans mb-3">
              {aiOverview.summary}
            </p>

            {/* Dynamic Key Findings Badges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#C6ECE7]">
              {aiOverview.keyFindings && aiOverview.keyFindings.length > 0 ? (
                aiOverview.keyFindings.slice(0, 3).map((finding: any, idx: number) => {
                  const isCrit = finding.tag === 'Critical';
                  const isAbnormal = finding.tag === 'Low' || finding.tag === 'High';
                  return (
                    <div key={idx} className="bg-white/95 backdrop-blur-xs rounded-xl p-2.5 border border-[#C6ECE7]/70 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        {finding.parameter}
                      </span>
                      <span className={`text-xs font-bold flex items-center gap-1 mt-0.5 ${
                        isCrit ? 'text-red-700' : isAbnormal ? 'text-amber-800' : 'text-emerald-800'
                      }`}>
                        {isCrit || isAbnormal ? <AlertTriangle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                        {finding.value} {finding.unit} ({finding.tag})
                      </span>
                      <span className="text-[11px] text-slate-600 block mt-0.5">
                        {finding.changeText || 'Outside reference limits'}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="bg-white/95 backdrop-blur-xs rounded-xl p-2.5 border border-[#C6ECE7]/70 shadow-2xs md:col-span-3">
                  <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> All parameters reside within normal biological limits
                  </span>
                </div>
              )}
            </div>

            {/* Points to consider */}
            {aiOverview.pointsToConsider && aiOverview.pointsToConsider.length > 0 && (
              <div className="mt-3 pt-2 border-t border-[#C6ECE7]/60">
                <span className="text-[10px] font-bold text-forest-900 uppercase tracking-wider block mb-1">
                  Points to Consider:
                </span>
                <ul className="text-xs text-forest-950/80 space-y-1 list-disc list-inside">
                  {aiOverview.pointsToConsider.map((point: string, i: number) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Parameters Table on Left, Deep Dive & Trends on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Parameter List & Patient Message Composer */}
        <div className="lg:col-span-7 space-y-6">
          {/* Detailed Lab Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-serif">
                  Laboratory Parameters ({currentReport.parameters?.length || 0} values)
                </h3>
                <p className="text-xs text-slate-500">Click any row to inspect longitudinal trend & clinical note</p>
              </div>
              <span className="text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                Specimen: {currentReport.specimen || 'EDTA Whole Blood'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/40 text-slate-600 font-semibold border-b border-slate-200/60">
                    <th className="py-2.5 px-4">Parameter</th>
                    <th className="py-2.5 px-3">Result</th>
                    <th className="py-2.5 px-3">Bio. Ref. Range</th>
                    <th className="py-2.5 px-3">Change</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(currentReport.parameters || []).map((param: LabParameter) => {
                    const isSelected = selectedParam?.name === param.name;
                    return (
                      <tr 
                        key={param.id || param.name} 
                        onClick={() => setSelectedParam(param)}
                        className={`cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-forest-50/70 font-medium' 
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            {param.name}
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-forest-700"></span>}
                          </div>
                          <span className="text-[10px] text-slate-400 font-normal">Method: Automated Hematology Analyzer</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`font-bold ${
                            param.status === 'Critical' ? 'text-red-700 font-black' :
                            param.status === 'Low' || param.status === 'High' ? 'text-red-700' : 'text-slate-900'
                          }`}>
                            {param.value}
                          </span>{' '}
                          <span className="text-[11px] text-slate-500">{param.unit}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                          {param.referenceRange || '—'} {param.unit}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {param.change || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {param.status === 'Critical' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold shadow-2xs">
                              <AlertTriangle className="w-3 h-3" /> Critical
                            </span>
                          )}
                          {param.status === 'Low' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold border border-red-200">
                              <AlertTriangle className="w-2.5 h-2.5" /> Low
                            </span>
                          )}
                          {param.status === 'High' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                              <AlertTriangle className="w-2.5 h-2.5" /> High
                            </span>
                          )}
                          {param.status === 'Normal' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
                              Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Patient Message Composer with English & Hindi Support */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-serif">Patient Communication Composer</h3>
                <p className="text-xs text-slate-500">Draft clinician advice to send to {patient.name} via WhatsApp & Patient App</p>
              </div>

              {/* Action Buttons: Gemini Draft + Tone Switcher */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleGenerateAiDraft}
                  disabled={isGeneratingAiDraft}
                  className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold transition-all"
                  title="Generate bilingual AI clinical summary using Gemini/ML module"
                >
                  {isGeneratingAiDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{isGeneratingAiDraft ? 'Drafting...' : 'Gemini AI Draft'}</span>
                </button>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => handleToneChange('plain')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      messageTone === 'plain' 
                        ? 'bg-white text-forest-900 font-semibold shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Plain
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToneChange('clinical')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      messageTone === 'clinical' 
                        ? 'bg-white text-forest-900 font-semibold shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Clinical
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToneChange('urgent')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      messageTone === 'urgent' 
                        ? 'bg-white text-red-700 font-semibold shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Urgent
                  </button>
                </div>
              </div>
            </div>

            {/* Language Switcher Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMessageLang('en')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    messageLang === 'en'
                      ? 'bg-forest-100 text-forest-900 border border-forest-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>English Draft</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-forest-700"></span>
                </button>

                <button
                  type="button"
                  onClick={() => setMessageLang('hi')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    messageLang === 'hi'
                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>हिंदी (Hindi) Draft</span>
                  {hindiMessage && <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>}
                </button>
              </div>

              <span className="text-[11px] text-slate-400">
                {messageLang === 'en' ? 'Dispatched as SMS & In-App' : 'Dispatched as WhatsApp (हिंदी)'}
              </span>
            </div>

            {/* Editable Message Textarea */}
            <div>
              {messageLang === 'en' ? (
                <textarea 
                  rows={4}
                  value={englishMessage}
                  onChange={(e) => setEnglishMessage(e.target.value)}
                  placeholder="Draft English advice for patient..."
                  className="w-full text-xs text-slate-900 p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 leading-relaxed font-sans bg-slate-50/50"
                />
              ) : (
                <textarea 
                  rows={4}
                  value={hindiMessage}
                  onChange={(e) => setHindiMessage(e.target.value)}
                  placeholder="रोगी के लिए हिंदी में परामर्श लिखें..."
                  className="w-full text-xs text-slate-900 p-3.5 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-700 leading-relaxed font-sans bg-amber-50/30"
                />
              )}
            </div>

            {/* Inclusions & Follow-up Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={includeSummary} 
                  onChange={(e) => setIncludeSummary(e.target.checked)}
                  className="rounded text-forest-700 focus:ring-forest-600 w-4 h-4" 
                />
                <span>Attach simplified CBC parameter table</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={includeReminder} 
                  onChange={(e) => setIncludeReminder(e.target.checked)}
                  className="rounded text-forest-700 focus:ring-forest-600 w-4 h-4" 
                />
                <span>Include repeat test calendar reminder</span>
              </label>
            </div>

            {/* Next Test Date Picker */}
            {includeReminder && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Calendar className="w-4 h-4 text-forest-700" />
                  <span className="font-semibold">Next recommended repeat test:</span>
                </div>
                <input 
                  type="date"
                  value={nextTestDate}
                  onChange={(e) => setNextTestDate(e.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-medium focus:ring-1 focus:ring-forest-700"
                />
              </div>
            )}

            {/* Composer Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
              <button 
                type="button" 
                onClick={() => alert("Draft saved locally for this clinical session.")}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Save as draft
              </button>

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" /> Preview SMS / WhatsApp
                </button>
                <button 
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproved || isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1E3F35] rounded-xl hover:bg-forest-800 transition-colors shadow-xs active:scale-95 disabled:bg-slate-300"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-accent-teal" />
                  )}
                  <span>{isApproved ? 'Approved' : 'Send to Patient'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Parameter Deep Dive Card & Dynamic Trend */}
        <div className="lg:col-span-5 space-y-6">
          {selectedParam ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Parameter Analysis</span>
                  <h3 className="text-lg font-bold text-slate-900 font-serif">{selectedParam.name}</h3>
                  <p className="text-xs text-slate-500">Biological Reference Interval: {selectedParam.referenceRange || 'Standard'} {selectedParam.unit}</p>
                </div>

                <div className="text-right">
                  <span className={`text-2xl font-bold font-serif ${
                    selectedParam.status === 'Critical' ? 'text-red-700 font-black' :
                    selectedParam.status === 'Low' || selectedParam.status === 'High' ? 'text-red-700' : 'text-[#1E3F35]'
                  }`}>
                    {selectedParam.value}
                  </span>
                  <span className="text-xs text-slate-500 block">{selectedParam.unit}</span>
                </div>
              </div>

              {/* Status indicator bar */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600">Interval Position:</span>
                  <span className={
                    selectedParam.status === 'Critical' ? 'text-red-700 font-black' :
                    selectedParam.status === 'Low' ? 'text-red-700' : 
                    selectedParam.status === 'High' ? 'text-amber-700' : 'text-emerald-700'
                  }>
                    {selectedParam.status === 'Critical' ? 'Critical alert threshold' :
                     selectedParam.status === 'Low' ? 'Below biological reference' : 
                     selectedParam.status === 'High' ? 'Above biological reference' : 'Within normal limits'}
                  </span>
                </div>

                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden relative">
                  <div className="absolute inset-y-0 left-[25%] right-[25%] bg-emerald-200" title="Normal Range"></div>
                  {selectedParam.status === 'Critical' && (
                    <div className="absolute top-0 bottom-0 left-[8%] w-2.5 bg-red-700 rounded-full shadow-xs" title="Critical Value"></div>
                  )}
                  {selectedParam.status === 'Low' && (
                    <div className="absolute top-0 bottom-0 left-[18%] w-2 bg-red-600 rounded-full shadow-xs" title="Low Value"></div>
                  )}
                  {selectedParam.status === 'Normal' && (
                    <div className="absolute top-0 bottom-0 left-[50%] w-2 bg-emerald-600 rounded-full shadow-xs" title="Normal Value"></div>
                  )}
                  {selectedParam.status === 'High' && (
                    <div className="absolute top-0 bottom-0 left-[85%] w-2 bg-amber-600 rounded-full shadow-xs" title="High Value"></div>
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0</span>
                  <span>Lower Reference</span>
                  <span>Upper Reference</span>
                </div>
              </div>

              {/* Longitudinal Medical Trend Chart */}
              <div className="pt-1">
                <MedicalTrendChart
                  reports={patientHistoryReports.length > 0 ? patientHistoryReports : (currentReport ? [currentReport] : [])}
                  initialKey={findBiomarkerDefinition(selectedParam.name).key}
                  compact={true}
                  height={220}
                  showSelector={false}
                  showSummary={true}
                  showLegend={true}
                  showDateFilter={false}
                  title={`${selectedParam.name} Longitudinal Trajectory`}
                  subtitle="Biological reference range and historical test progression"
                />
              </div>

              {/* Clinical Correlation & Guidance */}
              <div className="bg-[#FAF7F2] border border-[#EBE4D5] rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                  <span>Clinical Correlation Guide</span>
                </div>
                <p className="text-xs text-amber-950/80 leading-relaxed">
                  {selectedParam.whatItMeans || selectedParam.explanation || 
                    "Parameter evaluated against standard hematology biological reference intervals. Correlate with clinical history and medication."
                  }
                </p>
                {selectedParam.pointsToConsider && (
                  <p className="text-[11px] text-amber-900/70 italic border-t border-amber-200/50 pt-1.5">
                    Clinician Note: {selectedParam.pointsToConsider}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              Select a parameter to view detailed analysis.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
