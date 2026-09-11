import Application from '../models/Application.js';
import PDFDocument from 'pdfkit';

/**
 * Fetch a fully populated application for offer letter PDF generation.
 * Includes student details (with assigned trainer) and internship details.
 */
export const getOfferLetterApplication = async (applicationId) => {
  return Application.findById(applicationId)
    .populate({
      path: 'studentId',
      select: 'name email firstName lastName collegeName university course branch year phone city state country assignedTrainer',
      populate: { path: 'assignedTrainer', select: 'name' },
    })
    .populate('internshipId', 'title category description duration startDate endDate skills responsibilities learningOutcomes')
    .populate('reviewedBy', 'name');
};

/**
 * Generate the internship offer letter PDF and return it as a Buffer.
 * Used for both the download endpoint and the email attachment.
 */
export const generateOfferLetterPDFBuffer = (application) => {
  return new Promise((resolve, reject) => {
    try {
      const student = application.studentId;
      const internship = application.internshipId;
      const studentName = student?.name || `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || 'Student';
      const offerDate = new Date(application.reviewedAt || application.updatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      const durationText = internship?.duration ? `${internship.duration.weeks} weeks (${internship.duration.hoursPerWeek || 20} hrs/week)` : 'As per program schedule';

      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const centerX = pageWidth / 2;
      const leftMargin = 60;
      const rightMargin = pageWidth - 60;
      const contentWidth = rightMargin - leftMargin;

      // Background
      doc.rect(0, 0, pageWidth, pageHeight).fill('#ffffff');

      // Top accent bar
      doc.rect(0, 0, pageWidth, 8).fill('#11998e');
      doc.rect(0, 8, pageWidth, 3).fill('#38ef7d');

      // Outer border
      doc.strokeColor('#e0e0e0');
      doc.lineWidth(1);
      doc.rect(30, 30, pageWidth - 60, pageHeight - 60).stroke();

      // ─── Header Section ───
      let yPos = 60;

      // Brand name
      doc.fillColor('#11998e');
      doc.fontSize(28).font('Helvetica-Bold');
      doc.text('STACKAMIT', leftMargin, yPos, { width: contentWidth, align: 'center' });
      yPos += 35;

      // Tagline
      doc.fillColor('#888888');
      doc.fontSize(10).font('Helvetica');
      doc.text('Internship Management Platform', leftMargin, yPos, { width: contentWidth, align: 'center' });
      yPos += 20;

      // Decorative line
      doc.moveTo(centerX - 120, yPos).lineTo(centerX + 120, yPos)
        .strokeColor('#11998e').lineWidth(2).stroke();
      yPos += 8;
      doc.moveTo(centerX - 80, yPos).lineTo(centerX + 80, yPos)
        .strokeColor('#38ef7d').lineWidth(1).stroke();
      yPos += 30;

      // ─── Title ───
      doc.fillColor('#1a1a2e');
      doc.fontSize(26).font('Helvetica-Bold');
      doc.text('INTERNSHIP OFFER LETTER', leftMargin, yPos, { width: contentWidth, align: 'center' });
      yPos += 40;

      // Date and reference
      doc.fillColor('#666666');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Date: ${offerDate}`, leftMargin, yPos, { width: contentWidth / 2 });
      doc.text(`Ref: SA/OFFER/${application._id.toString().slice(-8).toUpperCase()}`, centerX, yPos, { width: contentWidth / 2, align: 'right' });
      yPos += 25;

      // ─── Greeting ───
      doc.fillColor('#333333');
      doc.fontSize(12).font('Helvetica');
      doc.text(`Dear ${studentName},`, leftMargin, yPos);
      yPos += 22;

      // ─── Body text ───
      doc.fillColor('#444444');
      doc.fontSize(11).font('Helvetica');
      const bodyText = `Congratulations! We are pleased to offer you an internship position at StackAmit. Based on your application and profile, you have been selected to join our internship program. This letter confirms our offer and outlines the details of your internship.`;
      doc.text(bodyText, leftMargin, yPos, { width: contentWidth, align: 'left' });
      yPos += doc.heightOfString(bodyText, { width: contentWidth }) + 20;

      // ─── Offer Details Box ───
      const boxStartY = yPos;
      doc.fillColor('#f0fff4');
      doc.rect(leftMargin, yPos, contentWidth, 130).fill();
      doc.strokeColor('#11998e').lineWidth(1.5);
      doc.rect(leftMargin, yPos, contentWidth, 130).stroke();

      // Box title
      doc.fillColor('#11998e');
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('OFFER DETAILS', leftMargin + 15, yPos + 10);
      yPos += 30;

      const details = [
        ['Intern Position', internship?.title || 'N/A'],
        ['Category', internship?.category || 'N/A'],
        ['Duration', durationText],
        ['Start Date', internship?.startDate ? new Date(internship.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'To be confirmed'],
        ['End Date', internship?.endDate ? new Date(internship.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'To be confirmed'],
      ];

      details.forEach(([label, value]) => {
        doc.fillColor('#555555');
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text(label + ':', leftMargin + 20, yPos, { width: 140 });
        doc.fillColor('#333333');
        doc.fontSize(10).font('Helvetica');
        doc.text(value, leftMargin + 160, yPos, { width: contentWidth - 200 });
        yPos += 18;
      });

      yPos = boxStartY + 140;

      // ─── Student Information ───
      doc.fillColor('#1a1a2e');
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('CANDIDATE INFORMATION', leftMargin, yPos);
      yPos += 18;

      doc.fillColor('#f8f9ff');
      doc.rect(leftMargin, yPos, contentWidth, 70).fill();

      const studentInfo = [
        ['Full Name', studentName],
        ['Email', student?.email || 'N/A'],
        ['College', student?.collegeName || 'N/A'],
      ];
      if (student?.course) studentInfo.push(['Course', `${student.course}${student.branch ? ' - ' + student.branch : ''}${student.year ? ' (' + student.year + ' Year)' : ''}`]);

      const infoStartY = yPos + 8;
      studentInfo.forEach(([label, value], i) => {
        const iy = infoStartY + (i * 15);
        doc.fillColor('#555555');
        doc.fontSize(9).font('Helvetica-Bold');
        doc.text(label + ':', leftMargin + 15, iy, { width: 120 });
        doc.fillColor('#333333');
        doc.fontSize(9).font('Helvetica');
        doc.text(value, leftMargin + 140, iy, { width: contentWidth - 180 });
      });

      yPos += 80;

      // ─── Skills / Responsibilities ───
      if (internship?.skills?.length > 0 || internship?.responsibilities?.length > 0) {
        if (internship.skills?.length > 0) {
          doc.fillColor('#1a1a2e');
          doc.fontSize(11).font('Helvetica-Bold');
          doc.text('KEY SKILLS', leftMargin, yPos);
          yPos += 16;
          doc.fillColor('#444444');
          doc.fontSize(9).font('Helvetica');
          doc.text(internship.skills.join('  •  '), leftMargin, yPos, { width: contentWidth });
          yPos += doc.heightOfString(internship.skills.join('  •  '), { width: contentWidth }) + 12;
        }
        if (internship.responsibilities?.length > 0) {
          doc.fillColor('#1a1a2e');
          doc.fontSize(11).font('Helvetica-Bold');
          doc.text('RESPONSIBILITIES', leftMargin, yPos);
          yPos += 16;
          doc.fillColor('#444444');
          doc.fontSize(9).font('Helvetica');
          internship.responsibilities.slice(0, 5).forEach((resp) => {
            doc.text(`•  ${resp}`, leftMargin + 5, yPos, { width: contentWidth - 10 });
            yPos += doc.heightOfString(`•  ${resp}`, { width: contentWidth - 10 }) + 4;
          });
          yPos += 8;
        }
      }

      // ─── Closing ───
      doc.fillColor('#444444');
      doc.fontSize(10).font('Helvetica');
      const closingText = 'As an intern at StackAmit, you will have the opportunity to work on real-world projects, receive mentorship from industry professionals, and earn a certificate upon successful completion of the program. Please log in to your student dashboard to view your tasks and track your progress.';
      doc.text(closingText, leftMargin, yPos, { width: contentWidth });
      yPos += doc.heightOfString(closingText, { width: contentWidth }) + 20;

      doc.fillColor('#444444');
      doc.fontSize(10).font('Helvetica');
      doc.text('We look forward to a productive and enriching experience with you!', leftMargin, yPos, { width: contentWidth });
      yPos += 25;

      // Signature section
      doc.moveTo(rightMargin - 180, yPos).lineTo(rightMargin, yPos)
        .strokeColor('#cccccc').lineWidth(0.5).stroke();
      yPos += 5;
      doc.fillColor('#333333');
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Authorized Signature', rightMargin - 180, yPos, { width: 180, align: 'center' });
      yPos += 14;
      doc.fillColor('#666666');
      doc.fontSize(9).font('Helvetica');
      doc.text('StackAmit Internship Program', rightMargin - 180, yPos, { width: 180, align: 'center' });

      // ─── Footer ───
      doc.fillColor('#aaaaaa');
      doc.fontSize(7).font('Helvetica');
      doc.text(`© ${new Date().getFullYear()} StackAmit. All rights reserved. | This is an auto-generated offer letter.`, leftMargin, pageHeight - 50, { width: contentWidth, align: 'center' });
      doc.text(`Offer Letter ID: SA/OFFER/${application._id.toString().slice(-8).toUpperCase()} | Generated: ${offerDate}`, leftMargin, pageHeight - 38, { width: contentWidth, align: 'center' });

      // Bottom accent bar
      doc.rect(0, pageHeight - 8, pageWidth, 8).fill('#11998e');

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
