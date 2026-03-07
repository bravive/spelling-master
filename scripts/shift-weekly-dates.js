/**
 * Shift all weeklychallengewords startDate forward by 7 days.
 *
 * Run: node --env-file=.env scripts/shift-weekly-dates.js
 */

import { MongoClient } from 'mongodb';

const SHIFT_DAYS = 7;

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection('weeklychallengewords');

  const weeks = await col.find({}).sort({ startDate: 1 }).toArray();
  console.log(`Found ${weeks.length} weeks to update\n`);

  for (const week of weeks) {
    const oldDate = week.startDate;
    const d = new Date(oldDate + 'T00:00:00');
    d.setDate(d.getDate() + SHIFT_DAYS);
    const newDate = d.toISOString().slice(0, 10);

    await col.updateOne(
      { _id: week._id },
      { $set: { startDate: newDate, updated_at: new Date().toISOString() } },
    );
    console.log(`${week.weekId}: ${oldDate} -> ${newDate}`);
  }

  console.log(`\nDone. Shifted ${weeks.length} weeks by +${SHIFT_DAYS} days.`);
  await client.close();
};

run().catch(err => { console.error(err); process.exit(1); });
