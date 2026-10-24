import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      // SA-034: align the model floor with the auth validator (8) so any path
      // that creates/updates a password WITHOUT the express-validator layer
      // (seedAdmin, admin-created users) can no longer accept a 6-char secret.
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'trainer', 'student'],
      default: 'student',
    },
    avatar: {
      public_id: String,
      url: String,
    },
    phone: {
      type: String,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    mustChangePassword: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: String,
    // SA-021: SHA-256 digest of the active refresh token. New records store this
    // only (raw refreshToken stays null); the legacy plaintext field remains for
    // one release so pre-existing sessions can still be verified during the
    // transition and is removed once every record is migrated.
    refreshTokenHash: String,
    lastLogin: Date,
    deletedAt: Date,
  },
  {
    timestamps: true,
    discriminatorKey: 'role',
  }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT) || 12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  // SA-021: never expose the refresh-token digest either.
  delete obj.refreshTokenHash;
  return obj;
};

// Soft delete
userSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  this.isActive = false;
  return this.save();
};

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model('User', userSchema);
export default User;
