import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { exportPatientData, deletePatientAccount } from '../controllers/privacyController';

const router = Router();

// GDPR / DPDP Patient Data Export
router.get('/export', authenticate, requireRole('patient'), exportPatientData);

// Right to be forgotten / Account Erasure
router.delete('/account', authenticate, requireRole('patient'), deletePatientAccount);

export default router;
