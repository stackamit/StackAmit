import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Certificate from '../models/Certificate.js';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

// Authorized signature image — same asset used on offer letters (server/assets)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIGNATURE_IMAGE_PATH = path.join(__dirname, '../assets/signature.png');
const HAS_SIGNATURE = fs.existsSync(SIGNATURE_IMAGE_PATH);

/**
 * Fetch a fully populated certificate for PDF generation / detail view.
 */
export const getCertificatePopulated = (id) =>
  Certificate.findById(id)
    .populate('studentId', 'name email firstName lastName collegeName university course branch year')
    .populate('internshipId', 'title category startDate endDate duration');

/**
 * Build the certificate body content on the PDF document.
 * Shared by the stream (download) and buffer (email attachment) helpers.
 */
const renderCertificateBody = (doc, certificate, verificationUrl) => {
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
  const typeLabel = (certificate.type || 'completion').charAt(0).toUpperCase() + (certificate.type || 'completion').slice(1);
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

  // ─── Credentials band (Duration · Period · Category · Issue date) ───
  const internship = certificate.internshipId;
  const bandY = 385;
  doc.moveTo(centerX - 330, bandY - 16).lineTo(centerX + 330, bandY - 16)
    .strokeColor('#e8e8e8').lineWidth(0.75).stroke();

  const startStr = internship?.startDate
    ? new Date(internship.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const endStr = internship?.endDate
    ? new Date(internship.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const issueDate = new Date(certificate.issuedDate || certificate.createdAt)
    .toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const bandItems = [
    { label: 'DURATION', value: certificate.duration || (internship?.durationWeeks ? `${internship.durationWeeks} Weeks` : '—') },
    { label: 'INTERNSHIP PERIOD', value: startStr && endStr ? `${startStr} — ${endStr}` : '—', valueSize: 9 },
    { label: 'CATEGORY', value: internship?.category || '—' },
    { label: 'DATE OF ISSUE', value: issueDate },
  ];
  const bandColW = 165;
  [-255, -85, 85, 255].forEach((offset, idx) => {
    const cx = centerX + offset;
    const item = bandItems[idx];
    doc.fillColor('#c9a84c');
    doc.fontSize(7).font('Helvetica-Bold');
    doc.text(item.label, cx - bandColW / 2, bandY, { width: bandColW, align: 'center' });
    doc.fillColor('#1e3a5f');
    doc.fontSize(item.valueSize || 10).font('Helvetica');
    doc.text(String(item.value), cx - bandColW / 2, bandY + 15, { width: bandColW, align: 'center' });
  });
  // thin vertical dividers between the four columns
  [-170, 0, 170].forEach((off) => {
    doc.moveTo(centerX + off, bandY - 6).lineTo(centerX + off, bandY + 32)
      .strokeColor('#ececec').lineWidth(0.75).stroke();
  });

  // ─── Signature block (bottom center) ───
  const sigLineY = pageHeight - 105;
  doc.fillColor('#c9a84c');
  doc.fontSize(7).font('Helvetica-Bold');
  doc.text('SIGNED', centerX - 60, sigLineY - 76, { width: 120, align: 'center' });
  if (HAS_SIGNATURE) {
    try {
      doc.image(SIGNATURE_IMAGE_PATH, centerX - 75, sigLineY - 62, { fit: [150, 50] });
    } catch (imgErr) {
      console.error('[Certificate] Failed to draw signature image:', imgErr.message);
    }
  }
  doc.moveTo(centerX - 95, sigLineY).lineTo(centerX + 95, sigLineY)
    .strokeColor('#1e3a5f').lineWidth(1.25).stroke();
  // gold end-cap dots
  doc.fillColor('#c9a84c');
  doc.circle(centerX - 95, sigLineY, 1.8).fill();
  doc.circle(centerX + 95, sigLineY, 1.8).fill();

  doc.fillColor('#1e3a5f');
  doc.fontSize(11).font('Helvetica-Bold');
  doc.text('Amit Kumar', centerX - 120, sigLineY + 9, { width: 240, align: 'center' });
  doc.fillColor('#666666');
  doc.fontSize(8.5).font('Helvetica');
  doc.text('Authorized Signature · Founder, StackAmit', centerX - 130, sigLineY + 24, { width: 260, align: 'center' });

  // ─── Bottom-left: certificate identity block ───
  doc.fillColor('#c9a84c');
  doc.fontSize(7).font('Helvetica-Bold');
  doc.text('CERTIFICATE NUMBER', 60, pageHeight - 112);
  doc.fillColor('#1e3a5f');
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text(certificate.certificateNumber, 60, pageHeight - 99, { width: 215 });
  doc.fillColor('#999999');
  doc.fontSize(7.5).font('Helvetica');
  doc.text(`Verification ID: ${certificate.verificationId}`, 60, pageHeight - 83, { width: 215 });

  // ─── Footer ───
  doc.fillColor('#bbbbbb');
  doc.fontSize(7).font('Helvetica');
  doc.text(
    'This certificate was generated electronically by StackAmit · Verify authenticity using the QR code or at stackamit.netlify.app/verify-certificate',
    centerX - 290, pageHeight - 52, { width: 580, align: 'center' }
  );

  // ─── QR code caption (QR image drawn by the caller) ───
  const qrSize = 70;
  const qrX = pageWidth - 130;
  const qrY = pageHeight - 150;
  doc.fillColor('#777777');
  doc.fontSize(7).font('Helvetica');
  doc.text('Scan to verify', qrX - 5, qrY + qrSize + 3, { width: qrSize + 10, align: 'center' });
};

/**
 * Generate the certificate PDF and return it as a Buffer.
 * Used for the email attachment (same pattern as offerLetter.service).
 */
export const generateCertificatePDFBuffer = (certificate) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;

      // Generate QR first (async), then render everything synchronously
      QRCode.toDataURL(verificationUrl, { width: 200, margin: 1, color: { dark: '#1e3a5f', light: '#ffffff' } })
        .then((qrDataUrl) => {
          renderCertificateBody(doc, certificate, verificationUrl);
          doc.image(qrDataUrl, pageWidth - 130, pageHeight - 150, { width: 70, height: 70 });
          doc.end();
        })
        .catch((qrErr) => {
          console.error('QR generation error:', qrErr.message);
          renderCertificateBody(doc, certificate, verificationUrl);
          doc.end();
        });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Stream the certificate PDF directly to an HTTP response.
 * Used for the authenticated download endpoint.
 */
export const streamCertificatePDF = async (certificate, res) => {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  const fileName = `Certificate-${certificate.certificateNumber}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  doc.pipe(res);

  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1, color: { dark: '#1e3a5f', light: '#ffffff' } });
    renderCertificateBody(doc, certificate, verificationUrl);
    doc.image(qrDataUrl, doc.page.width - 130, doc.page.height - 150, { width: 70, height: 70 });
  } catch (qrErr) {
    console.error('QR generation error:', qrErr.message);
    renderCertificateBody(doc, certificate, verificationUrl);
  }

  doc.end();
};
