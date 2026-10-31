import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Notification } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';
import {
  sendSmsStub,
  sendEmailStub,
  dispatchNotificationWithPreferences,
} from '../services/notificationService';
import { logger } from '../utils/logger';

describe('Task 7.3: In-App Notification System & Delivery Stubs', () => {
  let app: Express;
  let patientUser: any;
  let patientProfile: any;
  let patientToken: string;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    patientUser = await User.create({
      phone: '+919811100001',
      role: 'patient',
      isActive: true,
      isVerified: true,
    });
    patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      name: 'Rohan Verma',
      age: 45,
      gender: 'Male',
      phone: '+919811100001',
      status: 'Normal',
      notificationPreferences: {
        medicineReminders: true,
        testDueReminders: true,
        doctorReplies: false, // Muted doctor replies for testing
        criticalAlerts: true,
        whatsappAlerts: false,
      },
    });
    patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
      isVerified: true,
    });
  });

  it('should return paginated notifications with accurate unread counts', async () => {
    // Seed 3 notifications (2 unread, 1 read)
    await Notification.create([
      {
        userId: patientUser._id,
        type: 'report_uploaded',
        title: 'Report Ready',
        message: 'Your CBC report is ready for viewing.',
        isRead: false,
      },
      {
        userId: patientUser._id,
        type: 'critical_alert',
        title: 'Critical Lab Value',
        message: 'Platelet count is low. Physician notified.',
        isRead: false,
      },
      {
        userId: patientUser._id,
        type: 'connection_approved',
        title: 'Doctor Connected',
        message: 'Connected with Dr. Priya Mehta.',
        isRead: true,
      },
    ]);

    const res = await request(app)
      .get('/api/v1/notifications?limit=2&page=1')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications).toHaveLength(2);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.unreadCount).toBe(2);
    expect(res.body.meta.totalPages).toBe(2);
  });

  it('should mark an individual notification as read', async () => {
    const notif = await Notification.create({
      userId: patientUser._id,
      type: 'report_uploaded',
      title: 'Unread Alert',
      message: 'Test message',
      isRead: false,
    });

    const res = await request(app)
      .put(`/api/v1/notifications/${notif._id}/read`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isRead).toBe(true);

    const updated = await Notification.findById(notif._id);
    expect(updated?.isRead).toBe(true);
  });

  it('should mark all notifications as read in bulk', async () => {
    await Notification.create([
      { userId: patientUser._id, type: 'critical_alert', title: 'Alert 1', message: 'M1', isRead: false },
      { userId: patientUser._id, type: 'critical_alert', title: 'Alert 2', message: 'M2', isRead: false },
    ]);

    const res = await request(app)
      .put('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updatedCount).toBe(2);

    const remainingUnread = await Notification.countDocuments({
      userId: patientUser._id,
      isRead: false,
    });
    expect(remainingUnread).toBe(0);
  });

  it('should simulate SMS and Email delivery stubs without crashing', async () => {
    const loggerSpy = vi.spyOn(logger, 'info');

    const smsRes = await sendSmsStub('+919811100001', 'Simulated SMS test');
    expect(smsRes.delivered).toBe(true);
    expect(smsRes.channel).toBe('SMS');

    const emailRes = await sendEmailStub('patient@example.com', 'Lab Report', '<p>Report ready</p>');
    expect(emailRes.delivered).toBe(true);
    expect(emailRes.channel).toBe('EMAIL');

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sms_dispatch_stub' })
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'email_dispatch_stub' })
    );

    loggerSpy.mockRestore();
  });

  it('should enforce user notification preferences and mute disabled notification types', async () => {
    // 1. Allowed type: test_due_reminder (preference is true)
    const allowed = await dispatchNotificationWithPreferences(
      patientUser._id.toString(),
      'test_due_reminder',
      'Repeat CBC Due',
      'Your doctor recommends repeat testing this Friday.'
    );
    expect(allowed).not.toBeNull();
    expect(allowed?.type).toBe('test_due_reminder');

    // 2. Muted type: doctor_reply (preference is explicitly false in fixture)
    const muted = await dispatchNotificationWithPreferences(
      patientUser._id.toString(),
      'doctor_reply',
      'Dr. Priya Mehta replied',
      'Take your medication with meals.'
    );
    expect(muted).toBeNull();

    // Verify database only contains the allowed notification
    const count = await Notification.countDocuments({ userId: patientUser._id });
    expect(count).toBe(1);
  });
});
