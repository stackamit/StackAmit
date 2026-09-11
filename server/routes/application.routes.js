import express from 'express';
import {
  applyForInternship, getMyApplications, getOfferLetters, getAllApplications,
  getAllOfferLetters,
  getInternshipApplications,
  approveApplication, rejectApplication, withdrawApplication,
  downloadOfferLetterPDF, resendOfferLetterEmail,
} from '../controllers/application.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/apply', authorize('student'), applyForInternship);
router.get('/my', authorize('student'), getMyApplications);
router.get('/offer-letters', authorize('student'), getOfferLetters);
router.get('/offer-letters/all', authorize('admin'), getAllOfferLetters);
router.get('/offer-letters/:id/download', downloadOfferLetterPDF);
router.post('/offer-letters/:id/resend-email', authorize('admin'), resendOfferLetterEmail);
router.get('/all', authorize('admin'), getAllApplications);
router.get('/internship/:internshipId', authorize('admin', 'trainer'), getInternshipApplications);
router.patch('/:id/approve', authorize('admin', 'trainer'), approveApplication);
router.patch('/:id/reject', authorize('admin', 'trainer'), rejectApplication);
router.patch('/:id/withdraw', authorize('student'), withdrawApplication);

export default router;
