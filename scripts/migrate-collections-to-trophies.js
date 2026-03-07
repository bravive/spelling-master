import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

const users     = await db.collection('users').find({}).toArray();
const oldDocs   = await db.collection('collections').find({}).toArray();
const trophies  = db.collection('trophies');

// Build userId→UUID lookup (string username → UUID)
const uuidByKey = Object.fromEntries(users.map(u => [u.userId, u._id]));
// Also identity map UUIDs to themselves
users.forEach(u => { uuidByKey[u._id] = u._id; });

console.log('Users:', users.map(u => `${u.userId} → ${u._id}`));
console.log('Old collection docs:', oldDocs.length);

// Group old docs by resolved UUID
const byUuid = {};
for (const doc of oldDocs) {
  const uuid = uuidByKey[doc.userId];
  if (!uuid) { console.log(`  SKIP: no user found for userId="${doc.userId}"`); continue; }
  if (!byUuid[uuid]) {
    byUuid[uuid] = { ...doc, userId: uuid };
  } else {
    // Merge: union the pokemon collections
    const merged = { ...byUuid[uuid].collection };
    for (const [id, val] of Object.entries(doc.collection || {})) {
      if (!merged[id]) merged[id] = val;
      else merged[id] = { regular: merged[id].regular || val.regular, shiny: merged[id].shiny || val.shiny };
    }
    byUuid[uuid].collection = merged;
    // Keep later updated_at
    if (new Date(doc.updated_at) > new Date(byUuid[uuid].updated_at)) {
      byUuid[uuid].shinyEligible      = doc.shinyEligible ?? byUuid[uuid].shinyEligible;
      byUuid[uuid].consecutiveRegular = doc.consecutiveRegular ?? byUuid[uuid].consecutiveRegular;
      byUuid[uuid].updated_at         = doc.updated_at;
    }
    console.log(`  MERGED duplicate for UUID ${uuid}`);
  }
}

// Upsert into trophies
let inserted = 0, updated = 0;
for (const [uuid, doc] of Object.entries(byUuid)) {
  const { _id, userId, collection, shinyEligible, consecutiveRegular, created_at, updated_at } = doc;
  const existing = await trophies.findOne({ userId: uuid });
  if (existing) {
    // Merge with anything already in trophies
    const merged = { ...existing.collection };
    for (const [id, val] of Object.entries(collection || {})) {
      if (!merged[id]) merged[id] = val;
      else merged[id] = { regular: merged[id].regular || val.regular, shiny: merged[id].shiny || val.shiny };
    }
    await trophies.updateOne({ userId: uuid }, { $set: { collection: merged, shinyEligible, consecutiveRegular, updated_at: new Date() } });
    console.log(`  UPDATED trophies for ${uuid}: ${Object.keys(merged).length} pokemon`);
    updated++;
  } else {
    await trophies.insertOne({ _id, userId: uuid, collection, shinyEligible: shinyEligible ?? false, consecutiveRegular: consecutiveRegular ?? 0, created_at: new Date(created_at), updated_at: new Date() });
    console.log(`  INSERTED trophies for ${uuid}: ${Object.keys(collection || {}).length} pokemon`);
    inserted++;
  }
}

console.log(`\nDone: ${inserted} inserted, ${updated} updated`);
console.log('Trophies collection now has', await trophies.countDocuments(), 'docs');

await client.close();
