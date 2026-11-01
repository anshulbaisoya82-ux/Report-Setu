import { Router } from 'express';
import {
  handleAdminLogin,
  handleAdminVerifySession,
  handleGetAdminStats,
  handleGetTelemetry,
  handleGetDoctors,
  handleVerifyDoctor,
  handleRejectDoctor,
  handleVerifyAllPendingDoctors,
  handleGetPatients,
  handleTogglePatientStatus,
  handleGetMedicineStats,
  handleClearMedicineCache,
  handleCreateCustomMedicine,
  handleGetAuditLogs,
  handleGetSystemConfig,
  handleUpdateSystemConfig,
} from '../controllers/adminController';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

/**
 * Public Authentication Route: Admin Security Vault Gateway
 */
router.post('/auth/login', handleAdminLogin);
router.post('/login', handleAdminLogin); // Alias

/**
 * Middleware chain for all administrative command routes:
 * Requires verified Root Admin JWT or developer security header key
 */
router.use(authenticate, requireAdmin);

/**
 * Session verification
 */
router.get('/auth/verify', handleAdminVerifySession);

/**
 * High-Tech System Telemetry & Microservices Health
 */
router.get('/telemetry', handleGetTelemetry);

/**
 * Platform Metrics & Counters
 */
router.get('/stats', handleGetAdminStats);

/**
 * Clinician Management & Medical Council Clearances
 */
router.get('/doctors', handleGetDoctors);
router.post('/doctors/verify-all', handleVerifyAllPendingDoctors);
router.post('/doctors/:id/verify', handleVerifyDoctor);
router.patch('/doctors/:id/verify', handleVerifyDoctor);
router.post('/doctors/:id/reject', handleRejectDoctor);

/**
 * Patient Health Registry & Access Controls
 */
router.get('/patients', handleGetPatients);
router.post('/patients/:id/toggle-status', handleTogglePatientStatus);

/**
 * National Medicine Formulary & Cache Controls
 */
router.get('/medicines/stats', handleGetMedicineStats);
router.post('/medicines/clear-cache', handleClearMedicineCache);
router.post('/medicines/custom', handleCreateCustomMedicine);

/**
 * Security Audit Trails
 */
router.get('/audit-logs', handleGetAuditLogs);

/**
 * Dynamic System Feature Flags & Operation Modes
 */
router.get('/config', handleGetSystemConfig);
router.post('/config', handleUpdateSystemConfig);

export default router;
