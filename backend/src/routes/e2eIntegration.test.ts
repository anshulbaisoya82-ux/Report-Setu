import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Connection } from '../utils/testModels';
import { ConnectCode } from '../utils/testModels';
import { Report } from '../utils/testModels';
import { Prescription } from '../utils/testModels';
import { MedicineSchedule } from '../utils/testModels';
import { ChatMessage } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';

describe('Task 11.5: Comprehensive End-to-End Clinical System Journey', () => {
  let app: Express;
  let doctorUser: any;
  let doctorProfile: any;
  let doctorToken: string;

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

    // 1. Setup Doctor
    doctorUser = await User.create({
      phone: '+919876500001',
      role: 'doctor',
      isVerified: true,
      isActive: true,
    });

    doctorProfile = await DoctorProfile.create({
      userId: doctorUser._id,
      name: 'Dr. Priya Mehta',
      phone: '+919876500001',
      email: 'priya.mehta@reportsetu.in',
      specialty: 'Internal Medicine',
      registrationNumber: 'MCI-88990',
      medicalCouncil: 'Delhi Medical Council',
      experienceYears: 14,
      hospital: 'Apollo Clinic & Hospital',
      rating: 4.9,
      reviewCount: 160,
      verificationStatus: 'verified',
    });

    doctorToken = signAccessToken({
      userId: doctorUser._id.toString(),
      role: 'doctor',
      phone: doctorUser.phone,
    });

    // 2. Setup Patient
    patientUser = await User.create({
      phone: '+919876543210',
      role: 'patient',
      isVerified: true,
      isActive: true,
    });

    patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      rsId: 'RS-10475',
      name: 'Rohan Verma',
      phone: '+919876543210',
      age: 32,
      gender: 'Male',
      bloodGroup: 'B+',
      conditions: ['Type 2 Diabetes'],
      location: 'Delhi, India',
      status: 'Critical',
      connectedDoctors: [],
    });

    patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
      phone: patientUser.phone,
    });
  });

  it('should execute full end-to-end clinical loop from connection to review, prescription, and AI chat', async () => {
    // Step 1: Patient generates Connect Code
    const codeRes = await request(app)
      .post('/api/v1/connections/patient/generate-code')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({});

    expect(codeRes.status).toBe(200);
    const connectCode = codeRes.body.data.code;
    expect(connectCode).toBeDefined();

    // Step 2: Doctor claims Connect Code
    const claimRes = await request(app)
      .post('/api/v1/connections/doctor/verify-code')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientRsId: patientProfile.rsId,
        code: connectCode,
      });

    expect(claimRes.status).toBe(200);
    expect(claimRes.body.data.connection.status).toBe('active');

    // Step 3: Patient uploads a lab report (mock multipart / direct report)
    const report = await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'Complete Blood Count (CBC)',
      category: 'CBC',
      labName: 'Apollo Diagnostics',
      collectionDate: new Date('2026-10-25'),
      reportedDate: new Date('2026-10-25'),
      status: 'Critical',
      reviewStatus: 'pending',
      reviewed: false,
      parameters: [
        {
          id: 'p-plt',
          name: 'Platelet Count',
          value: 120000,
          unit: '/µL',
          referenceRange: '150000 - 450000',
          status: 'Low',
          trendDirection: 'up',
        },
        {
          id: 'p-hb',
          name: 'Haemoglobin',
          value: 13.8,
          unit: 'g/dL',
          referenceRange: '13.0 - 17.0',
          status: 'Normal',
        },
      ],
    });

    // Step 4: Patient confirms extracted parameters
    const confirmRes = await request(app)
      .put(`/api/v1/reports/${report._id}/confirm`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        parameters: [
          { name: 'Platelet Count', value: 120000 },
          { name: 'Haemoglobin', value: 13.8 },
        ],
      });

    expect(confirmRes.status).toBe(200);

    // Step 5: Doctor generates AI Overview
    const overviewRes = await request(app)
      .post(`/api/v1/reports/${report._id}/ai-overview`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.pointsToConsider.length).toBeGreaterThan(0);

    // Step 6: Doctor generates patient-friendly draft summary
    const draftRes = await request(app)
      .post(`/api/v1/reports/${report._id}/generate-draft`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ tone: 'Plain language' });

    expect(draftRes.status).toBe(200);
    expect(draftRes.body.data.reviewStatus).toBe('pending_doctor_approval');

    // Step 7: Doctor reviews and approves report
    const reviewRes = await request(app)
      .put(`/api/v1/reports/${report._id}/review`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        text: 'Platelet recovery steady at 1.2 lakh. Repeat test scheduled in 5 days.',
        nextTestDate: '2026-10-30',
        medicinesStatus: 'No change',
      });

    expect(reviewRes.status).toBe(200);

    // Step 8: Doctor issues prescription
    const rxRes = await request(app)
      .post('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: patientProfile._id.toString(),
        name: 'Post-Viral Dengue Recovery',
        startDate: '2026-10-25',
        totalDays: 10,
        instructions: 'Take after meals. Hydrate well.',
        medicines: [
          {
            name: 'Carica Papaya Extract',
            dose: '1100 mg',
            timing: 'Morning & Night',
            frequency: 'Twice daily',
          },
        ],
      });

    expect(rxRes.status).toBe(201);

    // Step 9: Patient checks today's medicine schedule & logs dose taken
    const medsRes = await request(app)
      .get('/api/v1/medicines/today')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(medsRes.status).toBe(200);
    const scheduleItems = medsRes.body.data.schedule || medsRes.body.data;
    expect(Array.isArray(scheduleItems)).toBe(true);

    if (scheduleItems.length > 0) {
      const doseId = scheduleItems[0]._id || scheduleItems[0].id;
      const actionRes = await request(app)
        .post(`/api/v1/medicines/${doseId}/action`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ action: 'taken' });

      expect(actionRes.status).toBe(200);
      expect(actionRes.body.data.state).toBe('taken');
    }

    // Step 10: Patient asks AI clinical question
    const chatRes = await request(app)
      .post('/api/v1/patient/chat')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        message: 'What did Dr. Priya say about my platelet recovery in my approved summary?',
      });

    expect(chatRes.status).toBe(200);
    expect(chatRes.body.data.escalated).toBe(false);
    expect(chatRes.body.data.answer).toBeDefined();

    // Step 11: Patient asks forbidden medication change question -> Intercepted
    const medChatRes = await request(app)
      .post('/api/v1/patient/chat')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        message: 'Should I stop taking my papaya extract tablets?',
      });

    expect(medChatRes.status).toBe(200);
    expect(medChatRes.body.data.escalated).toBe(true);
    expect(medChatRes.body.data.isMedicineQuestion).toBe(true);
    expect(medChatRes.body.data.triageTag).toBe('Medicine');

    // Step 12: Doctor views questions inbox and replies
    const inboxRes = await request(app)
      .get('/api/v1/doctor/questions')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(inboxRes.status).toBe(200);
    expect(inboxRes.body.data.length).toBeGreaterThan(0);

    const threadId = inboxRes.body.data[0].id;
    const replyRes = await request(app)
      .post(`/api/v1/doctor/questions/${threadId}/reply`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        reply: 'Please continue taking the tablets as prescribed until our follow-up test.',
      });

    expect(replyRes.status).toBe(200);
    expect(replyRes.body.data.sender).toBe('doctor');

    // Step 13: Patient exports personal health records (GDPR/DPDP)
    const exportRes = await request(app)
      .get('/api/v1/patient/privacy/export')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.body.data.profile.rsId).toBe('RS-10475');
    expect(exportRes.body.data.reports.length).toBeGreaterThan(0);
    expect(exportRes.body.data.prescriptions.length).toBeGreaterThan(0);
  });
});
