import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';
import { authenticate, requireVerifiedDoctor } from '../middlewares/auth';
import { sendSuccess } from '../utils/apiResponse';
import { errorHandler } from '../middlewares/errorHandler';
import { authRateLimiter } from '../middlewares/security';

describe('Task 3.3: Doctor Email/Password Signup & Admin Verification Flow', () => {
  let app: ReturnType<typeof createApp>;
  let clinicalApp: express.Express;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();

    // Clinical test app guarded by authenticate & requireVerifiedDoctor
    clinicalApp = express();
    clinicalApp.use(express.json());
    clinicalApp.get(
      '/api/v1/clinical/test-patient-records',
      authenticate,
      requireVerifiedDoctor,
      (_req, res) => {
        sendSuccess(res, { records: ['Record A', 'Record B'] });
      }
    );
    clinicalApp.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    authRateLimiter.reset();
    await clearTestDb();
  });

  const validDoctorData = {
    name: 'Dr. Priya Mehta',
    email: 'priya.mehta@clinic.com',
    phone: '+919876543210',
    registrationNumber: 'DMC-2024-8891',
    medicalCouncil: 'Delhi Medical Council',
    specialty: 'General Physician',
    clinic: 'Apollo Clinic & Hospital',
    password: 'SuperSecurePassword123!',
  };

  it('registers a doctor with verificationStatus "pending"', async () => {
    const res = await request(app)
      .post('/api/v1/auth/doctor/signup')
      .send(validDoctorData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('priya.mehta@clinic.com');
    expect(res.body.data.user.role).toBe('doctor');
    expect(res.body.data.user.isVerified).toBe(false);
    expect(res.body.data.doctor.verificationStatus).toBe('pending');
    expect(res.body.data.doctor.registrationNumber).toBe('DMC-2024-8891');

    // Confirm persisted in MongoDB
    const savedUser = await User.findOne({ email: 'priya.mehta@clinic.com' });
    expect(savedUser).toBeDefined();
    expect(savedUser?.isVerified).toBe(false);

    const savedDoctor = await DoctorProfile.findOne({ registrationNumber: 'DMC-2024-8891' });
    expect(savedDoctor).toBeDefined();
    expect(savedDoctor?.verificationStatus).toBe('pending');
  });

  it('rejects registration if email or registration number already exists', async () => {
    // First registration
    await request(app).post('/api/v1/auth/doctor/signup').send(validDoctorData);

    // Duplicate email
    const duplicateEmailRes = await request(app)
      .post('/api/v1/auth/doctor/signup')
      .send({
        ...validDoctorData,
        registrationNumber: 'OTHER-REG-999',
        phone: '+919811111111',
      });

    expect(duplicateEmailRes.status).toBe(409);
    expect(duplicateEmailRes.body.success).toBe(false);
    expect(duplicateEmailRes.body.error.message).toMatch(/already registered/i);

    // Duplicate registration number
    const duplicateRegRes = await request(app)
      .post('/api/v1/auth/doctor/signup')
      .send({
        ...validDoctorData,
        email: 'other.doctor@clinic.com',
        phone: '+919822222222',
      });

    expect(duplicateRegRes.status).toBe(409);
    expect(duplicateRegRes.body.success).toBe(false);
  });

  it('rejects registration with invalid email or short password (422 Unprocessable)', async () => {
    const invalidEmailRes = await request(app)
      .post('/api/v1/auth/doctor/signup')
      .send({
        ...validDoctorData,
        email: 'not-an-email',
      });

    expect(invalidEmailRes.status).toBe(422);
    expect(invalidEmailRes.body.success).toBe(false);

    const shortPassRes = await request(app)
      .post('/api/v1/auth/doctor/signup')
      .send({
        ...validDoctorData,
        password: '123',
      });

    expect(shortPassRes.status).toBe(422);
    expect(shortPassRes.body.success).toBe(false);
  });

  it('unverified doctor cannot access clinical patient records (403 Forbidden)', async () => {
    // Register doctor (status is pending)
    const signupRes = await request(app)
      .post('/api/v1/auth/doctor/signup')
      .send(validDoctorData);

    const userId = signupRes.body.data.user.id;

    // Generate token for pending doctor
    const unverifiedToken = signAccessToken({
      userId,
      role: 'doctor',
      isVerified: false,
    });

    const accessRes = await request(clinicalApp)
      .get('/api/v1/clinical/test-patient-records')
      .set('Authorization', `Bearer ${unverifiedToken}`);

    expect(accessRes.status).toBe(403);
    expect(accessRes.body.success).toBe(false);
    expect(accessRes.body.error.message).toMatch(/pending medical council verification/i);
  });

  it('admin verifies doctor, then doctor can access clinical patient records', async () => {
    // 1. Register doctor
    const signupRes = await request(app)
      .post('/api/v1/auth/doctor/signup')
      .send(validDoctorData);

    const doctorId = signupRes.body.data.doctor._id;
    const userId = signupRes.body.data.user.id;

    // 2. Non-admin cannot verify doctor
    const unauthVerify = await request(app)
      .post(`/api/v1/admin/doctors/${doctorId}/verify`)
      .send({});
    expect(unauthVerify.status).toBe(401);

    // 3. Admin verifies doctor
    const adminToken = signAccessToken({
      userId: 'admin_user_001',
      role: 'admin',
    });

    const verifyRes = await request(app)
      .post(`/api/v1/admin/doctors/${doctorId}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.doctor.verificationStatus).toBe('verified');

    // Confirm in DB
    const updatedDoctor = await DoctorProfile.findById(doctorId);
    expect(updatedDoctor?.verificationStatus).toBe('verified');
    const updatedUser = await User.findById(userId);
    expect(updatedUser?.isVerified).toBe(true);

    // 4. Now doctor can access clinical resources
    const verifiedToken = signAccessToken({
      userId,
      role: 'doctor',
      isVerified: true,
    });

    const accessRes = await request(clinicalApp)
      .get('/api/v1/clinical/test-patient-records')
      .set('Authorization', `Bearer ${verifiedToken}`);

    expect(accessRes.status).toBe(200);
    expect(accessRes.body.success).toBe(true);
    expect(accessRes.body.data.records).toEqual(['Record A', 'Record B']);
  });
});
