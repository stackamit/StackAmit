// ─────────────────────────────────────────────────────────────
// Pre-deploy audit: duplicate submissions (READ-ONLY — never writes)
//
// The submission-management enhancement adds a UNIQUE index on
// { taskId, studentId } in models/Submission.js. MongoDB refuses to build
// a unique index while duplicate pairs exist, so this script must be run
// against the target database BEFORE deploying the model change:
//
//   node scripts/checkSubmissionDuplicates.mjs
//
// Exit code 0 → no duplicates, the unique index will build cleanly.
// Exit code 1 → duplicates found; the deployer must review them manually.
//
// This script intentionally performs NO writes of any kind (no --apply
// mode exists): merging/deduplicating real submission data requires a
// human decision about which version to keep, and production records must
// never be deleted automatically.
// ─────────────────────────────────────────────────────────────
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

const run = async () => {
  await connectDB();

  const col = mongoose.connection.db.collection('submissions');

  const duplicates = await col
    .aggregate([
      { $group: { _id: { taskId: '$taskId', studentId: '$studentId' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ])
    .toArray();

  if (duplicates.length === 0) {
    console.log('✅ No duplicate {taskId, studentId} records found. The unique index will build cleanly.');
    await mongoose.disconnect();
    return;
  }

  console.log(`⚠️  Found ${duplicates.length} duplicate group(s) (showing up to 100):`);
  for (const d of duplicates) {
    console.log(`  task=${d._id.taskId} student=${d._id.studentId} count=${d.count} ids=${d.ids.join(', ')}`);
  }
  console.log('\nThe unique index creation WILL FAIL until these are reviewed.');
  console.log('Decide manually which submission to keep per pair (review timestamps/status first).');
  console.log('This script never modifies data by design.');

  await mongoose.disconnect();
  process.exit(1);
};

run().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
