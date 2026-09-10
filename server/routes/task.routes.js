import express from 'express';
import {
  createTask, getTasks, getTaskById, updateTask, deleteTask,
  submitTask, reviewSubmission, getTaskStats,
} from '../controllers/task.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/stats', getTaskStats);
router.post('/', authorize('admin', 'trainer'), createTask);
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.put('/:id', authorize('admin', 'trainer'), updateTask);
router.delete('/:id', authorize('admin', 'trainer'), deleteTask);
router.post('/:taskId/submit', authorize('student'), submitTask);
router.patch('/submissions/:id/review', authorize('admin', 'trainer'), reviewSubmission);

export default router;
