import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const certificateSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'student',
      required: true,
    },
    internshipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Internship',
      required: true,
    },
    type: {
      type: String,
      enum: ['completion', 'participation', 'merit'],
      required: true,
    },
    certificateNumber: {
      type: String,
      unique: true,
      required: true,
    },
    verificationId: {
      type: String,
      unique: true,
      default: () => uuidv4(),
    },
    qrCodeData: String,
    issuedDate: {
      type: Date,
      default: Date.now,
    },
    pdfUrl: String,
    pdfPublicId: String,
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    studentName: String,
    internshipTitle: String,
    duration: String,
    isRevoked: {
      type: Boolean,
      default: false,
    },
    revokedAt: Date,
    revokeReason: String,
  },
  {
    timestamps: true,
  }
);

certificateSchema.index({ studentId: 1 });
certificateSchema.index({ internshipId: 1 });

// Generate certificate number
certificateSchema.statics.generateCertificateNumber = async function () {
  const prefix = 'MTC';
  const year = new Date().getFullYear();
  const count = await this.countDocuments() + 1;
  return `${prefix}-${year}-${String(count).padStart(5, '0')}`;
};

const Certificate = mongoose.model('Certificate', certificateSchema);
export default Certificate;
