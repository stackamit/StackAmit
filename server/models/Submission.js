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
    // Submission-editing support: `versions` increments on every student
    // update, `lastUpdatedAt` marks the latest edit (kept separate from
    // submittedDate so the original submission time is preserved), and
    // isLateSubmission records that the work landed after the original
    // deadline but inside the 48-hour late window.
    versions: { type: Number, default: 1, min: 1 },
    lastUpdatedAt: { type: Date, default: null },
    isLateSubmission: { type: Boolean, default: false },
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

submissionSchema.index({ studentId: 1, status: 1 });
// One submission per student per task, enforced at the DB level so two
// concurrent first-submit requests can never create duplicate records.
// This index also serves all former {taskId, studentId} lookups.
// NOTE: before deploying, run scripts/checkSubmissionDuplicates.mjs against
// the target database — creating a unique index fails if legacy duplicates
// exist. The script is read-only and never deletes records.
submissionSchema.index({ taskId: 1, studentId: 1 }, { unique: true });

const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;
