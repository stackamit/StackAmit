import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['admin', 'trainer', 'student'],
      required: true,
    },
    message: {
      type: String,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    messageType: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'PDF', 'DOCUMENT', 'VIDEO', 'AUDIO', 'ZIP', 'CODE', 'ANNOUNCEMENT', 'SYSTEM'],
      default: 'TEXT',
    },
    attachment: {
      public_id: String,
      url: String,
      originalName: String,
      size: Number,
      mimeType: String,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    isPinned: { type: Boolean, default: false },
    isImportant: { type: Boolean, default: false },
    edited: { type: Boolean, default: false },
    editedAt: Date,
    deleted: { type: Boolean, default: false },
    deletedAt: Date,
    readBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      readAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ messageType: 1 });
messageSchema.index({ isPinned: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
