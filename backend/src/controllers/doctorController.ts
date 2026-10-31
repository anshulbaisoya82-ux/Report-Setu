import { Request, Response, NextFunction } from 'express';
import { getDoctorPatients } from '../services/doctorService';
import { sendSuccess } from '../utils/apiResponse';
import { UnauthorizedError } from '../utils/errors';

/**
 * Controller: Returns connected patients for the authenticated doctor,
 * formatted matching frontend Patient interface, ranked by clinical triage priority.
 */
export const handleGetDoctorPatients = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const { search, condition, status, page, limit } = req.query;

    const result = await getDoctorPatients(req.user.userId, {
      search: search as string,
      condition: condition as string,
      status: status as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });

    sendSuccess(res, {
      patients: result.patients,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Adds a private doctor note to a patient profile.
 */
export const handleAddDoctorPrivateNote = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const { id: patientId } = req.params;
    const { note, reportId, category, priority } = req.body;

    if (!note || typeof note !== 'string' || !note.trim()) {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Note text is required' },
      });
      return;
    }

    const { addDoctorPrivateNote } = await import('../services/doctorService');
    const createdNote = await addDoctorPrivateNote(req.user.userId, patientId, {
      note: note.trim(),
      reportId,
      category,
      priority,
    });

    const { sendCreated } = await import('../utils/apiResponse');
    sendCreated(res, createdNote);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Retrieves private doctor notes for a patient.
 */
export const handleGetDoctorPrivateNotes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const { id: patientId } = req.params;
    const { getDoctorPrivateNotes } = await import('../services/doctorService');
    const notes = await getDoctorPrivateNotes(req.user.userId, patientId);

    sendSuccess(res, { notes });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Updates clinical priority label for a patient profile.
 */
export const handleUpdatePatientPriority = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const { id: patientId } = req.params;
    const { priority } = req.body;

    if (!priority || typeof priority !== 'string') {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Priority state is required' },
      });
      return;
    }

    const { updatePatientPriority } = await import('../services/doctorService');
    const updated = await updatePatientPriority(req.user.userId, patientId, priority as any);

    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
};
