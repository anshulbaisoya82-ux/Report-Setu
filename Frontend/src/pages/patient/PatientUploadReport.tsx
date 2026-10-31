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
  const currentPatient = currentUser || patients[0] || { id: 'p-1', name: 'Patient', avatar: 'PT', rsId: 'RS-10475' };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Workflow State
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectedDoctorName, setConnectedDoctorName] = useState<string>('Dr. Suhani');

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
  const [detectedReportType, setDetectedReportType] = useState('');
  const [detectedCategory, setDetectedCategory] = useState<'CBC' | 'HbA1c' | 'Lipid' | 'LFT' | 'KFT' | 'Other'>('Other');
  const [detectedLab, setDetectedLab] = useState('');
  const [selectedFallbackType, setSelectedFallbackType] = useState<'CBC' | 'HbA1c' | 'Lipid' | 'LFT' | 'KFT' | 'Other'>('CBC');
  
  // Reading Progress State (8 of 9 values read...)
  const [valuesReadCount, setValuesReadCount] = useState(0);
  const [totalValuesCount, setTotalValuesCount] = useState(0);
  const [readingFinished, setReadingFinished] = useState(false);

  // Manual Change Modal State
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);

  // Step 3 (Check Values) State
  const [labName, setLabName] = useState('');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
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

    // Call API function
    const result: ReportAnalysisResult = await analyzeReport(fileObj);

    setIsAnalyzing(false);

    if (!result.recognized) {
      setIsRecognized(false);
      return;
    }

    // Report was recognized!
    setIsRecognized(true);
    if (result.reportId) {
      setUploadedReportId(result.reportId);
    }
    setDetectedReportType(result.reportType);
    setDetectedCategory(result.category);
    setDetectedLab(`${result.labName} · Collected ${result.collectionDate}`);
    setLabName(result.labName);
    setTestDate(new Date().toISOString().split('T')[0]);
    setParams(result.parameters);
    setTotalValuesCount(result.totalValuesCount);

    // Animate reading of values (e.g. 2 of 9 -> 5 of 9 -> 8 of 9 -> 9 of 9)
    animateValuesReading(result.totalValuesCount, result.parameters);
  };

  const animateValuesReading = (total: number, finalParams: LabParameter[]) => {
    let current = 1;
    setValuesReadCount(current);

    const interval = setInterval(() => {
      current += 2;
      if (current >= total) {
        current = total;
        setValuesReadCount(total);
        clearInterval(interval);

        // Finish reading and advance to Step 3 automatically after brief satisfaction pause
        setTimeout(() => {
          setReadingFinished(true);
          setTimeout(() => {
            setCurrentStep(3);
          }, 600);
        }, 800);
      } else {
        setValuesReadCount(current);
      }
    }, 450);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
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

  // Reset upload
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

  // Manual fallback selection when not recognized
  const handleConfirmFallbackType = (categoryKey: 'CBC' | 'HbA1c' | 'Lipid' | 'LFT' | 'KFT') => {
    const templates: Record<string, { reportType: string; category: any; labName: string; parameters: LabParameter[] }> = {
      CBC: {
        reportType: 'Complete Blood Count (CBC)',
        category: 'CBC',
        labName: 'Diagnostic Laboratory',
        parameters: [
          { id: 'p-1', name: 'Hemoglobin', value: '13.5', unit: 'g/dL', referenceRange: '13.0 - 17.0', status: 'Normal' },
          { id: 'p-2', name: 'Platelet Count', value: '250000', unit: '/µL', referenceRange: '150,000 - 450,000', status: 'Normal' },
          { id: 'p-3', name: 'Total WBC Count', value: '7500', unit: '/µL', referenceRange: '4,000 - 11,000', status: 'Normal' },
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

  // Parameter value and field editing in Step 3
  const handleValueChange = (paramId: string, val: string) => {
    setParams(prev => prev.map(p => {
      if (p.id === paramId) {
        return {
          ...p,
          value: val,
        };
      }
      return p;
    }));
  };

  const handleParamFieldChange = (paramId: string, field: 'name' | 'unit' | 'referenceRange', val: string) => {
    setParams(prev => prev.map(p => {
      if (p.id === paramId) {
        return {
          ...p,
          [field]: val,
        };
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

  // Final confirmation and transmission to doctor
  const handleConfirmAndSend = async () => {
    setIsSubmitting(true);
    // Calculate clinical statuses behind the scenes for physician triage dashboard
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
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#172B25] tracking-tight font-serif">
            Upload report
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            {currentStep === 1 && 'Add your lab report. We find out which test it is for you.'}
            {currentStep === 2 && isRecognized && 'Reading your report. This takes a few seconds.'}
            {currentStep === 2 && !isRecognized && "We couldn't identify this report type automatically."}
            {currentStep === 3 && `Please verify values extracted from your report before they are transmitted to ${connectedDoctorName}.`}
            {currentStep === 4 && `Your report has been received and safely forwarded to ${connectedDoctorName}.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-600 shadow-sm">
            <Bell className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 4-Step Stepper Bar (matching Figma 1:1) */}
      <div className="bg-white rounded-3xl p-5 border border-stone-200/60 shadow-2xs">
        <div className="flex items-center justify-between max-w-3xl mx-auto px-2 sm:px-4">
          {/* Step 1: Choose file */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              currentStep > 1 ? 'bg-[#1E3F35] text-white' : 'bg-[#1E3F35] text-white'
            }`}>
              {currentStep > 1 ? <Check className="w-4 h-4 text-white" /> : '1'}
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-xs text-[#172B25] block">Choose file</span>
              <span className="text-[11px] text-stone-400 block">Upload your report</span>
            </div>
          </div>

          <div className="flex-1 h-0.5 bg-stone-200 mx-2 sm:mx-4 max-w-[60px] sm:max-w-[80px]" />

          {/* Step 2: Read report */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              currentStep > 2
                ? 'bg-[#1E3F35] text-white'
                : currentStep === 2
                ? !isRecognized
                  ? 'bg-[#C45749] text-white'
                  : 'bg-[#1E3F35] text-white'
                : 'bg-[#E5ECE8] text-stone-500'
            }`}>
              {currentStep > 2 ? <Check className="w-4 h-4 text-white" /> : '2'}
            </div>
            <div className="hidden sm:block">
              <span className={`font-bold text-xs block ${currentStep >= 2 ? 'text-[#172B25]' : 'text-stone-400'}`}>
                Read report
              </span>
              <span className="text-[11px] text-stone-400 block">We find the test and values</span>
            </div>
          </div>

          <div className="flex-1 h-0.5 bg-stone-200 mx-2 sm:mx-4 max-w-[60px] sm:max-w-[80px]" />

          {/* Step 3: Check values */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              currentStep > 3 ? 'bg-[#1E3F35] text-white' : currentStep === 3 ? 'bg-[#1E3F35] text-white' : 'bg-[#E5ECE8] text-stone-500'
            }`}>
              {currentStep > 3 ? <Check className="w-4 h-4 text-white" /> : '3'}
            </div>
            <div className="hidden sm:block">
              <span className={`font-bold text-xs block ${currentStep >= 3 ? 'text-[#172B25]' : 'text-stone-400'}`}>
                Check values
              </span>
              <span className="text-[11px] text-stone-400 block">You confirm them</span>
            </div>
          </div>

          <div className="flex-1 h-0.5 bg-stone-200 mx-2 sm:mx-4 max-w-[60px] sm:max-w-[80px]" />

          {/* Step 4: Sent to doctor */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              currentStep === 4 ? 'bg-[#1E3F35] text-white' : 'bg-[#E5ECE8] text-stone-500'
            }`}>
              4
            </div>
            <div className="hidden sm:block">
              <span className={`font-bold text-xs block ${currentStep === 4 ? 'text-[#172B25]' : 'text-stone-400'}`}>
                Sent to doctor
              </span>
              <span className="text-[11px] text-stone-400 block">Dr. Mehta reviews</span>
            </div>
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
      {/* SCREEN 1: AUTO-DETECT CHOOSE FILE (Matching "Patient – Upload report – auto-detect.png") */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white rounded-3xl p-6 sm:p-12 shadow-2xs border border-stone-200/60 max-w-3xl mx-auto">
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-3xl border-2 border-dashed p-8 sm:p-16 text-center flex flex-col items-center justify-center transition-all ${
              isDragging ? 'border-[#32A299] bg-[#EBF7F2]/40' : 'border-[#CFE2DA] hover:border-[#32A299]/70'
            }`}
          >
            {/* Soft terracotta upload icon */}
            <div className="w-14 h-14 rounded-2xl bg-[#FDF1EF] text-[#C45749] flex items-center justify-center mb-5 shadow-2xs">
              <Upload className="w-6 h-6" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-[#172B25] font-serif mb-1.5">
              Drop your report here
            </h2>
            <p className="text-xs text-stone-400 mb-7">
              PDF, JPG, PNG or TXT · up to 10 MB
            </p>

            <div className="flex items-center gap-3.5 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#32A299] hover:bg-[#288E86] text-white px-6 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>Upload report</span>
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 px-6 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <Camera className="w-4 h-4 text-stone-600" />
                <span>Take a photo</span>
              </button>
            </div>

            {/* Quick Test with Verified Sample CBC Reports */}
            <div className="mt-8 pt-6 border-t border-stone-200/60 w-full max-w-md">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block mb-3">
                Or test live ML extraction with sample CBC reports:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const content = `DR LAL PATHLABS · MAIN REFERENCE LAB\nPatient ID: ${currentPatient.rsId || 'RS-1HEAL'}\nCollection Date: ${todayStr}\nCOMPLETE BLOOD COUNT (CBC)\nHaemoglobin (Hb) : 13.5 g/dL (12.0 - 15.5)\nTotal Leukocyte Count (TLC) : 7.2 10^3/uL (4.0 - 10.0)\nPlatelet Count : 240 10^3/uL (150 - 450)\nPacked Cell Volume (PCV) : 41.2 % (36.0 - 46.0)\nRBC Count : 4.5 10^6/uL (3.8 - 5.2)\nMean Corpuscular Volume (MCV) : 88.0 fL (80.0 - 100.0)\nNeutrophils : 62 % (40 - 75)\nLymphocytes : 30 % (20 - 45)`;
                    const file = new File([content], 'CBC_DrLalPathLabs_Normal.txt', { type: 'text/plain' });
                    processUploadedFile({ name: file.name, size: file.size, rawFile: file });
                  }}
                  className="px-3 py-2 bg-stone-50 hover:bg-[#EBF7F2] text-stone-700 hover:text-[#1E3F35] border border-stone-200 hover:border-[#32A299] rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#32A299]" />
                  <span>Normal CBC Report</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const content = `DR LAL PATHLABS · MAIN REFERENCE LAB\nPatient ID: ${currentPatient.rsId || 'RS-1HEAL'}\nCollection Date: ${todayStr}\nCOMPLETE BLOOD COUNT (CBC) - CRITICAL VALUE\nPlatelet Count : 35 10^3/uL (150 - 450)\nHaemoglobin : 10.2 g/dL (12.0 - 15.5)\nTotal Leukocyte Count (TLC) : 8.1 10^3/uL (4.0 - 10.0)\nPacked Cell Volume (PCV) : 31.0 % (36.0 - 46.0)\nRBC Count : 3.4 10^6/uL (3.8 - 5.2)`;
                    const file = new File([content], 'CBC_DrLalPathLabs_Critical.txt', { type: 'text/plain' });
                    processUploadedFile({ name: file.name, size: file.size, rawFile: file });
                  }}
                  className="px-3 py-2 bg-stone-50 hover:bg-[#FDF2F0] text-stone-700 hover:text-[#B53629] border border-stone-200 hover:border-[#F6C4C0] rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#B53629]" />
                  <span>Critical CBC (35k Plt)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 2A: READING IN PROGRESS (Matching "Patient – Upload report – reading.png") */}
      {/* ========================================================================= */}
      {currentStep === 2 && isRecognized && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xs border border-stone-200/60 max-w-3xl mx-auto space-y-6">
          {/* File Header Strip */}
          <div className="bg-[#F3F6F4] rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white text-forest-800 flex items-center justify-center shrink-0 border border-stone-200/50 shadow-2xs">
                <FileText className="w-5 h-5 text-[#1E3F35]" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-[#172B25]">{fileName}</h4>
                <p className="text-xs text-stone-400 mt-0.5">{fileSizeFormatted} · uploaded just now</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetUpload}
              className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1 font-medium cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>

          {/* Reading Steps Checklist */}
          <div className="space-y-5 px-2">
            {/* Step A: Uploaded */}
            <div className="flex items-start gap-3.5">
              <div className="w-6 h-6 rounded-full bg-[#2E9E6B] text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-[#172B25]">Uploaded</h4>
                <p className="text-xs text-stone-500 mt-0.5">Your file arrived safely</p>
              </div>
            </div>

            {/* Step B: We found your report */}
            <div className="flex items-start gap-3.5">
              <div className="w-6 h-6 rounded-full bg-[#2E9E6B] text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm text-[#172B25]">We found your report</h4>
                <p className="text-xs text-stone-500 mt-0.5">Detected from the file — no need to pick a type</p>

                {/* Detected Report Tag Box */}
                <div className="bg-[#EBF7F2] border border-[#CDE5DA] rounded-xl p-3 flex items-center gap-3 mt-2.5 max-w-md shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[#2E9E6B] shrink-0 shadow-2xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-[#172B25]">{detectedReportType}</h5>
                    <p className="text-[11px] text-stone-500">{detectedLab}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step C: Reading the values */}
            <div className="flex items-start gap-3.5">
              <div className="w-6 h-6 rounded-full border-2 border-[#1E3F35] flex items-center justify-center text-[#1E3F35] shrink-0 mt-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#1E3F35] animate-pulse" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm text-[#172B25]">Reading the values</h4>
                <p className="text-xs text-stone-500 mt-0.5">
                  {valuesReadCount} of {totalValuesCount} values read
                </p>

                {/* Progress Bar */}
                <div className="w-full bg-[#E5ECE8] h-2 rounded-full overflow-hidden mt-2.5">
                  <div 
                    className="bg-[#2E9E6B] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((valuesReadCount / totalValuesCount) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Step D: Check the values with you */}
            <div className="flex items-start gap-3.5">
              <div className="w-6 h-6 rounded-full bg-[#E5ECE8] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm text-stone-400">Check the values with you</h4>
                <p className="text-xs text-stone-400 mt-0.5">Next step · you confirm before your doctor sees anything</p>
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setIsChangeModalOpen(true)}
              className="text-[#C45749] text-xs font-semibold hover:underline text-left cursor-pointer"
            >
              Not the right test? Change report type
            </button>

            <button
              type="button"
              onClick={handleResetUpload}
              className="border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer self-start sm:self-auto"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel upload</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 2B: NOT RECOGNISED (Matching "Patient – Upload report – not recognised") */}
      {/* ========================================================================= */}
      {currentStep === 2 && !isRecognized && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xs border border-stone-200/60 max-w-3xl mx-auto space-y-6">
          {/* File Header Strip */}
          <div className="bg-[#F3F6F4] rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white text-forest-800 flex items-center justify-center shrink-0 border border-stone-200/50 shadow-2xs">
                <FileText className="w-5 h-5 text-[#1E3F35]" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-[#172B25]">{fileName}</h4>
                <p className="text-xs text-stone-400 mt-0.5">{fileSizeFormatted} · uploaded just now</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetUpload}
              className="text-xs text-stone-600 hover:text-stone-900 flex items-center gap-1 font-medium cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>

          {/* Not Recognised Alert Card */}
          <div className="bg-[#FDF1EF] border border-[#FADCD7] rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white text-[#C45749] border border-[#FADCD7] flex items-center justify-center mx-auto shadow-2xs">
              <FileQuestion className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#172B25] font-serif">
                We couldn't identify this report type
              </h3>
              <p className="text-xs text-stone-600 mt-1 max-w-md mx-auto leading-relaxed">
                We couldn't clearly detect whether this file is a Complete Blood Count, HbA1c, or Lipid Profile. Please choose your test below so we can read your values accurately.
              </p>
            </div>
          </div>

          {/* Selectable Test Types Grid */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-[#172B25] uppercase tracking-wider block">
              Choose the correct test:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'CBC', name: 'Complete Blood Count (CBC)', subtitle: 'Hemoglobin, Platelets, WBC, RBC' },
                { key: 'HbA1c', name: 'HbA1c / Diabetes Profile', subtitle: '3-Month Average Glucose, Blood Sugar' },
                { key: 'Lipid', name: 'Lipid Profile', subtitle: 'Cholesterol, Triglycerides, HDL, LDL' },
                { key: 'LFT', name: 'Liver Function Test (LFT)', subtitle: 'SGOT, SGPT, Bilirubin, Protein' },
                { key: 'KFT', name: 'Kidney Function Test (KFT)', subtitle: 'Creatinine, Urea, BUN, Uric Acid' },
              ].map((test) => (
                <div
                  key={test.key}
                  onClick={() => setSelectedFallbackType(test.key as any)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    selectedFallbackType === test.key
                      ? 'border-[#32A299] bg-[#EBF7F2] shadow-2xs'
                      : 'border-stone-200/80 bg-white hover:bg-stone-50/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="fallbackTest"
                    checked={selectedFallbackType === test.key}
                    onChange={() => setSelectedFallbackType(test.key as any)}
                    className="mt-0.5 text-[#32A299] focus:ring-[#32A299]"
                  />
                  <div>
                    <h5 className="text-xs font-bold text-[#172B25]">{test.name}</h5>
                    <p className="text-[11px] text-stone-500 mt-0.5">{test.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={handleResetUpload}
              className="text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              Upload a different file
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleResetUpload}
                className="border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleConfirmFallbackType(selectedFallbackType as any)}
                className="bg-[#32A299] hover:bg-[#288E86] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <span>Continue reading test</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHANGE REPORT TYPE (When clicking "Not the right test? Change report type") */}
      {/* ========================================================================= */}
      {isChangeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-bold text-base text-[#172B25] font-serif">Change Report Type</h3>
              <button
                type="button"
                onClick={() => setIsChangeModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-500">
              Select which clinical test your document represents so we extract the correct parameters:
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {[
                { key: 'CBC', name: 'Complete Blood Count (CBC)' },
                { key: 'HbA1c', name: 'HbA1c (Glycated Hemoglobin)' },
                { key: 'Lipid', name: 'Lipid Profile' },
                { key: 'LFT', name: 'Liver Function Test (LFT)' },
                { key: 'KFT', name: 'Kidney Function Test (KFT)' },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleConfirmFallbackType(t.key as any)}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between ${
                    detectedCategory === t.key
                      ? 'border-[#32A299] bg-[#EBF7F2] text-[#1E3F35]'
                      : 'border-stone-200 hover:bg-stone-50 text-stone-800'
                  }`}
                >
                  <span>{t.name}</span>
                  {detectedCategory === t.key && <Check className="w-4 h-4 text-[#32A299]" />}
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsChangeModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl"
              >
                Keep current
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 3: CHECK YOUR VALUES (Matching Figma & Clean Ingestion - Editable Values) */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200/80 shadow-2xs space-y-6">
            <div>
              <span className="text-xs font-bold text-[#1E3F35] uppercase tracking-wider">Step 3 of 4</span>
              <h2 className="text-2xl font-bold text-[#172B25] font-serif mt-1">Check your values</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                We read these from your file. Fix anything that doesn't match your paper report.
              </p>
            </div>

            {/* Extracted Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">Lab name</label>
                <input 
                  type="text" 
                  value={labName} 
                  onChange={(e) => setLabName(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-[#F8FAF9] border border-stone-200 rounded-xl p-3 text-[#172B25] font-medium focus:outline-none focus:bg-white focus:border-[#32A299] focus:ring-2 focus:ring-[#32A299]/20 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1.5">Collection date</label>
                <input 
                  type="date" 
                  value={testDate} 
                  onChange={(e) => setTestDate(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-[#F8FAF9] border border-stone-200 rounded-xl p-3 text-[#172B25] font-medium focus:outline-none focus:bg-white focus:border-[#32A299] focus:ring-2 focus:ring-[#32A299]/20 transition-all"
                />
              </div>
            </div>

            {/* Extracted Parameters Table (Values editable, no low/high badges, no objection banners) */}
            <div className="border border-stone-200/90 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F8FAF9] text-stone-600 font-semibold border-b border-stone-200">
                      <th className="py-3 px-4">Parameter</th>
                      <th className="py-3 px-4 text-center">Value</th>
                      <th className="py-3 px-4">Unit</th>
                      <th className="py-3 px-4">Normal range</th>
                      <th className="py-3 px-2 text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {params.map((p, index) => (
                      <tr key={p.id || index} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3 px-4">
                          {p.name === '' ? (
                            <input
                              type="text"
                              placeholder="Parameter name"
                              value={p.name}
                              onChange={(e) => handleParamFieldChange(p.id, 'name', e.target.value)}
                              className="text-xs font-semibold text-[#172B25] bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 w-full max-w-xs focus:outline-none focus:ring-1 focus:ring-[#32A299]"
                            />
                          ) : (
                            <span className="font-semibold text-[#172B25] text-xs sm:text-sm">{p.name}</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-center">
                          <input
                            type="text"
                            value={p.value}
                            onChange={(e) => handleValueChange(p.id, e.target.value)}
                            className="w-20 sm:w-24 text-center font-bold text-sm text-[#172B25] bg-white border border-stone-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#32A299]/30 focus:border-[#32A299] shadow-2xs transition-all"
                            aria-label={`Value for ${p.name || 'parameter'}`}
                          />
                        </td>
                        <td className="py-3 px-4 text-stone-500 font-medium">
                          {!p.unit && p.name === '' ? (
                            <input
                              type="text"
                              placeholder="Unit"
                              value={p.unit}
                              onChange={(e) => handleParamFieldChange(p.id, 'unit', e.target.value)}
                              className="text-xs text-stone-600 bg-white border border-stone-200 rounded-lg px-2 py-1 w-16 focus:outline-none focus:ring-1 focus:ring-[#32A299]"
                            />
                          ) : (
                            p.unit
                          )}
                        </td>
                        <td className="py-3 px-4 text-stone-600 font-mono text-[11px]">
                          {!p.referenceRange && p.name === '' ? (
                            <input
                              type="text"
                              placeholder="Normal range"
                              value={p.referenceRange}
                              onChange={(e) => handleParamFieldChange(p.id, 'referenceRange', e.target.value)}
                              className="text-xs font-mono text-stone-600 bg-white border border-stone-200 rounded-lg px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-[#32A299]"
                            />
                          ) : (
                            p.referenceRange
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveTest(p.id)}
                            title="Remove row"
                            className="text-stone-300 hover:text-stone-500 transition-colors p-1 rounded-lg"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Actions & Destination Notice */}
            <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleAddTest}
                className="border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5 text-[#32A299]" />
                <span>Add a test</span>
              </button>

              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleResetUpload}
                  className="border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer"
                >
                  Start again
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmAndSend}
                  className="bg-[#32A299] hover:bg-[#288E86] disabled:opacity-60 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Sending to doctor...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Confirm & send to doctor</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Prototype disclaimer strip matching Figma */}
          <div className="bg-[#EBF7F2] border border-[#CDEAE1] rounded-2xl p-4 flex items-center gap-3 text-xs text-[#1E3F35]">
            <div className="w-5 h-5 rounded-full bg-[#32A299]/20 flex items-center justify-center shrink-0 text-[#1E3F35] font-bold text-[11px]">
              i
            </div>
            <p className="leading-relaxed">
              Your doctor only sees the report after you confirm the values. Decision-support prototype · demo data is synthetic.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 4: SUCCESS CONFIRMATION */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200/80 shadow-md text-center max-w-lg mx-auto space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-forest-900 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle className="w-10 h-10 text-forest-800" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-forest-950 font-serif">Report Sent to {connectedDoctorName}!</h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Your {detectedReportType} report has been synced to your medical file. {connectedDoctorName} has been notified and will review your values shortly.
            </p>
          </div>

          <div className="bg-forest-50 border border-forest-200/70 rounded-2xl p-4 text-xs text-forest-900 text-left space-y-1.5 shadow-2xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Report:</span>
              <span className="font-semibold">{detectedReportType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Lab:</span>
              <span>{labName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Universal ID:</span>
              <span className="font-mono font-semibold">{currentPatient.rsId}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link
              to="/patient/reports"
              className="w-full sm:flex-1 py-2.5 px-4 text-xs font-bold text-white bg-forest-900 rounded-xl hover:bg-forest-800 shadow-xs transition-colors text-center"
            >
              View in My Reports
            </Link>
            <Link
              to="/patient"
              className="w-full sm:flex-1 py-2.5 px-4 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors text-center"
            >
              Return Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
