export type UserRole = 'patient' | 'doctor' | 'admin';
export type UserRoleType = UserRole | 'system' | 'anonymous';
export type ReportStatus = 'Critical' | 'Unbalanced' | 'Normal';
export type ParameterStatus = 'Normal' | 'Low' | 'High' | 'Critical';
export type TrendDirection = 'up' | 'down' | 'neutral';

export interface ILabParameter {
  id: string;
  name: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: ParameterStatus;
  change?: string;
  trendDirection?: TrendDirection;
  explanation?: string;
  whatItMeans?: string;
  pointsToConsider?: string;
  originalValue?: number;
  correctedValue?: number;
  isEdited?: boolean;
}

export type ReportCategory = 'CBC' | 'Diabetes' | 'HbA1c' | 'Lipid' | 'LFT' | 'KFT' | 'Other';
