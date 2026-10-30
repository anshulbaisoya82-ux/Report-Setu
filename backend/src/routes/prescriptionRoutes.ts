import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import {
  handleCreatePrescription,
  handleGetPrescriptions,
} from '../controllers/prescriptionController';

const router = Router();

// Create new prescription (doctor only)
router.post('/', authenticate, requireRole('doctor'), handleCreatePrescription);

// Get active / ended prescriptions (doctor or patient)
router.get('/', authenticate, handleGetPrescriptions);

export default router;
