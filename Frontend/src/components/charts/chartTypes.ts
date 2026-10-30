export type ClinicalStatus = 'Normal' | 'Low' | 'High' | 'Critical';

export type BiomarkerCategory = 'CBC' | 'Diabetes' | 'Lipid' | 'LFT' | 'KFT' | 'General';

export type MedicalChartDateRange = 'all' | '3m' | '6m' | '1y';

export interface ClinicalDataPoint {
  id: string;
  date: string; // Formatted date e.g. "22 Oct 2026"
  rawDate: string; // ISO date string for chronological sorting/filtering
  value: number; // Clean numerical value for plotting on Y-axis
  displayValue: string; // Formatted text e.g. "1,80,000" or "13.2"
  unit: string;
  status: ClinicalStatus;
  referenceRange: string;
  refLow: number;
  refHigh: number;
  reportId?: string;
  reportName?: string;
  labName?: string;
  delta?: number;
  pctChange?: number;
  isCurrent?: boolean;
  isEdited?: boolean;
  notes?: string;
}

export interface BiomarkerDefinition {
  key: string;
  name: string;
  aliases: string[];
  category: BiomarkerCategory;
  defaultUnit: string;
  defaultRefLow: number;
  defaultRefHigh: number;
  precision: number;
  description: string;
  clinicalMeaning: string;
  yAxisPadPercent?: number;
}

export interface ChartThemeColors {
  primaryLine: string;
  primaryArea: string;
  referenceRangeBand: string;
  referenceLineBorder: string;
  pointNormal: string;
  pointLowHigh: string;
  pointCritical: string;
  gridLine: string;
  axisText: string;
  cardBg: string;
}

export const CLINICAL_CHART_THEME: ChartThemeColors = {
  primaryLine: '#219E91', // Deep clinical teal
  primaryArea: 'rgba(33, 158, 145, 0.08)',
  referenceRangeBand: 'rgba(234, 245, 239, 0.85)', // Soft green shaded reference band
  referenceLineBorder: '#CAD8CF',
  pointNormal: '#219E91',
  pointLowHigh: '#E9A23B', // Amber for below/above range
  pointCritical: '#DC5555', // Clinical red
  gridLine: '#E9EEEC', // Very light grey grid
  axisText: '#77847F', // Muted grey
  cardBg: '#FFFFFF',
};
