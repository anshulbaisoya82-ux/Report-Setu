import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { MedicineSchedule } from '../utils/testModels';
import { Notification } from '../utils/testModels';
import {
  checkDueMedicineReminders,
  startReminderScheduler,
  stopReminderScheduler,
} from './reminderScheduler';
import * as socketService from './socketService';
import { getTodayDateKey } from './medicationService';

describe('Task 6.5: Medicine Reminder Background Scheduler', () => {
  let patient1User: any;
  let patient1Profile: any;

  let patient2User: any;
  let patient2Profile: any;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    stopReminderScheduler();
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Patient 1: medicineReminders enabled (default)
    patient1User = await User.create({
      phone: '+919811100001',
      role: 'patient',
      isActive: true,
      isVerified: true,
    });
    patient1Profile = await PatientProfile.create({
      userId: patient1User._id,
      name: 'Rohan Verma',
      age: 45,
      gender: 'Male',
      phone: '+919811100001',
      status: 'Normal',
      notificationPreferences: {
        medicineReminders: true,
        testDueReminders: true,
        doctorReplies: true,
        criticalAlerts: true,
        whatsappAlerts: false,
      },
    });

    // Patient 2: medicineReminders explicitly muted (false)
    patient2User = await User.create({
      phone: '+919811100002',
      role: 'patient',
      isActive: true,
      isVerified: true,
    });
    patient2Profile = await PatientProfile.create({
      userId: patient2User._id,
      name: 'Sunita Sharma',
      age: 50,
      gender: 'Female',
      phone: '+919811100002',
      status: 'Normal',
      notificationPreferences: {
        medicineReminders: false, // MUTED
        testDueReminders: true,
        doctorReplies: true,
        criticalAlerts: true,
        whatsappAlerts: false,
      },
    });
  });

  it('should dispatch in-app notification and real-time socket alert when dose is due', async () => {
    const todayKey = getTodayDateKey();
    const emitSpy = vi.spyOn(socketService, 'emitToUser');

    // Create due dose for Patient 1 at 08:00 AM
    await MedicineSchedule.create({
      patientId: patient1Profile._id,
      name: 'Metformin 500 mg',
      dose: '1 tablet',
      timing: 'Morning · after breakfast · 8:00 AM',
      scheduledTime: '08:00 AM',
      date: todayKey,
      state: 'due',
    });

    const result = await checkDueMedicineReminders('08:00 AM', todayKey);

    expect(result.evaluatedCount).toBe(1);
    expect(result.dispatchedCount).toBe(1);
    expect(result.mutedCount).toBe(0);

    // Verify Notification document created in DB
    const notifications = await Notification.find({ userId: patient1User._id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('medicine_reminder');
    expect(notifications[0].title).toBe('Medication Due');
    expect(notifications[0].message).toContain('Metformin 500 mg');

    // Verify socket alert dispatched
    expect(emitSpy).toHaveBeenCalledWith(
      patient1User._id.toString(),
      'medicine:reminder',
      expect.objectContaining({
        name: 'Metformin 500 mg',
        scheduledTime: '08:00 AM',
      })
    );

    emitSpy.mockRestore();
  });

  it('should strictly respect muted patient notification preferences and skip reminder', async () => {
    const todayKey = getTodayDateKey();
    const emitSpy = vi.spyOn(socketService, 'emitToUser');

    // Create due dose for Patient 2 (muted) at 08:00 AM
    await MedicineSchedule.create({
      patientId: patient2Profile._id,
      name: 'Atorvastatin 20 mg',
      dose: '1 tablet',
      timing: 'Morning · after breakfast · 8:00 AM',
      scheduledTime: '08:00 AM',
      date: todayKey,
      state: 'due',
    });

    const result = await checkDueMedicineReminders('08:00 AM', todayKey);

    expect(result.evaluatedCount).toBe(1);
    expect(result.dispatchedCount).toBe(0);
    expect(result.mutedCount).toBe(1);

    // No notifications created for patient 2
    const notifications = await Notification.find({ userId: patient2User._id });
    expect(notifications).toHaveLength(0);

    // No socket event dispatched
    expect(emitSpy).not.toHaveBeenCalled();

    emitSpy.mockRestore();
  });

  it('should start and stop the reminder scheduler cleanly', () => {
    const task = startReminderScheduler();
    expect(task).toBeDefined();

    // Calling again returns existing task
    const task2 = startReminderScheduler();
    expect(task2).toBe(task);

    stopReminderScheduler();
  });
});
