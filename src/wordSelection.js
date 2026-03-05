import { WORD_POOL } from './data/words';

// ─── Word stat defaults ───────────────────────────────────────────────────────
const defaultStat = () => ({
  attempts: 0,
  correct: 0,
  consecutivePasses: 0,
  cooldownUntilRound: null,
  retired: false,
  weight: 1,
});

// ─── Cooldown / retirement rules ─────────────────────────────────────────────
// 1 consecutive pass   → skip next 2 rounds
// 3 consecutive passes → skip next 15 rounds
// 5 consecutive passes → retired permanently (never shown again)

const cooldownRounds = (consecutivePasses) => {
  if (consecutivePasses >= 3) return 15;
  if (consecutivePasses >= 1) return 2;
  return 0;
};

// ─── selectWords ─────────────────────────────────────────────────────────────
// Builds a pool from the current level (+ next level once 50% of current level
// words have been passed at least once), then picks 10 weighted-random words.

export const selectWords = (wordStats, level, roundCount) => {
  const currentPool = WORD_POOL[level] || WORD_POOL[1];

  // Mix in next level when half of current level words have ever been passed
  const everPassed = (w) => (wordStats[w]?.correct || 0) > 0;
  const passedCount = currentPool.filter((e) => everPassed(e.w)).length;
  const nextPool = (passedCount / currentPool.length >= 0.5 && WORD_POOL[level + 1]) ? WORD_POOL[level + 1] : [];
  let pool = [...currentPool, ...nextPool];

  const isRetired = (ws) => ws?.retired === true;
  const isOnCooldown = (ws) =>
    ws?.cooldownUntilRound != null && roundCount < ws.cooldownUntilRound;

  // Filter: exclude retired and on-cooldown
  let candidates = pool.filter((e) => {
    const ws = wordStats[e.w];
    return !isRetired(ws) && !isOnCooldown(ws);
  });

  // If fewer than 10 remain, relax cooldown (keep retirement filter)
  if (candidates.length < 10) {
    candidates = pool.filter((e) => !isRetired(wordStats[e.w]));
  }

  // Assign weights: struggling words appear more, well-known words appear less
  const weighted = candidates.map((e) => {
    const ws = wordStats[e.w];
    let weight = 1;
    if (ws && ws.attempts > 0) {
      const rate = ws.correct / ws.attempts;
      if (rate < 0.5) weight = Math.min(ws.weight, 5);       // struggling → up to 5×
      else if (ws.consecutivePasses >= 3) weight = 0.5;       // near-cooldown → 0.5×
      else if (ws.attempts >= 3 && rate >= 0.8) weight = 0.3; // well-known → 0.3×
    }
    return { ...e, weight };
  });

  // Weighted random sampling without replacement
  const used = new Set();
  const selected = [];
  const n = Math.min(10, weighted.length);

  while (selected.length < n && used.size < weighted.length) {
    const available = weighted.filter((e) => !used.has(e.w));
    const total = available.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const e of available) {
      r -= e.weight;
      if (r <= 0) { selected.push(e); used.add(e.w); break; }
    }
  }
  return selected;
};

// ─── updateWordStats ─────────────────────────────────────────────────────────
// Applied after each round. Returns a new wordStats object.

export const updateWordStats = (wordStats, results, newRoundCount) => {
  const updated = { ...wordStats };

  for (const r of results) {
    const ws = { ...defaultStat(), ...(updated[r.word] || {}) };
    ws.attempts += 1;

    if (r.correct) {
      ws.correct += 1;
      ws.consecutivePasses += 1;
      ws.weight = Math.max(0.3, ws.weight * 0.75);

      if (ws.consecutivePasses >= 5) {
        // Permanently retire
        ws.retired = true;
        ws.cooldownUntilRound = null;
      } else {
        ws.cooldownUntilRound = newRoundCount + cooldownRounds(ws.consecutivePasses);
      }
    } else {
      // Incorrect: reset consecutive streak, increase weight
      ws.consecutivePasses = 0;
      ws.cooldownUntilRound = null;
      ws.weight = Math.min(5, ws.weight * 1.6);
    }

    updated[r.word] = ws;
  }

  return updated;
};

// ─── checkLevelUp ────────────────────────────────────────────────────────────
// Advance level when 50% of current level words have been passed at least once.

export const checkLevelUp = (wordStats, level) => {
  const pool = WORD_POOL[level] || [];
  if (pool.length === 0 || level >= 5) return level;
  const passed = pool.filter((e) => (wordStats[e.w]?.correct || 0) > 0);
  if (passed.length / pool.length >= 0.5) return level + 1;
  return level;
};
