import Trainer from '../models/Trainer.js';
import Student from '../models/Student.js';
import Internship from '../models/Internship.js';
import { generateTempPassword } from '../services/auth.service.js';
import { sendWelcomeTrainerEmail } from '../services/email.service.js';
import { logActivity } from '../services/activityLog.service.js';
import { createNotification, notifyAdmins } from '../services/notification.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// ─── Create Trainer (Admin) ──────────────────────────────────────────────────
export const createTrainer = asyncHandler(async (req, res) => {
  const { name, email, phone, password, bio, expertise } = req.body;

  const existing = await Trainer.findOne({ email });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already exists' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  const trainer = await Trainer.create({
    name,
    email,
    password,
    phone,
    bio,
    expertise: expertise || [],
    role: 'trainer',
    isVerified: true,
    mustChangePassword: false,
  });

  await sendWelcomeTrainerEmail(email, name, password);

  await logActivity({
    userId: req.user._id,
    action: 'create',
    entity: 'trainer',
    entityId: trainer._id,
    details: { email, name },
    req,
  });

  // Notify other admins about new trainer
  await notifyAdmins({
    title: 'New Trainer Added',
    message: `Trainer "${name}" has been added to the system.`,
    type: 'general',
    relatedEntity: 'user',
    relatedId: trainer._id,
    excludeUserId: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: 'Trainer created successfully',
    data: { trainer },
  });
});

// ─── Get All Trainers ────────────────────────────────────────────────────────
export const getAllTrainers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, sortBy = 'createdAt', order = 'desc' } = req.query;

  const query = { role: 'trainer', deletedAt: null };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: order === 'asc' ? 1 : -1 };

  const [trainers, total] = await Promise.all([
    Trainer.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
    Trainer.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: { trainers, total, pages: Math.ceil(total / limit), page: parseInt(page) },
  });
});

// ─── Get Trainer by ID ───────────────────────────────────────────────────────
export const getTrainerById = asyncHandler(async (req, res) => {
  const trainer = await Trainer.findById(req.params.id)
    .populate('assignedStudents', 'name email avatar collegeName course branch year phone isActive profileCompletion currentInternship')
    .populate({
      path: 'assignedStudents',
      populate: { path: 'currentInternship', select: 'title category status' }
    });
  if (!trainer) {
    return res.status(404).json({ success: false, message: 'Trainer not found' });
  }
  res.status(200).json({ success: true, data: { trainer } });
});

// ─── Update Trainer ──────────────────────────────────────────────────────────
export const updateTrainer = asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'phone', 'bio', 'expertise', 'maxStudents'];
  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) {
    return res.status(404).json({ success: false, message: 'Trainer not found' });
  }

  Object.assign(trainer, updates);
  await trainer.save();

  await logActivity({
    userId: req.user._id,
    action: 'update',
    entity: 'trainer',
    entityId: trainer._id,
    details: { fields: Object.keys(updates) },
    req,
  });

  res.status(200).json({ success: true, message: 'Trainer updated', data: { trainer } });
});

// ─── Update Trainer Profile (Self) ──────────────────────────────────────────
export const updateTrainerProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'phone', 'bio', 'expertise'];
  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const trainer = await Trainer.findById(req.user._id);
  if (!trainer) {
    return res.status(404).json({ success: false, message: 'Trainer not found' });
  }

  Object.assign(trainer, updates);
  await trainer.save();

  res.status(200).json({ success: true, message: 'Profile updated', data: { trainer } });
});

// ─── Assign Students to Trainer ──────────────────────────────────────────────
export const assignStudents = asyncHandler(async (req, res) => {
  const { studentIds, internshipId } = req.body;
  const trainer = await Trainer.findById(req.params.id);

  if (!trainer) {
    return res.status(404).json({ success: false, message: 'Trainer not found' });
  }

  // Check capacity
  const availableSlots = trainer.maxStudents - trainer.assignedStudents.length;
  if (studentIds.length > availableSlots) {
    return res.status(400).json({
      success: false,
      message: `Trainer can only accept ${availableSlots} more students`,
    });
  }

  // Add students
  studentIds.forEach((id) => {
    if (!trainer.assignedStudents.includes(id)) {
      trainer.assignedStudents.push(id);
    }
  });
  await trainer.save();

  // Update students with trainer and optionally internship
  const studentUpdate = { $set: { assignedTrainer: trainer._id } };
  if (internshipId) {
    studentUpdate.$set.currentInternship = internshipId;
  }
  const updateResult = await Student.updateMany(
    { _id: { $in: studentIds } },
    studentUpdate
  );
  console.log('[AssignStudents] Updated', updateResult.modifiedCount, 'of', studentIds.length, 'students. Trainer:', trainer._id);

  // If internship specified, update seats filled
  if (internshipId) {
    await Internship.findByIdAndUpdate(internshipId, {
      $inc: { 'seats.filled': studentIds.length }
    });
  }

  // Notify students
  for (const studentId of studentIds) {
    await createNotification({
      userId: studentId,
      title: 'Trainer Assigned',
      message: `You have been assigned to trainer ${trainer.name}`,
      type: 'general',
    });
  }

  await logActivity({
    userId: req.user._id,
    action: 'assign',
    entity: 'trainer',
    entityId: trainer._id,
    details: { studentIds, internshipId },
    req,
  });

  res.status(200).json({
    success: true,
    message: `${studentIds.length} student(s) assigned to trainer`,
    data: { trainer },
  });
});

// ─── Remove Student from Trainer ─────────────────────────────────────────────
export const removeStudent = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const trainer = await Trainer.findById(req.params.id);

  if (!trainer) {
    return res.status(404).json({ success: false, message: 'Trainer not found' });
  }

  trainer.assignedStudents = trainer.assignedStudents.filter(
    (id) => id.toString() !== studentId
  );
  await trainer.save();

  await Student.findByIdAndUpdate(studentId, { $unset: { assignedTrainer: 1 } });

  res.status(200).json({ success: true, message: 'Student removed from trainer' });
});

// ─── Toggle Trainer Status ──────────────────────────────────────────────────
export const toggleTrainerStatus = asyncHandler(async (req, res) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) {
    return res.status(404).json({ success: false, message: 'Trainer not found' });
  }

  trainer.isActive = !trainer.isActive;
  await trainer.save();

  await logActivity({
    userId: req.user._id,
    action: trainer.isActive ? 'activate' : 'suspend',
    entity: 'trainer',
    entityId: trainer._id,
    req,
  });

  // Notify admins about status change
  await notifyAdmins({
    title: `Trainer ${trainer.isActive ? 'Activated' : 'Suspended'}`,
    message: `Trainer "${trainer.name}" has been ${trainer.isActive ? 'activated' : 'suspended'}.`,
    type: 'general',
    relatedEntity: 'user',
    relatedId: trainer._id,
    excludeUserId: req.user._id,
  });

  res.status(200).json({
    success: true,
    message: `Trainer ${trainer.isActive ? 'activated' : 'suspended'}`,
    data: { isActive: trainer.isActive },
  });
});

// ─── Delete Trainer (Soft) ──────────────────────────────────────────────────
export const deleteTrainer = asyncHandler(async (req, res) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) {
    return res.status(404).json({ success: false, message: 'Trainer not found' });
  }

  await trainer.softDelete();

  await logActivity({
    userId: req.user._id,
    action: 'delete',
    entity: 'trainer',
    entityId: trainer._id,
    req,
  });

  // Notify admins about trainer deletion
  await notifyAdmins({
    title: 'Trainer Removed',
    message: `Trainer "${trainer.name}" has been removed from the system.`,
    type: 'general',
    relatedEntity: 'user',
    relatedId: trainer._id,
    excludeUserId: req.user._id,
  });

  res.status(200).json({ success: true, message: 'Trainer deleted' });
});

// ─── Reset Trainer Password ─────────────────────────────────────────────────
export const resetTrainerPassword = asyncHandler(async (req, res) => {
  const trainer = await Trainer.findById(req.params.id).select('+password');
  if (!trainer) {
    return res.status(404).json({ success: false, message: 'Trainer not found' });
  }

  const tempPassword = generateTempPassword();
  trainer.password = tempPassword;
  trainer.mustChangePassword = true;
  await trainer.save();

  res.status(200).json({
    success: true,
    message: 'Password reset',
    data: { tempPassword },
  });
});

// ─── Get Trainers Stats ─────────────────────────────────────────────────────
export const getTrainersStats = asyncHandler(async (req, res) => {
  const [total, active] = await Promise.all([
    Trainer.countDocuments({ role: 'trainer', deletedAt: null }),
    Trainer.countDocuments({ role: 'trainer', isActive: true, deletedAt: null }),
  ]);

  res.status(200).json({ success: true, data: { total, active, inactive: total - active } });
});
