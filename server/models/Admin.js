import mongoose from 'mongoose';
import User from './User.js';

// Admin discriminator — inherits all fields from User, no additional fields needed
const adminSchema = new mongoose.Schema({});

const Admin = User.discriminator('admin', adminSchema);
export default Admin;
