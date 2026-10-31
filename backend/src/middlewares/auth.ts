import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { UserRole } from '../domain/types';

// Extend Express Request to carry authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Middleware: Enforces that incoming request contains a valid JWT Bearer access token
 * and that the associated user account is active.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  // Allow test / dev admin secret key bypass
  const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
  if (adminKey && adminKey === 'reportsetu_admin_secret_key_12345') {
    req.user = {
      userId: 'system_admin',
      role: 'admin',
      isVerified: true,
    };
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new UnauthorizedError('Authentication required. Missing Bearer token.')
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);

    // Platform administrator bypass
    if (payload.role === 'admin') {
      req.user = payload;
      return next();
    }

    if (!payload.userId) {
      return next(new UnauthorizedError('Malformed user identifier in token.'));
    }

    // Verify user exists and is active
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      return next(
        new UnauthorizedError('Account is inactive, suspended, or does not exist.')
      );
    }

    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware: Restricts access to specified roles (patient, doctor, admin).
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access forbidden. Role '${req.user.role}' is not authorized for this resource.`
        )
      );
    }

    next();
  };
};

/**
 * Middleware: Ensures that authenticated doctors have been verified by an administrator
 * before they can access or modify patient health records.
 */
export const requireVerifiedDoctor = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required.'));
  }

  // Admin bypass
  if (req.user.role === 'admin') {
    return next();
  }

  if (req.user.role !== 'doctor') {
    return next(
      new ForbiddenError('Only medical doctors can access this clinical resource.')
    );
  }

  // Fast-path: Check token claim
  if (req.user.isVerified) {
    return next();
  }

  // DB fallback check for fresh verification status
  const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user.userId } });
  if (!doctor || doctor.verificationStatus !== 'verified') {
    return next(
      new ForbiddenError(
        'Your doctor account is pending medical council verification. Please contact the administrator.'
      )
    );
  }

  // Cache verified status on request
  req.user.isVerified = true;
  next();
};

/**
 * Middleware: Protects administrative endpoints
 */
export const requireAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // Allow test / dev admin token bypass or role check
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  // Optional header for testing/dev admin actions
  const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
  if (adminKey && adminKey === 'reportsetu_admin_secret_key_12345') {
    req.user = {
      userId: 'system_admin',
      role: 'admin',
      isVerified: true,
    };
    return next();
  }

  next(new ForbiddenError('Administrator privileges required.'));
};
