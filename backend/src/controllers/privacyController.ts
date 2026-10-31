import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { recordAuditSync } from '../services/auditService';
import { NotFoundError } from '../utils/errors';

/**
 * Task 11.1: GDPR/DPDP-Compliant Patient Data Export
 * GET /api/v1/patient/privacy/export
 */
export async function exportPatientData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const profile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundError('Patient profile not found');
    }

    const [reports, prescriptions, appointments, medicineSchedule, messages] =
      await Promise.all([
        prisma.report.findMany({ where: { patientId: profile.id } }),
        prisma.prescription.findMany({ where: { patientId: profile.id } }),
        prisma.appointment.findMany({ where: { patientId: profile.id } }),
        prisma.medicineSchedule.findMany({ where: { patientId: profile.id } }),
        prisma.chatMessage.findMany({ where: { patientId: profile.id } }),
      ]);

    // Record immutable compliance audit entry
    await recordAuditSync({
      userId: profile.userId,
      userRole: 'patient',
      action: 'DATA_EXPORT',
      resourceType: 'PATIENT_PROFILE',
      resourceId: profile.id,
      patientId: profile.id,
      purpose: 'GDPR_DPDP_RIGHT_OF_ACCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'unknown',
      details: {
        exportedReportsCount: reports.length,
        exportedPrescriptionsCount: prescriptions.length,
        exportedAppointmentsCount: appointments.length,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        exportedAt: new Date().toISOString(),
        complianceNotice: 'ReportSetu Personal Health Data Export (Digital Personal Data Protection & GDPR)',
        profile: {
          rsId: profile.rsId,
          name: profile.name,
          age: profile.age,
          gender: profile.gender,
          bloodGroup: profile.bloodGroup,
          conditions: profile.conditions,
          location: profile.location,
        },
        reports,
        prescriptions,
        appointments,
        medicineSchedule,
        messages,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Task 11.1: Right to Be Forgotten & Account Erasure
 * DELETE /api/v1/patient/privacy/account
 */
export async function deletePatientAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User account not found');
    }

    const profile = await prisma.patientProfile.findUnique({ where: { userId } });

    if (profile) {
      // 1. Revoke all active doctor connections
      await prisma.connection.updateMany({
        where: { patientId: profile.id, status: 'connected' },
        data: { status: 'revoked', revokedAt: new Date(), revokedBy: userId },
      });

      // 2. Delete active tokens and one-time codes
      await Promise.all([
        prisma.refreshToken.deleteMany({ where: { userId } }),
        ...(user.phone
          ? [prisma.otp.deleteMany({ where: { phone: user.phone } })]
          : []),
        prisma.connectCode.deleteMany({ where: { patientId: profile.id } }),
        prisma.medicineSchedule.deleteMany({ where: { patientId: profile.id } }),
        prisma.chatMessage.deleteMany({ where: { patientId: profile.id } }),
      ]);

      // 3. Anonymize/delete patient clinical records
      await Promise.all([
        prisma.report.deleteMany({ where: { patientId: profile.id } }),
        prisma.prescription.deleteMany({ where: { patientId: profile.id } }),
        prisma.appointment.deleteMany({ where: { patientId: profile.id } }),
        prisma.patientProfile.delete({ where: { id: profile.id } }),
      ]);
    }

    // 4. Anonymize User account to prevent re-identification while preserving audit trail
    const anonymizedPhone = `ANON_${crypto.randomBytes(8).toString('hex')}`;
    await prisma.user.update({
      where: { id: userId },
      data: { phone: anonymizedPhone, isActive: false },
    });

    // 5. Record mandatory forensic audit log (AuditLog collection is immutable)
    await recordAuditSync({
      userId,
      userRole: 'patient',
      action: 'DATA_EXPORT', // Compliance action
      resourceType: 'USER_ACCOUNT',
      resourceId: userId.toString(),
      purpose: 'GDPR_DPDP_RIGHT_TO_ERASURE',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'unknown',
      details: {
        reason: 'Patient self-service account deletion',
        anonymizedAt: new Date().toISOString(),
      },
    });

    res.status(200).json({
      status: 'success',
      message: 'Account and all associated personal health data have been permanently erased in compliance with privacy regulations.',
    });
  } catch (err) {
    next(err);
  }
}
