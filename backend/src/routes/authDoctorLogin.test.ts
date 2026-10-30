import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { User } from '../utils/testModels';
import { AuditLog } from '../utils/testModels';
import { authRateLimiter } from '../middlewares/security';

describe('Task 3.4: Doctor Login with Password & Brute-Force Lockout', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    await connectTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    authRateLimiter.reset();
    await clearTestDb();
  });

  const testDoctor = {
    name: 'Dr. Priya Mehta',
    email: 'doctor.lockout@clinic.com',
    phone: '+919876543210',
    registrationNumber: 'DMC-2024-7777',
    medicalCouncil: 'Delhi Medical Council',
    specialty: 'Internal Medicine',
    clinic: 'City Clinic',
    password: 'CorrectSecretPassword123!',
  };

  it('authenticates doctor with correct credentials and returns tokens + cookie', async () => {
    // 1. Sign up doctor
    await request(app).post('/api/v1/auth/doctor/signup').send(testDoctor);

    // 2. Log in
    const loginRes = await request(app)
      .post('/api/v1/auth/doctor/login')
      .send({
        email: testDoctor.email,
        password: testDoctor.password,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.accessToken).toBeDefined();
    expect(loginRes.body.data.user.email).toBe(testDoctor.email);
    expect(loginRes.body.data.doctor.registrationNumber).toBe('DMC-2024-7777');

    // Confirm httpOnly refreshToken cookie
    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/refreshToken=[^;]+/);
    expect(cookies[0]).toMatch(/HttpOnly/i);
  });

  it('increments failedLoginAttempts counter on incorrect password', async () => {
    await request(app).post('/api/v1/auth/doctor/signup').send(testDoctor);

    const failRes = await request(app)
      .post('/api/v1/auth/doctor/login')
      .send({
        email: testDoctor.email,
        password: 'WrongPassword123!',
      });

    expect(failRes.status).toBe(401);
    expect(failRes.body.success).toBe(false);
    expect(failRes.body.error.message).toMatch(/attempt\(s\) remaining/i);

    const userInDb = await User.findOne({ email: testDoctor.email });
    expect(userInDb?.failedLoginAttempts).toBe(1);
    expect(userInDb?.lockUntil).toBeUndefined();
  });

  it('locks account after 5 consecutive failed attempts and writes audit event', async () => {
    await request(app).post('/api/v1/auth/doctor/signup').send(testDoctor);

    // Perform 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      const res = await request(app)
        .post('/api/v1/auth/doctor/login')
        .send({ email: testDoctor.email, password: `WrongAttempt_${i}` });
      expect(res.status).toBe(401);
    }

    const dbUserAfter4 = await User.findOne({ email: testDoctor.email });
    expect(dbUserAfter4?.failedLoginAttempts).toBe(4);
    expect(dbUserAfter4?.lockUntil).toBeUndefined();

    // 5th failed attempt triggers lockout
    const fifthRes = await request(app)
      .post('/api/v1/auth/doctor/login')
      .send({ email: testDoctor.email, password: 'WrongAttempt_5' });

    expect(fifthRes.status).toBe(401);
    expect(fifthRes.body.error.message).toMatch(/account locked due to 5 consecutive/i);

    // Verify lock in database
    const lockedUser = await User.findOne({ email: testDoctor.email });
    expect(lockedUser?.failedLoginAttempts).toBe(5);
    expect(lockedUser?.lockUntil).toBeDefined();
    expect(lockedUser!.lockUntil!.getTime()).toBeGreaterThan(Date.now() + 10 * 60 * 1000);

    // Verify audit log entry
    const auditRecord = await AuditLog.findOne({
      userId: lockedUser!._id,
      purpose: 'ACCOUNT_LOCKOUT_EXCEEDED_ATTEMPTS',
    });
    expect(auditRecord).toBeDefined();
  });

  it('rejects login even with CORRECT password while account is locked', async () => {
    await request(app).post('/api/v1/auth/doctor/signup').send(testDoctor);

    // Lock account directly by simulating 5 failures
    await User.updateOne(
      { email: testDoctor.email },
      {
        failedLoginAttempts: 5,
        lockUntil: new Date(Date.now() + 15 * 60 * 1000),
      }
    );

    // Try logging in with the CORRECT password
    const lockedRes = await request(app)
      .post('/api/v1/auth/doctor/login')
      .send({
        email: testDoctor.email,
        password: testDoctor.password,
      });

    expect(lockedRes.status).toBe(401);
    expect(lockedRes.body.error.message).toMatch(/temporarily locked/i);
  });

  it('allows login after lock duration expires and resets failedLoginAttempts', async () => {
    await request(app).post('/api/v1/auth/doctor/signup').send(testDoctor);

    // Simulate expired lockout (lock was set in past)
    await User.updateOne(
      { email: testDoctor.email },
      {
        failedLoginAttempts: 5,
        lockUntil: new Date(Date.now() - 1000), // Expired 1 second ago
      }
    );

    // Log in with correct password
    const unlockedRes = await request(app)
      .post('/api/v1/auth/doctor/login')
      .send({
        email: testDoctor.email,
        password: testDoctor.password,
      });

    expect(unlockedRes.status).toBe(200);
    expect(unlockedRes.body.success).toBe(true);
    expect(unlockedRes.body.data.accessToken).toBeDefined();

    // Check DB counter is reset to 0 and lock cleared
    const restoredUser = await User.findOne({ email: testDoctor.email });
    expect(restoredUser?.failedLoginAttempts).toBe(0);
    expect(restoredUser?.lockUntil).toBeUndefined();
  });
});
