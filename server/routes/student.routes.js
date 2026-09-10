import express from 'express';
import {
  getAllStudents, getStudentById, adminUpdateStudent,
  toggleStudentStatus, deleteStudent, resetStudentPassword,
  getStudentsStats, updateStudentProfile, uploadAvatar, uploadResume,
} from '../controllers/student.controller.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);

// Student self-service routes (MUST be before /:id to avoid conflicts)
router.put('/profile', updateStudentProfile);
router.post('/avatar', upload.single('avatar'), uploadAvatar);
router.post('/resume', upload.single('resume'), uploadResume);

// Admin routes
router.get('/stats', authorize('admin'), getStudentsStats);
router.get('/', authorize('admin', 'trainer'), getAllStudents);
router.get('/:id', authorize('admin', 'trainer'), getStudentById);
router.put('/:id', authorize('admin'), adminUpdateStudent);
router.patch('/:id/status', authorize('admin'), toggleStudentStatus);
router.delete('/:id', authorize('admin'), deleteStudent);
router.post('/:id/reset-password', authorize('admin'), resetStudentPassword);

export default router;
