// ─────────────────────────────────────────────
// Notice System Verification (no database required)
//
// Exercises the REAL production logic:
//   • Notice model `effectiveStatus` virtual (scheduling + expiry + timezone
//     boundaries derived from the current time)
//   • Public-visibility query builder (buildPublicFilter)
//   • Admin/prominence sorting (pinned → urgent → important → normal → recency)
//   • Date validation + parsing helpers
//
// Run:  node tests/notice.verify.mjs
// ─────────────────────────────────────────────

import mongoose from 'mongoose';
import Notice, {
  NOTICE_CATEGORIES,
  NOTICE_PRIORITIES,
  NOTICE_TARGET_PAGES,
} from '../models/Notice.js';
import {
  buildPublicFilter,
  sortNoticesByProminence,
  validateDates,
  parseDateOrNull,
} from '../controllers/notice.controller.js';

const MIN = 60 * 1000;
const now = () => new Date();
const minsFromNow = (m) => new Date(Date.now() + m * MIN);

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

// Helper to build an unsaved doc and read its derived virtual
const eff = (fields) => new Notice({ createdBy: new mongoose.Types.ObjectId(), ...fields }).effectiveStatus;

// ─────────────────────────────────────────────
section('A. Derived effective status — lifecycle + expiry (requirements §5, §6)');

check('Draft with no dates is "draft"', eff({ editorialStatus: 'draft' }) === 'draft');
check('Draft is "draft" even if expiry already passed',
  eff({ editorialStatus: 'draft', publishAt: minsFromNow(-100), expiresAt: minsFromNow(-50) }) === 'draft');
check('Unpublished stays "unpublished" (manual action wins over publish time)',
  eff({ editorialStatus: 'unpublished', publishAt: minsFromNow(-100) }) === 'unpublished');
check('Scheduled in the future stays hidden → "scheduled"',
  eff({ editorialStatus: 'scheduled', publishAt: minsFromNow(30) }) === 'scheduled');
check('Scheduled time reached → becomes publicly "published"',
  eff({ editorialStatus: 'scheduled', publishAt: minsFromNow(-5) }) === 'published');
check('Published with no expiry is "published"',
  eff({ editorialStatus: 'published', publishAt: minsFromNow(-10) }) === 'published');
check('Published with future expiry is still "published"',
  eff({ editorialStatus: 'published', publishAt: minsFromNow(-10), expiresAt: minsFromNow(10) }) === 'published');
check('Published past its expiry auto-derives to "expired"',
  eff({ editorialStatus: 'published', publishAt: minsFromNow(-100), expiresAt: minsFromNow(-1) }) === 'expired');
check('Exact expiry boundary (expiresAt === now) counts as expired (<=)',
  eff({ editorialStatus: 'published', publishAt: minsFromNow(-100), expiresAt: now() }) === 'expired');
check('Scheduled then expired → "expired" (expiry takes precedence over schedule)',
  eff({ editorialStatus: 'scheduled', publishAt: minsFromNow(-100), expiresAt: minsFromNow(-1) }) === 'expired');

// ─────────────────────────────────────────────
section('B. Public visibility query excludes non-eligible notices (requirements §8, §11)');

const f = buildPublicFilter('home');
check('Filter targets the requested page', f.targetPages === 'home');
check('Filter excludes soft-deleted notices', f.isDeleted?.['$ne'] === true);
check('Filter only surfaces published or scheduled-with-time-reached',
  f.$or.some(o => o.editorialStatus === 'published') &&
  f.$or.some(o => o.editorialStatus === 'scheduled' && o.publishAt?.$lte instanceof Date));
check('Scheduled arm requires publishAt to have occurred (<= now) and be non-null',
  f.$or.find(o => o.editorialStatus === 'scheduled').publishAt.$ne === null);
check('Filter carries an expiry guard (expiresAt > now OR null)',
  Array.isArray(f.$and) && f.$and[0].$or.some(o => o.expiresAt?.$gt instanceof Date));
check('Draft / unpublished are not listed in the $or (so they are excluded)',
  !f.$or.some(o => o.editorialStatus === 'draft') &&
  !f.$or.some(o => o.editorialStatus === 'unpublished'));

// ─────────────────────────────────────────────
section('C. Prominence ordering — pinned, then priority, then recency (requirements §3, §7)');

const mk = (o) => ({ _id: o.id, isPinned: !!o.pinned, priority: o.p, publishAt: o.at, createdAt: o.at });
const ordered = sortNoticesByProminence([
  mk({ id: 'normal-old', p: 'normal', at: minsFromNow(-90) }),
  mk({ id: 'urgent', p: 'urgent', at: minsFromNow(-5) }),
  mk({ id: 'important', p: 'important', at: minsFromNow(-10) }),
  mk({ id: 'normal-new', p: 'normal', at: minsFromNow(-1) }),
  mk({ id: 'pinned-normal', p: 'normal', at: minsFromNow(-200), pinned: true }),
].map((n, i) => n ?? i));

const ids = ordered.map((n) => n._id);
check('Pinned notice is hoisted to the very top', ids[0] === 'pinned-normal', ids.join(','));
check('Remaining order is urgent → important → normal(new) → normal(old)',
  ids.slice(1).join(',') === 'urgent,important,normal-new,normal-old', ids.join(','));

// ─────────────────────────────────────────────
section('D. Date validation + parsing (requirements §5.5, §11, §14.11)');

check('Scheduled without publishAt is rejected',
  validateDates({ editorialStatus: 'scheduled', publishAt: null, expiresAt: null }) !== null);
check('Expiry earlier than publish is rejected',
  validateDates({ editorialStatus: 'published', publishAt: minsFromNow(0), expiresAt: minsFromNow(-30) }) !== null);
check('Expiry equal to publish is rejected (must be strictly later)',
  validateDates({ editorialStatus: 'published', publishAt: minsFromNow(0), expiresAt: now() }) !== null);
check('Valid published notice with future expiry passes',
  validateDates({ editorialStatus: 'published', publishAt: minsFromNow(-1), expiresAt: minsFromNow(60) }) === null);
check('Draft with no dates passes validation',
  validateDates({ editorialStatus: 'draft', publishAt: null, expiresAt: null }) === null);
check('parseDateOrNull: empty/undefined/null → null',
  parseDateOrNull('') === null && parseDateOrNull(null) === null && parseDateOrNull(undefined) === null);
check('parseDateOrNull: valid ISO → Date instance',
  parseDateOrNull('2026-01-01T00:00:00.000Z') instanceof Date);
check('parseDateOrNull: garbage → undefined (signals invalid)',
  parseDateOrNull('not-a-date') === undefined);

// ─────────────────────────────────────────────
section('E. Schema contract — enums + required fields (requirements §10)');

const baseDoc = {
  title: 'x', content: 'y', category: 'Important Announcements',
  priority: 'normal', targetPages: ['home'], createdBy: new mongoose.Types.ObjectId(),
};
check('All six predefined categories are declared', NOTICE_CATEGORIES.length === 6);
check('Priorities are exactly normal/important/urgent',
  NOTICE_PRIORITIES.join(',') === 'normal,important,urgent');
check('Target pages are exactly home/contact', NOTICE_TARGET_PAGES.join(',') === 'home,contact');
check('A valid notice passes schema validation',
  new Notice(baseDoc).validateSync() == null);
check('Missing title fails validation',
  new Notice({ ...baseDoc, title: '' }).validateSync() != null);
check('Invalid category fails validation',
  new Notice({ ...baseDoc, category: 'Nonexistent' }).validateSync() != null);
check('Invalid priority fails validation',
  new Notice({ ...baseDoc, priority: 'critical' }).validateSync() != null);
check('Invalid target page fails validation',
  new Notice({ ...baseDoc, targetPages: ['blog'] }).validateSync() != null);
check('Unsafe action URL (javascript:) fails validation',
  new Notice({ ...baseDoc, actionUrl: 'javascript:alert(1)' }).validateSync() != null);
check('Internal action path (/internships) passes validation',
  new Notice({ ...baseDoc, actionUrl: '/internships' }).validateSync() == null);
check('External https action URL passes validation',
  new Notice({ ...baseDoc, actionUrl: 'https://example.com/x' }).validateSync() == null);

// ─────────────────────────────────────────────
console.log(`\n${'-'.repeat(46)}`);
console.log(`\x1b[1mRESULT:\x1b[0m ${passed} passed, ${failed} failed`);
console.log('-'.repeat(46));
process.exit(failed === 0 ? 0 : 1);
