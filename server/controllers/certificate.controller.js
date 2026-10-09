import Certificate from '../models/Certificate.js';
import Student from '../models/Student.js';
import Internship from '../models/Internship.js';
import { logActivity } from '../services/activityLog.service.js';
import { createNotification } from '../services/notification.service.js';
import { sendCertificateEmail } from '../services/email.service.js';
import { getCertificatePopulated, generateCertificatePDFBuffer, streamCertificatePDF } from '../services/certificate.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import QRCode from 'qrcode';

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

  const certificate = await Certificate.create({
    studentId,
    internshipId,
    type,
    certificateNumber,
    studentName: student.name,
    internshipTitle: internship.title,
    duration: `${internship.duration.weeks} weeks`,
    issuedBy: req.user._id,
  });

  await createNotification({
    userId: studentId,
    title: 'Certificate Issued',
    message: `Your certificate for "${internship.title}" has been generated. Certificate #: ${certificateNumber}`,
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
        const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-certificate?certificateNumber=${certificateNumber}`;
        const result = await sendCertificateEmail(studentEmail, student.name, internship.title, certificateNumber, {
          type,
          issuedDate: certificate.issuedDate,
          verificationUrl,
          pdfBuffer,
        });
        if (result?.success) {
          console.log(`[Certificate] Email ${pdfBuffer ? 'with PDF attachment ' : ''}sent to ${studentEmail} for ${certificateNumber}`);
        } else {
          console.warn(`[Certificate] Email failed for ${studentEmail}:`, result?.error);
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
  }
  if (type) query.type = type;
  if (search) {
    query.$or = [
      { studentName: { $regex: search, $options: 'i' } },
      { certificateNumber: { $regex: search, $options: 'i' } },
      { internshipTitle: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [certificates, total] = await Promise.all([
    Certificate.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('studentId', 'name email')
      .populate('internshipId', 'title category'),
    Certificate.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: { certificates, total, pages: Math.ceil(total / limit) },
  });
});

// ─── Verify Certificate (Public) ─────────────────────────────────────────────
export const verifyCertificate = asyncHandler(async (req, res) => {
  const { certificateNumber, verificationId } = req.query;

  const query = {};
  if (certificateNumber) query.certificateNumber = certificateNumber;
  if (verificationId) query.verificationId = verificationId;

  const certificate = await Certificate.findOne(query)
    .populate('studentId', 'name email')
    .populate('internshipId', 'title category');

  if (!certificate) {
    return res.status(404).json({ success: false, message: 'Certificate not found' });
  }

  if (certificate.isRevoked) {
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

  const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/certificate/${certificate._id}`;
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;

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

  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;

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
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;
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
  const certificate = await Certificate.findById(req.params.id).select('certificateNumber verificationId');
  if (!certificate) {
    return res.status(404).json({ success: false, message: 'Certificate not found' });
  }

  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;

  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: 400, margin: 2,
    color: { dark: '#1e3a5f', light: '#ffffff' },
  });

  res.status(200).json({
    success: true,
    data: { qrCode: qrDataUrl, verificationUrl },
  });
});
