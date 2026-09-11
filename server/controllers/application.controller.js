import Application from '../models/Application.js';
import Internship from '../models/Internship.js';
import Student from '../models/Student.js';
import Trainer from '../models/Trainer.js';
import { logActivity } from '../services/activityLog.service.js';
import { createNotification, notifyAdmins } from '../services/notification.service.js';
import { sendOfferLetterEmail } from '../services/email.service.js';
import { getIO } from '../socket/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getOfferLetterApplication, generateOfferLetterPDFBuffer } from '../services/offerLetter.service.js';

// ─── Apply for Internship ────────────────────────────────────────────────────
export const applyForInternship = asyncHandler(async (req, res) => {
  const { internshipId } = req.body;

  const internship = await Internship.findById(internshipId);
  if (!internship || internship.isDeleted) {
    return res.status(404).json({ success: false, message: 'Internship not found' });
  }
  if (internship.status !== 'published') {
    return res.status(400).json({ success: false, message: 'Internship is not accepting applications' });
  }
  if (internship.deadline < new Date()) {
    return res.status(400).json({ success: false, message: 'Application deadline has passed' });
  }
  if (internship.seats.filled >= internship.seats.total) {
    return res.status(400).json({ success: false, message: 'All seats are filled' });
  }

  const existing = await Application.findOne({ studentId: req.user._id, internshipId });
  if (existing) {
    return res.status(409).json({ success: false, message: 'You have already applied for this internship' });
  }

  const application = await Application.create({
    studentId: req.user._id,
    internshipId,
  });

  await logActivity({
    userId: req.user._id,
    action: 'create',
    entity: 'application',
    entityId: application._id,
    details: { internshipId },
    req,
  });

  // Notify admins about new application
  const studentName = req.user.name || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 'A student';
  await notifyAdmins({
    title: 'New Application Received',
    message: `${studentName} has applied for "${internship.title}".`,
    type: 'application_status',
    relatedEntity: 'application',
    relatedId: application._id,
  });

  res.status(201).json({
    success: true,
    message: 'Application submitted successfully',
    data: { application },
  });
});

// ─── Get My Applications (Student) ───────────────────────────────────────────
export const getMyApplications = asyncHandler(async (req, res) => {
  console.log('[getMyApplications] User ID:', req.user._id, 'Role:', req.user.role);
  const applications = await Application.find({ studentId: req.user._id })
    .populate('internshipId', 'title category status deadline duration seats')
    .sort({ createdAt: -1 });
  console.log('[getMyApplications] Found', applications.length, 'applications for user', req.user._id);

  res.status(200).json({ success: true, data: { applications } });
});

// ─── Get Offer Letters (Approved Applications for Student) ───────────────────
export const getOfferLetters = asyncHandler(async (req, res) => {
  const applications = await Application.find({
    studentId: req.user._id,
    status: 'approved',
  })
    .populate('internshipId', 'title category description duration startDate endDate skills responsibilities learningOutcomes')
    .populate('reviewedBy', 'name')
    .sort({ reviewedAt: -1 });

  res.status(200).json({ success: true, data: { offerLetters: applications } });
});

// ─── Get All Applications (Admin) ────────────────────────────────────────────
export const getAllApplications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, internship, search } = req.query;
  const query = {};

  if (status) query.status = status;
  if (internship) query.internshipId = internship;
  if (search) {
    // We'll filter after populate since student name is populated
    query._searchTerm = search;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  let matchQuery = { ...query };
  delete matchQuery._searchTerm;

  const [applications, total] = await Promise.all([
    Application.find(matchQuery)
      .populate('studentId', 'name email firstName lastName collegeName course year skills avatar')
      .populate('internshipId', 'title category status deadline seats duration')
      .sort({ appliedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Application.countDocuments(matchQuery),
  ]);

  // Filter by search term if provided (search in student name/email and internship title)
  let filtered = applications;
  if (query._searchTerm) {
    const term = query._searchTerm.toLowerCase();
    filtered = applications.filter(app => {
      const studentName = (app.studentId?.name || `${app.studentId?.firstName || ''} ${app.studentId?.lastName || ''}`).toLowerCase();
      const studentEmail = (app.studentId?.email || '').toLowerCase();
      const internshipTitle = (app.internshipId?.title || '').toLowerCase();
      return studentName.includes(term) || studentEmail.includes(term) || internshipTitle.includes(term);
    });
  }

  res.status(200).json({
    success: true,
    data: { applications: filtered, total, pages: Math.ceil(total / limit), page: parseInt(page) },
  });
});

// ─── Get Applications for Internship (Admin/Trainer) ─────────────────────────
export const getInternshipApplications = asyncHandler(async (req, res) => {
  const { internshipId } = req.params;
  const { status } = req.query;

  const query = { internshipId };
  if (status) query.status = status;

  const applications = await Application.find(query)
    .populate('studentId', 'name email avatar collegeName course year skills')
    .populate('internshipId', 'title category')
    .sort({ appliedDate: -1 });

  res.status(200).json({ success: true, data: { applications } });
});

// ─── Approve Application ─────────────────────────────────────────────────────
export const approveApplication = asyncHandler(async (req, res) => {
  const { trainerId } = req.body;

  const application = await Application.findById(req.params.id)
    .populate('internshipId')
    .populate('studentId', 'name email firstName lastName');

  if (!application) {
    return res.status(404).json({ success: false, message: 'Application not found' });
  }
  if (application.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Application is not pending' });
  }

  // Validate trainer if provided
  let trainer = null;
  if (trainerId) {
    trainer = await Trainer.findById(trainerId);
    if (!trainer) {
      return res.status(404).json({ success: false, message: 'Selected trainer not found' });
    }
    // Check trainer capacity
    const availableSlots = trainer.maxStudents - trainer.assignedStudents.length;
    if (availableSlots <= 0) {
      return res.status(400).json({ success: false, message: 'Trainer has no available slots' });
    }
  }

  // Approve application
  application.status = 'approved';
  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();
  await application.save();

  // Increment filled seats
  application.internshipId.seats.filled += 1;
  await application.internshipId.save();

  // Assign trainer and internship to student
  if (trainer) {
    // Set trainer and current internship on student
    await Student.findByIdAndUpdate(application.studentId._id, {
      $set: {
        assignedTrainer: trainer._id,
        currentInternship: application.internshipId._id,
      },
    });

    // Add student to trainer's assigned list
    if (!trainer.assignedStudents.includes(application.studentId._id)) {
      trainer.assignedStudents.push(application.studentId._id);
      await trainer.save();
    }
  } else {
    // No trainer selected, just set the internship
    await Student.findByIdAndUpdate(application.studentId._id, {
      $set: { currentInternship: application.internshipId._id },
    });
  }

  // Notify student
  await createNotification({
    userId: application.studentId._id,
    title: 'Internship Offer Letter Received!',
    message: `Congratulations! Your application for "${application.internshipId.title}" has been approved. You have received an internship offer letter.${trainer ? ` Your trainer is ${trainer.name}.` : ''} Check your dashboard and email for the offer letter.`,
    type: 'offer_letter',
    relatedEntity: 'application',
    relatedId: application._id,
    actionUrl: '/student/offer-letters',
  });

  // Emit real-time socket notification to the student
  try {
    const io = getIO();
    io.to(`user:${application.studentId._id}`).emit('notification', {
      title: 'Internship Offer Letter Received!',
      message: `Congratulations! Your application for "${application.internshipId.title}" has been approved. Check your email and dashboard for the offer letter.`,
      type: 'offer_letter',
      relatedEntity: 'application',
      relatedId: application._id,
      actionUrl: '/student/offer-letters',
    });
  } catch (socketErr) {
    console.error('Socket emit error (offer letter):', socketErr.message);
  }

  // Send offer letter email with the PDF attached (non-blocking - don't fail the request if email fails)
  const studentName = application.studentId?.name || `${application.studentId?.firstName || ''} ${application.studentId?.lastName || ''}`.trim() || 'Student';
  const studentEmail = application.studentId?.email;
  if (studentEmail) {
    (async () => {
      try {
        // Re-fetch with full population so the attached PDF contains complete student details
        const fullApplication = await getOfferLetterApplication(application._id);
        const pdfBuffer = fullApplication ? await generateOfferLetterPDFBuffer(fullApplication) : null;
        const result = await sendOfferLetterEmail(
          studentEmail,
          studentName,
          application.internshipId.title,
          application.internshipId.category,
          application.internshipId.duration,
          trainer?.name || null,
          application._id,
          pdfBuffer,
          application.reviewedAt
        );
        if (result?.success) {
          console.log(`[OfferLetter] Email ${pdfBuffer ? 'with PDF attachment ' : ''}sent to ${studentEmail} for "${application.internshipId.title}"`);
        } else {
          console.warn(`[OfferLetter] Email failed for ${studentEmail}:`, result?.error);
        }
      } catch (err) {
        console.error('[OfferLetter] Email error:', err.message);
      }
    })();
  }

  // Notify trainer
  if (trainer) {
    const studentName = application.studentId?.name || `${application.studentId?.firstName || ''} ${application.studentId?.lastName || ''}`.trim() || 'A student';
    await createNotification({
      userId: trainer._id,
      title: 'New Student Assigned',
      message: `${studentName} has been assigned to you for "${application.internshipId.title}".`,
      type: 'general',
      relatedEntity: 'application',
      relatedId: application._id,
    });
  }

  // Notify admins about approval
  const approvedBy = req.user.role === 'admin' ? 'Admin' : 'Trainer';
  const studentNameForAdmin = application.studentId?.name || `${application.studentId?.firstName || ''} ${application.studentId?.lastName || ''}`.trim() || 'A student';
  await notifyAdmins({
    title: 'Application Approved',
    message: `${approvedBy} approved ${studentNameForAdmin}'s application for "${application.internshipId.title}".${trainer ? ` Trainer: ${trainer.name}.` : ''}`,
    type: 'internship_approved',
    relatedEntity: 'application',
    relatedId: application._id,
    excludeUserId: req.user._id,
  });

  await logActivity({
    userId: req.user._id,
    action: 'approve',
    entity: 'application',
    entityId: application._id,
    details: { trainerId },
    req,
  });

  res.status(200).json({
    success: true,
    message: `Application approved${trainer ? ' and trainer assigned' : ''}`,
    data: { application, trainerAssigned: !!trainer },
  });
});

// ─── Reject Application ──────────────────────────────────────────────────────
export const rejectApplication = asyncHandler(async (req, res) => {
  const application = await Application.findById(req.params.id)
    .populate('internshipId');

  if (!application) {
    return res.status(404).json({ success: false, message: 'Application not found' });
  }

  application.status = 'rejected';
  application.reviewedBy = req.user._id;
  application.reviewedAt = new Date();
  application.reviewNotes = req.body.notes;
  await application.save();

  await createNotification({
    userId: application.studentId,
    title: 'Application Update',
    message: `Your application for "${application.internshipId.title}" was not selected.`,
    type: 'internship_rejected',
    relatedEntity: 'application',
    relatedId: application._id,
  });

  // Notify admins about rejection
  await notifyAdmins({
    title: 'Application Rejected',
    message: `An application for "${application.internshipId.title}" has been rejected.`,
    type: 'internship_rejected',
    relatedEntity: 'application',
    relatedId: application._id,
    excludeUserId: req.user._id,
  });

  res.status(200).json({ success: true, message: 'Application rejected' });
});

// ─── Withdraw Application (Student) ─────────────────────────────────────────
export const withdrawApplication = asyncHandler(async (req, res) => {
  const application = await Application.findOne({
    _id: req.params.id,
    studentId: req.user._id,
  });

  if (!application) {
    return res.status(404).json({ success: false, message: 'Application not found' });
  }
  if (application.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Can only withdraw pending applications' });
  }

  application.status = 'withdrawn';
  await application.save();

  res.status(200).json({ success: true, message: 'Application withdrawn' });
});

// ─── Get All Offer Letters (Admin) ──────────────────────────────────────────
export const getAllOfferLetters = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [offerLetters, total] = await Promise.all([
    Application.find({ status: 'approved' })
      .populate('studentId', 'name email firstName lastName collegeName course year avatar')
      .populate('internshipId', 'title category status duration startDate endDate')
      .populate('reviewedBy', 'name')
      .sort({ reviewedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Application.countDocuments({ status: 'approved' }),
  ]);

  // Filter by search term if provided
  let filtered = offerLetters;
  if (search) {
    const term = search.toLowerCase();
    filtered = offerLetters.filter(app => {
      const studentName = (app.studentId?.name || `${app.studentId?.firstName || ''} ${app.studentId?.lastName || ''}`).toLowerCase();
      const studentEmail = (app.studentId?.email || '').toLowerCase();
      const internshipTitle = (app.internshipId?.title || '').toLowerCase();
      return studentName.includes(term) || studentEmail.includes(term) || internshipTitle.includes(term);
    });
  }

  res.status(200).json({
    success: true,
    data: { offerLetters: filtered, total, pages: Math.ceil(total / limit), page: parseInt(page) },
  });
});

// ─── Download Offer Letter PDF ──────────────────────────────────────────────
export const downloadOfferLetterPDF = asyncHandler(async (req, res) => {
  const application = await getOfferLetterApplication(req.params.id);

  if (!application) {
    return res.status(404).json({ success: false, message: 'Application not found' });
  }
  if (application.status !== 'approved') {
    return res.status(400).json({ success: false, message: 'Offer letter is only available for approved applications' });
  }

  // Verify access: student who owns it, or admin/trainer
  if (req.user.role === 'student' && application.studentId._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const student = application.studentId;
  const studentName = student?.name || `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || 'Student';
  const fileName = `Offer-Letter-${studentName.replace(/\s+/g, '-')}-${application._id}.pdf`;

  const pdfBuffer = await generateOfferLetterPDFBuffer(application);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(pdfBuffer);
});

// ─── Resend Offer Letter Email (Admin) ──────────────────────────────────────
export const resendOfferLetterEmail = asyncHandler(async (req, res) => {
  const application = await getOfferLetterApplication(req.params.id);

  if (!application) {
    return res.status(404).json({ success: false, message: 'Application not found' });
  }
  if (application.status !== 'approved') {
    return res.status(400).json({ success: false, message: 'Offer letter is only available for approved applications' });
  }
  if (!application.internshipId) {
    return res.status(400).json({ success: false, message: 'Internship details not found for this application' });
  }

  const student = application.studentId;
  if (!student?.email) {
    return res.status(400).json({ success: false, message: 'Student email not found' });
  }

  const studentName = student?.name || `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || 'Student';
  const trainerName = student.assignedTrainer?.name || null;

  // Generate the offer letter PDF and send the email with it attached
  const pdfBuffer = await generateOfferLetterPDFBuffer(application);
  const result = await sendOfferLetterEmail(
    student.email,
    studentName,
    application.internshipId.title,
    application.internshipId.category,
    application.internshipId.duration,
    trainerName,
    application._id,
    pdfBuffer,
    application.reviewedAt
  );

  if (!result?.success) {
    return res.status(500).json({ success: false, message: `Failed to send offer letter email: ${result?.error || 'email service error'}` });
  }

  await logActivity({
    userId: req.user._id,
    action: 'generate',
    entity: 'application',
    entityId: application._id,
    details: { offerLetterEmailResent: true, sentTo: student.email },
    req,
  });

  res.status(200).json({
    success: true,
    message: `Offer letter email with PDF has been resent to ${student.email}`,
  });
});
