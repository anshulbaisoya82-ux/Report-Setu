import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  handleGetTodaySchedule,
  handleRecordDoseAction,
  handleGetAdherenceMetrics,
} from '../controllers/medicationController';

const router = Router();

// Get today's daily medication schedule
router.get('/today', authenticate, handleGetTodaySchedule);

// Get weekly adherence percentage and streak metrics
router.get('/adherence', authenticate, handleGetAdherenceMetrics);

// Record dose action ('taken', 'due', 'snoozed', 'missed')
router.post('/:id/action', authenticate, handleRecordDoseAction);

export default router;
