import { MedicineSchedule, IMedicineSchedule, MedicineState } from '../repositories';
import { Prescription } from '../repositories';
import { PatientProfile } from '../repositories';
import { DoctorProfile } from '../repositories';
import { Connection } from '../repositories';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';

export interface MedicineScheduleItemResponse {
  id: string;
  name: string;
  dose: string;
  timing: string;
  scheduledTime: string;
  state: MedicineState;
  takenAt?: string;
  instructions?: string;
}

export interface AdherenceMetricsResponse {
  adherenceRate: number;
  streakDays: number;
  totalScheduled: number;
  totalTaken: number;
  totalMissed: number;
  period: 'last_7_days';
  message: string;
}

export const getTodayDateKey = (dateObj: Date = new Date()): string => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatScheduleItem = (item: IMedicineSchedule): MedicineScheduleItemResponse => {
  return {
    id: item._id.toString(),
    name: item.name,
    dose: item.dose,
    timing: item.timing,
    scheduledTime: item.scheduledTime,
    state: item.state,
    takenAt: item.takenAt,
    instructions: item.instructions,
  };
};

/**
 * Helper: Builds scheduled dose items for a prescription for a specific date key.
 */
export function buildDosesForPrescription(patientId: string, rx: any, todayKey: string): any[] {
  const doses: any[] = [];
  const rxId = rx._id || rx.id;
  const medicines =
    rx.medicines && rx.medicines.length > 0
      ? rx.medicines
      : [
          {
            name: rx.name,
            dose: '1 tablet',
            timing: rx.instructions,
            instructions: rx.instructions,
          },
        ];

  for (const med of medicines) {
    const rawTiming = (Array.isArray(med.timing) ? med.timing.join(' ') : med.timing || '').toLowerCase();
    const rawFreq = (med.frequency || '').toLowerCase();
    const rawInst = (med.instructions || rx.instructions || '').toLowerCase();
    const combined = `${rawTiming} ${rawFreq} ${rawInst} ${med.name || ''}`;

    const slots: { label: string; time: string }[] = [];

    const hasMorning =
      combined.includes('morning') ||
      combined.includes('breakfast') ||
      combined.includes('twice daily') ||
      combined.includes('thrice daily') ||
      combined.includes('b.i.d') ||
      combined.includes('t.i.d');
    const hasNoon =
      combined.includes('noon') ||
      combined.includes('lunch') ||
      combined.includes('afternoon') ||
      combined.includes('thrice daily') ||
      combined.includes('t.i.d');
    const hasEvening = combined.includes('evening');
    const hasNight =
      combined.includes('night') ||
      combined.includes('dinner') ||
      combined.includes('bed') ||
      combined.includes('twice daily') ||
      combined.includes('thrice daily') ||
      combined.includes('b.i.d') ||
      combined.includes('t.i.d');

    if (hasMorning) slots.push({ label: 'Morning · 8:00 AM', time: '08:00 AM' });
    if (hasNoon) slots.push({ label: 'Noon · 1:00 PM', time: '01:00 PM' });
    if (hasEvening) slots.push({ label: 'Evening · 6:30 PM', time: '06:30 PM' });
    if (hasNight) slots.push({ label: 'Night · 9:00 PM', time: '09:00 PM' });

    if (slots.length === 0) {
      slots.push({ label: 'Daily · 08:00 AM', time: '08:00 AM' });
    }

    for (const slot of slots) {
      doses.push({
        patientId,
        prescriptionId: rxId,
        name: med.name || rx.name,
        dose: med.dose || med.dosage || '1 tablet',
        timing: slot.label,
        scheduledTime: slot.time,
        date: todayKey,
        state: 'due',
        instructions: med.instructions || rx.instructions || 'Take with water',
      });
    }
  }

  return doses;
}

/**
 * Service: Generates doses for a newly created prescription for today.
 */
export async function generateTodayDosesForPrescription(patientId: string, rx: any): Promise<void> {
  const todayKey = getTodayDateKey();
  const existing = await MedicineSchedule.find({
    patientId,
    prescriptionId: rx._id || rx.id,
    date: todayKey,
  });

  if (existing.length === 0) {
    const doses = buildDosesForPrescription(patientId, rx, todayKey);
    if (doses.length > 0) {
      await MedicineSchedule.insertMany(doses);
    }
  }
}

/**
 * Service: Retrieves today's medication schedule for a patient.
 * Auto-generates scheduled dose entries from active prescriptions if not yet instantiated for today.
 */
export async function getTodaySchedule(
  userId: string,
  userRole: string,
  patientIdParam?: string
): Promise<MedicineScheduleItemResponse[]> {
  let patientId: string;

  if (userRole === 'patient') {
    const patient = await PatientProfile.findOne({ userId });
    if (!patient) {
      throw new NotFoundError('Patient profile not found');
    }
    patientId = patient._id;
  } else if (userRole === 'doctor') {
    if (!patientIdParam) {
      throw new ValidationError('patientId query parameter is required for doctor access');
    }
    const doctor = await DoctorProfile.findOne({ userId });
    if (!doctor) {
      throw new ForbiddenError('Doctor profile not found');
    }
    const patient = await PatientProfile.findById(patientIdParam);
    if (!patient) {
      throw new NotFoundError('Patient profile not found');
    }
    const connection = await Connection.findOne({
      doctorId: doctor._id,
      patientId: patient._id,
      status: 'active',
    });
    if (!connection) {
      throw new ForbiddenError('Active connection with patient is required');
    }
    patientId = patient._id;
  } else {
    throw new ForbiddenError('Unauthorized to access medication schedule');
  }

  const todayKey = getTodayDateKey();

  // 1. Fetch existing entries for today
  let todayDoses = await MedicineSchedule.find({
    patientId,
    date: todayKey,
  }).sort({ scheduledTime: 1 });

  // 2. Generate doses for any active prescription that has not been instantiated for today yet
  const activePrescriptions = await Prescription.find({
    patientId,
    status: 'Active',
    endDate: { $gte: new Date() },
  });

  const existingRxIds = new Set(
    todayDoses.map((d: any) => d.prescriptionId?.toString()).filter(Boolean)
  );

  const dosesToCreate: any[] = [];
  for (const rx of activePrescriptions) {
    if (!existingRxIds.has(rx._id.toString())) {
      const newDoses = buildDosesForPrescription(patientId, rx, todayKey);
      dosesToCreate.push(...newDoses);
    }
  }

  if (dosesToCreate.length > 0) {
    await MedicineSchedule.insertMany(dosesToCreate);
    todayDoses = await MedicineSchedule.find({
      patientId,
      date: todayKey,
    }).sort({ scheduledTime: 1 });
  }

  return todayDoses.map(formatScheduleItem);
}

/**
 * Service: Records patient dose action ('taken', 'due', 'snoozed', 'missed').
 */
export async function recordDoseAction(
  userId: string,
  userRole: string,
  doseId: string,
  action: MedicineState
): Promise<MedicineScheduleItemResponse> {
  const validActions: MedicineState[] = ['taken', 'due', 'snoozed', 'missed'];
  if (!validActions.includes(action)) {
    throw new ValidationError(`Invalid action: ${action}. Allowed: ${validActions.join(', ')}`);
  }

  const dose = await MedicineSchedule.findById(doseId);
  if (!dose) {
    throw new NotFoundError('Medication dose record not found');
  }

  // Authorization check
  if (userRole === 'patient') {
    const patient = await PatientProfile.findOne({ userId });
    if (!patient || patient._id !== dose.patientId) {
      throw new ForbiddenError('Unauthorized to update this medication dose');
    }
  } else if (userRole === 'doctor') {
    const doctor = await DoctorProfile.findOne({ userId });
    if (!doctor) {
      throw new ForbiddenError('Doctor profile not found');
    }
    const connection = await Connection.findOne({
      doctorId: doctor._id,
      patientId: dose.patientId,
      status: 'active',
    });
    if (!connection) {
      throw new ForbiddenError('Active connection with patient is required');
    }
  } else {
    throw new ForbiddenError('Unauthorized');
  }

  dose.state = action;
  if (action === 'taken') {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    dose.takenAt = `Taken at ${timeStr}`;
  } else if (action === 'due') {
    dose.takenAt = undefined;
  } else if (action === 'snoozed') {
    dose.takenAt = 'Snoozed 30 mins';
    dose.snoozedUntil = new Date(Date.now() + 30 * 60 * 1000);
  } else if (action === 'missed') {
    dose.takenAt = 'Missed';
  }

  await dose.save();
  return formatScheduleItem(dose);
}

/**
 * Service: Computes weekly adherence percentage and streak metrics.
 */
export async function getAdherenceMetrics(
  userId: string,
  userRole: string,
  patientIdParam?: string
): Promise<AdherenceMetricsResponse> {
  let patientId: string;

  if (userRole === 'patient') {
    const patient = await PatientProfile.findOne({ userId });
    if (!patient) {
      throw new NotFoundError('Patient profile not found');
    }
    patientId = patient._id;
  } else if (userRole === 'doctor') {
    if (!patientIdParam) {
      throw new ValidationError('patientId query parameter is required for doctor access');
    }
    const patient = await PatientProfile.findById(patientIdParam);
    if (!patient) {
      throw new NotFoundError('Patient profile not found');
    }
    patientId = patient._id;
  } else {
    throw new ForbiddenError('Unauthorized');
  }

  // Calculate past 7 days (including today)
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(getTodayDateKey(d));
  }

  const doses = await MedicineSchedule.find({
    patientId,
    date: { $in: days },
  });

  const totalScheduled = doses.length;
  const totalTaken = doses.filter((d: any) => d.state === 'taken').length;
  const totalMissed = doses.filter((d: any) => d.state === 'missed').length;

  const adherenceRate = totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 100;

  // Compute streak days backwards from today
  let streakDays = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const dayKey = days[i];
    const dayDoses = doses.filter((d: any) => d.date === dayKey);
    if (dayDoses.length === 0) {
      continue;
    }
    const dayAllTaken = dayDoses.every((d: any) => d.state === 'taken');
    if (dayAllTaken) {
      streakDays++;
    } else {
      break;
    }
  }

  let message = 'Good adherence! Keep up your routine.';
  if (adherenceRate >= 90) {
    message = 'Outstanding adherence! Your treatment plan is right on track.';
  } else if (adherenceRate < 70) {
    message = 'Several doses were missed this week. Please consult your physician if experiencing side effects.';
  }

  return {
    adherenceRate,
    streakDays,
    totalScheduled,
    totalTaken,
    totalMissed,
    period: 'last_7_days',
    message,
  };
}
