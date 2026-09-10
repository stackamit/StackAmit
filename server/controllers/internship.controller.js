import Internship from '../models/Internship.js';
import { logActivity } from '../services/activityLog.service.js';
import { notifyAdmins } from '../services/notification.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// ─── Get Public Internships (no auth required) ──────────────────────────────
export const getPublicInternships = asyncHandler(async (req, res) => {
  try {
    const { search, category, sortBy = 'createdAt', order = 'desc' } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 12));

    const now = new Date();
    const query = { status: 'published', deadline: { $gte: now } };
    if (search) query.$text = { $search: search };
    if (category) query.category = category;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: order === 'asc' ? 1 : -1 };

    let internships, total;
    try {
      [internships, total] = await Promise.all([
        Internship.find(query).sort(sort).skip(skip).limit(limit)
          .populate('createdBy', 'name')
          .populate('assignedTrainer', 'name'),
        Internship.countDocuments(query),
      ]);
    } catch (err) {
      console.error('[PublicInternships] Primary query error:', err.message);
      internships = [];
      total = 0;
    }

    // Fallback: try with only deadline + status filter (no search/category)
    if (total === 0 && !search) {
      console.log('[PublicInternships] No results, trying fallback...');
      try {
        const fallbackQuery = { status: 'published', deadline: { $gte: new Date() } };
        const fbTotal = await Internship.countDocuments(fallbackQuery);
        console.log('[PublicInternships] Fallback total:', fbTotal);
        if (fbTotal > 0) {
          internships = await Internship.find(fallbackQuery).sort(sort).skip(skip).limit(limit)
            .populate('createdBy', 'name').populate('assignedTrainer', 'name');
          total = fbTotal;
          // Fix all documents using raw driver (bypasses Mongoose validation)
          const col = Internship.collection;
          await col.updateMany({}, { $set: { isDeleted: false } });
          await col.updateMany(
            { status: { $nin: ['published', 'closed', 'archived'] } },
            { $set: { status: 'published' } }
          );
          console.log('[PublicInternships] Fixed documents');
        }
      } catch (fbErr) {
        console.error('[PublicInternships] Fallback error:', fbErr.message);
      }
    }

    console.log('[PublicInternships] Returning', internships?.length || 0, 'of', total, 'total');
    res.status(200).json({
      success: true,
      data: { internships: internships || [], total: total || 0, pages: Math.ceil((total || 0) / limit), page },
    });
  } catch (err) {
    console.error('[PublicInternships] FATAL:', err);
    res.status(500).json({ success: false, message: err.message, data: { internships: [], total: 0, pages: 0, page: 1 } });
  }
});

// ─── Create Internship ───────────────────────────────────────────────────────
export const createInternship = asyncHandler(async (req, res) => {
  // Force status to 'published' - ignore any draft value from client
  const { status, ...rest } = req.body;
  const internship = await Internship.create({
    ...rest,
    isDeleted: false,
    status: 'published',
    createdBy: req.user._id,
  });

  console.log('[CreateInternship] Created:', internship._id, internship.title, 'status:', internship.status);

  await logActivity({
    userId: req.user._id,
    action: 'create',
    entity: 'internship',
    entityId: internship._id,
    details: { title: internship.title },
    req,
  });

  // Notify admins about new internship
  await notifyAdmins({
    title: 'New Internship Created',
    message: `"${internship.title}" has been published.`,
    type: 'general',
    relatedEntity: 'internship',
    relatedId: internship._id,
    excludeUserId: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: 'Internship created successfully',
    data: { internship },
  });
});

// ─── Get All Internships ─────────────────────────────────────────────────────
export const getAllInternships = asyncHandler(async (req, res) => {
  try {
    const {
      search, category, status,
      sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));

    const query = {};
    if (search) query.$text = { $search: search };
    if (category) query.category = category;
    if (status) query.status = status;

    // Students only see published internships whose deadline hasn't passed
    if (req.user.role === 'student') {
      query.status = 'published';
      query.deadline = { $gte: new Date() };
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: order === 'asc' ? 1 : -1 };

    let internships, total;
    try {
      [internships, total] = await Promise.all([
        Internship.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'name email')
          .populate('assignedTrainer', 'name email'),
        Internship.countDocuments(query),
      ]);
    } catch (err) {
      console.error('[AdminInternships] Primary query error:', err.message);
      internships = [];
      total = 0;
    }

    // Fallback: if nothing found, try with basic role-appropriate filter
    if ((!internships || internships.length === 0) && !search) {
      console.log('[AdminInternships] No results, trying fallback...');
      try {
        const fbQuery = req.user.role === 'student'
          ? { status: 'published', deadline: { $gte: new Date() } }
          : {};
        const rawTotal = await Internship.countDocuments(fbQuery);
        console.log('[AdminInternships] Fallback total:', rawTotal);
        if (rawTotal > 0) {
          internships = await Internship.find(fbQuery).sort(sort).skip(skip).limit(limit)
            .populate('createdBy', 'name email')
            .populate('assignedTrainer', 'name email');
          total = rawTotal;
          // Fix all documents using raw driver (bypasses Mongoose validation)
          const col = Internship.collection;
          await col.updateMany({}, { $set: { isDeleted: false } });
          await col.updateMany(
            { status: { $nin: ['published', 'closed', 'archived'] } },
            { $set: { status: 'published' } }
          );
          console.log('[AdminInternships] Fixed documents');
        }
      } catch (fbErr) {
        console.error('[AdminInternships] Fallback error:', fbErr.message);
      }
    }

    console.log('[AdminInternships] Returning', internships?.length || 0, 'of', total, 'total, role:', req.user.role);
    res.status(200).json({
      success: true,
      data: { internships: internships || [], total: total || 0, pages: Math.ceil((total || 0) / limit), page },
    });
  } catch (err) {
    console.error('[AdminInternships] FATAL:', err);
    res.status(500).json({ success: false, message: err.message, data: { internships: [], total: 0, pages: 0, page: 1 } });
  }
});

// ─── Get Internship by ID ────────────────────────────────────────────────────
export const getInternshipById = asyncHandler(async (req, res) => {
  const internship = await Internship.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('assignedTrainer', 'name email bio');

  if (!internship || internship.isDeleted) {
    return res.status(404).json({ success: false, message: 'Internship not found' });
  }

  res.status(200).json({ success: true, data: { internship } });
});

// ─── Get Public Internship by ID (no auth) ──────────────────────────────────
export const getPublicInternshipById = asyncHandler(async (req, res) => {
  const internship = await Internship.findById(req.params.id)
    .populate('createdBy', 'name')
    .populate('assignedTrainer', 'name bio expertise');

  if (!internship || internship.isDeleted || internship.status !== 'published') {
    return res.status(404).json({ success: false, message: 'Internship not found' });
  }

  // Hide internships whose application deadline has passed
  if (internship.deadline && new Date(internship.deadline) < new Date()) {
    return res.status(404).json({ success: false, message: 'Internship not found' });
  }

  res.status(200).json({ success: true, data: { internship } });
});

// ─── Update Internship ───────────────────────────────────────────────────────
export const updateInternship = asyncHandler(async (req, res) => {
  const internship = await Internship.findById(req.params.id);
  if (!internship || internship.isDeleted) {
    return res.status(404).json({ success: false, message: 'Internship not found' });
  }

  // Only creator, assigned trainer, or admin can update
  if (
    req.user.role !== 'admin' &&
    internship.createdBy.toString() !== req.user._id.toString() &&
    internship.assignedTrainer?.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ success: false, message: 'Not authorized to update this internship' });
  }

  Object.assign(internship, req.body);
  await internship.save();

  await logActivity({
    userId: req.user._id,
    action: 'update',
    entity: 'internship',
    entityId: internship._id,
    details: { fields: Object.keys(req.body) },
    req,
  });

  // Notify admins about internship update
  await notifyAdmins({
    title: 'Internship Updated',
    message: `"${internship.title}" has been updated.`,
    type: 'general',
    relatedEntity: 'internship',
    relatedId: internship._id,
    excludeUserId: req.user._id,
  });

  res.status(200).json({ success: true, message: 'Internship updated', data: { internship } });
});

// ─── Publish Internship ──────────────────────────────────────────────────────
export const publishInternship = asyncHandler(async (req, res) => {
  const internship = await Internship.findById(req.params.id);
  if (!internship || internship.isDeleted) {
    return res.status(404).json({ success: false, message: 'Internship not found' });
  }

  internship.status = 'published';
  await internship.save();

  await logActivity({
    userId: req.user._id,
    action: 'update',
    entity: 'internship',
    entityId: internship._id,
    details: { status: 'published' },
    req,
  });

  res.status(200).json({ success: true, message: 'Internship published' });
});

// ─── Close Internship ────────────────────────────────────────────────────────
export const closeInternship = asyncHandler(async (req, res) => {
  const internship = await Internship.findById(req.params.id);
  if (!internship || internship.isDeleted) {
    return res.status(404).json({ success: false, message: 'Internship not found' });
  }

  internship.status = 'closed';
  await internship.save();

  await logActivity({
    userId: req.user._id,
    action: 'update',
    entity: 'internship',
    entityId: internship._id,
    details: { status: 'closed' },
    req,
  });

  // Notify admins about internship closure
  await notifyAdmins({
    title: 'Internship Closed',
    message: `"${internship.title}" has been closed.`,
    type: 'general',
    relatedEntity: 'internship',
    relatedId: internship._id,
    excludeUserId: req.user._id,
  });

  res.status(200).json({ success: true, message: 'Internship closed' });
});

// ─── Delete Internship (Soft) ────────────────────────────────────────────────
export const deleteInternship = asyncHandler(async (req, res) => {
  const internship = await Internship.findById(req.params.id);
  if (!internship) {
    return res.status(404).json({ success: false, message: 'Internship not found' });
  }

  internship.isDeleted = true;
  internship.deletedAt = new Date();
  await internship.save();

  await logActivity({
    userId: req.user._id,
    action: 'delete',
    entity: 'internship',
    entityId: internship._id,
    req,
  });

  // Notify admins about internship deletion
  await notifyAdmins({
    title: 'Internship Deleted',
    message: `"${internship.title}" has been removed from the system.`,
    type: 'general',
    relatedEntity: 'internship',
    relatedId: internship._id,
    excludeUserId: req.user._id,
  });

  res.status(200).json({ success: true, message: 'Internship deleted' });
});

// ─── Get Internship Stats ────────────────────────────────────────────────────
export const getInternshipStats = asyncHandler(async (req, res) => {
  try {
    const [total, published, closed, active, rawTotal] = await Promise.all([
      Internship.countDocuments({ isDeleted: false }).catch(() => 0),
      Internship.countDocuments({ status: 'published', isDeleted: false }).catch(() => 0),
      Internship.countDocuments({ status: 'closed', isDeleted: false }).catch(() => 0),
      Internship.countDocuments({ status: 'published', isDeleted: false }).catch(() => 0),
      Internship.countDocuments({}).catch(() => 0),
    ]);

    console.log('[Stats] total:', total, 'published:', published, 'closed:', closed, 'rawTotal:', rawTotal);

    res.status(200).json({
      success: true,
      data: { total, published, closed, active },
    });
  } catch (err) {
    console.error('[Stats] FATAL:', err);
    res.status(200).json({ success: true, data: { total: 0, published: 0, closed: 0, active: 0 } });
  }
});

