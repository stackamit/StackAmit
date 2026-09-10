import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'student',
      required: true,
    },
    files: [{
      public_id: String,
      url: String,
      filename: String,
      size: Number,
    }],
    githubLink: {
      type: String,
      trim: true,
    },
    liveUrl: {
      type: String,
      trim: true,
    },
    documentation: {
      type: String,
      maxlength: [5000, 'Documentation cannot exceed 5000 characters'],
    },
    videoDemo: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      maxlength: [2000, 'Remarks cannot exceed 2000 characters'],
    },
    submittedDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['submitted', 'approved', 'rejected', 'resubmission_requested'],
      default: 'submitted',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'trainer',
    },
    reviewedAt: Date,
    reviewNotes: String,
    marks: {
      obtained: { type: Number, min: 0 },
      total: { type: Number, min: 0 },
    },
  },
  {
    timestamps: true,
  }
);

submissionSchema.index({ taskId: 1, studentId: 1 });
submissionSchema.index({ studentId: 1, status: 1 });

const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;
