import { Router } from 'express';
import {
  handleSendConnectionRequest,
  handleGetPendingRequests,
  handleApproveConnection,
  handleRejectConnection,
  handleVerifyDoctorConnectCode,
  handleRevokeDoctorConnectionByPatient,
  handleRevokeConnectionByDoctor,
  handleGetPatientConnections,
  handleGetDoctorPendingRequests,
  handleGeneratePatientConnectCode,
} from '../controllers/connectionController';
import {
  authenticate,
  requireRole,
  requireVerifiedDoctor,
} from '../middlewares/auth';
import { connectionRateLimiter } from '../middlewares/security';

const router = Router();

// ─── Patient Endpoints ─────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/connections/my:
 *   get:
 *     summary: Get patient's active connected doctors
 *     tags: [Connections]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of connected doctors
 */
router.get('/my', authenticate, requireRole('patient'), handleGetPatientConnections);

/**
 * @openapi
 * /api/v1/connections/patient/pending:
 *   get:
 *     summary: Get pending connection requests from doctors for the patient
 *     tags: [Connections]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of pending connection requests
 */
router.get('/patient/pending', authenticate, requireRole('patient'), handleGetPendingRequests);

/**
 * @openapi
 * /api/v1/connections/patient/approve:
 *   post:
 *     summary: Patient approves a pending connection request and receives a 2-minute verification code
 *     tags: [Connections]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [connectionId]
 *             properties:
 *               connectionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connection approved, 6-digit code returned (valid 2 minutes)
 */
router.post(
  '/patient/approve',
  authenticate,
  requireRole('patient'),
  connectionRateLimiter,
  handleApproveConnection
);

/**
 * @openapi
 * /api/v1/connections/patient/reject:
 *   post:
 *     summary: Patient rejects a pending connection request
 *     tags: [Connections]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [connectionId]
 *             properties:
 *               connectionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connection request rejected
 */
router.post(
  '/patient/reject',
  authenticate,
  requireRole('patient'),
  handleRejectConnection
);

/**
 * @openapi
 * /api/v1/connections/patient/generate-code:
 *   post:
 *     summary: Patient generates a standalone 6-digit connect code (legacy)
 *     tags: [Connections]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: 6-digit code generated, valid for 2 minutes
 */
router.post(
  '/patient/generate-code',
  authenticate,
  requireRole('patient'),
  connectionRateLimiter,
  handleGeneratePatientConnectCode
);

/**
 * @openapi
 * /api/v1/connections/patient/revoke/{doctorId}:
 *   post:
 *     summary: Patient revokes an active doctor connection
 *     tags: [Connections]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Doctor connection revoked
 */
router.post(
  '/patient/revoke/:doctorId',
  authenticate,
  requireRole('patient'),
  handleRevokeDoctorConnectionByPatient
);

// ─── Doctor Endpoints ──────────────────────────────────────────────────────

/**
 * @openapi
 * /api/v1/connections/doctor/request:
 *   post:
 *     summary: Doctor sends a connection request to a patient by RS ID
 *     tags: [Connections]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rsId]
 *             properties:
 *               rsId:
 *                 type: string
 *                 example: "RS-10475"
 *     responses:
 *       200:
 *         description: Connection request sent, awaiting patient approval
 */
router.post(
  '/doctor/request',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  connectionRateLimiter,
  handleSendConnectionRequest
);

// Keep old /doctor/request-vcode as alias
router.post(
  '/doctor/request-vcode',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  connectionRateLimiter,
  handleSendConnectionRequest
);

/**
 * @openapi
 * /api/v1/connections/doctor/pending:
 *   get:
 *     summary: Doctor fetches their pending connection requests
 *     tags: [Connections]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of pending connection requests
 */
router.get(
  '/doctor/pending',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  handleGetDoctorPendingRequests
);

/**
 * @openapi
 * /api/v1/connections/doctor/verify-code:
 *   post:
 *     summary: Doctor verifies patient's 6-digit connect code to establish connection
 *     tags: [Connections]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientRsId, code]
 *             properties:
 *               patientRsId:
 *                 type: string
 *                 example: "RS-10475"
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Connection established
 */
router.post(
  '/doctor/verify-code',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  connectionRateLimiter,
  handleVerifyDoctorConnectCode
);

/**
 * @openapi
 * /api/v1/connections/doctor/revoke/{connectionId}:
 *   post:
 *     summary: Doctor revokes a connection
 *     tags: [Connections]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: connectionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection revoked
 */
router.post(
  '/doctor/revoke/:connectionId',
  authenticate,
  requireRole('doctor'),
  requireVerifiedDoctor,
  handleRevokeConnectionByDoctor
);

export default router;
