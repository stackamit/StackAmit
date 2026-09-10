import User from '../models/User.js';
import '../models/Admin.js'; // Register admin discriminator
import bcrypt from 'bcryptjs';

export const seedAdmin = async () => {
  try {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, BCRYPT_SALT } = process.env;

    if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
      console.warn('⚠️  Admin credentials not fully configured in .env');
      return;
    }

    const adminExists = await User.findOne({ role: 'admin' }).select('+password');

    if (adminExists) {
      // Verify the existing admin's password works
      const isMatch = await bcrypt.compare(ADMIN_PASSWORD, adminExists.password);
      if (isMatch) {
        console.log('ℹ️  Admin account already exists and password is valid');
      } else {
        // Password doesn't match (likely double-hashed from old bug) — fix it
        console.log('🔧  Admin password invalid, re-hashing with current .env credentials...');
        adminExists.password = ADMIN_PASSWORD;
        adminExists.isVerified = true;
        adminExists.mustChangePassword = false;
        adminExists.isActive = true;
        // The pre-save hook will hash the plain-text password
        await adminExists.save();
        console.log('✅ Admin password fixed successfully');
      }
      return;
    }

    // No admin exists — create one (plain-text password, pre-save hook hashes it)
    const admin = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
      isVerified: true,
      mustChangePassword: false,
      isActive: true,
    });

    console.log(`✅ Admin account created: ${admin.email}`);
  } catch (error) {
    console.error('❌ Admin seeding error:', error.message);
  }
};
