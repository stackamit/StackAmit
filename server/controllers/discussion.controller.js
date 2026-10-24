import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Internship from '../models/Internship.js';
import Student from '../models/Student.js';
import Trainer from '../models/Trainer.js';
import Task from '../models/Task.js';
import { createNotification } from '../services/notification.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getOnlineUsers } from '../socket/index.js';
import { sameId, canAccessConversation, literalSearchRegex } from '../utils/authz.js';
import { redactId } from '../utils/logRedact.js';

// ─── Helper: resolve internships that share the same title ──────────────────
// Two students can be assigned to two *separate* Internship records that carry
// the same title (e.g. two "Java Programming" cohorts). In the trainer's
// discussion view those should be treated as ONE internship with ALL students
// listed together. This returns every internship _id sharing the given
// internship's title (always including the original id).
const resolveSiblingInternshipIds = async (internshipId) => {
  if (!internshipId) return null;
  const base = await Internship.findById(internshipId).select('title');
  if (!base) return [internshipId];
  const sibs = await Internship.find({ title: base.title, isDeleted: false }).select('_id');
  const ids = sibs.map((s) => s._id);
  if (!ids.some((id) => id.toString() === internshipId.toString())) {
    ids.push(internshipId);
  }
  return ids;
};

// ─── Get Conversations for Trainer ──────────────────────────────────────────
export const getTrainerConversations = asyncHandler(async (req, res) => {
  const trainerId = req.user._id;
  const { internshipId } = req.query;

  // Merge same-title internships so every student's conversation is returned
  const siblingIds = internshipId ? await resolveSiblingInternshipIds(internshipId) : null;

  const query = { trainer: trainerId };
  if (siblingIds) query.internship = { $in: siblingIds };

  let conversations = await Conversation.find(query)
    .populate('student', 'name email firstName lastName avatar collegeName course year')
    .populate('internship', 'title category status')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 });

  // Auto-create conversations for assigned students that don't have one yet
  const existingStudentIds = new Set(conversations.map(c => c.student?._id?.toString()));
  const studentQuery = { assignedTrainer: trainerId, deletedAt: null };
  if (siblingIds) studentQuery.currentInternship = { $in: siblingIds };

  const assignedStudents = await Student.find(studentQuery)
    .select('name email firstName lastName avatar collegeName course year currentInternship');

  const newConvs = [];
  for (const student of assignedStudents) {
    if (!existingStudentIds.has(student._id.toString()) && student.currentInternship) {
      try {
        const conv = await Conversation.create({
          internship: student.currentInternship,
          trainer: trainerId,
          student: student._id,
          type: 'private',
        });
        newConvs.push(conv._id);
      } catch (err) { /* duplicate - skip */ }
    }
  }

  // Refetch if new conversations were created
  if (newConvs.length > 0) {
    conversations = await Conversation.find(query)
      .populate('student', 'name email firstName lastName avatar collegeName course year')
      .populate('internship', 'title category status')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });
  }

  // Add online status
  const onlineUsers = getOnlineUsers();
  const result = conversations.map(c => ({
    ...c.toObject(),
    studentOnline: onlineUsers.has(c.student?._id?.toString()),
  }));

  res.status(200).json({ success: true, data: { conversations: result } });
});

// ─── Get Conversations for Student ──────────────────────────────────────────
export const getStudentConversations = asyncHandler(async (req, res) => {
  const studentId = req.user._id;

  let conversations = await Conversation.find({ student: studentId })
    .populate('trainer', 'name email firstName lastName avatar')
    .populate('internship', 'title category status')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 });

  // Auto-create conversation if student has assigned trainer + internship but no conversation yet
  if (conversations.length === 0) {
    const student = await Student.findById(studentId).select('assignedTrainer currentInternship');
    if (student?.assignedTrainer && student?.currentInternship) {
      try {
        await Conversation.create({
          internship: student.currentInternship,
          trainer: student.assignedTrainer,
          student: studentId,
          type: 'private',
        });
        // Refetch
        conversations = await Conversation.find({ student: studentId })
          .populate('trainer', 'name email firstName lastName avatar')
          .populate('internship', 'title category status')
          .populate('lastMessage')
          .sort({ lastMessageAt: -1 });
      } catch (err) { /* duplicate - skip */ }
    }
  }

  // Add online status
  const onlineUsers = getOnlineUsers();
  const result = conversations.map(c => ({
    ...c.toObject(),
    trainerOnline: onlineUsers.has(c.trainer?._id?.toString()),
  }));

  res.status(200).json({ success: true, data: { conversations: result } });
});

// ─── Get or Create Conversation ─────────────────────────────────────────────
export const getOrCreateConversation = asyncHandler(async (req, res) => {
  const { internshipId, studentId } = req.body;
  const trainerId = req.user._id;

  // Verify trainer is assigned to this internship
  const internship = await Internship.findById(internshipId);
  if (!internship) {
    return res.status(404).json({ success: false, message: 'Internship not found' });
  }

  // Verify student exists
  const student = await Student.findById(studentId);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  // SA-009: a trainer may only open/engage a conversation with a student who is
  // actually assigned to them. Without this, any authenticated trainer could
  // create (and then read, via getMessages) a private thread with any student.
  if (!sameId(student.assignedTrainer, trainerId)) {
    return res.status(403).json({ success: false, message: 'Student is not assigned to you' });
  }

  // Find or create conversation
  let conversation = await Conversation.findOne({
    internship: internshipId,
    trainer: trainerId,
    student: studentId,
    type: 'private',
  })
    .populate('student', 'name email firstName lastName avatar collegeName course year')
    .populate('trainer', 'name email firstName lastName avatar')
    .populate('internship', 'title category status');

  if (!conversation) {
    conversation = await Conversation.create({
      internship: internshipId,
      trainer: trainerId,
      student: studentId,
      type: 'private',
    });

    // Re-populate after creation
    await conversation.populate('student', 'name email firstName lastName avatar collegeName course year');
    await conversation.populate('trainer', 'name email firstName lastName avatar');
    await conversation.populate('internship', 'title category status');

    // Create system message
    await Message.create({
      conversation: conversation._id,
      sender: trainerId,
      senderRole: 'trainer',
      message: `Discussion started for "${internship.title}"`,
      messageType: 'SYSTEM',
    });
  }

  res.status(200).json({ success: true, data: { conversation } });
});

// ─── Get Messages for Conversation ──────────────────────────────────────────
export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { page = 1, limit = 50, search, pinned, important } = req.query;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    console.log(`[getMessages] Conversation ${redactId(conversationId)} not found`);
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  // Verify access
  const uid = req.user._id;
  const trainerId = conversation.trainer?.toString();
  const studentId = conversation.student?.toString();
  const uidStr = uid.toString();

  const hasAccess = (
    trainerId === uidStr ||
    studentId === uidStr ||
    req.user.role === 'admin'
  );
  if (!hasAccess) {
    // SA-023: redact the identifier; role is not PII.
    console.log(`[getMessages] ACCESS DENIED for user ${redactId(uidStr)} (role=${req.user.role})`);
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const query = { conversation: conversationId, deleted: false };
  if (search) {
    // SA-014: escape the term and force a literal match (no operator injection).
    const rx = literalSearchRegex(search);
    if (rx) query.message = rx;
  }
  if (pinned === 'true') query.isPinned = true;
  if (important === 'true') query.isImportant = true;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [messages, total] = await Promise.all([
    Message.find(query)
      .populate('sender', 'name email avatar role firstName lastName')
      .populate('replyTo', 'message sender messageType')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Message.countDocuments(query),
  ]);

  console.log(`[getMessages] conv=${redactId(conversationId)} found=${total} messages`);

  // Mark messages as read
  await Message.updateMany(
    {
      conversation: conversationId,
      sender: { $ne: uid },
      'readBy.user': { $ne: uid },
      deleted: false,
    },
    {
      $push: { readBy: { user: uid, readAt: new Date() } },
    }
  );

  // Reset unread count
  const update = {};
  if (conversation.trainer.toString() === uid.toString()) {
    update.unreadTrainer = 0;
  } else if (conversation.student.toString() === uid.toString()) {
    update.unreadStudent = 0;
  }
  if (Object.keys(update).length > 0) {
    await Conversation.findByIdAndUpdate(conversationId, update);
  }

  res.status(200).json({
    success: true,
    data: { messages, total, pages: Math.ceil(total / limit), page: parseInt(page) },
  });
});

// ─── Send Message (REST fallback) ───────────────────────────────────────────
export const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { message, messageType, attachment, replyTo } = req.body;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    console.log(`[sendMessage] Conversation ${redactId(conversationId)} not found`);
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  // Verify access
  const uid = req.user._id;
  const uidStr = uid.toString();
  const trainerId = conversation.trainer?.toString();
  const studentId = conversation.student?.toString();

  const hasAccess = (
    trainerId === uidStr ||
    studentId === uidStr ||
    req.user.role === 'admin'
  );
  if (!hasAccess) {
    // SA-023: redact the identifier; role is not PII.
    console.log(`[sendMessage] ACCESS DENIED for user ${redactId(uidStr)} (role=${req.user.role})`);
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  if (conversation.isClosed) {
    return res.status(400).json({ success: false, message: 'This conversation is closed' });
  }

  // Check if muted
  const isMuted = conversation.mutedBy.some(m => m.user.toString() === uid.toString());
  if (isMuted) {
    return res.status(403).json({ success: false, message: 'You are muted' });
  }

  const msg = await Message.create({
    conversation: conversationId,
    sender: uid,
    senderRole: req.user.role,
    message,
    messageType: messageType || 'TEXT',
    attachment,
    replyTo,
  });
  console.log(`[REST sendMessage] Message created in conv ${redactId(conversationId)}`);

  // Update conversation
  conversation.lastMessage = msg._id;
  conversation.lastMessageAt = new Date();
  if (req.user.role === 'student') {
    conversation.unreadTrainer += 1;
  } else if (req.user.role === 'trainer') {
    conversation.unreadStudent += 1;
  }
  await conversation.save();

  // Populate and return
  const populated = await Message.findById(msg._id)
    .populate('sender', 'name email avatar role firstName lastName')
    .populate('replyTo', 'message sender messageType');

  // Emit via socket for real-time delivery to the other party
  try {
    const { getIO } = await import('../socket/index.js');
    const io = getIO();
    io.to(`conversation:${conversationId}`).emit('newMessage', {
      message: populated,
      conversationId,
    });
  } catch (socketErr) {
    console.log('[REST sendMessage] Socket emit skipped:', socketErr.message);
  }

  // Send notification
  if (req.user.role === 'trainer') {
    await createNotification({
      userId: conversation.student,
      title: 'Trainer Replied',
      message: `Your trainer sent you a message`,
      type: 'general',
      relatedEntity: 'message',
      relatedId: msg._id,
    });
  } else if (req.user.role === 'student') {
    await createNotification({
      userId: conversation.trainer,
      title: 'New Message',
      message: `A student sent you a message`,
      type: 'general',
      relatedEntity: 'message',
      relatedId: msg._id,
    });
  }

  res.status(201).json({ success: true, data: { message: populated } });
});

// ─── Get Trainer's Internships (for dropdown) ───────────────────────────────
export const getTrainerInternships = asyncHandler(async (req, res) => {
  const trainerId = req.user._id;

  // Primary: Find internships through students assigned to this trainer
  const assignedStudents = await Student.find({
    assignedTrainer: trainerId,
    currentInternship: { $exists: true, $ne: null },
    deletedAt: null,
  }).select('currentInternship').distinct('currentInternship');

  // Also find internships directly linked to this trainer
  const directInternships = await Internship.find({
    $or: [
      { assignedTrainer: trainerId },
      { createdBy: trainerId },
    ],
    isDeleted: false,
  }).select('_id');

  // Combine all internship IDs
  const allInternshipIds = new Set([
    ...assignedStudents.map(id => id.toString()),
    ...directInternships.map(i => i._id.toString()),
  ]);

  // Also find internships through tasks assigned by this trainer
  const taskInternships = await Task.find({ assignedBy: trainerId, internshipId: { $exists: true, $ne: null } })
    .select('internshipId').distinct('internshipId');
  taskInternships.forEach(id => allInternshipIds.add(id.toString()));

  // Fetch the actual internship documents
  const internships = await Internship.find({
    _id: { $in: [...allInternshipIds].map(id => new mongoose.Types.ObjectId(id)) },
    isDeleted: false,
  }).select('title category status startDate endDate');

  // Collapse internships that share the same title into a single dropdown
  // entry so the trainer sees one option per program (not one per cohort).
  const grouped = new Map();
  internships.forEach((i) => {
    const key = (i.title || '').trim().toLowerCase();
    if (!key) return;
    if (!grouped.has(key)) {
      grouped.set(key, { ...i.toObject(), ids: [i._id] });
    } else {
      grouped.get(key).ids.push(i._id);
    }
  });

  res.status(200).json({ success: true, data: { internships: [...grouped.values()] } });
});

// ─── Get Students for Internship (trainer view) ─────────────────────────────
export const getInternshipStudents = asyncHandler(async (req, res) => {
  const { internshipId } = req.params;
  const trainerId = req.user._id;

  // Merge same-title internships so all students across every cohort of this
  // program are listed together under one internship.
  const siblingIds = await resolveSiblingInternshipIds(internshipId) || [internshipId];

  // Find students assigned to this trainer for this internship
  let students = await Student.find({
    assignedTrainer: trainerId,
    currentInternship: { $in: siblingIds },
    deletedAt: null,
  }).select('name email firstName lastName avatar collegeName course year currentInternship');

  // Also find students who have tasks in this internship assigned by this trainer
  const existingIds = new Set(students.map(s => s._id.toString()));
  const taskStudentIds = await Task.find({
    assignedBy: trainerId,
    internshipId: { $in: siblingIds },
  }).select('assignedTo').distinct('assignedTo');

  const additionalStudents = await Student.find({
    _id: { $in: taskStudentIds.filter(id => !existingIds.has(id.toString())) },
    deletedAt: null,
  }).select('name email firstName lastName avatar collegeName course year currentInternship');

  students = [...students, ...additionalStudents];

  // Add online status
  const onlineUsers = getOnlineUsers();
  const result = students.map(s => ({
    ...s.toObject(),
    online: onlineUsers.has(s._id.toString()),
  }));

  res.status(200).json({ success: true, data: { students: result } });
});

// ─── Admin: Get All Conversations ───────────────────────────────────────────
export const getAdminConversations = asyncHandler(async (req, res) => {
  const { internshipId, search } = req.query;

  const query = {};
  if (internshipId) query.internship = internshipId;

  const conversations = await Conversation.find(query)
    .populate('student', 'name email firstName lastName avatar collegeName course')
    .populate('trainer', 'name email firstName lastName avatar')
    .populate('internship', 'title category status')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 })
    .limit(100);

  // Also find trainer-student pairs that don't have conversations yet
  const existingPairs = new Set(
    conversations.map(c => `${c.trainer?._id}-${c.student?._id}-${c.internship?._id}`)
  );

  // Find all students with assigned trainers and internships
  const assignedStudents = await Student.find({
    assignedTrainer: { $exists: true, $ne: null },
    currentInternship: { $exists: true, $ne: null },
    deletedAt: null,
  }).select('name email firstName lastName avatar collegeName course assignedTrainer currentInternship');

  // Auto-create missing conversations
  const newConvs = [];
  for (const student of assignedStudents) {
    const key = `${student.assignedTrainer}-${student._id}-${student.currentInternship}`;
    if (!existingPairs.has(key)) {
      try {
        const conv = await Conversation.create({
          internship: student.currentInternship,
          trainer: student.assignedTrainer,
          student: student._id,
          type: 'private',
        });
        newConvs.push(conv._id);
        existingPairs.add(key);
      } catch (err) {
        // Duplicate key error - skip
        console.log('[AutoCreate] Conversation already exists for', redactId(student._id));
      }
    }
  }

  // If we created new conversations, refetch
  let allConversations = conversations;
  if (newConvs.length > 0) {
    allConversations = await Conversation.find(query)
      .populate('student', 'name email firstName lastName avatar collegeName course')
      .populate('trainer', 'name email firstName lastName avatar')
      .populate('internship', 'title category status')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 })
      .limit(100);
  }

  res.status(200).json({ success: true, data: { conversations: allConversations } });
});

// ─── Admin: Close/Reopen Conversation ───────────────────────────────────────
export const toggleCloseConversation = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  conversation.isClosed = !conversation.isClosed;
  await conversation.save();

  res.status(200).json({
    success: true,
    message: conversation.isClosed ? 'Conversation closed' : 'Conversation reopened',
  });
});

// ─── Admin: Mute/Unmute User in Conversation ────────────────────────────────
export const toggleMuteUser = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { userId } = req.body;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  const existingIdx = conversation.mutedBy.findIndex(m => m.user.toString() === userId);
  if (existingIdx >= 0) {
    conversation.mutedBy.splice(existingIdx, 1);
  } else {
    conversation.mutedBy.push({ user: userId });
  }
  await conversation.save();

  res.status(200).json({
    success: true,
    message: existingIdx >= 0 ? 'User unmuted' : 'User muted',
  });
});

// ─── Delete Message (Admin) ─────────────────────────────────────────────────
export const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const msg = await Message.findById(messageId);
  if (!msg) {
    return res.status(404).json({ success: false, message: 'Message not found' });
  }

  // Only sender (within 10 min) or admin can delete
  if (msg.sender.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  if (req.user.role !== 'admin') {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (msg.createdAt < tenMinAgo) {
      return res.status(400).json({ success: false, message: 'Can only delete messages within 10 minutes' });
    }
  }

  msg.deleted = true;
  msg.deletedAt = new Date();
  msg.message = '[Message deleted]';
  await msg.save();

  res.status(200).json({ success: true, message: 'Message deleted' });
});

// ─── Get Pinned Messages ────────────────────────────────────────────────────
export const getPinnedMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  // SA-011: pinned messages belong to a private thread — enforce the same
  // membership check as getMessages before returning them.
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }
  if (!canAccessConversation(req.user, conversation)) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  const messages = await Message.find({
    conversation: conversationId,
    isPinned: true,
    deleted: false,
  })
    .populate('sender', 'name email firstName lastName avatar')
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, data: { messages } });
});

// ─── Get Online Users ───────────────────────────────────────────────────────
export const getOnlineUsersList = asyncHandler(async (req, res) => {
  const onlineUsers = getOnlineUsers();
  let userIds = Array.from(onlineUsers.keys());

  // SA-026: presence is scoped. A non-admin only learns which of the users they
  // actually share a conversation with are online, instead of the full platform
  // user-id presence map.
  if (req.user.role !== 'admin') {
    const convs = await Conversation.find({
      $or: [{ trainer: req.user._id }, { student: req.user._id }],
    }).select('trainer student');

    const peers = new Set([String(req.user._id)]);
    convs.forEach((c) => {
      if (c.trainer) peers.add(String(c.trainer?._id ?? c.trainer));
      if (c.student) peers.add(String(c.student?._id ?? c.student));
    });

    userIds = userIds.filter((id) => peers.has(String(id)));
  }

  res.status(200).json({
    success: true,
    data: { onlineUsers: userIds, count: userIds.length },
  });
});

