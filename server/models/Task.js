import mongoose from 'mongoose';
import { SUBMISSION_GRACE_MS } from '../utils/submissionWindow.js';

const deadlineExtensionSchema = new mongoose.Schema(
  {
    previousDeadline: { type: Date, required: true },
    newDeadline: { type: Date, required: true },
    extendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    extendedByName: String,
    extendedByRole: String,
    reason: String,
    extendedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Task description is required'],
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'trainer',
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'student',
      required: true,
    },
    internshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Internship',
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    // Submission-management fields (task submission lifecycle enhancement).
    // effectiveDueDate is the currently *effective* deadline: identical to
    // dueDate until an admin/trainer extends it. The original dueDate is never
    // overwritten, so both stay distinguishable. deadlineExtensions keeps the
    // full audit history of legitimate extensions.
    effectiveDueDate: { type: Date },
    deadlineExtensions: [deadlineExtensionSchema],
    // Set by the scheduled closure job (48h after the effective deadline) or
    // reviewed out of band. Null = window still open. Reopening clears it.
    submissionClosedAt: { type: Date, default: null },
    // Atomic claim for the deadline reminder (one reminder per deadline).
    reminderSentAt: { type: Date, default: null },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    attachments: [{
      public_id: String,
      url: String,
      filename: String,
      size: Number,
    }],
    instructions: String,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'late', 'cancelled'],
      default: 'pending',
    },
    marks: {
      obtained: { type: Number, min: 0 },
      total: { type: Number, min: 0 },
    },
    remarks: String,
    completedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Derived submission-window facts (single source of truth for the UI) ────
// Computed from stored timestamps only, so they are stable and testable; the
// authoritative allow/deny decision still lives in the backend submit handler.
taskSchema.virtual('submissionClosesAt').get(function () {
  const deadline = this.effectiveDueDate || this.dueDate;
  return deadline ? new Date(deadline.getTime() + SUBMISSION_GRACE_MS) : undefined;
});
taskSchema.virtual('isSubmissionClosed').get(function () {
  return Boolean(this.submissionClosedAt);
});
taskSchema.virtual('isDeadlineExtended').get(function () {
  return (
    Boolean(this.effectiveDueDate) &&
    this.deadlineExtensions?.length > 0 &&
    this.effectiveDueDate.getTime() !== this.dueDate?.getTime()
  );
});

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ internshipId: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ effectiveDueDate: 1 });
// Scheduled-job scans: tasks whose window has closed but were never stamped.
taskSchema.index({ submissionClosedAt: 1, effectiveDueDate: 1 });
// Scheduled-reminder scan: pending tasks at/past their deadline, unclaimed.
taskSchema.index({ status: 1, dueDate: 1, reminderSentAt: 1 });

const Task = mongoose.model('Task', taskSchema);
export default Task;
