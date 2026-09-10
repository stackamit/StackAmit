import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    internship: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Internship',
      required: true,
    },
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'trainer',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'student',
      required: true,
    },
    type: {
      type: String,
      enum: ['private', 'group', 'announcement'],
      default: 'private',
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    lastMessageAt: Date,
    unreadTrainer: { type: Number, default: 0 },
    unreadStudent: { type: Number, default: 0 },
    isClosed: { type: Boolean, default: false },
    mutedBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      mutedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

// One private conversation per trainer-student pair per internship
conversationSchema.index({ internship: 1, trainer: 1, student: 1, type: 1 }, { unique: true });
conversationSchema.index({ student: 1, type: 1 });
conversationSchema.index({ trainer: 1, type: 1 });
conversationSchema.index({ lastMessageAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
