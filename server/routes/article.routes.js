import express from 'express';
import {
  createArticle, getArticles, getArticleById,
  getMyArticles, getMyArticleById,
  updateArticle, updateArticleStatus, deleteArticle,
} from '../controllers/article.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// ─── Public Routes (no authentication required) ──────────────────────────────
router.get('/', getArticles);
// '/my' routes must be declared before '/:id' so they are not swallowed by the param route
router.get('/my', protect, getMyArticles);
router.get('/my/:id', protect, getMyArticleById);
router.get('/:id', getArticleById);

// ─── Protected Routes (any authenticated user can post and manage articles) ──
router.post('/', protect, createArticle);
router.put('/:id', protect, updateArticle);
router.patch('/:id/status', protect, updateArticleStatus);
router.delete('/:id', protect, deleteArticle);

export default router;
