import mongoose from 'mongoose';

/**
 * Media
 * Lightweight index of every image/file uploaded to Cloudinary through the
 * shared /api/upload endpoints. Powers the in-app "Media Library" so users can
 * reuse already-hosted assets (e.g. article cover images) instead of uploading
 * a fresh copy — this keeps storage down and loads faster thanks to cached URLs.
 */
const mediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, 'Media URL is required'],
    },
    public_id: {
      type: String,
      required: [true, 'Media public_id is required'],
      index: true,
    },
    folder: {
      type: String,
      default: 'general',
    },
    resource_type: {
      type: String,
      enum: ['image', 'raw', 'video', 'auto'],
      default: 'image',
    },
    format: String,
    size: Number,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
  },
  { timestamps: true }
);

// Common query: newest media for a given user
mediaSchema.index({ uploadedBy: 1, createdAt: -1 });

const Media = mongoose.model('Media', mediaSchema);
export default Media;
