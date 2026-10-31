import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { prisma } from '../config/prisma';
import {
  sanitizeAuditMetadata,
  recordAudit,
  recordAuditSync,
  auditMiddleware,
} from './auditService';
import { sendSuccess } from '../utils/apiResponse';

describe('Secure Audit Logging Service (Task 2.3)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('PHI Redaction in Audit Metadata', () => {
    it('should redact sensitive health readings, test values, and authentication secrets', () => {
      const rawMetadata = {
        testType: 'CBC',
        patientCategory: 'adult',
        values: { hemoglobin: 14.5, wbc: 7500 },
        reading: 'critical_high',
        password: 'PlainTextPassword123!',
        token: 'jwt-access-token-example',
        otp: '123456',
        aadhaar: '1234-5678-9012',
        nonSensitiveInfo: 'Routine health checkup',
      };

      const sanitized = sanitizeAuditMetadata(rawMetadata);

      expect(sanitized.testType).toBe('CBC');
      expect(sanitized.patientCategory).toBe('adult');
      expect(sanitized.nonSensitiveInfo).toBe('Routine health checkup');

      // PHI / Secret fields must be redacted
      expect(sanitized.values).toBe('[REDACTED_AUDIT]');
      expect(sanitized.reading).toBe('[REDACTED_AUDIT]');
      expect(sanitized.password).toBe('[REDACTED_AUDIT]');
      expect(sanitized.token).toBe('[REDACTED_AUDIT]');
      expect(sanitized.otp).toBe('[REDACTED_AUDIT]');
      expect(sanitized.aadhaar).toBe('[REDACTED_AUDIT]');
    });

    it('should handle undefined, null, or empty metadata gracefully', () => {
      expect(sanitizeAuditMetadata(undefined)).toEqual({});
      expect(sanitizeAuditMetadata(null as any)).toEqual({});
      expect(sanitizeAuditMetadata({})).toEqual({});
    });
  });

  describe('Audit Recording Operations', () => {
    it('persists an audit row with sanitized fields through Prisma', async () => {
      await recordAuditSync({
        userId: '507f1f77bcf86cd799439011',
        userRole: 'doctor',
        action: 'REPORT_VIEW',
        resourceType: 'Report',
        resourceId: 'rep_12345',
        patientId: 'pat_67890',
        purpose: 'SECOND_OPINION',
        ipAddress: '192.168.1.100',
        metadata: {
          testType: 'Lipid Panel',
          values: { cholesterol: 240 },
        },
      });
      const log = await prisma.auditLog.findFirst({ where: { resourceId: 'rep_12345' } });
      expect(log?.metadata).toMatchObject({ values: '[REDACTED_AUDIT]' });
    });

    it('should record audit event when auditMiddleware is executed on successful request', async () => {
      const app = express();
      app.use(express.json());

      // Simulate authenticated user on request
      app.use((req: any, _res: Response, next) => {
        req.user = { id: 'doc_user_1', role: 'doctor' };
        next();
      });

      app.get(
        '/reports/:reportId',
        auditMiddleware({
          action: 'REPORT_VIEW',
          resourceType: 'Report',
          purpose: 'CLINICAL_REVIEW',
        }),
        (req: Request, res: Response) => {
          sendSuccess(res, { reportId: req.params.reportId, status: 'ok' });
        }
      );

      const res = await request(app).get('/reports/rep_999');

      expect(res.status).toBe(200);
      const log = await prisma.auditLog.findFirst({ where: { action: 'REPORT_VIEW', resourceId: 'rep_123' } });
      expect(log).not.toBeNull();
    });
  });
});
