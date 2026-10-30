import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  uploadAndAnalyzeReport,
  confirmReportParameters,
  getReportById,
  getPatientReports,
  getDoctorInbox,
  reviewAndApproveReport,
  transitionReportReviewStatus,
  markReportAsViewed,
} from '../services/reportService';
import { getPatientHistoricalTrends } from '../services/trendService';
import { prisma } from '../config/prisma';
import { serializeReport, serializeReports } from '../utils/serializers';
import { sendSuccess, sendCreated } from '../utils/apiResponse';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

export const confirmReportSchema = z.object({
  parameters: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1, 'Parameter name is required'),
        value: z.coerce.number({ required_error: 'Parameter value is required' }),
        unit: z.string().optional(),
        referenceRange: z.string().optional(),
      })
    )
    .min(1, 'At least one parameter is required'),
  collectionDate: z.string().optional(),
  labName: z.string().optional(),
  name: z.string().optional(),
  category: z
    .enum(['CBC', 'Diabetes', 'HbA1c', 'Lipid', 'LFT', 'KFT', 'Other'])
    .optional(),
});

/**
 * Controller: Handles file upload, OCR & ML extraction, clinical range evaluation,
 * and report creation.
 */
export const handleUploadReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!req.file) {
      throw new BadRequestError('No report file uploaded');
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';
    const userAgent = req.get('user-agent') || 'unknown';

    const result = await uploadAndAnalyzeReport({
      fileBuffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      userId: req.user.userId,
      userRole: req.user.role,
      patientId: req.body.patientId,
      ipAddress: ip,
      userAgent,
    });

    const serialized = serializeReport(result.report, req.user.role);

    sendCreated(res, {
      report: serialized,
      analysis: result.analysis,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Patient confirms/corrects extracted report parameters.
 * Preserves original vs. corrected values and updates overall report status.
 */
export const handleConfirmReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedBody = confirmReportSchema.parse(req.body);

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';
    const userAgent = req.get('user-agent') || 'unknown';

    const updatedReport = await confirmReportParameters({
      reportId: req.params.id,
      parameters: validatedBody.parameters,
      collectionDate: validatedBody.collectionDate,
      labName: validatedBody.labName,
      name: validatedBody.name,
      category: validatedBody.category,
      userId: req.user.userId,
      userRole: req.user.role,
      ipAddress: ip,
      userAgent,
    });

    const serialized = serializeReport(updatedReport, req.user.role);

    sendSuccess(res, {
      report: serialized,
      message: 'Report parameters confirmed successfully',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Retrieves a single report by ID.
 */
export const handleGetReportById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const report = await getReportById(req.params.id, req.user.userId, req.user.role);
    const serialized = serializeReport(report, req.user.role);

    sendSuccess(res, { report: serialized });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Retrieves all reports for a patient.
 */
export const handleGetPatientReports = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    let patientId = req.params.patientId;

    if (!patientId && req.user.role === 'patient') {
      const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: req.user.userId } });
      if (!patientProfile) {
        throw new BadRequestError('Patient profile not found');
      }
      patientId = patientProfile.id;
    }

    if (!patientId) {
      throw new BadRequestError('patientId is required');
    }

    const category = req.query.category as string | undefined;
    const reports = await getPatientReports(
      patientId,
      req.user.userId,
      req.user.role,
      category
    );

    const serialized = serializeReports(reports, req.user.role);

    sendSuccess(res, { reports: serialized });
  } catch (err) {
    next(err);
  }
};

export const reviewReportSchema = z.object({
  text: z.string().min(1, 'Doctor summary text is required'),
  hindiText: z.string().optional(),
  tone: z.enum(['Plain language', 'More detail', 'Brief']).optional(),
  nextTestDate: z.string().optional(),
  medicinesStatus: z.enum(['No change', 'Changed']).optional(),
  sentVia: z.array(z.enum(['App', 'SMS', 'Email'])).optional(),
  doctorNotes: z.string().optional(),
});

/**
 * Controller: Doctor inbox listing reports from all connected patients,
 * ranked by Urgent Review Ranking Score (Critical priority).
 */
export const handleGetDoctorInbox = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const { status, reviewStatus, category, page, limit } = req.query;

    const result = await getDoctorInbox(req.user.userId, {
      status: status as string,
      reviewStatus: reviewStatus as string,
      category: category as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 50,
    });

    const serializedReports = serializeReports(result.reports, 'doctor');

    // Attach computed urgencyScore to serialized response
    const enriched = serializedReports.map((r, i) => ({
      ...r,
      urgencyScore: result.reports[i].urgencyScore,
    }));

    sendSuccess(res, {
      reports: enriched,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Doctor completes clinical review and approves report.
 * Records doctor summary, medicine status, next test date, and unblocks patient view.
 */
export const handleReviewReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required to review reports');
    }

    const validated = reviewReportSchema.parse(req.body);

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';
    const userAgent = req.get('user-agent') || 'unknown';

    const updatedReport = await reviewAndApproveReport({
      reportId: req.params.id,
      userId: req.user.userId,
      summary: {
        text: validated.text,
        hindiText: validated.hindiText,
        tone: validated.tone,
        nextTestDate: validated.nextTestDate,
        medicinesStatus: validated.medicinesStatus,
        sentVia: validated.sentVia,
      },
      doctorNotes: validated.doctorNotes,
      ipAddress: ip,
      userAgent,
    });

    const serialized = serializeReport(updatedReport, 'doctor');

    sendSuccess(res, {
      report: serialized,
      message: 'Report reviewed and approved successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const transitionStatusSchema = z.object({
  reviewStatus: z.enum(['pending', 'in_review', 'approved']),
});

/**
 * Controller: Transitions report review status (pending -> in_review).
 */
export const handleTransitionReviewStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const { reviewStatus } = transitionStatusSchema.parse(req.body);

    const updated = await transitionReportReviewStatus(
      req.params.id,
      reviewStatus,
      req.user.userId
    );

    const serialized = serializeReport(updated, 'doctor');

    sendSuccess(res, {
      report: serialized,
      message: `Report status updated to ${reviewStatus}`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Explicitly marks report as viewed by doctor, clearing red critical alert warnings.
 */
export const handleMarkReportViewed = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const updated = await markReportAsViewed(
      req.params.id,
      req.user.userId,
      req.user.role
    );

    const serialized = serializeReport(updated, 'doctor');

    sendSuccess(res, {
      report: serialized,
      message: 'Report marked as viewed by doctor',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Retrieves longitudinal historical trends, deltas, unusual shifts,
 * and 90-day HbA1c trajectory forecast for a patient.
 */
export const handleGetPatientTrends = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    let targetPatientId = req.params.patientId;

    if (!targetPatientId && req.user.role === 'patient') {
      const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: req.user.userId } });
      if (!patientProfile) {
        throw new BadRequestError('Patient profile not found');
      }
      targetPatientId = patientProfile.id;
    }

    if (!targetPatientId) {
      throw new BadRequestError('patientId is required');
    }

    const trendsData = await getPatientHistoricalTrends(
      targetPatientId,
      req.user.userId,
      req.user.role
    );

    sendSuccess(res, trendsData);
  } catch (err) {
    next(err);
  }
};
