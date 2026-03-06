# MongoDB Migration Plan

## Overview

Migrate all flat JSON file storage to MongoDB. Each JSON file becomes its own
collection. The Express server switches from `readFileSync`/`writeFileSync` to
a MongoDB client. Local dev uses Docker; production uses Railway's MongoDB plugin.

---

## 1. Collections & Schema

All documents use `_id: UUID` (via `crypto.randomUUID()`), never MongoDB ObjectId.
All documents carry `created_at: Date` and `updated_at: Date`; every update must
set `updated_at` to the current timestamp.

`userId` is a separate string field (the username key) with a unique index on
each collection — it is the lookup key used in all queries.

---

### `users`

```js
{
  _id: String,          // UUID v4
  userId: String,       // "dad" — unique index, used in JWT & queries
  name: String,
  pin: String,          // bcrypt hash
  starterId: Number,
  starterSlug: String,
  level: Number,        // 1–5
  totalCredits: Number,
  creditBank: Number,
  streak: Number,
  lastPlayed: String,   // YYYY-MM-DD | null
  streakDates: [String],
  caught: Number,       // denormalised count for select screen
  roundCount: Number,
  created_at: Date,
  updated_at: Date,
}
```

---

### `collections`

```js
{
  _id: String,              // UUID v4
  userId: String,           // unique index
  collection: {
    "1": { regular: Boolean, shiny: Boolean },
    ...
  },
  shinyEligible: Boolean,
  consecutiveRegular: Number,
  created_at: Date,
  updated_at: Date,
}
```

---

### `wordstats`

```js
{
  _id: String,    // UUID v4
  userId: String, // unique index
  stats: {
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
  created_at: Date,
  updated_at: Date,
}
```

---

### `roundhistory`

```js
{
  _id: String,   // UUID v4
  userId: String, // unique index
  roundHistory: [
    { date: String, score: Number, earned: Number, pass: Boolean }
  ],
  bestScores: Object,
  created_at: Date,
  updated_at: Date,
}
```

---

## 2. MongoDB Client Module (`src/db.js`)

- Use official `mongodb` npm package (no Mongoose).
- Export `connectDb()` — connects once, caches client.
- Export `getDb()` — returns the connected `Db` instance.
- Export collection helpers: `usersCol()`, `collectionsCol()`, `wordstatsCol()`, `roundhistoryCol()`.
- On startup, create unique indexes on `userId` for all collections.

```
src/
  db.js   — connectDb(), getDb(), collection helpers, ensureIndexes()
```

---

## 3. server.js Changes

Replace all file I/O with MongoDB client calls. All mutating route handlers become async.
`app.listen` is called only after `connectDb()` resolves.

| Current (JSON file)                     | New (MongoDB)                                                              |
|-----------------------------------------|----------------------------------------------------------------------------|
| `readUsers()`                           | `await usersCol().find({}).toArray()`                                      |
| `writeUsers({ [userId]: doc })`         | `updateOne({ userId }, { $set: { ...doc, updated_at } }, { upsert: true })`|
| `readCollections()[userId]`             | `await collectionsCol().findOne({ userId })`                               |
| `writeCollections(all)[userId] = data`  | `updateOne({ userId }, { $set: { ...data, updated_at } }, { upsert: true })`|
| (same pattern)                          | wordstatsCol, roundhistoryCol                                              |

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

`.env.example` (committed):
```
MONGODB_URI=mongodb://localhost:27017/spellmaster
JWT_SECRET=dev-secret-do-not-use-in-production
ADMIN_PIN=0000
```

Makefile targets:
```makefile
mongo-up:    docker compose up -d
mongo-down:  docker compose down
mongo-shell: docker compose exec mongo mongosh spellmaster
```

---

## 5. Railway Production Setup

1. Add MongoDB plugin to Railway project.
2. Set `MONGODB_URI = ${{MongoDB.MONGODB_URL}}` in service env vars.
3. Set `JWT_SECRET` and `ADMIN_PIN` as Railway env vars.
4. No persistent volume needed — MongoDB plugin handles storage.

---

## 6. Data Migration Script (`scripts/migrate-to-mongo.js`)

One-shot script to import existing JSON files into MongoDB.

Steps:
1. Read `data/users.json`, `data/collection.json`, `data/wordstats.json`, `data/roundhistory.json`
2. Map each `{ [userId]: data }` entry to a document with:
   - `_id: crypto.randomUUID()`
   - `userId: key`
   - `created_at: existing createdAt || now`
   - `updated_at: now`
3. For `wordstats`: rename the per-word map to `stats` field
4. `insertMany` with `ordered: false` to skip already-migrated docs
5. Print inserted / skipped counts per collection

```bash
node scripts/migrate-to-mongo.js
# Requires MONGODB_URI in env or .env file
```

---

## 7. Tests

### Unit — `src/__tests__/db.test.js`
- Verify `connectDb` calls `MongoClient.connect`
- Verify each collection helper returns correct collection name
- Verify `ensureIndexes` creates unique index on `userId`

### Unit — `src/__tests__/server.test.js`
- Mock collection helpers
- Test each route: status codes, response shapes, auth enforcement
- Test login: correct PIN → 200 + JWT, wrong PIN → 401, missing fields → 400
- Test `requireAuth` / `requireAdmin` rejection paths
- Test `publicUser` strips `pin`

### Integration — `src/__tests__/server.integration.test.js`
- Use `mongodb-memory-server` (in-memory real MongoDB)
- Use `supertest` for HTTP requests against the Express app
- Seed test users before each suite; drop DB after
- Cover: create user → login → update state → read back → verify persistence
- Cover: admin delete flow, rate limiter after 10 failed logins

```bash
npm install --save-dev mongodb-memory-server supertest
```

`vitest.config.js`: set `testTimeout: 30000` for integration tests.

---

## 8. Implementation Order

1. [ ] `npm install mongodb`
2. [ ] Create `docker-compose.yml` + `.env.example`; update `.gitignore`
3. [ ] Add `mongo-up / mongo-down / mongo-shell` to Makefile
4. [ ] Write `src/db.js`
5. [ ] Write `scripts/migrate-to-mongo.js`
6. [ ] Rewrite `server.js` to use MongoDB client
7. [ ] Write unit tests for `db.js` and `server.js` routes
8. [ ] Write integration tests
9. [ ] `make mongo-up` → run migration script → verify data
10. [ ] End-to-end smoke test with app running against local MongoDB
11. [ ] Configure Railway + deploy

---

## 9. Files Created / Modified

| File | Action |
|------|--------|
| `src/db.js` | Create |
| `server.js` | Modify — replace file I/O with MongoDB client calls |
| `scripts/migrate-to-mongo.js` | Create |
| `docker-compose.yml` | Create |
| `.env.example` | Create |
| `.gitignore` | Modify — add `.env` |
| `Makefile` | Modify — add mongo targets |
| `package.json` | Modify — add `mongodb`, `mongodb-memory-server`, `supertest` |
| `src/__tests__/db.test.js` | Create |
| `src/__tests__/server.test.js` | Create |
| `src/__tests__/server.integration.test.js` | Create |
| `data/*.json` | Keep as migration source; not used after migration |
