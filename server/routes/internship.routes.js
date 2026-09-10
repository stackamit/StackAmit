import express from 'express';
import {
  getPublicInternships, getPublicInternshipById, createInternship, getAllInternships, getInternshipById,
  updateInternship, publishInternship, closeInternship,
  deleteInternship, getInternshipStats,
} from '../controllers/internship.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public endpoint - no auth required
router.get('/public', getPublicInternships);
router.get('/public/:id', getPublicInternshipById);

// Protected routes
router.use(protect);

router.get('/stats', authorize('admin'), getInternshipStats);
router.post('/', authorize('admin', 'trainer'), createInternship);
router.get('/', getAllInternships);
router.get('/:id', getInternshipById);
router.put('/:id', authorize('admin', 'trainer'), updateInternship);
router.patch('/:id/publish', authorize('admin', 'trainer'), publishInternship);
router.patch('/:id/close', authorize('admin', 'trainer'), closeInternship);
router.delete('/:id', authorize('admin'), deleteInternship);

export default router;
