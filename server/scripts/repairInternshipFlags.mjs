// ─────────────────────────────────────────────────────────────
// One-time maintenance migration (SA-003)
//
// This repairs Internship documents that pre-date the isDeleted /
// status-normalisation model. Previously this same work was executed
// implicitly on every GET /api/internships request via raw
// `collection.updateMany({})`, which is unsafe (a read request must never
// mutate the database) and slow. It is moved here so it is invoked
// explicitly, reviewed, and run once.
//
// ⚠️  Read-only audit note: this script intentionally does NOTHING unless
// you pass the explicit `--apply` flag. Without it, it only prints the
// counts it *would* change (dry run).
//
// Usage:
//   node scripts/repairInternshipFlags.mjs           # dry run (safe)
//   node scripts/repairInternshipFlags.mjs --apply    # actually write
// ─────────────────────────────────────────────────────────────
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

const APPLY = process.argv.includes('--apply');

const run = async () => {
  await connectDB();

  const col = mongoose.connection.db.collection('internships');

  const missingFlag = await col.countDocuments({ isDeleted: { $exists: false } });
  const badStatus = await col.countDocuments({
    status: { $nin: ['published', 'closed', 'archived', 'draft'] },
  });

  console.log(`Mode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)'}`);
  console.log(`Documents missing isDeleted flag : ${missingFlag}`);
  console.log(`Documents with an invalid status : ${badStatus}`);

  if (!APPLY) {
    console.log('\nNo changes made. Re-run with --apply to perform the repair.');
    await mongoose.disconnect();
    return;
  }

  if (missingFlag > 0) {
    const r1 = await col.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } });
    console.log(`Set isDeleted=false on ${r1.modifiedCount} document(s).`);
  }
  if (badStatus > 0) {
    const r2 = await col.updateMany(
      { status: { $nin: ['published', 'closed', 'archived', 'draft'] } },
      { $set: { status: 'published' } },
    );
    console.log(`Normalised status on ${r2.modifiedCount} document(s).`);
  }

  console.log('Repair complete.');
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

