import { Request, Response, NextFunction } from 'express';
import {
  verifyDoctorByAdmin,
  rejectDoctorByAdmin,
  getDoctorsForAdmin,
  getAdminStats,
  verifyAllPendingDoctors,
} from '../services/authService';
import { sendSuccess } from '../utils/apiResponse';
import { BadRequestError } from '../utils/errors';

/**
 * Controller: Get high-level administrative platform metrics
 */
export const handleGetAdminStats = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await getAdminStats();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: List all doctors with filtering and search
 */
export const handleGetDoctors = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const doctors = await getDoctorsForAdmin({ status, search });
    sendSuccess(res, { doctors, total: doctors.length });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Admin verifies a registered doctor's credentials and updates status to 'verified'
 */
export const handleVerifyDoctor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new BadRequestError('Doctor ID parameter is required');
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const adminUserId = req.user?.userId || 'admin';
    const doctor = await verifyDoctorByAdmin(id, adminUserId, ip);

    sendSuccess(res, {
      doctor,
      message: 'Doctor verified successfully by administrator',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Admin rejects a doctor application with an optional reason
 */
export const handleRejectDoctor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new BadRequestError('Doctor ID parameter is required');
    }

    const { reason } = req.body || {};
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const adminUserId = req.user?.userId || 'admin';
    const doctor = await rejectDoctorByAdmin(id, reason, adminUserId, ip);

    sendSuccess(res, {
      doctor,
      message: 'Doctor application rejected',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Admin verifies all currently pending doctors in one click
 */
export const handleVerifyAllPendingDoctors = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';
    const adminUserId = req.user?.userId || 'admin';
    const result = await verifyAllPendingDoctors(adminUserId, ip);
    sendSuccess(res, {
      message: `Successfully verified all ${result.count} pending doctor(s)`,
      count: result.count,
    });
  } catch (err) {
    next(err);
  }
};
