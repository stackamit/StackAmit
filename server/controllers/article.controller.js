import mongoose from 'mongoose';
import Article from '../models/Article.js';
import { logActivity } from '../services/activityLog.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const ARTICLE_TYPES = ['course', 'tutorial', 'blog', 'guide', 'other'];
const ARTICLE_STATUSES = ['draft', 'published'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Escape user input before building a RegExp so special characters don't throw
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const calculateReadTime = (content) => {
  const words = (content || '').trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / 200));
};

const normalizeTags = (tags) => {
  let list = [];
  if (Array.isArray(tags)) list = tags;
  else if (typeof tags === 'string') list = tags.split(',');
  return list
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);
};

const isValidId = (id) => mongoose.isValidObjectId(id);

// ─── Create Article (Any Authenticated User) ─────────────────────────────────
export const createArticle = asyncHandler(async (req, res) => {
  const {
    title, content, type = 'blog', category = '', excerpt = '',
    tags = [], status = 'draft', coverImage = null,
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Article title is required' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: 'Article content is required' });
  }
  if (!ARTICLE_TYPES.includes(type)) {
    return res.status(400).json({ success: false, message: `Invalid article type. Allowed: ${ARTICLE_TYPES.join(', ')}` });
  }
  if (!ARTICLE_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status. Allowed: draft, published' });
  }

  const article = await Article.create({
    author: req.user._id,
    title: title.trim(),
    content,
    type,
    category: (category || '').trim(),
    excerpt: (excerpt || '').trim(),
    tags: normalizeTags(tags),
    status,
    coverImage: coverImage || null,
    readTime: calculateReadTime(content),
  });

  await logActivity({
    userId: req.user._id,
    action: 'create',
    entity: 'article',
    entityId: article._id,
    details: { title: article.title, status: article.status },
    req,
  });

  res.status(201).json({
    success: true,
    message: status === 'published' ? 'Article published successfully' : 'Article saved as draft',
    data: { article },
  });
});

// ─── Get Published Articles (Public) ─────────────────────────────────────────
export const getArticles = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12, search, type, tag, sort = 'new' } = req.query;

  const query = { status: 'published', isDeleted: { $ne: true } };

  if (type && ARTICLE_TYPES.includes(type)) query.type = type;
  if (tag && String(tag).trim()) query.tags = String(tag).toLowerCase().trim();
  if (search && String(search).trim()) {
    const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
    query.$or = [{ title: rx }, { excerpt: rx }, { category: rx }, { tags: rx }];
  }

  const sortMap = {
    new: { createdAt: -1 },
    old: { createdAt: 1 },
    views: { views: -1 },
  };
  const sortOption = sortMap[sort] || sortMap.new;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
  const skip = (pageNum - 1) * limitNum;

  const [articles, total] = await Promise.all([
    Article.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate('author', 'name role avatar firstName lastName'),
    Article.countDocuments(query),
  ]);

  // Build lightweight list items: derive a fallback excerpt and strip full content
  const list = articles.map((a) => {
    const obj = a.toObject();
    if (!obj.excerpt) {
      const plain = (obj.content || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#>*_`]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      obj.excerpt = plain.slice(0, 180) + (plain.length > 180 ? '...' : '');
    }
    delete obj.content;
    return obj;
  });

  res.status(200).json({
    success: true,
    data: { articles: list, total, pages: Math.ceil(total / limitNum) || 1, page: pageNum },
  });
});

// ─── Get Single Published Article (Public) ───────────────────────────────────
export const getArticleById = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }

  const article = await Article.findOne({
    _id: req.params.id,
    status: 'published',
    isDeleted: { $ne: true },
  }).populate('author', 'name role avatar firstName lastName');

  if (!article) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }

  // Increment view count
  try {
    await Article.findByIdAndUpdate(article._id, { $inc: { views: 1 } });
  } catch (incErr) {
    console.error('Article view increment error:', incErr.message);
  }

  res.status(200).json({
    success: true,
    data: { article: { ...article.toObject(), views: (article.views || 0) + 1 } },
  });
});

// ─── Get My Articles (All Statuses, Owner Only) ──────────────────────────────
export const getMyArticles = asyncHandler(async (req, res) => {
  const articles = await Article.find({ author: req.user._id, isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .select('-content');

  res.status(200).json({ success: true, data: { articles } });
});

// ─── Get My Article By Id (For Editing, Includes Drafts) ─────────────────────
export const getMyArticleById = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }

  const article = await Article.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

  if (!article) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }
  if (article.author.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  res.status(200).json({ success: true, data: { article } });
});

// ─── Update Article (Owner Only) ─────────────────────────────────────────────
export const updateArticle = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }

  const article = await Article.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

  if (!article) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }
  if (article.author.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const { title, content, type, category, excerpt, tags, status, coverImage } = req.body;

  if (title !== undefined) {
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Title cannot be empty' });
    }
    article.title = String(title).trim();
  }
  if (content !== undefined) {
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'Content cannot be empty' });
    }
    article.content = content;
    article.readTime = calculateReadTime(content);
  }
  if (type !== undefined) {
    if (!ARTICLE_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: `Invalid article type. Allowed: ${ARTICLE_TYPES.join(', ')}` });
    }
    article.type = type;
  }
  if (category !== undefined) article.category = String(category).trim();
  if (excerpt !== undefined) article.excerpt = String(excerpt).trim();
  if (tags !== undefined) article.tags = normalizeTags(tags);
  if (status !== undefined) {
    if (!ARTICLE_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Allowed: draft, published' });
    }
    article.status = status;
  }
  if (coverImage !== undefined) article.coverImage = coverImage || null;

  await article.save();

  await logActivity({
    userId: req.user._id,
    action: 'update',
    entity: 'article',
    entityId: article._id,
    details: { title: article.title, status: article.status },
    req,
  });

  res.status(200).json({
    success: true,
    message: article.status === 'published' ? 'Article updated successfully' : 'Draft updated successfully',
    data: { article },
  });
});

// ─── Publish / Unpublish Article (Owner Only) ────────────────────────────────
export const updateArticleStatus = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }

  const { status } = req.body;

  if (!ARTICLE_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status. Allowed: draft, published' });
  }

  const article = await Article.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

  if (!article) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }
  if (article.author.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  article.status = status;
  await article.save();

  res.status(200).json({
    success: true,
    message: status === 'published' ? 'Article published successfully' : 'Article unpublished successfully',
    data: { article },
  });
});

// ─── Delete Article (Owner or Admin — Soft Delete) ───────────────────────────
export const deleteArticle = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }

  const article = await Article.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

  if (!article) {
    return res.status(404).json({ success: false, message: 'Article not found' });
  }

  const isOwner = article.author.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  article.isDeleted = true;
  await article.save();

  await logActivity({
    userId: req.user._id,
    action: 'delete',
    entity: 'article',
    entityId: article._id,
    details: { title: article.title, moderation: !isOwner },
    req,
  });

  res.status(200).json({ success: true, message: 'Article deleted successfully' });
});

