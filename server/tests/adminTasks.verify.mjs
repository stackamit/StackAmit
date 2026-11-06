// ─────────────────────────────────────────────
// Admin Centralized Task Monitoring Verification (no database required)
//
// Exercises the REAL production logic:
//   A. Query normalization & filter builder (whitelists, injection safety)
//   B. The exact list pipeline executed against an in-memory aggregation
//      engine (joins, derived flags, search, combined filters, pagination)
//   C. Stats pipeline: every metric counted from real records, no double count
//   D. Trainer-wise / student-wise grouping (deleted users handled gracefully)
//   E. Security & wiring source scan (RBAC, field exposure, frontend usage)
//
// Run:  node tests/adminTasks.verify.mjs
// ─────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Submission from '../models/Submission.js';
import {
  buildAdminTaskFilters,
  buildAdminTasksPipeline,
  buildAdminTaskStatsPipeline,
} from '../controllers/task.controller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

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
// Mini aggregation engine — executes the REAL pipeline arrays built by the
// controller against in-memory collections. Only the stages/operators the
// monitoring endpoints actually use are supported.
// ─────────────────────────────────────────────

const MISSING = Symbol('missing');

const getPath = (doc, path) => {
  let cur = doc;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return MISSING;
    cur = cur[part];
  }
  return cur === undefined ? MISSING : cur;
};

const setPath = (doc, path, value) => {
  const parts = path.split('.');
  let cur = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
};

const delPath = (doc, path) => {
  const parts = path.split('.');
  let cur = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null || typeof cur !== 'object') return;
    cur = cur[parts[i]];
  }
  if (cur != null && typeof cur === 'object') delete cur[parts[parts.length - 1]];
};

const norm = (v) => {
  if (v === MISSING || v === undefined) return null;
  if (v instanceof Date) return v.getTime();
  if (mongoose.Types.ObjectId.isValid(String(v))) return String(v);
  return v;
};

const eq = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  if (x === null || y === null) return x === y;
  if (typeof x === 'object') return String(x) === String(y);
  return x === y;
};

const evalExpr = (doc, expr) => {
  if (typeof expr === 'string') {
    return expr.startsWith('$') && !expr.startsWith('$$') ? getPath(doc, expr.slice(1)) : expr;
  }
  if (expr === null || typeof expr !== 'object') return expr;
  if (expr instanceof Date) return expr; // date literal inside an expression (e.g. `now`)
  if (Array.isArray(expr)) return expr.map((e) => evalExpr(doc, e));
  const keys = Object.keys(expr);
  if (keys.length === 1 && keys[0].startsWith('$')) {
    const op = keys[0];
    const arg = expr[op];
    switch (op) {
      case '$ifNull': {
        const [a, b] = evalExpr(doc, arg);
        return a === MISSING || a === null ? b : a;
      }
      case '$arrayElemAt': {
        const [arr, idx] = evalExpr(doc, arg);
        return Array.isArray(arr) && arr[idx] !== undefined ? arr[idx] : MISSING;
      }
      case '$size': {
        const v = evalExpr(doc, arg);
        return Array.isArray(v) ? v.length : MISSING;
      }
      case '$add': {
        const vals = evalExpr(doc, arg);
        return vals.reduce((acc, v) => {
          if (acc === MISSING || acc === null || v === MISSING || v === null) return null;
          if (acc instanceof Date) return new Date(acc.getTime() + v);
          return acc + v;
        });
      }
      case '$type': {
        const raw = typeof arg === 'string' && arg.startsWith('$') ? getPath(doc, arg.slice(1)) : evalExpr(doc, arg);
        if (raw === MISSING) return 'missing';
        if (raw === null) return 'null';
        if (raw instanceof Date) return 'date';
        return typeof raw;
      }
      case '$eq': { const [a, b] = evalExpr(doc, arg); return eq(a, b); }
      case '$ne': { const [a, b] = evalExpr(doc, arg); return !eq(a, b); }
      case '$gt': { const [a, b] = evalExpr(doc, arg); return norm(a) > norm(b); }
      case '$gte': { const [a, b] = evalExpr(doc, arg); return norm(a) >= norm(b); }
      case '$lt': { const [a, b] = evalExpr(doc, arg); return norm(a) < norm(b); }
      case '$lte': { const [a, b] = evalExpr(doc, arg); return norm(a) <= norm(b); }
      case '$in': { const [v, list] = evalExpr(doc, arg); return Array.isArray(list) && list.some((x) => eq(v, x)); }
      case '$and': { return evalExpr(doc, arg).every(Boolean); }
      case '$or': { return evalExpr(doc, arg).some(Boolean); }
      case '$cond': {
        if (Array.isArray(arg)) { const [i, t, e] = evalExpr(doc, arg); return i ? t : e; }
        const cond = evalExpr(doc, arg.if);
        return cond ? evalExpr(doc, arg.then) : evalExpr(doc, arg.else);
      }
      case '$first': {
        const v = evalExpr(doc, arg);
        return Array.isArray(v) ? (v[0] === undefined ? MISSING : v[0]) : v;
      }
      default:
        throw new Error(`engine: unsupported expression ${op}`);
    }
  }
  // Plain object literal inside an expression position (e.g. $group _id)
  const out = {};
  for (const k of keys) out[k] = evalExpr(doc, expr[k]);
  return out;
};

const matchCond = (doc, cond) =>
  Object.entries(cond).every(([field, want]) => {
    if (field === '$and') return want.every((c) => matchCond(doc, c));
    if (field === '$or') return want.some((c) => matchCond(doc, c));
    const value = getPath(doc, field);
    if (want !== null && typeof want === 'object' && !Array.isArray(want) && !(want instanceof RegExp) && !mongoose.Types.ObjectId.isValid(String(want))) {
      const ops = Object.keys(want);
      if (ops.includes('$regex')) {
        if (value === MISSING) return false;
        return new RegExp(want.$regex, want.$options || '').test(String(value));
      }
      return ops.every((op) => {
        switch (op) {
          case '$eq': return eq(value, want.$eq);
          case '$ne': return !eq(value, want.$ne);
          case '$in': return want.$in.some((x) => eq(value, x));
          case '$gte': return norm(value) !== null && norm(value) >= norm(want.$gte);
          case '$lte': return norm(value) !== null && norm(value) <= norm(want.$lte);
          default: throw new Error(`engine: unsupported match op ${op}`);
        }
      });
    }
    if (want === null) return value === MISSING || value === null;
    return eq(value, want);
  });

const runStage = (docs, stage, collections) => {
  if (stage.$lookup) {
    const { from, localField, foreignField, as } = stage.$lookup;
    const foreign = collections[from] || [];
    return docs.map((d) => {
      const local = getPath(d, localField);
      return { ...d, [as]: foreign.filter((f) => eq(getPath(f, foreignField), local)) };
    });
  }
  if (stage.$addFields) {
    return docs.map((d) => {
      const out = { ...d };
      for (const [k, v] of Object.entries(stage.$addFields)) setPath(out, k, evalExpr(out, v));
      return out;
    });
  }
  if (stage.$match) return docs.filter((d) => matchCond(d, stage.$match));
  if (stage.$sort) {
    const entries = Object.entries(stage.$sort);
    return [...docs].sort((a, b) => {
      for (const [path, dir] of entries) {
        const x = norm(getPath(a, path));
        const y = norm(getPath(b, path));
        const cmp = x === y ? 0 : (x === null ? -1 : y === null ? 1 : x < y ? -1 : 1);
        if (cmp !== 0) return cmp * dir;
      }
      return 0;
    });
  }
  if ('$skip' in stage) return docs.slice(stage.$skip);
  if ('$limit' in stage) return docs.slice(0, stage.$limit);
  if (stage.$count) return [{ [stage.$count]: docs.length }];
  if (stage.$project) {
    return docs.map((d) => {
      const out = {};
      for (const [k, v] of Object.entries(stage.$project)) {
        if (v === 0) { delPath(out, k); continue; }
        if (v === 1) {
          const val = getPath(d, k);
          if (val !== MISSING) setPath(out, k, val);
          continue;
        }
        const val = evalExpr(d, v);
        if (val !== MISSING) setPath(out, k, val);
      }
      return out;
    });
  }
  if (stage.$group) {
    const keyOf = (d) => {
      const raw = evalExpr(d, stage.$group._id);
      return JSON.stringify(raw === MISSING ? null : norm(raw));
    };
    const groups = new Map();
    for (const d of docs) {
      const key = keyOf(d);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }
    return [...groups.entries()].map(([key, rows]) => {
      const doc = rows[0];
      const out = { _id: JSON.parse(key) };
      for (const [field, acc] of Object.entries(stage.$group)) {
        if (field === '_id') continue;
        const op = Object.keys(acc)[0];
        const arg = acc[op];
        if (op === '$sum') {
          out[field] = rows.reduce((s, r) => {
            const v = evalExpr(r, arg);
            return s + (typeof v === 'number' ? v : v === true ? 1 : 0);
          }, 0);
        } else if (op === '$first') {
          const v = evalExpr(doc, arg);
          if (v !== MISSING) out[field] = v;
        } else throw new Error(`engine: unsupported accumulator ${op}`);
      }
      return out;
    });
  }
  if (stage.$facet) {
    const out = {};
    for (const [branch, sub] of Object.entries(stage.$facet)) {
      out[branch] = sub.reduce((docsIn, s) => runStage(docsIn, s, collections), docs);
    }
    return [out];
  }
  throw new Error(`engine: unsupported stage ${Object.keys(stage)[0]}`);
};

const runPipeline = (docs, pipeline, collections) =>
  pipeline.reduce((acc, stage) => runStage(acc, stage, collections), docs);

// ─────────────────────────────────────────────
// Fixtures — a realistic cross-trainer / cross-student dataset
// ─────────────────────────────────────────────

const NOW = new Date(Date.UTC(2026, 10, 6, 12, 0, 0));
const oid = (n) => new mongoose.Types.ObjectId(`0000000000000000000000${String(n).padStart(2, '0')}`);

const T1 = oid(11), T2 = oid(12);
const S1 = oid(21), S2 = oid(22), S3 = oid(23), S_DEL = oid(24);

const users = [
  { _id: T1, name: 'Ravi Trainer', email: 'ravi@stackamit.com', role: 'trainer', password: 'HASH_T1' },
  { _id: T2, name: 'Neha Trainer', email: 'neha@stackamit.com', role: 'trainer', password: 'HASH_T2' },
  { _id: S1, name: 'Aman Student', email: 'aman@student.com', role: 'student', password: 'HASH_S1' },
  { _id: S2, name: 'Priya Student', email: 'priya@student.com', role: 'student', password: 'HASH_S2' },
  { _id: S3, name: 'Karan Student', email: 'karan@student.com', role: 'student', password: 'HASH_S3' },
  // S_DEL intentionally absent → represents a deleted account
];

const mkTask = (n, extra) => ({
  _id: oid(30 + n),
  title: `Task ${n}`,
  description: `Description ${n}`,
  status: 'pending',
  priority: 'medium',
  assignedBy: T1,
  assignedTo: S1,
  dueDate: new Date(NOW.getTime() - 5 * DAY),
  effectiveDueDate: null,
  deadlineExtensions: [],
  submissionClosedAt: null,
  createdAt: new Date(NOW.getTime() - 10 * DAY),
  ...extra,
});

const tasks = [
  // 1: submitted + approved (k1)
  mkTask(1, { assignedTo: S1, status: 'approved' }),
  // 2: active, nothing submitted yet (deadline in the future)
  mkTask(2, { assignedTo: S2, dueDate: new Date(NOW.getTime() + 2 * DAY) }),
  // 3: late submission awaiting review (due 1.5d ago, submitted 1d ago → inside the 48h window)
  mkTask(3, { assignedBy: T2, assignedTo: S1, dueDate: new Date(NOW.getTime() - 1.5 * DAY), status: 'submitted' }),
  // 4: extended deadline → window still open, submission approved
  mkTask(4, { assignedBy: T2, assignedTo: S2, dueDate: new Date(NOW.getTime() - 5 * DAY), effectiveDueDate: new Date(NOW.getTime() + 1 * DAY), deadlineExtensions: [{ newDeadline: new Date(NOW.getTime() + 1 * DAY) }], status: 'approved' }),
  // 5: closed by the scheduler stamp, never submitted
  mkTask(5, { assignedTo: S3, submissionClosedAt: new Date(NOW.getTime() - DAY) }),
  // 6: assigned to a DELETED student → must still be visible (window open)
  mkTask(6, { assignedTo: S_DEL, dueDate: new Date(NOW.getTime() + 3 * DAY) }),
  // 7: status 'late' without submission, window still open (due 1d ago → closes +47h)
  mkTask(7, { assignedBy: T2, assignedTo: S3, dueDate: new Date(NOW.getTime() - DAY), status: 'late' }),
  // 8: closure NOT yet stamped but deadline+48h already passed → computed closed
  mkTask(8, { assignedBy: T2, assignedTo: S1, dueDate: new Date(NOW.getTime() - 3 * DAY), status: 'in-progress' }),
  // 9: rejected submission (due 1.5d ago, window still open)
  mkTask(9, { assignedBy: T2, assignedTo: S2, dueDate: new Date(NOW.getTime() - 1.5 * DAY), status: 'rejected' }),
];

const submissions = [
  { _id: oid(41), taskId: tasks[0]._id, studentId: S1, status: 'approved', marks: { obtained: 85, total: 100 }, versions: 1, isLateSubmission: false, submittedDate: new Date(NOW.getTime() - 6 * DAY) },
  { _id: oid(43), taskId: tasks[2]._id, studentId: S1, status: 'submitted', marks: null, versions: 3, lastUpdatedAt: new Date(NOW.getTime() - DAY), isLateSubmission: true, submittedDate: new Date(NOW.getTime() - DAY) },
  { _id: oid(44), taskId: tasks[3]._id, studentId: S2, status: 'approved', marks: { obtained: 70, total: 100 }, versions: 2, isLateSubmission: false, submittedDate: new Date(NOW.getTime() - 6 * DAY) },
  { _id: oid(49), taskId: tasks[8]._id, studentId: S2, status: 'rejected', marks: null, versions: 1, isLateSubmission: false, submittedDate: new Date(NOW.getTime() - 3 * DAY) },
];
// Window truth table at NOW (grace = 48h after the effective deadline):
//   k1 due -5d → computed closed · k2 +2d open · k3 -1.5d open · k4 eff +1d open
//   k5 STAMPED closed · k6 +3d open (deleted student) · k7 -1d open
//   k8 -3d → computed closed · k9 -1.5d open
// closedTasks = k1, k5, k8 → 3

const collections = {
  [User.collection.name]: users,
  [Submission.collection.name]: submissions,
};

// ─────────────────────────────────────────────
section('A. Query normalization & filter builder (whitelists, injection safety)');

{
  const empty = buildAdminTaskFilters({}, NOW);
  check('Empty query → no pre-join match and no derived conditions',
    Object.keys(empty.taskMatch).length === 0 && empty.derived.length === 0 && empty.state === 'all');

  const bad = buildAdminTaskFilters({ status: 'not-a-status', priority: { $gt: 1 }, state: 'evil' }, NOW);
  check('Unknown status/priority/state values are ignored, never injected into the query',
    Object.keys(bad.taskMatch).length === 0 && bad.state === 'all' && bad.derived.length === 0);

  const ids = buildAdminTaskFilters({ trainerId: 'garbage-id', studentId: String(T2) }, NOW);
  check('Invalid ObjectId silently dropped; valid one cast to ObjectId',
    !ids.derived.some((d) => d.assignedBy !== undefined && typeof d.assignedBy === 'string') &&
    ids.derived.some((d) => d.assignedTo instanceof mongoose.Types.ObjectId));

  const dates = buildAdminTaskFilters({ createdFrom: 'not-a-date', createdTo: '2026-11-06', deadlineFrom: '2026-11-01' }, NOW);
  check('Invalid dates ignored; valid bounds become Date ranges',
    dates.taskMatch.createdAt && dates.taskMatch.createdAt.$gte === undefined && dates.taskMatch.createdAt.$lte instanceof Date &&
    dates.derived.some((d) => d.effectiveDeadline?.$gte instanceof Date));

  const inj = buildAdminTaskFilters({ search: '.*$(a)+?' }, NOW);
  const orConds = inj.derived.find((d) => d.$or).$or.map((c) => Object.values(c)[0].$regex);
  check('Search is regex-escaped (metacharacters never become operators)',
    orConds.every((pattern) => pattern.includes('\\') && (() => { try { new RegExp(pattern); return true; } catch { return false; } })()));
  check('Search covers title + trainer name/email + student name/email (5 fields)', orConds.length === 5);

  for (const [state, cond] of [
    ['active', (d) => d.status?.$in],
    ['pending', (d) => d.hasSubmission === false],
    ['submitted', (d) => d.hasSubmission === true],
    ['late', (d) => d['submission.isLateSubmission'] === true],
    ['awaiting_review', (d) => d['submission.status'] === 'submitted'],
    ['approved', (d) => d['submission.status'] === 'approved'],
    ['rejected', (d) => d['submission.status'] === 'rejected'],
    ['closed', (d) => d.isClosed === true],
    ['extended', (d) => d.isExtended === true],
  ]) {
    const built = buildAdminTaskFilters({ state }, NOW);
    check(`State '${state}' maps to exactly one derived condition`,
      built.derived.length === 1 && cond(built.derived[0]));
  }
}

// ─────────────────────────────────────────────
section('B. Real list pipeline on in-memory data (joins, flags, filters, paging)');

const listAll = () => {
  const { stages } = buildAdminTasksPipeline({}, NOW);
  const [faceted] = runPipeline(tasks, stages, collections);
  return { rows: faceted.data, total: faceted.total[0].count };
};

{
  const { rows, total } = listAll();
  check('Admin sees every task across ALL trainers and students', total === 9 && rows.length === 9);
  const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));
  check('Trainer and student profiles are joined into each row',
    byTitle['Task 1'].trainer.name === 'Ravi Trainer' && byTitle['Task 1'].student.email === 'aman@student.com');
  check('Deleted student is NOT hidden — row survives with empty student record',
    byTitle['Task 6'] && (byTitle['Task 6'].student === undefined || byTitle['Task 6'].student?.name === undefined));
  check('Submission joined when it exists', byTitle['Task 3'].submission?.isLateSubmission === true && byTitle['Task 3'].submission.versions === 3);
  check('No fabricated submission for un-submitted tasks', byTitle['Task 2'].submission === undefined);
  check('User documents never leak: rows contain NO password/auth fields',
    !JSON.stringify(rows).includes('HASH_') && !rows.some((r) => r.trainer?.password || r.student?.password));

  // Derived window flags — exactly what the scheduler would compute
  check('Stamped closure detected (Task 5)', byTitle['Task 5'].isClosed === true);
  check('Computed closure detected (Task 8: deadline+48h passed, not yet stamped)', byTitle['Task 8'].isClosed === true);
  check('Extension detected via effective deadline (Task 4)', byTitle['Task 4'].isExtended === true && byTitle['Task 4'].extensionCount === 1);
  check('Backfilled equal effectiveDueDate does NOT count as an extension (Task 1)', byTitle['Task 1'].isExtended === false);
  check('closesAt = effective deadline + exactly 48h',
    new Date(byTitle['Task 4'].closesAt).getTime() - (NOW.getTime() + DAY) === 48 * HOUR);
  check('Open window right after deadline (Task 7: due 1d ago → +47h left)', byTitle['Task 7'].isClosed === false);

  // Search
  const searchBy = (q) => {
    const { stages } = buildAdminTasksPipeline({ search: q }, NOW);
    return runPipeline(tasks, stages, collections)[0].total[0]?.count || 0;
  };
  check('Search by trainer name finds exactly that trainer\'s tasks', searchBy('Neha') === 5);
  check('Search by student email finds exactly that student\'s tasks', searchBy('priya@student.com') === 3);
  check('Search by title fragment', searchBy('Task 1') === 1);
  check('Regex metacharacters in search match nothing instead of matching everything', searchBy('.*') === 0);

  // State filters
  const stateCount = (state) => {
    const { stages } = buildAdminTasksPipeline({ state }, NOW);
    return runPipeline(tasks, stages, collections)[0].total[0]?.count || 0;
  };
  check("State 'submitted' finds exactly the 4 tasks with submissions", stateCount('submitted') === 4);
  check("State 'pending' finds the 5 not-yet-submitted open-status tasks", stateCount('pending') === 5);
  check("State 'late' finds only the flagged late submission", stateCount('late') === 1);
  check("State 'awaiting_review' finds only the reviewed-pending submission", stateCount('awaiting_review') === 1);
  check("State 'approved' finds 2 approved submissions", stateCount('approved') === 2);
  check("State 'rejected' finds 1 rejected submission", stateCount('rejected') === 1);
  check("State 'closed' finds 1 stamped + 2 computed closures", stateCount('closed') === 3);
  check("State 'extended' finds the single extended task", stateCount('extended') === 1);
  check("State 'active' finds pending/in-progress tasks only", stateCount('active') === 4);

  // Combined filters (state + trainer) + pagination
  const { stages } = buildAdminTasksPipeline({ state: 'closed', trainerId: String(T2) }, NOW);
  const combined = runPipeline(tasks, stages, collections)[0];
  check('Combined filters intersect correctly (closed AND trainer=Neha)', combined.total[0].count === 1 && combined.data[0].title === 'Task 8');

  const paged = buildAdminTasksPipeline({ page: '2', limit: '4' }, NOW);
  const pagedOut = runPipeline(tasks, paged.stages, collections)[0];
  check('Server-side pagination: page 2 of limit 4 returns 4 rows, total still 9', pagedOut.data.length === 4 && pagedOut.total[0].count === 9);
  check('Page/limit are clamped (limit capped at 100, page ≥ 1)', buildAdminTasksPipeline({ page: '-5', limit: '99999' }, NOW).limit === 100 && buildAdminTasksPipeline({ page: '-5' }, NOW).page === 1);
  check('Rows sorted by creation date (newest first)', pagedOut.data[0].createdAt >= pagedOut.data[3].createdAt);
}

// ─────────────────────────────────────────────
section('C. Stats pipeline — real counts, no double counting');

{
  const [row] = runPipeline(tasks, buildAdminTaskStatsPipeline(NOW), collections);
  check('totalTasks = 9 (each document counted once)', row.totalTasks === 9);
  check('activeTasks = 4', row.activeTasks === 4);
  check('pendingSubmissions = 5', row.pendingSubmissions === 5);
  check('submittedTasks = 4', row.submittedTasks === 4);
  check('lateSubmissions = 1', row.lateSubmissions === 1);
  check('awaitingReview = 1', row.awaitingReview === 1);
  check('approvedSubmissions = 2', row.approvedSubmissions === 2);
  check('rejectedSubmissions = 1', row.rejectedSubmissions === 1);
  check('closedTasks = 3 (1 stamped + 2 computed)', row.closedTasks === 3);
  check('extendedTasks = 1', row.extendedTasks === 1);
  // A task may legitimately appear in several metrics, but never twice in one:
  const statsPipeline = buildAdminTaskStatsPipeline(NOW);
  const group = statsPipeline.find((s) => s.$group);
  check('Single $group over task documents → structurally impossible to double count a task', statsPipeline.filter((s) => s.$group).length === 1 && group.$group.totalTasks.$sum === 1);
}

// ─────────────────────────────────────────────
section('D. Trainer-wise and student-wise grouping');

{
  // Grouping pipelines are internal — reuse the same builder shape through the
  // stats engine by grouping on the joined trainer/student keys.
  const groupBy = (personField) => {
    const { stages } = buildAdminTasksPipeline({}, NOW);
    // take everything up to the sort (reuse exported builder), then group
    const pre = stages.slice(1, stages.findIndex((s) => s.$facet));
    const groupStage = {
      $group: {
        _id: `$${personField}._id`,
        name: { $first: `$${personField}.name` },
        totalTasks: { $sum: 1 },
        submittedTasks: { $sum: { $cond: ['$hasSubmission', 1, 0] } },
      },
    };
    return runPipeline(tasks, [...pre, groupStage], collections);
  };

  const byTrainer = Object.fromEntries(groupBy('trainer').map((r) => [r.name, r]));
  check('Trainer-wise totals split correctly (Ravi 4 / Neha 5)', byTrainer['Ravi Trainer'].totalTasks === 4 && byTrainer['Neha Trainer'].totalTasks === 5);
  check('Trainer-wise submitted counts are per-trainer (Ravi 1 / Neha 3)', byTrainer['Ravi Trainer'].submittedTasks === 1 && byTrainer['Neha Trainer'].submittedTasks === 3);
  check('Sum over trainer groups equals global total (no task lost or duplicated)',
    Object.values(byTrainer).reduce((s, r) => s + r.totalTasks, 0) === 9);

  const byStudent = Object.fromEntries(groupBy('student').map((r) => [String(r._id || 'deleted'), r]));
  check('Student-wise grouping keeps tasks of a DELETED student as one recoverable group', byStudent['deleted'] && byStudent['deleted'].totalTasks === 1 && byStudent['deleted'].name === undefined);
  check('Student-wise submitted counts (Aman 2 / Priya 2 / Karan 0)',
    byStudent[String(S1)].submittedTasks === 2 && byStudent[String(S2)].submittedTasks === 2 && byStudent[String(S3)].submittedTasks === 0);
}

// ─────────────────────────────────────────────
section('E. Security & wiring source scan');

{
  const routes = read('routes/task.routes.js');
  const controller = read('controllers/task.controller.js');
  const adminPage = readFileSync(join(__dirname, '..', '..', 'client', 'src', 'pages', 'admin', 'AdminTasks.jsx'), 'utf8');

  for (const line of [
    "router.get('/admin/tasks', authorize('admin'), adminGetTasks);",
    "router.get('/admin/tasks/stats', authorize('admin'), adminTaskStats);",
    "router.get('/admin/tasks/trainers', authorize('admin'), adminTasksByTrainer);",
    "router.get('/admin/tasks/students', authorize('admin'), adminTasksByStudent);",
  ]) {
    check(`Route wired behind authorize('admin'): ${line.split('(')[1].split(',')[0]}`, routes.includes(line));
  }
  check('Admin monitoring routes are GET-only (no mutation shortcuts added)',
    !/router\.(post|put|patch|delete)\('\/admin/.test(routes));
  check('No new grading/rejection/deletion endpoints introduced for admin monitoring',
    !controller.includes('adminGrade') && !controller.includes('adminDelete') && !controller.includes('adminReview'));

  const projSrc = controller.slice(controller.indexOf('const ADMIN_TASK_ROW_PROJECTION'), controller.indexOf('export const buildAdminTasksPipeline'));
  check('Row projection is an allow-list (no raw join arrays, no password/auth fields)',
    projSrc.length > 50 && !/password|refreshToken|studentDocs|trainerDocs|submissionDocs/.test(projSrc) && projSrc.includes("'submission.versions'"));
  check('Group pipelines carry only name/email per person (allow-listed in stats/group $group)',
    controller.includes('`$${personField}.name`') && controller.includes('`$${personField}.email`') && !/\$\$\{personField\}\.(password|refreshToken)/.test(controller));
  check('Search goes through literalSearchRegex (escaped), never raw user-built RegExp',
    /buildAdminTaskFilters[\s\S]{0,1600}literalSearchRegex\(query\.search\)/.test(controller) && !/new RegExp\((query|req\.query)/.test(controller));
  check('Paging is server-side ($facet skip/limit), not client-side filtering',
    /\$facet[\s\S]{0,220}\$skip/.test(controller) && controller.includes('$limit'));
  check('Frontend page consumes the admin endpoints (no full-dump /tasks load)',
    adminPage.includes("api.get('/tasks/admin/tasks', { params })") && !adminPage.includes("api.get('/tasks', { params })"));
  check('Frontend renders stats from the API, no hardcoded dashboard numbers',
    adminPage.includes('stats?.totalTasks') && !/const\s+\w*[Ss]tats\w*\s*=\s*\[[^\]]*'\d/.test(adminPage));
  check('Frontend reuses existing dateTime utilities (IST display convention)',
    adminPage.includes('../../utils/dateTime') && adminPage.includes('formatDateTimeIST'));
  check('Deadline actions reuse the audited extend/reopen endpoints (no duplicate logic)',
    adminPage.includes('/extend-deadline') && !adminPage.includes('/admin/tasks/extend') && !adminPage.includes('adminDeleteTask'));
}

// ─────────────────────────────────────────────
console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[31m'}adminTasks.verify: ${passed} passed, ${failed} failed\x1b[0m`);
process.exit(failed === 0 ? 0 : 1);
