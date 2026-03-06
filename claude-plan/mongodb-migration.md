# MongoDB Migration Plan

## Overview

Migrate all flat JSON file storage to MongoDB. Each JSON file becomes its own
collection. The Express server switches from `readFileSync`/`writeFileSync` to
a MongoDB client. Local dev uses Docker; production uses Railway's MongoDB plugin.

---

## 1. Collections & Schema

### `users`
One document per user. `_id` is the username (e.g. `"dad"`).

```js
{
  _id: String,          // userId / username (unique, immutable)
  name: String,         // display name
  pin: String,          // bcrypt hash
  starterId: Number,
  starterSlug: String,
  level: Number,        // 1–5
  totalCredits: Number,
  creditBank: Number,   // resets toward 10
  streak: Number,
  lastPlayed: String,   // YYYY-MM-DD | null
  streakDates: [String],
  caught: Number,       // denormalised count for select screen
  roundCount: Number,
  createdAt: Date,
}
```

Index: unique on `_id` (default).

---

### `collections`
One document per user — Pokémon ownership.

```js
{
  _id: String,              // userId
  collection: {             // keys are pokemonId as string
    "1": { regular: Boolean, shiny: Boolean },
    ...
  },
  shinyEligible: Boolean,
  consecutiveRegular: Number,
}
```

Index: unique on `_id` (default).

---

### `wordstats`
One document per user — per-word learning stats.

```js
{
  _id: String,    // userId
  stats: {        // keys are word strings
    "cat": {
      attempts: Number,
      correct: Number,
      weight: Number,
      consecutivePasses: Number,
      cooldownUntilRound: Number | null,
      retired: Boolean,
    },
    ...
  },
}
```

Index: unique on `_id` (default).

---

### `roundhistory`
One document per user — play history.

```js
{
  _id: String,   // userId
  roundHistory: [
    {
      date: String,    // YYYY-MM-DD
      score: Number,   // 0–10
      earned: Number,  // credits earned
      pass: Boolean,
    }
  ],
  bestScores: Object,  // reserved, currently {}
}
```

Index: unique on `_id` (default).

---

## 2. MongoDB Client Module (`src/db.js`)

- Use the official `mongodb` npm package (not Mongoose — no schema layer needed).
- Export a singleton `getDb()` that returns the connected `Db` instance.
- Connection string read from `MONGODB_URI` env var.
- On startup, call `connectDb()` which connects once and caches the client.
- Each collection exported as a helper: `usersCol()`, `collectionsCol()`, etc.
- All reads/writes go through the helpers — server.js never touches files.

```
src/
  db.js           — connect(), getDb(), collection helpers
```

### Connection lifecycle

```js
let client;
export const connectDb = async () => {
  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
};
export const getDb = () => client.db();
export const usersCol      = () => getDb().collection('users');
export const collectionsCol = () => getDb().collection('collections');
export const wordstatsCol  = () => getDb().collection('wordstats');
export const roundhistoryCol = () => getDb().collection('roundhistory');
```

---

## 3. server.js Changes

Replace all `readFileSync` / `writeFileSync` calls with async MongoDB ops.

| Current (JSON)                        | New (MongoDB)                              |
|---------------------------------------|--------------------------------------------|
| `readUsers()`                         | `await usersCol().find().toArray()`        |
| `writeUsers(data)`                    | `await usersCol().replaceOne({_id}, doc)`  |
| `readCollections()[userId]`           | `await collectionsCol().findOne({_id})`    |
| `writeCollections(all)`               | `await collectionsCol().replaceOne(...)`   |
| `readFile('wordstats')[userId]`       | `await wordstatsCol().findOne({_id})`      |
| `readFile('roundhistory')[userId]`    | `await roundhistoryCol().findOne({_id})`   |

All route handlers become `async`. `app.listen` called after `connectDb()`.

---

## 4. Local Dev — Docker

`docker-compose.yml` at repo root:

```yaml
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    environment:
      MONGO_INITDB_DATABASE: spellmaster

volumes:
  mongo-data:
```

`.env` (gitignored):
```
MONGODB_URI=mongodb://localhost:27017/spellmaster
```

Makefile targets to add:
```makefile
mongo-up:    # docker compose up -d
mongo-down:  # docker compose down
mongo-shell: # docker exec -it ... mongosh
```

---

## 5. Railway Production Setup

1. Add MongoDB plugin to Railway project (Railway provides `MONGODB_URL` env var).
2. Set `MONGODB_URI` in Railway service env to `${{MongoDB.MONGODB_URL}}`.
3. No persistent volume needed for data — MongoDB plugin handles it.
4. Keep `JWT_SECRET` and `ADMIN_PIN` as Railway env vars.

---

## 6. Data Migration Script (`scripts/migrate-to-mongo.js`)

One-shot script to import existing JSON files into MongoDB.

Steps:
1. Read `data/users.json`, `data/collection.json`, `data/wordstats.json`, `data/roundhistory.json`
2. For each JSON file, map the object entries to MongoDB documents with `_id = userId`
3. For `wordstats`, rename top-level keys to `{ _id, stats: {...} }` (server uses `stats` field)
4. Use `insertMany` with `ordered: false` to skip existing docs
5. Print counts of inserted vs skipped

```
node scripts/migrate-to-mongo.js
```

Requires `MONGODB_URI` in env (or `.env` via `--env-file`).

---

## 7. Tests

### Unit tests (`src/__tests__/db.test.js`)
- Mock the `mongodb` module
- Test `connectDb`, `getDb`, each collection helper
- Verify collection names are correct strings

### Unit tests (`src/__tests__/server.test.js`)
- Mock collection helpers to return controlled data
- Test each route: correct status codes, response shapes, auth checks
- Test login: correct PIN → 200 + JWT, wrong PIN → 401
- Test `requireAuth` / `requireAdmin` middleware rejection paths
- Test `publicUser` strips `pin` field

### Integration tests (`src/__tests__/server.integration.test.js`)
- Spin up real MongoDB (use `@testcontainers/mongodb` or `mongodb-memory-server`)
- Start the Express app
- Seed test users before each suite
- Full request/response cycle via `supertest`
- Test: create user → login → update state → read back → verify persistence
- Test: admin delete user flow
- Test: rate limiter triggers after 10 failed logins
- Clean up (drop test DB) after each suite

### Test infrastructure additions
```
npm install --save-dev mongodb-memory-server supertest
```

`vitest.config.js` — set `testTimeout: 30000` for integration tests (MongoDB startup).

---

## 8. Implementation Order

1. [ ] Add `mongodb` to dependencies
2. [ ] Create `docker-compose.yml` + `.env.example`
3. [ ] Add Makefile `mongo-up / mongo-down / mongo-shell` targets
4. [ ] Write `src/db.js` (connection + collection helpers)
5. [ ] Write `scripts/migrate-to-mongo.js`
6. [ ] Rewrite `server.js` to use async MongoDB ops
7. [ ] Write unit tests for `db.js` and `server.js` routes
8. [ ] Write integration tests with `mongodb-memory-server`
9. [ ] Run migration script against local Docker MongoDB
10. [ ] Verify app works end-to-end locally with MongoDB
11. [ ] Configure Railway MongoDB plugin + env vars
12. [ ] Deploy and verify production

---

## 9. Files Created / Modified

| File | Action |
|------|--------|
| `src/db.js` | Create — MongoDB connection + collection helpers |
| `server.js` | Modify — replace file I/O with async MongoDB calls |
| `scripts/migrate-to-mongo.js` | Create — one-shot JSON → MongoDB import |
| `docker-compose.yml` | Create — local MongoDB via Docker |
| `.env.example` | Create — document required env vars |
| `Makefile` | Modify — add mongo-up / mongo-down / mongo-shell |
| `package.json` | Modify — add `mongodb`, `mongodb-memory-server`, `supertest` |
| `src/__tests__/db.test.js` | Create — unit tests for db module |
| `src/__tests__/server.test.js` | Create — unit tests for route handlers |
| `src/__tests__/server.integration.test.js` | Create — integration tests |
| `data/*.json` | Keep as backup; gitignored; not used after migration |
