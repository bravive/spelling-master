# Spell Master

A daily spelling practice web app for elementary school kids (K–5). Kids memorise words, listen to them spoken aloud, then type the spelling. Progress is rewarded with a Pokémon collection system.

---

## Features

### User Profiles & Authentication
- Multiple user profiles with avatars, names, and 4-digit PINs
- Create profile flow: pick a name, choose a starter Pokémon, set a PIN
- Admin account (`test` / `0000`) can delete non-admin profiles

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
| `react` ^19.2 | UI framework |
| `react-dom` ^19.2 | DOM rendering |
| `vite` ^7.3 | Dev server and build tool |
| `@vitejs/plugin-react` ^5.1 | React Fast Refresh and JSX transform |
| `eslint` ^9.39 | Linting |
| `eslint-plugin-react-hooks` ^7.0 | React hooks lint rules |
| `eslint-plugin-react-refresh` ^0.4 | Vite HMR lint rules |

**Browser APIs used (no npm packages):**
- `window.speechSynthesis` — text-to-speech for word pronunciation
- `localStorage` — persists all user profiles and progress (key: `spellmaster_v3`)

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Install & Run

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open your browser at **http://localhost:5173**

### Other Commands

```bash
npm run build    # Production build (outputs to dist/)
npm run preview  # Preview the production build locally
npm run lint     # Run ESLint
```

---

## Project Structure

```
src/
  App.jsx          # Main app — all screens, logic, and state
  main.jsx         # React entry point
  data/
    words.js       # Word bank (5 levels, each with word + example sentence)
    pokemon.js     # 60-Pokémon roster with image URL helpers
```

All data is stored client-side in `localStorage`. There is no backend.
