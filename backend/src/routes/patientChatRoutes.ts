import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import {
  sendPatientMessage,
  getPatientChatHistory,
  getPatientChatThread,
  getDoctorQuestionThreads,
  replyToPatientQuestion,
  toggleAiTakeover,
} from '../controllers/patientChatController';

const router = Router();

// Patient Chat & Q&A
router.post('/patient/chat', authenticate, requireRole('patient'), sendPatientMessage);
router.get('/patient/chat/history', authenticate, requireRole('patient'), getPatientChatHistory);
router.get('/patient/chat/thread', authenticate, requireRole('patient'), getPatientChatThread);

// Doctor Questions Inbox, Replies & AI Takeover Control
router.get('/doctor/questions', authenticate, requireRole('doctor'), getDoctorQuestionThreads);
router.post('/doctor/questions/:threadId/reply', authenticate, requireRole('doctor'), replyToPatientQuestion);
router.post('/doctor/questions/:threadId/toggle-ai', authenticate, requireRole('doctor'), toggleAiTakeover);

export default router;
