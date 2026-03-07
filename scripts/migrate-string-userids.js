/**
 * Migrate roundhistory and wordstats docs from old string userId
 * (e.g. "dad") to the user's UUID _id.
 * Merges with any UUID-keyed doc already created by the new code.
 *
 *   node --env-file=.env scripts/migrate-string-userids.js
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

const users = await db.collection('users').find({}).toArray();
const uuidByKey = Object.fromEntries(users.map(u => [u.userId, u._id]));

const colsToFix = [
  {
    name: 'roundhistory',
    merge: (oldDoc, newDoc) => {
      // Merge roundHistory arrays (deduplicate by date+score+earned)
      const seen = new Set((newDoc?.roundHistory || []).map(r => `${r.date}|${r.score}|${r.earned}`));
      const merged = [...(newDoc?.roundHistory || [])];
      for (const r of (oldDoc.roundHistory || [])) {
        const key = `${r.date}|${r.score}|${r.earned}`;
        if (!seen.has(key)) { merged.push(r); seen.add(key); }
      }
      merged.sort((a, b) => a.date.localeCompare(b.date));
      return {
        roundHistory: merged.slice(-200),
        bestScores: { ...(oldDoc.bestScores || {}), ...(newDoc?.bestScores || {}) },
        creditHistory: [...(oldDoc.creditHistory || []), ...(newDoc?.creditHistory || [])],
      };
    },
  },
  {
    name: 'wordstats',
    merge: (oldDoc, newDoc) => {
      // Merge word stats — prefer whichever has more attempts
      const merged = { ...(oldDoc.stats || {}) };
      for (const [word, ws] of Object.entries(newDoc?.stats || {})) {
        if (!merged[word] || ws.attempts > merged[word].attempts) merged[word] = ws;
      }
      return { stats: merged };
    },
  },
];

for (const { name, merge } of colsToFix) {
  const col = db.collection(name);
  const stringDocs = (await col.find({}).toArray()).filter(d => d.userId && !/^[0-9a-f]{8}-/.test(d.userId));

  for (const oldDoc of stringDocs) {
    const uuid = uuidByKey[oldDoc.userId];
    if (!uuid) { console.log(`  SKIP ${name}/${oldDoc.userId}: no matching user`); continue; }

    const existing = await col.findOne({ userId: uuid });
    const mergedData = merge(oldDoc, existing);

    if (existing) {
      await col.updateOne({ userId: uuid }, { $set: { ...mergedData, updated_at: new Date() } });
      console.log(`  MERGED ${name}: "${oldDoc.userId}" → ${uuid}`);
    } else {
      const { _id, userId: _uid, created_at, updated_at, ...rest } = oldDoc;
      await col.insertOne({ ...rest, ...mergedData, userId: uuid, updated_at: new Date() });
      console.log(`  INSERTED ${name}: "${oldDoc.userId}" → ${uuid}`);
    }

    // Remove old string-keyed doc
    await col.deleteOne({ _id: oldDoc._id });
    console.log(`  DELETED old ${name} doc for "${oldDoc.userId}"`);
  }
}

console.log('\nDone. Remaining string-keyed docs:');
for (const { name } of colsToFix) {
  const count = (await db.collection(name).find({}).toArray()).filter(d => d.userId && !/^[0-9a-f]{8}-/.test(d.userId)).length;
  console.log(`  ${name}: ${count} string-keyed docs remaining`);
}

await client.close();
