import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { createApp } from '../app';
import {
  mongoSanitize,
  sanitizeData,
  createRateLimiter,
} from './security';
import { errorHandler } from './errorHandler';
import { sendSuccess } from '../utils/apiResponse';

describe('Security Hardening Middleware (Task 2.2)', () => {
  describe('Helmet & Security Headers', () => {
    it('should set essential security headers (X-Content-Type-Options, HSTS, CSP, X-Frame-Options)', async () => {
      const app = createApp();
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('CORS Enforcement', () => {
    it('should accept requests from allowed origin', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject requests from disallowed origin with 403 Forbidden', async () => {
      const app = createApp();
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://malicious-phishing-site.xyz');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('NoSQL Query & Prototype Pollution Sanitization', () => {
    it('should strip $gt, $ne, and nested operators from payloads', () => {
      const maliciousPayload = {
        username: 'patient123',
        password: { $gt: '' },
        nested: {
          token: { $ne: null },
          validField: 'safeValue',
        },
      };

      const modified = sanitizeData(maliciousPayload);

      expect(modified).toBe(true);
      expect(maliciousPayload.username).toBe('patient123');
      expect((maliciousPayload as any).password).toEqual({});
      expect((maliciousPayload.nested as any).token).toEqual({});
      expect(maliciousPayload.nested.validField).toBe('safeValue');
    });

    it('should strip prototype pollution keys (__proto__, constructor, prototype)', () => {
      // In incoming HTTP JSON requests, prototype keys are parsed via JSON.parse
      const payload = JSON.parse('{"name": "Normal User", "__proto__": {"admin": true}, "constructor": {"polluted": true}}');

      sanitizeData(payload);

      expect(payload.name).toBe('Normal User');
      expect(Object.prototype.hasOwnProperty.call(payload, '__proto__')).toBe(false);
      expect(payload['constructor']).not.toEqual({ polluted: true });
    });

    it('should strip keys containing dots to prevent MongoDB path manipulation', () => {
      const payload: any = {
        'profile.role': 'admin',
        'address.city': 'Delhi',
        email: 'user@example.com',
      };

      sanitizeData(payload);

      expect(payload['profile.role']).toBeUndefined();
      expect(payload['address.city']).toBeUndefined();
      expect(payload.email).toBe('user@example.com');
    });

    it('should sanitize request body in Express pipeline', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.use(mongoSanitize);
      testApp.post('/test-sanitize', (req: Request, res: Response) => {
        res.json({ body: req.body });
      });

      const res = await request(testApp)
        .post('/test-sanitize')
        .send({
          email: 'test@example.com',
          password: { $ne: 'dummy' },
        });

      expect(res.status).toBe(200);
      expect(res.body.body.email).toBe('test@example.com');
      expect(res.body.body.password).toEqual({});
    });
  });

  describe('Sliding-Window Rate Limiting', () => {
    let testLimiter: ReturnType<typeof createRateLimiter>;
    let limiterApp: express.Express;

    beforeEach(() => {
      testLimiter = createRateLimiter({
        windowMs: 5000,
        max: 3,
        message: 'Too many requests for test route',
      });
      testLimiter.reset();

      limiterApp = express();
      limiterApp.use(testLimiter);
      limiterApp.get('/test-limit', (_req: Request, res: Response) => {
        sendSuccess(res, { ok: true });
      });
      limiterApp.use(errorHandler);
    });

    it('should allow requests under the maximum limit and set rate limit headers', async () => {
      const res1 = await request(limiterApp).get('/test-limit');
      expect(res1.status).toBe(200);
      expect(res1.headers['ratelimit-limit']).toBe('3');
      expect(res1.headers['ratelimit-remaining']).toBe('2');

      const res2 = await request(limiterApp).get('/test-limit');
      expect(res2.status).toBe(200);
      expect(res2.headers['ratelimit-remaining']).toBe('1');
    });

    it('should return 429 Too Many Requests and Retry-After header when threshold exceeded', async () => {
      // Consume 3 allowed tokens
      await request(limiterApp).get('/test-limit');
      await request(limiterApp).get('/test-limit');
      await request(limiterApp).get('/test-limit');

      // 4th request must be blocked
      const blockedRes = await request(limiterApp).get('/test-limit');

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(blockedRes.body.error.message).toBe('Too many requests for test route');
      expect(blockedRes.headers['retry-after']).toBeDefined();
      expect(Number(blockedRes.headers['retry-after'])).toBeGreaterThan(0);
    });
  });
});
