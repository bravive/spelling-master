/**
 * Import users and related data exported by export-users.js into the target DB.
 * Safe to re-run — upserts by _id, never creates duplicates.
 *
 *   MONGO_URL=<railway-url> node scripts/import-users.js
 *
 * Reads from: scripts/export-users-output.json
 */

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const dataPath = join(dirname(fileURLToPath(import.meta.url)), 'export-users-output.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8'));

const client = new MongoClient(process.env.MONGO_URL);
await client.connect();
const db = client.db();

const upsert = async (colName, docs) => {
  if (!docs.length) return;
  const col = db.collection(colName);
  for (const doc of docs) {
    await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
  }
  console.log(`  ${colName}: upserted ${docs.length} doc(s)`);
};

for (const user of data.users) {
  console.log(`Importing ${user.name} (${user._id})`);
}

await upsert('users', data.users);
await upsert('trophies', data.trophies);
await upsert('wordstats', data.wordstats);
await upsert('roundhistory', data.roundhistory);
await upsert('weeklychallengestats', data.weeklychallengestats);

console.log('\nDone.');
await client.close();
