import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  handleGetTodaySchedule,
  handleRecordDoseAction,
  handleGetAdherenceMetrics,
} from '../controllers/medicationController';
import {
  handleSearchMedicines,
  handleGetMedicineDetails,
} from '../controllers/medicineSearchController';

const router = Router();

// Medicine search autocomplete & details (Fast, debounced, Indian dataset + DrugDB + Eka Care)
router.get('/search', handleSearchMedicines);
router.get('/detail/:id', handleGetMedicineDetails);

// Get today's daily medication schedule
router.get('/today', authenticate, handleGetTodaySchedule);

// Get weekly adherence percentage and streak metrics
router.get('/adherence', authenticate, handleGetAdherenceMetrics);

// Record dose action ('taken', 'due', 'snoozed', 'missed')
router.post('/:id/action', authenticate, handleRecordDoseAction);

// Get medicine details by ID (after action route)
router.get('/:id', handleGetMedicineDetails);

export default router;
