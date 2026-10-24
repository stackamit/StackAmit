import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  submitFeedback, submitAuthenticatedFeedback,
  getAllFeedback, getFeedbackById, replyToFeedback,
  updateFeedbackStatus, deleteFeedback, getFeedbackStats,
} from '../controllers/feedback.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// SA-032: dedicated throttle for the unauthenticated feedback endpoint. The
// global limiter is far too permissive for a public write that spawns admin
// notifications, so this caps submissions per IP while still allowing normal
// users a few messages. Successful and failed requests both count (no
// skip) because the abuse vector is volume, not just invalid attempts.
const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many feedback submissions. Please try again later.',
  },
});

// Public endpoint - no auth required
router.post('/public', feedbackLimiter, submitFeedback);

// Protected routes (for authenticated users to submit feedback)
router.use(protect);

router.post('/', submitAuthenticatedFeedback);

// Admin-only routes
router.get('/stats', authorize('admin'), getFeedbackStats);
router.get('/', authorize('admin'), getAllFeedback);
router.get('/:id', authorize('admin'), getFeedbackById);
router.post('/:id/reply', authorize('admin'), replyToFeedback);
router.patch('/:id/status', authorize('admin'), updateFeedbackStatus);
router.delete('/:id', authorize('admin'), deleteFeedback);

export default router;
