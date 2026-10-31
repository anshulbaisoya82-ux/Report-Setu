import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { NotFoundError } from '../utils/errors';

const profileUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  age: z.number().int().min(0).max(130).optional(),
  gender: z.string().min(1).optional(),
  bloodGroup: z.string().min(1).optional(),
  conditions: z.array(z.string()).optional(),
  location: z.string().min(2).optional(),
  avatar: z.string().optional(),
  email: z.string().email().optional(),
  emergencyContact: z
    .object({
      name: z.string().optional(),
      relation: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

/**
 * GET /api/v1/patient/profile
 * Retrieves full patient clinical profile, ABDM Setu ID, and health portfolio stats.
 */
export async function getPatientProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { patientProfile: true },
    });

    if (!user || !user.patientProfile) {
      throw new NotFoundError('Patient profile record not found');
    }

    const profile = user.patientProfile;

    // Aggregate portfolio metrics
    const [reportsCount, prescriptionsCount, appointmentsCount, connectedDoctorsCount] = await Promise.all([
      prisma.report.count({ where: { patientId: profile.id } }),
      prisma.prescription.count({ where: { patientId: profile.id } }),
      prisma.appointment.count({ where: { patientId: profile.id } }),
      prisma.connection.count({ where: { patientId: profile.id, status: 'connected' } }),
    ]);

    // Fetch primary connected doctor for care team overview
    const activeConnection = await prisma.connection.findFirst({
      where: { patientId: profile.id, status: 'connected' },
      include: { doctor: true },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: {
        id: profile.id,
        userId: user.id,
        rsId: profile.rsId,
        name: profile.name,
        phone: profile.phone || user.phone,
        email: user.email || '',
        avatar: profile.avatar || '',
        age: profile.age,
        gender: profile.gender,
        bloodGroup: profile.bloodGroup,
        conditions: profile.conditions || [],
        location: profile.location,
        status: profile.status,
        lastVisitDate: profile.lastVisitDate,
        lastReportTime: profile.lastReportTime,
        lastReportName: profile.lastReportName,
        notificationPreferences: profile.notificationPreferences,
        primaryDoctor: activeConnection?.doctor
          ? {
              id: activeConnection.doctor.id,
              name: activeConnection.doctor.name,
              specialty: activeConnection.doctor.specialty,
              clinic: activeConnection.doctor.clinic,
            }
          : null,
        stats: {
          reportsCount,
          prescriptionsCount,
          appointmentsCount,
          connectedDoctorsCount,
        },
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/patient/profile
 * Updates patient demographics, clinical tags, and contact details.
 */
export async function updatePatientProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const input = profileUpdateSchema.parse(req.body);

    const profile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('Patient profile not found');

    // If email provided, sync to user table
    if (input.email) {
      await prisma.user.update({
        where: { id: userId },
        data: { email: input.email },
      });
    }

    const { email, ...patientData } = input;

    const updated = await prisma.patientProfile.update({
      where: { userId },
      data: {
        ...patientData,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    next(err);
  }
}
