import mongoose from 'mongoose';

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
  }
);

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ internshipId: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ priority: 1 });

const Task = mongoose.model('Task', taskSchema);
export default Task;
