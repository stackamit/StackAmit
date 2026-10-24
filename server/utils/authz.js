// ─────────────────────────────────────────────
// Reusable server-side authorization + input-hardening helpers.
//
// These centralise the object-level (BOLA/IDOR) checks and safe-search
// construction that the audit flagged as missing/duplicated across the
// controllers (SA-007..SA-013, SA-025, SA-026, SA-014). Function-level RBAC
// lives in middleware/auth.js (protect + authorize); these helpers answer the
// "is THIS specific record accessible to THIS user?" question.
// ─────────────────────────────────────────────

// Compare two ids or documents regardless of populated/objectId/string shape.
export const sameId = (a, b) => {
  if (a == null || b == null) return false;
  const norm = (v) => String(v?._id ?? v ?? '');
  return norm(a) !== '' && norm(a) === norm(b);
};

// Is the user an admin? (central place for the admin-override rule)
export const isAdmin = (user) => user?.role === 'admin';

// SA-014: escape every RegExp metacharacter so a search term is matched as a
// literal string. Also guards the type (only real strings reach Mongo).
export const escapeRegex = (input) => {
  if (typeof input !== 'string') return '';
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Build a case-insensitive LITERAL-match regex for Mongo. Returns null when the
// input is not a usable, non-empty string so callers can skip the filter rather
// than inject an operator-shaped value such as { $regex: { $ne: null } }.
export const literalSearchRegex = (input) => {
  const escaped = escapeRegex(input);
  if (!escaped) return null;
  return { $regex: escaped, $options: 'i' };
};

// ─── Domain relationship helpers ───────────────────────────────────────────

// A task is visible/ownable by a student when it is assigned to them.
export const canAccessTask = (user, task) => {
  if (!task) return false;
  if (isAdmin(user)) return true;
  if (user.role === 'trainer') return sameId(task.assignedBy, user._id);
  if (user.role === 'student') return sameId(task.assignedTo, user._id);
  return false;
};

// Only the assigning trainer (or an admin) may review a submission.
export const canReviewSubmission = (user, task) => {
  if (!task) return false;
  if (isAdmin(user)) return true;
  if (user.role === 'trainer') return sameId(task.assignedBy, user._id);
  return false;
};

// A student may submit only a task assigned to them (SA-025).
export const canSubmitTask = (user, task) => {
  if (!task) return false;
  if (isAdmin(user)) return true;
  if (user.role === 'student') return sameId(task.assignedTo, user._id);
  return false;
};

// A trainer may view an internship's applicants only when they created the
// internship or are its assigned trainer; admins always (SA-013).
export const canViewInternshipApplicants = (user, internship) => {
  if (!internship) return false;
  if (isAdmin(user)) return true;
  if (user.role === 'trainer') {
    return sameId(internship.createdBy, user._id) || sameId(internship.assignedTrainer, user._id);
  }
  return false;
};

// A trainer participates in a conversation only if they are that conversation's
// trainer; students only their own; admins always (SA-009 / SA-011).
export const canAccessConversation = (user, conversation) => {
  if (!conversation) return false;
  if (isAdmin(user)) return true;
  const uid = String(user._id);
  const trainerId = String(conversation.trainer?._id ?? conversation.trainer ?? '');
  const studentId = String(conversation.student?._id ?? conversation.student ?? '');
  if (user.role === 'trainer') return trainerId === uid;
  if (user.role === 'student') return studentId === uid;
  return false;
};
