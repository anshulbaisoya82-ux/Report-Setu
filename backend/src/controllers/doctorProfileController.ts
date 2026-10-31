import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { NotFoundError } from '../utils/errors';

const doctorUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  specialty: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  medicalCouncil: z.string().optional(),
  registrationNumber: z.string().optional(),
  clinic: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      timings: z.string().optional(),
      consultationFee: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
  bio: z.string().optional(),
  qualifications: z.string().optional(),
});

/**
 * GET /api/v1/doctor/profile
 * Retrieves verified clinician profile, practice info, and triage statistics.
 */
export async function getDoctorProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { doctorProfile: true },
    });

    if (!user || !user.doctorProfile) {
      throw new NotFoundError('Doctor profile record not found');
    }

    const doctor = user.doctorProfile;

    // Aggregate clinical practice statistics
    const [activePatientsCount, appointmentsCount, prescriptionsIssuedCount, reportsReviewedCount, pendingQuestionsCount] =
      await Promise.all([
        prisma.connection.count({ where: { doctorId: doctor.id, status: 'connected' } }),
        prisma.appointment.count({ where: { doctorId: doctor.id } }),
        prisma.prescription.count({ where: { doctorId: doctor.id } }),
        prisma.report.count({ where: { reviewedBy: doctor.id } }),
        prisma.chatMessage.count({ where: { doctorId: doctor.id, triageTag: 'DoctorReview' } }),
      ]);

    res.status(200).json({
      status: 'success',
      data: {
        id: doctor.id,
        userId: user.id,
        name: doctor.name,
        email: doctor.email || user.email || '',
        phone: doctor.phone || user.phone || '',
        registrationNumber: doctor.registrationNumber,
        medicalCouncil: doctor.medicalCouncil,
        specialty: doctor.specialty,
        clinic: doctor.clinic || {},
        verificationStatus: doctor.verificationStatus,
        verifiedAt: doctor.verifiedAt,
        rejectionReason: doctor.rejectionReason,
        stats: {
          activePatientsCount,
          appointmentsCount,
          prescriptionsIssuedCount,
          reportsReviewedCount,
          pendingQuestionsCount,
        },
        createdAt: doctor.createdAt,
        updatedAt: doctor.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/doctor/profile
 * Updates doctor practice details, specialty, clinic address, and contact info.
 */
export async function updateDoctorProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const input = doctorUpdateSchema.parse(req.body);

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId } });
    if (!doctor) throw new NotFoundError('Doctor profile record not found');

    const updated = await prisma.doctorProfile.update({
      where: { userId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.specialty ? { specialty: input.specialty } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.medicalCouncil ? { medicalCouncil: input.medicalCouncil } : {}),
        ...(input.registrationNumber ? { registrationNumber: input.registrationNumber } : {}),
        ...(input.clinic
          ? {
              clinic: {
                ...(typeof doctor.clinic === 'object' && doctor.clinic !== null ? doctor.clinic : {}),
                ...input.clinic,
              },
            }
          : {}),
        updatedAt: new Date(),
      },
    });

    res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    next(err);
  }
}
