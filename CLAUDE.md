# Spell Master — Project Guide for Claude Code

## Development Workflow

Follow these steps for every change, no matter how small:

### 0. Plan before significant changes
- For any non-trivial feature, refactor, or migration, create a plan file under `claude-plan/` (e.g. `claude-plan/my-feature.md`) before writing code
- The plan should cover: goal, approach, affected files, schema/API changes, and test strategy
- Keep the plan file updated as decisions evolve; it serves as a reference for the feature branch

### 1. Commit each edit separately
- Make one focused commit per logical change (bug fix, feature, refactor, docs)
- Keep commit messages brief and descriptive (what + why)
- Stage only the files relevant to that change — never bulk-commit unrelated edits

### 2. Write tests for every change
- All new logic must have corresponding tests in `src/__tests__/`
- Run tests before committing: `npm test`
- Bug fixes must include a regression test
- Use Vitest (`npm test`) for unit tests; test pure logic functions (scoring, word selection, level-up, streak, Pokémon unlock) directly without a browser

### 3. Update README.md for feature or requirement changes
- Any change that affects how users interact with the app, the tech stack, or how to run it must be reflected in `README.md`
- Keep the README accurate — it is the source of truth for anyone setting up the project
- **Any new environment variable** added to `server.js` must be documented in both the "Environment Variables" table and the "Deploying to Railway" section of `README.md`, with its name, whether it is required in production, its default value, and a description

### 4. Restart server after backend changes
- After any change to `server.js`, run `make restart` to restart the Express server

### 5. Push after committing
- After each commit (or a small batch of related commits), push to `origin main`

---

## Project Overview

A daily spelling practice web app for elementary school kids (K–5). Kids memorise words, listen to them spoken aloud, then type the spelling. Progress is rewarded with a Pokémon collection system.

## Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: Inline styles only (no CSS framework)
- **Storage**: MongoDB (via Docker locally, Railway in production) — collections: `users`, `collections`, `wordstats`, `roundhistory`
- **Speech**: Web Speech API (`window.speechSynthesis`)
- **Images**: `https://img.pokemondb.net/sprites/home/normal/{slug}.png` (regular) and `.../shiny/{slug}.png` (shiny)
- **Backend**: Express (port 3001); Vite proxies `/api` to it

## File Structure

```
server.js        — Express API server (all routes; delegates DB ops to src/store.js)
src/
  db.js          — MongoDB connection, collection helpers, index setup
  store.js       — all DB interaction functions (users, collection, wordstats, roundhistory)
  App.jsx        — main app (all logic + screens)
  data/
    words.js     — word bank (5 levels, keys 1–5, each { w, s }[])
    pokemon.js   — 60 Pokémon roster, pkImg/pkShiny helpers
docker-compose.yml  — local MongoDB via Docker
scripts/
  migrate-to-mongo.js  — one-shot migration from old JSON files to MongoDB
```

## Running the App

```bash
npm install

# Start both backend and frontend together:
npm start        # backend on :3001, frontend on :5173

# Or separately:
npm run server   # Express API only
npm run dev      # Vite dev server only

npm run build
```

---

## Authentication & Profiles

- Login screen shows all profiles as cards (avatar, name, credits, streak, level)
- Any user can create a new profile (no admin required)
- **Admin account**: username `test`, PIN `0000` — can delete any non-admin profile
- Each profile: name, 4-digit PIN, starter Pokémon
- PIN entry: large numpad UI + physical keyboard number input
- On login, show user's starter Pokémon above PIN pad

### Create Profile Flow (4 steps)
1. Enter name
2. Pick starter Pokémon from grid of 9 options
3. Create 4-digit PIN
4. Confirm PIN → save → go to selectUser

---

## Game Flow — 2 Stages per Round

### Stage 1: Remember
- Show all 10 words simultaneously in a 2-column grid (word + sentence)
- Timer counts up 0:00 → 3:00
  - 0–1:00 → green bar ("Study time!")
  - 1:00–2:00 → yellow bar ("Take your time!")
  - 2:00–3:00 → red bar ("Almost at the limit!")
- "I'm Ready!" button to advance early; auto-advances at 3:00
- Speaks intro message on entry; shows retry count badge on retry

### Stage 2: Listen & Spell
- Words disappear; app picks random unplayed word
- Speaks word + sentence automatically 3 times
- Replay button (unlimited)
- On-screen letter buttons + physical keyboard (letters, Backspace, Enter)
- Hidden focused input captures keyboard at all times
- 3 attempts per word:
  - Correct → praise spoken, next word after 1.6s
  - Wrong (attempt 1 or 2) → "Not quite, try again!", clear after 1.3s
  - Wrong (attempt 3) → reveal correct spelling for 2.8s, then next word
- Progress dots: ✓/✗ for done, ? for current, number for upcoming

---

## Scoring & Credits

| Score | Credits |
|-------|---------|
| 10/10 | 5 cr   |
| 9/10  | 3 cr   |
| 8/10  | 2 cr   |
| 7–6/10| 0 cr   |
| <6/10 | 0 cr + auto-retry (back to Stage 1) |

- Pass threshold: score ≥ 6
- Streak bonus: every 3-day consecutive streak → +1 bonus credit
- Unlimited rounds per day

### Results Screen
- Score, credits earned, pass/fail badge
- Per-word result list (✅/❌)
- Buttons: Retry Group, New Group, Home

---

## Pokémon Collection System

- **10 credits = 1 Pokémon** unlocked in Pokédex order
- Credit progress bar (0–10) on home screen; next Pokémon as greyed silhouette

### Shiny System
- After every 3 consecutive regular Pokémon → shiny chance activates
- Next 10-credit unlock: 50% chance for bonus shiny
- Shiny = same Pokémon shiny variant, chosen randomly from collected (without shiny)
- Pulsing "✨ Shiny chance active!" banner on home screen when eligible

### Trophy Unlock Modal
- Full-screen overlay, animated Pokémon image (grow-in)
- Confetti explosion
- Voice: "Amazing! You caught [Name]!" or "Wow! You got a shiny [Name]! So rare!"
- "🎉 Awesome!" dismiss button; multiple unlocks show sequentially

---

## Adaptive Difficulty

- Words selected from current level's pool, weighted by past performance
- Struggling words (wrong) → weight ×1.6 (max 5)
- Mastered words (≥3 attempts, ≥80% correct) → weight ×0.75 (min 0.3)
- Level up: 70% of level's words mastered → advance to next level (max 5)

### Word Levels
- Level 1: CVC + Dolch pre-primer (cat, dog, hat…)
- Level 2: Blends, digraphs, Dolch Grade 1 (rain, jump, ship…)
- Level 3: Long vowels, Dolch Grade 2 (night, dream, friend…)
- Level 4: Multi-syllable, Dolch Grade 3 (between, careful, thought…)
- Level 5: Academic vocabulary (beautiful, discover, exercise…)

---

## Per-User Stats Page

- Summary badges: total rounds, mastered words, total caught
- 30-day streak calendar (green = played, gold border = today)
- Recent 8 rounds table (date, score, credits, pass/fail)
- Mastered words chip list (≥3 attempts, ≥80% correct)

---

## Collection Page

- Grid of all 60 Pokémon
- Uncollected → grey ❓
- Collected → full colour, bronze glow border
- Shiny → purple glow, shimmer animation, ✨ badge
- Counter: "X / 60 caught · Y ✨ shiny"

---

## User State Shape (stored in MongoDB)

```js
{
  name, pin, starterId, starterSlug,
  level: 1,
  totalCredits: 0,
  creditBank: 0,        // resets at 10
  streak: 0,
  lastPlayed: null,     // date string YYYY-MM-DD
  streakDates: [],      // last 90 days played
  collection: {},       // { [pokemonId]: { regular: bool, shiny: bool } }
  shinyEligible: false,
  consecutiveRegular: 0,
  wordStats: {},        // { [word]: { attempts, correct, weight } }
  roundHistory: [],     // last 200 rounds { date, score, earned, pass }
  bestScores: {},
  createdAt: ISO string
}
```

---

## Navigation State

- `screen`: `selectUser → login → parentMenu → createUser → game`
- `gameScreen` (within game): `home → stage1 → stage2 → results → collection → stats`

---

## UI / UX Conventions

- Dark purple gradient background: `linear-gradient(135deg, #0f0c29, #302b63, #24243e)`
- Colour palette: yellow `#fbbf24`, pink `#f472b6`, blue `#60a5fa`, green `#10b981`, red `#ef4444`, muted `#94a3b8`, purple `#c4b5fd`
- Card bg: `rgba(255,255,255,0.08)`, border: `rgba(255,255,255,0.12)`
- All styling via inline styles — no CSS classes or framework
- Mobile-friendly, touch-friendly button sizes
- Physical keyboard fully supported during spelling stage
- TTS via Web Speech API: rate 0.82, pitch 1.05
- CSS animations injected via `<style id="sm-styles">`: float, pulse, pop, popIn, shake, bounce, shimmer, sparkle, fall
- Confetti on perfect 10/10 round
- Logout button (🚪) on home screen

---

## Speech Helper

```js
const speakTimes = (text, times, onDone) => {
  window.speechSynthesis.cancel();
  let c = 0;
  const next = () => {
    if (c >= times) { onDone?.(); return; }
    c++;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.82; u.pitch = 1.05;
    u.onend = () => setTimeout(next, 700);
    window.speechSynthesis.speak(u);
  };
  next();
};
```
