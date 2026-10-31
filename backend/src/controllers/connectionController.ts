import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  sendConnectionRequest,
  getPendingConnectionRequests,
  approveConnectionRequest,
  rejectConnectionRequest,
  verifyDoctorConnectCode,
  revokeDoctorConnectionByPatient,
  revokeConnectionByDoctor,
  getPatientConnections,
  getDoctorPendingRequests,
  generatePatientConnectCode,
} from '../services/connectionService';
import { sendSuccess } from '../utils/apiResponse';
import { UnauthorizedError, BadRequestError } from '../utils/errors';

const requestConnectionSchema = z.object({
  rsId: z.string().min(3, 'Patient RS ID is required'),
});

const verifyConnectCodeSchema = z.object({
  patientRsId: z.string().min(3, 'Patient RS ID is required'),
  code: z.string().min(4, 'Connect code is required'),
});

const approveRejectSchema = z.object({
  connectionId: z.string().min(1, 'Connection ID is required'),
});

/**
 * Controller: Doctor sends a connection request to a patient by RS ID.
 * POST /api/v1/connections/doctor/request
 */
export const handleSendConnectionRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const doctorUserId = req.user?.userId;
    if (!doctorUserId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { rsId } = requestConnectionSchema.parse(req.body);
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const result = await sendConnectionRequest(doctorUserId, rsId, ip);

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Patient fetches pending connection requests.
 * GET /api/v1/connections/patient/pending
 */
export const handleGetPendingRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientUserId = req.user?.userId;
    if (!patientUserId) {
      throw new UnauthorizedError('Authentication required');
    }

    const requests = await getPendingConnectionRequests(patientUserId);
    sendSuccess(res, { requests });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Patient approves a pending connection request.
 * Returns a 2-minute verification code to share with the doctor.
 * POST /api/v1/connections/patient/approve
 */
export const handleApproveConnection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientUserId = req.user?.userId;
    if (!patientUserId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { connectionId } = approveRejectSchema.parse(req.body);
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const result = await approveConnectionRequest(patientUserId, connectionId, ip);

    sendSuccess(res, {
      code: result.code,
      expiresAt: result.expiresAt,
      connectionId: result.connectionId,
      doctorName: result.doctorName,
      message: 'Connection approved. Share this code with the doctor. Valid for 2 minutes.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Patient rejects a pending connection request.
 * POST /api/v1/connections/patient/reject
 */
export const handleRejectConnection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientUserId = req.user?.userId;
    if (!patientUserId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { connectionId } = approveRejectSchema.parse(req.body);
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const result = await rejectConnectionRequest(patientUserId, connectionId, ip);

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Doctor enters patient RS ID and connect code to establish connection.
 * POST /api/v1/connections/doctor/verify-code
 */
export const handleVerifyDoctorConnectCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const doctorUserId = req.user?.userId;
    if (!doctorUserId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { patientRsId, code } = verifyConnectCodeSchema.parse(req.body);
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const result = await verifyDoctorConnectCode(doctorUserId, patientRsId, code, ip);

    sendSuccess(res, {
      connection: result.connection,
      patient: result.patient,
      doctor: result.doctor,
      message: 'Connected with patient successfully.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Patient revokes an active doctor connection.
 * POST /api/v1/connections/patient/revoke/:doctorId
 */
export const handleRevokeDoctorConnectionByPatient = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientUserId = req.user?.userId;
    if (!patientUserId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { doctorId } = req.params;
    if (!doctorId) {
      throw new BadRequestError('Doctor ID parameter is required');
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const connection = await revokeDoctorConnectionByPatient(patientUserId, doctorId, ip);

    sendSuccess(res, {
      connection,
      message: 'Doctor connection revoked successfully.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Doctor cancels/revokes a connection.
 * POST /api/v1/connections/doctor/revoke/:connectionId
 */
export const handleRevokeConnectionByDoctor = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const doctorUserId = req.user?.userId;
    if (!doctorUserId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { connectionId } = req.params;
    if (!connectionId) {
      throw new BadRequestError('Connection ID parameter is required');
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const connection = await revokeConnectionByDoctor(doctorUserId, connectionId, ip);

    sendSuccess(res, {
      connection,
      message: 'Connection revoked/cancelled successfully.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Patient fetches active connected doctors.
 * GET /api/v1/connections/my
 */
export const handleGetPatientConnections = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientUserId = req.user?.userId;
    if (!patientUserId) {
      throw new UnauthorizedError('Authentication required');
    }

    sendSuccess(res, { connections: await getPatientConnections(patientUserId) });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Doctor fetches their pending connection requests.
 * GET /api/v1/connections/doctor/pending
 */
export const handleGetDoctorPendingRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const doctorUserId = req.user?.userId;
    if (!doctorUserId) {
      throw new UnauthorizedError('Authentication required');
    }

    const requests = await getDoctorPendingRequests(doctorUserId);
    sendSuccess(res, { requests });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Patient generates a standalone connect code (legacy compat).
 * POST /api/v1/connections/patient/generate-code
 */
export const handleGeneratePatientConnectCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientUserId = req.user?.userId;
    if (!patientUserId) {
      throw new UnauthorizedError('Authentication required');
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const result = await generatePatientConnectCode(patientUserId, ip);

    sendSuccess(res, {
      code: result.code,
      expiresAt: result.expiresAt,
      rsId: result.rsId,
      message: 'Verification code generated. Valid for 2 minutes.',
    });
  } catch (err) {
    next(err);
  }
};

// Legacy export aliases
export const handleRequestDoctorVCode = handleSendConnectionRequest;
