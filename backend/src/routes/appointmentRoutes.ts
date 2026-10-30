import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  handleRequestAppointment,
  handleUpdateAppointmentStatus,
  handleGetAppointments,
} from '../controllers/appointmentController';

const router = Router();

// Request appointment (patient or doctor)
router.post('/request', authenticate, handleRequestAppointment);

// Update appointment status (doctor confirm/reject/complete or patient cancel)
router.put('/:id/status', authenticate, handleUpdateAppointmentStatus);

// List appointments
router.get('/', authenticate, handleGetAppointments);

export default router;
