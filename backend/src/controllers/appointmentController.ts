import { Request, Response, NextFunction } from 'express';
import {
  requestAppointment,
  updateAppointmentStatus,
  getAppointments,
} from '../services/appointmentService';
import { sendCreated, sendSuccess } from '../utils/apiResponse';
import { UnauthorizedError, ValidationError } from '../utils/errors';
import { AppointmentStatus } from '../generated/prisma/client';

/**
 * Controller: Requests or books an appointment.
 */
export const handleRequestAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required to request appointments');
    }

    const {
      doctorId,
      patientId,
      reason,
      date,
      time,
      type,
      status,
      notes,
    } = req.body;

    const result = await requestAppointment(req.user.userId, req.user.role, {
      doctorId,
      patientId,
      reason,
      date,
      time,
      type,
      status,
      notes,
    });

    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Updates status of an appointment (doctor accept/reject/complete or patient cancel).
 */
export const handleUpdateAppointmentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { id: appointmentId } = req.params;
    const { status, notes, date, time } = req.body;

    if (!status) {
      throw new ValidationError('Appointment status is required');
    }

    const updated = await updateAppointmentStatus(
      req.user.userId,
      req.user.role,
      appointmentId,
      status as AppointmentStatus,
      notes,
      date,
      time
    );

    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Lists appointments for authenticated user.
 */
export const handleGetAppointments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { status } = req.query;
    const list = await getAppointments(
      req.user.userId,
      req.user.role,
      status as AppointmentStatus | undefined
    );

    sendSuccess(res, { appointments: list, total: list.length });
  } catch (err) {
    next(err);
  }
};
