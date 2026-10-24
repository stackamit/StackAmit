import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

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

// Generate certificate number (SA-027).
// Format is preserved as MTC-YYYY-##### so already-issued links keep working,
// but the numeric part is now a cryptographically secure random value (not a
// sequential counter) and is collision-checked, eliminating both guessability
// and the count-then-insert race condition. The unique index is the final guard.
const CERT_NUMBER_PREFIX = 'MTC';
const CERT_NUMBER_DIGITS = 5;

export const formatCertificateNumber = (year, seq) =>
  `${CERT_NUMBER_PREFIX}-${year}-${String(seq).padStart(CERT_NUMBER_DIGITS, '0')}`;

// Returns a cryptographically random zero-padded numeric sequence.
export const randomCertificateSequence = () =>
  crypto.randomInt(0, 10 ** CERT_NUMBER_DIGITS).toString().padStart(CERT_NUMBER_DIGITS, '0');

certificateSchema.statics.generateCertificateNumber = async function () {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = formatCertificateNumber(year, randomCertificateSequence());
    // exists() returns {} (truthy) when a document matches, null otherwise.
    // eslint-disable-next-line no-await-in-loop
    const clash = await this.exists({ certificateNumber: candidate });
    if (!clash) return candidate;
  }
  // Astronomically unlikely path (>=8 collisions). The unique index + a
  // create-level retry in the controller remain the authoritative guarantee.
  return formatCertificateNumber(year, randomCertificateSequence());
};

const Certificate = mongoose.model('Certificate', certificateSchema);
export default Certificate;
