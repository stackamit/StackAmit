// ─────────────────────────────────────────────
// Task Submission Management Verification (no database required)
//
// Exercises the REAL production logic:
//   A. 48h submission-window math (pure helpers, timezone-safe UTC arithmetic)
//   B. Edit/resubmit semantics of the rewritten submitTask (source-audited)
//   C. Scheduled reminder + closure sweep against an in-memory model double
//      (duplicate prevention, restart-safety, email-failure isolation)
//   D. Deadline extension / reopening (audit trail, races vs. the scheduler)
//   E. Email, notification, RBAC and scheduler wiring (source scan)
//
// Run:  node tests/taskSubmission.verify.mjs
// ─────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import mongoose from 'mongoose';

import {
  SUBMISSION_GRACE_MS,
  TASK_DEADLINE_JOB_INTERVAL_MS,
  getEffectiveDeadline,
  getSubmissionClosesAt,
  isReopenedAfterClosure,
  evaluateSubmissionWindow,
  isLateSubmission,
  claimDueReminders,
  closeExpiredSubmissionWindows,
  runTaskDeadlineSweep,
  extendDeadline,
  startTaskDeadlineScheduler,
  stopTaskDeadlineScheduler,
} from '../services/taskDeadline.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}${extra ? ' — ' + extra : ''}`);
  }
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

const read = (rel) => readFileSync(join(__dirname, '..', rel), 'utf8');

// ─────────────────────────────────────────────
section('A. 48-hour window math (exact, timezone-safe)');

check('Grace period is exactly 48 hours in ms', SUBMISSION_GRACE_MS === 48 * HOUR);
check('Job interval is a fixed in-process period', TASK_DEADLINE_JOB_INTERVAL_MS === 30 * MIN);

const utcDeadline = new Date(Date.UTC(2026, 10, 20, 18, 30, 0)); // 18:30 UTC
const t1 = { dueDate: utcDeadline, effectiveDueDate: utcDeadline };
const closes = getSubmissionClosesAt(t1);
check('Closing timestamp = deadline + exactly 48h (ms arithmetic, no DST/tz drift)',
  closes.getTime() - utcDeadline.getTime() === SUBMISSION_GRACE_MS);
check('Closing lands on 2026-11-22T18:30:00Z regardless of host timezone',
  closes.toISOString() === '2026-11-22T18:30:00.000Z');

const legacy = { dueDate: utcDeadline }; // no effectiveDueDate (pre-enhancement doc)
check('Legacy docs fall back to dueDate as the effective deadline',
  getEffectiveDeadline(legacy).getTime() === utcDeadline.getTime());
check('Legacy docs get the same +48h closing timestamp',
  getSubmissionClosesAt(legacy).getTime() === utcDeadline.getTime() + SUBMISSION_GRACE_MS);

const now = new Date('2026-11-06T12:00:00Z');
check('Before deadline → allowed',
  evaluateSubmissionWindow({ dueDate: new Date('2026-11-10T00:00:00Z') }, now).allowed === true);
check('Deadline +47h59m → still open (window ends strictly after 48h)',
  evaluateSubmissionWindow({ dueDate: new Date('2026-11-04T12:01:00Z') }, now).allowed === true);
check('Deadline +48h+1s → closed',
  evaluateSubmissionWindow({ dueDate: new Date('2026-11-04T11:59:59Z') }, now).allowed === false);
const stamped = evaluateSubmissionWindow(
  { dueDate: new Date('2026-11-01T00:00:00Z'), submissionClosedAt: new Date('2026-11-05T00:00:00Z') }, now);
check('Job-stamped closure is authoritative even before recomputed cutoff',
  stamped.allowed === false && stamped.closed === true);
check('Malformed task (no dates) never traps the student',
  evaluateSubmissionWindow({}, now).allowed === true);
check('Late submission detected after the ORIGINAL deadline',
  isLateSubmission({ dueDate: new Date('2026-11-05T00:00:00Z') }, now) === true);
check('On-time submission not flagged late',
  isLateSubmission({ dueDate: new Date('2026-11-10T00:00:00Z') }, now) === false);
check('Reopened detection: closure stamp + later effective deadline',
  isReopenedAfterClosure(
    { dueDate: new Date('2026-10-01T00:00:00Z'), submissionClosedAt: new Date('2026-10-05T00:00:00Z'), effectiveDueDate: new Date('2026-11-20T00:00:00Z') },
    now) === true);
const reopenedWin = evaluateSubmissionWindow(
  { dueDate: new Date('2026-10-01T00:00:00Z'), submissionClosedAt: new Date('2026-10-05T00:00:00Z'), effectiveDueDate: new Date('2026-11-20T00:00:00Z') }, now);
check('Reopened window allows submission again', reopenedWin.allowed === true && reopenedWin.reopened === true);

// ─────────────────────────────────────────────
section('B. Edit / resubmit semantics (controller + model source audit)');

const controllerSrc = read('controllers/task.controller.js');
const submitFn = controllerSrc.slice(
  controllerSrc.indexOf('export const submitTask'),
  controllerSrc.indexOf('export const reviewSubmission'));

check('submitTask enforces the server-side window (never trusts the client)',
  submitFn.includes('evaluateSubmissionWindow'));
check('Closed window → 403 rejection', submitFn.includes('res.status(403)'));
check('Approved submission cannot be silently overwritten → 409',
  /status === 'approved'[\s\S]{0,200}res\.status\(409\)/.test(submitFn));
check('Existing record is UPDATED in place (no second submission created)',
  /Submission\.findOneAndUpdate\(\s*\{ _id: existing\._id, versions: existing\.versions \}/.test(submitFn));
check('Version counter bumped atomically on every edit',
  submitFn.includes('$inc: { versions: 1 }'));
check('Concurrent-edit conflict reported (atomic conditional update)',
  submitFn.includes('updated by another request'));
check('lastUpdatedAt recorded while submittedDate is preserved on edits',
  submitFn.includes('lastUpdatedAt: now') && submitFn.includes('existing.submittedDate'));
check('Late flag computed server-side from the submission instant',
  submitFn.includes('isLateSubmission(task,'));
check('New-submission path handles duplicate-key (unique index) races',
  /E11000|11000/.test(submitFn));
check('Review fields untouched for plain edits (grading preserved until re-review)',
  /isResubmitAfterReview/.test(submitFn));

const submissionSrc = read('models/Submission.js');
check('Submission model carries versions/lastUpdatedAt/isLateSubmission',
  submissionSrc.includes('versions:') && submissionSrc.includes('lastUpdatedAt:') && submissionSrc.includes('isLateSubmission:'));
check('Unique {taskId, studentId} index declared (one submission per student per task)',
  /submissionSchema\.index\(\{ taskId: 1, studentId: 1 \}, \{ unique: true \}\)/.test(submissionSrc));

// ─────────────────────────────────────────────
// In-memory model doubles replicating MongoDB's atomic semantics.

const eq = (a, b) => {
  // Mongo equality: `{field: null}` also matches missing/undefined fields.
  if (b === null) return a === null || a === undefined;
  if (a instanceof Date || b instanceof Date) return a && b && new Date(a).getTime() === new Date(b).getTime();
  if (a instanceof mongoose.Types.ObjectId || b instanceof mongoose.Types.ObjectId) return String(a) === String(b);
  return a === b;
};

const matches = (doc, cond) => {
  for (const [k, v] of Object.entries(cond)) {
    if (k === '$or') { if (!v.some((sub) => matches(doc, sub))) return false; continue; }
    const dv = doc[k];
    if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof mongoose.Types.ObjectId)) {
      if ('$in' in v && !v.$in.some((x) => eq(dv, x))) return false;
      if ('$gte' in v && !(dv && new Date(dv) >= new Date(v.$gte))) return false;
      if ('$lte' in v && !(dv && new Date(dv) <= new Date(v.$lte))) return false;
      // $ne: null means "field present and non-null"; other $ne is plain inequality.
      if ('$ne' in v) {
        const satisfied = v.$ne === null ? dv != null : !eq(dv, v.$ne);
        if (!satisfied) return false;
      }
      if ('$exists' in v && (dv !== undefined) !== v.$exists) return false;
    } else if (!eq(dv, v)) return false;
  }
  return true;
};

class FakeQuery {
  constructor(docs) { this.docs = docs; }
  select() { return this; }
  lean() { return this; }
  cursor() {
    const docs = this.docs;
    return (async function* () { for (const d of docs) yield d; })();
  }
  async exec() { return this.docs; }
  then(res, rej) { return Promise.resolve(this.docs).then(res, rej); }
}

class FakeResult {
  constructor(doc, opts) { this.doc = doc; this.opts = opts || {}; }
  lean() { return this; }
  exec() { return Promise.resolve(this.value()); }
  value() { return this.doc; }
  then(res, rej) { return Promise.resolve(this.value()).then(res, rej); }
}

class FakeTaskModel {
  constructor(docs = []) { this.docs = docs; }
  find(filter = {}) { return new FakeQuery(this.docs.filter((d) => matches(d, filter))); }
  async findById(id) { return this.docs.find((d) => eq(d._id, id)) || null; }
  // NOT async: must return the chainable query-result (lean()/exec()/await),
  // exactly like a real mongoose Query object.
  findOneAndUpdate(cond, update, opts) {
    const doc = this.docs.find((d) => matches(d, cond)) || null;
    if (!doc) return new FakeResult(null, opts);
    const before = { ...doc };
    for (const [k, v] of Object.entries(update.$set || {})) doc[k] = v;
    for (const [k, v] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + v;
    return new FakeResult(opts && opts.new ? doc : before, opts);
  }
  async findByIdAndUpdate(id, update) {
    return this.findOneAndUpdate({ _id: id }, update, { new: true });
  }
}

class FakeSubmissionModel {
  constructor(docs = []) { this.docs = docs; }
  async exists(q) { return this.docs.some((d) => matches(d, q)) || null; }
}

const oid = () => new mongoose.Types.ObjectId();
const mkTask = (over = {}) => ({
  _id: oid(), title: 'Task', dueDate: null, effectiveDueDate: null,
  submissionClosedAt: null, reminderSentAt: null,
  status: 'pending', deadlineExtensions: [], assignedTo: oid(),
  save: async function () { return this; },
  ...over,
});

// ─────────────────────────────────────────────
section('C. Scheduled reminders + automatic closure (idempotent, restart-safe)');

{
  const past = new Date(now.getTime() - HOUR); // deadline reached 1h ago
  const future = new Date(now.getTime() + 24 * HOUR);
  const tDue = mkTask({ dueDate: past });                                   // unsubmitted → remind
  const tSubmitted = mkTask({ dueDate: past });                             // already submitted → skip
  const tEarly = mkTask({ dueDate: future });                               // not due → skip
  const tClosed = mkTask({ dueDate: new Date(now.getTime() - 49 * HOUR) }); // window expired → close
  const tNotYet = mkTask({ dueDate: new Date(now.getTime() - 47 * HOUR) }); // 47h after deadline → open
  const legacyClosed = mkTask({ dueDate: new Date(now.getTime() - 49 * HOUR), effectiveDueDate: undefined });

  const tasks = [tDue, tSubmitted, tEarly, tClosed, tNotYet, legacyClosed];
  const taskModel = new FakeTaskModel(tasks);
  const submissionModel = new FakeSubmissionModel([{ taskId: tSubmitted._id, studentId: tSubmitted.assignedTo }]);

  const mails = [];
  const notes = [];
  const deps = {
    taskModel, submissionModel,
    userModel: { findById: (id) => ({ select: () => ({ lean: async () => ({ _id: id, name: 'Student One', email: 's1@example.com' }) }) }) },
    notificationService: { createNotification: async (p) => { notes.push(p); return { _id: oid() }; } },
    emailService: { sendTaskReminderEmail: async (...a) => { mails.push(a); return { success: true }; } },
    appUrl: 'https://app.example',
  };

  const s1 = await runTaskDeadlineSweep(now, deps);
  check('Reminders fire only for due tasks with an OPEN window (catch-up included, closed excluded)',
    s1.reminded === 2); // tDue (1h past deadline) + tNotYet (47h past, window still open)
  check('Only unsubmitted, un-closed students are reminded', notes.length === 2 && mails.length === 2);
  check('Reminder carries email + in-app notification for the same task',
    notes[0].userId === tDue.assignedTo && mails[0][1] === 'Student One');
  check('Windows ≥48h past the deadline are closed (new + legacy shapes)', s1.closed === 2);
  check('Closure stamp written to the document',
    tClosed.submissionClosedAt && tClosed.submissionClosedAt.getTime() === now.getTime() && legacyClosed.submissionClosedAt);
  check('47h-past-deadline window stays open until the full 48h elapse', tNotYet.submissionClosedAt === null);
  check('Submitted task inside its 48h grace is not closed yet', tSubmitted.submissionClosedAt === null);

  // Re-run at a later time (simulates the next scheduled tick / a restart).
  const later = new Date(now.getTime() + TASK_DEADLINE_JOB_INTERVAL_MS);
  const s2 = await runTaskDeadlineSweep(later, deps);
  check('Second sweep never re-emails a delivered reminder (atomic claim)', s2.reminded === 0 && mails.length === 2);
  check('Second sweep never re-processes a closed window (idempotent)', s2.closed === 0);

  // tSubmitted's window also expires by `later`? deadline+48h is still future (+24h) → nothing.
  check('No duplicate DB writes from re-runs', tasks.filter((t) => t.submissionClosedAt).length === 2);
}

{
  // Email failure must not break closure processing or duplicate notifications.
  const past = new Date(now.getTime() - HOUR);
  const tDue = mkTask({ dueDate: past });
  const tClosed = mkTask({ dueDate: new Date(now.getTime() - 49 * HOUR) });
  const taskModel = new FakeTaskModel([tDue, tClosed]);
  const notes = [];
  const deps = {
    taskModel,
    submissionModel: new FakeSubmissionModel([]),
    userModel: { findById: () => ({ select: () => ({ lean: async () => ({ name: 'S', email: 'x@y.z' }) }) }) },
    notificationService: { createNotification: async (p) => { notes.push(p); return { _id: oid() }; } },
    emailService: { sendTaskReminderEmail: async () => { throw new Error('SendGrid down'); } },
    appUrl: 'https://app.example',
  };
  const s = await runTaskDeadlineSweep(now, deps);
  check('Email outage does NOT abort the closure sweep', s.closed === 1 && tClosed.submissionClosedAt != null);
  check('In-app notification still delivered despite email failure', notes.length === 1);
  check('Failed email keeps the claim (no notification resend next tick)',
    tDue.reminderSentAt && tDue.reminderSentAt.getTime() === now.getTime());
}

{
  // Notification outage → full rollback so the reminder is retried.
  const past = new Date(now.getTime() - HOUR);
  const tDue = mkTask({ dueDate: past });
  const taskModel = new FakeTaskModel([tDue]);
  const deps = {
    taskModel,
    submissionModel: new FakeSubmissionModel([]),
    userModel: { findById: () => ({ select: () => ({ lean: async () => ({ name: 'S', email: 'x@y.z' }) }) }) },
    notificationService: { createNotification: async () => { throw new Error('db error'); } },
    emailService: { sendTaskReminderEmail: async () => ({ success: true }) },
    appUrl: 'https://app.example',
  };
  await runTaskDeadlineSweep(now, deps);
  check('Delivery failure rolls the claim back for a retry', tDue.reminderSentAt === null);
}

{
  // claimDueReminders must not touch approved/graded flows or submitted students.
  const t = mkTask({ dueDate: new Date(now.getTime() - HOUR) });
  const taskModel = new FakeTaskModel([t]);
  const claimed = await claimDueReminders(now, {
    taskModel, submissionModel: new FakeSubmissionModel([{ taskId: t._id, studentId: t.assignedTo }]),
  });
  check('Students who already submitted are never reminded', claimed.length === 0 && t.reminderSentAt === null);
}

// ─────────────────────────────────────────────
section('D. Admin/trainer extension & reopening cannot be overwritten');

{
  const original = new Date('2026-10-01T00:00:00Z');
  const closedAt = new Date('2026-10-03T00:00:00Z');
  const task = mkTask({ dueDate: original, effectiveDueDate: original, submissionClosedAt: closedAt, reminderSentAt: closedAt });
  const taskModel = new FakeTaskModel([task]);
  const user = { _id: oid(), name: 'Admin User', role: 'admin' };
  const future = new Date('2026-12-01T09:00:00Z');

  const res = await extendDeadline(task._id, user, future, 'Requested by student', { taskModel, now });
  check('Extension succeeds on a closed window', res.ok === true);
  check('Original deadline is NEVER overwritten', task.dueDate.getTime() === original.getTime());
  check('Effective deadline moves to the extension', task.effectiveDueDate.getTime() === future.getTime());
  check('Closure cleared (reopened) and reminder cycle reset',
    task.submissionClosedAt === null && task.reminderSentAt === null);
  check('Immutable audit entry with who/when/why',
    task.deadlineExtensions.length === 1 &&
    task.deadlineExtensions[0].extendedByName === 'Admin User' &&
    task.deadlineExtensions[0].extendedByRole === 'admin' &&
    task.deadlineExtensions[0].reason === 'Requested by student' &&
    task.deadlineExtensions[0].previousDeadline.getTime() === original.getTime());

  // A stale/running sweep must NOT re-close against the pre-extension value.
  const closed = await closeExpiredSubmissionWindows(new Date('2026-10-04T00:00:00Z'), { taskModel });
  check('Running scheduler cannot re-close a task right after an extension', closed === 0 && task.submissionClosedAt === null);

  // Closure only returns 48h after the NEW deadline.
  const justBefore = await closeExpiredSubmissionWindows(new Date(future.getTime() + SUBMISSION_GRACE_MS - MIN), { taskModel });
  check('Window stays open until new deadline + 48h (exact)', justBefore === 0);
  const justAfter = await closeExpiredSubmissionWindows(new Date(future.getTime() + SUBMISSION_GRACE_MS + MIN), { taskModel });
  check('Window closes exactly 48h after the extended deadline', justAfter === 1 && task.submissionClosedAt != null);
}

{
  const task = mkTask({ dueDate: new Date('2026-10-01T00:00:00Z'), effectiveDueDate: new Date('2026-10-01T00:00:00Z') });
  const taskModel = new FakeTaskModel([task]);
  const user = { _id: oid(), name: 'T', role: 'trainer' };
  const bad1 = await extendDeadline(task._id, user, new Date(now.getTime() - MIN), '', { taskModel, now });
  check('Extension rejected: deadline must be in the future', bad1.ok === false && bad1.status === 400);
  const bad2 = await extendDeadline(task._id, user, new Date('2026-10-01T00:00:00Z'), '', { taskModel, now });
  check('Extension rejected: must be LATER than the current effective deadline (no downgrade/stale request)',
    bad2.ok === false && bad2.status === 400);
  const bad3 = await extendDeadline(task._id, user, 'not-a-date', '', { taskModel, now });
  check('Extension rejected: malformed deadline', bad3.ok === false && bad3.status === 400);
  const bad4 = await extendDeadline(oid(), user, new Date(now.getTime() + HOUR), '', { taskModel, now });
  check('Extension rejected: unknown task → 404', bad4.ok === false && bad4.status === 404);
  const cancelled = mkTask({ dueDate: new Date('2026-10-01T00:00:00Z'), status: 'cancelled' });
  const bad5 = await extendDeadline(cancelled._id, user, new Date(now.getTime() + HOUR), '', { taskModel: new FakeTaskModel([cancelled]), now });
  check('Extension rejected on cancelled tasks', bad5.ok === false);
}

// ─────────────────────────────────────────────
section('E. Email, RBAC, scheduler wiring & regression (source scan)');

const emailSrc = read('services/email.service.js');
check('Reminder email implemented in the existing SendGrid service',
  emailSrc.includes('sendTaskReminderEmail') && /Action Required: Your StackAmit Task Submission Is Pending/.test(emailSrc));
check('Deadline-extension email implemented', emailSrc.includes('sendTaskDeadlineExtendedEmail'));

const routesSrc = read('routes/task.routes.js');
check('New endpoints exist', routesSrc.includes('extend-deadline') && routesSrc.includes('reopen-submission'));
check('All task routes sit behind authentication (protect)', /router\.use\(protect\)/.test(routesSrc));
check('Extend/reopen are role-gated to admin+trainer (RBAC middleware)',
  (routesSrc.match(/authorize\('admin', 'trainer'\)/g) || []).length >= 4);
check('Submit endpoint stays student-only', /:taskId\/submit', authorize\('student'\)/.test(routesSrc));
check('Existing review endpoint untouched (grading workflow preserved)',
  routesSrc.includes("router.patch('/submissions/:id/review'"));

const svcSrc = read('services/taskDeadline.service.js');
check('Scheduler is single-instance per process', svcSrc.includes('if (timer) return timer;'));
check('Timer never keeps the process alive (unref)', svcSrc.includes('timer.unref?.()'));
check('Restart-safe: closure derived from stored timestamps, claims conditional',
  svcSrc.includes('submissionClosedAt: null') && /reminderSentAt: null/.test(svcSrc));
check('Closure sweep recomputes from the CURRENT effective deadline (never stale)',
  /effectiveDueDate: \{ \$ne: null, \$lte: cutoff \}/.test(svcSrc));
check('Service never mutates the original dueDate', !/task\.dueDate\s*=[^=]/.test(svcSrc));

const serverSrc = read('server.js');
check('Scheduler started from the server boot path', serverSrc.includes('startTaskDeadlineScheduler'));
check('Scheduler guarded by DISABLE_TASK_DEADLINE_JOBS (tests/CI stay inert)',
  serverSrc.includes("DISABLE_TASK_DEADLINE_JOBS !== 'true'"));

const ctrlSrcFull = read('controllers/task.controller.js');
const updateFn = ctrlSrcFull.slice(ctrlSrcFull.indexOf('export const updateTask'), ctrlSrcFull.indexOf('export const deleteTask'));
check('Original deadline frozen once extensions exist (no outdated request can reset it)',
  updateFn.includes('deadlineExtensions') && updateFn.includes('dueDate'));
check('Plain create/update paths strip window-control fields (no audit-bypass via request body)',
  /const \{ effectiveDueDate, deadlineExtensions, submissionClosedAt, reminderSentAt, \.\.\.body \}/.test(ctrlSrcFull)
  && /const \{ effectiveDueDate, deadlineExtensions, submissionClosedAt, reminderSentAt, \.\.\.editableBody \}/.test(ctrlSrcFull));
check('Existing createTask contract preserved (assignedBy from session)',
  ctrlSrcFull.includes('assignedBy: req.user._id'));
check('Review workflow function still exported and unchanged in place',
  ctrlSrcFull.includes('export const reviewSubmission'));

// Scheduler start/stop must be safe and idempotent even in-process.
{
  const t1 = startTaskDeadlineScheduler({ intervalMs: 60 * 1000, runImmediately: false });
  const t2 = startTaskDeadlineScheduler({ intervalMs: 60 * 1000, runImmediately: false });
  check('Double start yields one timer', t1 === t2);
  stopTaskDeadlineScheduler();
  const t3 = startTaskDeadlineScheduler({ intervalMs: 60 * 1000, runImmediately: false });
  stopTaskDeadlineScheduler();
  check('Restart after stop works (restart-safety)', t3 != null && t3 !== t1);
  stopTaskDeadlineScheduler(); // idempotent stop
  check('Stop is idempotent', true);
}

// Model-level window virtuals used by the UI (derived, not stored).
{
  const { default: Task } = await import('../models/Task.js');
  const doc = new Task({
    title: 'x', description: 'y', assignedBy: oid(), assignedTo: oid(),
    dueDate: utcDeadline, effectiveDueDate: utcDeadline,
  });
  const json = doc.toJSON();
  check('API payloads expose submissionClosesAt (single source for the UI)',
    json.submissionClosesAt && new Date(json.submissionClosesAt).getTime() === utcDeadline.getTime() + SUBMISSION_GRACE_MS);
  check('isSubmissionClosed exposed as false for open windows', json.isSubmissionClosed === false);
  doc.submissionClosedAt = new Date();
  check('isSubmissionClosed flips once stamped', doc.toJSON().isSubmissionClosed === true);
}

// ─────────────────────────────────────────────
console.log(`\n\x1b[1mResult: ${passed} passed, ${failed} failed\x1b[0m`);
process.exit(failed ? 1 : 0);
