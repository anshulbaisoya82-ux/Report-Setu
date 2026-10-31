import { Router } from 'express';
import {
  handleSendPatientOtp,
  handleVerifyPatientOtp,
  handleDoctorSignup,
  handleDoctorLogin,
  handleRefreshToken,
  handleLogout,
  handleLogoutAll,
} from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { otpRateLimiter, authRateLimiter } from '../middlewares/security';

const router = Router();

/**
 * @openapi
 * /api/v1/auth/patient/send-otp:
 *   post:
 *     summary: Request 6-digit SMS OTP for patient authentication
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+919876543210"
 *     responses:
 *       200:
 *         description: OTP dispatched successfully
 *       400:
 *         description: Invalid phone number
 */
router.post('/patient/send-otp', otpRateLimiter, handleSendPatientOtp);

/**
 * @openapi
 * /api/v1/auth/patient/verify-otp:
 *   post:
 *     summary: Verify 6-digit SMS OTP and return tokens
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+919876543210"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Verified successfully, JWT accessToken and user returned
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/patient/verify-otp', otpRateLimiter, handleVerifyPatientOtp);

/**
 * @openapi
 * /api/v1/auth/doctor/signup:
 *   post:
 *     summary: Register a new medical doctor account awaiting verification
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - phone
 *               - registrationNumber
 *               - medicalCouncil
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Dr. Priya Mehta"
 *               email:
 *                 type: string
 *                 example: "priya.mehta@clinic.com"
 *               phone:
 *                 type: string
 *                 example: "+919876543210"
 *               registrationNumber:
 *                 type: string
 *                 example: "DMC-2024-8891"
 *               medicalCouncil:
 *                 type: string
 *                 example: "Delhi Medical Council"
 *               specialty:
 *                 type: string
 *                 example: "General Physician"
 *               clinic:
 *                 type: string
 *                 example: "Apollo Clinic"
 *               password:
 *                 type: string
 *                 example: "SuperSecurePass123!"
 *     responses:
 *       201:
 *         description: Doctor registered with pending verification status
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email or registration number already registered
 */
router.post('/doctor/signup', authRateLimiter, handleDoctorSignup);

/**
 * @openapi
 * /api/v1/auth/doctor/login:
 *   post:
 *     summary: Authenticate medical doctor via email and password
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: "priya.mehta@clinic.com"
 *               password:
 *                 type: string
 *                 example: "SuperSecurePass123!"
 *     responses:
 *       200:
 *         description: Authenticated successfully, JWT accessToken and doctor profile returned
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials or account temporarily locked
 */
router.post('/doctor/login', authRateLimiter, handleDoctorLogin);

/**
 * @openapi
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Rotate refresh token, issue new access token and rotated refresh token
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Tokens successfully rotated
 *       401:
 *         description: Invalid or expired refresh token, or reuse detected
 */
router.post('/refresh-token', authRateLimiter, handleRefreshToken);
router.post('/refresh', authRateLimiter, handleRefreshToken);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     summary: Revoke current session refresh token and clear cookie
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', handleLogout);

/**
 * @openapi
 * /api/v1/auth/logout-all:
 *   post:
 *     summary: Revoke all active sessions for the user across all devices
 *     tags:
 *       - Authentication
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All active sessions revoked
 *       401:
 *         description: Authentication required
 */
router.post('/logout-all', authenticate, handleLogoutAll);

export default router;
