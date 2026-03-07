/**
 * Export specified users and all their related data to a JSON file.
 *
 *   node --env-file=.env scripts/export-users.js dad Andy
 *
 * Outputs: scripts/export-users-output.json
 */

import { MongoClient } from 'mongodb';
import { writeFileSync } from 'fs';

const names = process.argv.slice(2).map(n => n.toLowerCase());
if (!names.length) { console.error('Usage: node --env-file=.env scripts/export-users.js <name> [name...]'); process.exit(1); }

const client = new MongoClient(process.env.MONGO_URL);
await client.connect();
const db = client.db();

const users = await db.collection('users').find({ name: { $regex: new RegExp(`^(${names.join('|')})$`, 'i') } }).toArray();
if (!users.length) { console.error('No users found for:', names); process.exit(1); }

const result = { users: [], trophies: [], wordstats: [], roundhistory: [], weeklychallengestats: [] };

for (const user of users) {
  result.users.push(user);
  const id = user._id;
  const [trophy, ws, rh, wcs] = await Promise.all([
    db.collection('trophies').findOne({ userId: id }),
    db.collection('wordstats').findOne({ userId: id }),
    db.collection('roundhistory').findOne({ userId: id }),
    db.collection('weeklychallengestats').find({ userId: id }).toArray(),
  ]);
  if (trophy) result.trophies.push(trophy);
  if (ws)     result.wordstats.push(ws);
  if (rh)     result.roundhistory.push(rh);
  result.weeklychallengestats.push(...wcs);
  console.log(`Exported ${user.name}: trophy=${!!trophy} wordstats=${!!ws} roundhistory=${!!rh} weeklystats=${wcs.length}`);
}

const outPath = new URL('./export-users-output.json', import.meta.url).pathname;
writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`\nWritten to ${outPath}`);
await client.close();
