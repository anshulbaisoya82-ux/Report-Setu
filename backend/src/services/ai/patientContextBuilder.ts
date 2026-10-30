import { prisma } from '../../config/prisma';
import { NotFoundError } from '../../utils/errors';

export interface PatientProfileContext {
  id: string;
  rsId: string;
  name: string;
  age: number;
  gender: string;
  bloodGroup: string;
  conditions: string[];
  location?: string;
}

export interface ConfirmedMeasurementContext {
  reportId: string;
  reportName: string;
  reportDate: string;
  testName: string;
  value: number;
  unit: string;
  status: string;
  referenceRange: string;
}

export interface LongitudinalTrendContext {
  testName: string;
  direction: 'rising' | 'falling' | 'stable';
  latestValue: number;
  previousValue?: number;
  delta?: number;
  unit: string;
  dates: string[];
}

export interface ApprovedSummaryContext {
  reportId: string;
  reportName: string;
  reportDate: string;
  summary: string;
  hindiSummary?: string;
  doctorName: string;
  approvedAt: string;
}

export interface ActivePrescriptionContext {
  id: string;
  doctorName: string;
  prescriptionName: string;
  medicines: Array<{
    name: string;
    dose: string;
    timing: string;
    frequency?: string;
    instructions?: string;
  }>;
  instructions: string;
  startDate: string;
  endDate: string;
}

export interface ConversationHistoryContext {
  sender: 'patient' | 'assistant' | 'doctor';
  text: string;
  timestamp: string;
}

export interface PatientContext {
  profile: PatientProfileContext;
  confirmedReportsCount: number;
  measurements: ConfirmedMeasurementContext[];
  trends: LongitudinalTrendContext[];
  approvedSummaries: ApprovedSummaryContext[];
  activePrescriptions: ActivePrescriptionContext[];
  recentConversation: ConversationHistoryContext[];
  // Metadata verifying strict safety boundary
  sanitizedAt: string;
  hasPrivateNotes: false;
}

type ReportParameter = {
  name: string;
  value: number;
  correctedValue?: number;
  unit: string;
  status: string;
  referenceRange: string;
};

type DoctorSummaryJson = {
  text?: string;
  hindiText?: string;
  doctorName?: string;
  approvedAt?: string;
};

type PrescriptionMedicineJson = ActivePrescriptionContext['medicines'][number];

const isConversationSender = (sender: string): sender is ConversationHistoryContext['sender'] =>
  sender === 'patient' || sender === 'doctor' || sender === 'assistant';

/**
 * Deterministic Patient Context Builder (Task 9.1).
 * Assembles clinical context on-demand from PostgreSQL for grounded patient QA.
 * 
 * Strict Safety Guarantee:
 * - Excludes pending, draft, or unapproved reports and summaries.
 * - Strictly strips and omits doctor-private clinical notes (DoctorNote) and internal priority labels.
 */
export async function buildPatientContext(patientId: string): Promise<PatientContext> {

  // 1. Fetch patient profile
  const profile = await prisma.patientProfile.findFirst({
    where: { OR: [{ id: patientId }, { userId: patientId }] },
  });

  if (!profile) {
    throw new NotFoundError('Patient profile not found for context assembly');
  }

  const profileContext: PatientProfileContext = {
    id: profile.id,
    rsId: profile.rsId,
    name: profile.name,
    age: profile.age,
    gender: profile.gender,
    bloodGroup: profile.bloodGroup || 'Unknown',
    conditions: profile.conditions || [],
    location: profile.location,
  };

  // 2. Fetch ONLY confirmed and approved reports
  // Excludes 'pending', 'in_review', and unapproved drafts
  const reports = await prisma.report.findMany({
    where: { patientId: profile.id, reviewed: true },
    orderBy: [{ collectionDate: 'desc' }, { createdAt: 'desc' }],
  });

  const measurements: ConfirmedMeasurementContext[] = [];
  const approvedSummaries: ApprovedSummaryContext[] = [];

  // Group measurements by parameter name for trend evaluation
  const paramHistory = new Map<string, Array<{ value: number; unit: string; date: string }>>();

  for (const report of reports) {
    const reportDateStr = report.collectionDate
      ? new Date(report.collectionDate).toISOString().split('T')[0]
      : new Date(report.createdAt).toISOString().split('T')[0];

    // Collect approved summaries
    const summary = report.doctorSummary as DoctorSummaryJson | null;
    if (summary?.text) {
      approvedSummaries.push({
        reportId: report.id,
        reportName: report.name,
        reportDate: reportDateStr,
        summary: summary.text,
        hindiSummary: summary.hindiText,
        doctorName: summary.doctorName || 'Attending Physician',
        approvedAt: summary.approvedAt
          ? new Date(summary.approvedAt).toISOString()
          : reportDateStr,
      });
    }

    // Collect confirmed parameters
    const parameters = report.parameters as ReportParameter[];
    if (Array.isArray(parameters)) {
      for (const param of parameters) {
        const value = param.correctedValue ?? param.value;
        measurements.push({
          reportId: report.id,
          reportName: report.name,
          reportDate: reportDateStr,
          testName: param.name,
          value,
          unit: param.unit,
          status: param.status,
          referenceRange: param.referenceRange,
        });

        const normalizedName = param.name.trim().toLowerCase();
        if (!paramHistory.has(normalizedName)) {
          paramHistory.set(normalizedName, []);
        }
        paramHistory.get(normalizedName)!.push({
          value,
          unit: param.unit,
          date: reportDateStr,
        });
      }
    }
  }

  // 3. Compute longitudinal trends from history
  const trends: LongitudinalTrendContext[] = [];
  for (const [name, history] of paramHistory.entries()) {
    if (history.length >= 2) {
      // history is sorted desc by date
      const latest = history[0];
      const previous = history[1];
      const delta = Math.round((latest.value - previous.value) * 100) / 100;
      let direction: 'rising' | 'falling' | 'stable' = 'stable';

      const pctChange = Math.abs(delta) / (previous.value || 1);
      if (pctChange > 0.03) {
        direction = delta > 0 ? 'rising' : 'falling';
      }

      trends.push({
        testName: name,
        direction,
        latestValue: latest.value,
        previousValue: previous.value,
        delta,
        unit: latest.unit,
        dates: [previous.date, latest.date],
      });
    }
  }

  // 4. Fetch Active Prescriptions
  const prescriptions = await prisma.prescription.findMany({
    where: { patientId: profile.id, status: 'Active' },
    orderBy: { startDate: 'desc' },
  });

  const activePrescriptions: ActivePrescriptionContext[] = prescriptions.map((p) => ({
    id: p.id,
    doctorName: p.doctorName,
    prescriptionName: p.name,
    medicines: Array.isArray(p.medicines) ? p.medicines as PrescriptionMedicineJson[] : [],
    instructions: p.instructions,
    startDate: new Date(p.startDate).toISOString().split('T')[0],
    endDate: new Date(p.endDate).toISOString().split('T')[0],
  }));

  // 5. Fetch recent conversation history
  const messages = await prisma.chatMessage.findMany({
    where: { patientId: profile.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const recentConversation: ConversationHistoryContext[] = messages
    .reverse()
    .map((m) => ({
      sender: isConversationSender(m.sender) ? m.sender : 'assistant',
      text: m.text,
      timestamp: new Date(m.createdAt).toISOString(),
    }));

  return {
    profile: profileContext,
    confirmedReportsCount: reports.length,
    measurements,
    trends,
    approvedSummaries,
    activePrescriptions,
    recentConversation,
    sanitizedAt: new Date().toISOString(),
    hasPrivateNotes: false,
  };
}
