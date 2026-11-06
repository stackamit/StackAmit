// ─────────────────────────────────────────────
// Task submission-window engine.
//
// Single source of truth for the deadline lifecycle introduced by the
// submission-management enhancement:
//   • every task has an *effective* deadline (original dueDate unless an
//     admin/trainer extended it),
//   • the submission window closes 48 hours after that effective deadline,
//   • at the deadline itself, unsubmitted students get exactly one reminder
//     (email + in-app notification),
//   • a scheduled job stamps closures so the state survives restarts and is
//     never processed twice.
//
// The pure helpers take explicit inputs (no DB, no env) so they can be
// unit-verified without infrastructure (see tests/taskSubmission.verify.mjs).
// The job functions accept their models/service clients via dependency
// injection with production defaults, for the same reason.
// ─────────────────────────────────────────────

import Task from '../models/Task.js';
import Submission from '../models/Submission.js';
import User from '../models/User.js';
import * as notificationService from './notification.service.js';
import * as emailService from './email.service.js';
import { getClientBaseUrl } from '../utils/appUrl.js';
import {
  SUBMISSION_GRACE_MS,
  TASK_DEADLINE_JOB_INTERVAL_MS,
} from '../utils/submissionWindow.js';

// Re-export so existing importers (task.controller.js) keep working and the
// grace period stays a single source of truth.
export { SUBMISSION_GRACE_MS, TASK_DEADLINE_JOB_INTERVAL_MS };

const toDate = (value) => (value instanceof Date ? value : value ? new Date(value) : null);

// ─── Pure window helpers ─────────────────────────────────────────────────────

// Currently effective deadline. Falls back to the original dueDate so
// pre-enhancement documents (without effectiveDueDate) stay consistent.
export const getEffectiveDeadline = (task) =>
  toDate(task?.effectiveDueDate) || toDate(task?.dueDate);

// Absolute timestamp after which no submit/update is accepted.
export const getSubmissionClosesAt = (task) => {
  const deadline = getEffectiveDeadline(task);
  return deadline ? new Date(deadline.getTime() + SUBMISSION_GRACE_MS) : null;
};

// True once an admin/trainer extended the deadline after the window had
// already been closed by the job — the student-facing "Reopened" state.
export const isReopenedAfterClosure = (task, now = new Date()) => {
  const closedAt = toDate(task?.submissionClosedAt);
  const effective = getEffectiveDeadline(task);
  return Boolean(closedAt && effective && effective.getTime() > closedAt.getTime() && toDate(now) <= effective);
};

// ─── Eligibility (backend authority) ─────────────────────────────────────────

// The single backend rule that decides whether a student may submit or
// update THIS task right now. Frontend badges are cosmetic; this wins.
// Returns { allowed, closed, at, deadline, closesAt, reopened, message }.
export const evaluateSubmissionWindow = (task, now = new Date()) => {
  const at = toDate(now) || new Date();
  const deadline = getEffectiveDeadline(task);
  const closesAt = getSubmissionClosesAt(task);
  const reopened = isReopenedAfterClosure(task, at);

  if (!deadline || !closesAt) {
    // Malformed legacy task: never trap the student because of bad data.
    return { allowed: true, closed: false, at, deadline, closesAt: null, reopened, message: null };
  }

  const closed =
    !reopened &&
    (task.submissionClosedAt ? at > toDate(task.submissionClosedAt) : at > closesAt);

  if (closed) {
    return {
      allowed: false,
      closed: true,
      at,
      deadline,
      closesAt,
      reopened,
      message: 'The submission window for this task is closed. Contact your trainer or admin for an extension.',
    };
  }
  return { allowed: true, closed: false, at, deadline, closesAt, reopened, message: null };
};

// Was the work delivered after the ORIGINAL deadline? (drives late flags)
export const isLateSubmission = (task, at = new Date()) => {
  const original = toDate(task?.dueDate);
  return Boolean(original && toDate(at) > original);
};

// ─── Atomic claims (duplicate prevention under concurrency / re-runs) ────────

// Claim pending reminders for tasks sitting exactly at their deadline
// (reminder ≈ 48h before the window closes). findMany + per-id conditional
// updates keep the claim atomic without requiring a replica set (standalone
// Atlas M0 has no transactions) and are safe if the sweep runs twice.
export const claimDueReminders = async (
  now = new Date(),
  deps = {},
) => {
  const taskModel = deps.taskModel || Task;
  const submissionModel = deps.submissionModel || Submission;

  // Reminders fire at the *effective* deadline (an extension moves the
  // reminder too) and only while the submission window is still open — a
  // task whose +48h horizon has elapsed is closed by the sweep, not nagged.
  // Two index-friendly passes mirror the closure sweep: new-shape tasks
  // carry effectiveDueDate; legacy tasks fall back to dueDate.
  const cutoff = new Date(now.getTime() - SUBMISSION_GRACE_MS);
  const base = {
    status: { $in: ['pending', 'in-progress'] },
    submissionClosedAt: null,
    $or: [{ reminderSentAt: null }, { reminderSentAt: { $exists: false } }],
  };
  const queries = [
    { ...base, effectiveDueDate: { $ne: null, $gte: cutoff, $lte: now } },
    { ...base, effectiveDueDate: null, dueDate: { $gte: cutoff, $lte: now } },
  ];

  const claimed = [];
  const seen = new Set();
  for (const filter of queries) {
    const candidates = await taskModel
      .find(filter)
      .select('_id title dueDate effectiveDueDate assignedTo')
      .lean()
      .cursor({ batchSize: 100 });

    for await (const task of candidates) {
      const key = String(task._id);
      if (seen.has(key)) continue;
      seen.add(key);

      // Skip students who already submitted (checked per task; index-backed).
      const submitted = await submissionModel.exists({ taskId: task._id, studentId: task.assignedTo });
      if (submitted) continue;

      const won = await taskModel.findOneAndUpdate(
        { _id: task._id, $or: [{ reminderSentAt: null }, { reminderSentAt: { $exists: false } }] },
        { $set: { reminderSentAt: now } },
        { new: false }
      ).lean().exec();
      if (won) claimed.push(task);
    }
  }
  return claimed;
};

// ─── Scheduled jobs (DB-aware; injected in tests) ────────────────────────────

// Sweep + close tasks whose absolute closing timestamp has passed.
// Idempotent: the stamp is a conditional atomic update, and already-stamped
// tasks are never re-processed. Tasks submitted on time keep their work and
// are simply marked closed for further edits (no status changes to
// 'submitted'/'completed' — closure ≠ submission status).
export const closeExpiredSubmissionWindows = async (now = new Date(), deps = {}) => {
  const taskModel = deps.taskModel || Task;
  const at = toDate(now) || new Date();
  const cutoff = new Date(at.getTime() - SUBMISSION_GRACE_MS);

  // Pass 1 (index-friendly): new-shape tasks carrying effectiveDueDate.
  // Pass 2 (legacy/backward-compat): tasks created before this enhancement
  // have no effectiveDueDate, so their dueDate is the effective deadline.
  // $expr is not index-backed, but the candidate set is bounded and the
  // stamp below is atomic, so re-runs and concurrent instances are safe.
  const queries = [
    { submissionClosedAt: null, effectiveDueDate: { $ne: null, $lte: cutoff } },
    { submissionClosedAt: null, effectiveDueDate: null, dueDate: { $lte: cutoff } },
  ];

  let closed = 0;
  for (const filter of queries) {
    const ids = await taskModel.find(filter).select('_id').lean().cursor({ batchSize: 200 });
    for await (const task of ids) {
      const stamped = await taskModel.findOneAndUpdate(
        { _id: task._id, submissionClosedAt: null },
        { $set: { submissionClosedAt: at } },
        { new: true }
      );
      if (stamped) closed++;
    }
  }
  return closed;
};

// One sweep: send due reminders (email + in-app) then close expired windows.
// Email failures never abort closure processing; a failed email un-claims the
// reminder so the next sweep retries it, while a created notification keeps
// the claim (notifications must never duplicate either).
export const runTaskDeadlineSweep = async (now = new Date(), deps = {}) => {
  const d = {
    taskModel: Task,
    submissionModel: Submission,
    userModel: User,
    notificationService,
    emailService,
    appUrl: getClientBaseUrl(),
    ...deps,
  };
  const stats = { reminded: 0, reminderEmailFailed: 0, closed: 0 };
  let claimed = [];
  try {
    claimed = await claimDueReminders(now, d);
  } catch (error) {
    console.error('[taskDeadline] reminder claim scan failed:', error.message);
  }

  for (const task of claimed) {
    let notificationDelivered = false;
    try {
      const student = await d.userModel.findById(task.assignedTo).select('name email firstName lastName').lean();
      // Reminder references the currently effective deadline (original
      // unless an admin/trainer extended it) and its +48h closing time.
      const deadline = toDate(task.effectiveDueDate) || toDate(task.dueDate);
      const closesAt = new Date(deadline.getTime() + SUBMISSION_GRACE_MS);
      const fmt = (dt) => toDate(dt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      const notification = await d.notificationService.createNotification({
        userId: task.assignedTo,
        title: 'Task Submission Pending',
        message: `Task "${task.title}" is past its deadline. You have until ${fmt(closesAt)} to submit — after that the submission window closes automatically.`,
        type: 'task_reminder',
        relatedEntity: 'task',
        relatedId: task._id,
        actionUrl: `${d.appUrl}/student/tasks`,
      });
      if (!notification) throw new Error('notification creation failed');
      notificationDelivered = true;

      // Email is strictly best-effort ONCE the notification landed: an
      // exception or a failure result is logged and counted, but never
      // rolls back the claim (that would resend the in-app notification
      // on the next sweep) and never aborts the closure sweep.
      if (student?.email) {
        try {
          const result = await d.emailService.sendTaskReminderEmail(
            student.email,
            student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student',
            task.title,
            fmt(deadline),
            fmt(closesAt),
            `${d.appUrl}/student/tasks`
          );
          if (result && result.success === false) stats.reminderEmailFailed++;
        } catch {
          stats.reminderEmailFailed++;
          console.warn(`[taskDeadline] reminder email failed for task ${task._id} (notification delivered)`);
        }
      }
      stats.reminded++;
    } catch (error) {
      // Notification delivery failed: full rollback so the next sweep
      // retries both channels together. (Already-delivered notifications
      // are never rolled back — see inner email catch above.)
      console.error(`[taskDeadline] reminder delivery failed for task ${task._id}:`, error.message);
      if (!notificationDelivered) {
        await unclaimReminderSafe(d.taskModel, task._id);
      }
    }
  }

  try {
    stats.closed = await closeExpiredSubmissionWindows(now, d);
  } catch (error) {
    console.error('[taskDeadline] closure sweep failed:', error.message);
  }
  return stats;
};

// Best-effort un-claim used by the sweep rollback path (never throws).
const unclaimReminderSafe = async (taskModel, taskId) => {
  try {
    await taskModel.findByIdAndUpdate(taskId, { $set: { reminderSentAt: null } });
  } catch {
    /* swallowed deliberately: next sweep re-claims naturally */
  }
};

// ─── Deadline extension (admin/trainer reopen) ───────────────────────────────

// Moves the *effective* deadline forward while preserving the original
// dueDate and appending an immutable audit entry. Reopening an already
// closed task clears the closure stamp. The closure sweep always recomputes
// from the currently effective deadline, so a running job can never close a
// task against a stale value (and an extension during a sweep races safely:
// the sweep's stamp is conditional on submissionClosedAt still being null
// AND its cutoff filter using the pre-extension deadline having passed).
export const extendDeadline = async (taskId, user, newDeadline, reason = '', deps = {}) => {
  const taskModel = deps.taskModel || Task;
  const nextDeadline = toDate(newDeadline);
  if (!nextDeadline || Number.isNaN(nextDeadline.getTime())) {
    return { ok: false, status: 400, message: 'A valid new deadline is required' };
  }
  const now = deps.now ? toDate(deps.now) : new Date();
  if (nextDeadline <= now) {
    return { ok: false, status: 400, message: 'New deadline must be in the future' };
  }

  const task = await taskModel.findById(taskId);
  if (!task) {
    return { ok: false, status: 404, message: 'Task not found' };
  }
  if (task.status === 'cancelled') {
    return { ok: false, status: 400, message: 'Cannot extend a cancelled task' };
  }
  if (nextDeadline.getTime() <= getEffectiveDeadline(task).getTime()) {
    return { ok: false, status: 400, message: 'New deadline must be later than the current effective deadline' };
  }

  const previousDeadline = getEffectiveDeadline(task);
  task.deadlineExtensions.push({
    previousDeadline,
    newDeadline: nextDeadline,
    extendedBy: user?._id,
    extendedByName: user?.name,
    extendedByRole: user?.role,
    reason: reason || undefined,
    extendedAt: now,
  });
  task.effectiveDueDate = nextDeadline;
  task.submissionClosedAt = null; // reopened
  task.reminderSentAt = null; // allow a fresh reminder at the new deadline
  await task.save();

  return { ok: true, task, previousDeadline };
};

// ─── Scheduler wiring (reuses one process; safe across restarts) ─────────────

let timer = null;
export const startTaskDeadlineScheduler = ({
  intervalMs = TASK_DEADLINE_JOB_INTERVAL_MS,
  runImmediately = true,
} = {}) => {
  if (timer) return timer; // single instance per process
  const tick = async () => {
    try {
      const stats = await runTaskDeadlineSweep(new Date());
      if (stats.reminded || stats.closed) {
        console.log(`[taskDeadline] sweep: reminded=${stats.reminded} closed=${stats.closed}`);
      }
    } catch (error) {
      console.error('[taskDeadline] sweep error:', error.message);
    }
  };
  if (runImmediately) tick();
  timer = setInterval(tick, intervalMs);
  timer.unref?.(); // never keep the process alive for housekeeping alone
  return timer;
};

export const stopTaskDeadlineScheduler = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
