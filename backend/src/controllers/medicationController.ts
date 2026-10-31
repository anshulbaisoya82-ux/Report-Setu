import { Request, Response, NextFunction } from 'express';
import {
  getTodaySchedule,
  recordDoseAction,
  getAdherenceMetrics,
} from '../services/medicationService';
import { sendSuccess } from '../utils/apiResponse';
import { UnauthorizedError, ValidationError } from '../utils/errors';

/**
 * Controller: Returns today's medication dose schedule matching frontend MedicineScheduleItem.
 */
export const handleGetTodaySchedule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { patientId } = req.query;
    const schedule = await getTodaySchedule(
      req.user.userId,
      req.user.role,
      patientId as string | undefined
    );

    sendSuccess(res, { schedule, total: schedule.length });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Records action on a medicine dose item ('taken', 'due', 'snoozed', 'missed').
 */
export const handleRecordDoseAction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { id: doseId } = req.params;
    const { action, state } = req.body;
    const effectiveAction = action || state;

    if (!effectiveAction) {
      throw new ValidationError("Action is required ('taken', 'due', 'snoozed', 'missed')");
    }

    const updated = await recordDoseAction(
      req.user.userId,
      req.user.role,
      doseId,
      effectiveAction
    );

    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Computes and returns weekly adherence metrics and streak.
 */
export const handleGetAdherenceMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { patientId } = req.query;
    const metrics = await getAdherenceMetrics(
      req.user.userId,
      req.user.role,
      patientId as string | undefined
    );

    sendSuccess(res, metrics);
  } catch (err) {
    next(err);
  }
};
