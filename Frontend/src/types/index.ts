export type PriorityState = 'Critical' | 'Unbalanced' | 'Normal' | 'Needs Review' | 'Follow-up due' | 'Up to date';

export interface LabParameter {
  id: string;
  name: string;
  value: number | string;
  unit: string;
  referenceRange: string;
  status: 'Normal' | 'Low' | 'High' | 'Critical';
  change?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  explanation?: string;
  whatItMeans?: string;
  pointsToConsider?: string;
}

export interface LabReport {
  id: string;
  name: string;
  category: 'CBC' | 'Diabetes' | 'HbA1c' | 'Lipid' | 'LFT' | 'KFT' | 'Other';
  patientId: string;
  patientName: string;
  patientAvatar: string;
  labName: string;
  collectionDate: string;
  reportedDate: string;
  status: 'Critical' | 'Unbalanced' | 'Normal';
  reviewed: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewStatus?: 'pending' | 'in_review' | 'approved';
  doctorViewed?: boolean;
  doctorViewedAt?: string;
  urgencyScore?: number;
  parameters: LabParameter[];
  aiOverview: {
    summary: string;
    pointsToConsider: string[];
    keyFindings: {
      parameter: string;
      value: string;
      unit: string;
      tag: 'Low' | 'High' | 'Normal' | 'Critical';
      changeText: string;
    }[];
    generatedAt: string;
  };
  doctorSummary?: {
    text: string;
    hindiText?: string;
    tone: 'Plain language' | 'More detail' | 'Brief';
    approvedAt: string;
    doctorName: string;
    nextTestDate?: string;
    medicinesStatus?: 'No change' | 'Changed';
    sentVia?: ('App' | 'SMS' | 'Email')[];
  };
  historicalTrends?: {
    date: string;
    platelets?: number;
    hemoglobin?: number;
    wbc?: number;
    rbc?: number;
    hba1c?: number;
  }[];
}

export interface Patient {
  id: string;
  rsId: string;
  name: string;
  avatar: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  location: string;
  bloodGroup: string;
  conditions: string[];
  lastVisitDate: string;
  status: PriorityState;
  lastReportTime: string;
  lastReportName: string;
  connectedDoctors: string[];
}

export interface MedicineScheduleItem {
  id: string;
  name: string;
  dose: string;
  timing: string;
  scheduledTime: string;
  state: 'taken' | 'due' | 'snoozed' | 'missed';
  takenAt?: string;
  instructions?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  name: string;
  instructions: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  remainingDays: number;
  status: 'Active' | 'Ended';
  doctorName: string;
  advice: string[];
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientRsId: string;
  doctorName: string;
  reason: string;
  date: string;
  time: string;
  type: 'In-person' | 'Video call' | 'Phone call';
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';
  requestedAt?: string;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'patient' | 'assistant' | 'doctor' | 'system';
  text: string;
  timestamp: string;
  isMedicineQuestion?: boolean;
  citations?: Array<{
    date: string;
    testName: string;
    value: number;
    unit: string;
  }>;
}

export interface PatientQuestionThread {
  id: string;
  patientId: string;
  patientName: string;
  patientRsId: string;
  patientAvatar: string;
  reportContext: string;
  category: 'General' | 'Medicine' | 'Report';
  unreadCount: number;
  lastMessageTime: string;
  isAiPaused?: boolean;
  doctorName?: string;
  messages: ChatMessage[];
  suggestedReply?: string;
}
