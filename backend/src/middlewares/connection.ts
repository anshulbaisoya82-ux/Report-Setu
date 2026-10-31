import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from '../utils/errors';

/**
 * Middleware: Enforces that a doctor can ONLY access or query a patient's health records
 * if there exists an 'active' Connection between that doctor and that patient.
 *
 * Patient identifiers are automatically resolved from:
 * 1. req.params.patientId or req.params.id
 * 2. req.query.patientId
 * 3. req.body.patientId or req.body.rsId
 *
 * Rules:
 * - Admin: bypasses active connection requirement.
 * - Patient: can only access their own profile/records. Attempting to access another patient returns 403 Forbidden.
 * - Doctor: must have an active connection with the target patient. Otherwise returns 403 Forbidden.
 */
export const requireActiveConnection = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required.'));
  }

  // 1. Admin bypass
  if (req.user.role === 'admin') {
    return next();
  }

  // 2. Resolve patient identifier from request
  const patientParam =
    req.params.patientId ||
    req.params.id ||
    (req.query.patientId as string) ||
    req.body.patientId ||
    req.body.rsId;

  if (!patientParam) {
    return next(
      new BadRequestError('Target patient identifier is required for this clinical resource.')
    );
  }

  // 3. Locate target PatientProfile
  const identifier = patientParam.toString().trim();
  const patient = await prisma.patientProfile.findFirst({
    where: {
      OR: [
        { rsId: identifier.toUpperCase() },
        { id: identifier },
        { userId: identifier },
      ],
    },
  });

  if (!patient) {
    return next(new NotFoundError('Patient profile not found.'));
  }

  // 4. Role: Patient
  if (req.user.role === 'patient') {
    if (patient.userId !== req.user.userId) {
      return next(
        new ForbiddenError("You are not authorized to view another patient's health records.")
      );
    }
    return next();
  }

  // 5. Role: Doctor
  if (req.user.role === 'doctor') {
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user.userId } });
    if (!doctor || doctor.verificationStatus !== 'verified') {
      return next(
        new ForbiddenError(
          'Only verified medical doctors with an active connection can access patient records.'
        )
      );
    }

    const activeConnection = await prisma.connection.findFirst({
      where: {
        patientId: patient.id,
        doctorId: doctor.id,
        status: 'connected',
      },
    });

    if (!activeConnection) {
      return next(
        new ForbiddenError(
          "Active doctor-patient connection required. You do not have permission to access this patient's records."
        )
      );
    }

    return next();
  }

  next(new ForbiddenError('Unauthorized role for patient health records.'));
};
