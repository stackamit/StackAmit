import Feedback from '../models/Feedback.js';
import { logActivity } from '../services/activityLog.service.js';
import { notifyAdmins } from '../services/notification.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// ─── Submit Feedback (public, no auth required) ─────────────────────────────
export const submitFeedback = asyncHandler(async (req, res) => {
  try {
    const { name, email, subject, message, rating, type } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, subject, and message are required.',
      });
    }

    // If user is logged in, attach their info
    let userRef = null;
    let userType = 'public';
    if (req.user) {
      userRef = req.user._id;
      userType = req.user.role || 'public';
    }

    const feedback = await Feedback.create({
      name,
      email,
      subject,
      message,
      rating: rating || 5,
      type: type || 'general',
      userRef,
      userType,
    });

    // Notify admins about new feedback
    await notifyAdmins({
      title: 'New Feedback Received',
      message: `"${name}" submitted feedback: "${subject}"`,
      type: 'general',
      relatedEntity: 'user',
      relatedId: feedback._id,
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! We appreciate your input.',
      data: { feedback },
    });
  } catch (err) {
    console.error('[SubmitFeedback] Error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit feedback.' });
  }
});

// ─── Submit Feedback (authenticated users) ──────────────────────────────────
export const submitAuthenticatedFeedback = asyncHandler(async (req, res) => {
  try {
    const { subject, message, rating, type } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message are required.',
      });
    }

    const feedback = await Feedback.create({
      name: req.user.name || 'User',
      email: req.user.email,
      subject,
      message,
      rating: rating || 5,
      type: type || 'general',
      userRef: req.user._id,
      userType: req.user.role || 'public',
    });

    // Notify admins about new feedback
    await notifyAdmins({
      title: 'New Feedback Received',
      message: `"${req.user.name}" submitted feedback: "${subject}"`,
      type: 'general',
      relatedEntity: 'user',
      relatedId: feedback._id,
      excludeUserId: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback! We appreciate your input.',
      data: { feedback },
    });
  } catch (err) {
    console.error('[SubmitAuthenticatedFeedback] Error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit feedback.' });
  }
});

// ─── Get All Feedback (admin only) ──────────────────────────────────────────
export const getAllFeedback = asyncHandler(async (req, res) => {
  try {
    const {
      status, type, search,
      sortBy = 'createdAt', order = 'desc',
    } = req.query;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));

    const query = { isDeleted: false };
    if (status) query.status = status;
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: order === 'asc' ? 1 : -1 };

    const [feedback, total] = await Promise.all([
      Feedback.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('userRef', 'name email role')
        .populate('repliedBy', 'name'),
      Feedback.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        feedback: feedback || [],
        total: total || 0,
        pages: Math.ceil((total || 0) / limit),
        page,
      },
    });
  } catch (err) {
    console.error('[GetAllFeedback] Error:', err);
    res.status(500).json({ success: false, message: err.message, data: { feedback: [], total: 0, pages: 0, page: 1 } });
  }
});

// ─── Get Feedback by ID (admin only) ────────────────────────────────────────
export const getFeedbackById = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findById(req.params.id)
    .populate('userRef', 'name email role')
    .populate('repliedBy', 'name email');

  if (!feedback || feedback.isDeleted) {
    return res.status(404).json({ success: false, message: 'Feedback not found' });
  }

  // Mark as read if pending
  if (feedback.status === 'pending') {
    feedback.status = 'read';
    await feedback.save();
  }

  res.status(200).json({ success: true, data: { feedback } });
});

// ─── Reply to Feedback (admin only) ─────────────────────────────────────────
export const replyToFeedback = asyncHandler(async (req, res) => {
  const { adminReply } = req.body;

  if (!adminReply) {
    return res.status(400).json({ success: false, message: 'Reply message is required.' });
  }

  const feedback = await Feedback.findById(req.params.id);
  if (!feedback || feedback.isDeleted) {
    return res.status(404).json({ success: false, message: 'Feedback not found' });
  }

  feedback.adminReply = adminReply;
  feedback.status = 'replied';
  feedback.repliedAt = new Date();
  feedback.repliedBy = req.user._id;
  await feedback.save();

  await logActivity({
    userId: req.user._id,
    action: 'reply',
    entity: 'feedback',
    entityId: feedback._id,
    details: { subject: feedback.subject },
    req,
  });

  res.status(200).json({
    success: true,
    message: 'Reply sent successfully.',
    data: { feedback },
  });
});

// ─── Update Feedback Status (admin only) ────────────────────────────────────
export const updateFeedbackStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!['pending', 'read', 'replied', 'archived'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }

  const feedback = await Feedback.findById(req.params.id);
  if (!feedback || feedback.isDeleted) {
    return res.status(404).json({ success: false, message: 'Feedback not found' });
  }

  feedback.status = status;
  await feedback.save();

  res.status(200).json({
    success: true,
    message: `Feedback marked as ${status}.`,
    data: { feedback },
  });
});

// ─── Delete Feedback (soft delete, admin only) ──────────────────────────────
export const deleteFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findById(req.params.id);
  if (!feedback) {
    return res.status(404).json({ success: false, message: 'Feedback not found' });
  }

  feedback.isDeleted = true;
  await feedback.save();

  await logActivity({
    userId: req.user._id,
    action: 'delete',
    entity: 'feedback',
    entityId: feedback._id,
    req,
  });

  res.status(200).json({ success: true, message: 'Feedback deleted.' });
});

// ─── Get Feedback Stats (admin only) ────────────────────────────────────────
export const getFeedbackStats = asyncHandler(async (req, res) => {
  try {
    const [total, pending, read, replied, archived] = await Promise.all([
      Feedback.countDocuments({ isDeleted: false }).catch(() => 0),
      Feedback.countDocuments({ status: 'pending', isDeleted: false }).catch(() => 0),
      Feedback.countDocuments({ status: 'read', isDeleted: false }).catch(() => 0),
      Feedback.countDocuments({ status: 'replied', isDeleted: false }).catch(() => 0),
      Feedback.countDocuments({ status: 'archived', isDeleted: false }).catch(() => 0),
    ]);

    // Average rating
    const ratingResult = await Feedback.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, avgRating: { $avg: '$rating' } } },
    ]);
    const avgRating = ratingResult.length > 0 ? Math.round(ratingResult[0].avgRating * 10) / 10 : 0;

    res.status(200).json({
      success: true,
      data: { total, pending, read, replied, archived, avgRating },
    });
  } catch (err) {
    console.error('[FeedbackStats] Error:', err);
    res.status(200).json({ success: true, data: { total: 0, pending: 0, read: 0, replied: 0, archived: 0, avgRating: 0 } });
  }
});

