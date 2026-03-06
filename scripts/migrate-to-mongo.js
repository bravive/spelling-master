/**
 * One-shot migration: import existing JSON data files into MongoDB.
 * Run after `make mongo-up`:
 *   node --env-file=.env scripts/migrate-to-mongo.js
 *   (or: make migrate)
 */

import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir   = join(__dirname, '..', 'data');

const readJson = (name) => {
  try { return JSON.parse(readFileSync(join(dataDir, `${name}.json`), 'utf8')); }
  catch { return {}; }
};

const now = new Date();

const insertMany = async (col, docs) => {
  if (!docs.length) { console.log(`  ${col.collectionName}: nothing to insert`); return; }
  try {
    const result = await col.insertMany(docs, { ordered: false });
    console.log(`  ${col.collectionName}: inserted ${result.insertedCount}`);
  } catch (err) {
    const inserted = err.result?.nInserted ?? err.result?.insertedCount ?? '?';
    const skipped  = docs.length - (typeof inserted === 'number' ? inserted : 0);
    console.log(`  ${col.collectionName}: inserted ${inserted}, skipped ${skipped} (already exist)`);
  }
};

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  // Ensure unique indexes exist
  await Promise.all([
    db.collection('users').createIndex({ userId: 1 }, { unique: true }),
    db.collection('collections').createIndex({ userId: 1 }, { unique: true }),
    db.collection('wordstats').createIndex({ userId: 1 }, { unique: true }),
    db.collection('roundhistory').createIndex({ userId: 1 }, { unique: true }),
  ]);

  console.log('Migrating JSON → MongoDB…');

  // ── users ──────────────────────────────────────────────────────────────────
  const usersJson = readJson('users');
  const userDocs = Object.entries(usersJson).map(([userId, u]) => ({
    _id: randomUUID(),
    userId,
    name: u.name,
    pin: u.pin,
    starterId: u.starterId,
    starterSlug: u.starterSlug,
    level: u.level ?? 1,
    totalCredits: u.totalCredits ?? 0,
    creditBank: u.creditBank ?? 0,
    streak: u.streak ?? 0,
    lastPlayed: u.lastPlayed ?? null,
    streakDates: u.streakDates ?? [],
    caught: u.caught ?? 0,
    roundCount: u.roundCount ?? 0,
    created_at: u.createdAt ? new Date(u.createdAt) : now,
    updated_at: now,
  }));
  await insertMany(db.collection('users'), userDocs);

  // Build username → UUID map for foreign key references
  const uuidByUsername = Object.fromEntries(userDocs.map(u => [u.userId, u._id]));

  // ── collections ────────────────────────────────────────────────────────────
  const colJson = readJson('collection');
  const colDocs = Object.entries(colJson).map(([username, c]) => ({
    _id: randomUUID(),
    userId: uuidByUsername[username] ?? username,
    collection: c.collection ?? {},
    shinyEligible: c.shinyEligible ?? false,
    consecutiveRegular: c.consecutiveRegular ?? 0,
    created_at: now,
    updated_at: now,
  }));
  await insertMany(db.collection('collections'), colDocs);

  // ── wordstats ──────────────────────────────────────────────────────────────
  const wsJson = readJson('wordstats');
  const wsDocs = Object.entries(wsJson).map(([username, stats]) => ({
    _id: randomUUID(),
    userId: uuidByUsername[username] ?? username,
    stats,           // { [word]: { attempts, correct, weight, ... } }
    created_at: now,
    updated_at: now,
  }));
  await insertMany(db.collection('wordstats'), wsDocs);

  // ── roundhistory ───────────────────────────────────────────────────────────
  const rhJson = readJson('roundhistory');
  const rhDocs = Object.entries(rhJson).map(([username, rh]) => ({
    _id: randomUUID(),
    userId: uuidByUsername[username] ?? username,
    roundHistory: rh.roundHistory ?? [],
    bestScores: rh.bestScores ?? {},
    created_at: now,
    updated_at: now,
  }));
  await insertMany(db.collection('roundhistory'), rhDocs);

  await client.close();
  console.log('Done.');
};

run().catch(err => { console.error(err); process.exit(1); });
