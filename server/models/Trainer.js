import mongoose from 'mongoose';
import User from './User.js';

const trainerSchema = new mongoose.Schema({
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    trim: true,
  },
  expertise: [{
    type: String,
    trim: true,
  }],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  assignedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'student',
  }],
  maxStudents: {
    type: Number,
    default: 20,
    min: 1,
  },
  totalInternships: {
    type: Number,
    default: 0,
  },
  totalTasksAssigned: {
    type: Number,
    default: 0,
  },
  averageStudentRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
});

// Virtual for student count
trainerSchema.virtual('studentCount').get(function () {
  return this.assignedStudents?.length || 0;
});

// Check if trainer has capacity
trainerSchema.methods.hasCapacity = function () {
  return this.assignedStudents.length < this.maxStudents;
};

// Indexes
trainerSchema.index({ 'email': 1 });
trainerSchema.index({ 'expertise': 1 });

const Trainer = User.discriminator('trainer', trainerSchema);
export default Trainer;
