import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Connection } from '../utils/testModels';
import { Report } from '../utils/testModels';
import { Notification } from '../utils/testModels';
import { AuditLog } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';

describe('Task 5.4: Patient Upload, Value Correction & Audit History', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  const setupFixtures = async () => {
    // 1. Doctor (Verified)
    const doctorUser = await User.create({
      role: 'doctor',
      email: 'dr.sharma@apollo.com',
      phone: '+919876543210',
      isActive: true,
      isVerified: true,
    });

    const doctorProfile = await DoctorProfile.create({
      userId: doctorUser._id,
      name: 'Dr. Ramesh Sharma',
      email: doctorUser.email,
      phone: doctorUser.phone,
      registrationNumber: 'DMC-2023-1234',
      medicalCouncil: 'Delhi Medical Council',
      specialty: 'Internal Medicine',
      clinic: { name: 'Apollo Clinic', city: 'New Delhi' },
      verificationStatus: 'verified',
    });

    const doctorToken = signAccessToken({
      userId: doctorUser._id.toString(),
      role: 'doctor',
      isVerified: true,
    });

    // 2. Patient 1
    const patientUser = await User.create({
      role: 'patient',
      phone: '+919811111111',
      isActive: true,
      isVerified: true,
    });

    const patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      name: 'Amit Kumar',
      phone: patientUser.phone,
      rsId: 'RS-88888',
      age: 42,
      gender: 'Male',
      bloodGroup: 'O+',
    });

    const patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
    });

    // 3. Patient 2 (Unrelated)
    const otherPatientUser = await User.create({
      role: 'patient',
      phone: '+919822222222',
      isActive: true,
      isVerified: true,
    });

    const otherPatientProfile = await PatientProfile.create({
      userId: otherPatientUser._id,
      name: 'Sunita Rao',
      phone: otherPatientUser.phone,
      rsId: 'RS-99999',
      age: 38,
      gender: 'Female',
      bloodGroup: 'A+',
    });

    const otherPatientToken = signAccessToken({
      userId: otherPatientUser._id.toString(),
      role: 'patient',
    });

    // 4. Active Connection between Patient 1 and Doctor
    await Connection.create({
      patientId: patientProfile._id,
      doctorId: doctorProfile._id,
      status: 'active',
      connectedAt: new Date(),
    });

    return {
      doctorUser,
      doctorProfile,
      doctorToken,
      patientUser,
      patientProfile,
      patientToken,
      otherPatientUser,
      otherPatientProfile,
      otherPatientToken,
    };
  };

  describe('POST /api/v1/reports/upload', () => {
    it('should reject unauthenticated upload requests with 401', async () => {
      const res = await request(app)
        .post('/api/v1/reports/upload')
        .attach('file', Buffer.from('%PDF-1.4 sample'), 'report.pdf');

      expect(res.status).toBe(401);
    });

    it('should reject disguised executable files (.exe with .pdf extension) with 400', async () => {
      const { patientToken } = await setupFixtures();

      const fakePdfBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00 fake executable data');

      const res = await request(app)
        .post('/api/v1/reports/upload')
        .set('Authorization', `Bearer ${patientToken}`)
        .attach('file', fakePdfBuffer, 'trojan.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toMatch(/Disguised binary|Invalid file content signature/i);
    });

    it('should successfully upload and extract a valid PDF report for patient', async () => {
      const { patientToken, patientProfile } = await setupFixtures();

      const samplePdfContent =
        '%PDF-1.4\nApollo Diagnostics\nComplete Blood Count (CBC)\nHemoglobin 14.2 g/dL (13.0 - 17.0)\nPlatelet Count 250000 /uL (150000 - 450000)\n%%EOF';
      const validPdfBuffer = Buffer.from(samplePdfContent);

      const res = await request(app)
        .post('/api/v1/reports/upload')
        .set('Authorization', `Bearer ${patientToken}`)
        .attach('file', validPdfBuffer, 'cbc_report.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report).toBeDefined();
      expect(res.body.data.analysis).toBeDefined();

      const report = res.body.data.report;
      expect(report.patientId.toString()).toBe(patientProfile._id.toString());
      expect(report.patientName).toBe(patientProfile.name);
      expect(report.status).toBe('Normal');
      expect(report.reviewed).toBe(false);
      expect(report.parameters.length).toBeGreaterThan(0);

      // Verify parameters preserve original extracted values
      const firstParam = report.parameters[0];
      expect(firstParam.originalValue).toBeDefined();
      expect(firstParam.isEdited).toBe(false);

      // Verify AuditLog entry was recorded
      const auditLog = await AuditLog.findOne({
        action: 'REPORT_CREATE',
        patientId: patientProfile._id,
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.userRole).toBe('patient');
    });

    it('should allow a connected doctor to upload a report on behalf of their patient', async () => {
      const { doctorToken, patientProfile } = await setupFixtures();

      const samplePdfContent =
        '%PDF-1.4\nMetropolis Healthcare\nLipid Profile\nCholesterol 220 mg/dL (< 200)\nTriglycerides 180 mg/dL (< 150)\n%%EOF';
      const validPdfBuffer = Buffer.from(samplePdfContent);

      const res = await request(app)
        .post('/api/v1/reports/upload')
        .set('Authorization', `Bearer ${doctorToken}`)
        .field('patientId', patientProfile._id.toString())
        .attach('file', validPdfBuffer, 'lipid_report.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report.patientId.toString()).toBe(patientProfile._id.toString());
    });
  });

  describe('PUT /api/v1/reports/:id/confirm', () => {
    it('should save corrected parameter values preserving originalValue and setting isEdited', async () => {
      const { patientToken, patientProfile } = await setupFixtures();

      // Create an existing report with initial normal parameters
      const initialReport = await Report.create({
        patientId: patientProfile._id,
        patientName: patientProfile.name,
        name: 'Complete Blood Count (CBC)',
        category: 'CBC',
        labName: 'Apollo Diagnostics',
        collectionDate: new Date(),
        reportedDate: new Date(),
        status: 'Normal',
        reviewed: false,
        parameters: [
          {
            id: 'param-1',
            name: 'Platelet Count',
            value: 200000,
            unit: '/uL',
            referenceRange: '150000 - 450000',
            status: 'Normal',
            originalValue: 200000,
            isEdited: false,
          },
          {
            id: 'param-2',
            name: 'Hemoglobin',
            value: 14.5,
            unit: 'g/dL',
            referenceRange: '13.0 - 17.0',
            status: 'Normal',
            originalValue: 14.5,
            isEdited: false,
          },
        ],
      });

      // Patient confirms report but corrects Platelet Count to 160000 (still normal)
      const res = await request(app)
        .put(`/api/v1/reports/${initialReport._id}/confirm`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          parameters: [
            {
              id: 'param-1',
              name: 'Platelet Count',
              value: 160000,
              unit: '/uL',
              referenceRange: '150000 - 450000',
            },
            {
              id: 'param-2',
              name: 'Hemoglobin',
              value: 14.5,
              unit: 'g/dL',
              referenceRange: '13.0 - 17.0',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedReport = res.body.data.report;
      const plateletParam = updatedReport.parameters.find((p: any) => p.name === 'Platelet Count');
      expect(plateletParam.originalValue).toBe(200000);
      expect(plateletParam.correctedValue).toBe(160000);
      expect(plateletParam.value).toBe(160000);
      expect(plateletParam.isEdited).toBe(true);
      expect(plateletParam.status).toBe('Normal');

      // Hemoglobin was not changed
      const hbParam = updatedReport.parameters.find((p: any) => p.name === 'Hemoglobin');
      expect(hbParam.value).toBe(14.5);
      expect(hbParam.isEdited).toBe(false);

      // Verify AuditLog for REPORT_UPDATE
      const auditLog = await AuditLog.findOne({
        action: 'REPORT_UPDATE',
        resourceId: initialReport._id.toString(),
      });
      expect(auditLog).toBeDefined();
    });

    it('should recalculate report status to Critical and create high-priority notification for connected doctor', async () => {
      const { patientToken, patientProfile, doctorUser } = await setupFixtures();

      const initialReport = await Report.create({
        patientId: patientProfile._id,
        patientName: patientProfile.name,
        name: 'Complete Blood Count (CBC)',
        category: 'CBC',
        labName: 'Apollo Diagnostics',
        collectionDate: new Date(),
        reportedDate: new Date(),
        status: 'Normal',
        reviewed: false,
        parameters: [
          {
            id: 'param-1',
            name: 'Platelet Count',
            value: 200000,
            unit: '/uL',
            referenceRange: '150000 - 450000',
            status: 'Normal',
            originalValue: 200000,
            isEdited: false,
          },
        ],
      });

      // Patient edits Platelet Count to critical value: 30000 (< 50000 is critical thrombocytopenia)
      const res = await request(app)
        .put(`/api/v1/reports/${initialReport._id}/confirm`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          parameters: [
            {
              id: 'param-1',
              name: 'Platelet Count',
              value: 30000,
              unit: '/uL',
              referenceRange: '150000 - 450000',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedReport = res.body.data.report;
      expect(updatedReport.status).toBe('Critical');
      const param = updatedReport.parameters[0];
      expect(param.status).toBe('Critical');
      expect(param.isEdited).toBe(true);
      expect(param.correctedValue).toBe(30000);
      expect(param.originalValue).toBe(200000);

      // Verify notification created for doctor
      const notification = await Notification.findOne({
        userId: doctorUser._id,
        type: 'critical_alert',
      });
      expect(notification).toBeDefined();
      expect(notification?.title).toMatch(/Critical Lab Alert/i);
      expect(notification?.message).toContain('Amit Kumar');
    });

    it('should reject parameter confirmation if caller is not the owner patient (403 Forbidden)', async () => {
      const { otherPatientToken, patientProfile } = await setupFixtures();

      const patient1Report = await Report.create({
        patientId: patientProfile._id,
        patientName: patientProfile.name,
        name: 'Complete Blood Count (CBC)',
        category: 'CBC',
        labName: 'Apollo Diagnostics',
        collectionDate: new Date(),
        reportedDate: new Date(),
        status: 'Normal',
        reviewed: false,
        parameters: [
          {
            id: 'param-1',
            name: 'Hemoglobin',
            value: 13.5,
            unit: 'g/dL',
            referenceRange: '13.0 - 17.0',
            status: 'Normal',
          },
        ],
      });

      // Patient 2 attempts to confirm Patient 1's report
      const res = await request(app)
        .put(`/api/v1/reports/${patient1Report._id}/confirm`)
        .set('Authorization', `Bearer ${otherPatientToken}`)
        .send({
          parameters: [
            {
              id: 'param-1',
              name: 'Hemoglobin',
              value: 14.0,
            },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toMatch(/Access denied/i);
    });

    it('should return 422 Unprocessable Entity when parameters array is empty', async () => {
      const { patientToken, patientProfile } = await setupFixtures();

      const report = await Report.create({
        patientId: patientProfile._id,
        patientName: patientProfile.name,
        name: 'Test Report',
        category: 'Other',
        labName: 'Test Lab',
        collectionDate: new Date(),
        reportedDate: new Date(),
        status: 'Normal',
        reviewed: false,
        parameters: [],
      });

      const res = await request(app)
        .put(`/api/v1/reports/${report._id}/confirm`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          parameters: [],
        });

      expect(res.status).toBe(422);
    });
  });
});
