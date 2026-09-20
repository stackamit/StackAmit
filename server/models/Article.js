import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Article author is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    type: {
      type: String,
      enum: ['course', 'tutorial', 'blog', 'guide', 'other'],
      default: 'blog',
    },
    category: {
      type: String,
      trim: true,
      maxlength: [60, 'Category cannot exceed 60 characters'],
      default: '',
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
      default: '',
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    coverImage: {
      public_id: String,
      url: String,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: [30, 'Tag cannot exceed 30 characters'],
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    readTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
articleSchema.index({ status: 1, createdAt: -1 });
articleSchema.index({ author: 1, status: 1 });
articleSchema.index({ type: 1, status: 1 });
articleSchema.index({ tags: 1 });
articleSchema.index({ views: -1 });

const Article = mongoose.model('Article', articleSchema);
export default Article;

