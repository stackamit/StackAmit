import express from 'express';
import {
  createTask, getTasks, getTaskById, updateTask, deleteTask,
  submitTask, reviewSubmission, getTaskStats,
  extendDeadline, reopenSubmissionWindow,
  adminGetTasks, adminTaskStats, adminTasksByTrainer, adminTasksByStudent,
} from '../controllers/task.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/stats', getTaskStats);

// Admin centralized task monitoring (admin only). Multi-segment paths never
// collide with the single-segment /:id routes below; trainers keep their own
// scoped /tasks list and students have no access to cross-person task data.
router.get('/admin/tasks', authorize('admin'), adminGetTasks);
router.get('/admin/tasks/stats', authorize('admin'), adminTaskStats);
router.get('/admin/tasks/trainers', authorize('admin'), adminTasksByTrainer);
router.get('/admin/tasks/students', authorize('admin'), adminTasksByStudent);

router.post('/', authorize('admin', 'trainer'), createTask);
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.put('/:id', authorize('admin', 'trainer'), updateTask);
router.delete('/:id', authorize('admin', 'trainer'), deleteTask);
router.post('/:taskId/submit', authorize('student'), submitTask);
router.patch('/submissions/:id/review', authorize('admin', 'trainer'), reviewSubmission);
// Submission-window management (admin/trainer). Both operate on a single
// task, which is assigned to exactly one student, so the scope is inherently
// per-student and never reopens other students' submissions.
router.post('/:id/extend-deadline', authorize('admin', 'trainer'), extendDeadline);
router.post('/:id/reopen-submission', authorize('admin', 'trainer'), reopenSubmissionWindow);

export default router;
