# Spell Master

A daily spelling practice web app for elementary school kids (K–5). Kids memorise words, listen to them spoken aloud, then type the spelling. Progress is rewarded with a Pokémon collection system.

---

## Features

### User Profiles & Authentication
- Multiple user profiles with avatars, names, and 4-digit PINs
- PINs are **bcrypt-hashed** on the server — never stored in plaintext
- Login is validated server-side; a signed **JWT** (8-hour expiry) is issued on success
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
- On-screen letter buttons + full physical keyboard support
- 3 attempts per word: correct earns praise, wrong clears the input, third wrong reveals the answer
- Progress tracker shows checkmarks, crosses, current word, and remaining words

### Scoring & Credits
- 10/10 → 5 credits, 9/10 → 3 credits, 8/10 → 2 credits, 7–6/10 → 0 credits
- Score below 6 triggers an automatic retry
- Streak bonus: every 3-day consecutive streak awards +1 bonus credit
- Results screen shows per-word pass/fail, credits earned, and options to retry or pick a new group

### Pokémon Collection
- 10 credits unlock the next Pokémon in Pokédex order
- After every 3 consecutive regular unlocks, a 50% shiny chance activates for the next unlock
- Trophy modal with animated Pokémon reveal, confetti, and voice announcement
- Collection page shows all 60 Pokémon (grey silhouette until caught, purple shimmer for shinies)

### Adaptive Difficulty
- 5 word levels (CVC words up to academic vocabulary)
- Struggling words get higher selection weight; mastered words get lower weight
- Level up automatically when 70% of the current level's words are mastered

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

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | `dev-secret-change-in-production` | Secret for signing JWTs — **must be set in production** |
| `ADMIN_PIN` | `0000` | PIN for the admin (`test`) account |
| `PORT` | `3001` | Port for the Express API server |

### Install & Run

```bash
# Install dependencies
npm install

# Start both backend (port 3001) and frontend (port 5173)
npm start        # production mode (serves built dist/)

# Or for development:
npm run server   # Express API only
npm run dev      # Vite dev server only (proxies /api to :3001)
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
server.js        — Express API (auth, user CRUD, static file serving)
data/
  users.json     — Persistent user storage (gitignored)
src/
  App.jsx        — Main app — all screens, logic, and state
  main.jsx       — React entry point
  data/
    words.js     — Word bank (5 levels, each with word + example sentence)
    pokemon.js   — 60-Pokémon roster with image URL helpers
  __tests__/
    auth.test.js — Unit tests for PIN hashing, JWT, and auth helpers
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users` | None | Public profile list (no PINs) |
| `POST` | `/api/auth/login` | None (rate limited) | Validate PIN, return JWT |
| `POST` | `/api/users` | None | Create new user profile |
| `PUT` | `/api/users/:id` | JWT (own user or admin) | Save game state |
| `DELETE` | `/api/users/:id` | JWT (admin only) | Delete a profile |
