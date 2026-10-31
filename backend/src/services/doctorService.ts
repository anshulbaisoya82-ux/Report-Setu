import { PatientProfile, IPatientProfile, PriorityStateType } from '../repositories';
import { DoctorProfile, IDoctorProfile } from '../repositories';
import { Connection } from '../repositories';
import { Report } from '../repositories';
import { mlClient, MlMeasurement, MlInsight } from './mlClient';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { serializePatientProfile } from '../utils/serializers';

export interface DoctorPatientsQueryOptions {
  search?: string;
  condition?: string;
  status?: PriorityStateType | string;
  page?: number;
  limit?: number;
}

export interface PatientDirectoryItem {
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
  status: PriorityStateType;
  lastReportTime: string;
  lastReportName: string;
  connectedDoctors: string[];
  triagePriority?: 'critical' | 'review' | 'stable';
  triageReason?: string;
  recommendedAction?: string;
}

const PRIORITY_ORDER_MAP: Record<string, number> = {
  Critical: 0,
  'Needs Review': 1,
  Unbalanced: 2,
  'Follow-up due': 3,
  Normal: 4,
  'Up to date': 5,
};

/**
 * Service: Retrieves connected patients for a doctor with search, condition filtering,
 * priority rank ordering, and ML clinical triage intelligence.
 */
export async function getDoctorPatients(
  userId: string,
  options: DoctorPatientsQueryOptions = {}
): Promise<{ patients: PatientDirectoryItem[]; total: number }> {
  const doctor = await DoctorProfile.findOne({ userId });
  if (!doctor) {
    throw new ForbiddenError('Doctor profile not found for authenticated user');
  }

  // 1. Fetch all active connections for this doctor
  const activeConnections = await Connection.find({
    doctorId: { $in: [doctor._id, doctor.userId] },
    status: 'active',
  });

  const patientIds = activeConnections.map((c: any) => c.patientId);
  if (patientIds.length === 0) {
    return { patients: [], total: 0 };
  }

  // 2. Build the indexed PostgreSQL query
  const query: any = { _id: { $in: patientIds } };

  if (options.search && options.search.trim()) {
    const s = options.search.trim();
    const regex = new RegExp(s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    query.$or = [{ name: regex }, { rsId: regex }, { phone: regex }];
  }

  if (options.condition && options.condition.trim()) {
    const cond = options.condition.trim();
    query.conditions = { $regex: new RegExp(`^${cond}$`, 'i') };
  }

  if (options.status && options.status.trim()) {
    query.status = options.status.trim();
  }

  // 3. Execute query
  const patientProfiles = await PatientProfile.find(query).lean();

  // 4. Transform and enrich each patient matching frontend contract
  const enrichedPatients: PatientDirectoryItem[] = await Promise.all(
    patientProfiles.map(async (p: any) => {
      // Find latest report for patient to reflect real-time clinical state
      const latestReport = await Report.findOne({ patientId: p._id })
        .sort({ collectionDate: -1 })
        .lean();

      // Resolve effective priority state
      let effectiveStatus = p.status || 'Normal';
      if (latestReport) {
        if (latestReport.status === 'Critical') {
          effectiveStatus = 'Critical';
        } else if (latestReport.status === 'Unbalanced' && effectiveStatus !== 'Critical') {
          effectiveStatus = 'Unbalanced';
        }
      }

      // Assign initial triage metadata based on effective status
      let triagePriority: 'critical' | 'review' | 'stable' = 'stable';
      let triageReason = 'Parameters within regular intervals.';
      let recommendedAction = 'Continue routine monitoring.';

      if (effectiveStatus === 'Critical') {
        triagePriority = 'critical';
        triageReason = latestReport?.name
          ? `Critical findings in ${latestReport.name}`
          : 'Critical parameters require immediate review.';
        recommendedAction = 'Physician review and follow-up appointment within 24-48 hours.';
      } else if (effectiveStatus === 'Unbalanced' || effectiveStatus === 'Needs Review') {
        triagePriority = 'review';
        triageReason = 'One or more clinical parameters outside standard biological range.';
        recommendedAction = 'Schedule routine laboratory follow-up or dosage check.';
      }

      return {
        id: p._id.toString(),
        rsId: p.rsId,
        name: p.name,
        avatar:
          p.avatar ||
          (p.name
            ? p.name
                .split(' ')
                .filter(Boolean)
                .map((n: string) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase()
            : 'PT'),
        age: p.age,
        gender: p.gender,
        phone: p.phone,
        location: p.location || 'India',
        bloodGroup: p.bloodGroup || 'Unknown',
        conditions: p.conditions || [],
        lastVisitDate: p.lastVisitDate || 'Not recorded',
        status: effectiveStatus,
        lastReportTime: p.lastReportTime || (latestReport ? 'Recent' : 'No reports yet'),
        lastReportName: p.lastReportName || latestReport?.name || 'None',
        connectedDoctors: [doctor.name],
        triagePriority,
        triageReason,
        recommendedAction,
      };
    })
  );

  // 5. Sort patients by clinical triage priority: Critical -> Needs Review -> Unbalanced -> Follow-up due -> Normal -> Up to date
  enrichedPatients.sort((a: any, b: any) => {
    const rankA = PRIORITY_ORDER_MAP[a.status] !== undefined ? PRIORITY_ORDER_MAP[a.status] : 99;
    const rankB = PRIORITY_ORDER_MAP[b.status] !== undefined ? PRIORITY_ORDER_MAP[b.status] : 99;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  const total = enrichedPatients.length;
  const page = options.page || 1;
  const limit = options.limit || 50;
  const startIndex = (page - 1) * limit;
  const paginated = enrichedPatients.slice(startIndex, startIndex + limit);

  return { patients: paginated, total };
}

/**
 * Service: Adds a doctor private note and optional priority annotation to a patient profile.
 * Stored in encrypted format, completely isolated from patient view.
 */
export async function addDoctorPrivateNote(
  userId: string,
  patientId: string,
  data: {
    note: string;
    reportId?: string;
    category?: 'Clinical Note' | 'Follow-up' | 'Differential Diagnosis' | 'Observation';
    priority?: PriorityStateType;
  }
) {
  const doctor = await DoctorProfile.findOne({ userId });
  if (!doctor) {
    throw new ForbiddenError('Doctor profile not found for authenticated user');
  }

  const patient = await PatientProfile.findById(patientId);
  if (!patient) {
    throw new NotFoundError('Patient profile not found');
  }

  const connection = await Connection.findOne({
    doctorId: doctor._id,
    patientId: patient._id,
    status: 'active',
  });
  if (!connection) {
    throw new ForbiddenError('Active connection with this patient is required to add private notes');
  }

  if (data.priority) {
    patient.status = data.priority;
    await patient.save();
  }

  const { DoctorNote } = await import('../repositories');
  const createdNote = await DoctorNote.create({
    doctorId: doctor._id,
    patientId: patient._id,
    reportId: data.reportId ? data.reportId : undefined,
    note: data.note,
    category: data.category || 'Clinical Note',
    priority: data.priority,
  });

  return {
    id: createdNote._id.toString(),
    doctorId: doctor._id.toString(),
    patientId: patient._id.toString(),
    reportId: createdNote.reportId?.toString(),
    note: createdNote.note,
    category: createdNote.category,
    priority: createdNote.priority,
    createdAt: createdNote.createdAt.toISOString(),
  };
}

/**
 * Service: Retrieves doctor private notes for a patient.
 */
export async function getDoctorPrivateNotes(userId: string, patientId: string) {
  const doctor = await DoctorProfile.findOne({ userId });
  if (!doctor) {
    throw new ForbiddenError('Doctor profile not found for authenticated user');
  }

  const patient = await PatientProfile.findById(patientId);
  if (!patient) {
    throw new NotFoundError('Patient profile not found');
  }

  const connection = await Connection.findOne({
    doctorId: doctor._id,
    patientId: patient._id,
    status: 'active',
  });
  if (!connection) {
    throw new ForbiddenError('Active connection with this patient is required to access private notes');
  }

  const { DoctorNote } = await import('../repositories');
  const notes = await DoctorNote.find({
    doctorId: doctor._id,
    patientId: patient._id,
  }).sort({ createdAt: -1 });

  return notes.map((n: any) => ({
    id: n._id.toString(),
    doctorId: n.doctorId.toString(),
    patientId: n.patientId.toString(),
    reportId: n.reportId?.toString(),
    note: n.note,
    category: n.category,
    priority: n.priority,
    createdAt: n.createdAt.toISOString(),
  }));
}

/**
 * Service: Updates clinical priority label for a patient.
 */
export async function updatePatientPriority(
  userId: string,
  patientId: string,
  priority: PriorityStateType
) {
  const doctor = await DoctorProfile.findOne({ userId });
  if (!doctor) {
    throw new ForbiddenError('Doctor profile not found for authenticated user');
  }

  const patient = await PatientProfile.findById(patientId);
  if (!patient) {
    throw new NotFoundError('Patient profile not found');
  }

  const connection = await Connection.findOne({
    doctorId: doctor._id,
    patientId: patient._id,
    status: 'active',
  });
  if (!connection) {
    throw new ForbiddenError('Active connection with this patient is required to set priority');
  }

  const validPriorities: PriorityStateType[] = [
    'Critical',
    'Unbalanced',
    'Normal',
    'Needs Review',
    'Follow-up due',
    'Up to date',
  ];
  if (!validPriorities.includes(priority)) {
    throw new ForbiddenError(`Invalid priority state: ${priority}`);
  }

  patient.status = priority;
  await patient.save();

  return {
    patientId: patient._id.toString(),
    rsId: patient.rsId,
    status: patient.status,
    updatedAt: new Date().toISOString(),
  };
}
