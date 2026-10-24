// ─────────────────────────────────────────────────────────────
// SA-023: log-redaction helpers
//
// Console output on Render is shipped to the platform log drain and is readable
// by anyone with dashboard access. Authentication / discussion / email / student
// / application flows previously printed raw email addresses, ObjectIds and
// message subjects. These helpers let those call sites keep *debuggable* logs
// without persisting PII or secret material.
//
// All functions are pure and exported so they can be unit-verified without a DB.
// ─────────────────────────────────────────────────────────────

// Mask an email so ops can still tell accounts apart without exposing it:
//   "Amit.Kumar@stackamit.in" -> "a***@s************.in"
export const redactEmail = (email) => {
  if (typeof email !== 'string' || !email.includes('@')) return '[no-email]';
  const [local = '', domain = ''] = email.split('@');
  const head = (local[0] || '*').toLowerCase();
  const maskedLocal = local.length > 1 ? `${head}${'*'.repeat(Math.min(local.length - 1, 8))}` : head;
  if (!domain) return `${maskedLocal}@[no-domain]`;
  const dot = domain.lastIndexOf('.');
  const label = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  const maskedDomain = `${(label[0] || '*').toLowerCase()}${'*'.repeat(Math.min(label.length - 1, 8))}${tld}`;
  return `${maskedLocal}@${maskedDomain}`;
};

// Keep only the trailing characters of an id (enough to correlate a request
// without dumping a resolvable identifier).
export const redactId = (id) => {
  const s = typeof id === 'string' ? id : id == null ? '' : String(id);
  if (!s) return '[no-id]';
  if (s.length <= 4) return '*'.repeat(s.length);
  return `*${s.slice(-4)}`;
};

// Free-text subjects/messages: never print the body - emit a length only.
export const redactText = (text) => {
  if (typeof text !== 'string') return '[no-text]';
  return `[len=${text.length}]`;
};

// Belt-and-suspenders scrubber for anything we did not anticipate (e.g. an
// error.message or a provider payload accidentally containing a JWT / email).
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._-]+/gi;
export const scrub = (value) => {
  if (value == null) return value;
  if (typeof value !== 'string') {
    try {
      return JSON.stringify(value, (k, v) =>
        /password|token|otp|secret|authorization|cookie/i.test(k) ? '[redacted]' : v,
      );
    } catch {
      return String(value);
    }
  }
  return value
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(JWT_RE, '[redacted-jwt]')
    .replace(BEARER_RE, 'Bearer [redacted]');
};
