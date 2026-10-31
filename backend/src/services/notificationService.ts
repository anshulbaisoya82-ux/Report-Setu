import { Notification, INotification, NotificationType } from '../repositories';
import { PatientProfile } from '../repositories';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { emitToUser } from './socketService';
import { logger } from '../utils/logger';

export interface NotificationQueryOptions {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export interface FormattedNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export const formatNotification = (n: INotification): FormattedNotification => ({
  id: n._id.toString(),
  userId: n.userId.toString(),
  type: n.type,
  title: n.title,
  message: n.message,
  data: n.data,
  isRead: n.isRead,
  createdAt: n.createdAt.toISOString(),
});

/**
 * Service: Retrieves paginated notifications and unread count for a user.
 */
export async function getNotifications(
  userId: string,
  options: NotificationQueryOptions = {}
) {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  const query: any = { userId: userId };
  if (options.unreadOnly) {
    query.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(query),
    Notification.countDocuments({ userId: userId, isRead: false }),
  ]);

  return {
    notifications: notifications.map(formatNotification),
    total,
    unreadCount,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Service: Marks a single notification as read.
 */
export async function markNotificationAsRead(userId: string, notificationId: string) {
  const notification = await Notification.findOne({
    _id: notificationId,
    userId: userId,
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  notification.isRead = true;
  await notification.save();

  return formatNotification(notification);
}

/**
 * Service: Marks all notifications for a user as read.
 */
export async function markAllNotificationsAsRead(userId: string) {
  const result = await Notification.updateMany(
    { userId: userId, isRead: false },
    { $set: { isRead: true } }
  );

  return {
    updatedCount: result.modifiedCount ?? result.count ?? 0,
    success: true,
  };
}

/**
 * Pluggable Dev Stub: Dispatches simulated SMS via structured Pino logger.
 * Never crashes when external cloud SMS credentials (e.g. Twilio / Gupshup) are absent.
 */
export async function sendSmsStub(to: string, message: string) {
  logger.info({
    type: 'sms_dispatch_stub',
    channel: 'SMS',
    recipient: to,
    messageContent: message,
    simulated: true,
  });

  return {
    channel: 'SMS',
    delivered: true,
    recipient: to,
    simulated: true,
  };
}

/**
 * Pluggable Dev Stub: Dispatches simulated Email via structured Pino logger.
 * Never crashes when SMTP / SendGrid credentials are absent.
 */
export async function sendEmailStub(to: string, subject: string, bodyText: string) {
  logger.info({
    type: 'email_dispatch_stub',
    channel: 'EMAIL',
    recipient: to,
    subject,
    bodyLength: bodyText.length,
    simulated: true,
  });

  return {
    channel: 'EMAIL',
    delivered: true,
    recipient: to,
    simulated: true,
  };
}

/**
 * Service: Creates in-app notification while strictly respecting patient preferences.
 */
export async function dispatchNotificationWithPreferences(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<FormattedNotification | null> {
  const patient = await PatientProfile.findOne({ userId: userId });
  if (patient && patient.notificationPreferences) {
    const prefs = patient.notificationPreferences;
    if (type === 'medicine_reminder' && prefs.medicineReminders === false) {
      logger.debug({ message: `Skipping notification: medicineReminders muted for user ${userId}` });
      return null;
    }
    if (type === 'test_due_reminder' && prefs.testDueReminders === false) {
      logger.debug({ message: `Skipping notification: testDueReminders muted for user ${userId}` });
      return null;
    }
    if (type === 'doctor_reply' && prefs.doctorReplies === false) {
      logger.debug({ message: `Skipping notification: doctorReplies muted for user ${userId}` });
      return null;
    }
    if (type === 'critical_alert' && prefs.criticalAlerts === false) {
      logger.debug({ message: `Skipping notification: criticalAlerts muted for user ${userId}` });
      return null;
    }
  }

  const notification = await Notification.create({
    userId: userId,
    type,
    title,
    message,
    data,
    isRead: false,
  });

  const formatted = formatNotification(notification);

  // Dispatch real-time socket event to user
  emitToUser(userId, 'notification:received', formatted);

  return formatted;
}
