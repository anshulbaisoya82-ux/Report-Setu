import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Connection } from '../utils/testModels';
import { Prescription } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';
import * as socketService from '../services/socketService';

describe('Task 6.3: Prescription Management & Medication Instructions', () => {
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

  it('should allow doctor to create prescription matching frontend Prescription model', async () => {
    const emitSpy = vi.spyOn(socketService, 'emitToUser');

    const res = await request(app)
      .post('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: patientProfile._id.toString(),
        name: 'Metformin 500 mg',
        instructions: '1 tablet · Morning and Night · after food',
        totalDays: 90,
        advice: ['Walk 30 minutes daily', 'Less sugar in your diet'],
        medicines: [
          {
            name: 'Metformin 500 mg',
            dose: '500 mg',
            timing: 'Morning and Night',
            instructions: 'Take after food',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const rx = res.body.data;
    expect(rx.name).toBe('Metformin 500 mg');
    expect(rx.instructions).toBe('1 tablet · Morning and Night · after food');
    expect(rx.totalDays).toBe(90);
    expect(rx.remainingDays).toBeGreaterThanOrEqual(89);
    expect(rx.remainingDays).toBeLessThanOrEqual(90);
    expect(rx.status).toBe('Active');
    expect(rx.doctorName).toBe('Dr. Priya Mehta');
    expect(rx.advice).toEqual(['Walk 30 minutes daily', 'Less sugar in your diet']);
    expect(rx.patientId).toBe(patientProfile._id.toString());

    // Verify real-time socket notification dispatched
    expect(emitSpy).toHaveBeenCalledWith(
      patientUser._id.toString(),
      'prescription:updated',
      expect.objectContaining({ name: 'Metformin 500 mg' })
    );

    emitSpy.mockRestore();
  });

  it('should reject patient from creating prescription with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        patientId: patientProfile._id.toString(),
        name: 'Insulin Glargine',
        instructions: '10 units at bedtime',
      });

    expect(res.status).toBe(403);
  });

  it('should validate required prescription fields and reject with 422', async () => {
    const res = await request(app)
      .post('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: patientProfile._id.toString(),
        // missing name and instructions
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('should return active prescriptions with calculated remainingDays for patient and doctor', async () => {
    // 1. Create active prescription (90 days from today)
    const activeStartDate = new Date();
    const activeEndDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days left
    await Prescription.create({
      patientId: patientProfile._id,
      doctorId: doctorProfile._id,
      doctorName: doctorProfile.name,
      name: 'Metformin 500 mg',
      instructions: '1 tablet after food',
      startDate: activeStartDate,
      endDate: activeEndDate,
      totalDays: 90,
      status: 'Active',
      advice: ['Dietary control'],
    });

    // 2. Create ended prescription (expired last month)
    const pastStartDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    const pastEndDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await Prescription.create({
      patientId: patientProfile._id,
      doctorId: doctorProfile._id,
      doctorName: doctorProfile.name,
      name: 'Glimepiride 1 mg',
      instructions: '1 tablet before breakfast',
      startDate: pastStartDate,
      endDate: pastEndDate,
      totalDays: 90,
      status: 'Ended',
      advice: ['Taper off'],
    });

    // Patient queries their prescriptions
    const patientRes = await request(app)
      .get('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(patientRes.status).toBe(200);
    expect(patientRes.body.success).toBe(true);
    expect(patientRes.body.data.prescriptions).toHaveLength(2);

    const activeRx = patientRes.body.data.prescriptions.find((p: any) => p.name === 'Metformin 500 mg');
    expect(activeRx).toBeDefined();
    expect(activeRx.remainingDays).toBeGreaterThanOrEqual(59);
    expect(activeRx.remainingDays).toBeLessThanOrEqual(61);
    expect(activeRx.status).toBe('Active');

    const endedRx = patientRes.body.data.prescriptions.find((p: any) => p.name === 'Glimepiride 1 mg');
    expect(endedRx).toBeDefined();
    expect(endedRx.remainingDays).toBe(0);
    expect(endedRx.status).toBe('Ended');

    // Doctor queries specific patient prescriptions
    const doctorRes = await request(app)
      .get(`/api/v1/prescriptions?patientId=${patientProfile._id}`)
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(doctorRes.status).toBe(200);
    expect(doctorRes.body.data.prescriptions).toHaveLength(2);
  });
});
