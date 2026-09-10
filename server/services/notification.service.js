import Notification from '../models/Notification.js';
import User from '../models/User.js';

export const createNotification = async ({ userId, title, message, type, relatedEntity, relatedId, actionUrl }) => {
  try {
    return await Notification.create({
      userId,
      title,
      message,
      type: type || 'general',
      relatedEntity,
      relatedId,
      actionUrl,
    });
  } catch (error) {
    console.error('Notification creation error:', error.message);
    return null;
  }
};

// Send a notification to ALL admin users
export const notifyAdmins = async ({ title, message, type, relatedEntity, relatedId, actionUrl, excludeUserId }) => {
  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    if (!admins.length) return [];

    const notifications = admins
      .filter(a => !excludeUserId || a._id.toString() !== excludeUserId.toString())
      .map(admin => ({
        userId: admin._id,
        title,
        message,
        type: type || 'general',
        relatedEntity,
        relatedId,
        actionUrl,
      }));

    if (notifications.length === 0) return [];
    return await Notification.insertMany(notifications);
  } catch (error) {
    console.error('notifyAdmins error:', error.message);
    return [];
  }
};

export const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ userId, isRead: false });
};

export const markAsRead = async (notificationId, userId) => {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
};

export const markAllAsRead = async (userId) => {
  return Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};
