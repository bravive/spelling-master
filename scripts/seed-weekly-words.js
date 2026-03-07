/**
 * One-shot migration for weekly challenge data:
 *   1. Seed weeklychallengewords from src/data/weekly-words.js
 *   2. Migrate weeklyProgress nested in user docs → weeklychallengestats collection
 *   3. Remove weeklyProgress from all user documents
 *
 * Run: node --env-file=.env scripts/seed-weekly-words.js
 */

import { randomUUID } from 'crypto';
import { MongoClient } from 'mongodb';
import { WEEKLY_WORDS } from '../src/data/weekly-words.js';

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const wordsCol = db.collection('weeklychallengewords');
  const statsCol = db.collection('weeklychallengestats');
  const usersCol = db.collection('users');

  // ── Ensure indexes ──────────────────────────────────────────────────────────
  await Promise.all([
    wordsCol.createIndex({ weekId: 1 }, { unique: true }),
    wordsCol.createIndex({ startDate: 1 }),
    statsCol.createIndex({ userId: 1, weekId: 1 }, { unique: true }),
    statsCol.createIndex({ userId: 1 }),
  ]);

  // ── 1. Seed weeklychallengewords ────────────────────────────────────────────
  console.log('Seeding weeklychallengewords…');
  const now = new Date();
  const weekDocs = WEEKLY_WORDS.map(w => ({
    _id: randomUUID(),
    weekId: w.id,
    label: w.label,
    startDate: w.startDate,
    words: w.words,
    created_at: now,
    updated_at: now,
  }));

  try {
    const result = await wordsCol.insertMany(weekDocs, { ordered: false });
    console.log(`  weeklychallengewords: inserted ${result.insertedCount}`);
  } catch (err) {
    const inserted = err.result?.insertedCount ?? '?';
    const skipped = weekDocs.length - (typeof inserted === 'number' ? inserted : 0);
    console.log(`  weeklychallengewords: inserted ${inserted}, skipped ${skipped} (already exist)`);
  }

  // ── 2. Migrate weeklyProgress → weeklychallengestats ───────────────────────
  console.log('Migrating weeklyProgress → weeklychallengestats…');
  const users = await usersCol.find({ weeklyProgress: { $exists: true } }).toArray();
  console.log(`  Found ${users.length} user(s) with weeklyProgress`);

  let statInserted = 0;
  let statSkipped = 0;

  for (const user of users) {
    const entries = Object.entries(user.weeklyProgress || {});
    for (const [weekId, progress] of entries) {
      try {
        await statsCol.insertOne({
          _id: randomUUID(),
          userId: user._id,
          weekId,
          wordsCorrect: progress.wordsCorrect ?? progress.firstAttemptCorrect ?? [],
          completed: progress.completed ?? false,
          creditsEarned: progress.creditsEarned ?? 0,
          lastDailyReward: progress.lastDailyReward ?? null,
          created_at: now,
          updated_at: now,
        });
        statInserted++;
      } catch (err) {
        if (err.code === 11000) { statSkipped++; } // duplicate — already migrated
        else throw err;
      }
    }
  }
  console.log(`  weeklychallengestats: inserted ${statInserted}, skipped ${statSkipped} (already exist)`);

  // ── 3. Remove weeklyProgress from user documents ───────────────────────────
  console.log('Removing weeklyProgress from user documents…');
  const clean = await usersCol.updateMany(
    { weeklyProgress: { $exists: true } },
    { $unset: { weeklyProgress: '' } }
  );
  console.log(`  Cleaned weeklyProgress from ${clean.modifiedCount} user(s)`);

  await client.close();
  console.log('Done.');
};

run().catch(err => { console.error(err); process.exit(1); });
