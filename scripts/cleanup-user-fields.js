/**
 * One-shot cleanup: remove redundant fields from users collection
 * and creditHistory from roundhistory collection.
 *
 * Run AFTER migrate-credithistory.js:
 *   node --env-file=.env scripts/cleanup-user-fields.js
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL || process.env.MONGODB_URI;
if (!uri) { console.error('MONGO_URL not set'); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db(process.env.MONGODATABASE || 'spell-master');

// Remove redundant fields from users collection
const usersResult = await db.collection('users').updateMany({}, {
  $unset: {
    collection: '',
    creditHistory: '',
    roundHistory: '',
    wordStats: '',
    shinyEligible: '',
    consecutiveRegular: '',
    nextPokemonId: '',
    bestScores: '',
  },
});
console.log(`users: cleaned ${usersResult.modifiedCount} doc(s)`);

// Remove creditHistory from roundhistory collection
const rhResult = await db.collection('roundhistory').updateMany({}, {
  $unset: { creditHistory: '' },
});
console.log(`roundhistory: cleaned ${rhResult.modifiedCount} doc(s)`);

console.log('\nDone');
await client.close();
