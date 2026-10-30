import { Prescription, IPrescription } from '../repositories';
import { DoctorProfile } from '../repositories';
import { PatientProfile } from '../repositories';
import { Connection } from '../repositories';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { emitToUser, emitToRoom } from './socketService';
import { generateTodayDosesForPrescription } from './medicationService';
import { dispatchNotificationWithPreferences } from './notificationService';

export interface CreatePrescriptionInput {
  patientId: string;
  name: string;
  instructions: string;
  startDate?: string | Date;
  endDate?: string | Date;
  totalDays?: number;
  advice?: string[];
  medicines?: {
    name: string;
    dose: string;
    timing: string;
    frequency?: string;
    instructions?: string;
  }[];
}

export interface FormattedPrescription {
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
  medicines?: {
    name: string;
    dose: string;
    timing: string;
    frequency?: string;
    instructions?: string;
  }[];
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const formatDisplayDate = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

export const calculateRemainingDays = (endDate: Date, status: 'Active' | 'Ended'): number => {
  if (status === 'Ended') return 0;
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

export const formatPrescriptionResponse = (p: IPrescription): FormattedPrescription => {
  const remainingDays = calculateRemainingDays(p.endDate, p.status);
  const effectiveStatus = remainingDays === 0 ? 'Ended' : p.status;

  return {
    id: p._id.toString(),
    patientId: p.patientId.toString(),
    name: p.name,
    instructions: p.instructions,
    startDate: formatDisplayDate(p.startDate),
    endDate: formatDisplayDate(p.endDate),
    totalDays: p.totalDays,
    remainingDays,
    status: effectiveStatus,
    doctorName: p.doctorName,
    advice: p.advice || [],
    medicines: p.medicines,
  };
};

/**
 * Service: Doctor creates a new medication prescription with duration and clinical advice.
 */
export async function createPrescription(
  userId: string,
  input: CreatePrescriptionInput
): Promise<FormattedPrescription> {
  const doctor = await DoctorProfile.findOne({ userId });
  if (!doctor) {
    throw new ForbiddenError('Only registered doctors can issue prescriptions');
  }

  const patient = await PatientProfile.findById(input.patientId);
  if (!patient) {
    throw new NotFoundError('Patient profile not found');
  }

  const connection = await Connection.findOne({
    doctorId: doctor._id,
    patientId: patient._id,
    status: 'active',
  });
  if (!connection) {
    throw new ForbiddenError('Active connection with patient is required to issue a prescription');
  }

  if (!input.name || !input.name.trim()) {
    throw new ValidationError('Medication name is required');
  }
  if (!input.instructions || !input.instructions.trim()) {
    throw new ValidationError('Medication instructions are required');
  }

  const startDate = input.startDate ? new Date(input.startDate) : new Date();
  let endDate: Date;
  let totalDays: number;

  if (input.totalDays && input.totalDays > 0) {
    totalDays = input.totalDays;
    endDate = new Date(startDate.getTime() + totalDays * 24 * 60 * 60 * 1000);
  } else if (input.endDate) {
    endDate = new Date(input.endDate);
    const diffMs = endDate.getTime() - startDate.getTime();
    totalDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  } else {
    totalDays = 90; // Default standard course
    endDate = new Date(startDate.getTime() + totalDays * 24 * 60 * 60 * 1000);
  }

  const prescription = await Prescription.create({
    patientId: patient._id,
    doctorId: doctor._id,
    doctorName: doctor.name,
    name: input.name.trim(),
    instructions: input.instructions.trim(),
    startDate,
    endDate,
    totalDays,
    status: 'Active',
    advice: input.advice || [],
    medicines: input.medicines || [],
  });

  const formatted = formatPrescriptionResponse(prescription);

  // Proactively generate today's scheduled dose entries for the patient
  try {
    await generateTodayDosesForPrescription(patient._id.toString(), prescription);
  } catch (err: any) {
    console.warn('Failed to auto-generate today doses for prescription:', err?.message);
  }

  // Dispatch persistent notification respecting patient preferences
  try {
    await dispatchNotificationWithPreferences(
      patient.userId.toString(),
      'medicine_reminder',
      `New Prescription: ${prescription.name}`,
      `Dr. ${doctor.name} prescribed ${prescription.name} (${prescription.instructions}). Check your daily medicine schedule.`
    );
  } catch (err: any) {
    console.warn('Failed to dispatch prescription notification:', err?.message);
  }

  // Real-time notification to patient and consultation rooms
  emitToUser(patient.userId.toString(), 'prescription:created', formatted);
  emitToUser(patient.userId.toString(), 'prescription:updated', formatted);
  emitToUser(patient.userId.toString(), 'medication:schedule_updated', { patientId: patient._id.toString() });
  emitToRoom(`patient:${patient._id}`, 'prescription:updated', formatted);

  return formatted;
}

/**
 * Service: Retrieves active and past prescriptions for patients or doctors.
 */
export async function getPrescriptions(
  userId: string,
  userRole: string,
  options: { patientId?: string; status?: 'Active' | 'Ended' } = {}
): Promise<FormattedPrescription[]> {
  const query: any = {};

  if (userRole === 'patient') {
    const patient = await PatientProfile.findOne({ userId });
    if (!patient) {
      throw new NotFoundError('Patient profile not found');
    }
    query.patientId = patient._id;
  } else if (userRole === 'doctor') {
    const doctor = await DoctorProfile.findOne({ userId });
    if (!doctor) {
      throw new ForbiddenError('Doctor profile not found');
    }

    if (options.patientId) {
      const patient = await PatientProfile.findById(options.patientId);
      if (!patient) {
        throw new NotFoundError('Patient profile not found');
      }

      const connection = await Connection.findOne({
        doctorId: doctor._id,
        patientId: patient._id,
        status: 'active',
      });
      if (!connection) {
        throw new ForbiddenError('Active connection required to view patient prescriptions');
      }
      query.patientId = patient._id;
    } else {
      query.doctorId = doctor._id;
    }
  } else {
    throw new ForbiddenError('Unauthorized to access prescriptions');
  }

  if (options.status) {
    query.status = options.status;
  }

  const list = await Prescription.find(query).sort({ createdAt: -1 });
  return list.map(formatPrescriptionResponse);
}
