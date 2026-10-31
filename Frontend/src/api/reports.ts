import { LabParameter } from '../types';
import { reportsApi } from './client';

export interface ReportAnalysisResult {
  recognized: boolean;
  reportId?: string;
  reportType: string;
  category: 'CBC' | 'HbA1c' | 'Lipid' | 'LFT' | 'KFT' | 'Other';
  labName: string;
  collectionDate: string;
  specimen: string;
  parameters: LabParameter[];
  confidence: number;
  rawFileName: string;
  fileSizeFormatted: string;
  totalValuesCount: number;
}

/**
 * Analyzes an uploaded report file by uploading it to the backend OCR & ML pipeline.
 * If backend is unreachable or parsing is inconclusive, provides intelligent medical fallbacks.
 */
export async function analyzeReport(file: { name: string; size?: number; rawFile?: File }): Promise<ReportAnalysisResult> {
  // Values must only ever come from the uploaded file (via the backend OCR + ML pipeline)
  // or be typed by the patient. Never guess them — a made-up value could reach a doctor.
  if (!(file.rawFile instanceof File)) {
    throw new Error('Please choose a PDF or photo of your report.');
  }

  let uploadRes: any;
  try {
    uploadRes = await reportsApi.uploadReport(file.rawFile);
  } catch (err: any) {
    throw new Error(err?.message ? `We couldn't read this file: ${err.message}` : "We couldn't read this file. Please try again.");
  }
  const rep = uploadRes?.report;
  if (!rep) throw new Error("We couldn't read this file. Please try again.");

  const mappedParams: LabParameter[] = (rep.parameters || []).map((p: any, idx: number) => ({
    id: p.id || p._id || `p-${idx}`,
    name: p.name,
    value: p.value,
    unit: p.unit || '',
    referenceRange: p.referenceRange || '',
    status: p.status || 'Normal',
  }));

  return {
    // Nothing extracted: the patient picks the test type and types the values against the same upload.
    recognized: mappedParams.length > 0,
    reportId: rep.id || rep._id,
    reportType: rep.name || 'Lab Report',
    category: (rep.category as any) || 'Other',
    labName: rep.labName || '',
    collectionDate: rep.collectionDate || '',
    specimen: rep.specimen || '',
    parameters: mappedParams,
    confidence: uploadRes.analysis?.confidence ?? 0,
    rawFileName: file.name,
    fileSizeFormatted: formatFileSize(file.size),
    totalValuesCount: mappedParams.length,
  };
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
