// ─────────────────────────────────────────────
// Security remediation verification (no database required)
//
// Exercises REAL production helpers behind the P0 fixes:
//   • SA-001/SA-002  certificate public verification (query guard + PII allow-list)
//   • SA-027         certificate-number generation (crypto random, non-sequential)
//   • SA-003         GET handlers must not mutate the database (source scan)
//
// Run:  node tests/security.verify.mjs
// ─────────────────────────────────────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildVerifyFilter,
  buildPublicVerificationPayload,
} from '../controllers/certificate.controller.js';
import { formatCertificateNumber, randomCertificateSequence } from '../models/Certificate.js';
import {
  sameId, isAdmin, escapeRegex, literalSearchRegex,
  canAccessTask, canReviewSubmission, canSubmitTask,
  canAccessConversation, canViewInternshipApplicants,
} from '../utils/authz.js';
import {
  sanitizeUploadFolder, sanitizeResourceType,
} from '../services/cloudinary.service.js';
import { parseAllowedOrigins } from '../socket/index.js';
import { pickAdminStudentFields } from '../controllers/student.controller.js';
import { generateTempPassword } from '../services/auth.service.js';
import {
  hashToken, isRefreshTokenValid, AUTH_COOKIE_PATH, ACCESS_COOKIE_PATH,
} from '../services/auth.service.js';
import {
  isPasswordChangeExempt, parseEnforceMode, evaluatePasswordGate, PASSWORD_CHANGE_EXEMPT_PATHS,
} from '../middleware/auth.js';
import { normalizeFeedbackInput } from '../utils/feedbackValidation.js';
import { redactEmail, redactId, redactText, scrub } from '../utils/logRedact.js';
import { getClientBaseUrl, DEFAULT_CLIENT_ORIGIN } from '../utils/appUrl.js';
import { evaluateCookieSecret } from '../utils/secrets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  else { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}${extra ? ' — ' + extra : ''}`); }
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

// ─────────────────────────────────────────────
section('SA-002 — verification query guard rejects empty / operator-shaped input');

check('Empty object {} yields null (never queries {} → no arbitrary first doc)',
  buildVerifyFilter({}) === null);
check('Missing params yield null', buildVerifyFilter() === null);
check('Whitespace-only certificateNumber yields null',
  buildVerifyFilter({ certificateNumber: '   ' }) === null);
check('NoSQL operator object { $ne: null } is rejected (not a string)',
  buildVerifyFilter({ certificateNumber: { $ne: null } }) === null);
check('Operator object via $exists is rejected',
  buildVerifyFilter({ verificationId: { $exists: true } }) === null);
check('Array value is rejected',
  buildVerifyFilter({ certificateNumber: ['a', 'b'] }) === null);
check('Valid string yields exact-match filter (no operators)',
  JSON.stringify(buildVerifyFilter({ certificateNumber: 'MTC-2026-00042' }))
    === JSON.stringify({ certificateNumber: 'MTC-2026-00042' }));
check('String value is trimmed',
  buildVerifyFilter({ certificateNumber: '  MTC-1  ' }).certificateNumber === 'MTC-1');
check('verificationId alone is accepted as a usable identifier',
  buildVerifyFilter({ verificationId: 'uuid-abc' }).verificationId === 'uuid-abc');

// ─────────────────────────────────────────────
section('SA-001 — public verification payload exposes ONLY approved fields');

const rawDoc = {
  _id: '507f1f77bcf86cd799439011',
  certificateNumber: 'MTC-2026-00042',
  type: 'completion',
  studentName: 'Asha Rao',
  internshipTitle: 'Frontend Internship',
  duration: '12 weeks',
  issuedDate: new Date('2026-05-01'),
  isRevoked: false,
  // Sensitive fields that MUST NOT appear:
  studentId: { name: 'Asha Rao', email: 'asha@private.com', phone: '999' },
  internshipId: { title: 'x' },
  issuedBy: 'adminid',
  pdfUrl: 'https://cloudinary/private.pdf',
  qrCodeData: 'data:...',
};
const payload = buildPublicVerificationPayload(rawDoc);
const leaked = Object.keys(payload).filter((k) =>
  ['studentId', 'internshipId', 'issuedBy', 'pdfUrl', 'pdfPublicId', 'qrCodeData', '_id', 'email', 'phone'].includes(k));
check('Payload contains no sensitive keys', leaked.length === 0, leaked.join(','));
check('Payload keeps certificateNumber + studentName + internshipTitle',
  payload.certificateNumber === 'MTC-2026-00042'
    && payload.studentName === 'Asha Rao'
    && payload.internshipTitle === 'Frontend Internship');
check('No email value appears anywhere in serialized payload',
  !JSON.stringify(payload).includes('asha@private.com'));
check('Valid (non-revoked) payload omits revokeReason', payload.revokeReason === undefined);
const revoked = buildPublicVerificationPayload({ ...rawDoc, isRevoked: true, revokeReason: 'Fraud' });
check('Revoked payload surfaces isRevoked + reason',
  revoked.isRevoked === true && revoked.revokeReason === 'Fraud');
check('null document yields null', buildPublicVerificationPayload(null) === null);

// ─────────────────────────────────────────────
section('SA-027 — certificate number is cryptographically random, not sequential');

const seq = randomCertificateSequence();
check('Sequence is a 5-char zero-padded numeric string', /^[0-9]{5}$/.test(seq), seq);
const num = formatCertificateNumber(2026, '00042');
check('Format stays MTC-YYYY-##### (existing links keep working)',
  num === 'MTC-2026-00042');

const seen = new Set();
for (let i = 0; i < 200; i += 1) seen.add(randomCertificateSequence());
check('200 draws produce many distinct values (not a counter)', seen.size > 150, `unique=${seen.size}`);
// Range check: crypto.randomInt(0, 100000) → values within [0, 99999]
let inRange = true;
for (let i = 0; i < 200; i += 1) {
  const v = parseInt(randomCertificateSequence(), 10);
  if (Number.isNaN(v) || v < 0 || v > 99999) inRange = false;
}
check('All draws fall within [0, 99999]', inRange);

// ─────────────────────────────────────────────
section('SA-003 — GET handlers must not perform database writes (source scan)');

const internshipSrc = fs.readFileSync(
  path.join(__dirname, '..', 'controllers', 'internship.controller.js'), 'utf8');
check('internship.controller.js contains no updateMany()',
  !/\.updateMany\s*\(/.test(internshipSrc));
check('internship.controller.js contains no raw collection write',
  !/Internship\.collection\s*\.\s*(updateMany|updateOne|deleteMany|insertMany)/.test(internshipSrc));
check('no $set bulk mutation left in the controller',
  !/\$set:\s*\{\s*isDeleted/.test(internshipSrc));
const migrationScript = path.join(__dirname, '..', 'scripts', 'repairInternshipFlags.mjs');
check('repair logic relocated to an explicit migration script', fs.existsSync(migrationScript));
const migSrc = fs.readFileSync(migrationScript, 'utf8');
check('migration script is dry-run by default (requires --apply)',
  migSrc.includes("--apply") && /Mode: \$\{APPLY/.test(migSrc));

// ─────────────────────────────────────────────
section('SA-014 — search input is escaped to a literal, never an operator');

check('escapeRegex escapes a dot so it matches literally', escapeRegex('a.b') === 'a\\.b');
check('escaped metacharacters, used as a RegExp, match the original literally',
  (() => { const raw = '.*+?^${}()|[]\\'; const re = new RegExp(`^${escapeRegex(raw)}$`); return re.test(raw); })());
check('escapeRegex returns empty for non-string (blocks operator objects)',
  escapeRegex({ $ne: null }) === '' && escapeRegex(null) === '' && escapeRegex(['a']) === '');
check('literalSearchRegex builds a case-insensitive literal filter',
  JSON.stringify(literalSearchRegex('john.doe')) === JSON.stringify({ $regex: 'john\\.doe', $options: 'i' }));
check('literalSearchRegex yields null for operator-shaped / empty input',
  literalSearchRegex({ $regex: 'x' }) === null && literalSearchRegex('') === null);

// ─────────────────────────────────────────────
section('SA-007..013 / 025 / 026 — object-level authorization matrix');

const admin = { _id: 'a1', role: 'admin' };
const trainer1 = { _id: 't1', role: 'trainer' };
const trainer2 = { _id: 't2', role: 'trainer' };
const student1 = { _id: 's1', role: 'student' };
const student2 = { _id: 's2', role: 'student' };
const task = { _id: 'k1', assignedBy: 't1', assignedTo: 's1' };

check('sameId handles populated / string / ObjectId shapes',
  sameId({ _id: 'x' }, 'x') && sameId('x', 'x') && !sameId('x', 'y') && !sameId(null, 'x'));
check('isAdmin only true for admin role', isAdmin(admin) && !isAdmin(trainer1) && !isAdmin(undefined));

check('canAccessTask: admin always', canAccessTask(admin, task) === true);
check('canAccessTask: assigning trainer', canAccessTask(trainer1, task) === true);
check('canAccessTask: other trainer denied', canAccessTask(trainer2, task) === false);
check('canAccessTask: assigned student', canAccessTask(student1, task) === true);
check('canAccessTask: other student denied', canAccessTask(student2, task) === false);
check('canAccessTask: null task denied', canAccessTask(admin, null) === false);

check('canReviewSubmission: assigning trainer only (not peer, not student)',
  canReviewSubmission(trainer1, task) && !canReviewSubmission(trainer2, task) && !canReviewSubmission(student1, task));
check('canReviewSubmission: admin override', canReviewSubmission(admin, task) === true);

check('canSubmitTask: only the assigned student (SA-025)',
  canSubmitTask(student1, task) && !canSubmitTask(student2, task) && !canSubmitTask(trainer1, task));

const conv = { trainer: 't1', student: 's1' };
check('canAccessConversation: matching trainer/student',
  canAccessConversation(trainer1, conv) && canAccessConversation(student1, conv));
check('canAccessConversation: cross-party denied',
  !canAccessConversation(trainer2, conv) && !canAccessConversation(student2, conv));
check('canAccessConversation: null conversation denied', canAccessConversation(admin, null) === false);

const internship = { createdBy: 't1', assignedTrainer: 't2' };
check('canViewInternshipApplicants: creator or assigned trainer (SA-013)',
  canViewInternshipApplicants(trainer1, internship) && canViewInternshipApplicants(trainer2, internship));
check('canViewInternshipApplicants: unrelated trainer denied',
  canViewInternshipApplicants({ _id: 't9', role: 'trainer' }, internship) === false);
check('canViewInternshipApplicants: admin allowed, student denied, null denied',
  canViewInternshipApplicants(admin, internship) && !canViewInternshipApplicants(student1, internship) && !canViewInternshipApplicants(admin, null));

// ─────────────────────────────────────────────
section('SA-015 — upload folder / resource-type allow-list');

check('Allow-listed folder is canonicalised (trim + lowercase)',
  sanitizeUploadFolder('  Avatars ') === 'avatars');
check('Path-traversal folder falls back to safe default',
  sanitizeUploadFolder('../../other-tenant', 'general') === 'general');
check('Unknown folder rejected to fallback',
  sanitizeUploadFolder('secrets', 'general') === 'general');
check('Non-string folder rejected to fallback',
  sanitizeUploadFolder({ x: 1 }, 'general') === 'general' && sanitizeUploadFolder(null) === 'general');
check('resource-type clamped to allow-list',
  sanitizeResourceType('IMAGE') === 'image' && sanitizeResourceType('auto') === 'auto');
check('Unknown resource-type falls back to auto',
  sanitizeResourceType('../../../x', 'auto') === 'auto');

// ─────────────────────────────────────────────
section('SA-028/024/029/030 — temp password, mass-assignment allow-list, CORS origins');

// SA-028: strengthened CSPRNG temp password with all four classes.
let tpOk = true;
for (let i = 0; i < 50; i += 1) {
  const p = generateTempPassword();
  if (!(p.length >= 8
    && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p))) tpOk = false;
}
check('generateTempPassword yields >=8 chars with all four classes (x50)', tpOk);
check('temp passwords are not all identical (randomness)', new Set(Array.from({ length: 30 }, () => generateTempPassword())).size > 25);

// SA-024: mass-assignment allow-list strips privilege fields.
const picked = pickAdminStudentFields({
  firstName: 'Asha', collegeName: 'X',
  role: 'admin', password: 'hunter2', isActive: false, isVerified: true,
  deletedAt: new Date(), refreshToken: 'leak', profileCompletion: 100,
});
check('allow-list keeps legitimate profile fields', picked.firstName === 'Asha' && picked.collegeName === 'X');
check('allow-list drops role/password/isActive/isVerified/deletedAt/refreshToken/profileCompletion',
  !('role' in picked) && !('password' in picked) && !('isActive' in picked)
    && !('isVerified' in picked) && !('deletedAt' in picked) && !('refreshToken' in picked)
    && !('profileCompletion' in picked));
check('non-object body yields empty update set',
  Object.keys(pickAdminStudentFields()).length === 0 && Object.keys(pickAdminStudentFields(null)).length === 0);

// SA-029/030: CORS origin normalisation into an allow-list array.
check('comma-separated CLIENT_URL becomes an array of trimmed origins',
  JSON.stringify(parseAllowedOrigins('https://a.app, https://b.app '))
    === JSON.stringify(['https://a.app', 'https://b.app']));
check('single origin still returns an array',
  JSON.stringify(parseAllowedOrigins('https://only.app')) === JSON.stringify(['https://only.app']));
check('empty/undefined falls back to the localhost default',
  JSON.stringify(parseAllowedOrigins(undefined)) === JSON.stringify(['http://localhost:5173']));

// ─────────────────────────────────────────────
section('SA-021 — refresh-token digest + backward-compatible verification');

const H = hashToken('raw-refresh-token');
check('hashToken is deterministic', H === hashToken('raw-refresh-token'));
check('hashToken returns a 64-char hex SHA-256 digest', /^[0-9a-f]{64}$/.test(H));
check('hashToken differs for different input', H !== hashToken('other-token'));
check('hashToken(null / "" / non-string) is null', hashToken(null) === null && hashToken('') === null && hashToken(123) === null);
check('digest record: presented token matches stored hash',
  isRefreshTokenValid({ refreshTokenHash: H }, 'raw-refresh-token') === true);
check('digest record: wrong token rejected',
  isRefreshTokenValid({ refreshTokenHash: H }, 'guessed') === false);
check('digest record ignores a mismatched legacy plaintext field',
  isRefreshTokenValid({ refreshTokenHash: H, refreshToken: 'stale' }, 'guessed') === false);
check('legacy plaintext record still verifies before migration',
  isRefreshTokenValid({ refreshToken: 'raw-legacy' }, 'raw-legacy') === true);
check('legacy plaintext record rejects a wrong token',
  isRefreshTokenValid({ refreshToken: 'raw-legacy' }, 'nope') === false);
check('null user / empty token are safely rejected',
  isRefreshTokenValid(null, 'x') === false && isRefreshTokenValid({}, '') === false && isRefreshTokenValid({ refreshToken: 'a' }, null) === false);

const authSvcSrc = fs.readFileSync(path.join(__dirname, '..', 'services', 'auth.service.js'), 'utf8');
check('setTokenCookies uses the AUTH_COOKIE_PATH for refresh', /path:\s*AUTH_COOKIE_PATH/.test(authSvcSrc));
check('setTokenCookies uses the ACCESS_COOKIE_PATH for access', /path:\s*ACCESS_COOKIE_PATH/.test(authSvcSrc));
check('the broken \'/api/auth/refresh\' cookie path is gone (SA-020 bug fix)',
  !authSvcSrc.includes("'/api/auth/refresh'"));
check('AUTH_COOKIE_PATH is /api/auth and ACCESS_COOKIE_PATH is /',
  AUTH_COOKIE_PATH === '/api/auth' && ACCESS_COOKIE_PATH === '/');
const hashScript = path.join(__dirname, '..', 'scripts', 'hashRefreshTokens.mjs');
check('SA-021 migration script exists and is dry-run by default',
  fs.existsSync(hashScript) && fs.readFileSync(hashScript, 'utf8').includes('--apply'));

// ─────────────────────────────────────────────
section('SA-020 — auth responses must not be cached (source scan)');
const authRoutesSrc = fs.readFileSync(path.join(__dirname, '..', 'routes', 'auth.routes.js'), 'utf8');
check("auth routes set Cache-Control: no-store at the router level",
  /Cache-Control['"]?\s*,?\s*['\"]no-store/.test(authRoutesSrc) || authRoutesSrc.includes("'no-store'"));

// ─────────────────────────────────────────────
section('SA-022 — staged forced-password-change gate');

check('parseEnforceMode recognises enforce spellings',
  parseEnforceMode('true') === 'enforce' && parseEnforceMode('ON') === 'enforce' && parseEnforceMode('enforce') === 'enforce');
check('parseEnforceMode recognises warn',
  parseEnforceMode('warn') === 'warn' && parseEnforceMode('warn-only') === 'warn');
check('parseEnforceMode defaults to off for unset / false',
  parseEnforceMode(undefined) === 'off' && parseEnforceMode('false') === 'off' && parseEnforceMode('') === 'off');
check('exempt paths stay reachable while a change is owed',
  PASSWORD_CHANGE_EXEMPT_PATHS.every((p) => isPasswordChangeExempt(`/api${p}`)));
check('exempt check strips query strings', isPasswordChangeExempt('/auth/me?x=1') === true);
check('non-auth routes are not exempt', isPasswordChangeExempt('/students') === false);
check('gate: no obligation → always allowed',
  evaluatePasswordGate({ mustChangePassword: false, path: '/students', mode: 'enforce' }).block === false);
check('gate: off mode → allowed even when owed',
  evaluatePasswordGate({ mustChangePassword: true, path: '/students', mode: 'off' }).block === false);
check('gate: enforce + protected path → blocked',
  evaluatePasswordGate({ mustChangePassword: true, path: '/students', mode: 'enforce' }).block === true);
check('gate: enforce + exempt path → allowed',
  evaluatePasswordGate({ mustChangePassword: true, path: '/auth/change-password', mode: 'enforce' }).block === false);
check('gate: warn mode → allowed but flagged',
  (() => { const g = evaluatePasswordGate({ mustChangePassword: true, path: '/students', mode: 'warn' }); return g.block === false && g.warn === true; })());

// ─────────────────────────────────────────────
section('SA-023 — PII / secret redaction helpers');

const re = redactEmail('Amit.Kumar@stackamit.in');
check('redactEmail hides the local part and full domain',
  !re.includes('Amit') && !re.includes('mit.kumar') && !re.includes('stackamit.in') && re.includes('@'));
check('redactEmail keeps a leading hint for ops correlation', re[0] === 'a');
check('redactEmail non-string → [no-email]', redactEmail(null) === '[no-email]' && redactEmail(5) === '[no-email]');
const rid = redactId('507f1f77bcf86cd799439011');
check('redactId keeps only the last 4 chars', rid.endsWith('9011') && rid.startsWith('*') && !rid.includes('507f1f77'));
check('redactId empty → [no-id]', redactId(null) === '[no-id]' && redactId('') === '[no-id]');
check('redactText emits length only', redactText('hello world') === '[len=11]' && !redactText('secret').includes('secret'));
const fakeJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEifQ.abcdefghij_klmnop';
const scrubbed = scrub(`user a@b.com sent ${fakeJwt} with Bearer ${fakeJwt}`);
check('scrub removes emails, JWTs and bearer tokens',
  !scrubbed.includes('a@b.com') && !scrubbed.includes(fakeJwt) && scrubbed.includes('[redacted')); 
check('scrub masks secret-valued object keys',
  (() => { const s = scrub({ email: 'a@b.co', password: 'x', refreshToken: 'y' }); return !s.includes('"x"') && !s.includes('"y"'); })());
const certSrc = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'certificate.controller.js'), 'utf8');
check('certificate controller no longer logs the raw recipient',
  !/sent to \$\{studentEmail\}/.test(certSrc) && certSrc.includes('redactEmail'));
const mailSvcSrc = fs.readFileSync(path.join(__dirname, '..', 'services', 'email.service.js'), 'utf8');
check('email service no longer logs raw recipient/subject',
  !mailSvcSrc.includes('Would have sent to:') && mailSvcSrc.includes('redactEmail'));

// ─────────────────────────────────────────────
section('SA-032 — public feedback abuse-prevention validator');

const good = normalizeFeedbackInput({
  name: '  Asha Rao ', email: 'ASHA@Example.COM ', subject: ' Hi ',
  message: '  Long body  ', rating: '4', type: 'bug',
});
check('valid submission passes + normalises name/email/subject/message',
  good.ok && good.value.name === 'Asha Rao' && good.value.email === 'asha@example.com'
    && good.value.subject === 'Hi' && good.value.message === 'Long body');
check('rating coerced to integer and type preserved', good.value.rating === 4 && good.value.type === 'bug');
check('defaults applied when rating/type omitted',
  (() => { const d = normalizeFeedbackInput({ name: 'A', email: 'a@b.co', subject: 's', message: 'm' }); return d.ok && d.value.rating === 5 && d.value.type === 'general'; })());
check('operator object in a field is rejected (no $-injection)',
  normalizeFeedbackInput({ name: { $ne: null }, email: 'a@b.co', subject: 's', message: 'm' }).ok === false);
check('unexpected key is rejected',
  normalizeFeedbackInput({ name: 'A', email: 'a@b.co', subject: 's', message: 'm', isAdmin: true }).ok === false);
check('missing required fields rejected',
  normalizeFeedbackInput({ subject: 's', message: 'm' }).ok === false);
check('malformed email rejected',
  normalizeFeedbackInput({ name: 'A', email: 'not-an-email', subject: 's', message: 'm' }).ok === false);
check('oversized message rejected',
  normalizeFeedbackInput({ name: 'A', email: 'a@b.co', subject: 's', message: 'x'.repeat(5001) }).ok === false);
check('out-of-range rating rejected',
  normalizeFeedbackInput({ name: 'A', email: 'a@b.co', subject: 's', message: 'm', rating: 9 }).ok === false);
check('unknown type rejected',
  normalizeFeedbackInput({ name: 'A', email: 'a@b.co', subject: 's', message: 'm', type: 'evil' }).ok === false);
check('non-object body rejected (array / string / null)',
  normalizeFeedbackInput([]).ok === false && normalizeFeedbackInput('hi').ok === false && normalizeFeedbackInput(null).ok === false);
check('authenticated mode drops name/email requirement',
  normalizeFeedbackInput({ subject: 's', message: 'm' }, { requireIdentity: false }).ok === true);
const fbRoutesSrc = fs.readFileSync(path.join(__dirname, '..', 'routes', 'feedback.routes.js'), 'utf8');
check('public feedback route is behind a dedicated limiter',
  /feedbackLimiter/.test(fbRoutesSrc) && /post\(['"]\/public['"],\s*feedbackLimiter/.test(fbRoutesSrc));

// ─────────────────────────────────────────────
section('SA-035 — single-origin client base URL resolver');

const savedClientUrl = process.env.CLIENT_URL;
try {
  process.env.CLIENT_URL = 'https://a.app,https://b.app';
  check('multi-origin CLIENT_URL resolves to the first origin (valid links)',
    getClientBaseUrl() === 'https://a.app');
  process.env.CLIENT_URL = 'https://only.app/';
  check('trailing slash is trimmed', getClientBaseUrl() === 'https://only.app');
  process.env.CLIENT_URL = '';
  check('empty falls back to the production default', getClientBaseUrl() === DEFAULT_CLIENT_ORIGIN);
  delete process.env.CLIENT_URL;
  check('unset falls back to the production default', getClientBaseUrl() === DEFAULT_CLIENT_ORIGIN);
} finally {
  if (savedClientUrl === undefined) delete process.env.CLIENT_URL; else process.env.CLIENT_URL = savedClientUrl;
}

// ─────────────────────────────────────────────
section('SA-037 — cookie secret distinctness check');

check('missing COOKIE_SECRET flagged', evaluateCookieSecret({ cookieSecret: '' }).missing === true);
check('COOKIE_SECRET equal to JWT_SECRET flagged as reused',
  evaluateCookieSecret({ cookieSecret: 'k', jwtSecret: 'k' }).reused === true);
check('COOKIE_SECRET equal to JWT_REFRESH_SECRET flagged as reused',
  evaluateCookieSecret({ cookieSecret: 'k', jwtRefreshSecret: 'k' }).reused === true);
check('distinct secrets pass',
  (() => { const r = evaluateCookieSecret({ cookieSecret: 'a', jwtSecret: 'b', jwtRefreshSecret: 'c' }); return !r.missing && !r.reused; })());

// ─────────────────────────────────────────────
section('SA-036 — boot-time data repair decoupled from startup (source scan)');
const serverSrc = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
check('startup migration is gated behind RUN_BOOT_MIGRATIONS',
  serverSrc.includes("process.env.RUN_BOOT_MIGRATIONS === 'true'"));

// ─────────────────────────────────────────────
section('SA-020 REGRESSION — session-restore probe must not force-redirect; cache-clear ordering');

const clientApiSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', 'services', 'api.js'), 'utf8');
const clientAuthSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'src', 'context', 'AuthContext.jsx'), 'utf8');

check('restore probe requests /auth/me with _noRedirect (public visitors not bounced to login)',
  /api\.get\(\s*['"]\/auth\/me['"]\s*,\s*\{[^}]*_noRedirect:\s*true/.test(clientAuthSrc));
check('retry-guard redirect is gated by !originalRequest._noRedirect',
  /!originalRequest\._noRedirect\)\s*\{\s*window\.location\.href\s*=\s*['"]\/login['"]/.test(clientApiSrc));
check('refresh-catch redirect is gated by !originalRequest._noRedirect',
  /!originalRequest\._noRedirect\s*&&\s*window\.location\.pathname\s*!==\s*['"]\/login['"]/.test(clientApiSrc));
check('no unguarded legacy "if (pathname !== /login) { href=/login }" remains in api.js',
  !/if \(\s*window\.location\.pathname\s*!==\s*['"]\/login['"]\s*\)\s*\{\s*window\.location\.href/.test(clientApiSrc));
// clearApiCache() resolves the owner from localStorage.user, so it MUST run
// before the 'user' key is removed - in every forced-logout path and on logout.
check('api.js: clearApiCache runs before localStorage user removal',
  !/removeItem\(\s*['"]user['"]\s*\)[\s\S]{0,60}?clearApiCache\(\)/.test(clientApiSrc)
    && /clearApiCache\(\)\s*;[\s\S]{0,40}?removeItem\(\s*['"]accessToken['"]\s*\)/.test(clientApiSrc));
check('AuthContext: clearApiCache runs before localStorage user removal',
  !/removeItem\(\s*['"]user['"]\s*\)[\s\S]{0,60}?clearApiCache\(\)/.test(clientAuthSrc));

// ─────────────────────────────────────────────
console.log(`\n${'-'.repeat(46)}`);
console.log(`\x1b[1mRESULT:\x1b[0m ${passed} passed, ${failed} failed`);
console.log('-'.repeat(46));
process.exit(failed === 0 ? 0 : 1);
