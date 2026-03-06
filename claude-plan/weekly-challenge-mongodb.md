# Weekly Challenge MongoDB Migration Plan

## Context

Weekly challenge words are currently stored as a static JS file (`src/data/weekly-words.js`),
and per-user weekly progress is stored as a nested `weeklyProgress` object inside each user
document. Neither is independently queryable or manageable.

This plan moves them into two dedicated MongoDB collections:
- `weeklychallengewords` — the weekly word lists (admin-managed, shared across all users)
- `weeklychallengestats` — per-user per-week progress (replaces `weeklyProgress` in users doc)

---

## New Collection Schemas

### `weeklychallengewords`
One document per week. Seeded from `src/data/weekly-words.js`.
```js
{
  _id: UUID,
  weekId: 'w2026-10',          // unique, used as FK in stats
  label: 'Week 10',
  startDate: '2026-03-02',     // YYYY-MM-DD; unlocks on or after this date
  words: [{ w: string, s: string }],
  created_at: Date,
  updated_at: Date,
}
```
Indexes: `{ weekId: 1 }` unique, `{ startDate: 1 }`

### `weeklychallengestats`
One document per (user, week) pair.
```js
{
  _id: UUID,
  userId: '<user UUID>',       // FK to users._id
  weekId: 'w2026-10',          // FK to weeklychallengewords.weekId
  wordsCorrect: string[],      // words ever spelled correctly for this week
  completed: boolean,          // true when wordsCorrect.length >= total words
  creditsEarned: number,       // cumulative credits across all runs
  lastDailyReward: string | null,  // YYYY-MM-DD of last +2 daily claim
  created_at: Date,
  updated_at: Date,
}
```
Indexes: `{ userId: 1, weekId: 1 }` unique, `{ userId: 1 }`

---

## Files to Change

### `src/db.js`
- Add `weeklyChallengeWordsCol()` and `weeklyStatsCol()` collection helpers
- Add indexes in `ensureIndexes()`:
  - `weeklychallengewords`: unique on `weekId`, plain on `startDate`
  - `weeklychallengestats`: unique compound `{ userId: 1, weekId: 1 }`, plain `{ userId: 1 }`

### `src/store.js`
Add new functions:
```js
// Weekly words (read-only from client perspective)
export const getAllWeeks = () =>
  weeklyChallengeWordsCol().find({}).sort({ startDate: 1 }).toArray();

// Weekly stats (per user per week)
export const getAllWeeklyStats = (userId) =>
  weeklyStatsCol().find({ userId }).toArray();

export const saveWeeklyStats = (userId, weekId, data) =>
  weeklyStatsCol().updateOne(
    { userId, weekId },
    { $set: { ...data, updated_at: now() }, $setOnInsert: { _id: randomUUID(), created_at: now() } },
    { upsert: true }
  );

export const deleteWeeklyStats = (userId) =>
  weeklyStatsCol().deleteMany({ userId });
```
Update `deleteUser` to cascade: call `deleteWeeklyStats(id)`.

### `server.js`
Add three routes:
```
GET  /api/weekly-words            — all weeks sorted by startDate, no auth
GET  /api/weekly-stats            — all stat docs for current user (requireAuth)
PUT  /api/weekly-stats/:weekId    — upsert one week's stats (requireAuth)
```

### `src/App.jsx`
- Remove `import { WEEKLY_WORDS } from './data/weekly-words'`
- Add `weeklyWords` state: fetched from `GET /api/weekly-words` on app mount
- Add `weeklyStats` state (object keyed by weekId): fetched from `GET /api/weekly-stats` after login
- `processWeeklyRound`: save via `PUT /api/weekly-stats/:weekId` instead of embedding in user doc
- Remove `weeklyProgress` from `saveUserToServer`
- Pass `weeklyWords` and `weeklyStats` to `WeeklyChallengeScreen`

### `src/components/WeeklyChallengeScreen.jsx`
- Accept `weeklyWords` and `weeklyStats` as props instead of importing static file and reading `user.weeklyProgress`
- No logic changes — same rendering, different data source

### `src/weeklyScoring.js`
No changes needed — pure function is data-source agnostic.

### `src/data/weekly-words.js`
Keep for the seed script. Remove the React import after migration is complete.

---

## Migration Script (`scripts/seed-weekly-words.js`)

New one-shot script:
1. **Seed `weeklychallengewords`**: insert all entries from `WEEKLY_WORDS`; skip duplicates via `ordered: false`
2. **Migrate `weeklyProgress`**: for each user doc with `weeklyProgress`, insert one `weeklychallengestats` doc per weekId (`userId: user._id, weekId, ...data`); skip existing
3. **Clean up**: `$unset { weeklyProgress: '' }` from all user documents

Run with: `node --env-file=.env scripts/seed-weekly-words.js`
Add `make seed-weekly` to Makefile.

---

## Test Updates

### `src/__tests__/server.integration.test.js`
- Add `weeklyStatsCol()` to `beforeEach` clear list
- Add test suite covering all three new routes
- Verify `DELETE /api/users/:id` cascades to `weeklychallengestats`

### `src/__tests__/db.test.js`
- Add assertions for the two new collection helpers

### `src/__tests__/weeklyScoring.test.js`
- No changes needed (already uses `wordsCorrect` schema)

---

## Order of Implementation

1. `src/db.js` — collection helpers + indexes
2. `src/store.js` — store functions + deleteUser cascade
3. `server.js` — 3 new routes
4. `scripts/seed-weekly-words.js` — write and run
5. `src/App.jsx` — fetch from API, update processWeeklyRound
6. `src/components/WeeklyChallengeScreen.jsx` — use props
7. Tests — integration + db tests
8. `npm test`, `make restart`, browser smoke test
9. Commit and push

---

## Verification

- `npm test` passes (84+ tests)
- `GET /api/weekly-words` returns week list
- `GET /api/weekly-stats` returns empty array for new user
- Playing a weekly round creates a doc in `weeklychallengestats`
- Deleting a user removes their `weeklychallengestats` docs
- `weeklyProgress` field gone from user documents after migration