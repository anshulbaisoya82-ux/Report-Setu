import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { uploadSingleReport, validateUploadedDocument } from '../middlewares/upload';
import {
  handleGetOwnFoodRules,
  handleGetPatientFoodRules,
  handleSetPatientFoodRules,
  handleReadFoodLabel,
} from '../controllers/foodRulesController';

const router = Router();

// Patient: rules their doctor set
router.get('/me', authenticate, requireRole('patient'), handleGetOwnFoodRules);

// Patient: read a food-label photo (field name "file", JPG/PNG, max 10 MB). Photo is not stored.
router.post('/read-label', authenticate, requireRole('patient'), uploadSingleReport, validateUploadedDocument, handleReadFoodLabel);

// Doctor: view / set a connected patient's rules
router.get('/patient/:patientId', authenticate, requireRole('doctor'), handleGetPatientFoodRules);
router.put('/patient/:patientId', authenticate, requireRole('doctor'), handleSetPatientFoodRules);

export default router;
