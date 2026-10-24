import express from 'express';
import {
  createNotice, getNotices, getNoticeById, updateNotice,
  updateNoticeStatus, deleteNotice,
  getPublicNotices, getPublicNoticeById,
} from '../controllers/notice.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// ─── Public Routes (only eligible notices are ever returned) ────────────────
router.get('/public', getPublicNotices);
router.get('/public/:id', getPublicNoticeById);

// ─── Admin Routes ────────────────────────────────────────────────────────────
router.use(protect);
router.use(authorize('admin'));

router.get('/', getNotices);
router.post('/', createNotice);
router.get('/:id', getNoticeById);
router.put('/:id', updateNotice);
router.patch('/:id/status', updateNoticeStatus);
router.delete('/:id', deleteNotice);

export default router;
