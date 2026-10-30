import { Request, Response, NextFunction } from 'express';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/notificationService';
import { sendSuccess } from '../utils/apiResponse';
import { UnauthorizedError } from '../utils/errors';

/**
 * Controller: Retrieves paginated notifications and unread counts for the authenticated user.
 */
export const handleGetNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { page, limit, unreadOnly } = req.query;

    const result = await getNotifications(req.user.userId, {
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      unreadOnly: unreadOnly === 'true',
    });

    sendSuccess(
      res,
      {
        notifications: result.notifications,
        unreadCount: result.unreadCount,
        total: result.total,
      },
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      }
    );
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Marks an individual notification as read.
 */
export const handleMarkAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { id: notificationId } = req.params;
    const updated = await markNotificationAsRead(req.user.userId, notificationId);

    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Marks all notifications for the authenticated user as read.
 */
export const handleMarkAllAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const result = await markAllNotificationsAsRead(req.user.userId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
