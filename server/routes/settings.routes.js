import express from 'express';
import {
  getPublicSettings, getSettings, getSettingByKey, updateSetting,
  bulkUpdateSettings, deleteSetting,
} from '../controllers/settings.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public endpoint - no auth required
router.get('/public', getPublicSettings);

// Protected routes
router.use(protect);

router.get('/', getSettings);
router.get('/:key', getSettingByKey);
router.put('/', authorize('admin'), updateSetting);
router.put('/bulk', authorize('admin'), bulkUpdateSettings);
router.delete('/:key', authorize('admin'), deleteSetting);

export default router;
