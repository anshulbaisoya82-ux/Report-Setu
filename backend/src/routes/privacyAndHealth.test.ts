import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Report } from '../utils/testModels';
import { Prescription } from '../utils/testModels';
import { AuditLog } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';

describe('Tasks 11.1 & 11.2: Privacy Operations, Health Probes & Metrics', () => {
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
      phone: '+919999900001',
      role: 'patient',
      isVerified: true,
      isActive: true,
    });

    patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      name: 'Rohan Sharma',
      phone: '+919999900001',
      age: 35,
      gender: 'Male',
      bloodGroup: 'O+',
      conditions: ['Hypertension'],
      location: 'Delhi',
      status: 'Normal',
    });

    patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
      phone: patientUser.phone,
    });

    // Create report & prescription
    await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'Complete Blood Count',
      category: 'CBC',
      labName: 'Apollo Labs',
      collectionDate: new Date('2026-10-20'),
      reportedDate: new Date('2026-10-20'),
      status: 'Normal',
      reviewed: true,
      parameters: [
        {
          id: 'p-1',
          name: 'Haemoglobin',
          value: 14.0,
          unit: 'g/dL',
          referenceRange: '13.0 - 17.0',
          status: 'Normal',
        },
      ],
    });

    await Prescription.create({
      patientId: patientProfile._id,
      doctorId: patientUser._id,
      doctorName: 'Dr. Priya Mehta',
      name: 'Wellness Regimen',
      instructions: 'Daily vitamins',
      startDate: new Date('2026-10-20'),
      endDate: new Date('2026-10-30'),
      totalDays: 10,
      status: 'Active',
      advice: ['Rest'],
    });
  });

  describe('Task 11.2: Health Probes & Metrics', () => {
    it('should return 200 OK for /health ping', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
    });

    it('should return 200 with uptime for /health/live probe', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should return 200 with database status for /health/ready probe when MongoDB connected', async () => {
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.database).toBe('connected');
    });
  });

  describe('Task 11.1: Patient Privacy Operations (Data Export & Right to Be Forgotten)', () => {
    it('should export complete personal health data and log compliance audit entry', async () => {
      const res = await request(app)
        .get('/api/v1/patient/privacy/export')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('exportedAt');
      expect(res.body.data).toHaveProperty('complianceNotice');
      expect(res.body.data.profile.name).toBe('Rohan Sharma');
      expect(res.body.data.reports.length).toBe(1);
      expect(res.body.data.prescriptions.length).toBe(1);

      // Verify audit log
      const audit = await AuditLog.findOne({
        action: 'DATA_EXPORT',
        patientId: patientProfile._id,
      });
      expect(audit).not.toBeNull();
      expect(audit?.purpose).toBe('GDPR_DPDP_RIGHT_OF_ACCESS');
    });

    it('should execute right to be forgotten: anonymize user, erase records, but retain forensic audit logs', async () => {
      const res = await request(app)
        .delete('/api/v1/patient/privacy/account')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('permanently erased');

      // Verify patient profile is deleted
      const profileAfter = await PatientProfile.findById(patientProfile._id);
      expect(profileAfter).toBeNull();

      // Verify clinical reports deleted
      const reportsAfter = await Report.find({ patientId: patientProfile._id });
      expect(reportsAfter.length).toBe(0);

      // Verify prescriptions deleted
      const rxAfter = await Prescription.find({ patientId: patientProfile._id });
      expect(rxAfter.length).toBe(0);

      // Verify user phone is irreversibly anonymized and deactivated
      const userAfter = await User.findById(patientUser._id);
      expect(userAfter?.isActive).toBe(false);
      expect(userAfter?.phone).toContain('ANON_');

      // Verify audit log is preserved
      const auditLog = await AuditLog.findOne({
        userId: patientUser._id,
        purpose: 'GDPR_DPDP_RIGHT_TO_ERASURE',
      });
      expect(auditLog).not.toBeNull();
    });
  });
});
