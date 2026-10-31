import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { getPatientProfile, updatePatientProfile } from '../controllers/patientProfileController';

const router = Router();

router.get('/profile', authenticate, requireRole('patient'), getPatientProfile);
router.put('/profile', authenticate, requireRole('patient'), updatePatientProfile);

export default router;
