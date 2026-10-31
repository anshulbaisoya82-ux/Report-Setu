import { Appointment, IAppointment, AppointmentType, AppointmentStatus } from '../repositories';
import { PatientProfile } from '../repositories';
import { DoctorProfile } from '../repositories';
import { Connection } from '../repositories';
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../utils/errors';
import { emitToUser, emitToRoom, notifyAppointmentEvent } from './socketService';

export interface RequestAppointmentInput {
  doctorId?: string;
  patientId?: string;
  doctorName?: string;
  patientName?: string;
  patientRsId?: string;
  reason: string;
  date: string;
  time: string;
  type?: AppointmentType;
  status?: AppointmentStatus;
  notes?: string;
}

export interface FormattedAppointment {
  id: string;
  patientId: string;
  patientName: string;
  patientRsId: string;
  doctorName: string;
  reason: string;
  date: string;
  time: string;
  type: AppointmentType;
  status: AppointmentStatus;
  requestedAt?: string;
  notes?: string;
}

export const normalizeSlotDate = (dateStr: string): string => {
  // If dateStr is already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return dateStr;
};

export const formatAppointmentResponse = (apt: IAppointment): FormattedAppointment => {
  return {
    id: apt._id.toString(),
    patientId: apt.patientId.toString(),
    patientName: apt.patientName,
    patientRsId: apt.patientRsId,
    doctorName: apt.doctorName,
    reason: apt.reason,
    date: apt.date,
    time: apt.time,
    type: apt.type,
    status: apt.status,
    requestedAt: apt.requestedAt,
    notes: apt.notes,
  };
};

/**
 * Service: Creates an appointment request (from patient or doctor).
 * Protects against double booking if created directly in 'Confirmed' status.
 */
export async function requestAppointment(
  userId: string,
  userRole: string,
  input: RequestAppointmentInput
): Promise<FormattedAppointment> {
  if (!input.reason || !input.reason.trim()) {
    throw new ValidationError('Appointment reason is required');
  }
  if (!input.date || !input.date.trim()) {
    throw new ValidationError('Appointment date is required');
  }
  if (!input.time || !input.time.trim()) {
    throw new ValidationError('Appointment time is required');
  }

  let patientDoc: any;
  let doctorDoc: any;

  if (userRole === 'patient') {
    patientDoc = await PatientProfile.findOne({ userId });
    if (!patientDoc) {
      throw new NotFoundError('Patient profile not found');
    }

    if (input.doctorId) {
      doctorDoc = await DoctorProfile.findById(input.doctorId);
    } else {
      // Find connected doctor for this patient
      const connection = await Connection.findOne({
        patientId: patientDoc._id,
        status: 'active',
      });
      if (connection) {
        doctorDoc = await DoctorProfile.findById(connection.doctorId);
      }
    }

    if (!doctorDoc) {
      throw new NotFoundError('Doctor profile not found or not connected');
    }
  } else if (userRole === 'doctor') {
    doctorDoc = await DoctorProfile.findOne({ userId });
    if (!doctorDoc) {
      throw new NotFoundError('Doctor profile not found');
    }

    if (!input.patientId) {
      throw new ValidationError('patientId is required when booking as doctor');
    }
    patientDoc = await PatientProfile.findById(input.patientId);
    if (!patientDoc) {
      throw new NotFoundError('Patient profile not found');
    }
  } else {
    throw new ForbiddenError('Unauthorized');
  }

  const slotDate = normalizeSlotDate(input.date);
  const normalizedTime = input.time.trim();
  const initialStatus: AppointmentStatus = input.status || 'Pending';

  // Anti-double-booking check if initialStatus is Confirmed
  if (initialStatus === 'Confirmed') {
    const existingConfirmed = await Appointment.findOne({
      doctorId: doctorDoc._id,
      slotDate,
      time: normalizedTime,
      status: 'Confirmed',
    });
    if (existingConfirmed) {
      throw new ConflictError(
        `This time slot (${input.date} at ${normalizedTime}) is already booked for Dr. ${doctorDoc.name}. Double-booking prevented.`
      );
    }
  }

  const now = new Date();
  const requestedAtStr = `Sent today at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

  try {
    const apt = await Appointment.create({
      patientId: patientDoc._id,
      patientName: patientDoc.name,
      patientRsId: patientDoc.rsId,
      doctorId: doctorDoc._id,
      doctorName: doctorDoc.name,
      reason: input.reason.trim(),
      date: input.date.trim(),
      slotDate,
      time: normalizedTime,
      type: input.type || 'In-person',
      status: initialStatus,
      requestedAt: requestedAtStr,
      notes: input.notes,
    });

    const formatted = formatAppointmentResponse(apt);

    // Notify both parties via real-time Socket.IO
    await notifyAppointmentEvent(
      formatted,
      'appointment:created',
      doctorDoc.userId?.toString(),
      patientDoc.userId?.toString()
    );

    return formatted;
  } catch (err: any) {
    if (err.code === 11000) {
      throw new ConflictError(
        `This time slot (${input.date} at ${normalizedTime}) is already booked for Dr. ${doctorDoc.name}. Concurrency conflict prevented.`
      );
    }
    throw err;
  }
}

/**
 * Service: Updates appointment status with state-machine validation and anti-double-booking locks.
 */
export async function updateAppointmentStatus(
  userId: string,
  userRole: string,
  appointmentId: string,
  newStatus: AppointmentStatus,
  notes?: string,
  newDate?: string,
  newTime?: string
): Promise<FormattedAppointment> {
  const validStatuses: AppointmentStatus[] = ['Confirmed', 'Pending', 'Completed', 'Cancelled'];
  if (!validStatuses.includes(newStatus)) {
    throw new ValidationError(`Invalid appointment status: ${newStatus}`);
  }

  const apt = await Appointment.findById(appointmentId);
  if (!apt) {
    throw new NotFoundError('Appointment not found');
  }

  let doctorUserId = '';
  let patientUserId = '';

  // Authorization and State Machine Transitions
  if (userRole === 'patient') {
    const patient = await PatientProfile.findOne({ userId });
    if (!patient || (patient._id?.toString() !== apt.patientId?.toString() && patient.id !== apt.patientId)) {
      throw new ForbiddenError('Unauthorized to update this appointment');
    }
    patientUserId = userId;
    const doctor = await DoctorProfile.findById(apt.doctorId);
    doctorUserId = doctor?.userId?.toString() || '';

    // Patient can cancel, or request reschedule
    if (newStatus !== 'Cancelled' && newStatus !== 'Pending') {
      throw new ForbiddenError('Patients can only cancel appointments or request reschedules. Doctor confirmation required.');
    }
  } else if (userRole === 'doctor') {
    const doctor = await DoctorProfile.findOne({ userId });
    if (!doctor || (doctor._id?.toString() !== apt.doctorId?.toString() && doctor.id !== apt.doctorId)) {
      throw new ForbiddenError('Unauthorized: only the assigned doctor can manage this appointment');
    }
    doctorUserId = userId;
    const patient = await PatientProfile.findById(apt.patientId);
    patientUserId = patient?.userId?.toString() || '';
  } else {
    throw new ForbiddenError('Unauthorized');
  }

  // Handle optional rescheduling date & time
  if (newDate) {
    apt.date = newDate.trim();
    apt.slotDate = normalizeSlotDate(newDate);
  }
  if (newTime) {
    apt.time = newTime.trim();
  }

  // If transitioning to 'Confirmed', verify anti-double-booking lock
  if (newStatus === 'Confirmed' && (apt.status !== 'Confirmed' || newDate || newTime)) {
    const existingConfirmed = await Appointment.findOne({
      doctorId: apt.doctorId,
      slotDate: apt.slotDate,
      time: apt.time,
      status: 'Confirmed',
      _id: { $ne: apt._id },
    });

    if (existingConfirmed) {
      throw new ConflictError(
        `Slot conflict: Dr. ${apt.doctorName} already has a confirmed appointment at ${apt.slotDate} ${apt.time}.`
      );
    }
  }

  apt.status = newStatus;
  if (notes) {
    apt.notes = notes;
  }

  try {
    await apt.save();
  } catch (err: any) {
    if (err.code === 11000) {
      throw new ConflictError(
        `Concurrent lock conflict: This time slot was just confirmed by another transaction.`
      );
    }
    throw err;
  }

  const formatted = formatAppointmentResponse(apt);

  // Dispatch live real-time status event to both doctor and patient
  const eventName =
    newStatus === 'Confirmed'
      ? 'appointment:confirmed'
      : newStatus === 'Cancelled'
      ? 'appointment:cancelled'
      : newStatus === 'Completed'
      ? 'appointment:completed'
      : 'appointment:updated';

  await notifyAppointmentEvent(formatted, eventName, doctorUserId, patientUserId);

  return formatted;
}

/**
 * Service: Retrieves appointments for authenticated doctor or patient.
 */
export async function getAppointments(
  userId: string,
  userRole: string,
  statusFilter?: AppointmentStatus
): Promise<FormattedAppointment[]> {
  const query: any = {};

  if (userRole === 'patient') {
    const patient = await PatientProfile.findOne({ userId });
    if (!patient) throw new NotFoundError('Patient profile not found');
    query.patientId = patient._id;
  } else if (userRole === 'doctor') {
    const doctor = await DoctorProfile.findOne({ userId });
    if (!doctor) throw new NotFoundError('Doctor profile not found');
    query.doctorId = doctor._id;
  } else {
    throw new ForbiddenError('Unauthorized');
  }

  if (statusFilter) {
    query.status = statusFilter;
  }

  const appointments = await Appointment.find(query).sort({ date: 1, time: 1 });
  return appointments.map(formatAppointmentResponse);
}
