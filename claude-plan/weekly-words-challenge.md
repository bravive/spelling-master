# Weekly Words Challenge — Implementation Plan

## Overview

A weekly spelling challenge where kids practice curated word lists that unlock on a schedule. Rewards first-time accuracy and daily mastery replays.

---

## Rules

1. **Weekly word lists** are manually curated and stored as data (e.g., `src/data/weekly-words.js`)
2. Each list has a **start date** (Monday of the target week). A list becomes available when the current date >= start date
3. Kids can practice **current week + all previous weeks** (never future weeks)
4. **First-time scoring**: 0.5 credits per word spelled correctly on the first attempt (attempt 1 of 3)
5. **Perfect bonus**: If ALL words in a weekly list are correct on first attempt in a single run, +3 bonus credits
6. **Daily replay scoring**: After a weekly list is fully completed (all words attempted at least once), the kid can earn 2 credits per day per weekly challenge by getting ALL words correct in a single run. The 2-credit reward is collected at most once per day per list.

---

## Data Model

### Weekly word list definition (`src/data/weekly-words.js`)

```js
export const WEEKLY_WORDS = [
  {
    id: 'w2026-10',           // unique id
    label: 'Week 10',         // display name
    startDate: '2026-03-09',  // Monday — list becomes available on this date
    words: [
      { w: 'apple', s: 'I ate an apple for lunch.' },
      { w: 'bread', s: 'She made fresh bread.' },
      // ... 8-12 words per list
    ],
  },
  // more weeks...
];
```

### Per-user weekly challenge state (stored in users.json via PUT /api/users/me)

```js
// Inside user object:
{
  weeklyProgress: {
    'w2026-10': {
      firstAttemptCorrect: ['apple', 'bread'],  // words correct on 1st attempt
      completed: false,                          // true when all words attempted
      perfectRun: false,                         // true if all correct on 1st attempt in one run
      creditsEarned: 5.5,                        // total credits earned from this list
      lastDailyReward: '2026-03-12',             // date string of last daily 2-credit claim
    },
  },
}
```

---

## Implementation Steps

### Phase 1: Data & Backend

1. **Create `src/data/weekly-words.js`** — export `WEEKLY_WORDS` array with initial word lists
2. **Extend user state** — add `weeklyProgress` field (default `{}`)
3. No new API endpoints needed — weekly progress saves via existing `PUT /api/users/me`

### Phase 2: UI — Weekly Challenge Screen

4. **New screen: `WeeklyChallengeScreen.jsx`**
   - Accessed from HomeScreen (new button alongside Stats/Collection)
   - Shows list of available weekly challenges (current week + past weeks)
   - Each card shows: week label, start date, word count, completion status, credits earned
   - Future weeks shown as locked (greyed out)
   - Tap a card to start that week's challenge

5. **Challenge flow** (reuses Stage 1 / Stage 2 pattern):
   - Stage 1: Show all words for memorization (same timer/UI as regular rounds)
   - Stage 2: Spell each word (same UI)
   - Key difference: track first-attempt accuracy per word
   - Results screen: show per-word results, credits breakdown (first-attempt bonuses + perfect bonus + daily replay)

### Phase 3: Scoring Logic

6. **`processWeeklyRound(weekId, results)`** function:
   - For each word correct on attempt 1: +0.5 credits (only if not already earned for this word)
   - If all words correct on first attempt in this run AND not previously achieved: +3 credits
   - If list already completed and all words correct in this run AND last daily reward != today: +2 credits
   - Update `weeklyProgress[weekId]` and save via `PUT /api/users/me`

### Phase 4: Navigation & Polish

7. **HomeScreen**: Add "Weekly Challenge" button
8. **RulesModal**: Add section explaining weekly challenge rules
9. **README.md**: Document the feature

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/data/weekly-words.js` | NEW — weekly word list definitions |
| `src/components/WeeklyChallengeScreen.jsx` | NEW — list of available challenges |
| `src/components/WeeklyStage1Screen.jsx` | NEW — memorization stage (or reuse Stage1Screen with props) |
| `src/components/WeeklyStage2Screen.jsx` | NEW — spelling stage with first-attempt tracking |
| `src/components/WeeklyResultsScreen.jsx` | NEW — results with credit breakdown |
| `src/components/HomeScreen.jsx` | Add Weekly Challenge button |
| `src/components/RulesModal.jsx` | Add weekly challenge rules section |
| `src/App.jsx` | Add weekly screens to routing, add processWeeklyRound |
| `README.md` | Document feature |

---

## Open Questions

- How many words per weekly list? (suggest 8-12)
   answer: it dosn't matter. the list will be put in a weekly file
- Should weekly challenge words also contribute to the regular adaptive difficulty word stats?
   answer: no
- Should weekly challenge credits count toward Pokemon unlocks? (assumed yes)
   answer: yes
