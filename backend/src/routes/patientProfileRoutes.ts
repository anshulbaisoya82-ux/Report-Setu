import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { updatePatientProfile } from '../controllers/patientProfileController';

const router = Router();

router.put('/profile', authenticate, requireRole('patient'), updatePatientProfile);

export default router;
