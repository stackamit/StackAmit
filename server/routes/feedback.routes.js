import express from 'express';
import {
  submitFeedback, submitAuthenticatedFeedback,
  getAllFeedback, getFeedbackById, replyToFeedback,
  updateFeedbackStatus, deleteFeedback, getFeedbackStats,
} from '../controllers/feedback.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public endpoint - no auth required
router.post('/public', submitFeedback);

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
