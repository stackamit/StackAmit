import express from 'express';
import {
  getAdminDashboardStats, getTrainerDashboardStats,
  getStudentDashboardStats, getMonthlyReport, exportData,
} from '../controllers/report.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/admin/dashboard', authorize('admin'), getAdminDashboardStats);
router.get('/trainer/dashboard', authorize('trainer'), getTrainerDashboardStats);
router.get('/student/dashboard', authorize('student'), getStudentDashboardStats);
router.get('/monthly', authorize('admin'), getMonthlyReport);
router.get('/export', authorize('admin'), exportData);

export default router;
