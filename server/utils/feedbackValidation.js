// ─────────────────────────────────────────────────────────────
// SA-032: public feedback abuse-prevention validation
//
// The public feedback endpoint is unauthenticated, so every accepted field is
// validated and normalised server-side before it reaches the model. This is a
// pure helper (no Express, no DB) so it can be unit-verified directly.
//
// Guarantees:
//   * every field must be a primitive string/number - objects and arrays are
//     rejected, which blocks MongoDB operator injection ({ $ne: ... } etc.);
//   * length bounds mirror the Feedback schema (name/subject <= 100/200,
//     message <= 5000) so oversized payloads are refused before they are stored;
//   * email must be a well-formed address; it is trimmed + lowercased;
//   * rating is coerced to an integer clamped to 1..5;
//   * type must be one of the schema's enum values (default 'general');
//   * unknown keys are dropped, and an all-empty/whitespace submission fails.
// ─────────────────────────────────────────────────────────────

export const FEEDBACK_TYPES = ['general', 'bug', 'feature', 'testimonial', 'complaint'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isPlainString = (v) => typeof v === 'string';

// Collapse internal whitespace, trim the ends. Returns '' for non-strings.
const normText = (v) => (isPlainString(v) ? v.replace(/\s+/g, ' ').trim() : '');

const okResult = (value) => ({ ok: true, errors: [], value });
const failResult = (errors) => ({ ok: false, errors, value: null });

/**
 * @param {object} raw        req.body (may be anything an attacker sends)
 * @param {object} opts
 * @param {boolean} opts.requireIdentity  public submissions require name+email
 * @returns {{ok:boolean, errors:string[], value:object|null}}
 */
export const normalizeFeedbackInput = (raw, { requireIdentity = true } = {}) => {
  // Reject a non-object body outright (array, string, null, operator payload).
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return failResult(['Invalid request body']);
  }

  const errors = [];

  // Reject unexpected keys before reading anything else - only the documented
  // fields are allowed through.
  const allowed = requireIdentity
    ? ['name', 'email', 'subject', 'message', 'rating', 'type']
    : ['subject', 'message', 'rating', 'type'];
  const extra = Object.keys(raw).filter((k) => !allowed.includes(k));
  if (extra.length > 0) {
    return failResult(['Unexpected field in request']);
  }

  // name / email must be strings when required.
  let name = '';
  let email = '';
  if (requireIdentity) {
    if (!isPlainString(raw.name) || normText(raw.name).length === 0) {
      errors.push('Name is required');
    } else if (normText(raw.name).length > 100) {
      errors.push('Name is too long');
    } else {
      name = normText(raw.name);
    }

    if (!isPlainString(raw.email)) {
      errors.push('Email is invalid');
    } else {
      email = raw.email.trim().toLowerCase();
      if (email.length === 0 || email.length > 200 || !EMAIL_RE.test(email)) {
        errors.push('Email is invalid');
      }
    }
  }

  // subject (always required)
  let subject = '';
  if (!isPlainString(raw.subject) || normText(raw.subject).length === 0) {
    errors.push('Subject is required');
  } else if (normText(raw.subject).length > 200) {
    errors.push('Subject is too long');
  } else {
    subject = normText(raw.subject);
  }

  // message (always required) - preserve original whitespace/newlines, only
  // trim the ends; reject empty/oversized.
  let message = '';
  if (!isPlainString(raw.message) || raw.message.trim().length === 0) {
    errors.push('Message is required');
  } else if (raw.message.length > 5000) {
    errors.push('Message is too long');
  } else {
    message = raw.message.trim();
  }

  // rating (optional, default 5, clamp 1..5)
  let rating = 5;
  if (raw.rating !== undefined && raw.rating !== null && raw.rating !== '') {
    const n = Number(raw.rating);
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      errors.push('Rating is invalid');
    } else {
      rating = Math.round(n);
    }
  }

  // type (optional, default 'general', must be in enum)
  let type = 'general';
  if (raw.type !== undefined && raw.type !== null && raw.type !== '') {
    if (!isPlainString(raw.type) || !FEEDBACK_TYPES.includes(raw.type)) {
      errors.push('Type is invalid');
    } else {
      type = raw.type;
    }
  }

  if (errors.length > 0) return failResult(errors);

  return okResult({ name, email, subject, message, rating, type });
};
