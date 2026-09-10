import express from 'express';
import {
  getNotifications, markNotificationRead,
  markAllNotificationsRead, getUnreadNotificationCount,
} from '../controllers/notification.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch('/:id/read', markNotificationRead);
router.patch('/read-all', markAllNotificationsRead);

export default router;
