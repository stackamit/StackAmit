import mongoose from 'mongoose';
import User from './User.js';

const studentSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters'],
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters'],
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: [true, 'Gender is required'],
  },
  dob: {
    type: Date,
    required: [true, 'Date of birth is required'],
  },
  collegeName: {
    type: String,
    required: [true, 'College name is required'],
    trim: true,
  },
  university: {
    type: String,
    required: [true, 'University is required'],
    trim: true,
  },
  course: {
    type: String,
    required: [true, 'Course is required'],
    trim: true,
  },
  branch: {
    type: String,
    required: [true, 'Branch is required'],
    trim: true,
  },
  year: {
    type: String,
    required: [true, 'Year is required'],
    enum: ['1st', '2nd', '3rd', '4th', '5th'],
  },
  address: {
    type: String,
    trim: true,
  },
  city: {
    type: String,
    trim: true,
  },
  state: {
    type: String,
    trim: true,
  },
  country: {
    type: String,
    trim: true,
  },
  pinCode: {
    type: String,
    trim: true,
  },
  linkedIn: {
    type: String,
    trim: true,
    lowercase: true,
  },
  gitHub: {
    type: String,
    trim: true,
    lowercase: true,
  },
  resume: {
    public_id: String,
    url: String,
  },
  skills: [{
    type: String,
    trim: true,
  }],
  profileCompletion: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  currentInternship: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Internship',
  },
  assignedTrainer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'trainer',
  },
});

// Calculate profile completion
studentSchema.methods.calculateProfileCompletion = function () {
  const fields = [
    'firstName', 'lastName', 'gender', 'dob', 'collegeName', 'university',
    'course', 'branch', 'year', 'phone', 'address', 'city', 'state',
    'country', 'pinCode', 'linkedIn', 'gitHub', 'resume', 'skills'
  ];
  let filled = 0;
  fields.forEach(field => {
    const value = this[field] || this.get(field);
    if (value && (Array.isArray(value) ? value.length > 0 : true)) filled++;
  });
  this.profileCompletion = Math.round((filled / fields.length) * 100);
  return this.profileCompletion;
};

// Indexes
studentSchema.index({ 'email': 1 });
studentSchema.index({ 'collegeName': 1 });
studentSchema.index({ 'currentInternship': 1 });
studentSchema.index({ 'assignedTrainer': 1 });

const Student = User.discriminator('student', studentSchema);
export default Student;
