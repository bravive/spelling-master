/**
 * One-shot migration: build creditHistory from existing roundHistory and
 * weeklychallengestats for every user who doesn't have one yet.
 *
 * Run after making sure the server is not running writes:
 *   node --env-file=.env scripts/backfill-credit-history.js
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

const users        = await db.collection('users').find({}).toArray();
const roundhistory = db.collection('roundhistory');
const weeklystats  = db.collection('weeklychallengestats');

let updated = 0;

for (const user of users) {
  const rhDoc = await roundhistory.findOne({ userId: user._id });
  if (!rhDoc) continue;

  // Skip if already has credit history
  if (rhDoc.creditHistory && rhDoc.creditHistory.length > 0) {
    console.log(`  SKIP ${user.name}: already has ${rhDoc.creditHistory.length} credit history entries`);
    continue;
  }

  const creditHistory = [];

  // Build from roundHistory — each earned > 0 becomes a 'round' event.
  // We can't split base vs streak bonus retrospectively, so log as one entry.
  for (const r of (rhDoc.roundHistory || [])) {
    if (r.earned > 0) {
      creditHistory.push({
        date: r.date,
        amount: r.earned,
        source: 'round',
        description: `Score ${r.score}/10`,
      });
    }
  }

  // Build from weeklychallengestats — one entry per week that has credits
  const weekDocs = await weeklystats.find({ userId: user._id }).toArray();
  for (const wd of weekDocs) {
    if ((wd.creditsEarned || 0) > 0) {
      creditHistory.push({
        date: wd.lastDailyReward || wd.updated_at?.toISOString?.()?.slice(0, 10) || wd.created_at?.toISOString?.()?.slice(0, 10) || 'unknown',
        amount: wd.creditsEarned,
        source: 'weekly',
        description: `Weekly ${wd.weekId} (total)`,
      });
    }
  }

  // Sort by date ascending
  creditHistory.sort((a, b) => a.date.localeCompare(b.date));

  await roundhistory.updateOne(
    { userId: user._id },
    { $set: { creditHistory, updated_at: new Date() } }
  );

  console.log(`  ${user.name}: backfilled ${creditHistory.length} credit events (${creditHistory.reduce((s, e) => s + e.amount, 0).toFixed(1)} credits total)`);
  updated++;
}

console.log(`\nDone: ${updated} user(s) backfilled`);
await client.close();
