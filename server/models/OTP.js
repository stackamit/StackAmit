import mongoose from 'mongoose';
import crypto from 'crypto';

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['registration', 'password_reset', 'email_verification'],
      default: 'registration',
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

otpSchema.index({ email: 1, purpose: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Generate 6-digit OTP (SA-017): cryptographically secure randomness.
// Math.random() is a predictable PRNG and must never be used for security
// tokens. crypto.randomInt is uniformly distributed over an unguessable range.
otpSchema.statics.generateOTP = () => crypto.randomInt(100000, 1000000).toString();

const OTP = mongoose.model('OTP', otpSchema);
export default OTP;
