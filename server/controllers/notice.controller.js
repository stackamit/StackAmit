import mongoose from 'mongoose';
import Notice, {
  NOTICE_CATEGORIES,
  NOTICE_PRIORITIES,
  NOTICE_EDITORIAL_STATUSES,
  NOTICE_TARGET_PAGES,
} from '../models/Notice.js';
import { logActivity } from '../services/activityLog.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isValidId = (id) => mongoose.isValidObjectId(id);

// Public visibility is decided against the current time inside every
// query — never from a stored "expired" flag or a delayed status job.
export const buildPublicFilter = (page) => {
  const now = new Date();

  const filter = {
    isDeleted: { $ne: true },
    targetPages: page,
    $or: [
      { editorialStatus: 'published' },
      { editorialStatus: 'scheduled', publishAt: { $ne: null, $lte: now } },
    ],
    $and: [
      {
        $or: [
          { expiresAt: null },
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: now } },
        ],
      },
    ],
  };

  return filter;
};

// Priority weight for sorting: Urgent first, then Important, then Normal
const PRIORITY_WEIGHT = { urgent: 0, important: 1, normal: 2 };

export const sortNoticesByProminence = (notices) =>
  notices.sort((a, b) => {
    if (b.isPinned !== a.isPinned) return b.isPinned ? 1 : -1;
    const pw = (PRIORITY_WEIGHT[a.priority] ?? 2) - (PRIORITY_WEIGHT[b.priority] ?? 2);
    if (pw !== 0) return pw;
    return new Date(b.publishAt || b.createdAt) - new Date(a.publishAt || a.createdAt);
  });

export const parseDateOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d; // undefined = invalid
};

// Validate shared date rules for create/update
export const validateDates = ({ editorialStatus, publishAt, expiresAt }) => {
  if (editorialStatus === 'scheduled' && !publishAt) {
    return 'Scheduled notices must have a publication date and time';
  }
  if (publishAt && expiresAt && expiresAt <= publishAt) {
    return 'Expiry time must be later than the publication time';
  }
  return null;
};

// ─── Create Notice (Admin) ───────────────────────────────────────────────────
export const createNotice = asyncHandler(async (req, res) => {
  const {
    title, summary = '', content, category, priority = 'normal',
    targetPages = [], actionLabel = '', actionUrl = '',
    isPinned = false, publishMode = 'draft',
    publishAt, expiresAt,
  } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ success: false, message: 'Notice title is required' });
  }
  if (!content || !String(content).trim()) {
    return res.status(400).json({ success: false, message: 'Notice message is required' });
  }
  if (!NOTICE_CATEGORIES.includes(category)) {
    return res.status(400).json({ success: false, message: `Invalid category. Allowed: ${NOTICE_CATEGORIES.join(', ')}` });
  }
  if (!NOTICE_PRIORITIES.includes(priority)) {
    return res.status(400).json({ success: false, message: 'Invalid priority. Allowed: normal, important, urgent' });
  }
  if (
    !Array.isArray(targetPages) ||
    targetPages.length === 0 ||
    !targetPages.every((p) => NOTICE_TARGET_PAGES.includes(p))
  ) {
    return res.status(400).json({ success: false, message: 'Target pages must include at least one of: home, contact' });
  }

  const MODE_TO_STATUS = { now: 'published', schedule: 'scheduled', draft: 'draft' };
  if (!MODE_TO_STATUS[publishMode]) {
    return res.status(400).json({ success: false, message: 'Invalid publish mode. Allowed: now, schedule, draft' });
  }

  let editorialStatus = MODE_TO_STATUS[publishMode];
  let parsedPublishAt = parseDateOrNull(publishAt);
  const parsedExpiresAt = parseDateOrNull(expiresAt);

  if (parsedPublishAt === undefined || parsedExpiresAt === undefined) {
    return res.status(400).json({ success: false, message: 'Invalid publication or expiry date' });
  }

  if (editorialStatus === 'published' && !parsedPublishAt) {
    parsedPublishAt = new Date();
  }
  if (editorialStatus === 'draft') {
    parsedPublishAt = parsedPublishAt || null;
  }

  const dateError = validateDates({ editorialStatus, publishAt: parsedPublishAt, expiresAt: parsedExpiresAt });
  if (dateError) {
    return res.status(400).json({ success: false, message: dateError });
  }

  const notice = await Notice.create({
    title: String(title).trim(),
    summary: String(summary || '').trim(),
    content,
    category,
    priority,
    targetPages: [...new Set(targetPages)],
    actionLabel: String(actionLabel || '').trim(),
    actionUrl: String(actionUrl || '').trim(),
    isPinned: Boolean(isPinned),
    editorialStatus,
    publishAt: parsedPublishAt,
    expiresAt: parsedExpiresAt,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await logActivity({
    userId: req.user._id,
    action: 'create',
    entity: 'notice',
    entityId: notice._id,
    details: { title: notice.title, editorialStatus: notice.editorialStatus },
    req,
  });

  res.status(201).json({
    success: true,
    message:
      editorialStatus === 'published'
        ? 'Notice published successfully'
        : editorialStatus === 'scheduled'
          ? 'Notice scheduled successfully'
          : 'Notice saved as draft',
    data: { notice },
  });
});

// ─── List Notices (Admin — includes drafts/scheduled/expired) ────────────────
export const getNotices = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 20, search, category, priority,
    status, sort = 'new',
  } = req.query;

  const query = { isDeleted: { $ne: true } };

  if (category && NOTICE_CATEGORIES.includes(category)) query.category = category;
  if (priority && NOTICE_PRIORITIES.includes(priority)) query.priority = priority;
  if (status && NOTICE_EDITORIAL_STATUSES.includes(status)) query.editorialStatus = status;

  if (search && String(search).trim()) {
    const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
    query.$or = [{ title: rx }, { summary: rx }, { content: rx }];
  }

  const sortMap = {
    new: { createdAt: -1 },
    old: { createdAt: 1 },
    publishAt: { publishAt: -1 },
    expiresAt: { expiresAt: -1 },
  };
  const sortOption = sortMap[sort] || sortMap.new;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [notices, total] = await Promise.all([
    Notice.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name firstName lastName email role'),
    Notice.countDocuments(query),
  ]);

  // Expired is a derived state, so server-side filtering by "expired"
  // happens after hydration (notice volume is small; keeps rules in one place)
  let list = notices.map((n) => {
    const obj = n.toObject();
    delete obj.content; // full message is fetched only via the detail endpoint
    return obj;
  });
  if (status === 'expired') {
    list = list.filter((n) => n.effectiveStatus === 'expired');
  }

  res.status(200).json({
    success: true,
    data: {
      notices: list,
      total,
      pages: Math.ceil(total / limitNum) || 1,
      page: pageNum,
    },
  });
});

// ─── Get Single Notice (Admin) ───────────────────────────────────────────────
export const getNoticeById = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Notice not found' });
  }

  const notice = await Notice.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    .populate('createdBy', 'name firstName lastName email role')
    .populate('updatedBy', 'name firstName lastName email role');

  if (!notice) {
    return res.status(404).json({ success: false, message: 'Notice not found' });
  }

  res.status(200).json({ success: true, data: { notice } });
});

// ─── Update Notice (Admin) ───────────────────────────────────────────────────
export const updateNotice = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Notice not found' });
  }

  const notice = await Notice.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

  if (!notice) {
    return res.status(404).json({ success: false, message: 'Notice not found' });
  }

  const {
    title, summary, content, category, priority, targetPages,
    actionLabel, actionUrl, isPinned, publishMode, publishAt, expiresAt,
  } = req.body;

  if (title !== undefined) {
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'Title cannot be empty' });
    }
    notice.title = String(title).trim();
  }
  if (summary !== undefined) notice.summary = String(summary || '').trim();
  if (content !== undefined) {
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'Notice message cannot be empty' });
    }
    notice.content = content;
  }
  if (category !== undefined) {
    if (!NOTICE_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: `Invalid category. Allowed: ${NOTICE_CATEGORIES.join(', ')}` });
    }
    notice.category = category;
  }
  if (priority !== undefined) {
    if (!NOTICE_PRIORITIES.includes(priority)) {
      return res.status(400).json({ success: false, message: 'Invalid priority. Allowed: normal, important, urgent' });
    }
    notice.priority = priority;
  }
  if (targetPages !== undefined) {
    if (
      !Array.isArray(targetPages) ||
      targetPages.length === 0 ||
      !targetPages.every((p) => NOTICE_TARGET_PAGES.includes(p))
    ) {
      return res.status(400).json({ success: false, message: 'Target pages must include at least one of: home, contact' });
    }
    notice.targetPages = [...new Set(targetPages)];
  }
  if (actionLabel !== undefined) notice.actionLabel = String(actionLabel || '').trim();
  if (actionUrl !== undefined) notice.actionUrl = String(actionUrl || '').trim();
  if (isPinned !== undefined) notice.isPinned = Boolean(isPinned);

  // Publish mode / status + dates handled together
  let newEditorialStatus = notice.editorialStatus;
  let newPublishAt = notice.publishAt;
  let newExpiresAt = notice.expiresAt;

  if (publishMode !== undefined) {
    const MODE_TO_STATUS = { now: 'published', schedule: 'scheduled', draft: 'draft', unpublish: 'unpublished' };
    if (!MODE_TO_STATUS[publishMode]) {
      return res.status(400).json({ success: false, message: 'Invalid publish mode. Allowed: now, schedule, draft, unpublish' });
    }
    newEditorialStatus = MODE_TO_STATUS[publishMode];
    newPublishAt = publishAt !== undefined ? parseDateOrNull(publishAt) : newPublishAt;
    newExpiresAt = expiresAt !== undefined ? parseDateOrNull(expiresAt) : newExpiresAt;

    if (newEditorialStatus === 'published' && !newPublishAt) {
      newPublishAt = new Date();
    }
    if (newEditorialStatus === 'draft' && publishAt === undefined) {
      newPublishAt = newPublishAt || null;
    }
  } else {
    if (publishAt !== undefined) {
      newPublishAt = parseDateOrNull(publishAt);
    }
    if (expiresAt !== undefined) {
      newExpiresAt = parseDateOrNull(expiresAt);
    }
  }

  if (newPublishAt === undefined || newExpiresAt === undefined) {
    return res.status(400).json({ success: false, message: 'Invalid publication or expiry date' });
  }

  const dateError = validateDates({ editorialStatus: newEditorialStatus, publishAt: newPublishAt, expiresAt: newExpiresAt });
  if (dateError) {
    return res.status(400).json({ success: false, message: dateError });
  }

  notice.editorialStatus = newEditorialStatus;
  notice.publishAt = newPublishAt;
  notice.expiresAt = newExpiresAt;
  notice.updatedBy = req.user._id;

  await notice.save();

  await logActivity({
    userId: req.user._id,
    action: 'update',
    entity: 'notice',
    entityId: notice._id,
    details: { title: notice.title, editorialStatus: notice.editorialStatus },
    req,
  });

  res.status(200).json({
    success: true,
    message: 'Notice updated successfully',
    data: { notice },
  });
});

// ─── Publish / Unpublish Notice (Admin) ──────────────────────────────────────
export const updateNoticeStatus = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Notice not found' });
  }

  const { status } = req.body;

  if (!['published', 'unpublished'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status. Allowed: published, unpublished' });
  }

  const notice = await Notice.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

  if (!notice) {
    return res.status(404).json({ success: false, message: 'Notice not found' });
  }

  // Re-publishing an expired notice is not allowed — edit its expiry instead
  if (status === 'published' && notice.expiresAt && notice.expiresAt <= new Date()) {
    return res.status(400).json({
      success: false,
      message: 'This notice has expired. Update its expiry date before publishing again',
    });
  }

  notice.editorialStatus = status;
  if (status === 'published' && !notice.publishAt) {
    notice.publishAt = new Date();
  }
  notice.updatedBy = req.user._id;
  await notice.save();

  await logActivity({
    userId: req.user._id,
    action: status === 'published' ? 'publish' : 'unpublish',
    entity: 'notice',
    entityId: notice._id,
    details: { title: notice.title },
    req,
  });

  res.status(200).json({
    success: true,
    message: status === 'published' ? 'Notice published successfully' : 'Notice unpublished successfully',
    data: { notice },
  });
});

// ─── Delete Notice (Admin — Soft Delete) ─────────────────────────────────────
export const deleteNotice = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Notice not found' });
  }

  const notice = await Notice.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

  if (!notice) {
    return res.status(404).json({ success: false, message: 'Notice not found' });
  }

  notice.isDeleted = true;
  notice.deletedAt = new Date();
  notice.editorialStatus = 'unpublished';
  notice.updatedBy = req.user._id;
  await notice.save();

  await logActivity({
    userId: req.user._id,
    action: 'delete',
    entity: 'notice',
    entityId: notice._id,
    details: { title: notice.title },
    req,
  });

  res.status(200).json({ success: true, message: 'Notice deleted successfully' });
});

// ─── Public: Currently Visible Notices for a Page ────────────────────────────
export const getPublicNotices = asyncHandler(async (req, res) => {
  const { page: targetPage, limit = 10 } = req.query;

  if (!NOTICE_TARGET_PAGES.includes(targetPage)) {
    return res.status(400).json({ success: false, message: 'Invalid page. Allowed: home, contact' });
  }

  const limitNum = Math.min(30, Math.max(1, parseInt(limit) || 10));

  const filter = buildPublicFilter(targetPage);

  // No DB-level time sorting here: prominence ordering (pinned → priority
  // → recency) is applied in memory over the small eligible set.
  const notices = await Notice.find(filter)
    .sort({ publishAt: -1, createdAt: -1 })
    .limit(100)
    .select('title summary category priority actionLabel actionUrl isPinned publishAt expiresAt createdAt');

  const list = sortNoticesByProminence(notices.map((n) => n.toObject())).slice(0, limitNum);

  res.status(200).json({ success: true, data: { notices: list, page: targetPage } });
});

// ─── Public: Single Visible Notice ───────────────────────────────────────────
export const getPublicNoticeById = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Notice not found' });
  }

  const now = new Date();

  const notice = await Notice.findOne({
    _id: req.params.id,
    isDeleted: { $ne: true },
    $or: [
      { editorialStatus: 'published' },
      { editorialStatus: 'scheduled', publishAt: { $ne: null, $lte: now } },
    ],
  }).select('title summary content category priority actionLabel actionUrl isPinned publishAt expiresAt createdAt');

  // Drafts, unpublished and not-yet-scheduled notices all answer 404 —
  // no metadata is leaked about non-public notices.
  if (!notice) {
    return res.status(404).json({ success: false, message: 'Notice not found' });
  }
  if (notice.expiresAt && notice.expiresAt <= now) {
    return res.status(404).json({ success: false, message: 'Notice not found' });
  }

  res.status(200).json({ success: true, data: { notice } });
});

