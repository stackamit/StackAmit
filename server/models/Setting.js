import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    category: {
      type: String,
      enum: ['company', 'email', 'storage', 'certificate', 'website', 'security', 'confidential', 'general'],
      default: 'general',
    },
    description: String,
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

settingSchema.index({ category: 1 });

const Setting = mongoose.model('Setting', settingSchema);
export default Setting;
