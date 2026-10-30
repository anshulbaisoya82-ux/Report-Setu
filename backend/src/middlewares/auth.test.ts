import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { authenticate, requireRole, requireVerifiedDoctor } from './auth';
import { signAccessToken } from '../utils/jwt';
import { errorHandler } from './errorHandler';
import { sendSuccess } from '../utils/apiResponse';

describe('Task 3.6: Central Authorization & RBAC Middleware', () => {
  let app: express.Express;

  beforeAll(async () => {
    await connectTestDb();

    app = express();
    app.use(express.json());

    // Public test route
    app.get('/api/test/public', (_req, res) => {
      sendSuccess(res, { message: 'public' });
    });

    // Authenticated generic test route
    app.get('/api/test/me', authenticate, (req, res) => {
      sendSuccess(res, { user: req.user });
    });

    // Doctor only route
    app.get('/api/test/doctor-only', authenticate, requireRole('doctor'), (req, res) => {
      sendSuccess(res, { message: 'doctor area', user: req.user });
    });

    // Patient only route
    app.get('/api/test/patient-only', authenticate, requireRole('patient'), (req, res) => {
      sendSuccess(res, { message: 'patient area', user: req.user });
    });

    // Verified doctor clinical route
    app.get(
      '/api/test/verified-doctor-clinical',
      authenticate,
      requireVerifiedDoctor,
      (_req, res) => {
        sendSuccess(res, { message: 'clinical records' });
      }
    );

    app.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it('rejects unauthenticated requests on protected endpoints with 401 Unauthorized', async () => {
    // Missing header
    const noHeaderRes = await request(app).get('/api/test/me');
    expect(noHeaderRes.status).toBe(401);
    expect(noHeaderRes.body.success).toBe(false);
    expect(noHeaderRes.body.error.message).toMatch(/Missing Bearer token/i);

    // Malformed header
    const badHeaderRes = await request(app)
      .get('/api/test/me')
      .set('Authorization', 'Basic 123456');
    expect(badHeaderRes.status).toBe(401);

    // Invalid JWT string
    const invalidJwtRes = await request(app)
      .get('/api/test/me')
      .set('Authorization', 'Bearer invalid.jwt.signature');
    expect(invalidJwtRes.status).toBe(401);
  });

  it('rejects access if user account has been deactivated (isActive: false)', async () => {
    const deactivatedUser = await User.create({
      role: 'patient',
      phone: '+919876543210',
      isActive: false,
    });

    const token = signAccessToken({
      userId: deactivatedUser._id.toString(),
      role: 'patient',
    });

    const res = await request(app)
      .get('/api/test/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/inactive, suspended, or does not exist/i);
  });

  it('authenticates active user and attaches decoded user payload to req.user', async () => {
    const activeUser = await User.create({
      role: 'patient',
      phone: '+919876543210',
      isActive: true,
    });

    const token = signAccessToken({
      userId: activeUser._id.toString(),
      role: 'patient',
    });

    const res = await request(app)
      .get('/api/test/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.userId).toBe(activeUser._id.toString());
    expect(res.body.data.user.role).toBe('patient');
  });

  it('enforces RBAC via requireRole, rejecting unauthorized roles with 403 Forbidden', async () => {
    // Create patient user
    const patientUser = await User.create({
      role: 'patient',
      phone: '+919876543210',
      isActive: true,
    });

    const patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
    });

    // Patient accessing patient route -> 200 OK
    const patientOk = await request(app)
      .get('/api/test/patient-only')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(patientOk.status).toBe(200);

    // Patient accessing doctor route -> 403 Forbidden
    const patientDenied = await request(app)
      .get('/api/test/doctor-only')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(patientDenied.status).toBe(403);
    expect(patientDenied.body.error.message).toMatch(/Access forbidden/i);
  });

  it('enforces requireVerifiedDoctor, rejecting unverified doctors and non-doctors', async () => {
    // 1. Patient trying to access clinical records -> 403 Forbidden
    const patientUser = await User.create({
      role: 'patient',
      phone: '+919876543210',
      isActive: true,
    });
    const patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
    });

    const patientRes = await request(app)
      .get('/api/test/verified-doctor-clinical')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(patientRes.status).toBe(403);
    expect(patientRes.body.error.message).toMatch(/Only medical doctors/i);

    // 2. Pending doctor -> 403 Forbidden
    const pendingDoctorUser = await User.create({
      role: 'doctor',
      email: 'pending.doc@clinic.com',
      isActive: true,
      isVerified: false,
    });
    await DoctorProfile.create({
      userId: pendingDoctorUser._id,
      name: 'Dr. Pending',
      email: 'pending.doc@clinic.com',
      phone: '+919811111111',
      registrationNumber: 'PENDING-123',
      medicalCouncil: 'Delhi Medical Council',
      specialty: 'General',
      verificationStatus: 'pending',
    });

    const pendingToken = signAccessToken({
      userId: pendingDoctorUser._id.toString(),
      role: 'doctor',
      isVerified: false,
    });

    const pendingRes = await request(app)
      .get('/api/test/verified-doctor-clinical')
      .set('Authorization', `Bearer ${pendingToken}`);
    expect(pendingRes.status).toBe(403);
    expect(pendingRes.body.error.message).toMatch(/pending medical council verification/i);

    // 3. Verified doctor -> 200 OK
    const verifiedDoctorUser = await User.create({
      role: 'doctor',
      email: 'verified.doc@clinic.com',
      isActive: true,
      isVerified: true,
    });
    await DoctorProfile.create({
      userId: verifiedDoctorUser._id,
      name: 'Dr. Verified',
      email: 'verified.doc@clinic.com',
      phone: '+919822222222',
      registrationNumber: 'VERIFIED-123',
      medicalCouncil: 'Delhi Medical Council',
      specialty: 'Cardiology',
      verificationStatus: 'verified',
    });

    const verifiedToken = signAccessToken({
      userId: verifiedDoctorUser._id.toString(),
      role: 'doctor',
      isVerified: true,
    });

    const verifiedRes = await request(app)
      .get('/api/test/verified-doctor-clinical')
      .set('Authorization', `Bearer ${verifiedToken}`);
    expect(verifiedRes.status).toBe(200);
    expect(verifiedRes.body.data.message).toBe('clinical records');
  });
});
