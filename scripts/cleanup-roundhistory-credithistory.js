/**
 * One-shot cleanup: remove creditHistory field from roundhistory collection.
 *
 * Run on production:
 *   node --env-file=.env scripts/cleanup-roundhistory-credithistory.js
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL || process.env.MONGODB_URI;
if (!uri) { console.error('MONGO_URL not set'); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODATABASE || 'spell-master');

const before = await db.collection('roundhistory').countDocuments({ creditHistory: { $exists: true } });
console.log(`Found ${before} roundhistory doc(s) with creditHistory field`);

const result = await db.collection('roundhistory').updateMany({}, {
  $unset: { creditHistory: '' },
});
console.log(`Cleaned ${result.modifiedCount} doc(s)`);

console.log('Done');
await client.close();
