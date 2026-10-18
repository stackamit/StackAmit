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

// Company logo (server/assets) for the certificate letterhead
const LOGO_IMAGE_PATH = path.join(__dirname, '../assets/logo.jpg');
const HAS_LOGO = fs.existsSync(LOGO_IMAGE_PATH);

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
  const pageWidth = doc.page.width;   // A4 landscape (~842pt)
  const pageHeight = doc.page.height; // A4 landscape (~595pt)
  const centerX = pageWidth / 2;

  // Palette (matches the StackAmit certificate brand)
  const NAVY = '#12395f';
  const GOLD = '#c9a227';
  const BLUE = '#1d4ed8';
  const GRAY = '#5b6472';

  // ─── Background ───
  doc.rect(0, 0, pageWidth, pageHeight).fill('#ffffff');

  // ─── Decorative corner ribbons (top-left + bottom-right) ───
  // Navy band + thin gold band running diagonally across each corner.
  const ribbon = (corner) => {
    if (corner === 'tl') {
      doc.moveTo(0, 100).lineTo(100, 0).lineTo(70, 0).lineTo(0, 70).closePath();
      doc.fill(NAVY);
      doc.moveTo(0, 112).lineTo(112, 0).lineTo(100, 0).lineTo(0, 100).closePath();
      doc.fill(GOLD);
    } else {
      const W = pageWidth, H = pageHeight;
      doc.moveTo(W, H - 100).lineTo(W - 100, H).lineTo(W - 70, H).lineTo(W, H - 70).closePath();
      doc.fill(NAVY);
      doc.moveTo(W, H - 112).lineTo(W - 112, H).lineTo(W - 100, H).lineTo(W, H - 100).closePath();
      doc.fill(GOLD);
    }
  };
  ribbon('tl');
  ribbon('br');

  // ─── Thin gold outer border ───
  doc.rect(24, 24, pageWidth - 48, pageHeight - 48)
    .strokeColor(GOLD).lineWidth(1.5).stroke();

  // ─── Header: logo (top-left, clear of the corner ribbon) ───
  if (HAS_LOGO) {
    try {
      doc.image(LOGO_IMAGE_PATH, 62, 56, { fit: [74, 74] });
    } catch (e) {
      console.error('[Certificate] Failed to draw logo:', e.message);
    }
  } else {
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(22);
    doc.text('StackAmit', 62, 70, { width: 200, align: 'left' });
  }

  // ─── Header: right tagline ───
  doc.fillColor(NAVY).font('Helvetica').fontSize(12);
  doc.text('Empowering Students', pageWidth - 316, 54, { width: 260, align: 'right' });
  doc.text('for a Better Tomorrow', pageWidth - 316, 70, { width: 260, align: 'right' });

  // ─── Title ───
  doc.fillColor(NAVY).font('Times-Bold').fontSize(46);
  doc.text('CERTIFICATE', 0, 150, { width: pageWidth, align: 'center' });

  // Subtitle with flanking gold rules
  const typeLabel = (certificate.type || 'completion').toUpperCase();
  const subY = 210;
  doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(16);
  doc.text(`OF ${typeLabel}`, 0, subY, { width: pageWidth, align: 'center', characterSpacing: 3 });
  const subTextW = doc.widthOfString(`OF ${typeLabel}`, { characterSpacing: 3 });
  const lineY = subY + 11;
  doc.moveTo(centerX - subTextW / 2 - 70, lineY).lineTo(centerX - subTextW / 2 - 14, lineY)
    .strokeColor(GOLD).lineWidth(1).stroke();
  doc.moveTo(centerX + subTextW / 2 + 14, lineY).lineTo(centerX + subTextW / 2 + 70, lineY)
    .strokeColor(GOLD).lineWidth(1).stroke();

  // ─── "This is to certify that" ───
  doc.fillColor(NAVY).font('Helvetica').fontSize(13);
  doc.text('This is to certify that', 0, 248, { width: pageWidth, align: 'center' });

  // ─── Student name ───
  const studentName = certificate.studentName ||
    `${certificate.studentId?.firstName || ''} ${certificate.studentId?.lastName || ''}`.trim() ||
    'Student';
  doc.fillColor(NAVY).font('Times-Italic').fontSize(40);
  doc.text(studentName, 0, 272, { width: pageWidth, align: 'center' });
  const nameW = doc.widthOfString(studentName, { font: 'Times-Italic', size: 40 });
  const nameUnderlineY = 328;
  doc.moveTo(centerX - Math.max(nameW / 2, 120), nameUnderlineY)
    .lineTo(centerX + Math.max(nameW / 2, 120), nameUnderlineY)
    .strokeColor(GOLD).lineWidth(1).stroke();

  // ─── "has successfully completed the" ───
  doc.fillColor(GRAY).font('Helvetica').fontSize(12);
  doc.text('has successfully completed the', 0, 340, { width: pageWidth, align: 'center' });

  // ─── Internship title ───
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(24);
  doc.text(certificate.internshipTitle || 'Internship Program', 0, 362, { width: pageWidth, align: 'center' });

  // ─── Credentials band (Duration · Period · Category · Issue date) ───
  const internship = certificate.internshipId;
  const iconY = 402;
  const bandLabelY = 422;
  const bandValueY = 436;

  const startStr = internship?.startDate
    ? new Date(internship.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const endStr = internship?.endDate
    ? new Date(internship.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const issueDate = new Date(certificate.issuedDate || certificate.createdAt)
    .toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const durationValue = certificate.duration
    || (internship?.duration?.weeks ? `${internship.duration.weeks} weeks` : '—');

  const bandItems = [
    { label: 'DURATION', value: durationValue, valueSize: 11, icon: 'calendar' },
    { label: 'INTERNSHIP PERIOD', value: startStr && endStr ? `${startStr} — ${endStr}` : '—', valueSize: 9, icon: 'calendar' },
    { label: 'CATEGORY', value: internship?.category || '—', valueSize: 11, icon: 'briefcase' },
    { label: 'DATE OF ISSUE', value: issueDate, valueSize: 11, icon: 'calendar' },
  ];

  const drawCalendarIcon = (cx, top) => {
    const w = 16, h = 13, x = cx - w / 2;
    doc.lineWidth(1).strokeColor(BLUE);
    doc.rect(x, top, w, h).stroke();
    doc.rect(x, top, w, 4).fill(BLUE);
    doc.moveTo(x + 4, top - 2).lineTo(x + 4, top + 2).stroke();
    doc.moveTo(x + 12, top - 2).lineTo(x + 12, top + 2).stroke();
  };
  const drawBriefcaseIcon = (cx, top) => {
    const w = 18, h = 11, x = cx - w / 2;
    doc.lineWidth(1).strokeColor(BLUE);
    doc.rect(x, top + 2, w, h).stroke();
    doc.rect(cx - 4, top - 1, 8, 4).stroke();
  };

  const bandColW = 175;
  [-285, -95, 95, 285].forEach((offset, idx) => {
    const cx = centerX + offset;
    const item = bandItems[idx];
    if (item.icon === 'briefcase') drawBriefcaseIcon(cx, iconY);
    else drawCalendarIcon(cx, iconY);
    doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(7.5);
    doc.text(item.label, cx - bandColW / 2, bandLabelY, { width: bandColW, align: 'center', characterSpacing: 0.5 });
    doc.fillColor(NAVY).font('Helvetica').fontSize(item.valueSize || 10);
    doc.text(String(item.value), cx - bandColW / 2, bandValueY, { width: bandColW, align: 'center' });
  });
  // thin vertical dividers between the four columns
  [-190, 0, 190].forEach((off) => {
    doc.moveTo(centerX + off, iconY - 2).lineTo(centerX + off, bandValueY + 14)
      .strokeColor('#e3e8ef').lineWidth(0.75).stroke();
  });

  // ─── Signature block (bottom center) ───
  const sigLineY = pageHeight - 95;
  if (HAS_SIGNATURE) {
    try {
      doc.image(SIGNATURE_IMAGE_PATH, centerX - 75, sigLineY - 58, { fit: [150, 48] });
    } catch (imgErr) {
      console.error('[Certificate] Failed to draw signature image:', imgErr.message);
    }
  }
  doc.moveTo(centerX - 95, sigLineY).lineTo(centerX + 95, sigLineY)
    .strokeColor(NAVY).lineWidth(1.25).stroke();
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11);
  doc.text('Authorized Signature', centerX - 120, sigLineY + 6, { width: 240, align: 'center' });
  doc.fillColor(GRAY).font('Helvetica').fontSize(8.5);
  doc.text('Founder, StackAmit', centerX - 130, sigLineY + 20, { width: 260, align: 'center' });

  // ─── Bottom-left: certificate identity block ───
  doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(7);
  doc.text('CERTIFICATE NUMBER', 56, pageHeight - 142, { characterSpacing: 0.5 });
  doc.roundedRect(56, pageHeight - 132, 185, 22, 3)
    .fillAndStroke('#eef4ff', NAVY);
  doc.lineWidth(0.75);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11);
  doc.text(certificate.certificateNumber, 64, pageHeight - 127, { width: 170 });
  doc.fillColor(GRAY).font('Helvetica').fontSize(7.5);
  doc.text(`Verification ID: ${certificate.verificationId}`, 56, pageHeight - 104, { width: 215 });

  // ─── QR caption (QR image itself is drawn by the caller) ───
  const qrSize = 70;
  const qrX = pageWidth - 130;
  const qrY = pageHeight - 150;
  doc.fillColor(GRAY).font('Helvetica').fontSize(7.5);
  doc.text('Scan to verify', qrX - 5, qrY + qrSize + 4, { width: qrSize + 10, align: 'center' });

  // ─── Footer ──
  doc.moveTo(56, pageHeight - 60).lineTo(pageWidth - 56, pageHeight - 60)
    .strokeColor('#e3e8ef').lineWidth(0.75).stroke();
  // small shield accent
  const shieldX = centerX - 250;
  const shieldY = pageHeight - 46;
  doc.circle(shieldX, shieldY, 5).fill(NAVY);
  doc.moveTo(shieldX - 2.5, shieldY).lineTo(shieldX - 0.5, shieldY + 2).lineTo(shieldX + 3, shieldY - 2.5)
    .strokeColor('#ffffff').lineWidth(1).stroke();
  doc.fillColor(GRAY).font('Helvetica').fontSize(7);
  doc.text(
    'This certificate was generated electronically by StackAmit  ·  Verify authenticity using the QR code or at stackamit.netlify.app/verify-certificate',
    centerX - 220, pageHeight - 50, { width: 460, align: 'center' }
  );
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
      const verificationUrl = `${process.env.CLIENT_URL || 'https://stackamit.netlify.app'}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;

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

  const verificationUrl = `${process.env.CLIENT_URL || 'https://stackamit.netlify.app'}/verify-certificate?certificateNumber=${certificate.certificateNumber}`;

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
