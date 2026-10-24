// ─────────────────────────────────────────────────────────────
// One-time maintenance migration (SA-021)
//
// Backward-compatible hashing of stored refresh tokens.
//
// Historically the raw JWT refresh token was persisted on each user record
// (`refreshToken`). A stolen DB dump therefore handed an attacker usable,
// long-lived (7-day) sessions. SA-021 stores only a SHA-256 digest
// (`refreshTokenHash`) and keeps the raw field null.
//
// This script converts existing plaintext records to digests WITHOUT
// invalidating any live session: the token a client already holds is unchanged,
// and `isRefreshTokenValid` now compares hash(presented) against the stored
// digest - so a session that was established before the migration still works
// after it. There is no forced re-login.
//
// ⚠️  Read-only audit note: this script intentionally does NOTHING unless you
// pass the explicit `--apply` flag. Without it, it only prints the counts it
// *would* change (dry run). It never writes when a record already has a digest.
//
// Usage:
//   node scripts/hashRefreshTokens.mjs            # dry run (safe, no writes)
//   node scripts/hashRefreshTokens.mjs --apply     # actually write
//
// Rollback:
//   The migration nulls the plaintext field as it writes the digest, so it is
//   NOT reversible in place (the raw token is gone). This is safe because the
//   digest verifies the same token clients already hold. If you must revert the
//   CODE (not the data), redeploy the previous release: `isRefreshTokenValid`
//   still honours legacy plaintext, and any record already migrated keeps
//   working through its digest. Newly-issued sessions after revert store
//   plaintext again.
// ─────────────────────────────────────────────────────────────
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { hashToken } from '../services/auth.service.js';

const APPLY = process.argv.includes('--apply');

const run = async () => {
  await connectDB();

  const col = mongoose.connection.db.collection('users');

  // Records that still hold a raw token and have no digest yet.
  const pending = await col.countDocuments({
    refreshToken: { $type: 'string', $ne: null },
    $or: [{ refreshTokenHash: { $exists: false } }, { refreshTokenHash: null }],
  });
  // Records already migrated (digest present).
  const already = await col.countDocuments({
    refreshTokenHash: { $type: 'string', $ne: null },
  });

  console.log(`Mode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY RUN (no writes)'}`);
  console.log(`Records pending hashing : ${pending}`);
  console.log(`Records already migrated: ${already}`);

  if (!APPLY) {
    console.log('\nNo changes made. Re-run with --apply to perform the migration.');
    await mongoose.disconnect();
    return;
  }

  if (pending === 0) {
    console.log('\nNothing to migrate. All refresh tokens are already digested.');
    await mongoose.disconnect();
    return;
  }

  const cursor = col.find(
    {
      refreshToken: { $type: 'string', $ne: null },
      $or: [{ refreshTokenHash: { $exists: false } }, { refreshTokenHash: null }],
    },
    { projection: { _id: 1, refreshToken: 1 } },
  );

  let migrated = 0;
  for await (const doc of cursor) {
    const digest = hashToken(doc.refreshToken);
    if (!digest) continue; // defensive: never blank a digest
    await col.updateOne(
      { _id: doc._id },
      { $set: { refreshTokenHash: digest, refreshToken: null } },
    );
    migrated += 1;
  }

  console.log(`\nMigrated ${migrated} record(s) to digest storage (sessions preserved).`);
  console.log('Migration complete.');
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
