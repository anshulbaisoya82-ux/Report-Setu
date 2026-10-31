import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Connection } from '../utils/testModels';
import { Notification } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';
import { authenticate } from '../middlewares/auth';
import { requireActiveConnection } from '../middlewares/connection';
import { errorHandler } from '../middlewares/errorHandler';
import { sendSuccess } from '../utils/apiResponse';
import { connectionRateLimiter } from '../middlewares/security';

describe('Task 4.4: Connection Revocation & Central Active-Connection Policy', () => {
  let mainApp: Express;
  let testApp: Express;

  beforeAll(async () => {
    await connectTestDb();
    mainApp = createApp();

    // Helper app to thoroughly test requireActiveConnection middleware on clinical routes
    testApp = express();
    testApp.use(express.json());

    // Route using :patientId param
    testApp.get(
      '/api/test/patients/:patientId/records',
      authenticate,
      requireActiveConnection,
      (req, res) => {
        sendSuccess(res, {
          patientId: req.params.patientId,
          message: 'Clinical record access granted',
        });
      }
    );

    // Route using query param ?patientId=
    testApp.get(
      '/api/test/clinical/summary',
      authenticate,
      requireActiveConnection,
      (req, res) => {
        sendSuccess(res, {
          patientId: req.query.patientId,
          message: 'Clinical summary access granted',
        });
      }
    );

    testApp.use(errorHandler);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    connectionRateLimiter.reset();
    await clearTestDb();
  });

  const setupDoctorAndPatient = async () => {
    // 1. Doctor 1 (Verified)
    const doctorUser = await User.create({
      role: 'doctor',
      email: 'dr.ananya@apollo.com',
      phone: '+919876543201',
      isActive: true,
      isVerified: true,
    });

    const doctorProfile = await DoctorProfile.create({
      userId: doctorUser._id,
      name: 'Dr. Ananya Roy',
      email: doctorUser.email,
      phone: doctorUser.phone,
      registrationNumber: 'KMC-2024-5555',
      medicalCouncil: 'Karnataka Medical Council',
      specialty: 'Cardiologist',
      clinic: { name: 'Apollo Hospitals', city: 'Bengaluru' },
      verificationStatus: 'verified',
    });

    const doctorToken = signAccessToken({
      userId: doctorUser._id.toString(),
      role: 'doctor',
      isVerified: true,
    });

    // 2. Doctor 2 (Unverified)
    const unverifiedDocUser = await User.create({
      role: 'doctor',
      email: 'dr.unverified@clinic.com',
      phone: '+919876543202',
      isActive: true,
      isVerified: false,
    });

    const unverifiedDocProfile = await DoctorProfile.create({
      userId: unverifiedDocUser._id,
      name: 'Dr. Pending',
      email: unverifiedDocUser.email,
      phone: unverifiedDocUser.phone,
      registrationNumber: 'PENDING-999',
      medicalCouncil: 'Delhi Medical Council',
      specialty: 'General Physician',
      verificationStatus: 'pending',
    });

    const unverifiedDoctorToken = signAccessToken({
      userId: unverifiedDocUser._id.toString(),
      role: 'doctor',
      isVerified: false,
    });

    // 3. Patient 1
    const patientUser = await User.create({
      role: 'patient',
      phone: '+919800000001',
      isActive: true,
      isVerified: true,
    });

    const patientProfile = await PatientProfile.create({
      userId: patientUser._id,
      name: 'Rohan Mehra',
      phone: patientUser.phone,
      rsId: 'RS-10001',
      age: 34,
      gender: 'Male',
      bloodGroup: 'B+',
    });

    const patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
    });

    // 4. Patient 2
    const otherPatientUser = await User.create({
      role: 'patient',
      phone: '+919800000002',
      isActive: true,
      isVerified: true,
    });

    const otherPatientProfile = await PatientProfile.create({
      userId: otherPatientUser._id,
      name: 'Kavita Sharma',
      phone: otherPatientUser.phone,
      rsId: 'RS-10002',
      age: 28,
      gender: 'Female',
      bloodGroup: 'A+',
    });

    const otherPatientToken = signAccessToken({
      userId: otherPatientUser._id.toString(),
      role: 'patient',
    });

    // 5. Admin
    const adminToken = signAccessToken({
      userId: 'admin_master_001',
      role: 'admin',
    });

    return {
      doctorUser,
      doctorProfile,
      doctorToken,
      unverifiedDocUser,
      unverifiedDocProfile,
      unverifiedDoctorToken,
      patientUser,
      patientProfile,
      patientToken,
      otherPatientUser,
      otherPatientProfile,
      otherPatientToken,
      adminToken,
    };
  };

  describe('Patient Revocation: POST /api/v1/connections/patient/revoke/:doctorId', () => {
    it('successfully revokes an active doctor connection and pulls doctor from connectedDoctors', async () => {
      const { doctorProfile, patientProfile, patientToken } = await setupDoctorAndPatient();

      // Establish initial active connection
      const connection = await Connection.create({
        patientId: patientProfile._id,
        doctorId: doctorProfile._id,
        status: 'active',
        connectedAt: new Date(),
      });

      // Add doctor to patient's connectedDoctors
      patientProfile.connectedDoctors.push(doctorProfile._id);
      await patientProfile.save();

      // Revoke connection
      const res = await request(mainApp)
        .post(`/api/v1/connections/patient/revoke/${doctorProfile._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connection.status).toBe('revoked');
      expect(res.body.data.connection.revokedBy).toBe('patient');
      expect(res.body.data.connection.revokedAt).toBeDefined();

      // Check DB: Connection status updated
      const updatedConn = await Connection.findById(connection._id);
      expect(updatedConn?.status).toBe('revoked');

      // Check DB: Doctor pulled from patient connectedDoctors
      const updatedPatient = await PatientProfile.findById(patientProfile._id);
      expect(updatedPatient?.connectedDoctors).not.toContainEqual(doctorProfile._id);

      // Check DB: Notification created for doctor
      const notification = await Notification.findOne({ userId: doctorProfile.userId });
      expect(notification).not.toBeNull();
      expect(notification?.title).toBe('Patient Connection Revoked');
    });

    it('rejects revocation attempt by a doctor (role must be patient)', async () => {
      const { doctorProfile, doctorToken } = await setupDoctorAndPatient();

      const res = await request(mainApp)
        .post(`/api/v1/connections/patient/revoke/${doctorProfile._id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send();

      expect(res.status).toBe(403);
    });

    it('returns 404 if connection does not exist with that doctor', async () => {
      const { doctorProfile, patientToken } = await setupDoctorAndPatient();

      const res = await request(mainApp)
        .post(`/api/v1/connections/patient/revoke/${doctorProfile._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send();

      expect(res.status).toBe(404);
    });
  });

  describe('Doctor Revocation: POST /api/v1/connections/doctor/revoke/:connectionId', () => {
    it('allows doctor to cancel or revoke their connection', async () => {
      const { doctorProfile, doctorToken, patientProfile } = await setupDoctorAndPatient();

      const connection = await Connection.create({
        patientId: patientProfile._id,
        doctorId: doctorProfile._id,
        status: 'active',
        connectedAt: new Date(),
      });

      patientProfile.connectedDoctors.push(doctorProfile._id);
      await patientProfile.save();

      const res = await request(mainApp)
        .post(`/api/v1/connections/doctor/revoke/${connection._id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.connection.status).toBe('revoked');
      expect(res.body.data.connection.revokedBy).toBe('doctor');

      const updatedPatient = await PatientProfile.findById(patientProfile._id);
      expect(updatedPatient?.connectedDoctors).not.toContainEqual(doctorProfile._id);
    });

    it('rejects revocation if connection does not belong to the calling doctor', async () => {
      const { doctorToken, patientProfile } = await setupDoctorAndPatient();

      // Create dummy doctor
      const otherDocUser = await User.create({
        role: 'doctor',
        email: 'other.doc@clinic.com',
        phone: '+919876543999',
        isActive: true,
      });
      const otherDoc = await DoctorProfile.create({
        userId: otherDocUser._id,
        name: 'Dr. Other',
        email: otherDocUser.email,
        phone: otherDocUser.phone,
        registrationNumber: 'OTH-1234',
        medicalCouncil: 'Delhi Medical Council',
        specialty: 'Dermatology',
        verificationStatus: 'verified',
      });

      const foreignConnection = await Connection.create({
        patientId: patientProfile._id,
        doctorId: otherDoc._id,
        status: 'pending',
      });

      const res = await request(mainApp)
        .post(`/api/v1/connections/doctor/revoke/${foreignConnection._id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send();

      expect(res.status).toBe(404);
    });

    it('rejects unverified doctors from calling doctor revocation endpoint', async () => {
      const { unverifiedDoctorToken } = await setupDoctorAndPatient();

      const res = await request(mainApp)
        .post('/api/v1/connections/doctor/revoke/651c2f90a1b2c3d4e5f6a7b8')
        .set('Authorization', `Bearer ${unverifiedDoctorToken}`)
        .send();

      expect(res.status).toBe(403);
    });
  });

  describe('Central Policy: requireActiveConnection Middleware', () => {
    it('blocks verified doctor without active connection with 403 Forbidden', async () => {
      const { doctorToken, patientProfile } = await setupDoctorAndPatient();

      const res = await request(testApp)
        .get(`/api/test/patients/${patientProfile._id}/records`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toContain('Active doctor-patient connection required');
    });

    it('blocks verified doctor with pending or revoked connection with 403 Forbidden', async () => {
      const { doctorProfile, doctorToken, patientProfile } = await setupDoctorAndPatient();

      // 1. Pending connection
      const connection = await Connection.create({
        patientId: patientProfile._id,
        doctorId: doctorProfile._id,
        status: 'pending',
      });

      let res = await request(testApp)
        .get(`/api/test/patients/${patientProfile._id}/records`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);

      // 2. Revoked connection
      connection.status = 'revoked';
      await connection.save();

      res = await request(testApp)
        .get(`/api/test/patients/${patientProfile._id}/records`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);
    });

    it('allows verified doctor with active connection with 200 OK', async () => {
      const { doctorProfile, doctorToken, patientProfile } = await setupDoctorAndPatient();

      await Connection.create({
        patientId: patientProfile._id,
        doctorId: doctorProfile._id,
        status: 'active',
        connectedAt: new Date(),
      });

      const res = await request(testApp)
        .get(`/api/test/patients/${patientProfile._id}/records`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Clinical record access granted');
    });

    it('resolves patient by query param ?patientId= for active connection check', async () => {
      const { doctorProfile, doctorToken, patientProfile } = await setupDoctorAndPatient();

      await Connection.create({
        patientId: patientProfile._id,
        doctorId: doctorProfile._id,
        status: 'active',
        connectedAt: new Date(),
      });

      const res = await request(testApp)
        .get(`/api/test/clinical/summary?patientId=${patientProfile._id}`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.patientId).toBe(patientProfile._id.toString());
    });

    it('allows patient to access their own records with 200 OK', async () => {
      const { patientProfile, patientToken } = await setupDoctorAndPatient();

      const res = await request(testApp)
        .get(`/api/test/patients/${patientProfile._id}/records`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('blocks patient from accessing another patient records with 403 Forbidden', async () => {
      const { otherPatientProfile, patientToken } = await setupDoctorAndPatient();

      const res = await request(testApp)
        .get(`/api/test/patients/${otherPatientProfile._id}/records`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toContain('not authorized to view another patient');
    });

    it('allows system admin to bypass active connection check with 200 OK', async () => {
      const { adminToken, patientProfile } = await setupDoctorAndPatient();

      const res = await request(testApp)
        .get(`/api/test/patients/${patientProfile._id}/records`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const { patientProfile } = await setupDoctorAndPatient();

      const res = await request(testApp).get(
        `/api/test/patients/${patientProfile._id}/records`
      );

      expect(res.status).toBe(401);
    });
  });
});
