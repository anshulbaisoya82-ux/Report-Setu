import { Router } from 'express';
import {
  handleGetAdminStats,
  handleGetDoctors,
  handleVerifyDoctor,
  handleRejectDoctor,
  handleVerifyAllPendingDoctors,
} from '../controllers/adminController';
import { authenticate, requireAdmin } from '../middlewares/auth';

const router = Router();

// Middleware chain for all admin routes: requires authenticated admin or dev admin key
router.use(authenticate, requireAdmin);

/**
 * Platform metrics and counts
 */
router.get('/stats', handleGetAdminStats);

/**
 * List all doctors with status filter and search query
 */
router.get('/doctors', handleGetDoctors);

/**
 * Batch verify all pending doctors
 */
router.post('/doctors/verify-all', handleVerifyAllPendingDoctors);

/**
 * Individual doctor verification and rejection
 */
router.post('/doctors/:id/verify', handleVerifyDoctor);
router.patch('/doctors/:id/verify', handleVerifyDoctor);
router.post('/doctors/:id/reject', handleRejectDoctor);

export default router;
