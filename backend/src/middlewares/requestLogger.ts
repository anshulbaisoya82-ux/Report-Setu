import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Express middleware that:
 * 1. Assigns or preserves a unique X-Request-Id header.
 * 2. Attaches `req.id` to the request object.
 * 3. Logs the incoming HTTP request and response duration.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const existingId = req.headers['x-request-id'];
  const requestId = (typeof existingId === 'string' && existingId.trim().length > 0)
    ? existingId
    : randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    // Log HTTP request metadata (without query or body parameters that could contain PHI)
    logger.info({
      type: 'http_request',
      requestId,
      method,
      path: originalUrl.split('?')[0],
      statusCode,
      durationMs: duration,
      ip,
      userAgent: req.headers['user-agent'] || 'unknown',
    });
  });

  next();
};
