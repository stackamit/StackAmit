import Task from '../models/Task.js';
import Submission from '../models/Submission.js';
import { logActivity } from '../services/activityLog.service.js';
import { createNotification, notifyAdmins } from '../services/notification.service.js';
import { sendTaskAssignedEmail } from '../services/email.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// ─── Create Task (Trainer/Admin) ─────────────────────────────────────────────
export const createTask = asyncHandler(async (req, res) => {
  const task = await Task.create({
    ...req.body,
    assignedBy: req.user._id,
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
    query.title = { $regex: search, $options: 'i' };
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
    }).select('taskId status submittedDate reviewNotes marks reviewedAt githubLink liveUrl remarks');

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

  // Fetch submission for this task (if student submitted)
  const submission = await Submission.findOne({ taskId: task._id })
    .populate('studentId', 'name email firstName lastName');

  res.status(200).json({ success: true, data: { task, submission } });
});

// ─── Update Task ─────────────────────────────────────────────────────────────
export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  Object.assign(task, req.body);
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

// ─── Submit Task (Student) ───────────────────────────────────────────────────
export const submitTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  const existing = await Submission.findOne({ taskId: task._id, studentId: req.user._id });
  if (existing) {
    // Allow resubmission if previous submission was rejected or resubmission was requested
    if (existing.status === 'rejected' || existing.status === 'resubmission_requested') {
      existing.githubLink = req.body.githubLink || existing.githubLink;
      existing.liveUrl = req.body.liveUrl || existing.liveUrl;
      existing.documentation = req.body.documentation || existing.documentation;
      existing.videoDemo = req.body.videoDemo || existing.videoDemo;
      existing.remarks = req.body.remarks || existing.remarks;
      if (req.body.files?.length) existing.files = req.body.files;
      existing.status = 'submitted';
      existing.submittedDate = new Date();
      existing.reviewedBy = null;
      existing.reviewedAt = null;
      existing.reviewNotes = null;
      await existing.save();

      // Reset task status back to completed (awaiting review)
      task.status = 'completed';
      task.completedAt = new Date();
      await task.save();

      await createNotification({
        userId: task.assignedBy,
        title: 'Task Resubmitted',
        message: `Task "${task.title}" has been resubmitted for review.`,
        type: 'task_completed',
        relatedEntity: 'submission',
        relatedId: existing._id,
      });

      return res.status(200).json({
        success: true,
        message: 'Task resubmitted successfully',
        data: { submission: existing },
      });
    }
    return res.status(409).json({ success: false, message: 'Task already submitted and pending review' });
  }

  const submission = await Submission.create({
    taskId: task._id,
    studentId: req.user._id,
    files: req.body.files || [],
    githubLink: req.body.githubLink,
    liveUrl: req.body.liveUrl,
    documentation: req.body.documentation,
    videoDemo: req.body.videoDemo,
    remarks: req.body.remarks,
  });

  // Update task status
  task.status = 'completed';
  task.completedAt = new Date();
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

  const submission = await Submission.findById(req.params.id).populate('taskId');
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
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
