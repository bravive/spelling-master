/**
 * Pure function: compute credits and updated state for one weekly challenge run.
 *
 * @param {object} prev     - existing progress for this week:
 *   { firstAttemptCorrect: string[], completed: bool, perfectRun: bool, creditsEarned: number, lastDailyReward: string|null }
 * @param {Array}  results  - [{ word: string, correct: bool, attemptNumber: number }]
 * @param {string} today    - YYYY-MM-DD
 * @returns {{ earned: number, breakdown: object, updated: object }}
 */
export const computeWeeklyScore = (prev, results, today) => {
  const prevFirst = new Set(prev.firstAttemptCorrect || []);
  const newFirstCorrect = results
    .filter(r => r.correct && r.attemptNumber === 1 && !prevFirst.has(r.word))
    .map(r => r.word);

  let earned = 0;
  const breakdown = { firstAttempt: 0, firstAttemptCount: 0, perfect: 0, daily: 0 };

  // 0.5 credits per new first-attempt correct word
  breakdown.firstAttemptCount = newFirstCorrect.length;
  breakdown.firstAttempt = newFirstCorrect.length * 0.5;
  earned += breakdown.firstAttempt;

  const allFirstCorrect = [...prevFirst, ...newFirstCorrect];

  // +3 perfect run bonus — only once
  const allCorrectFirstTry = results.length > 0 && results.every(r => r.correct && r.attemptNumber === 1);
  if (allCorrectFirstTry && !prev.perfectRun) {
    breakdown.perfect = 3;
    earned += 3;
  }

  const completed = prev.completed || results.length > 0;
  const allCorrect = results.length > 0 && results.every(r => r.correct);

  // +2 daily replay — only if already completed, all correct, not yet claimed today
  if (prev.completed && allCorrect && prev.lastDailyReward !== today) {
    breakdown.daily = 2;
    earned += 2;
  }

  const updated = {
    firstAttemptCorrect: allFirstCorrect,
    completed,
    perfectRun: prev.perfectRun || allCorrectFirstTry,
    creditsEarned: (prev.creditsEarned || 0) + earned,
    lastDailyReward: breakdown.daily > 0 ? today : prev.lastDailyReward,
  };

  return { earned, breakdown, updated };
};
