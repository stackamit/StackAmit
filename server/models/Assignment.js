import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'trainer',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'student',
      required: true,
    },
    internshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Internship',
      required: true,
    },
    assignedDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'transferred', 'removed'],
      default: 'active',
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    notes: String,
  },
  {
    timestamps: true,
  }
);

assignmentSchema.index({ trainerId: 1, studentId: 1 });
assignmentSchema.index({ studentId: 1, internshipId: 1 });
assignmentSchema.index({ status: 1 });

const Assignment = mongoose.model('Assignment', assignmentSchema);
export default Assignment;
