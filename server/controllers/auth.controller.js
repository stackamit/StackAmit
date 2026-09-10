import User from '../models/User.js';
import Student from '../models/Student.js';
import OTP from '../models/OTP.js';
import {
  generateAccessToken,
  generateRefreshToken,
  generateTempPassword,
  verifyRefreshToken,
  setTokenCookies,
  clearTokenCookies,
} from '../services/auth.service.js';
import {
  sendWelcomeStudentEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
} from '../services/email.service.js';
import { logActivity } from '../services/activityLog.service.js';
import { createNotification } from '../services/notification.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// ─── Register (Student Only) ─────────────────────────────────────────────────
export const register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, phone, gender, dob, collegeName, university, course, branch, year } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }

  // Generate OTP
  const otp = OTP.generateOTP();
  await OTP.create({
    email,
    otp,
    purpose: 'registration',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  // Create student (unverified)
  const student = await Student.create({
    name: `${firstName} ${lastName}`,
    email,
    password,
    role: 'student',
    firstName,
    lastName,
    phone,
    gender,
    dob,
    collegeName,
    university,
    course,
    branch,
    year,
    isVerified: false,
    mustChangePassword: false,
  });

  // Send OTP email
  await sendOTPEmail(email, otp, 'registration');

  await logActivity({
    userId: student._id,
    action: 'create',
    entity: 'student',
    entityId: student._id,
    details: { email },
    req,
  });

  res.status(201).json({
    success: true,
    message: 'Registration successful. Please verify your email with the OTP sent.',
    data: { studentId: student._id, email: student.email },
  });
});

// ─── Verify Email OTP ────────────────────────────────────────────────────────
export const verifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const otpRecord = await OTP.findOne({
    email,
    otp,
    purpose: 'registration',
    verified: false,
    expiresAt: { $gt: new Date() },
  });

  if (!otpRecord) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  // Mark OTP as verified
  otpRecord.verified = true;
  await otpRecord.save();

  // Activate student (keep their chosen password)
  const student = await Student.findOneAndUpdate(
    { email },
    { isVerified: true },
    { new: true }
  );

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  // Send welcome email (student keeps their chosen password)
  await sendWelcomeStudentEmail(email, student.name, null);

  // Create welcome notification
  await createNotification({
    userId: student._id,
    title: 'Welcome to StackAmit!',
    message: 'Your account has been verified successfully. You can now login and start exploring internships.',
    type: 'welcome',
    relatedEntity: 'user',
    relatedId: student._id,
  });

  res.status(200).json({
    success: true,
    message: 'Email verified successfully! You can now login with your credentials.',
  });
});

// ─── Resend OTP ──────────────────────────────────────────────────────────────
export const resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const student = await Student.findOne({ email });
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student not found' });
  }

  if (student.isVerified) {
    return res.status(400).json({ success: false, message: 'Email is already verified' });
  }

  // Delete any existing unverified OTPs for this email
  await OTP.deleteMany({ email, purpose: 'registration', verified: false });

  // Generate new OTP
  const otp = OTP.generateOTP();
  await OTP.create({
    email,
    otp,
    purpose: 'registration',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  // Send OTP email
  await sendOTPEmail(email, otp, 'registration');

  res.status(200).json({
    success: true,
    message: 'A new OTP has been sent to your email.',
  });
});

// ─── Login ───────────────────────────────────────────────────────────────────
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account has been deactivated' });
  }

  if (!user.isVerified) {
    return res.status(403).json({ success: false, message: 'Please verify your email first' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Save refresh token
  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  // Set cookies
  setTokenCookies(res, accessToken, refreshToken);

  await logActivity({
    userId: user._id,
    action: 'login',
    entity: 'user',
    entityId: user._id,
    req,
  });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: user.toJSON(),
      accessToken,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

// ─── Refresh Token ───────────────────────────────────────────────────────────
export const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No refresh token provided' });
  }

  const decoded = verifyRefreshToken(token);
  if (!decoded) {
    clearTokenCookies(res);
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }

  const user = await User.findById(decoded.id);
  if (!user || user.refreshToken !== token) {
    clearTokenCookies(res);
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }

  if (!user.isActive) {
    clearTokenCookies(res);
    return res.status(403).json({ success: false, message: 'Account has been deactivated' });
  }

  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  user.refreshToken = newRefreshToken;
  await user.save({ validateBeforeSave: false });

  setTokenCookies(res, newAccessToken, newRefreshToken);

  res.status(200).json({
    success: true,
    data: { accessToken: newAccessToken },
  });
});

// ─── Logout ──────────────────────────────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    user.refreshToken = null;
    await user.save({ validateBeforeSave: false });
  }

  clearTokenCookies(res);

  await logActivity({
    userId: req.user._id,
    action: 'logout',
    entity: 'user',
    entityId: req.user._id,
    req,
  });

  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// ─── Forgot Password ─────────────────────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal if email exists
    return res.status(200).json({
      success: true,
      message: 'If the email exists, an OTP has been sent.',
    });
  }

  const otp = OTP.generateOTP();
  await OTP.create({
    email,
    otp,
    purpose: 'password_reset',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  await sendOTPEmail(email, otp, 'password_reset');

  res.status(200).json({
    success: true,
    message: 'OTP sent to your email for password reset.',
  });
});

// ─── Reset Password ──────────────────────────────────────────────────────────
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const otpRecord = await OTP.findOne({
    email,
    otp,
    purpose: 'password_reset',
    verified: false,
    expiresAt: { $gt: new Date() },
  });

  if (!otpRecord) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  otpRecord.verified = true;
  await otpRecord.save();

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();

  await logActivity({
    userId: user._id,
    action: 'reset_password',
    entity: 'user',
    entityId: user._id,
    req,
  });

  res.status(200).json({
    success: true,
    message: 'Password reset successfully. Please login with your new password.',
  });
});

// ─── Change Password ─────────────────────────────────────────────────────────
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();

  await logActivity({
    userId: user._id,
    action: 'reset_password',
    entity: 'user',
    entityId: user._id,
    req,
  });

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

// ─── Get Current User ────────────────────────────────────────────────────────
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
});

// ─── Update Profile (any authenticated user) ─────────────────────────────────
export const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'phone'];
  const updates = {};

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid fields to update.',
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  await logActivity({
    userId: req.user._id,
    action: 'update',
    entity: 'user',
    entityId: user._id,
    details: { fields: Object.keys(updates) },
    req,
  });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully.',
    data: { user },
  });
});
