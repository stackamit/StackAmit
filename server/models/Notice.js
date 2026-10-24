import mongoose from 'mongoose';

// Predefined categories — new values can be appended here without
// any structural change to the schema or the API.
export const NOTICE_CATEGORIES = [
  'Internship Updates',
  'Project Submission',
  'Important Announcements',
  'General Updates',
  'Maintenance & Service Updates',
  'Events & Training',
];

export const NOTICE_PRIORITIES = ['normal', 'important', 'urgent'];

// Editorial statuses stored in DB. "Expired" is never stored — it is
// derived from expiresAt + current time so visibility never depends on
// a background job running on schedule.
export const NOTICE_EDITORIAL_STATUSES = ['draft', 'scheduled', 'published', 'unpublished'];

export const NOTICE_TARGET_PAGES = ['home', 'contact'];

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Notice title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    summary: {
      type: String,
      trim: true,
      maxlength: [500, 'Summary cannot exceed 500 characters'],
      default: '',
    },
    content: {
      type: String,
      required: [true, 'Notice message is required'],
      maxlength: [10000, 'Notice message cannot exceed 10000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      enum: {
        values: NOTICE_CATEGORIES,
        message: 'Invalid notice category',
      },
    },
    priority: {
      type: String,
      required: [true, 'Priority is required'],
      enum: {
        values: NOTICE_PRIORITIES,
        message: 'Invalid notice priority. Allowed: normal, important, urgent',
      },
      default: 'normal',
    },
    targetPages: {
      type: [String],
      required: [true, 'At least one target page is required'],
      validate: {
        validator: (pages) =>
          pages.length > 0 && pages.every((p) => NOTICE_TARGET_PAGES.includes(p)),
        message: 'Target pages must be selected from: home, contact',
      },
    },
    actionLabel: {
      type: String,
      trim: true,
      maxlength: [40, 'Action label cannot exceed 40 characters'],
      default: '',
    },
    actionUrl: {
      type: String,
      trim: true,
      maxlength: [500, 'Action URL cannot exceed 500 characters'],
      default: '',
      validate: {
        validator: (url) => {
          if (!url) return true;
          // Internal route or safe http(s) external link only
          return url.startsWith('/') || /^https?:\/\//i.test(url);
        },
        message: 'Action URL must be an internal path or an http(s) URL',
      },
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    editorialStatus: {
      type: String,
      enum: {
        values: NOTICE_EDITORIAL_STATUSES,
        message: 'Invalid status. Allowed: draft, scheduled, published, unpublished',
      },
      default: 'draft',
    },
    publishAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes supporting admin filters and public visibility queries
noticeSchema.index({ editorialStatus: 1, publishAt: 1, expiresAt: 1 });
noticeSchema.index({ targetPages: 1, editorialStatus: 1 });
noticeSchema.index({ category: 1 });
noticeSchema.index({ priority: 1 });
noticeSchema.index({ createdAt: -1 });
noticeSchema.index({ title: 'text', summary: 'text', content: 'text' });

// Effective public status derived from editorial status + current time.
// This is what the admin UI shows ("Expired" is never stored).
noticeSchema.virtual('effectiveStatus').get(function () {
  const now = new Date();

  if (this.editorialStatus === 'draft') return 'draft';
  if (this.editorialStatus === 'unpublished') return 'unpublished';

  if (this.expiresAt && this.expiresAt <= now) return 'expired';

  if (this.editorialStatus === 'published') return 'published';

  // scheduled
  if (this.publishAt && this.publishAt <= now) return 'published';
  return 'scheduled';
});

noticeSchema.set('toJSON', { virtuals: true });
noticeSchema.set('toObject', { virtuals: true });

const Notice = mongoose.model('Notice', noticeSchema);
export default Notice;

