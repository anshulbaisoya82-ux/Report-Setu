import { Request, Response, NextFunction } from 'express';
import { createPrescription, getPrescriptions } from '../services/prescriptionService';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { UnauthorizedError } from '../utils/errors';

/**
 * Controller: Doctor issues a new prescription for a connected patient.
 */
export const handleCreatePrescription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor authorization required to issue prescriptions');
    }

    const {
      patientId,
      name,
      prescriptionName,
      instructions,
      startDate,
      endDate,
      totalDays,
      advice,
      medicines,
      medications,
    } = req.body;

    const resolvedName = (
      name ||
      prescriptionName ||
      medications?.[0]?.name ||
      medicines?.[0]?.name
    )?.trim();

    const rawMedicines = medicines || medications || [];
    const resolvedMedicines = rawMedicines.map((m: any) => ({
      name: m.name || resolvedName,
      dose: m.dose || m.dosage || '1 tablet',
      timing: Array.isArray(m.timing) ? m.timing.join(', ') : m.timing || m.frequency || 'Morning and Night',
      frequency: m.frequency,
      instructions: m.instructions,
    }));

    let resolvedInstructions = instructions?.trim();
    if (!resolvedInstructions) {
      if (resolvedMedicines.length > 0) {
        resolvedInstructions = resolvedMedicines
          .map((m: any) => `${m.dose} · ${m.timing}${m.instructions ? ` · ${m.instructions}` : ''}`)
          .join('; ');
      } else {
        resolvedInstructions = 'Take as prescribed';
      }
    }

    if (!patientId || !resolvedName) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'patientId and medicine name are required fields',
        },
      });
      return;
    }

    const result = await createPrescription(req.user.userId, {
      patientId,
      name: resolvedName,
      instructions: resolvedInstructions,
      startDate,
      endDate,
      totalDays: totalDays ? Number(totalDays) : undefined,
      advice: Array.isArray(advice) ? advice : advice ? [advice] : [],
      medicines: resolvedMedicines,
    });

    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Retrieves prescriptions for patient or doctor.
 */
export const handleGetPrescriptions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { patientId, status } = req.query;

    const list = await getPrescriptions(req.user.userId, req.user.role, {
      patientId: patientId as string,
      status: status as 'Active' | 'Ended',
    });

    sendSuccess(res, { prescriptions: list, total: list.length });
  } catch (err) {
    next(err);
  }
};
