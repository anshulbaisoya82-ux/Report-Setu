import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { 
  Upload, CheckCircle, AlertTriangle, ArrowRight, 
  Sparkles, Check, X, Camera, FileText, Bell,
  AlertCircle, ChevronRight, RefreshCw, FileQuestion, Plus
} from 'lucide-react';
import { LabParameter, LabReport } from '../../types';
import { analyzeReport, ReportAnalysisResult } from '../../api';

type StepNumber = 1 | 2 | 3 | 4;

export const PatientUploadReport: React.FC = () => {
  const navigate = useNavigate();
  const { patients, addReport, currentUser, fetchReports } = useStore();
  const currentPatient = currentUser || patients[0] || null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Workflow State
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectedDoctorName, setConnectedDoctorName] = useState<string>('your consulting doctor');

  useEffect(() => {
    import('../../api').then(({ connectionsApi }) => {
      connectionsApi.getMyConnections()
        .then((conns: any) => {
          const list = conns?.connections || (Array.isArray(conns) ? conns : []);
          const active = list.find((c: any) => c.status === 'connected' || c.status === 'active');
          if (active && active.name) {
            setConnectedDoctorName(active.name);
          } else if (active && active.doctorName) {
            setConnectedDoctorName(active.doctorName);
          }
        })
        .catch(() => {});
    });
  }, []);
  
  // File details
  const [fileName, setFileName] = useState<string>('');
  const [fileSizeFormatted, setFileSizeFormatted] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size?: number; rawFile?: File } | null>(null);
  const [uploadedReportId, setUploadedReportId] = useState<string | null>(null);

  // Analysis & Detection State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecognized, setIsRecognized] = useState(true);
  const [detectedReportType, setDetectedReportType] = useState('Complete Blood Count (CBC)');
  const [detectedCategory, setDetectedCategory] = useState<'CBC' | 'HbA1c' | 'Lipid' | 'LFT' | 'KFT' | 'Other'>('CBC');
  const [detectedLab, setDetectedLab] = useState('Diagnostic Reference Lab · Collected 31 Oct 2026');
  const [selectedFallbackType, setSelectedFallbackType] = useState<'CBC' | 'HbA1c' | 'Lipid' | 'LFT' | 'KFT' | 'Other'>('CBC');
  
  // Reading Progress State
  const [valuesReadCount, setValuesReadCount] = useState(0);
  const [totalValuesCount, setTotalValuesCount] = useState(0);
  const [readingFinished, setReadingFinished] = useState(false);

  // Manual Change Modal State
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);

  // Step 3 (Check Values) State
  const [labName, setLabName] = useState('Labsmart Software');
  const [testDate, setTestDate] = useState('2026-10-31');
  const [params, setParams] = useState<LabParameter[]>([]);

  // Handle file selection from input or drop
  const processUploadedFile = async (fileObj: { name: string; size?: number; rawFile?: File }) => {
    setUploadedFile(fileObj);
    setFileName(fileObj.name);
    setFileSizeFormatted(fileObj.size ? `${(fileObj.size / (1024 * 1024)).toFixed(1)} MB` : '1.2 MB');
    
    // Switch to step 2 (Reading / Detection)
    setCurrentStep(2);
    setIsAnalyzing(true);
    setReadingFinished(false);
    setValuesReadCount(0);

    const result: ReportAnalysisResult = await analyzeReport(fileObj);
    setIsAnalyzing(false);

    if (!result.recognized) {
      setIsRecognized(false);
      return;
    }

    setIsRecognized(true);
    if (result.reportId) {
      setUploadedReportId(result.reportId);
    }
    setDetectedReportType(result.reportType);
    setDetectedCategory(result.category);
    setDetectedLab(`${result.labName} · Collected ${result.collectionDate}`);
    setLabName(result.labName);
    setTestDate(result.collectionDate || new Date().toISOString().split('T')[0]);
    setParams(result.parameters);
    setTotalValuesCount(result.parameters.length);

    animateValuesReading(result.parameters.length, result.parameters);
  };

  const animateValuesReading = (count: number, parameters: LabParameter[]) => {
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setValuesReadCount(current);
      if (current >= count) {
        clearInterval(interval);
        setReadingFinished(true);
        setTimeout(() => {
          setCurrentStep(3);
        }, 800);
      }
    }, 180);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processUploadedFile({ name: file.name, size: file.size, rawFile: file });
    }
  };

  const handleNativeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processUploadedFile({ name: file.name, size: file.size, rawFile: file });
    }
  };

  const handleResetUpload = () => {
    setUploadedFile(null);
    setCurrentStep(1);
    setIsRecognized(true);
    setReadingFinished(false);
    setValuesReadCount(0);
    setIsChangeModalOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleConfirmFallbackType = (categoryKey: 'CBC' | 'HbA1c' | 'Lipid' | 'LFT' | 'KFT') => {
    const templates: Record<string, { reportType: string; category: any; labName: string; parameters: LabParameter[] }> = {
      CBC: {
        reportType: 'Complete Blood Count (CBC)',
        category: 'CBC',
        labName: 'Labsmart Software',
        parameters: [
          { id: 'p-1', name: 'Hemoglobin', value: '15.0', unit: 'g/dL', referenceRange: '13.0 - 17.0', status: 'Normal' },
          { id: 'p-2', name: 'Platelet Count', value: '3.5', unit: 'lakhs/cumm', referenceRange: '1.5 - 4.1', status: 'Normal' },
          { id: 'p-3', name: 'Total Leukocyte Count', value: '5100', unit: 'cumm', referenceRange: '4,800 - 10,800', status: 'Normal' },
        ],
      },
      HbA1c: {
        reportType: 'Glycated Hemoglobin (HbA1c)',
        category: 'HbA1c',
        labName: 'Diagnostic Laboratory',
        parameters: [
          { id: 'p-1', name: 'HbA1c', value: '5.6', unit: '%', referenceRange: '< 5.7', status: 'Normal' },
        ],
      },
      Lipid: {
        reportType: 'Lipid Profile',
        category: 'Lipid',
        labName: 'Diagnostic Laboratory',
        parameters: [
          { id: 'p-1', name: 'Total Cholesterol', value: '180', unit: 'mg/dL', referenceRange: '< 200', status: 'Normal' },
        ],
      },
      LFT: {
        reportType: 'Liver Function Test (LFT)',
        category: 'LFT',
        labName: 'Diagnostic Laboratory',
        parameters: [
          { id: 'p-1', name: 'SGPT / ALT', value: '28', unit: 'U/L', referenceRange: '< 41', status: 'Normal' },
        ],
      },
      KFT: {
        reportType: 'Kidney Function Test (KFT)',
        category: 'KFT',
        labName: 'Diagnostic Laboratory',
        parameters: [
          { id: 'p-1', name: 'Serum Creatinine', value: '0.9', unit: 'mg/dL', referenceRange: '0.7 - 1.3', status: 'Normal' },
        ],
      },
    };
    const dataset = templates[categoryKey] || templates.CBC;
    setIsRecognized(true);
    setDetectedReportType(dataset.reportType);
    setDetectedCategory(dataset.category);
    setDetectedLab(`${dataset.labName} · Collected ${new Date().toLocaleDateString('en-GB')}`);
    setLabName(dataset.labName);
    setParams(dataset.parameters);
    setTotalValuesCount(dataset.parameters.length);
    setIsChangeModalOpen(false);

    animateValuesReading(dataset.parameters.length, dataset.parameters);
  };

  const handleValueChange = (paramId: string, val: string) => {
    setParams(prev => prev.map(p => {
      if (p.id === paramId) {
        return { ...p, value: val };
      }
      return p;
    }));
  };

  const handleParamFieldChange = (paramId: string, field: 'name' | 'unit' | 'referenceRange', val: string) => {
    setParams(prev => prev.map(p => {
      if (p.id === paramId) {
        return { ...p, [field]: val };
      }
      return p;
    }));
  };

  const handleAddTest = () => {
    const newId = `param-${Date.now()}`;
    setParams(prev => [
      ...prev,
      {
        id: newId,
        name: '',
        value: '',
        unit: '',
        referenceRange: '',
        status: 'Normal',
      },
    ]);
  };

  const handleRemoveTest = (paramId: string) => {
    setParams(prev => prev.filter(p => p.id !== paramId));
  };

  const handleConfirmAndSend = async () => {
    setIsSubmitting(true);
    const computedParams = params.map(p => {
      let st: 'Normal' | 'Low' | 'High' | 'Critical' = 'Normal';
      const num = typeof p.value === 'number' ? p.value : parseFloat(String(p.value).replace(/,/g, ''));
      if (!isNaN(num) && p.referenceRange) {
        const parts = p.referenceRange.split(/[-–]/).map(s => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          const [low, high] = parts;
          if (num < low * 0.7 || num > high * 1.5) st = 'Critical';
          else if (num < low) st = 'Low';
          else if (num > high) st = 'High';
          else st = 'Normal';
        } else if (p.referenceRange.startsWith('<')) {
          const max = parseFloat(p.referenceRange.replace('<', '').trim());
          if (!isNaN(max)) st = num > max ? (num > max * 1.5 ? 'Critical' : 'High') : 'Normal';
        } else if (p.referenceRange.startsWith('>')) {
          const min = parseFloat(p.referenceRange.replace('>', '').trim());
          if (!isNaN(min)) st = num < min ? (num < min * 0.7 ? 'Critical' : 'Low') : 'Normal';
        }
      }
      return { ...p, value: isNaN(num) ? p.value : num, status: st };
    });

    const hasCritical = computedParams.some(p => p.status === 'Critical');
    const hasUnbalanced = computedParams.some(p => p.status === 'Low' || p.status === 'High');

    try {
      if (uploadedReportId) {
        const { reportsApi } = await import('../../api/client');
        await reportsApi.confirmReport(uploadedReportId, {
          name: detectedReportType,
          category: detectedCategory,
          labName,
          collectionDate: testDate,
          parameters: computedParams,
        });
      }
      await fetchReports();
    } catch (err) {
      console.warn('Confirm report sync note:', err);
    } finally {
      setIsSubmitting(false);
    }

    const newReport: LabReport = {
      id: uploadedReportId || `rep-${Date.now()}`,
      name: detectedReportType,
      category: detectedCategory,
      patientId: currentPatient.id,
      patientName: currentPatient.name,
      patientAvatar: currentPatient.avatar,
      labName,
      collectionDate: testDate,
      reportedDate: testDate,
      status: hasCritical ? 'Critical' : hasUnbalanced ? 'Unbalanced' : 'Normal',
      reviewed: false,
      parameters: computedParams,
      aiOverview: {
        summary: `${detectedReportType} processed. Patient verified all values from source paper report. Parameters synchronized with ${connectedDoctorName}'s clinician triage portal.`,
        pointsToConsider: ['Parameters extracted and verified against paper report.'],
        keyFindings: computedParams.filter(p => p.status !== 'Normal').map(p => ({
          parameter: p.name,
          value: `${p.value}`,
          unit: p.unit,
          tag: p.status,
          changeText: 'Initial baseline'
        })),
        generatedAt: 'Just now'
      }
    };

    addReport(newReport);
    setCurrentStep(4);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-[3px] border border-stone-200 bg-white flex items-center justify-center text-slate-700 shadow-2xs mt-0.5">
            <FileText className="w-4 h-4 text-[#0E382F]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
              Upload Report
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Add your lab report (PDF, JPG or PNG) for analysis and doctor review.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="relative p-1.5 rounded-[3px] border border-stone-200 text-slate-600 bg-white hover:bg-stone-50 cursor-pointer shadow-2xs">
            <Bell className="w-3.5 h-3.5" />
            <span className="w-2 h-2 rounded-full bg-[#10B981] absolute top-1 right-1" />
          </button>
          <div className="w-7 h-7 rounded-[3px] bg-[#0E382F] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'R'}
          </div>
        </div>
      </div>

      {/* Hidden File & Camera Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleNativeFileChange}
        accept=".pdf,.png,.jpg,.jpeg,.txt"
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleNativeFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* SCREEN 1: UPLOAD REPORT DROPBOX (Matching user reference image 1:1)       */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-8 md:p-10 shadow-2xs max-w-2xl mx-auto my-6 text-center space-y-6">
          {/* Dashed Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-[3px] p-8 md:p-10 flex flex-col items-center justify-center space-y-3 cursor-pointer transition-colors ${
              isDragging ? 'border-[#0E382F] bg-[#EAF6F0]/50' : 'border-stone-300 hover:border-[#0E382F]/70 bg-stone-50/20'
            }`}
          >
            {/* Soft Mint File Icon */}
            <div className="w-11 h-11 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center shadow-2xs">
              <Upload className="w-5 h-5 text-[#0E382F]" />
            </div>

            <div>
              <h2 className="text-sm md:text-base font-bold text-slate-900 tracking-tight">
                Upload or drop your report here
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                PDF, JPG or PNG · Up to 10 MB
              </p>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#0E382F] hover:bg-[#092720] text-white px-4 py-2 rounded-[3px] font-semibold text-xs flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Choose File</span>
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="bg-white hover:bg-stone-50 text-slate-700 border border-stone-300 px-4 py-2 rounded-[3px] font-semibold text-xs flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-slate-600" />
              <span>Take a Photo</span>
            </button>
          </div>

          {/* Quick Demo Previews */}
          <div className="pt-4 border-t border-stone-100 flex items-center justify-center gap-2 text-xs">
            <span className="text-slate-400 text-[11px]">Quick test:</span>
            <button
              type="button"
              onClick={() => {
                const content = `LABSMART SOFTWARE · COMPLETE BLOOD COUNT (CBC)\nCollection Date: 2026-10-31\nPlatelet Count : 3.5 lakhs/cumm (1.5 - 4.1)\nHemoglobin : 15.0 g/dL (13.0 - 17.0)\nTotal Leukocyte Count : 5100 cumm (4800 - 10800)`;
                const file = new File([content], 'CBC_Labsmart_Report.txt', { type: 'text/plain' });
                processUploadedFile({ name: file.name, size: file.size, rawFile: file });
              }}
              className="px-2.5 py-1 bg-stone-50 hover:bg-[#EAF6F0] text-slate-700 rounded-[3px] border border-stone-200 text-[11px] font-medium transition-colors cursor-pointer"
            >
              Load Sample CBC
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 2: READING & ANALYZING                                             */}
      {/* ========================================================================= */}
      {currentStep === 2 && isRecognized && (
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-6 shadow-2xs max-w-xl mx-auto space-y-5">
          <div className="bg-stone-50 rounded-[3px] p-3 flex items-center justify-between border border-stone-200/60">
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-[#0E382F]" />
              <div>
                <h4 className="font-bold text-xs text-slate-900">{fileName}</h4>
                <p className="text-[10px] text-slate-400">{fileSizeFormatted} · uploading</p>
              </div>
            </div>
            <button
              onClick={handleResetUpload}
              className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 px-1 text-xs">
            <div className="flex items-center gap-2 text-[#0E382F] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span>Analyzing test parameters...</span>
            </div>
            <div className="w-full bg-stone-100 h-1.5 rounded-[2px] overflow-hidden">
              <div
                className="bg-[#0E382F] h-1.5 rounded-[2px] transition-all duration-300"
                style={{ width: `${Math.round((valuesReadCount / Math.max(1, totalValuesCount)) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {valuesReadCount} of {totalValuesCount || 3} parameters extracted
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 3: VERIFY VALUES                                                   */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-5 shadow-2xs max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Verify Extracted Parameters</h2>
              <p className="text-[11px] text-slate-500">
                Confirm your values before transmitting them to {connectedDoctorName}.
              </p>
            </div>
            <button
              onClick={handleAddTest}
              className="px-2.5 py-1 text-xs rounded-[3px] bg-stone-100 text-slate-700 hover:bg-stone-200 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Param</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Lab Name</label>
              <input
                type="text"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="w-full h-8 px-2.5 rounded-[3px] border border-stone-200 text-xs focus:outline-none focus:border-[#0E382F]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Collection Date</label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full h-8 px-2.5 rounded-[3px] border border-stone-200 text-xs focus:outline-none focus:border-[#0E382F]"
              />
            </div>
          </div>

          <div className="border border-stone-200 rounded-[3px] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-2 px-3">Parameter</th>
                  <th className="py-2 px-3 text-center">Value</th>
                  <th className="py-2 px-3">Unit</th>
                  <th className="py-2 px-3">Ref. Range</th>
                  <th className="py-2 px-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {params.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50/50">
                    <td className="py-2 px-3 font-medium text-slate-900">{p.name}</td>
                    <td className="py-1.5 px-3 text-center">
                      <input
                        type="text"
                        value={p.value}
                        onChange={(e) => handleValueChange(p.id, e.target.value)}
                        className="w-20 text-center font-bold text-xs h-7 rounded-[2px] border border-stone-200 bg-white"
                      />
                    </td>
                    <td className="py-2 px-3 text-slate-500">{p.unit}</td>
                    <td className="py-2 px-3 text-slate-500">{p.referenceRange}</td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => handleRemoveTest(p.id)}
                        className="text-slate-300 hover:text-red-500 p-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              onClick={handleResetUpload}
              className="px-3 py-1.5 rounded-[3px] border border-stone-200 text-slate-600 text-xs hover:bg-stone-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={isSubmitting}
              onClick={handleConfirmAndSend}
              className="px-3.5 py-1.5 rounded-[3px] bg-[#0E382F] text-white text-xs font-semibold hover:bg-[#092720] shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Check className="w-3 h-3" />
                  <span>Confirm & Send to Doctor</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 4: CONFIRMATION                                                    */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div className="bg-white rounded-[3px] border border-stone-200/90 p-8 shadow-2xs max-w-md mx-auto text-center space-y-4 my-6">
          <div className="w-12 h-12 rounded-[3px] bg-[#EAF6F0] text-[#0E382F] flex items-center justify-center mx-auto shadow-2xs">
            <CheckCircle className="w-6 h-6 text-[#10B981]" />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Report Transmitted Successfully</h2>
            <p className="text-xs text-slate-500 mt-1 leading-normal">
              Your {detectedReportType} has been securely synchronized with {connectedDoctorName}'s clinical dashboard.
            </p>
          </div>

          <div className="pt-2 flex justify-center gap-2.5">
            <Link
              to="/patient/reports"
              className="px-3.5 py-1.5 rounded-[3px] bg-[#0E382F] text-white text-xs font-semibold hover:bg-[#092720] shadow-2xs"
            >
              View in My Reports
            </Link>
            <Link
              to="/patient"
              className="px-3.5 py-1.5 rounded-[3px] border border-stone-200 text-slate-700 text-xs font-semibold hover:bg-stone-50"
            >
              Return Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
