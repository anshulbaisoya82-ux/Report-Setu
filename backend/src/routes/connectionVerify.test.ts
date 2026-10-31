import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { DoctorProfile } from '../utils/testModels';
import { PatientProfile } from '../utils/testModels';
import { Connection } from '../utils/testModels';
import { ConnectCode } from '../utils/testModels';
import { Notification } from '../utils/testModels';
import { signAccessToken } from '../utils/jwt';
import { connectionRateLimiter } from '../middlewares/security';

describe('Task 4.3: Patient Connect Code Generation & Doctor Redemption', () => {
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
      email: 'doctor.connect@clinic.com',
      phone: '+919876543210',
      isActive: true,
      isVerified: true,
    });

    const doctorProfile = await DoctorProfile.create({
      userId: doctorUser._id,
      name: 'Dr. Vikram Malhotra',
      email: doctorUser.email,
      phone: doctorUser.phone,
      registrationNumber: 'DMC-2024-4444',
      medicalCouncil: 'Delhi Medical Council',
      specialty: 'Endocrinologist',
      clinic: { name: 'Fortis Hospital', city: 'New Delhi' },
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
      name: 'Sneha Patel',
      phone: patientUser.phone,
      rsId: 'RS-99881',
      age: 29,
      gender: 'Female',
      bloodGroup: 'O+',
    });

    const patientToken = signAccessToken({
      userId: patientUser._id.toString(),
      role: 'patient',
    });

    return {
      doctorUser,
      doctorProfile,
      doctorToken,
      patientUser,
      patientProfile,
      patientToken,
    };
  };

  it('allows patient to generate a single-use 6-digit connect code', async () => {
    const { patientToken, patientProfile } = await setupDoctorAndPatient();

    const res = await request(app)
      .post('/api/v1/connections/patient/generate-code')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toMatch(/^\d{6}$/);
    expect(res.body.data.rsId).toBe(patientProfile.rsId);
    expect(res.body.data.expiresAt).toBeDefined();

    // Verify stored hashed code in ConnectCode collection
    const storedCode = await ConnectCode.findOne({ patientId: patientProfile._id });
    expect(storedCode).toBeDefined();
    expect(storedCode?.rsId).toBe('RS-99881');
    expect(storedCode?.attempts).toBe(0);
  });

  it('doctor verifies connect code, establishing active connection and linking connectedDoctors', async () => {
    const { doctorToken, doctorProfile, patientToken, patientUser, patientProfile } =
      await setupDoctorAndPatient();

    // 1. Patient generates code
    const genRes = await request(app)
      .post('/api/v1/connections/patient/generate-code')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({});
    const code = genRes.body.data.code;

    // 2. Doctor verifies code
    const verifyRes = await request(app)
      .post('/api/v1/connections/doctor/verify-code')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientRsId: patientProfile.rsId,
        code,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.data.connection.status).toBe('active');
    expect(verifyRes.body.data.doctor.name).toBe('Dr. Vikram Malhotra');

    // 3. Confirm Connection status in MongoDB is 'active'
    const connInDb = await Connection.findOne({
      patientId: patientProfile._id,
      doctorId: doctorProfile._id,
    });
    expect(connInDb?.status).toBe('active');
    expect(connInDb?.connectedAt).toBeDefined();

    // 4. Confirm doctor is in patient's connectedDoctors list
    const updatedPatient = await PatientProfile.findById(patientProfile._id);
    expect(
      updatedPatient?.connectedDoctors.some((id) => id.toString() === doctorProfile._id.toString())
    ).toBe(true);

    // 5. Confirm single-use code was consumed (deleted from MongoDB)
    const codeInDb = await ConnectCode.findOne({ patientId: patientProfile._id });
    expect(codeInDb).toBeNull();

    // 6. Confirm notification sent to patient
    const notification = await Notification.findOne({
      userId: patientUser._id,
      type: 'connection_approved',
    });
    expect(notification).toBeDefined();
    expect(notification?.message).toMatch(/Dr\. Vikram Malhotra/i);
  });

  it('increments attempts on wrong code and invalidates after 5 failed attempts', async () => {
    const { doctorToken, patientToken, patientProfile } = await setupDoctorAndPatient();

    // Patient generates code
    await request(app)
      .post('/api/v1/connections/patient/generate-code')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({});

    // 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      const failRes = await request(app)
        .post('/api/v1/connections/doctor/verify-code')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientRsId: patientProfile.rsId,
          code: `00000${i}`,
        });

      expect(failRes.status).toBe(400);
      expect(failRes.body.error.message).toMatch(/attempt\(s\) remaining/i);
    }

    // 5th failed attempt invalidates the code
    const fifthRes = await request(app)
      .post('/api/v1/connections/doctor/verify-code')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientRsId: patientProfile.rsId,
        code: '999999',
      });

    expect(fifthRes.status).toBe(400);
    expect(fifthRes.body.error.message).toMatch(/Maximum verification attempts exceeded/i);

    // Code is now gone from database
    const codeInDb = await ConnectCode.findOne({ patientId: patientProfile._id });
    expect(codeInDb).toBeNull();
  });

  it('rejects expired connect code', async () => {
    const { doctorToken, patientToken, patientProfile } = await setupDoctorAndPatient();

    // Patient generates code
    const genRes = await request(app)
      .post('/api/v1/connections/patient/generate-code')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({});
    const code = genRes.body.data.code;

    // Simulate expiration
    await ConnectCode.updateOne(
      { patientId: patientProfile._id },
      { expiresAt: new Date(Date.now() - 1000) }
    );

    const res = await request(app)
      .post('/api/v1/connections/doctor/verify-code')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientRsId: patientProfile.rsId,
        code,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/expired or was not requested/i);
  });
});
