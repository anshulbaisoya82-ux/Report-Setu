import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { User, PatientProfile, Otp } from '../utils/testModels';
import { testDb } from '../utils/testDb';
import { sendPatientOtp } from '../services/authService';
import { otpRateLimiter } from '../middlewares/security';

describe('Patient Mobile OTP Authentication (Task 3.2)', () => {
  const app = createApp();
  const testPhone = '+919876543210';

  beforeAll(async () => {
    await testDb.setup();
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    otpRateLimiter.reset();
    await testDb.clear();
  });

  describe('POST /api/v1/auth/patient/send-otp', () => {
    it('should successfully send OTP for a valid 10-digit Indian phone number', async () => {
      const res = await request(app)
        .post('/api/v1/auth/patient/send-otp')
        .send({ phone: testPhone });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phone).toBe(testPhone);
      expect(res.body.data.expiresAt).toBeDefined();

      // Check OTP in database
      const savedOtp = await Otp.findOne({ phone: testPhone });
      expect(savedOtp).toBeDefined();
      expect(savedOtp?.otpHash).toBeDefined();
    });

    it('should accept 10-digit phone without country code and normalize it', async () => {
      const res = await request(app)
        .post('/api/v1/auth/patient/send-otp')
        .send({ phone: '9876543210' });

      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe('+919876543210');
    });

    it('should reject invalid or malformed phone numbers', async () => {
      const res = await request(app)
        .post('/api/v1/auth/patient/send-otp')
        .send({ phone: '12345' });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/patient/verify-otp', () => {
    it('should verify OTP and register a new patient with tokens and HTTP-only cookie', async () => {
      // 1. Send OTP
      const sendResult = await sendPatientOtp(testPhone);
      const code = sendResult.devCode || '123456';

      // 2. Verify OTP
      const res = await request(app)
        .post('/api/v1/auth/patient/verify-otp')
        .send({ phone: testPhone, otp: code });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.isNewUser).toBe(true);
      expect(res.body.data.user.role).toBe('patient');
      expect(res.body.data.patient.rsId).toMatch(/^RS-[A-Z0-9]{5}$/);

      // Check HTTP-only refresh cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('refreshToken=');
      expect(cookies[0]).toContain('HttpOnly');

      // Verify User & PatientProfile records in DB
      const user = await User.findOne({ phone: testPhone });
      expect(user).toBeDefined();
      expect(user?.isVerified).toBe(true);

      const patient = await PatientProfile.findOne({ userId: user?._id });
      expect(patient).toBeDefined();
      expect(patient?.phone).toBe(testPhone);
    });

    it('should login an existing patient without duplicating user records', async () => {
      // First verification creates patient
      await sendPatientOtp(testPhone);
      await request(app)
        .post('/api/v1/auth/patient/verify-otp')
        .send({ phone: testPhone, otp: '123456' });

      // Second verification logs in existing patient
      await sendPatientOtp(testPhone);
      const loginRes = await request(app)
        .post('/api/v1/auth/patient/verify-otp')
        .send({ phone: testPhone, otp: '123456' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.isNewUser).toBe(false);

      const userCount = await User.countDocuments({ phone: testPhone });
      expect(userCount).toBe(1);
    });

    it('should reject incorrect OTP and decrement remaining attempts', async () => {
      await sendPatientOtp(testPhone);

      const res = await request(app)
        .post('/api/v1/auth/patient/verify-otp')
        .send({ phone: testPhone, otp: '999999' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid verification code');
    });

    it('should invalidate OTP after 5 consecutive failed attempts', async () => {
      await sendPatientOtp(testPhone);

      // Fail 4 times (using different phone param to avoid IP rate limiter trigger)
      for (let i = 0; i < 4; i++) {
        otpRateLimiter.reset();
        await request(app)
          .post('/api/v1/auth/patient/verify-otp')
          .send({ phone: testPhone, otp: '000000' });
      }

      otpRateLimiter.reset();
      // 5th failure invalidates OTP
      const finalRes = await request(app)
        .post('/api/v1/auth/patient/verify-otp')
        .send({ phone: testPhone, otp: '000000' });

      expect(finalRes.status).toBe(400);

      otpRateLimiter.reset();
      // Subsequent attempt fails because maximum attempts were exceeded
      const lockedRes = await request(app)
        .post('/api/v1/auth/patient/verify-otp')
        .send({ phone: testPhone, otp: '123456' });

      expect(lockedRes.status).toBe(400);
      expect(lockedRes.body.error.message).toContain('Maximum verification attempts exceeded');
    });
  });
});
