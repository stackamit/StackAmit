import Certificate from '../models/Certificate.js';
import Student from '../models/Student.js';
import Internship from '../models/Internship.js';
import { logActivity } from '../services/activityLog.service.js';
import { createNotification } from '../services/notification.service.js';
import { sendCertificateEmail } from '../services/email.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import PDFDocument from 'pdfkit';
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

  await sendCertificateEmail(student.email, student.name, internship.title, certificateNumber);

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
  const certificate = await Certificate.findById(req.params.id)
    .populate('studentId', 'name email firstName lastName collegeName university course branch year')
    .populate('internshipId', 'title category startDate endDate duration');

  if (!certificate) {
    return res.status(404).json({ success: false, message: 'Certificate not found' });
  }

  const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/certificate/${certificate._id}`;
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;

  res.status(200).json({
    success: true,
    data: { certificate, verificationUrl, frontendUrl },
  });
});

// ─── Download Certificate PDF ───────────────────────────────────────────────
export const downloadCertificatePDF = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.id)
    .populate('studentId', 'name email firstName lastName collegeName university course')
    .populate('internshipId', 'title category startDate endDate duration');

  if (!certificate) {
    return res.status(404).json({ success: false, message: 'Certificate not found' });
  }

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  const fileName = `Certificate-${certificate.certificateNumber}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const centerX = pageWidth / 2;

  // Background
  doc.rect(0, 0, pageWidth, pageHeight).fill('#ffffff');

  // Outer border
  doc.strokeColor('#1e3a5f');
  doc.lineWidth(4);
  doc.rect(30, 30, pageWidth - 60, pageHeight - 60).stroke();

  // Inner border
  doc.strokeColor('#c9a84c');
  doc.lineWidth(2);
  doc.rect(40, 40, pageWidth - 80, pageHeight - 80).stroke();

  // Decorative corner accents
  const cornerSize = 30;
  const corners = [
    [50, 50], [pageWidth - 50 - cornerSize, 50],
    [50, pageHeight - 50 - cornerSize], [pageWidth - 50 - cornerSize, pageHeight - 50 - cornerSize]
  ];
  doc.fillColor('#c9a84c');
  corners.forEach(([cx, cy]) => {
    doc.rect(cx, cy, cornerSize, 3).fill();
    doc.rect(cx, cy, 3, cornerSize).fill();
  });
  // Top-right corner
  doc.rect(pageWidth - 50 - cornerSize, 50, cornerSize, 3).fill();
  doc.rect(pageWidth - 53, 50, 3, cornerSize).fill();
  // Bottom-left
  doc.rect(50, pageHeight - 53, cornerSize, 3).fill();
  doc.rect(50, pageHeight - 50 - cornerSize, 3, cornerSize).fill();
  // Bottom-right
  doc.rect(pageWidth - 50 - cornerSize, pageHeight - 53, cornerSize, 3).fill();
  doc.rect(pageWidth - 53, pageHeight - 50 - cornerSize, 3, cornerSize).fill();

  // StackAmit header
  doc.fillColor('#1e3a5f');
  doc.fontSize(14).font('Helvetica-Bold');
  const brandY = 80;
  doc.text('STACKAMIT', centerX - 60, brandY, { width: 120, align: 'center' });

  // Decorative line under brand
  doc.moveTo(centerX - 100, brandY + 22).lineTo(centerX + 100, brandY + 22)
    .strokeColor('#c9a84c').lineWidth(1.5).stroke();

  // Title
  doc.fillColor('#1e3a5f');
  doc.fontSize(36).font('Helvetica-Bold');
  doc.text('CERTIFICATE', centerX - 200, 130, { width: 400, align: 'center' });

  // Subtitle
  const typeLabel = certificate.type.charAt(0).toUpperCase() + certificate.type.slice(1);
  doc.fillColor('#c9a84c');
  doc.fontSize(18).font('Helvetica');
  doc.text(`of ${typeLabel}`, centerX - 200, 178, { width: 400, align: 'center' });

  // Decorative line
  doc.moveTo(centerX - 80, 208).lineTo(centerX + 80, 208)
    .strokeColor('#c9a84c').lineWidth(1).stroke();

  // "This is to certify that"
  doc.fillColor('#555555');
  doc.fontSize(13).font('Helvetica');
  doc.text('This is to certify that', centerX - 200, 225, { width: 400, align: 'center' });

  // Student name
  const studentName = certificate.studentName ||
    `${certificate.studentId?.firstName || ''} ${certificate.studentId?.lastName || ''}`.trim() ||
    'Student';
  doc.fillColor('#1e3a5f');
  doc.fontSize(30).font('Helvetica-Bold');
  doc.text(studentName, centerX - 250, 252, { width: 500, align: 'center' });

  // Underline for name
  doc.moveTo(centerX - 180, 290).lineTo(centerX + 180, 290)
    .strokeColor('#c9a84c').lineWidth(1).stroke();

  // "has successfully completed"
  doc.fillColor('#555555');
  doc.fontSize(13).font('Helvetica');
  doc.text('has successfully completed the', centerX - 200, 305, { width: 400, align: 'center' });

  // Internship title
  doc.fillColor('#1e3a5f');
  doc.fontSize(22).font('Helvetica-Bold');
  doc.text(certificate.internshipTitle || 'Internship Program', centerX - 250, 332, { width: 500, align: 'center' });

  // Duration
  if (certificate.duration) {
    doc.fillColor('#777777');
    doc.fontSize(12).font('Helvetica');
    doc.text(`Duration: ${certificate.duration}`, centerX - 200, 365, { width: 400, align: 'center' });
  }

  // Internship dates
  const internship = certificate.internshipId;
  if (internship?.startDate && internship?.endDate) {
    const startStr = new Date(internship.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    const endStr = new Date(internship.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.fillColor('#777777');
    doc.fontSize(11).font('Helvetica');
    doc.text(`${startStr} — ${endStr}`, centerX - 200, 385, { width: 400, align: 'center' });
  }

  // Category badge
  if (internship?.category) {
    doc.fillColor('#1e3a5f');
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`Category: ${internship.category}`, centerX - 200, 408, { width: 400, align: 'center' });
  }

  // Issue date
  const issueDate = new Date(certificate.issuedDate || certificate.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.fillColor('#555555');
  doc.fontSize(11).font('Helvetica');
  doc.text(`Issued on ${issueDate}`, centerX - 200, 435, { width: 400, align: 'center' });

  // QR Code
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1, color: { dark: '#1e3a5f', light: '#ffffff' } });
    const qrSize = 70;
    const qrX = pageWidth - 130;
    const qrY = pageHeight - 150;
    doc.image(qrDataUrl, qrX, qrY, { width: qrSize, height: qrSize });
    doc.fillColor('#777777');
    doc.fontSize(7).font('Helvetica');
    doc.text('Scan to verify', qrX - 5, qrY + qrSize + 3, { width: qrSize + 10, align: 'center' });
  } catch (qrErr) { console.error('QR generation error:', qrErr.message); }

  // Certificate number at bottom
  doc.fillColor('#1e3a5f');
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text(`Certificate No: ${certificate.certificateNumber}`, 60, pageHeight - 80, { width: 300 });

  // Verification ID
  doc.fillColor('#999999');
  doc.fontSize(8).font('Helvetica');
  doc.text(`ID: ${certificate.verificationId}`, 60, pageHeight - 65, { width: 300 });

  // Footer text
  doc.fillColor('#999999');
  doc.fontSize(8).font('Helvetica');
  doc.text('StackAmit Internship Management System', centerX - 150, pageHeight - 65, { width: 300, align: 'center' });

  // Signature area
  doc.moveTo(pageWidth - 230, pageHeight - 90).lineTo(pageWidth - 80, pageHeight - 90)
    .strokeColor('#cccccc').lineWidth(0.5).stroke();
  doc.fillColor('#555555');
  doc.fontSize(9).font('Helvetica');
  doc.text('Authorized Signature', pageWidth - 230, pageHeight - 85, { width: 150, align: 'center' });

  doc.end();
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
