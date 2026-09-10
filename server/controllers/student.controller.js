import Student from '../models/Student.js';
import User from '../models/User.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/cloudinary.service.js';
import { logActivity } from '../services/activityLog.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// ─── Get All Students (Admin/Trainer) ────────────────────────────────────────
export const getAllStudents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, college, status, sortBy = 'createdAt', order = 'desc' } = req.query;

  const query = { role: 'student' };

  // Trainer can only see students assigned to them
  if (req.user.role === 'trainer') {
    query.assignedTrainer = req.user._id;
    console.log('[Students] Trainer filter - trainerId:', req.user._id);
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
    ];
  }
  if (college) query.collegeName = college;
  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: order === 'asc' ? 1 : -1 };

  const [students, total] = await Promise.all([
    Student.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignedTrainer', 'name email')
      .populate('currentInternship', 'title category status'),
    Student.countDocuments(query),
  ]);

  console.log('[Students] Found', students.length, 'of', total, 'total for role:', req.user.role);
  res.status(200).json({
    success: true,
    data: { students, total, pages: Math.ceil(total / limit), page: parseInt(page) },
  });
});

// ─── Get Student by ID ───────────────────────────────────────────────────────
export const getStudentById = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }
  res.status(200).json({ success: true, data: { student } });
});

// ─── Update Student Profile ──────────────────────────────────────────────────
export const updateStudentProfile = asyncHandler(async (req, res) => {
  const allowedFields = [
    'firstName', 'lastName', 'phone', 'gender', 'dob',
    'collegeName', 'university', 'course', 'branch', 'year',
    'address', 'city', 'state', 'country', 'pinCode',
    'linkedIn', 'gitHub', 'skills',
  ];

  const updates = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const student = await Student.findById(req.user._id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  Object.assign(student, updates);
  student.calculateProfileCompletion();
  await student.save();

  await logActivity({
    userId: student._id,
    action: 'update',
    entity: 'student',
    entityId: student._id,
    details: { fields: Object.keys(updates) },
    req,
  });

  res.status(200).json({ success: true, message: 'Profile updated', data: { student } });
});

// ─── Admin Update Student ────────────────────────────────────────────────────
export const adminUpdateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  const updates = req.body;
  Object.assign(student, updates);
  student.calculateProfileCompletion();
  await student.save();

  await logActivity({
    userId: req.user._id,
    action: 'update',
    entity: 'student',
    entityId: student._id,
    details: { fields: Object.keys(updates) },
    req,
  });

  res.status(200).json({ success: true, message: 'Student updated', data: { student } });
});

// ─── Upload Resume ──────────────────────────────────────────────────────────
export const uploadResume = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a PDF file' });
  }

  const student = await Student.findById(req.user._id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  // Delete old resume if exists
  if (student.resume?.public_id) {
    await deleteFromCloudinary(student.resume.public_id);
  }

  const result = await uploadToCloudinary(req.file.buffer, 'resumes', 'raw');

  student.resume = { public_id: result.public_id, url: result.url };
  student.calculateProfileCompletion();
  await student.save();

  res.status(200).json({
    success: true,
    message: 'Resume uploaded successfully',
    data: { resume: student.resume },
  });
});

// ─── Upload Avatar ──────────────────────────────────────────────────────────
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload an image' });
  }

  const user = await User.findById(req.user._id);
  if (user.avatar?.public_id) {
    await deleteFromCloudinary(user.avatar.public_id);
  }

  const result = await uploadToCloudinary(req.file.buffer, 'avatars', 'image');
  user.avatar = { public_id: result.public_id, url: result.url };
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Avatar uploaded successfully',
    data: { avatar: user.avatar },
  });
});

// ─── Suspend / Activate Student ──────────────────────────────────────────────
export const toggleStudentStatus = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  student.isActive = !student.isActive;
  await student.save();

  await logActivity({
    userId: req.user._id,
    action: student.isActive ? 'activate' : 'suspend',
    entity: 'student',
    entityId: student._id,
    req,
  });

  res.status(200).json({
    success: true,
    message: `Student ${student.isActive ? 'activated' : 'suspended'} successfully`,
    data: { isActive: student.isActive },
  });
});

// ─── Delete Student (Soft) ──────────────────────────────────────────────────
export const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  await student.softDelete();

  await logActivity({
    userId: req.user._id,
    action: 'delete',
    entity: 'student',
    entityId: student._id,
    req,
  });

  res.status(200).json({ success: true, message: 'Student deleted successfully' });
});

// ─── Reset Student Password (Admin) ─────────────────────────────────────────
export const resetStudentPassword = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).select('+password');
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  const { generateTempPassword } = await import('../services/auth.service.js');
  const tempPassword = generateTempPassword();

  student.password = tempPassword;
  student.mustChangePassword = true;
  await student.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successfully',
    data: { tempPassword },
  });
});

// ─── Get Students Stats (Admin) ──────────────────────────────────────────────
export const getStudentsStats = asyncHandler(async (req, res) => {
  const [total, active, verified] = await Promise.all([
    Student.countDocuments({ role: 'student', deletedAt: null }),
    Student.countDocuments({ role: 'student', isActive: true, deletedAt: null }),
    Student.countDocuments({ role: 'student', isVerified: true, deletedAt: null }),
  ]);

  res.status(200).json({
    success: true,
    data: { total, active, verified, inactive: total - active },
  });
});
