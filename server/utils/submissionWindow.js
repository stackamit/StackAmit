// ─────────────────────────────────────────────
// Shared constants for the task submission-window lifecycle.
//
// Lives in its own module (rather than in taskDeadline.service.js) so both
// the Mongoose models and the service can import it without creating a
// circular dependency (the service imports the models, and the Task model's
// virtuals reference the grace period).
// ─────────────────────────────────────────────

// 48-hour late-submission grace period after the effective deadline.
export const SUBMISSION_GRACE_MS = 48 * 60 * 60 * 1000;

// Scheduled sweep cadence.
export const TASK_DEADLINE_JOB_INTERVAL_MS = 30 * 60 * 1000;
