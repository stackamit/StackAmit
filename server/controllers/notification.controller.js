import Notification from '../models/Notification.js';
import { getUnreadCount, markAsRead, markAllAsRead } from '../services/notification.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// ─── Get Notifications ───────────────────────────────────────────────────────
export const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isRead } = req.query;
  const query = { userId: req.user._id };
  if (isRead !== undefined) query.isRead = isRead === 'true';

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notifications, total, unread] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Notification.countDocuments(query),
    getUnreadCount(req.user._id),
  ]);

  res.status(200).json({
    success: true,
    data: { notifications, total, unread, pages: Math.ceil(total / limit) },
  });
});

// ─── Mark as Read ────────────────────────────────────────────────────────────
export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await markAsRead(req.params.id, req.user._id);
  if (!notification) {
    return res.status(404).json({ success: false, message: 'Notification not found' });
  }
  res.status(200).json({ success: true, message: 'Notification marked as read' });
});

// ─── Mark All as Read ────────────────────────────────────────────────────────
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await markAllAsRead(req.user._id);
  res.status(200).json({ success: true, message: 'All notifications marked as read' });
});

// ─── Get Unread Count ────────────────────────────────────────────────────────
export const getUnreadNotificationCount = asyncHandler(async (req, res) => {
  const count = await getUnreadCount(req.user._id);
  res.status(200).json({ success: true, data: { count } });
});
