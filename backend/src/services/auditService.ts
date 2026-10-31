import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

const PHI_DISALLOWED_KEYS = new Set([
  'password', 'token', 'refreshtoken', 'accesstoken', 'authorization', 'otp',
  'secret', 'value', 'values', 'reading', 'readings', 'testvalues', 'aadhaar',
  'pan', 'ssn', 'buffer', 'file', 'dataurl',
]);

export const sanitizeAuditMetadata = (metadata?: Record<string, unknown>): Record<string, unknown> => {
  if (!metadata || typeof metadata !== 'object') return {};
  return Object.fromEntries(Object.entries(metadata).map(([key, val]) => {
    if (PHI_DISALLOWED_KEYS.has(key.toLowerCase())) return [key, '[REDACTED_AUDIT]'];
    if (Array.isArray(val)) return [key, val.map(item =>
      item && typeof item === 'object' ? sanitizeAuditMetadata(item as Record<string, unknown>) : item)];
    if (val && typeof val === 'object') return [key, sanitizeAuditMetadata(val as Record<string, unknown>)];
    return [key, val];
  }));
};

export interface AuditLogParams {
  userId?: string | any; userRole?: string; action: string; resourceType: string;
  resourceId?: string; patientId?: string | any; purpose?: string; ipAddress?: string;
  userAgent?: string; metadata?: Record<string, unknown>; details?: Record<string, unknown>;
}

const persistAudit = async (params: AuditLogParams): Promise<any> => {
  const metadata = sanitizeAuditMetadata(params.metadata || params.details);
  const userId = typeof params.userId === 'string' && params.userId.length > 0 ? params.userId : undefined;
  const patientId = typeof params.patientId === 'string' && params.patientId.length > 0 ? params.patientId : undefined;
  return prisma.auditLog.create({
    data: {
      userId, patientId, userRole: (params.userRole || 'anonymous') as any,
      action: params.action, resourceType: params.resourceType, resourceId: params.resourceId || undefined,
      purpose: params.purpose || 'CLINICAL_ACCESS', ipAddress: params.ipAddress || '127.0.0.1',
      userAgent: params.userAgent || undefined, metadata: metadata as any,
      details: (params.details || metadata) as any,
    },
  });
};

export const recordAudit = (params: AuditLogParams): void => {
  persistAudit(params).catch((err: Error) => logger.error({
    type: 'audit_log_error', action: params.action, resourceType: params.resourceType,
    error: err.message, message: 'Failed to persist audit log entry to database',
  }));
};

export const recordAuditSync = (params: AuditLogParams): Promise<any> => persistAudit(params);

export interface AuditMiddlewareOptions {
  action: string; resourceType: string; getResourceId?: (req: Request) => string | undefined;
  getPatientId?: (req: Request) => string | undefined; purpose?: string;
}

export const auditMiddleware = (options: AuditMiddlewareOptions) =>
  (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      const user = (req as any).user;
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
      recordAudit({
        userId: user?.userId || user?.id, userRole: user?.role || 'anonymous',
        action: options.action, resourceType: options.resourceType,
        resourceId: options.getResourceId ? options.getResourceId(req) : req.params.id || req.params.reportId,
        patientId: options.getPatientId ? options.getPatientId(req) : req.params.patientId,
        purpose: options.purpose || 'CLINICAL_ACCESS', ipAddress, userAgent: req.headers['user-agent'],
        metadata: { method: req.method, path: req.path, statusCode: res.statusCode },
      });
    });
    next();
  };
