import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { uploadSingleReport, validateUploadedDocument } from '../middlewares/upload';
import {
  handleUploadReport,
  handleConfirmReport,
  handleGetReportById,
  handleGetPatientReports,
  handleGetDoctorInbox,
  handleReviewReport,
  handleTransitionReviewStatus,
  handleMarkReportViewed,
  handleGetPatientTrends,
} from '../controllers/reportController';
import {
  generateReportAiOverview,
  generateDraftSummary,
} from '../controllers/doctorAiController';

const router = Router();

// Doctor inbox with urgent review ranking score (placed before :id route)
router.get('/doctor/inbox', authenticate, handleGetDoctorInbox);

// Trends for current authenticated patient
router.get('/trends', authenticate, handleGetPatientTrends);

// Trends for specific patient (doctor or patient)
router.get('/patient/:patientId/trends', authenticate, handleGetPatientTrends);

// Upload and analyze a lab report
router.post(
  '/upload',
  authenticate,
  uploadSingleReport,
  validateUploadedDocument,
  handleUploadReport
);

// Patient confirms or corrects extracted parameters
router.put('/:id/confirm', authenticate, handleConfirmReport);

// Doctor reviews and approves report
router.put('/:id/review', authenticate, handleReviewReport);

// AI Overview & Clinical Findings for doctors
router.post('/:id/ai-overview', authenticate, generateReportAiOverview);

// Patient-friendly summary draft generator in English & Hindi
router.post('/:id/generate-draft', authenticate, generateDraftSummary);

// Doctor updates review status (e.g. pending -> in_review)
router.put('/:id/status', authenticate, handleTransitionReviewStatus);

// Doctor marks report as viewed (clearing critical red alerts)
router.post('/:id/view', authenticate, handleMarkReportViewed);

// Get a single report by ID
router.get('/:id', authenticate, handleGetReportById);

// Get all reports for a specific patient
router.get('/patient/:patientId', authenticate, handleGetPatientReports);

// Get current patient's own reports
router.get('/', authenticate, handleGetPatientReports);

export default router;
