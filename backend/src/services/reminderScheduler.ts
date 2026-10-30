import cron, { ScheduledTask } from 'node-cron';
import { MedicineSchedule, IMedicineSchedule } from '../repositories';
import { PatientProfile } from '../repositories';
import { Notification } from '../repositories';
import { emitToUser } from './socketService';
import { getTodayDateKey } from './medicationService';
import { logger } from '../utils/logger';

let scheduledTask: ScheduledTask | null = null;

export interface ReminderJobResult {
  evaluatedCount: number;
  dispatchedCount: number;
  mutedCount: number;
  dispatchedToPatientIds: string[];
}

/**
 * Evaluates pending due medication doses for today and dispatches in-app notifications
 * and real-time socket alerts to patients who have medicineReminders enabled.
 */
export async function checkDueMedicineReminders(
  targetTimeStr?: string,
  targetDateKey?: string
): Promise<ReminderJobResult> {
  const dateKey = targetDateKey || getTodayDateKey();
  
  // Find all doses for today that remain in 'due' state
  const query: any = {
    date: dateKey,
    state: 'due',
  };

  if (targetTimeStr) {
    query.scheduledTime = targetTimeStr;
  }

  const dueDoses = await MedicineSchedule.find(query);
  let dispatchedCount = 0;
  let mutedCount = 0;
  const dispatchedToPatientIds: string[] = [];

  for (const dose of dueDoses) {
    const patient = await PatientProfile.findById(dose.patientId);
    if (!patient) continue;

    // Check patient's notification preference (default true unless explicitly turned off)
    const allowsReminders =
      patient.notificationPreferences?.medicineReminders !== false;

    if (!allowsReminders) {
      mutedCount++;
      logger.debug({
        message: `Medication reminder skipped for patient ${patient._id}: notifications muted`,
        doseId: dose._id,
      });
      continue;
    }

    // 1. Create In-App Notification record
    await Notification.create({
      userId: patient.userId,
      type: 'medicine_reminder',
      title: 'Medication Due',
      message: `Time for your scheduled dose of ${dose.name} (${dose.dose}) — ${dose.timing}.`,
      data: {
        doseId: dose._id.toString(),
        name: dose.name,
        dose: dose.dose,
        timing: dose.timing,
        scheduledTime: dose.scheduledTime,
      },
    });

    // 2. Dispatch real-time socket alert
    emitToUser(patient.userId.toString(), 'medicine:reminder', {
      doseId: dose._id.toString(),
      name: dose.name,
      dose: dose.dose,
      scheduledTime: dose.scheduledTime,
      instructions: dose.instructions,
    });

    dispatchedCount++;
    dispatchedToPatientIds.push(patient._id.toString());
  }

  logger.info({
    message: 'Completed medication reminder evaluation',
    evaluatedCount: dueDoses.length,
    dispatchedCount,
    mutedCount,
  });

  return {
    evaluatedCount: dueDoses.length,
    dispatchedCount,
    mutedCount,
    dispatchedToPatientIds,
  };
}

/**
 * Initializes the background reminder scheduler cron job.
 * Runs every minute to evaluate scheduled medication doses.
 */
export function startReminderScheduler(): ScheduledTask {
  if (scheduledTask) {
    return scheduledTask;
  }

  // Runs every minute
  scheduledTask = cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const timeStr = `${String(formattedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;

      await checkDueMedicineReminders(timeStr);
    } catch (err) {
      logger.error({
        message: 'Error during scheduled medicine reminder execution',
        error: (err as Error).message,
      });
    }
  });

  logger.info({ message: 'Medicine reminder background scheduler started' });
  return scheduledTask;
}

/**
 * Stops the background reminder scheduler.
 */
export function stopReminderScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info({ message: 'Medicine reminder background scheduler stopped' });
  }
}
