import { UserRoleType } from '../domain/types';

/**
 * List of fields strictly reserved for doctors and admins.
 * Under no circumstance may these fields be sent to patient-role consumers.
 */
export const DOCTOR_PRIVATE_REPORT_FIELDS = [
  'doctorNotes',
  'privateNotes',
  'internalNotes',
  'priorityLabel',
  'triageScore',
  'internalRiskScore',
  'internalFlags',
  'clinicalAuditFlags',
  'rawOcrText',
  'doctorWorklistStatus',
  'differentialDiagnosisDraft',
  'internalTags',
] as const;

export const DOCTOR_PRIVATE_PATIENT_FIELDS = [
  'doctorNotes',
  'internalNotes',
  'complianceRisk',
  'internalTags',
  'billingNotes',
] as const;

/**
 * Strips doctor-private keys from any object or array recursively.
 */
const deepStripKeys = (obj: any, keysToStrip: readonly string[]): any => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const target = { ...obj };

  if (Array.isArray(target)) {
    return target.map((item) => deepStripKeys(item, keysToStrip));
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(target)) {
    if (keysToStrip.includes(key)) {
      continue;
    }

    if (Array.isArray(value)) {
      result[key] = value.map((item) => deepStripKeys(item, keysToStrip));
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !(value instanceof Date) &&
      !Buffer.isBuffer(value)
    ) {
      result[key] = deepStripKeys(value, keysToStrip);
    } else {
      result[key] = value;
    }
  }

  return result;
};

/**
 * Serializes a lab report document according to the consumer's role.
 * - Patient: strips privateNotes, internal triage tags, and raw OCR data.
 * - Doctor/Admin: preserves all clinical triage and collaboration notes.
 */
export const serializeReport = <T = any>(
  report: any,
  role: UserRoleType = 'patient'
): T => {
  if (!report) return report;

  const raw = typeof report.toObject === 'function' ? report.toObject() : { ...report };

  if (raw._id) {
    raw.id = raw._id.toString();
  }
  if (raw.patientId) {
    raw.patientId = raw.patientId.toString();
  }
  if (raw.reviewedBy) {
    raw.reviewedBy = raw.reviewedBy.toString();
  }

  const rawFile = (raw.rawFile as any) || {};
  const isViewed = Boolean(
    raw.doctorViewed ||
    rawFile?.doctorViewed ||
    raw.reviewStatus === 'in_review' ||
    raw.reviewStatus === 'approved' ||
    raw.reviewed
  );
  raw.doctorViewed = isViewed;
  raw.doctorViewedAt = raw.doctorViewedAt || rawFile?.doctorViewedAt;

  if (role === 'doctor' || role === 'admin') {
    return raw as T;
  }

  // Patient view: strictly purge all internal doctor notes and triage flags
  const stripped = deepStripKeys(raw, DOCTOR_PRIVATE_REPORT_FIELDS) as any;
  if (stripped._id) {
    stripped.id = stripped._id.toString();
  }
  if (stripped.patientId) {
    stripped.patientId = stripped.patientId.toString();
  }

  // Patient only sees doctor summary and AI overview once status is approved / reviewed
  const isApproved = Boolean(stripped.reviewed || stripped.reviewStatus === 'approved');
  if (!isApproved) {
    delete stripped.doctorSummary;
    delete stripped.aiOverview;
  }

  return stripped as T;
};

/**
 * Serializes a list of reports.
 */
export const serializeReports = <T = any>(
  reports: any[],
  role: UserRoleType = 'patient'
): T[] => {
  if (!Array.isArray(reports)) return [];
  return reports.map((r) => serializeReport<T>(r, role));
};

/**
 * Serializes a patient profile according to the consumer's role.
 */
export const serializePatientProfile = <T = any>(
  patient: any,
  role: UserRoleType = 'patient'
): T => {
  if (!patient) return patient;

  const raw = typeof patient.toObject === 'function' ? patient.toObject() : patient;

  if (role === 'doctor' || role === 'admin') {
    return raw as T;
  }

  return deepStripKeys(raw, DOCTOR_PRIVATE_PATIENT_FIELDS) as T;
};

/**
 * Defensive assertion helper: throws an Error if any doctor-private fields leak
 * into an object designated for patient delivery.
 */
export const assertNoDoctorPrivateLeak = (payload: any): void => {
  if (!payload || typeof payload !== 'object') return;

  const check = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (DOCTOR_PRIVATE_REPORT_FIELDS.includes(key as any) || DOCTOR_PRIVATE_PATIENT_FIELDS.includes(key as any)) {
        throw new Error(`Data leak detected: doctor-private field '${key}' found in patient response`);
      }
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        check(obj[key]);
      }
    }
  };

  check(payload);
};
