import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
    },
    type: {
      type: String,
      enum: [
        'task_assigned', 'task_reminder', 'task_completed',
        'project_approved', 'project_rejected', 'resubmission_requested',
        'certificate_issued', 'internship_approved', 'internship_rejected',
        'internship_completed', 'application_status', 'welcome',
        'password_reset', 'offer_letter', 'general'
      ],
      default: 'general',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    relatedEntity: {
      type: String,
      enum: ['task', 'internship', 'application', 'certificate', 'submission', 'user', 'message'],
    },
    relatedId: mongoose.Schema.Types.ObjectId,
    actionUrl: String,
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
