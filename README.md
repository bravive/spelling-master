# Spell Master

A daily spelling practice web app for elementary school kids (K–5). Kids memorise words, listen to them spoken aloud, then type the spelling. Progress is rewarded with a Pokémon collection system.

---

## Features

### User Profiles & Authentication
- Multiple user profiles with avatars, names, and 4-digit PINs
- PINs are **bcrypt-hashed** on the server — never stored in plaintext
- Login is validated server-side; a signed **JWT** (8-hour expiry by default, 30-day if "Keep me logged in" is checked) is issued on success
- All game-data saves require a valid JWT (`Authorization: Bearer <token>`)
- Rate limiting: max 10 login attempts per IP per 15 minutes
- Admin account (`test` / PIN set via `ADMIN_PIN` env var, default `0000`) can delete non-admin profiles
- Create profile flow: pick a name, choose a starter Pokémon, set a PIN

### Game Flow

**Stage 1 — Remember**
- All 10 words shown simultaneously in a 2-column grid with example sentences
- 3-minute study timer with colour-coded progress bar (green → yellow → red)
- "I'm Ready!" button to advance early; auto-advances at 3:00

**Stage 2 — Listen & Spell**
- Words are hidden; the app picks a random unplayed word and reads it aloud automatically (3×)
- Unlimited replay via button
- On-screen QWERTY keyboard (matches physical keyboard layout) + full physical keyboard support
- 3 attempts per word: correct earns praise, wrong clears the input, third wrong reveals the answer
- Progress tracker shows checkmarks, crosses, current word, and remaining words

### Scoring & Credits
- 10/10 → 5 credits, 9/10 → 3 credits, 8/10 → 2 credits, 7–6/10 → 0 credits
- Score below 6 triggers an automatic retry
- Streak bonus: every 3-day consecutive streak awards +5 bonus credits
- Results screen shows per-word pass/fail, credits earned, and options to retry or pick a new group

### Pokémon Collection
- 10 credits unlock the next Pokémon in Pokédex order
- After every 3 consecutive regular unlocks, a shiny chance activates — the next unlock also awards a rare shiny version
- Trophy modal with animated Pokémon reveal, confetti, and voice announcement
- Collection page shows all 60 Pokémon (grey silhouette until caught, purple shimmer for shinies)
- Pokémon stats sourced from [PokémonDB Pokédex](https://pokemondb.net/pokedex)

### Adaptive Difficulty
- 5 word levels (CVC words up to academic vocabulary)
- Struggling words get higher selection weight; mastered words get lower weight
- Level up automatically when 70% of the current level's words are mastered
- Word lists sourced from [Reading Rockets Basic Spelling Vocabulary List](https://www.readingrockets.org/topics/writing/articles/basic-spelling-vocabulary-list)

### Weekly Words Challenge
- Manually curated weekly word lists that unlock on a schedule (every Monday)
- Kids can practice the current week's list plus all previous weeks
- **First-time scoring**: 0.5 credits per word spelled correctly on the first attempt
- **Perfect bonus**: All words correct on first attempt in a single run = +3 bonus credits
- **Daily replay**: After completing a list, earn 2 credits/day by getting all words correct in one run (once per list per day)
- Credits from weekly challenges count toward Pokémon unlocks

### Stats Page
- 30-day streak calendar
- Recent round history (date, score, credits, pass/fail)
- Summary badges: total rounds, mastered words, Pokémon caught
- Mastered word chip list

---

## Dependencies

| Package | Role |
|---|---|
| `express` ^5.2 | REST API server |
| `bcryptjs` ^3.0 | PIN hashing |
| `jsonwebtoken` ^9.0 | JWT authentication |
| `express-rate-limit` ^8.3 | Login rate limiting |
| `react` ^19.2 | UI framework |
| `react-dom` ^19.2 | DOM rendering |
| `vite` ^7.3 | Dev server and build tool |
| `@vitejs/plugin-react` ^5.1 | React Fast Refresh and JSX transform |
| `vitest` ^4.0 | Unit tests |
| `eslint` ^9.39 | Linting |

**Browser APIs used:**
- `window.speechSynthesis` — text-to-speech for word pronunciation
- `localStorage` — stores JWT and current user ID for session persistence

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URL` | **Yes** | _(none)_ | Full MongoDB connection string (e.g. `mongodb://user:pass@host:27017/dbname`) |
| `JWT_SECRET` | **Yes in production** | `dev-secret-do-not-use-in-production` | Secret for signing JWTs — server refuses to start in production without this |
| `ADMIN_PIN` | No | `0000` | PIN for the admin (`test`) account |
| `PORT` | No | `3001` | Port for the Express API server |
| `NODE_ENV` | No | _(unset)_ | Set to `production` to enable static file serving and enforce `JWT_SECRET` |

### Install & Run

```bash
# Install dependencies
npm install

# Development (backend on :3001, frontend on :5173 with hot reload)
npm run dev:full   # both together
# or separately:
npm run server     # Express API only
npm run dev        # Vite dev server only (proxies /api to :3001)

# Production (build first, then serve everything from Express on :3001)
npm run build
npm start
```

Open your browser at **http://localhost:5173** (dev) or **http://localhost:3001** (production)

### Other Commands

```bash
npm test         # Run unit tests (Vitest)
npm run build    # Production build (outputs to dist/)
npm run preview  # Preview the production build locally
npm run lint     # Run ESLint
```

---

## Project Structure

```
server.js        — Express API (auth, user CRUD, collection, static file serving)
src/
  App.jsx        — Root component — state management, routing, round processing
  shared.js      — Shared constants, styles, speech helpers, date utilities
  main.jsx       — React entry point
  wordSelection.js — Word selection, stats tracking, level-up logic
  components/
    Confetti.jsx         — Confetti animation overlay
    TrophyModal.jsx      — Pokémon unlock celebration modal
    NumPad.jsx           — 4-digit PIN input pad
    RulesModal.jsx       — Kid-friendly rules explanation modal
    SelectUserScreen.jsx — User profile selection
    LoginScreen.jsx      — PIN login
    AdminLoginScreen.jsx — Admin login
    ParentMenuScreen.jsx — Admin panel
    CreateUserScreen.jsx — 4-step profile creation
    HomeScreen.jsx       — Main dashboard
    Stage1Screen.jsx     — Word memorization stage
    Stage2Screen.jsx     — Spelling/typing stage
    ResultsScreen.jsx    — Round results
    CollectionScreen.jsx — Pokémon collection grid + detail overlay
    StatsScreen.jsx      — User stats & streak calendar
  data/
    words.js     — Word bank (5 levels, each with word + example sentence)
    pokemon.js   — 60-Pokémon roster with image URL helpers
  __tests__/
    auth.test.js                   — PIN hashing, JWT, and auth helpers
    authFetch.test.js              — makeAuthFetch 401 redirect behaviour
    db.test.js                     — MongoDB connection and resolveMongoUri
    server.integration.test.js     — Integration tests for all REST API endpoints
    server.production.test.js      — Production static-file serving
    weeklyScoring.test.js          — Weekly challenge credit scoring logic
    weeklyChallengeScreen.test.js  — Week selection / initial week resolution
    wordSelection.test.js          — Word selection, stats, and level-up logic
```

## Deploying to Railway

1. **Connect your repo** — create a new Railway project and link the GitHub repo.

2. **Add a MongoDB database** — Railway dashboard → your project → "New" → "Database" → "MongoDB".
   Railway provisions the database and makes its connection variables available for reference.

3. **Set these variables** in the Railway web service → Variables:

   | Variable | Value |
   |---|---|
   | `MONGO_URL` | `${{MongoDB.MONGO_URL}}` |
   | `JWT_SECRET` | A long random string (`openssl rand -base64 32`) |
   | `ADMIN_PIN` | Your chosen admin PIN (default `0000`) |
   | `NODE_ENV` | `production` |

   Railway sets `PORT` automatically — do not override it.

4. **Deploy** — Railway auto-detects the `build` and `start` scripts:
   - Build: `npm run build` (compiles React to `dist/`)
   - Start: `npm start` (`NODE_ENV=production node server.js` — serves API + static files)

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users` | None | Public profile list (no PINs) |
| `POST` | `/api/auth/login` | None (rate limited) | Validate PIN, return JWT |
| `POST` | `/api/users` | None | Create new user profile |
| `PUT` | `/api/users/me` | JWT | Save game state for current user (derived from token) |
| `DELETE` | `/api/users/:id` | JWT (admin only) | Delete a profile |
| `GET` | `/api/trophy` | JWT | Get current user's Pokémon trophy data |
| `PUT` | `/api/trophy` | JWT | Save current user's Pokémon trophy data |
| `GET` | `/api/wordstats` | JWT | Get current user's word performance stats |
| `PUT` | `/api/wordstats` | JWT | Save current user's word performance stats |
| `GET` | `/api/roundhistory` | JWT | Get current user's round history and credit ledger |
| `PUT` | `/api/roundhistory` | JWT | Save current user's round history and credit ledger |
| `GET` | `/api/weekly-words` | None | All weekly challenge word lists |
| `GET` | `/api/weekly-stats` | JWT | Get current user's weekly challenge progress |
| `PUT` | `/api/weekly-stats/:weekId` | JWT | Save progress for a specific week |
| `GET` | `/ping` | None | Health check |
