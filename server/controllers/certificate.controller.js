import Certificate from '../models/Certificate.js';
import Student from '../models/Student.js';
import Internship from '../models/Internship.js';
import { logActivity } from '../services/activityLog.service.js';
import { createNotification } from '../services/notification.service.js';
import { sendCertificateEmail } from '../services/email.service.js';
import { getCertificatePopulated, generateCertificatePDFBuffer, streamCertificatePDF } from '../services/certificate.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import QRCode from 'qrcode';
import { sameId, isAdmin, literalSearchRegex } from '../utils/authz.js';
import { redactEmail, redactId } from '../utils/logRedact.js';
import { getClientBaseUrl } from '../utils/appUrl.js';

// ─── Public verification helpers (SA-001 / SA-002) ───────────────────────────
// Build a safe query for anonymous verification.
// • Accepts ONLY non-empty strings (rejects operator-shaped values such as
//   { $ne: null } / { $exists: true } that would turn into a NoSQL injection).
// • Requires at least one usable identifier; an empty/absent query returns
//   null so the handler answers with a generic not-found instead of matching
//   an arbitrary first document (SA-002).
export const buildVerifyFilter = ({ certificateNumber, verificationId } = {}) => {
  const clean = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  const num = clean(certificateNumber);
  const vid = clean(verificationId);
  if (!num && !vid) return null;
  const filter = {};
  if (num) filter.certificateNumber = num;
  if (vid) filter.verificationId = vid;
  return filter;
};

// Explicit response allow-list for public verification (SA-001).
// Only these fields are ever serialized. Never add email, phone, DOB, college,
// skills, resume URLs, internal ObjectIds, or the raw populated documents.
// The verify page uses denormalized fields already stored on the certificate.
export const buildPublicVerificationPayload = (cert) => {
  if (!cert) return null;
  return {
    certificateNumber: cert.certificateNumber,
    type: cert.type,
    studentName: cert.studentName,
    internshipTitle: cert.internshipTitle,
    duration: cert.duration,
    issuedDate: cert.issuedDate,
    isRevoked: !!cert.isRevoked,
    revokeReason: cert.isRevoked ? cert.revokeReason : undefined,
  };
};

// ─── Generate Certificate ────────────────────────────────────────────────────
export const generateCertificate = asyncHandler(async (req, res) => {
  const { studentId, internshipId, type } = req.body;

  const student = await Student.findById(studentId);
  const internship = await Internship.findById(internshipId);

  if (!student || !internship) {
    return res.status(404).json({ success: false, message: 'Student or internship not found' });
  }

  const existing = await Certificate.findOne({ studentId, internshipId, type });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Certificate already issued' });
  }

  const certificateNumber = await Certificate.generateCertificateNumber();

  // Create with a bounded retry: the unique index is the authoritative guard
  // against the tiny TOCTOU window between the collision check and the insert.
  let certificate;
  let currentNumber = certificateNumber;
  for (let attempt = 0; ; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      certificate = await Certificate.create({
        studentId,
        internshipId,
        type,
        certificateNumber: currentNumber,
        studentName: student.name,
        internshipTitle: internship.title,
        duration: `${internship.duration.weeks} weeks`,
        issuedBy: req.user._id,
      });
      break;
    } catch (err) {
      if (err && err.code === 11000 && attempt < 5) {
        // eslint-disable-next-line no-await-in-loop
        currentNumber = await Certificate.generateCertificateNumber();
        continue;
      }
      throw err;
    }
  }

  await createNotification({
    userId: studentId,
    title: 'Certificate Issued',
    message: `Your certificate for "${internship.title}" has been generated. Certificate #: ${certificate.certificateNumber}`,
    type: 'certificate_issued',
    relatedEntity: 'certificate',
    relatedId: certificate._id,
  });

  // Send certificate email with the PDF attached (non-blocking - don't fail the request if email fails)
  const studentEmail = student.email;
  if (studentEmail) {
    (async () => {
      try {
        const fullCertificate = await getCertificatePopulated(certificate._id);
        const pdfBuffer = fullCertificate ? await generateCertificatePDFBuffer(fullCertificate) : null;
        const verificationUrl = `${getClientBaseUrl()}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;
        const result = await sendCertificateEmail(studentEmail, student.name, internship.title, certificate.certificateNumber, {
          type,
          issuedDate: certificate.issuedDate,
          verificationUrl,
          pdfBuffer,
        });
        if (result?.success) {
          // SA-023: recipient address and certificate number are PII/identifiers.
          console.log(`[Certificate] Email ${pdfBuffer ? 'with PDF attachment ' : ''}sent to ${redactEmail(studentEmail)} for cert=${redactId(certificate.certificateNumber)}`);
        } else {
          console.warn(`[Certificate] Email failed for ${redactEmail(studentEmail)}`);
        }
      } catch (err) {
        console.error('[Certificate] Email error:', err.message);
      }
    })();
  }

  await logActivity({
    userId: req.user._id,
    action: 'generate',
    entity: 'certificate',
    entityId: certificate._id,
    details: { certificateNumber, studentId, internshipId },
    req,
  });

  res.status(201).json({
    success: true,
    message: 'Certificate generated successfully',
    data: { certificate },
  });
});

// ─── Get All Certificates ────────────────────────────────────────────────────
export const getCertificates = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, type } = req.query;
  const query = {};

  if (req.user.role === 'student') {
    query.studentId = req.user._id;
  } else if (req.user.role === 'trainer' && !isAdmin(req.user)) {
    // SA-010: trainers only see certificates for students they supervise.
    const supervised = await Student.find({ assignedTrainer: req.user._id }).select('_id');
    query.studentId = { $in: supervised.map((s) => s._id) };
  }
  if (type) query.type = type;
  if (search) {
    // SA-014: match the term literally; skip when not usable.
    const rx = literalSearchRegex(String(search));
    if (rx) {
      query.$or = [
        { studentName: rx },
        { certificateNumber: rx },
        { internshipTitle: rx },
      ];
    }
  }

  // SA-010: clamp paging so a caller cannot request an unbounded page.
  const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const skip = (safePage - 1) * safeLimit;

  const [certificates, total] = await Promise.all([
    Certificate.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('studentId', 'name email')
      .populate('internshipId', 'title category'),
    Certificate.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: { certificates, total, pages: Math.ceil(total / safeLimit), page: safePage },
  });
});

// ─── Verify Certificate (Public) ─────────────────────────────────────────────
export const verifyCertificate = asyncHandler(async (req, res) => {
  const { certificateNumber, verificationId } = req.query;

  const filter = buildVerifyFilter({ certificateNumber, verificationId });
  if (!filter) {
    // Missing / empty / malformed identifier → generic not-found (never query {})
    return res.status(404).json({ success: false, message: 'Certificate not found' });
  }

  const doc = await Certificate.findOne(filter).select('-pdfUrl -pdfPublicId -qrCodeData -studentId -internshipId -issuedBy');

  if (!doc) {
    return res.status(404).json({ success: false, message: 'Certificate not found' });
  }

  const certificate = buildPublicVerificationPayload(doc);

  if (doc.isRevoked) {
    return res.status(200).json({
      success: true,
      data: { certificate, isRevoked: true, message: 'This certificate has been revoked' },
    });
  }

  res.status(200).json({
    success: true,
    data: { certificate, isValid: true },
  });
});

// ─── Revoke Certificate ──────────────────────────────────────────────────────
export const revokeCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id);
  if (!certificate) {
    return res.status(404).json({ success: false, message: 'Certificate not found' });
  }

  certificate.isRevoked = true;
  certificate.revokedAt = new Date();
  certificate.revokeReason = req.body.reason;
  await certificate.save();

  // Notify student about revocation
  await createNotification({
    userId: certificate.studentId,
    title: 'Certificate Revoked',
    message: `Your certificate for "${certificate.internshipTitle}" has been revoked. ${req.body.reason ? 'Reason: ' + req.body.reason : ''}`,
    type: 'general',
    relatedEntity: 'certificate',
    relatedId: certificate._id,
  });

  await logActivity({
    userId: req.user._id,
    action: 'revoke',
    entity: 'certificate',
    entityId: certificate._id,
    details: { certificateNumber: certificate.certificateNumber },
    req,
  });

  res.status(200).json({ success: true, message: 'Certificate revoked' });
});

// ─── Get Certificate Stats ───────────────────────────────────────────────────
export const getCertificateStats = asyncHandler(async (req, res) => {
  const [total, completion, participation, merit, revoked] = await Promise.all([
    Certificate.countDocuments(),
    Certificate.countDocuments({ type: 'completion' }),
    Certificate.countDocuments({ type: 'participation' }),
    Certificate.countDocuments({ type: 'merit' }),
    Certificate.countDocuments({ isRevoked: true }),
  ]);

  res.status(200).json({
    success: true,
    data: { total, completion, participation, merit, revoked, active: total - revoked },
  });
});

// ─── Get Certificate by ID ──────────────────────────────────────────────────
export const getCertificateById = asyncHandler(async (req, res) => {
  const certificate = await getCertificatePopulated(req.params.id);

  if (!certificate) {
    return res.status(404).json({ success: false, message: 'Certificate not found' });
  }

  // Verify access: student who owns it, or admin/trainer
  if (req.user.role === 'student' && certificate.studentId?._id?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  // SA-010: a trainer may open a certificate only for a student they supervise.
  if (req.user.role === 'trainer' && !isAdmin(req.user)) {
    const owner = certificate.studentId?._id || certificate.studentId;
    const supervised = await Student.exists({ _id: owner, assignedTrainer: req.user._id });
    if (!supervised) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }

  const frontendUrl = `${getClientBaseUrl()}/certificate/${certificate._id}`;
  const verificationUrl = `${getClientBaseUrl()}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;

  res.status(200).json({
    success: true,
    data: { certificate, verificationUrl, frontendUrl },
  });
});

// ─── Get Certificate by ID (Public - for shareable view page) ──────────────
export const getCertificateByIdPublic = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id)
    .populate('internshipId', 'title category startDate endDate duration');

  if (!certificate) {
    return res.status(404).json({ success: false, message: 'Certificate not found' });
  }

  // Return only display-safe fields (no student email or personal details)
  const publicCertificate = {
    _id: certificate._id,
    certificateNumber: certificate.certificateNumber,
    type: certificate.type,
    studentName: certificate.studentName,
    internshipTitle: certificate.internshipTitle,
    duration: certificate.duration,
    issuedDate: certificate.issuedDate,
    createdAt: certificate.createdAt,
    isRevoked: certificate.isRevoked,
    internshipId: certificate.internshipId,
  };

  const verificationUrl = `${getClientBaseUrl()}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;

  res.status(200).json({
    success: true,
    data: { certificate: publicCertificate, verificationUrl },
  });
});

// ─── Download Certificate PDF ───────────────────────────────────────────────
export const downloadCertificatePDF = asyncHandler(async (req, res) => {
  const certificate = await getCertificatePopulated(req.params.id);

  if (!certificate) {
    return res.status(404).json({ success: false, message: 'Certificate not found' });
  }

  // Verify access: student who owns it, or admin/trainer
  if (req.user.role === 'student' && certificate.studentId?._id?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  await streamCertificatePDF(certificate, res);
});

// ─── Resend Certificate Email (Admin) ───────────────────────────────────────
export const resendCertificateEmail = asyncHandler(async (req, res) => {
  const certificate = await getCertificatePopulated(req.params.id);

  if (!certificate) {
    return res.status(404).json({ success: false, message: 'Certificate not found' });
  }
  if (certificate.isRevoked) {
    return res.status(400).json({ success: false, message: 'Revoked certificates cannot be emailed to students' });
  }

  const student = certificate.studentId;
  if (!student?.email) {
    return res.status(400).json({ success: false, message: 'Student email not found' });
  }

  const studentName = certificate.studentName || student?.name || `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || 'Student';

  // Generate the certificate PDF and send the email with it attached
  const pdfBuffer = await generateCertificatePDFBuffer(certificate);
  const verificationUrl = `${getClientBaseUrl()}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;
  const result = await sendCertificateEmail(student.email, studentName, certificate.internshipTitle, certificate.certificateNumber, {
    type: certificate.type,
    issuedDate: certificate.issuedDate || certificate.createdAt,
    verificationUrl,
    pdfBuffer,
  });

  if (!result?.success) {
    return res.status(500).json({ success: false, message: `Failed to send certificate email: ${result?.error || 'email service error'}` });
  }

  await logActivity({
    userId: req.user._id,
    action: 'generate',
    entity: 'certificate',
    entityId: certificate._id,
    details: { certificateEmailResent: true, sentTo: student.email, certificateNumber: certificate.certificateNumber },
    req,
  });

  res.status(200).json({
    success: true,
    message: `Certificate email with PDF has been resent to ${student.email}`,
  });
});

// ─── Get Certificate QR Code ────────────────────────────────────────────────
export const getCertificateQR = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id).select('certificateNumber verificationId studentId');
  if (!certificate) {
    return res.status(404).json({ success: false, message: 'Certificate not found' });
  }

  // SA-010: the QR encodes the certificate number + verification link, so gate it
  // behind the same ownership/supervision rules as the detail endpoint instead of
  // returning it to any authenticated caller.
  if (req.user.role === 'student' && !sameId(certificate.studentId, req.user._id)) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }
  if (req.user.role === 'trainer' && !isAdmin(req.user)) {
    const supervised = await Student.exists({ _id: certificate.studentId, assignedTrainer: req.user._id });
    if (!supervised) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }

  const verificationUrl = `${getClientBaseUrl()}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;

  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: 400, margin: 2,
    color: { dark: '#1e3a5f', light: '#ffffff' },
  });

  res.status(200).json({
    success: true,
    data: { qrCode: qrDataUrl, verificationUrl },
  });
});
