import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { signAccessToken } from '../utils/jwt';
import { sendSuccess } from '../utils/apiResponse';
import { ServiceUnavailableError, UnauthorizedError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const digest = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest();

/** Compares in constant time so the key can't be guessed from response timing. */
export function adminKeyMatches(given: string, expected: string): boolean {
  return crypto.timingSafeEqual(digest(given), digest(expected));
}

/**
 * POST /api/v1/auth/admin/login  { adminKey }
 * Checks the key against the ADMIN_KEY environment variable (never stored in code) and
 * returns a short-lived admin access token for the admin portal.
 */
export const handleAdminLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const expected = config.ADMIN_KEY || process.env.ADMIN_KEY;
    if (!expected) throw new ServiceUnavailableError('Admin login is not set up on this server (ADMIN_KEY is missing).');
    const given = typeof req.body?.adminKey === 'string' ? req.body.adminKey : '';
    if (!given) throw new ValidationError('Enter the admin key');
    if (!adminKeyMatches(given, expected)) {
      logger.warn({ type: 'admin_login_failed', ip: req.ip }, 'Failed admin login attempt');
      throw new UnauthorizedError('Wrong admin key');
    }
    const accessToken = signAccessToken({ userId: 'system_admin', role: 'admin', isVerified: true });
    sendSuccess(res, { accessToken, user: { id: 'system_admin', role: 'admin', name: 'Administrator' } });
  } catch (err) {
    next(err);
  }
};
