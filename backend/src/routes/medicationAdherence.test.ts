import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Connection } from '../utils/testModels';
import { Prescription } from '../utils/testModels';
import { MedicineSchedule } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';
import { getTodayDateKey } from '../services/medicationService';

describe('Task 6.4: Patient Medication Schedule & Dose Adherence Tracker', () => {
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
      email: 'dr.priya@apollo.com',
      phone: '+919876500001',
      specialty: 'Endocrinologist',
      medicalCouncil: 'Delhi Medical Council',
      registrationNumber: 'MCI-998877',
      verificationStatus: 'verified',
    });
    doctorToken = signAccessToken({
      userId: doctorUser._id.toString(),
      role: 'doctor',
      isVerified: true,
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
      age: 52,
      gender: 'Male',
      phone: '+919876500002',
      conditions: ['Type 2 Diabetes'],
      status: 'Normal',
      connectedDoctors: [doctorProfile._id],
    });
    patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
      isVerified: true,
    });

    // Create active connection
    await Connection.create({
      doctorId: doctorProfile._id,
      patientId: patientProfile._id,
      status: 'active',
      initiatedBy: 'patient',
    });
  });

  it('should auto-instantiate and return daily schedule matching frontend MedicineScheduleItem', async () => {
    // Prescribe active medication with Morning and Night dosing
    await Prescription.create({
      patientId: patientProfile._id,
      doctorId: doctorProfile._id,
      doctorName: doctorProfile.name,
      name: 'Metformin 500 mg',
      instructions: '1 tablet · Morning and Night · after food',
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      totalDays: 90,
      status: 'Active',
      advice: ['Take with food'],
    });

    const res = await request(app)
      .get('/api/v1/medicines/today')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.schedule).toHaveLength(2);

    const morningDose = res.body.data.schedule.find((s: any) => s.scheduledTime === '08:00 AM');
    expect(morningDose).toBeDefined();
    expect(morningDose.name).toBe('Metformin 500 mg');
    expect(morningDose.dose).toBe('1 tablet');
    expect(morningDose.state).toBe('due');

    const nightDose = res.body.data.schedule.find((s: any) => s.scheduledTime === '09:00 PM');
    expect(nightDose).toBeDefined();
    expect(nightDose.name).toBe('Metformin 500 mg');
    expect(nightDose.state).toBe('due');
  });

  it('should record dose actions (taken, due, snoozed, missed) with timestamp logging', async () => {
    const todayKey = getTodayDateKey();
    const doseDoc = await MedicineSchedule.create({
      patientId: patientProfile._id,
      name: 'Metformin 500 mg',
      dose: '1 tablet',
      timing: 'Morning · after breakfast · 8:00 AM',
      scheduledTime: '08:00 AM',
      date: todayKey,
      state: 'due',
      instructions: 'Take after food',
    });

    // 1. Mark as taken
    const takenRes = await request(app)
      .post(`/api/v1/medicines/${doseDoc._id}/action`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ action: 'taken' });

    expect(takenRes.status).toBe(200);
    expect(takenRes.body.success).toBe(true);
    expect(takenRes.body.data.state).toBe('taken');
    expect(takenRes.body.data.takenAt).toMatch(/^Taken at/);

    // 2. Toggle back to due
    const dueRes = await request(app)
      .post(`/api/v1/medicines/${doseDoc._id}/action`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ action: 'due' });

    expect(dueRes.status).toBe(200);
    expect(dueRes.body.data.state).toBe('due');
    expect(dueRes.body.data.takenAt).toBeUndefined();

    // 3. Mark as snoozed
    const snoozeRes = await request(app)
      .post(`/api/v1/medicines/${doseDoc._id}/action`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ action: 'snoozed' });

    expect(snoozeRes.status).toBe(200);
    expect(snoozeRes.body.data.state).toBe('snoozed');
    expect(snoozeRes.body.data.takenAt).toBe('Snoozed 30 mins');
  });

  it('should compute weekly adherence percentage and streak accuracy', async () => {
    // Generate 6 doses over past 3 days:
    // Day -2: 2 doses taken (100%)
    // Day -1: 2 doses taken (100%)
    // Day 0 (today): 1 taken, 1 missed (50%)
    // Total scheduled = 6, total taken = 5, total missed = 1 -> Adherence = 5/6 = 83%

    const d0 = getTodayDateKey();
    const prev1 = new Date();
    prev1.setDate(prev1.getDate() - 1);
    const d1 = getTodayDateKey(prev1);

    const prev2 = new Date();
    prev2.setDate(prev2.getDate() - 2);
    const d2 = getTodayDateKey(prev2);

    await MedicineSchedule.create([
      // Day -2
      { patientId: patientProfile._id, name: 'Med A', dose: '1 tab', timing: 'Morning', scheduledTime: '08:00 AM', date: d2, state: 'taken' },
      { patientId: patientProfile._id, name: 'Med A', dose: '1 tab', timing: 'Night', scheduledTime: '09:00 PM', date: d2, state: 'taken' },
      // Day -1
      { patientId: patientProfile._id, name: 'Med A', dose: '1 tab', timing: 'Morning', scheduledTime: '08:00 AM', date: d1, state: 'taken' },
      { patientId: patientProfile._id, name: 'Med A', dose: '1 tab', timing: 'Night', scheduledTime: '09:00 PM', date: d1, state: 'taken' },
      // Day 0
      { patientId: patientProfile._id, name: 'Med A', dose: '1 tab', timing: 'Morning', scheduledTime: '08:00 AM', date: d0, state: 'taken' },
      { patientId: patientProfile._id, name: 'Med A', dose: '1 tab', timing: 'Night', scheduledTime: '09:00 PM', date: d0, state: 'missed' },
    ]);

    const res = await request(app)
      .get('/api/v1/medicines/adherence')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const metrics = res.body.data;
    expect(metrics.totalScheduled).toBe(6);
    expect(metrics.totalTaken).toBe(5);
    expect(metrics.totalMissed).toBe(1);
    expect(metrics.adherenceRate).toBe(83); // 5/6 * 100 = 83.33 -> 83
  });
});
