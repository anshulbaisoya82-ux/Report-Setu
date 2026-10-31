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

describe('Task 5.5: Doctor Review Workflow & Status State Machine', () => {
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
    // 1. Doctor 1 (Verified, connected to Patient 1)
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

    // 2. Doctor 2 (Unconnected to Patient 1)
    const otherDoctorUser = await User.create({
      role: 'doctor',
      email: 'dr.verma@max.com',
      phone: '+919876543299',
      isActive: true,
      isVerified: true,
    });

    const otherDoctorProfile = await DoctorProfile.create({
      userId: otherDoctorUser._id,
      name: 'Dr. Neha Verma',
      email: otherDoctorUser.email,
      phone: otherDoctorUser.phone,
      registrationNumber: 'DMC-2024-9999',
      medicalCouncil: 'Delhi Medical Council',
      specialty: 'Endocrinologist',
      clinic: { name: 'Max Hospital', city: 'Saket' },
      verificationStatus: 'verified',
    });

    const otherDoctorToken = signAccessToken({
      userId: otherDoctorUser._id.toString(),
      role: 'doctor',
      isVerified: true,
    });

    // 3. Patient 1
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

    // 4. Active Connection between Patient 1 and Doctor 1
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
      otherDoctorUser,
      otherDoctorProfile,
      otherDoctorToken,
      patientUser,
      patientProfile,
      patientToken,
    };
  };

  describe('GET /api/v1/reports/doctor/inbox', () => {
    it('should reject non-doctor requests with 401/403', async () => {
      const { patientToken } = await setupFixtures();

      const res = await request(app)
        .get('/api/v1/reports/doctor/inbox')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(401);
    });

    it('should list reports for connected patients ordered by urgent review score', async () => {
      const { doctorToken, patientProfile } = await setupFixtures();

      // Create Report A: Normal status, pending review
      const reportNormal = await Report.create({
        patientId: patientProfile._id,
        patientName: patientProfile.name,
        name: 'Lipid Profile',
        category: 'Lipid',
        labName: 'Apollo Diagnostics',
        collectionDate: new Date(Date.now() - 24 * 3600 * 1000),
        reportedDate: new Date(),
        status: 'Normal',
        reviewStatus: 'pending',
        reviewed: false,
        parameters: [],
      });

      // Create Report B: Critical status, pending review
      const reportCritical = await Report.create({
        patientId: patientProfile._id,
        patientName: patientProfile.name,
        name: 'Complete Blood Count (CBC)',
        category: 'CBC',
        labName: 'Apollo Diagnostics',
        collectionDate: new Date(),
        reportedDate: new Date(),
        status: 'Critical',
        reviewStatus: 'pending',
        reviewed: false,
        parameters: [],
      });

      const res = await request(app)
        .get('/api/v1/reports/doctor/inbox')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reports).toBeDefined();
      expect(res.body.data.reports.length).toBe(2);

      // Verify that Critical report appears first due to higher urgency score
      const firstReport = res.body.data.reports[0];
      const secondReport = res.body.data.reports[1];
      expect(firstReport.id).toBe(reportCritical._id.toString());
      expect(firstReport.status).toBe('Critical');
      expect(firstReport.urgencyScore).toBeGreaterThan(secondReport.urgencyScore);
    });

    it('should not return reports of patients not connected to the doctor', async () => {
      const { otherDoctorToken, patientProfile } = await setupFixtures();

      await Report.create({
        patientId: patientProfile._id,
        patientName: patientProfile.name,
        name: 'Thyroid Panel',
        category: 'Other',
        labName: 'SRL Diagnostics',
        collectionDate: new Date(),
        reportedDate: new Date(),
        status: 'Normal',
        reviewStatus: 'pending',
        reviewed: false,
        parameters: [],
      });

      // Doctor 2 has no connection to Patient 1
      const res = await request(app)
        .get('/api/v1/reports/doctor/inbox')
        .set('Authorization', `Bearer ${otherDoctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reports.length).toBe(0);
    });
  });

  describe('Doctor Review State Machine & Patient Visibility Restrictions', () => {
    it('should prevent patient from seeing doctorSummary and aiOverview when report is pending/in_review', async () => {
      const { patientToken, patientProfile } = await setupFixtures();

      const report = await Report.create({
        patientId: patientProfile._id,
        patientName: patientProfile.name,
        name: 'Complete Blood Count (CBC)',
        category: 'CBC',
        labName: 'Apollo Diagnostics',
        collectionDate: new Date(),
        reportedDate: new Date(),
        status: 'Unbalanced',
        reviewStatus: 'in_review',
        reviewed: false,
        parameters: [],
        aiOverview: {
          summary: 'Internal AI overview draft',
          pointsToConsider: ['Internal note'],
          keyFindings: [],
          generatedAt: new Date(),
        },
        doctorSummary: {
          text: 'Draft doctor impression',
          tone: 'Plain language',
          approvedAt: new Date(),
          doctorName: 'Dr. Ramesh Sharma',
        },
      });

      // Patient views the unreviewed report
      const res = await request(app)
        .get(`/api/v1/reports/${report._id}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data.report;
      expect(data.reviewed).toBe(false);

      // Verify privacy restriction: doctorSummary and aiOverview are stripped
      expect(data.doctorSummary).toBeUndefined();
      expect(data.aiOverview).toBeUndefined();
    });

    it('should allow connected doctor to review and approve report', async () => {
      const { doctorToken, patientToken, patientProfile, patientUser } = await setupFixtures();

      const report = await Report.create({
        patientId: patientProfile._id,
        patientName: patientProfile.name,
        name: 'HbA1c Glycated Hemoglobin',
        category: 'HbA1c',
        labName: 'Thyrocare',
        collectionDate: new Date(),
        reportedDate: new Date(),
        status: 'Unbalanced',
        reviewStatus: 'pending',
        reviewed: false,
        parameters: [
          {
            id: 'param-1',
            name: 'HbA1c',
            value: 6.8,
            unit: '%',
            referenceRange: '< 5.7',
            status: 'High',
          },
        ],
        aiOverview: {
          summary: 'HbA1c is mildly elevated at 6.8%',
          pointsToConsider: ['Monitor glucose intake'],
          keyFindings: [],
          generatedAt: new Date(),
        },
      });

      // Doctor reviews and approves the report
      const res = await request(app)
        .put(`/api/v1/reports/${report._id}/review`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          text: 'HbA1c is slightly elevated. Continue current metformin dosage and repeat test in 3 months.',
          hindiText: 'HbA1c thoda bada hua hai. Dawa jaari rakhein.',
          tone: 'Plain language',
          nextTestDate: '2026-05-15',
          medicinesStatus: 'No change',
          sentVia: ['App', 'SMS'],
          doctorNotes: 'Patient showed good compliance. No hypoglycemic episodes reported.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const reviewedReport = res.body.data.report;
      expect(reviewedReport.reviewed).toBe(true);
      expect(reviewedReport.reviewStatus).toBe('approved');
      expect(reviewedReport.doctorSummary).toBeDefined();
      expect(reviewedReport.doctorSummary.text).toContain('metformin');
      expect(reviewedReport.doctorSummary.nextTestDate).toBe('2026-05-15');

      // Verify Notification sent to patient
      const notification = await Notification.findOne({
        userId: patientUser._id,
        type: 'report_reviewed',
      });
      expect(notification).toBeDefined();
      expect(notification?.message).toContain('Dr. Ramesh Sharma');

      // Verify AuditLog entry for REPORT_UPDATE
      const auditLog = await AuditLog.findOne({
        action: 'REPORT_UPDATE',
        resourceId: report._id.toString(),
      });
      expect(auditLog).toBeDefined();
      expect(auditLog?.userRole).toBe('doctor');

      // NOW verify patient CAN see doctorSummary and aiOverview because it is approved
      const patientRes = await request(app)
        .get(`/api/v1/reports/${report._id}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(patientRes.status).toBe(200);
      const patientView = patientRes.body.data.report;
      expect(patientView.reviewed).toBe(true);
      expect(patientView.doctorSummary).toBeDefined();
      expect(patientView.doctorSummary.text).toContain('metformin');
      expect(patientView.aiOverview).toBeDefined();
      expect(patientView.aiOverview.summary).toContain('HbA1c is mildly elevated');

      // But private notes must STILL be hidden from patient
      expect(patientView.doctorNotes).toBeUndefined();
    });

    it('should reject report review if doctor is not actively connected to patient (403 Forbidden)', async () => {
      const { otherDoctorToken, patientProfile } = await setupFixtures();

      const report = await Report.create({
        patientId: patientProfile._id,
        patientName: patientProfile.name,
        name: 'Kidney Function Test',
        category: 'KFT',
        labName: 'Apollo Diagnostics',
        collectionDate: new Date(),
        reportedDate: new Date(),
        status: 'Normal',
        reviewStatus: 'pending',
        reviewed: false,
        parameters: [],
      });

      // Doctor 2 attempts to review Patient 1's report
      const res = await request(app)
        .put(`/api/v1/reports/${report._id}/review`)
        .set('Authorization', `Bearer ${otherDoctorToken}`)
        .send({
          text: 'Test review by unconnected doctor',
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toMatch(/Active connection required/i);
    });

    it('should allow updating reviewStatus to in_review', async () => {
      const { doctorToken, patientProfile } = await setupFixtures();

      const report = await Report.create({
        patientId: patientProfile._id,
        patientName: patientProfile.name,
        name: 'Liver Function Test',
        category: 'LFT',
        labName: 'Apollo Diagnostics',
        collectionDate: new Date(),
        reportedDate: new Date(),
        status: 'Normal',
        reviewStatus: 'pending',
        reviewed: false,
        parameters: [],
      });

      const res = await request(app)
        .put(`/api/v1/reports/${report._id}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          reviewStatus: 'in_review',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.report.reviewStatus).toBe('in_review');
      expect(res.body.data.report.reviewed).toBe(false);
    });
  });
});
