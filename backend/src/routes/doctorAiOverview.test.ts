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
import { ChatMessage } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';

describe('Phase 10: Doctor Summary, Draft Assistant, Copilot Search & Number Verification', () => {
  let app: Express;
  let doctorUser: any;
  let doctorProfile: any;
  let doctorToken: string;

  let patientUser: any;
  let patientProfile: any;
  let patientToken: string;
  let testReport: any;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Create doctor
    doctorUser = await User.create({
      phone: '+919876511111',
      role: 'doctor',
      isVerified: true,
      isActive: true,
    });

    doctorProfile = await DoctorProfile.create({
      userId: doctorUser._id,
      name: 'Dr. Priya Mehta',
      phone: '+919876511111',
      email: 'priya.doctor@reportsetu.in',
      specialty: 'Internal Medicine',
      registrationNumber: 'MCI-77889',
      medicalCouncil: 'Delhi Medical Council',
      experienceYears: 15,
      hospital: 'Apollo Clinic & Hospital',
      rating: 4.9,
      reviewCount: 210,
      verificationStatus: 'verified',
    });

    doctorToken = signAccessToken({
      userId: doctorUser._id.toString(),
      role: 'doctor',
      phone: doctorUser.phone,
    });

    // Create patient
    patientUser = await User.create({
      phone: '+919876522222',
      role: 'patient',
      isVerified: true,
      isActive: true,
    });

    patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      name: 'Rohan Verma',
      phone: '+919876522222',
      age: 52,
      gender: 'Male',
      bloodGroup: 'B+',
      conditions: ['Type 2 Diabetes'],
      location: 'South Delhi',
      status: 'Critical',
      connectedDoctors: [doctorProfile._id],
    });

    patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
      phone: patientUser.phone,
    });

    // Create active connection
    await Connection.create({
      patientId: patientProfile._id,
      doctorId: doctorUser._id,
      status: 'active',
      initiatedBy: 'doctor',
      connectedAt: new Date(),
    });

    // Create report with abnormal Platelet Count
    testReport = await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'Complete Blood Count',
      category: 'CBC',
      labName: 'Apollo Diagnostics',
      collectionDate: new Date('2026-10-22'),
      reportedDate: new Date('2026-10-22'),
      status: 'Critical',
      reviewStatus: 'pending',
      reviewed: false,
      parameters: [
        {
          id: 'p-1',
          name: 'Platelet Count',
          value: 120000,
          unit: '/µL',
          referenceRange: '150000 - 450000',
          status: 'Low',
          trendDirection: 'up',
          change: 'Rising from 85,000 /µL',
        },
        {
          id: 'p-2',
          name: 'Haemoglobin',
          value: 13.5,
          unit: 'g/dL',
          referenceRange: '13.0 - 17.0',
          status: 'Normal',
          trendDirection: 'neutral',
        },
      ],
    });
  });

  describe('Task 10.1: Clinical Overview & Key Findings Generation', () => {
    it('should generate structured AI Overview with key findings, non-autonomous points to consider, and input provenance hash', async () => {
      const res = await request(app)
        .post(`/api/v1/reports/${testReport._id}/ai-overview`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data).toHaveProperty('pointsToConsider');
      expect(res.body.data).toHaveProperty('keyFindings');
      expect(res.body.data).toHaveProperty('inputHash');

      // Verify points to consider are phrased non-autonomously
      expect(res.body.data.pointsToConsider.length).toBeGreaterThan(0);
      expect(res.body.data.pointsToConsider[0]).toMatch(/Consider/i);

      // Verify key findings match frontend schema
      const kf = res.body.data.keyFindings;
      expect(kf.length).toBe(2);
      expect(kf[0]).toHaveProperty('parameter', 'Platelet Count');
      expect(kf[0]).toHaveProperty('tag', 'Low');

      // Verify report was updated in DB
      const updatedReport = await Report.findById(testReport._id);
      expect(updatedReport?.aiOverview).toBeDefined();
      expect(updatedReport?.aiOverview?.summary).toBe(res.body.data.summary);
    });
  });

  describe('Task 10.2: Patient-Friendly Summary Draft in English & Hindi', () => {
    it('should generate draft summaries in English and Hindi with pending status not visible to patient', async () => {
      const res = await request(app)
        .post(`/api/v1/reports/${testReport._id}/generate-draft`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          tone: 'Plain language',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('summaryEn');
      expect(res.body.data).toHaveProperty('summaryHi');
      expect(res.body.data.reviewStatus).toBe('pending_doctor_approval');
      expect(res.body.data.isApproved).toBe(false);

      // Verify patient CANNOT see this draft as approved report summary
      const patientView = await request(app)
        .get(`/api/v1/reports/${testReport._id}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(patientView.status).toBe(200);
      const reportData = patientView.body.data.report || patientView.body.data;
      expect(reportData.reviewed).toBe(false);
      expect(reportData.doctorSummary).toBeUndefined();
    });
  });

  describe('Task 10.2: Doctor Copilot Search Tools', () => {
    it('should search across connected patients by keyword, test parameter, or critical priority', async () => {
      // 1. Search by critical priority
      const criticalRes = await request(app)
        .get('/api/v1/doctor/copilot/search?priority=critical')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(criticalRes.status).toBe(200);
      expect(criticalRes.body.data.length).toBe(1);
      expect(criticalRes.body.data[0].patientName).toBe('Rohan Verma');

      // 2. Search by parameter testCode
      const paramRes = await request(app)
        .get('/api/v1/doctor/copilot/search?testCode=platelet')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(paramRes.status).toBe(200);
      expect(paramRes.body.data.length).toBe(1);

      // 3. Search non-matching parameter
      const emptyRes = await request(app)
        .get('/api/v1/doctor/copilot/search?testCode=creatinine')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body.data.length).toBe(0);
    });
  });

  describe('Task 10.4: Patient Question Suggested Reply Generator', () => {
    it('should generate contextual suggested reply based on thread history and verified report', async () => {
      // Create a patient question message
      await ChatMessage.create({
        patientId: patientProfile._id,
        sender: 'patient',
        text: 'Doctor, are my platelets improving from dengue?',
        threadId: `thread-${patientProfile._id}`,
      });

      const res = await request(app)
        .post(`/api/v1/doctor/threads/thread-${patientProfile._id}/suggest-reply`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('suggestedReply');
      expect(res.body.data.suggestedReply).toContain('Rohan');
      expect(res.body.data.suggestedReply).toMatch(/platelet|improvement|recovery/i);
    });
  });
});
