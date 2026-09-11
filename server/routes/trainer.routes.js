import express from 'express';
import {
  createTrainer, getAllTrainers, getTrainerById, updateTrainer,
  updateTrainerProfile,
  assignStudents, removeStudent, toggleTrainerStatus,
  deleteTrainer, resetTrainerPassword, getTrainersStats,
} from '../controllers/trainer.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Trainer self-profile route
router.put('/profile', authorize('trainer'), updateTrainerProfile);

// Admin routes
router.post('/', authorize('admin'), createTrainer);
router.get('/stats', authorize('admin'), getTrainersStats);
router.get('/', authorize('admin'), getAllTrainers);
router.get('/:id', authorize('admin'), getTrainerById);
router.put('/:id', authorize('admin'), updateTrainer);
router.post('/:id/assign-students', authorize('admin'), assignStudents);
router.delete('/:id/students/:studentId', authorize('admin'), removeStudent);
router.patch('/:id/status', authorize('admin'), toggleTrainerStatus);
router.delete('/:id', authorize('admin'), deleteTrainer);
router.post('/:id/reset-password', authorize('admin'), resetTrainerPassword);

export default router;
