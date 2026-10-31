import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import {
  handleGetNotifications,
  handleMarkAsRead,
  handleMarkAllAsRead,
} from '../controllers/notificationController';

const router = Router();

// Get paginated notifications and unread counts
router.get('/', authenticate, handleGetNotifications);

// Mark all notifications as read (MUST be declared before parameterized /:id/read)
router.put('/read-all', authenticate, handleMarkAllAsRead);

// Mark single notification as read
router.put('/:id/read', authenticate, handleMarkAsRead);

export default router;
