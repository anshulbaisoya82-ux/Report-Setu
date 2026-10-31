import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { connectTestDb, closeTestDb, clearTestDb } from '../utils/testDb';
import { RefreshToken } from '../utils/testModels';
import { AuditLog } from '../utils/testModels';
import { authRateLimiter } from '../middlewares/security';

describe('Task 3.5: JWT Access & Refresh Token Service with Rotation and Reuse Detection', () => {
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
    name: 'Dr. Token Test',
    email: 'tokens.rotation@clinic.com',
    phone: '+919876543210',
    registrationNumber: 'DMC-2024-5555',
    medicalCouncil: 'Delhi Medical Council',
    specialty: 'Cardiology',
    clinic: 'Heart Care Center',
    password: 'TokenRotationPassword123!',
  };

  it('rotates refresh token, issuing new access token and revoking old refresh token', async () => {
    // 1. Sign up and Login
    await request(app).post('/api/v1/auth/doctor/signup').send(testDoctor);
    const loginRes = await request(app)
      .post('/api/v1/auth/doctor/login')
      .send({ email: testDoctor.email, password: testDoctor.password });

    expect(loginRes.status).toBe(200);
    const loginCookies = loginRes.headers['set-cookie'];
    expect(loginCookies).toBeDefined();

    // 2. Rotate token
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', loginCookies)
      .send({});

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeDefined();

    const newCookies = refreshRes.headers['set-cookie'];
    expect(newCookies).toBeDefined();
    expect(newCookies[0]).not.toEqual(loginCookies[0]);

    // 3. Verify in DB: 2 token records exist in the same family, first is revoked, second is active
    const tokens = await RefreshToken.find().sort({ createdAt: 1 });
    expect(tokens.length).toBe(2);
    expect(tokens[0].family).toEqual(tokens[1].family);
    expect(tokens[0].isRevoked).toBe(true);
    expect(tokens[1].isRevoked).toBe(false);
  });

  it('detects token reuse and immediately invalidates all tokens in the compromised family', async () => {
    // 1. Sign up and Login
    await request(app).post('/api/v1/auth/doctor/signup').send(testDoctor);
    const loginRes = await request(app)
      .post('/api/v1/auth/doctor/login')
      .send({ email: testDoctor.email, password: testDoctor.password });

    const cookieA = loginRes.headers['set-cookie'];

    // 2. Normal rotation: Cookie A -> Cookie B
    const rotation1 = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', cookieA)
      .send({});

    expect(rotation1.status).toBe(200);
    const cookieB = rotation1.headers['set-cookie'];

    // 3. Normal rotation: Cookie B -> Cookie C
    const rotation2 = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', cookieB)
      .send({});

    expect(rotation2.status).toBe(200);
    const cookieC = rotation2.headers['set-cookie'];

    // 4. MALICIOUS / REPLAY ATTACK: Present expired/consumed Cookie A again!
    const reuseAttackRes = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', cookieA)
      .send({});

    expect(reuseAttackRes.status).toBe(401);
    expect(reuseAttackRes.body.error.message).toMatch(/reuse detected/i);

    // 5. Verify ALL tokens in the family are now revoked
    const allTokens = await RefreshToken.find();
    expect(allTokens.length).toBe(3);
    for (const token of allTokens) {
      expect(token.isRevoked).toBe(true);
    }

    // 6. Legitimate user presenting Cookie C also fails now because entire family was compromised
    const subsequentLegitRes = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', cookieC)
      .send({});

    expect(subsequentLegitRes.status).toBe(401);

    // 7. Security audit log entry created
    const audit = await AuditLog.findOne({ purpose: 'REFRESH_TOKEN_REUSE_DETECTED' });
    expect(audit).toBeDefined();
  });

  it('revokes current session on POST /api/v1/auth/logout', async () => {
    await request(app).post('/api/v1/auth/doctor/signup').send(testDoctor);
    const loginRes = await request(app)
      .post('/api/v1/auth/doctor/login')
      .send({ email: testDoctor.email, password: testDoctor.password });

    const cookies = loginRes.headers['set-cookie'];

    // Logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookies)
      .send({});

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Attempting refresh should fail
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', cookies)
      .send({});

    expect(refreshRes.status).toBe(401);
  });

  it('revokes all user sessions on POST /api/v1/auth/logout-all', async () => {
    await request(app).post('/api/v1/auth/doctor/signup').send(testDoctor);

    // Login session 1 (e.g. mobile)
    const login1 = await request(app)
      .post('/api/v1/auth/doctor/login')
      .send({ email: testDoctor.email, password: testDoctor.password });
    const cookie1 = login1.headers['set-cookie'];
    const accessToken = login1.body.data.accessToken;

    // Login session 2 (e.g. desktop)
    const login2 = await request(app)
      .post('/api/v1/auth/doctor/login')
      .send({ email: testDoctor.email, password: testDoctor.password });
    const cookie2 = login2.headers['set-cookie'];

    // Verify 2 active sessions in different families
    const initialTokens = await RefreshToken.find({ isRevoked: false });
    expect(initialTokens.length).toBe(2);

    // Call logout-all with bearer access token
    const logoutAllRes = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});

    expect(logoutAllRes.status).toBe(200);
    expect(logoutAllRes.body.success).toBe(true);

    // Verify all tokens revoked
    const activeTokens = await RefreshToken.find({ isRevoked: false });
    expect(activeTokens.length).toBe(0);

    // Neither session 1 nor session 2 can refresh
    const refresh1 = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', cookie1)
      .send({});
    expect(refresh1.status).toBe(401);

    const refresh2 = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', cookie2)
      .send({});
    expect(refresh2.status).toBe(401);
  });
});
