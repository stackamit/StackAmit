import mongoose from 'mongoose';

const internshipSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      enum: [
        'Web Development', 'Mobile Development', 'Data Science',
        'Machine Learning', 'UI/UX Design', 'Digital Marketing',
        'Cloud Computing', 'Cyber Security', 'DevOps', 'Blockchain',
        'Artificial Intelligence', 'Business Analytics', 'Other'
      ],
    },
    duration: {
      weeks: { type: Number, required: [true, 'Duration in weeks is required'], min: 1 },
      hoursPerWeek: { type: Number, default: 20, min: 1, max: 40 },
    },
    eligibility: {
      type: String,
      trim: true,
      maxlength: [1000, 'Eligibility cannot exceed 1000 characters'],
    },
    requirements: [{
      type: String,
      trim: true,
    }],
    skills: [{
      type: String,
      trim: true,
    }],
    responsibilities: [{
      type: String,
      trim: true,
    }],
    learningOutcomes: [{
      type: String,
      trim: true,
    }],
    certificateType: {
      type: String,
      enum: ['completion', 'participation', 'merit'],
      default: 'completion',
    },
    seats: {
      total: { type: Number, required: [true, 'Total seats required'], min: 1 },
      filled: { type: Number, default: 0 },
    },
    deadline: {
      type: Date,
      required: [true, 'Application deadline is required'],
    },
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['published', 'closed', 'archived'],
      default: 'published',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'trainer',
      required: true,
    },
    assignedTrainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'trainer',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
internshipSchema.index({ title: 'text', description: 'text' });
internshipSchema.index({ category: 1, status: 1 });
internshipSchema.index({ deadline: 1 });
internshipSchema.index({ createdBy: 1 });
internshipSchema.index({ status: 1 });
internshipSchema.index({ createdAt: -1 });

// Virtual for available seats
internshipSchema.virtual('availableSeats').get(function () {
  return this.seats.total - this.seats.filled;
});

const Internship = mongoose.model('Internship', internshipSchema);
export default Internship;

