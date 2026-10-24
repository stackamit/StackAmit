import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  register, verifyEmail, resendOTP, login, logout, refreshToken,
  forgotPassword, resetPassword, changePassword, getMe, updateProfile, uploadAvatar,
} from '../controllers/auth.controller.js';
import {
  registerValidator, loginValidator, forgotPasswordValidator,
  verifyOTPValidator, resetPasswordValidator, changePasswordValidator,
} from '../validators/auth.validator.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// SA-020: every /api/auth response can carry a bearer access token (login /
// refresh bodies) or an httpOnly token cookie, so it must never be stored by
// the browser or any intermediary cache. Setting this once at the router level
// covers public and protected auth endpoints uniformly.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
});

// SA-018: a tight, dedicated throttle on the OTP-verification / password-reset
// endpoints. A 6-digit OTP is brute-forceable, so the global auth limiter
// (100/min) is far too permissive here. 10 failed attempts per IP per 15 min
// caps guessing without locking out legitimate users behind a shared NAT for
// normal use. Successful requests are skipped so verified users are unaffected.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts. Please try again later.',
  },
});

// SA-018: credential-stuffing / password-guessing throttle on /login. Tighter
// than the global auth limiter but sized to tolerate a normal household/office
// sharing one IP; only FAILED logins count (skipSuccessfulRequests) so genuine
// users are never locked out by this control.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
});

// Public routes
router.post('/register', registerValidator, validate, register);
router.post('/verify-email', otpLimiter, verifyOTPValidator, validate, verifyEmail);
router.post('/resend-otp', otpLimiter, resendOTP);
router.post('/login', loginLimiter, loginValidator, validate, login);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', otpLimiter, forgotPasswordValidator, validate, forgotPassword);
router.post('/reset-password', otpLimiter, resetPasswordValidator, validate, resetPassword);

// Protected routes
router.post('/logout', protect, logout);
router.post('/change-password', protect, changePasswordValidator, validate, changePassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

export default router;
