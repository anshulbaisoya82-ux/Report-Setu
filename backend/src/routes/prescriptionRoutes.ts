import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import {
  handleCreatePrescription,
  handleGetPrescriptions,
  handleSuggestMedicines,
} from '../controllers/prescriptionController';

const router = Router();

// Medicine-name suggestions while typing (doctor only; proxies ML /drug/suggest)
router.get('/medicine-suggestions', authenticate, requireRole('doctor'), handleSuggestMedicines);

// Create new prescription (doctor only)
router.post('/', authenticate, requireRole('doctor'), handleCreatePrescription);

// Get active / ended prescriptions (doctor or patient)
router.get('/', authenticate, handleGetPrescriptions);

export default router;
