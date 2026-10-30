import { Report, IReport, ILabParameter, ReportCategory, ReportStatus, ParameterStatus } from '../repositories';
import { PatientProfile, IPatientProfile } from '../repositories';
import { DoctorProfile, IDoctorProfile } from '../repositories';
import { Connection } from '../repositories';
import { Notification } from '../repositories';
import { ReportAnalyzer, ReportAnalysisResult } from './reportAnalyzer';
import { clinicalEvaluator } from './clinicalEvaluator';
import { recordAudit } from './auditService';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
type UserRoleType = 'patient' | 'doctor' | 'admin';

const reportAnalyzer = new ReportAnalyzer();

export interface UploadReportParams {
  fileBuffer: Buffer;
  filename: string;
  mimeType: string;
  fileSize: number;
  userId: string;
  userRole: UserRoleType;
  patientId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ConfirmParameterInput {
  id?: string;
  name: string;
  value: number;
  unit?: string;
  referenceRange?: string;
}

export interface ConfirmReportParams {
  reportId: string;
  parameters: ConfirmParameterInput[];
  collectionDate?: string;
  labName?: string;
  name?: string;
  category?: ReportCategory;
  userId: string;
  userRole: UserRoleType;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Creates notifications for all actively connected doctors when critical parameters are detected.
 */
export async function notifyConnectedDoctorsOfCriticalReport(
  patientProfile: IPatientProfile,
  report: IReport,
  criticalParams: ILabParameter[]
): Promise<void> {
  const activeConnections = await Connection.find({
    patientId: patientProfile._id,
    status: 'active',
  });

  for (const conn of activeConnections) {
    const doctor = await DoctorProfile.findById(conn.doctorId);
    if (!doctor) continue;

    await Notification.create({
      userId: doctor.userId,
      type: 'critical_alert',
      title: 'Critical Lab Alert',
      message: `Critical parameter(s) detected for patient ${patientProfile.name} in report ${report.name}`,
      data: {
        reportId: report._id,
        patientId: patientProfile._id,
        patientName: patientProfile.name,
        reportName: report.name,
        criticalParameters: criticalParams.map((p: any) => ({
          name: p.name,
          value: p.value,
          unit: p.unit,
          status: p.status,
        })),
      },
      isRead: false,
    });
  }
}

/**
 * Core Service: Handles file upload, ML & OCR extraction, clinical evaluation,
 * and initial report persistence.
 */
export async function uploadAndAnalyzeReport(
  params: UploadReportParams
): Promise<{ report: IReport; analysis: ReportAnalysisResult }> {
  // 1. Resolve Patient Profile
  let patientProfile: IPatientProfile | null = null;

  if (params.userRole === 'patient') {
    patientProfile = await PatientProfile.findOne({ userId: params.userId });
    if (!patientProfile) {
      throw new NotFoundError('Patient profile not found for authenticated user');
    }
  } else if (params.userRole === 'doctor') {
    if (!params.patientId) {
      throw new BadRequestError('patientId is required for doctor uploads');
    }
    const doctorProfile = await DoctorProfile.findOne({ userId: params.userId });
    if (!doctorProfile) {
      throw new NotFoundError('Doctor profile not found for authenticated user');
    }
    patientProfile = await PatientProfile.findById(params.patientId);
    if (!patientProfile) {
      throw new NotFoundError('Patient not found');
    }

    // Verify active connection
    const activeConnection = await Connection.findOne({
      doctorId: doctorProfile._id,
      patientId: patientProfile._id,
      status: 'active',
    });
    if (!activeConnection) {
      throw new ForbiddenError('Active connection with patient is required to upload reports');
    }
  } else if (params.userRole === 'admin') {
    if (!params.patientId) {
      throw new BadRequestError('patientId is required for admin uploads');
    }
    patientProfile = await PatientProfile.findById(params.patientId);
    if (!patientProfile) {
      throw new NotFoundError('Patient not found');
    }
  } else {
    throw new ForbiddenError('Unauthorized to upload reports');
  }

  // 2. Perform Extraction & Analysis via ReportAnalyzer (with ML fallback)
  const analysis = await reportAnalyzer.analyzeReport(
    params.fileBuffer,
    params.filename,
    params.mimeType
  );

  // 3. Map & Deterministically Evaluate Clinical Parameters
  const evaluatedParameters: ILabParameter[] = analysis.parameters.map((param, index) => {
    const evalResult = clinicalEvaluator.evaluateParameter(
      param.name,
      param.value,
      param.referenceRange,
      param.unit
    );

    return {
      id: param.id || `param-${index + 1}`,
      name: param.name,
      value: param.value,
      unit: param.unit || '',
      referenceRange: param.referenceRange || '',
      status: evalResult.status,
      change: param.change,
      trendDirection: param.trendDirection,
      explanation: evalResult.explanation || param.explanation,
      whatItMeans: evalResult.whatItMeans || param.whatItMeans,
      pointsToConsider: evalResult.pointsToConsider || param.pointsToConsider,
      originalValue: param.value,
      correctedValue: undefined,
      isEdited: false,
    };
  });

  // 4. Compute Overall Report Severity Status
  const overallStatus = clinicalEvaluator.computeOverallReportStatus(evaluatedParameters);

  // 5. Generate Key Findings and Overview
  const abnormalParameters = evaluatedParameters.filter((p: any) => p.status !== 'Normal');
  const criticalParameters = evaluatedParameters.filter((p: any) => p.status === 'Critical');

  const keyFindings = abnormalParameters.map((p: any) => ({
    parameter: p.name,
    value: String(p.value),
    unit: p.unit,
    tag: p.status,
    changeText: p.change || (p.status === 'High' ? 'Above normal' : p.status === 'Low' ? 'Below normal' : 'Critical variance'),
  }));

  const pointsToConsider: string[] = [];
  if (criticalParameters.length > 0) {
    pointsToConsider.push(
      `Urgent review required: ${criticalParameters.length} parameter(s) in critical range.`
    );
  }
  if (abnormalParameters.length > 0) {
    pointsToConsider.push(
      `${abnormalParameters.length} parameter(s) require clinical correlation with symptoms.`
    );
  } else {
    pointsToConsider.push('All evaluated parameters are currently within normal reference intervals.');
  }

  const aiOverview = {
    summary: `${analysis.reportType} from ${analysis.labName}. Detected ${evaluatedParameters.length} parameters, ${abnormalParameters.length} outside standard biological limits.`,
    pointsToConsider,
    keyFindings,
    generatedAt: new Date(),
  };

  // 6. Persist the report in PostgreSQL
  const report = await Report.create({
    patientId: patientProfile._id,
    patientName: patientProfile.name,
    patientAvatar: patientProfile.avatar || '',
    name: analysis.reportType,
    category: analysis.category,
    labName: analysis.labName,
    collectionDate: analysis.collectionDate ? new Date(analysis.collectionDate) : new Date(),
    reportedDate: new Date(),
    specimen: analysis.specimen,
    status: overallStatus,
    reviewStatus: 'pending',
    reviewed: false,
    parameters: evaluatedParameters,
    aiOverview,
    rawFile: {
      filename: params.filename,
      mimeType: params.mimeType,
      sizeBytes: params.fileSize,
      isConfirmed: false,
      submittedToDoctor: false,
    },
  });

  await report.save();

  // Audit Logging (Draft report created, waiting for patient confirmation)
  recordAudit({
    userId: params.userId,
    userRole: params.userRole,
    action: 'REPORT_CREATE',
    resourceType: 'Report',
    resourceId: report._id.toString(),
    patientId: patientProfile._id,
    purpose: 'Patient lab report upload and extraction',
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      reportType: analysis.reportType,
      category: analysis.category,
      parameterCount: evaluatedParameters.length,
      overallStatus,
    },
  });

  return { report, analysis };
}

/**
 * Core Service: Patient confirms and optionally corrects extracted report values.
 * Preserves originalValue, correctedValue, and sets isEdited flag.
 * Recalculates overall status and fires critical alerts if needed.
 */
export async function confirmReportParameters(
  params: ConfirmReportParams
): Promise<IReport> {
  const report = await Report.findById(params.reportId);
  if (!report) {
    throw new NotFoundError('Report not found');
  }

  // Verify access permissions
  let patientProfile: IPatientProfile | null = null;
  if (params.userRole === 'patient') {
    patientProfile = await PatientProfile.findOne({ userId: params.userId });
    if (!patientProfile || report.patientId.toString() !== patientProfile._id.toString()) {
      throw new ForbiddenError('Access denied: You can only confirm your own reports');
    }
  } else if (params.userRole === 'doctor') {
    const doctorProfile = await DoctorProfile.findOne({ userId: params.userId });
    if (!doctorProfile) {
      throw new ForbiddenError('Doctor profile not found');
    }
    const hasConnection = await Connection.findOne({
      doctorId: doctorProfile._id,
      patientId: report.patientId,
      status: 'active',
    });
    if (!hasConnection) {
      throw new ForbiddenError('Access denied: No active connection with patient');
    }
    patientProfile = await PatientProfile.findById(report.patientId);
  } else if (params.userRole === 'admin') {
    patientProfile = await PatientProfile.findById(report.patientId);
  } else {
    throw new ForbiddenError('Unauthorized to update report');
  }

  // 1. Process parameter updates & preserve audit fields
  const updatedParameters: ILabParameter[] = [];

  for (const input of params.parameters) {
    // Try to match existing parameter by ID or by normalized name
    const existing = report.parameters.find(
      (p: any) =>
        (input.id && p.id === input.id) ||
        p.name.trim().toLowerCase() === input.name.trim().toLowerCase()
    );

    const val = Number(input.value);
    const unit = input.unit !== undefined ? input.unit : existing ? existing.unit : '';
    const refRange =
      input.referenceRange !== undefined ? input.referenceRange : existing ? existing.referenceRange : '';

    const evalResult = clinicalEvaluator.evaluateParameter(input.name, val, refRange, unit);

    if (existing) {
      const original = existing.originalValue !== undefined ? existing.originalValue : existing.value;
      const isChanged = original !== val;

      updatedParameters.push({
        id: existing.id,
        name: input.name || existing.name,
        value: val,
        unit,
        referenceRange: refRange,
        status: evalResult.status,
        change: existing.change,
        trendDirection: existing.trendDirection,
        explanation: evalResult.explanation || existing.explanation,
        whatItMeans: evalResult.whatItMeans || existing.whatItMeans,
        pointsToConsider: evalResult.pointsToConsider || existing.pointsToConsider,
        originalValue: original,
        correctedValue: isChanged ? val : existing.correctedValue,
        isEdited: isChanged || existing.isEdited,
      });
    } else {
      // User added a brand new parameter
      updatedParameters.push({
        id: input.id || `param-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: input.name,
        value: val,
        unit,
        referenceRange: refRange,
        status: evalResult.status,
        explanation: evalResult.explanation,
        whatItMeans: evalResult.whatItMeans,
        pointsToConsider: evalResult.pointsToConsider,
        originalValue: val,
        correctedValue: val,
        isEdited: true,
      });
    }
  }

  report.parameters = updatedParameters;

  // 2. Recalculate Overall Report Severity Status
  const newOverallStatus = clinicalEvaluator.computeOverallReportStatus(updatedParameters);
  report.status = newOverallStatus;

  // 3. Optional metadata updates
  if (params.collectionDate) {
    report.collectionDate = new Date(params.collectionDate);
  }
  if (params.labName) {
    report.labName = params.labName;
  }
  if (params.name) {
    report.name = params.name;
  }
  if (params.category) {
    report.category = params.category;
  }

  // 4. Mark report as confirmed and submitted to doctor
  report.rawFile = {
    ...((report.rawFile as any) || {}),
    isConfirmed: true,
    submittedToDoctor: true,
    submittedAt: new Date().toISOString(),
  };

  await report.save();

  // 5. Update PatientProfile last report timestamp & name
  if (patientProfile) {
    await PatientProfile.findByIdAndUpdate(patientProfile._id, {
      lastReportTime: new Date().toISOString(),
      lastReportName: report.name,
    });
  }

  // 6. Notify connected doctors of submission / critical alerts
  const criticalParams = updatedParameters.filter((p: any) => p.status === 'Critical');
  if (patientProfile) {
    if (newOverallStatus === 'Critical' || criticalParams.length > 0) {
      await notifyConnectedDoctorsOfCriticalReport(patientProfile, report, criticalParams);
    } else {
      // Standard notification for doctor's review queue
      const activeConnections = await Connection.find({
        patientId: patientProfile._id,
        status: 'active',
      });
      for (const conn of activeConnections) {
        const doctor = await DoctorProfile.findById(conn.doctorId);
        if (!doctor) continue;
        await Notification.create({
          userId: doctor.userId,
          type: 'report_received',
          title: 'Lab Report Submitted',
          message: `${patientProfile.name} submitted a new ${report.name} report for review`,
          data: {
            reportId: report._id,
            patientId: patientProfile._id,
            patientName: patientProfile.name,
            reportName: report.name,
          },
          isRead: false,
        });
      }
    }
  }

  // 5. Audit Logging
  recordAudit({
    userId: params.userId,
    userRole: params.userRole,
    action: 'REPORT_UPDATE',
    resourceType: 'Report',
    resourceId: report._id.toString(),
    patientId: report.patientId,
    purpose: 'Patient confirmation and value correction of lab report',
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      parameterCount: updatedParameters.length,
      editedCount: updatedParameters.filter((p: any) => p.isEdited).length,
      status: newOverallStatus,
    },
  });

  return report;
}

/**
 * Service: Retrieves a report by ID with role-based access validation.
 */
export async function getReportById(
  reportId: string,
  userId: string,
  userRole: UserRoleType
): Promise<IReport> {
  const report = await Report.findById(reportId);
  if (!report) {
    throw new NotFoundError('Report not found');
  }

  if (userRole === 'patient') {
    const patientProfile = await PatientProfile.findOne({ userId });
    if (!patientProfile || report.patientId.toString() !== patientProfile._id.toString()) {
      throw new ForbiddenError('Access denied: report does not belong to you');
    }
  } else if (userRole === 'doctor') {
    const doctorProfile = await DoctorProfile.findOne({ userId });
    if (!doctorProfile) {
      throw new ForbiddenError('Doctor profile not found');
    }
    const hasConnection = await Connection.findOne({
      doctorId: doctorProfile._id,
      patientId: report.patientId,
      status: 'active',
    });
    if (!hasConnection) {
      throw new ForbiddenError('Access denied: no active connection with patient');
    }

    // Doctor viewed this report: mark doctorViewed = true & transition pending to in_review
    const rawFile = (report.rawFile as any) || {};
    let shouldSave = false;
    if (!rawFile.doctorViewed) {
      rawFile.doctorViewed = true;
      rawFile.doctorViewedAt = new Date().toISOString();
      report.rawFile = rawFile;
      shouldSave = true;
    }
    if (report.reviewStatus === 'pending') {
      report.reviewStatus = 'in_review';
      shouldSave = true;
    }
    if (shouldSave) {
      await report.save();
    }

    // Mark any unread critical/review notifications for this doctor as read
    try {
      const unreadNotifs = await Notification.find({ userId, isRead: false });
      for (const notif of unreadNotifs) {
        const data = notif.data as any;
        if (data && (data.reportId === report._id?.toString() || data.reportId === report.id)) {
          await Notification.findByIdAndUpdate(notif._id, { isRead: true });
        }
      }
    } catch {
      // Non-fatal
    }
  }

  return report;
}

/**
 * Service: Retrieves all reports for a patient with role-based validation.
 */
export async function getPatientReports(
  patientId: string,
  userId: string,
  userRole: UserRoleType,
  category?: string
): Promise<IReport[]> {
  if (userRole === 'patient') {
    const patientProfile = await PatientProfile.findOne({ userId });
    if (!patientProfile || patientProfile._id.toString() !== patientId) {
      throw new ForbiddenError('Access denied: you can only view your own reports');
    }
  } else if (userRole === 'doctor') {
    const doctorProfile = await DoctorProfile.findOne({ userId });
    if (!doctorProfile) {
      throw new ForbiddenError('Doctor profile not found');
    }
    const hasConnection = await Connection.findOne({
      doctorId: doctorProfile._id,
      patientId: patientId,
      status: 'active',
    });
    if (!hasConnection) {
      throw new ForbiddenError('Access denied: no active connection with patient');
    }
  }

  const query: any = { patientId: patientId };
  if (category) {
    query.category = category;
  }

  const reports = await Report.find(query).sort({ collectionDate: -1 });

  // Doctors only see reports confirmed & submitted by the patient
  if (userRole === 'doctor') {
    return reports.filter((r: any) => {
      const raw = r.rawFile as any;
      if (raw && (raw.isConfirmed === false || raw.submittedToDoctor === false)) {
        return false;
      }
      return true;
    });
  }

  return reports;
}

export interface DoctorInboxFilterOptions {
  status?: string;
  reviewStatus?: string;
  category?: string;
  limit?: number;
  page?: number;
}

export interface ReportWithUrgency extends IReport {
  urgencyScore: number;
}

/**
 * Service: Retrieves reports for all actively connected patients, ranked by urgency.
 * Urgent Review Ranking Score prioritizes Critical clinical status, unreviewed state, and waiting time.
 */
export async function getDoctorInbox(
  userId: string,
  options: DoctorInboxFilterOptions = {}
): Promise<{ reports: (IReport & { urgencyScore: number })[]; total: number }> {
  const doctorProfile = await DoctorProfile.findOne({ userId });
  if (!doctorProfile) {
    throw new ForbiddenError('Doctor profile not found for authenticated user');
  }

  // Find all active connections for this doctor
  const activeConnections = await Connection.find({
    doctorId: doctorProfile._id,
    status: 'active',
  });

  const patientIds = activeConnections.map((c: any) => c.patientId);
  if (patientIds.length === 0) {
    return { reports: [], total: 0 };
  }

  const query: any = { patientId: { $in: patientIds } };

  if (options.status) {
    query.status = options.status;
  }
  if (options.reviewStatus === 'approved') {
    query.reviewStatus = 'approved';
  } else if (options.reviewStatus === 'pending') {
    query.reviewStatus = { $in: ['pending', 'in_review'] };
    query.reviewed = false;
  } else if (options.reviewStatus === 'all') {
    // Return all submitted reports
  } else if (options.reviewStatus) {
    query.reviewStatus = options.reviewStatus;
  }
  if (options.category) {
    query.category = options.category;
  }

  const reports = await Report.find(query).lean();

  // Doctors only see reports confirmed and submitted by the patient
  const submittedReports = reports.filter((r: any) => {
    const raw = r.rawFile as any;
    if (raw && (raw.isConfirmed === false || raw.submittedToDoctor === false)) {
      return false;
    }
    return true;
  });

  // Compute urgent review ranking score
  const reportsWithUrgency = submittedReports.map((r: any) => {
    let baseSeverity = 100;
    if (r.status === 'Critical') baseSeverity = 1000;
    else if (r.status === 'Unbalanced') baseSeverity = 500;

    let reviewBonus = 0;
    if (r.reviewStatus === 'pending') reviewBonus = 250;
    else if (r.reviewStatus === 'in_review') reviewBonus = 100;

    const waitHours = Math.max(
      0,
      Math.floor((Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60))
    );
    const timePenalty = Math.min(200, waitHours * 2);

    const urgencyScore = baseSeverity + reviewBonus + timePenalty;

    return {
      ...r,
      urgencyScore,
    };
  });

  // Sort descending by urgency score
  reportsWithUrgency.sort((a: any, b: any) => b.urgencyScore - a.urgencyScore);

  const total = reportsWithUrgency.length;
  const page = options.page || 1;
  const limit = options.limit || 50;
  const startIndex = (page - 1) * limit;
  const paginated = reportsWithUrgency.slice(startIndex, startIndex + limit);

  return { reports: paginated as any, total };
}

export interface ReviewReportParams {
  reportId: string;
  userId: string;
  summary: {
    text: string;
    hindiText?: string;
    tone?: 'Plain language' | 'More detail' | 'Brief';
    nextTestDate?: string;
    medicinesStatus?: 'No change' | 'Changed';
    sentVia?: ('App' | 'SMS' | 'Email')[];
  };
  doctorNotes?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Service: Doctor reviews and approves lab report with summary and instructions.
 * Transitions state machine to 'approved' and unblocks patient view of summary & AI overview.
 */
export async function reviewAndApproveReport(
  params: ReviewReportParams
): Promise<IReport> {
  const doctorProfile = await DoctorProfile.findOne({ userId: params.userId });
  if (!doctorProfile) {
    throw new ForbiddenError('Doctor profile not found');
  }

  const report = await Report.findById(params.reportId);
  if (!report) {
    throw new NotFoundError('Report not found');
  }

  // Verify active connection
  const hasConnection = await Connection.findOne({
    doctorId: doctorProfile._id,
    patientId: report.patientId,
    status: 'active',
  });
  if (!hasConnection) {
    throw new ForbiddenError('Active connection required to review patient reports');
  }

  // State Transition: Set to approved
  report.reviewStatus = 'approved';
  report.reviewed = true;
  report.reviewedAt = new Date();
  report.reviewedBy = doctorProfile._id;

  const rawFile = (report.rawFile as any) || {};
  rawFile.doctorViewed = true;
  rawFile.doctorViewedAt = rawFile.doctorViewedAt || new Date().toISOString();
  report.rawFile = rawFile;

  report.doctorSummary = {
    text: params.summary.text,
    hindiText: params.summary.hindiText,
    tone: params.summary.tone || 'Plain language',
    approvedAt: new Date(),
    doctorName: doctorProfile.name,
    nextTestDate: params.summary.nextTestDate,
    medicinesStatus: params.summary.medicinesStatus || 'No change',
    sentVia: params.summary.sentVia || ['App'],
  };

  if (params.doctorNotes !== undefined) {
    report.doctorNotes = params.doctorNotes;
  }

  await report.save();

  // Create patient notification
  const patientProfile = await PatientProfile.findById(report.patientId);
  if (patientProfile) {
    await Notification.create({
      userId: patientProfile.userId,
      type: 'report_reviewed',
      title: 'Report Reviewed by Doctor',
      message: `${doctorProfile.name} has reviewed your lab report: ${report.name}`,
      data: {
        reportId: report._id,
        doctorId: doctorProfile._id,
        doctorName: doctorProfile.name,
        reviewStatus: 'approved',
      },
      isRead: false,
    });
  }

  // Audit Log
  recordAudit({
    userId: params.userId,
    userRole: 'doctor',
    action: 'REPORT_UPDATE',
    resourceType: 'Report',
    resourceId: report._id.toString(),
    patientId: report.patientId,
    purpose: 'Doctor completed clinical review and approved report',
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    metadata: {
      reportId: report._id.toString(),
      medicinesStatus: params.summary.medicinesStatus,
      nextTestDate: params.summary.nextTestDate,
    },
  });

  return report;
}

/**
 * Service: Transitions report review status (e.g. from 'pending' to 'in_review').
 */
export async function transitionReportReviewStatus(
  reportId: string,
  newReviewStatus: 'pending' | 'in_review' | 'approved',
  userId: string
): Promise<IReport> {
  const doctorProfile = await DoctorProfile.findOne({ userId });
  if (!doctorProfile) {
    throw new ForbiddenError('Doctor profile not found');
  }

  const report = await Report.findById(reportId);
  if (!report) {
    throw new NotFoundError('Report not found');
  }

  const hasConnection = await Connection.findOne({
    doctorId: doctorProfile._id,
    patientId: report.patientId,
    status: 'active',
  });
  if (!hasConnection) {
    throw new ForbiddenError('Active connection required to update review status');
  }

  report.reviewStatus = newReviewStatus;
  if (newReviewStatus === 'approved') {
    report.reviewed = true;
    report.reviewedAt = new Date();
    report.reviewedBy = doctorProfile._id;
  } else {
    report.reviewed = false;
  }

  await report.save();
  return report;
}

/**
 * Service: Explicitly mark report as viewed by doctor, transitioning from pending to in_review
 * and clearing critical red alert warnings.
 */
export async function markReportAsViewed(
  reportId: string,
  userId: string,
  userRole: UserRoleType
): Promise<IReport> {
  const report = await Report.findById(reportId);
  if (!report) {
    throw new NotFoundError('Report not found');
  }

  if (userRole !== 'doctor' && userRole !== 'admin') {
    throw new ForbiddenError('Only doctors can mark reports as viewed');
  }

  const rawFile = (report.rawFile as any) || {};
  rawFile.doctorViewed = true;
  rawFile.doctorViewedAt = new Date().toISOString();
  report.rawFile = rawFile;

  if (report.reviewStatus === 'pending') {
    report.reviewStatus = 'in_review';
  }

  await report.save();

  // Clear unread notifications for this doctor regarding this report
  try {
    const unreadNotifs = await Notification.find({ userId, isRead: false });
    for (const notif of unreadNotifs) {
      const data = notif.data as any;
      if (data && (data.reportId === report._id?.toString() || data.reportId === report.id)) {
        await Notification.findByIdAndUpdate(notif._id, { isRead: true });
      }
    }
  } catch {
    // Non-fatal
  }

  return report;
}
