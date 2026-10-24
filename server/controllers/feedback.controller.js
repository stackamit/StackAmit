import Feedback from '../models/Feedback.js';
import { logActivity } from '../services/activityLog.service.js';
import { notifyAdmins } from '../services/notification.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { literalSearchRegex } from '../utils/authz.js';
import { normalizeFeedbackInput } from '../utils/feedbackValidation.js';
import { scrub } from '../utils/logRedact.js';

// ─── Submit Feedback (public, no auth required) ─────────────────────────────
export const submitFeedback = asyncHandler(async (req, res) => {
  try {
    // SA-032: validate + normalise every accepted field, reject operator/object
    // injection and unexpected keys, enforce length limits. Return a generic
    // client error so the response does not help an attacker enumerate rules.
    const parsed = normalizeFeedbackInput(req.body, { requireIdentity: true });
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        message: 'Invalid submission. Please check your details and try again.',
      });
    }
    const { name, email, subject, message, rating, type } = parsed.value;

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
      rating,
      type,
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
    // SA-023: never dump the raw error (a Mongoose validation error can embed
    // the whole submitted document, including the email/message).
    console.error('[SubmitFeedback] Error:', scrub(err.message));
    res.status(500).json({ success: false, message: 'Failed to submit feedback.' });
  }
});

// ─── Submit Feedback (authenticated users) ──────────────────────────────────
export const submitAuthenticatedFeedback = asyncHandler(async (req, res) => {
  try {
    // SA-032: same field validation, minus the name/email (taken from session).
    const parsed = normalizeFeedbackInput(req.body, { requireIdentity: false });
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        message: 'Invalid submission. Please check your details and try again.',
      });
    }
    const { subject, message, rating, type } = parsed.value;

    const feedback = await Feedback.create({
      name: req.user.name || 'User',
      email: req.user.email,
      subject,
      message,
      rating,
      type,
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
    console.error('[SubmitAuthenticatedFeedback] Error:', scrub(err.message));
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
      // SA-014: escape the term so it is matched literally (no operator/regex
      // injection, no ReDoS). Skip the filter when the input is not usable.
      const rx = literalSearchRegex(String(search));
      if (rx) {
        query.$or = [
          { name: rx },
          { email: rx },
          { subject: rx },
        ];
      }
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
    console.error('[GetAllFeedback] Error:', scrub(err.message));
    // SA-033: never surface the raw driver/exception message to the client.
    res.status(500).json({ success: false, message: 'Failed to fetch feedback', data: { feedback: [], total: 0, pages: 0, page: 1 } });
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
    console.error('[FeedbackStats] Error:', scrub(err.message));
    res.status(200).json({ success: true, data: { total: 0, pending: 0, read: 0, replied: 0, archived: 0, avgRating: 0 } });
  }
});

