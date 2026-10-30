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
import { ChatMessage } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';

describe('Task 9.3: Grounded Clinical QA & ML Patient Chat Assistant', () => {
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

    // Create doctor
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
      email: 'priya@reportsetu.in',
      specialty: 'Internal Medicine',
      registrationNumber: 'MCI-88990',
      medicalCouncil: 'Delhi Medical Council',
      experienceYears: 14,
      hospital: 'Apollo Clinic & Hospital',
      verificationStatus: 'verified',
    });

    doctorToken = signAccessToken({
      userId: doctorUser._id.toString(),
      role: 'doctor',
      phone: doctorUser.phone,
    });

    // Create patient
    patientUser = await User.create({
      phone: '+919876500002',
      role: 'patient',
      isVerified: true,
      isActive: true,
    });

    patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      name: 'Rohan Verma',
      phone: '+919876500002',
      age: 52,
      gender: 'Male',
      bloodGroup: 'B+',
      conditions: ['Type 2 Diabetes'],
      location: 'South Delhi',
      connectedDoctors: [doctorProfile._id],
    });

    patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
      phone: patientUser.phone,
    });

    // Create active connection between patient and doctor
    await Connection.create({
      patientId: patientProfile._id,
      doctorId: doctorUser._id,
      status: 'active',
      initiatedBy: 'doctor',
      connectedAt: new Date(),
    });

    // Create confirmed report with doctor-approved summary
    await Report.create({
      patientId: patientProfile._id,
      patientName: patientProfile.name,
      name: 'Complete Blood Count',
      category: 'CBC',
      labName: 'Apollo Diagnostics',
      collectionDate: new Date('2026-10-20'),
      reportedDate: new Date('2026-10-20'),
      status: 'Normal',
      reviewStatus: 'approved',
      reviewed: true,
      parameters: [
        {
          id: 'p-1',
          name: 'Platelet Count',
          value: 120000,
          unit: '/µL',
          referenceRange: '150000 - 450000',
          status: 'Low',
        },
        {
          id: 'p-2',
          name: 'Haemoglobin',
          value: 14.2,
          unit: 'g/dL',
          referenceRange: '13.0 - 17.0',
          status: 'Normal',
        },
      ],
      doctorSummary: {
        text: 'Platelet count of 1.2 lakh/µL shows steady recovery from viral infection. Continue hydration.',
        doctorName: 'Dr. Priya Mehta',
        approvedAt: new Date('2026-10-21'),
        tone: 'Plain language',
      },
    });
  });

  it('should answer safe lab report question with parameter citation and persist messages', async () => {
    const res = await request(app)
      .post('/api/v1/patient/chat')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        message: 'What does my doctor-approved report say about my platelet count?',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.escalated).toBe(false);
    expect(res.body.data.isMedicineQuestion).toBe(false);
    expect(res.body.data.answer).toBeDefined();

    // Verify citation extracted
    expect(Array.isArray(res.body.data.citations)).toBe(true);

    // Verify messages saved in DB
    const msgs = await ChatMessage.find({ patientId: patientProfile._id });
    expect(msgs.length).toBe(2); // Patient message + Assistant message
    expect(msgs[0].sender).toBe('patient');
    expect(msgs[1].sender).toBe('assistant');
  });

  it('should intercept medication modification queries, flag as medicine question, and notify doctor', async () => {
    const res = await request(app)
      .post('/api/v1/patient/chat')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        message: 'Should I stop taking my metformin pill since my sugar is better?',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.escalated).toBe(true);
    expect(res.body.data.isMedicineQuestion).toBe(true);
    expect(res.body.data.category).toBe('medication_alteration');
    expect(res.body.data.triageTag).toBe('Medicine');
    expect(res.body.data.answer).toContain('doctor');

    // Verify doctor received notification
    const notification = await Notification.findOne({
      userId: doctorUser._id,
      type: 'patient_question',
    });
    expect(notification).not.toBeNull();
    expect(notification?.title).toContain('Medication Inquiry');
  });

  it('should fetch chat history and question thread formatted for frontend', async () => {
    // Post one message
    await request(app)
      .post('/api/v1/patient/chat')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        message: 'Explain what haemoglobin is',
      });

    // 1. History
    const historyRes = await request(app)
      .get('/api/v1/patient/chat/history')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(historyRes.status).toBe(200);
    expect(Array.isArray(historyRes.body.data)).toBe(true);
    expect(historyRes.body.data.length).toBe(2);
    expect(historyRes.body.data[0]).toHaveProperty('sender', 'patient');
    expect(historyRes.body.data[1]).toHaveProperty('sender', 'assistant');

    // 2. Thread
    const threadRes = await request(app)
      .get('/api/v1/patient/chat/thread')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(threadRes.status).toBe(200);
    expect(threadRes.body.data).toHaveProperty('patientName', 'Rohan Verma');
    expect(threadRes.body.data).toHaveProperty('messages');
    expect(threadRes.body.data.messages.length).toBe(2);
  });

  it('should allow doctor to view question inbox and reply to patient thread', async () => {
    // Patient asks a medication question
    await request(app)
      .post('/api/v1/patient/chat')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        message: 'Can I reduce my dose to once daily?',
      });

    // Doctor checks questions inbox
    const inboxRes = await request(app)
      .get('/api/v1/doctor/questions')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(inboxRes.status).toBe(200);
    expect(Array.isArray(inboxRes.body.data)).toBe(true);
    expect(inboxRes.body.data.length).toBe(1);
    expect(inboxRes.body.data[0].patientName).toBe('Rohan Verma');
    expect(inboxRes.body.data[0].category).toBe('Medicine');

    const threadId = inboxRes.body.data[0].id;

    // Doctor replies to question
    const replyRes = await request(app)
      .post(`/api/v1/doctor/questions/${threadId}/reply`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        reply: 'Please do not change your dose. Continue twice daily until our follow-up next week.',
      });

    expect(replyRes.status).toBe(200);
    expect(replyRes.body.data.sender).toBe('doctor');

    // Verify patient notification was created
    const patientNotif = await Notification.findOne({
      userId: patientUser._id,
      type: 'doctor_reply',
    });
    expect(patientNotif).not.toBeNull();
    expect(patientNotif?.message).toContain('Please do not change your dose');
  });
});
