/**
 * Pure function: compute credits and updated state for one weekly challenge run.
 *
 * @param {object} prev       - existing progress for this week
 * @param {Array}  results    - [{ word: string, correct: bool, attemptNumber: number }]
 * @param {string} today      - YYYY-MM-DD
 * @param {number} totalWords - total number of words in this week's list
 * @returns {{ earned: number, breakdown: object, updated: object }}
 */
export const computeWeeklyScore = (prev, results, today, totalWords) => {
  const prevCorrect = new Set(prev.wordsCorrect || []);
  const newCorrect = results
    .filter(r => r.correct && !prevCorrect.has(r.word))
    .map(r => r.word);

  let earned = 0;
  const breakdown = { correct: 0, correctCount: 0, allCompleted: 0, daily: 0 };

  // 0.5 credits per new correct word
  breakdown.correctCount = newCorrect.length;
  breakdown.correct = newCorrect.length * 0.5;
  earned += breakdown.correct;

  const allCorrectWords = [...prevCorrect, ...newCorrect];

  // +3 all-words-completed bonus — awarded once when every word has been correct
  const nowCompleted = allCorrectWords.length >= totalWords;
  const completed = prev.completed || nowCompleted;
  if (nowCompleted && !prev.completed) {
    breakdown.allCompleted = 3;
    earned += 3;
  }

  const allCorrect = results.length > 0 && results.every(r => r.correct);

  // +2 daily replay — only if already completed, all correct, not yet claimed today
  if (prev.completed && allCorrect && prev.lastDailyReward !== today) {
    breakdown.daily = 2;
    earned += 2;
  }

  // Set lastDailyReward to today on first completion (no daily bonus that day)
  // or when daily bonus is earned
  let lastDailyReward = prev.lastDailyReward;
  if (breakdown.daily > 0) lastDailyReward = today;
  else if (nowCompleted && !prev.completed) lastDailyReward = today;

  const updated = {
    wordsCorrect: allCorrectWords,
    completed,
    creditsEarned: (prev.creditsEarned || 0) + earned,
    lastDailyReward,
  };

  return { earned, breakdown, updated };
};
