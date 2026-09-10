import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
      enum: [
        'create', 'update', 'delete', 'login', 'logout',
        'assign', 'unassign', 'approve', 'reject', 'suspend',
        'activate', 'deactivate', 'generate', 'revoke', 'export',
        'upload', 'download', 'reset_password', 'verify'
      ],
    },
    entity: {
      type: String,
      required: true,
      enum: [
        'user', 'student', 'trainer', 'internship', 'application',
        'task', 'submission', 'certificate', 'notification', 'setting'
      ],
    },
    entityId: mongoose.Schema.Types.ObjectId,
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ entity: 1, entityId: 1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
