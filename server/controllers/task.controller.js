import mongoose from 'mongoose';
import Task from '../models/Task.js';
import Submission from '../models/Submission.js';
import User from '../models/User.js';
import { logActivity } from '../services/activityLog.service.js';
import { createNotification, notifyAdmins } from '../services/notification.service.js';
import { sendTaskAssignedEmail, sendTaskReminderEmail, sendTaskDeadlineExtendedEmail } from '../services/email.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { literalSearchRegex, canAccessTask, canReviewSubmission, canSubmitTask } from '../utils/authz.js';
import { getClientBaseUrl } from '../utils/appUrl.js';
import {
  SUBMISSION_GRACE_MS,
  evaluateSubmissionWindow,
  isLateSubmission,
  extendDeadline as extendDeadlineCore,
} from '../services/taskDeadline.service.js';

// ─── Create Task (Trainer/Admin) ─────────────────────────────────────────────
export const createTask = asyncHandler(async (req, res) => {
  // Window-control fields are owned by the deadline engine (extend/reopen
  // endpoints + scheduled job) and must never be set straight from a request
  // body. The effective deadline always starts as the original one.
  const { effectiveDueDate, deadlineExtensions, submissionClosedAt, reminderSentAt, ...body } = req.body;
  const task = await Task.create({
    ...body,
    assignedBy: req.user._id,
    // The effective deadline starts identical to the original one; every
    // window/closure computation reads effectiveDueDate so extensions and
    // the scheduled job share a single source of truth.
    effectiveDueDate: req.body.dueDate,
  });

  await createNotification({
    userId: task.assignedTo,
    title: 'New Task Assigned',
    message: `Task "${task.title}" has been assigned to you. Due: ${new Date(task.dueDate).toLocaleDateString()}`,
    type: 'task_assigned',
    relatedEntity: 'task',
    relatedId: task._id,
  });

  // Notify admins about new task creation
  await notifyAdmins({
    title: 'New Task Created',
    message: `A new task "${task.title}" has been created.`,
    type: 'general',
    relatedEntity: 'task',
    relatedId: task._id,
    excludeUserId: req.user._id,
  });

  await logActivity({
    userId: req.user._id,
    action: 'create',
    entity: 'task',
    entityId: task._id,
    details: { title: task.title, assignedTo: task.assignedTo },
    req,
  });

  res.status(201).json({
    success: true,
    message: 'Task created and assigned',
    data: { task },
  });
});

// ─── Get Tasks ───────────────────────────────────────────────────────────────
export const getTasks = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, priority, search } = req.query;
  const query = {};

  if (req.user.role === 'student') {
    query.assignedTo = req.user._id;
  } else if (req.user.role === 'trainer') {
    query.assignedBy = req.user._id;
  }

  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (search) {
    // SA-014: escape the term and force a literal match (no operator injection).
    const rx = literalSearchRegex(search);
    if (rx) query.title = rx;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [tasks, total] = await Promise.all([
    Task.find(query)
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignedTo', 'name email avatar')
      .populate('assignedBy', 'name email'),
    Task.countDocuments(query),
  ]);

  // For students, attach their submission data to each task
  let result = tasks;
  if (req.user.role === 'student') {
    const taskIds = tasks.map(t => t._id);
    const submissions = await Submission.find({
      taskId: { $in: taskIds },
      studentId: req.user._id,
    }).select('taskId status submittedDate lastUpdatedAt versions isLateSubmission reviewNotes marks reviewedAt githubLink liveUrl documentation videoDemo remarks');

    const subMap = {};
    submissions.forEach(s => { subMap[s.taskId.toString()] = s; });
    result = tasks.map(t => ({
      ...t.toObject(),
      submission: subMap[t._id.toString()] || null,
    }));
  }

  res.status(200).json({
    success: true,
    data: { tasks: result, total, pages: Math.ceil(total / limit), page: parseInt(page) },
  });
});

// ─── Get Task by ID ──────────────────────────────────────────────────────────
export const getTaskById = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id)
    .populate('assignedTo', 'name email avatar firstName lastName collegeName')
    .populate('assignedBy', 'name email');

  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  // SA-007: object-level authorization. A task (and its submissions) is only
  // visible to the assigned student, the assigning trainer, or an admin.
  if (!canAccessTask(req.user, task)) {
    return res.status(403).json({ success: false, message: 'Not authorized to access this task' });
  }

  // Fetch submission for this task.
  // • student  → only their own submission (never another student's)
  // • trainer/admin → the submission for the task they manage
  const submissionFilter = req.user.role === 'student'
    ? { taskId: task._id, studentId: req.user._id }
    : { taskId: task._id };
  const submission = await Submission.findOne(submissionFilter)
    .populate('studentId', 'name email firstName lastName');

  res.status(200).json({ success: true, data: { task, submission } });
});

// ─── Update Task ─────────────────────────────────────────────────────────────
export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  // Once deadlines were extended, the original dueDate is frozen: extensions
  // must go through the extend-deadline action so the audit history and the
  // original-vs-effective distinction stay intact.
  if (
    req.body.dueDate !== undefined &&
    task.deadlineExtensions?.length > 0 &&
    new Date(req.body.dueDate).getTime() !== task.dueDate?.getTime()
  ) {
    return res.status(400).json({
      success: false,
      message: 'This task\'s deadline was extended. Use Extend Deadline to change the effective deadline instead of editing the original date.',
    });
  }

  // Window-control fields belong exclusively to the extend/reopen endpoints
  // and the scheduled job: a plain task edit must never write them directly
  // (that would bypass validation, the audit trail and student notifications).
  const { effectiveDueDate, deadlineExtensions, submissionClosedAt, reminderSentAt, ...editableBody } = req.body;
  Object.assign(task, editableBody);

  // A direct dueDate edit (before any extension) keeps the effective deadline
  // in sync and re-arms the reminder for the new deadline. If the date was
  // pulled into the future, the automatic closure stamp is lifted as well.
  if (req.body.dueDate !== undefined) {
    task.effectiveDueDate = task.dueDate;
    task.reminderSentAt = null;
    if (task.submissionClosedAt && task.dueDate && Date.now() <= task.dueDate.getTime()) {
      task.submissionClosedAt = null;
    }
  }

  await task.save();

  await logActivity({
    userId: req.user._id,
    action: 'update',
    entity: 'task',
    entityId: task._id,
    details: { fields: Object.keys(req.body) },
    req,
  });

  res.status(200).json({ success: true, message: 'Task updated', data: { task } });
});

// ─── Delete Task ─────────────────────────────────────────────────────────────
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  await Task.findByIdAndDelete(req.params.id);

  await logActivity({
    userId: req.user._id,
    action: 'delete',
    entity: 'task',
    entityId: task._id,
    req,
  });

  res.status(200).json({ success: true, message: 'Task deleted' });
});

// ─── Submit / Update Task Submission (Student) ──────────────────────────────
// One entry point for first submissions, edits of a pending submission, and
// resubmissions after a rejection. Rules enforced here (never frontend-only):
//   • ownership (SA-025) + backend deadline/window check,
//   • approved submissions are locked (grades/reviews are never reset),
//   • updates mutate the EXISTING submission record via a conditional atomic
//     findMany-style update, so simultaneous requests cannot double-apply or
//     create a second independent submission (unique {taskId,studentId}).
export const submitTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  // SA-025: a student may only submit a task that is assigned to them.
  if (!canSubmitTask(req.user, task)) {
    return res.status(403).json({ success: false, message: 'This task is not assigned to you' });
  }

  // Server-authoritative submission window (deadline + 48h grace, closures,
  // admin extensions/reopenings). Do not trust the frontend clock.
  const window = evaluateSubmissionWindow(task);
  if (!window.allowed) {
    return res.status(403).json({
      success: false,
      message: window.message,
      data: {
        submissionClosedAt: window.deadline ? new Date(window.deadline.getTime() + SUBMISSION_GRACE_MS) : null,
      },
    });
  }

  const existing = await Submission.findOne({ taskId: task._id, studentId: req.user._id });
  const now = new Date();

  if (existing) {
    // Approved work is final: editing it would silently invalidate the
    // trainer's grade/review. The existing review workflow must reject or
    // request changes first.
    if (existing.status === 'approved') {
      return res.status(409).json({
        success: false,
        message: 'This submission has been approved and can no longer be edited.',
      });
    }
    // 'submitted' (edit), 'rejected' / 'resubmission_requested' (resubmit)
    // all flow through the same update of the existing record.
    const isResubmitAfterReview =
      existing.status === 'rejected' || existing.status === 'resubmission_requested';

    // Conditional atomic update: only applies if no concurrent request
    // already bumped the version, and the DB-level unique index plus this
    // guard keep a second submission record from ever being created.
    const updated = await Submission.findOneAndUpdate(
      { _id: existing._id, versions: existing.versions },
      {
        $set: {
          githubLink: req.body.githubLink ?? existing.githubLink,
          liveUrl: req.body.liveUrl ?? existing.liveUrl,
          documentation: req.body.documentation ?? existing.documentation,
          videoDemo: req.body.videoDemo ?? existing.videoDemo,
          remarks: req.body.remarks ?? existing.remarks,
          files: req.body.files?.length ? req.body.files : existing.files,
          status: 'submitted',
          submittedDate: isResubmitAfterReview ? now : existing.submittedDate,
          lastUpdatedAt: now,
          isLateSubmission: isLateSubmission(task, isResubmitAfterReview ? now : existing.submittedDate || now),
          reviewedBy: null,
          reviewedAt: null,
          reviewNotes: null,
        },
        $inc: { versions: 1 },
      },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Your submission was updated by another request. Reload the page and try again.',
      });
    }

    // Reflect the latest version on the task (statuses keep existing
    // conventions: 'late' only when the work itself is late).
    task.status = isLateSubmission(task, now) ? 'late' : 'completed';
    task.completedAt = now;
    await task.save();

    await createNotification({
      userId: task.assignedBy,
      title: isResubmitAfterReview ? 'Task Resubmitted' : 'Task Submission Updated',
      message: isResubmitAfterReview
        ? `Task "${task.title}" has been resubmitted for review.`
        : `Task "${task.title}" submission was updated (v${updated.versions}) and needs review.`,
      type: 'task_completed',
      relatedEntity: 'submission',
      relatedId: updated._id,
    });

    return res.status(200).json({
      success: true,
      message: isResubmitAfterReview
        ? 'Task resubmitted successfully'
        : 'Submission updated successfully',
      data: { submission: updated },
    });
  }

  let submission;
  try {
    submission = await Submission.create({
      taskId: task._id,
      studentId: req.user._id,
      files: req.body.files || [],
      githubLink: req.body.githubLink,
      liveUrl: req.body.liveUrl,
      documentation: req.body.documentation,
      videoDemo: req.body.videoDemo,
      remarks: req.body.remarks,
      isLateSubmission: isLateSubmission(task, now),
    });
  } catch (error) {
    // Two simultaneous first-submit requests: the unique index lets exactly
    // one win; the loser re-reads the winning record and edits it instead.
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This task was already submitted. Refresh to view and update your submission.',
      });
    }
    throw error;
  }

  // Update task status
  task.status = submission.isLateSubmission ? 'late' : 'completed';
  task.completedAt = now;
  await task.save();

  await createNotification({
    userId: task.assignedBy,
    title: 'Task Submission',
    message: `A task "${task.title}" has been submitted for review.`,
    type: 'task_completed',
    relatedEntity: 'submission',
    relatedId: submission._id,
  });

  // Notify admins about task submission
  await notifyAdmins({
    title: 'Task Submitted',
    message: `A student submitted task "${task.title}" for review.`,
    type: 'task_completed',
    relatedEntity: 'submission',
    relatedId: submission._id,
  });

  res.status(201).json({
    success: true,
    message: 'Task submitted successfully',
    data: { submission },
  });
});

// ─── Review Submission (Trainer) ─────────────────────────────────────────────
export const reviewSubmission = asyncHandler(async (req, res) => {
  const { status, marks, reviewNotes } = req.body;

  if (!['approved', 'rejected', 'resubmission_requested'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid review status. Allowed: approved, rejected, resubmission_requested',
    });
  }

  const submission = await Submission.findById(req.params.id).populate('taskId');
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }

  // SA-012: only the trainer who assigned the task (or an admin) may review it.
  if (!canReviewSubmission(req.user, submission.taskId)) {
    return res.status(403).json({ success: false, message: 'Not authorized to review this submission' });
  }

  submission.status = status;
  submission.reviewedBy = req.user._id;
  submission.reviewedAt = new Date();
  submission.reviewNotes = reviewNotes;
  if (marks) submission.marks = marks;
  await submission.save();

  // Update task marks if approved
  if (status === 'approved' && marks) {
    await Task.findByIdAndUpdate(submission.taskId._id, { marks });
  }

  // Notify student
  const notifType = status === 'approved' ? 'project_approved' :
    status === 'rejected' ? 'project_rejected' : 'resubmission_requested';
  const notifMsg = status === 'approved' ? 'Your submission has been approved!' :
    status === 'rejected' ? 'Your submission has been rejected.' :
    'Please resubmit your task with the requested changes.';

  await createNotification({
    userId: submission.studentId,
    title: 'Submission Review',
    message: notifMsg,
    type: notifType,
    relatedEntity: 'submission',
    relatedId: submission._id,
  });

  // Notify admins about submission review
  const statusLabel = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'requested resubmission for';
  await notifyAdmins({
    title: 'Submission Reviewed',
    message: `Trainer ${statusLabel} a task submission.`,
    type: notifType,
    relatedEntity: 'submission',
    relatedId: submission._id,
    excludeUserId: req.user._id,
  });

  res.status(200).json({ success: true, message: `Submission ${status}`, data: { submission } });
});

// ─── Extend Deadline / Reopen Submission (Admin/Trainer) ───────────────────
// Moves the effective deadline into the future and reopens the window for
// the (single) student the task is assigned to. The original dueDate is
// never overwritten and every extension is appended to an immutable audit
// trail with the acting user's identity.
export const extendDeadline = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }
  // Object-level authorization: only the assigning trainer or an admin.
  if (!canReviewSubmission(req.user, task)) {
    return res.status(403).json({ success: false, message: 'Not authorized to extend this deadline' });
  }

  const { newDeadline, reason } = req.body;
  const previousClosingAt = task.effectiveDueDate || task.dueDate
    ? new Date((task.effectiveDueDate || task.dueDate).getTime() + SUBMISSION_GRACE_MS)
    : null;

  const result = await extendDeadlineCore(task._id, req.user, newDeadline, reason);
  if (!result.ok) {
    return res.status(result.status).json({ success: false, message: result.message });
  }

  const { task: updatedTask, previousDeadline } = result;
  const tasksUrl = `${getClientBaseUrl()}/student/tasks`;
  const deadlineText = updatedTask.effectiveDueDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  // assignedTo arrives as a bare ObjectId (User discriminator collection),
  // so resolve the student for the email/name used below.
  const student = await User.findById(updatedTask.assignedTo).select('name email').lean();

  // Notify the affected student through the existing notification + email
  // systems (a task is assigned to exactly one student, so scope is exact).
  await createNotification({
    userId: updatedTask.assignedTo,
    title: 'Submission Reopened',
    message: `Deadline for task "${updatedTask.title}" has been extended. New deadline: ${deadlineText}.`,
    type: 'task_assigned',
    relatedEntity: 'task',
    relatedId: updatedTask._id,
    actionUrl: tasksUrl,
  });

  // Best-effort email: a delivery failure must never roll back the saved
  // extension or fail the admin's action.
  try {
    const studentName = student?.name || 'Student';
    await sendTaskDeadlineExtendedEmail(
      student?.email,
      studentName,
      updatedTask.title,
      deadlineText,
      tasksUrl
    );
  } catch {
    console.warn(`[tasks] reopen notification email failed for task ${updatedTask._id}`);
  }

  await logActivity({
    userId: req.user._id,
    action: 'update',
    entity: 'task',
    entityId: updatedTask._id,
    details: {
      change: 'deadline_extension',
      previousDeadline,
      newDeadline: updatedTask.effectiveDueDate,
      previousClosingAt,
      reason: reason || undefined,
    },
    req,
  });

  res.status(200).json({
    success: true,
    message: 'Deadline extended and submission window reopened',
    data: { task: updatedTask },
  });
});

// ─── Reopen Submission Window (Admin/Trainer) ──────────────────────────────
// Lifts an automatic closure without moving any deadline: the currently
// effective deadline gets a fresh 48-hour window from now. Distinct from
// extend-deadline so the audit trail keeps the original deadline pure.
export const reopenSubmissionWindow = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }
  if (!canReviewSubmission(req.user, task)) {
    return res.status(403).json({ success: false, message: 'Not authorized to reopen this submission' });
  }
  if (!task.submissionClosedAt) {
    return res.status(400).json({
      success: false,
      message: 'The submission window for this task is not closed',
    });
  }

  const previousClosedAt = task.submissionClosedAt;
  task.submissionClosedAt = null;
  task.reminderSentAt = null;
  if (task.effectiveDueDate && task.effectiveDueDate <= new Date()) {
    // Without moving the deadline the reopened window would instantly
    // re-close, so it is pushed to the standard deadline + 48h horizon.
    task.effectiveDueDate = new Date(Date.now() + SUBMISSION_GRACE_MS);
    task.deadlineExtensions.push({
      previousDeadline: previousClosedAt,
      newDeadline: task.effectiveDueDate,
      extendedBy: req.user._id,
      extendedByName: req.user.name,
      extendedByRole: req.user.role,
      reason: 'Reopened closed submission window',
    });
  }
  await task.save();

  const tasksUrl = `${getClientBaseUrl()}/student/tasks`;
  // Resolve the student (assignedTo is a bare ObjectId on this query).
  const reopenedStudent = await User.findById(task.assignedTo).select('name email').lean();
  await createNotification({
    userId: task.assignedTo,
    title: 'Submission Reopened',
    message: `The submission window for task "${task.title}" has been reopened. Please submit before ${task.effectiveDueDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
    type: 'task_assigned',
    relatedEntity: 'task',
    relatedId: task._id,
    actionUrl: tasksUrl,
  });

  try {
    await sendTaskDeadlineExtendedEmail(
      reopenedStudent?.email,
      reopenedStudent?.name || 'Student',
      task.title,
      task.effectiveDueDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      tasksUrl
    );
  } catch {
    console.warn(`[tasks] reopen notification email failed for task ${task._id}`);
  }

  await logActivity({
    userId: req.user._id,
    action: 'update',
    entity: 'task',
    entityId: task._id,
    details: { change: 'submission_reopened', previousClosedAt },
    req,
  });

  res.status(200).json({ success: true, message: 'Submission window reopened', data: { task } });
});

// ─── Get Task Stats ──────────────────────────────────────────────────────────
export const getTaskStats = asyncHandler(async (req, res) => {
  const query = req.user.role === 'trainer'
    ? { assignedBy: req.user._id }
    : { assignedTo: req.user._id };

  const [total, pending, completed, late] = await Promise.all([
    Task.countDocuments(query),
    Task.countDocuments({ ...query, status: 'pending' }),
    Task.countDocuments({ ...query, status: 'completed' }),
    Task.countDocuments({ ...query, status: 'late' }),
  ]);

  res.status(200).json({
    success: true,
    data: { total, pending, completed, late, inProgress: total - pending - completed - late },
  });
});

// ─── Admin Centralized Task Monitoring ─────────────────────────────────
// Cross-trainer / cross-student oversight for the admin Task Management
// module. Every endpoint runs as ONE server-side aggregation (no N+1):
// tasks are joined with their assigned student and trainer (both live in
// the users collection via discriminators) and with their single submission
// document. The pure builders are exported so the verification suite can pin
// the filter and pipeline contracts without a live database.

const ADMIN_TASK_STATES = ['all', 'active', 'pending', 'submitted', 'late', 'awaiting_review', 'approved', 'rejected', 'closed', 'extended'];
const ADMIN_TASK_STATUS_VALUES = ['pending', 'in-progress', 'submitted', 'approved', 'rejected', 'resubmission_requested', 'completed', 'overdue', 'late', 'cancelled'];
const ADMIN_TASK_PRIORITY_VALUES = ['low', 'medium', 'high', 'critical'];

const toObjectIdOrNull = (value) =>
  mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(String(value)) : null;

const toTimeOrNull = (value) => {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
};

const clampAdminPage = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit };
};

// Whitelisted query params → { taskMatch (indexed, pre-join), derived (post-join) }
export const buildAdminTaskFilters = (query = {}, now = new Date()) => {
  const taskMatch = {};
  if (ADMIN_TASK_STATUS_VALUES.includes(query.status)) taskMatch.status = query.status;
  if (ADMIN_TASK_PRIORITY_VALUES.includes(query.priority)) taskMatch.priority = query.priority;

  const createdRange = {};
  const createdFrom = toTimeOrNull(query.createdFrom);
  const createdTo = toTimeOrNull(query.createdTo);
  if (createdFrom !== null) createdRange.$gte = new Date(createdFrom);
  if (createdTo !== null) createdRange.$lte = new Date(createdTo);
  if (Object.keys(createdRange).length > 0) taskMatch.createdAt = createdRange;

  const derived = [];
  const studentId = toObjectIdOrNull(query.studentId);
  if (studentId) derived.push({ assignedTo: studentId });
  const trainerId = toObjectIdOrNull(query.trainerId);
  if (trainerId) derived.push({ assignedBy: trainerId });

  const deadlineRange = {};
  const deadlineFrom = toTimeOrNull(query.deadlineFrom);
  const deadlineTo = toTimeOrNull(query.deadlineTo);
  if (deadlineFrom !== null) deadlineRange.$gte = new Date(deadlineFrom);
  if (deadlineTo !== null) deadlineRange.$lte = new Date(deadlineTo);
  if (Object.keys(deadlineRange).length > 0) derived.push({ effectiveDeadline: deadlineRange });

  // Literal (regex-injection safe) search across title and person records
  const search = literalSearchRegex(query.search);
  if (search) {
    derived.push({
      $or: [
        { title: search },
        { 'student.name': search },
        { 'student.email': search },
        { 'trainer.name': search },
        { 'trainer.email': search },
      ],
    });
  }

  const state = ADMIN_TASK_STATES.includes(query.state) ? query.state : 'all';
  switch (state) {
    case 'active':
      derived.push({ status: { $in: ['pending', 'in-progress'] } });
      break;
    case 'pending':
      derived.push({ hasSubmission: false, status: { $in: ['pending', 'in-progress', 'late'] } });
      break;
    case 'submitted':
      derived.push({ hasSubmission: true });
      break;
    case 'late':
      derived.push({ 'submission.isLateSubmission': true });
      break;
    case 'awaiting_review':
      derived.push({ 'submission.status': 'submitted' });
      break;
    case 'approved':
      derived.push({ 'submission.status': 'approved' });
      break;
    case 'rejected':
      derived.push({ 'submission.status': 'rejected' });
      break;
    case 'closed':
      derived.push({ isClosed: true });
      break;
    case 'extended':
      derived.push({ isExtended: true });
      break;
    default:
      break;
  }

  return { taskMatch, derived, state };
};

// Join + derived-flag stages shared by every monitoring pipeline
const adminTaskJoinStages = () => [
  {
    $lookup: {
      from: User.collection.name,
      localField: 'assignedTo',
      foreignField: '_id',
      as: 'studentDocs',
    },
  },
  {
    $lookup: {
      from: User.collection.name,
      localField: 'assignedBy',
      foreignField: '_id',
      as: 'trainerDocs',
    },
  },
  {
    $lookup: {
      from: Submission.collection.name,
      localField: '_id',
      foreignField: 'taskId',
      as: 'submissionDocs',
    },
  },
];

const adminTaskFlagStages = (now) => [
  {
    $addFields: {
      student: { $arrayElemAt: ['$studentDocs', 0] },
      trainer: { $arrayElemAt: ['$trainerDocs', 0] },
      submission: { $arrayElemAt: ['$submissionDocs', 0] },
      effectiveDeadline: { $ifNull: ['$effectiveDueDate', '$dueDate'] },
      hasSubmission: { $gt: [{ $size: '$submissionDocs' }, 0] },
      isExtended: { $ne: [{ $ifNull: ['$effectiveDueDate', '$dueDate'] }, '$dueDate'] },
      extensionCount: { $size: { $ifNull: ['$deadlineExtensions', []] } },
    },
  },
  {
    $addFields: {
      closesAt: {
        $cond: [
          { $eq: [{ $type: '$effectiveDeadline' }, 'date'] },
          { $add: ['$effectiveDeadline', SUBMISSION_GRACE_MS] },
          null,
        ],
      },
    },
  },
  {
    $addFields: {
      isClosed: {
        $or: [
          { $ne: [{ $ifNull: ['$submissionClosedAt', null] }, null] },
          { $and: [{ $ne: ['$closesAt', null] }, { $lte: ['$closesAt', now] }] },
        ],
      },
    },
  },
];

// Trimmed row shape: never let full user documents (passwords, tokens) or
// heavy submission bodies escape the join — only these fields are returned.
const ADMIN_TASK_ROW_PROJECTION = {
  title: 1,
  description: 1,
  category: 1,
  status: 1,
  priority: 1,
  dueDate: 1,
  effectiveDueDate: 1,
  effectiveDeadline: 1,
  closesAt: 1,
  submissionClosedAt: 1,
  isClosed: 1,
  isExtended: 1,
  extensionCount: 1,
  createdAt: 1,
  'student._id': '$student._id',
  'student.name': '$student.name',
  'student.email': '$student.email',
  'trainer._id': '$trainer._id',
  'trainer.name': '$trainer.name',
  'trainer.email': '$trainer.email',
  'submission._id': '$submission._id',
  'submission.status': '$submission.status',
  'submission.submittedDate': '$submission.submittedDate',
  'submission.lastUpdatedAt': '$submission.lastUpdatedAt',
  'submission.versions': '$submission.versions',
  'submission.isLateSubmission': '$submission.isLateSubmission',
  'submission.marks': '$submission.marks',
  'submission.reviewNotes': '$submission.reviewNotes',
};

export const buildAdminTasksPipeline = (query = {}, now = new Date()) => {
  const { taskMatch, derived } = buildAdminTaskFilters(query, now);
  const { page, limit } = clampAdminPage(query);
  const stages = [{ $match: taskMatch }, ...adminTaskJoinStages(), ...adminTaskFlagStages(now)];
  if (derived.length > 0) stages.push({ $match: { $and: derived } });
  stages.push(
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: ADMIN_TASK_ROW_PROJECTION }],
        total: [{ $count: 'count' }],
      },
    }
  );
  return { stages, page, limit };
};

// One $group over task documents → each metric counts every task AT MOST once
export const buildAdminTaskStatsPipeline = (now = new Date()) => [
  ...adminTaskJoinStages(),
  ...adminTaskFlagStages(now),
  {
    $group: {
      _id: null,
      totalTasks: { $sum: 1 },
      activeTasks: { $sum: { $cond: [{ $in: ['$status', ['pending', 'in-progress']] }, 1, 0] } },
      pendingSubmissions: {
        $sum: {
          $cond: [
            {
              $and: [
                { $eq: ['$hasSubmission', false] },
                { $in: ['$status', ['pending', 'in-progress', 'late']] },
              ],
            },
            1,
            0,
          ],
        },
      },
      submittedTasks: { $sum: { $cond: ['$hasSubmission', 1, 0] } },
      lateSubmissions: { $sum: { $cond: [{ $eq: ['$submission.isLateSubmission', true] }, 1, 0] } },
      awaitingReview: { $sum: { $cond: [{ $eq: ['$submission.status', 'submitted'] }, 1, 0] } },
      approvedSubmissions: { $sum: { $cond: [{ $eq: ['$submission.status', 'approved'] }, 1, 0] } },
      rejectedSubmissions: { $sum: { $cond: [{ $eq: ['$submission.status', 'rejected'] }, 1, 0] } },
      closedTasks: { $sum: { $cond: ['$isClosed', 1, 0] } },
      extendedTasks: { $sum: { $cond: ['$isExtended', 1, 0] } },
    },
  },
];

const buildAdminTaskGroupPipeline = (personField, now) => [
  ...adminTaskJoinStages(),
  ...adminTaskFlagStages(now),
  {
    $group: {
      _id: `$${personField}._id`,
      name: { $first: `$${personField}.name` },
      email: { $first: `$${personField}.email` },
      totalTasks: { $sum: 1 },
      activeTasks: { $sum: { $cond: [{ $in: ['$status', ['pending', 'in-progress']] }, 1, 0] } },
      pendingSubmissions: {
        $sum: {
          $cond: [
            {
              $and: [
                { $eq: ['$hasSubmission', false] },
                { $in: ['$status', ['pending', 'in-progress', 'late']] },
              ],
            },
            1,
            0,
          ],
        },
      },
      submittedTasks: { $sum: { $cond: ['$hasSubmission', 1, 0] } },
      lateSubmissions: { $sum: { $cond: [{ $eq: ['$submission.isLateSubmission', true] }, 1, 0] } },
      awaitingReview: { $sum: { $cond: [{ $eq: ['$submission.status', 'submitted'] }, 1, 0] } },
      approvedSubmissions: { $sum: { $cond: [{ $eq: ['$submission.status', 'approved'] }, 1, 0] } },
      rejectedSubmissions: { $sum: { $cond: [{ $eq: ['$submission.status', 'rejected'] }, 1, 0] } },
      closedTasks: { $sum: { $cond: ['$isClosed', 1, 0] } },
    },
  },
  { $sort: { name: 1, totalTasks: -1 } },
];

export const adminGetTasks = asyncHandler(async (req, res) => {
  const now = new Date();
  const { stages, page, limit } = buildAdminTasksPipeline(req.query, now);
  const [faceted] = await Task.aggregate(stages).allowDiskUse(true).exec();
  const tasks = faceted?.data || [];
  const total = faceted?.total?.[0]?.count || 0;

  res.json({
    success: true,
    data: {
      tasks,
      pagination: {
        page,
        pages: Math.ceil(total / limit) || 1,
        total,
      },
    },
  });
});

export const adminTaskStats = asyncHandler(async (req, res) => {
  const pipeline = buildAdminTaskStatsPipeline(new Date());
  const rows = await Task.aggregate(pipeline).allowDiskUse(true).exec();
  const empty = {
    totalTasks: 0,
    activeTasks: 0,
    pendingSubmissions: 0,
    submittedTasks: 0,
    lateSubmissions: 0,
    awaitingReview: 0,
    approvedSubmissions: 0,
    rejectedSubmissions: 0,
    closedTasks: 0,
    extendedTasks: 0,
  };

  res.json({ success: true, data: { stats: { ...empty, ...rows[0] } } });
});

export const adminTasksByTrainer = asyncHandler(async (req, res) => {
  const pipeline = buildAdminTaskGroupPipeline('trainer', new Date());
  const rows = await Task.aggregate(pipeline).allowDiskUse(true).exec();
  res.json({
    success: true,
    data: {
      trainers: rows.map((row) => ({ ...row, _id: row._id || null })),
    },
  });
});

export const adminTasksByStudent = asyncHandler(async (req, res) => {
  const pipeline = buildAdminTaskGroupPipeline('student', new Date());
  const rows = await Task.aggregate(pipeline).allowDiskUse(true).exec();
  res.json({
    success: true,
    data: {
      students: rows.map((row) => ({ ...row, _id: row._id || null })),
    },
  });
});
