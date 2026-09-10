import ActivityLog from '../models/ActivityLog.js';

export const logActivity = async ({ userId, action, entity, entityId, details, req }) => {
  try {
    await ActivityLog.create({
      userId,
      action,
      entity,
      entityId,
      details,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (error) {
    console.error('Activity log error:', error.message);
  }
};

export const getRecentActivities = async (query = {}, limit = 20) => {
  return ActivityLog.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'name email avatar role');
};
