import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import {
  handleCreatePrescription,
  handleGetPrescriptions,
  handleRevokePrescription,
} from '../controllers/prescriptionController';

const router = Router();

// Create new prescription (doctor only)
router.post('/', authenticate, requireRole('doctor'), handleCreatePrescription);

// Get active / ended prescriptions (doctor or patient)
router.get('/', authenticate, handleGetPrescriptions);

// Revoke prescription in between time period (doctor only)
router.post('/:id/revoke', authenticate, requireRole('doctor'), handleRevokePrescription);
router.put('/:id/revoke', authenticate, requireRole('doctor'), handleRevokePrescription);

export default router;
