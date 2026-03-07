import { describe, it, expect } from 'vitest';
import { computeWeeklyScore } from '../weeklyScoring';

const TODAY = '2026-03-06';
const YESTERDAY = '2026-03-05';

const fresh = (overrides = {}) => ({
  wordsCorrect: [],
  completed: false,
  creditsEarned: 0,
  lastDailyReward: null,
  ...overrides,
});

// result helpers
const ok1 = (word) => ({ word, correct: true,  attemptNumber: 1 });
const ok2 = (word) => ({ word, correct: true,  attemptNumber: 2 });
const bad  = (word) => ({ word, correct: false, attemptNumber: 3 });

// ── Correct word credits (0.5 per word) ──────────────────────────────────────
describe('correct word credits', () => {
  it('awards 0.5 per new correct word regardless of attempt number', () => {
    const { earned, breakdown } = computeWeeklyScore(fresh(), [ok1('cat'), ok2('dog')], TODAY, 3);
    expect(breakdown.correctCount).toBe(2);
    expect(breakdown.correct).toBe(1);
    expect(earned).toBe(1);
  });

  it('awards no credit for wrong answers', () => {
    const { earned } = computeWeeklyScore(fresh(), [bad('cat'), bad('dog')], TODAY, 2);
    expect(earned).toBe(0);
  });

  it('skips words already in wordsCorrect', () => {
    const prev = fresh({ wordsCorrect: ['cat'] });
    const { breakdown } = computeWeeklyScore(prev, [ok1('cat'), ok1('dog')], TODAY, 3);
    expect(breakdown.correctCount).toBe(1); // only dog is new
    expect(breakdown.correct).toBe(0.5);
  });

  it('accumulates wordsCorrect across runs', () => {
    const prev = fresh({ wordsCorrect: ['cat'] });
    const { updated } = computeWeeklyScore(prev, [ok2('dog')], TODAY, 3);
    expect(updated.wordsCorrect).toContain('cat');
    expect(updated.wordsCorrect).toContain('dog');
  });
});

// ── All words completed bonus (+3) ──────────────────────────────────────────
describe('all words completed bonus', () => {
  it('awards +3 when all words become correct in one run', () => {
    const { breakdown, earned } = computeWeeklyScore(fresh(), [ok1('cat'), ok2('dog')], TODAY, 2);
    expect(breakdown.allCompleted).toBe(3);
    expect(earned).toBe(1 + 3); // 0.5*2 correct + 3 completed
  });

  it('awards +3 when last missing word is completed across sessions', () => {
    const prev = fresh({ wordsCorrect: ['cat'] });
    const { breakdown, earned } = computeWeeklyScore(prev, [ok2('dog')], TODAY, 2);
    expect(breakdown.allCompleted).toBe(3);
    expect(earned).toBe(0.5 + 3);
  });

  it('does not award bonus again if already completed', () => {
    const prev = fresh({ completed: true, wordsCorrect: ['cat', 'dog'] });
    const { breakdown } = computeWeeklyScore(prev, [ok1('cat'), ok1('dog')], TODAY, 2);
    expect(breakdown.allCompleted).toBe(0);
  });

  it('does not award bonus if not all words are correct', () => {
    const { breakdown } = computeWeeklyScore(fresh(), [ok1('cat'), bad('dog')], TODAY, 2);
    expect(breakdown.allCompleted).toBe(0);
  });

  it('does not award bonus if only some words completed so far', () => {
    const { breakdown } = computeWeeklyScore(fresh(), [ok1('cat')], TODAY, 3);
    expect(breakdown.allCompleted).toBe(0);
  });
});

// ── Daily replay bonus (+2) ───────────────────────────────────────────────────
describe('daily replay bonus', () => {
  it('awards +2 if completed before, all correct, not yet claimed today', () => {
    const prev = fresh({ completed: true, lastDailyReward: YESTERDAY });
    const { breakdown, earned } = computeWeeklyScore(prev, [ok1('cat'), ok2('dog')], TODAY, 2);
    expect(breakdown.daily).toBe(2);
    expect(earned).toBeGreaterThanOrEqual(2);
  });

  it('does not award daily on the very first completion', () => {
    const { breakdown } = computeWeeklyScore(fresh(), [ok1('cat'), ok1('dog')], TODAY, 2);
    expect(breakdown.daily).toBe(0);
  });

  it('sets lastDailyReward to today on first completion to prevent same-day replay bonus', () => {
    const { updated } = computeWeeklyScore(fresh(), [ok1('cat'), ok1('dog')], TODAY, 2);
    expect(updated.lastDailyReward).toBe(TODAY);
  });

  it('does not award daily if already claimed today', () => {
    const prev = fresh({ completed: true, lastDailyReward: TODAY });
    const { breakdown } = computeWeeklyScore(prev, [ok1('cat')], TODAY, 2);
    expect(breakdown.daily).toBe(0);
  });

  it('does not award daily if not all correct', () => {
    const prev = fresh({ completed: true, lastDailyReward: YESTERDAY });
    const { breakdown } = computeWeeklyScore(prev, [ok1('cat'), bad('dog')], TODAY, 2);
    expect(breakdown.daily).toBe(0);
  });

  it('sets lastDailyReward to today after claiming', () => {
    const prev = fresh({ completed: true, lastDailyReward: YESTERDAY });
    const { updated } = computeWeeklyScore(prev, [ok1('cat')], TODAY, 2);
    expect(updated.lastDailyReward).toBe(TODAY);
  });

  it('does not update lastDailyReward if daily not earned', () => {
    const prev = fresh({ completed: true, lastDailyReward: TODAY });
    const { updated } = computeWeeklyScore(prev, [ok1('cat')], TODAY, 2);
    expect(updated.lastDailyReward).toBe(TODAY);
  });
});

// ── State updates ─────────────────────────────────────────────────────────────
describe('state updates', () => {
  it('marks completed when all words are correct', () => {
    const { updated } = computeWeeklyScore(fresh(), [ok1('cat'), ok2('dog')], TODAY, 2);
    expect(updated.completed).toBe(true);
  });

  it('does not mark completed when only some words are correct', () => {
    const { updated } = computeWeeklyScore(fresh(), [ok1('cat'), bad('dog')], TODAY, 2);
    expect(updated.completed).toBe(false);
  });

  it('marks completed across multiple sessions', () => {
    const prev = fresh({ wordsCorrect: ['cat'] });
    const { updated } = computeWeeklyScore(prev, [ok2('dog')], TODAY, 2);
    expect(updated.completed).toBe(true);
  });

  it('keeps completed true on subsequent runs', () => {
    const prev = fresh({ completed: true });
    const { updated } = computeWeeklyScore(prev, [bad('cat')], TODAY, 2);
    expect(updated.completed).toBe(true);
  });

  it('accumulates creditsEarned across runs', () => {
    const prev = fresh({ creditsEarned: 2 });
    const { updated } = computeWeeklyScore(prev, [ok1('cat'), bad('dog')], TODAY, 2);
    expect(updated.creditsEarned).toBe(2 + 0.5);
  });

  it('returns zero earned with no results', () => {
    const { earned } = computeWeeklyScore(fresh(), [], TODAY, 2);
    expect(earned).toBe(0);
  });
});

// ── Combined scenario ─────────────────────────────────────────────────────────
describe('combined scenario', () => {
  it('correctly combines daily bonus on a replay after completion', () => {
    const prev = {
      wordsCorrect: ['cat', 'dog'],
      completed: true,
      creditsEarned: 4,
      lastDailyReward: YESTERDAY,
    };
    const results = [ok1('cat'), ok1('dog')];
    const { earned, breakdown, updated } = computeWeeklyScore(prev, results, TODAY, 2);

    expect(breakdown.correctCount).toBe(0);
    expect(breakdown.correct).toBe(0);
    expect(breakdown.allCompleted).toBe(0);
    expect(breakdown.daily).toBe(2);
    expect(earned).toBe(2);
    expect(updated.creditsEarned).toBe(6);
    expect(updated.lastDailyReward).toBe(TODAY);
  });
});
