import Certificate from '../models/Certificate.js';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

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

  // QR Code (verification URL)
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
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;

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
