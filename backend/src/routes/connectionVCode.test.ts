import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Connection } from '../utils/testModels';
import { Notification } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';
import { connectionRateLimiter } from '../middlewares/security';

describe('Task 4.2: Doctor VCode Request Flow', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    connectionRateLimiter.reset();
    await clearTestDb();
  });

  const setupDoctorAndPatient = async () => {
    // Verified Doctor
    const doctorUser = await User.create({
      role: 'doctor',
      email: 'doctor.vcode@clinic.com',
      phone: '+919876543210',
      isActive: true,
      isVerified: true,
    });

    const doctorProfile = await DoctorProfile.create({
      userId: doctorUser._id,
      name: 'Dr. Priya Mehta',
      email: doctorUser.email,
      phone: doctorUser.phone,
      registrationNumber: 'DMC-2024-9999',
      medicalCouncil: 'Delhi Medical Council',
      specialty: 'Cardiologist',
      clinic: { name: 'Apollo Clinic', city: 'New Delhi' },
      verificationStatus: 'verified',
    });

    const doctorToken = signAccessToken({
      userId: doctorUser._id.toString(),
      role: 'doctor',
      isVerified: true,
    });

    // Patient
    const patientUser = await User.create({
      role: 'patient',
      phone: '+919811111111',
      isActive: true,
      isVerified: true,
    });

    const patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      name: 'Aarav Sharma',
      phone: patientUser.phone,
      rsId: 'RS-10475',
      age: 32,
      gender: 'Male',
      bloodGroup: 'B+',
    });

    return {
      doctorUser,
      doctorProfile,
      doctorToken,
      patientUser,
      patientProfile,
    };
  };

  it('generates a 6-character VCode and creates a patient notification', async () => {
    const { doctorToken, patientUser, patientProfile } = await setupDoctorAndPatient();

    const res = await request(app)
      .post('/api/v1/connections/doctor/request-vcode')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ rsId: patientProfile.rsId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vcode).toBeDefined();
    expect(res.body.data.vcode).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.body.data.expiresAt).toBeDefined();
    expect(res.body.data.patient.rsId).toBe('RS-10475');
    expect(res.body.data.doctor.name).toBe('Dr. Priya Mehta');

    // 1. Verify connection record in MongoDB
    const connection = await Connection.findOne({ patientId: patientProfile._id });
    expect(connection).toBeDefined();
    expect(connection?.status).toBe('pending');
    expect(connection?.vcodeHash).toBeDefined();
    expect(connection!.codeExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 8 * 60 * 1000);

    // 2. Verify in-app Notification created for the patient
    const notification = await Notification.findOne({ userId: patientUser._id });
    expect(notification).toBeDefined();
    expect(notification?.type).toBe('connection_request');
    expect(notification?.title).toMatch(/Doctor Connection Request/i);
    expect(notification?.message).toMatch(/Dr\. Priya Mehta/i);
    expect(notification?.isRead).toBe(false);
  });

  it('rejects unverified doctors with 403 Forbidden', async () => {
    const { patientProfile } = await setupDoctorAndPatient();

    // Create unverified doctor
    const unverifiedUser = await User.create({
      role: 'doctor',
      email: 'unverified@clinic.com',
      isActive: true,
      isVerified: false,
    });

    await DoctorProfile.create({
      userId: unverifiedUser._id,
      name: 'Dr. Unverified',
      email: unverifiedUser.email,
      phone: '+919822222222',
      registrationNumber: 'PENDING-99',
      medicalCouncil: 'Delhi Medical Council',
      specialty: 'General',
      verificationStatus: 'pending',
    });

    const unverifiedToken = signAccessToken({
      userId: unverifiedUser._id.toString(),
      role: 'doctor',
      isVerified: false,
    });

    const res = await request(app)
      .post('/api/v1/connections/doctor/request-vcode')
      .set('Authorization', `Bearer ${unverifiedToken}`)
      .send({ rsId: patientProfile.rsId });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/pending medical council verification/i);
  });

  it('rejects non-doctor roles with 403 Forbidden', async () => {
    const { patientUser, patientProfile } = await setupDoctorAndPatient();

    const patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
    });

    const res = await request(app)
      .post('/api/v1/connections/doctor/request-vcode')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ rsId: patientProfile.rsId });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/Access forbidden/i);
  });

  it('returns 404 Not Found when patient RS ID does not exist', async () => {
    const { doctorToken } = await setupDoctorAndPatient();

    const res = await request(app)
      .post('/api/v1/connections/doctor/request-vcode')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ rsId: 'RS-99999' });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/No patient found with RS ID/i);
  });

  it('returns 400 Bad Request for invalid RS ID format', async () => {
    const { doctorToken } = await setupDoctorAndPatient();

    const res = await request(app)
      .post('/api/v1/connections/doctor/request-vcode')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ rsId: 'INVALID_ID' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Invalid RS ID format/i);
  });

  it('returns 409 Conflict if already actively connected', async () => {
    const { doctorToken, doctorProfile, patientProfile } = await setupDoctorAndPatient();

    // Create an active connection
    await Connection.create({
      patientId: patientProfile._id,
      doctorId: doctorProfile._id,
      status: 'active',
      connectedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/connections/doctor/request-vcode')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ rsId: patientProfile.rsId });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/already actively connected/i);
  });
});
