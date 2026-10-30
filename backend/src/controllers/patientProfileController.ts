import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { NotFoundError } from '../utils/errors';

const profileSchema = z.object({
  name: z.string().min(2),
  age: z.number().int().min(0).max(130),
  gender: z.string().min(1),
  bloodGroup: z.string().min(1),
  conditions: z.array(z.string()).default([]),
  location: z.string().min(2),
});

export async function updatePatientProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as any).user.userId;
    const input = profileSchema.parse(req.body);
    const profile = await prisma.patientProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundError('Patient profile not found');

    const updated = await prisma.patientProfile.update({
      where: { userId },
      data: input,
    });

    res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    next(err);
  }
}
