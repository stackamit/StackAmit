import express from 'express';
import {
  applyForInternship, getMyApplications, getAllApplications,
  getInternshipApplications,
  approveApplication, rejectApplication, withdrawApplication,
} from '../controllers/application.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/apply', authorize('student'), applyForInternship);
router.get('/my', authorize('student'), getMyApplications);
router.get('/all', authorize('admin'), getAllApplications);
router.get('/internship/:internshipId', authorize('admin', 'trainer'), getInternshipApplications);
router.patch('/:id/approve', authorize('admin', 'trainer'), approveApplication);
router.patch('/:id/reject', authorize('admin', 'trainer'), rejectApplication);
router.patch('/:id/withdraw', authorize('student'), withdrawApplication);

export default router;
