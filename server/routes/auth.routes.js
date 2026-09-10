import express from 'express';
import {
  register, verifyEmail, resendOTP, login, logout, refreshToken,
  forgotPassword, resetPassword, changePassword, getMe, updateProfile,
} from '../controllers/auth.controller.js';
import {
  registerValidator, loginValidator, forgotPasswordValidator,
  verifyOTPValidator, resetPasswordValidator, changePasswordValidator,
} from '../validators/auth.validator.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', registerValidator, validate, register);
router.post('/verify-email', verifyOTPValidator, validate, verifyEmail);
router.post('/resend-otp', resendOTP);
router.post('/login', loginValidator, validate, login);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', forgotPasswordValidator, validate, forgotPassword);
router.post('/reset-password', resetPasswordValidator, validate, resetPassword);

// Protected routes
router.post('/logout', protect, logout);
router.post('/change-password', protect, changePasswordValidator, validate, changePassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

export default router;
