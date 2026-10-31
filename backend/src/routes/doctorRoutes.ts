import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import {
  handleGetDoctorPatients,
  handleAddDoctorPrivateNote,
  handleGetDoctorPrivateNotes,
  handleUpdatePatientPriority,
} from '../controllers/doctorController';
import {
  searchDoctorCopilot,
  generateSuggestedReply,
} from '../controllers/doctorAiController';
import {
  getDoctorProfile,
  updateDoctorProfile,
} from '../controllers/doctorProfileController';

const router = Router();

// Doctor Profile & Practitioner Credentials
router.get('/profile', authenticate, requireRole('doctor'), getDoctorProfile);
router.put('/profile', authenticate, requireRole('doctor'), updateDoctorProfile);

// Doctor Copilot search across connected patients
router.get('/copilot/search', authenticate, requireRole('doctor'), searchDoctorCopilot);

// Suggested reply generator for patient question thread
router.post('/threads/:id/suggest-reply', authenticate, requireRole('doctor'), generateSuggestedReply);

// Doctor patient directory with triage prioritization and search filters
router.get('/patients', authenticate, requireRole('doctor'), handleGetDoctorPatients);

// Doctor private notes and clinical annotations (isolated from patient view)
router.post(
  '/patients/:id/private-notes',
  authenticate,
  requireRole('doctor'),
  handleAddDoctorPrivateNote
);
router.get(
  '/patients/:id/private-notes',
  authenticate,
  requireRole('doctor'),
  handleGetDoctorPrivateNotes
);
router.put(
  '/patients/:id/priority',
  authenticate,
  requireRole('doctor'),
  handleUpdatePatientPriority
);

export default router;
