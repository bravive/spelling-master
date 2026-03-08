/**
 * One-shot migration: move creditHistory from roundhistory (and users)
 * collection into the new dedicated credithistory collection.
 *
 * Run after deploy:
 *   node --env-file=.env scripts/migrate-credithistory.js
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL || process.env.MONGODB_URI;
if (!uri) { console.error('MONGO_URL not set'); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

const users = await db.collection('users').find({}).toArray();
const roundhistory = db.collection('roundhistory');
const credithistory = db.collection('credithistory');

// Ensure index
await credithistory.createIndex({ userId: 1 }, { unique: true });

let migrated = 0;
let skipped = 0;

for (const user of users) {
  // Check if already migrated
  const existing = await credithistory.findOne({ userId: user._id });
  if (existing && existing.creditHistory && existing.creditHistory.length > 0) {
    console.log(`  SKIP ${user.name}: already has ${existing.creditHistory.length} entries in credithistory collection`);
    skipped++;
    continue;
  }

  // Try roundhistory first (authoritative source)
  const rhDoc = await roundhistory.findOne({ userId: user._id });
  let history = rhDoc?.creditHistory || [];

  // Fall back to users collection if roundhistory is empty
  if (history.length === 0 && user.creditHistory && user.creditHistory.length > 0) {
    history = user.creditHistory;
    console.log(`  ${user.name}: using creditHistory from users collection (${history.length} entries)`);
  }

  if (history.length === 0) {
    console.log(`  SKIP ${user.name}: no creditHistory found anywhere`);
    skipped++;
    continue;
  }

  // Upsert into credithistory collection
  const now = new Date();
  await credithistory.updateOne(
    { userId: user._id },
    {
      $set: { creditHistory: history, updated_at: now },
      $setOnInsert: { _id: crypto.randomUUID(), created_at: now },
    },
    { upsert: true }
  );

  console.log(`  ${user.name}: migrated ${history.length} credit events`);
  migrated++;
}

console.log(`\nDone: ${migrated} migrated, ${skipped} skipped`);
await client.close();
