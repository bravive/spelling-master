import { describe, it, expect } from 'vitest';
import { computeWeeklyScore } from '../weeklyScoring';

const TODAY = '2026-03-06';
const YESTERDAY = '2026-03-05';

const fresh = (overrides = {}) => ({
  firstAttemptCorrect: [],
  completed: false,
  perfectRun: false,
  creditsEarned: 0,
  lastDailyReward: null,
  ...overrides,
});

// result helpers
const ok1 = (word) => ({ word, correct: true,  attemptNumber: 1 });
const ok2 = (word) => ({ word, correct: true,  attemptNumber: 2 });
const bad  = (word) => ({ word, correct: false, attemptNumber: 3 });

// ── First-attempt credits (0.5 per word) ─────────────────────────────────────
describe('first-attempt credits', () => {
  it('awards 0.5 per new first-try correct word', () => {
    // Use ok2 for second word so perfect run bonus is not triggered
    const { earned, breakdown } = computeWeeklyScore(fresh(), [ok1('cat'), ok2('dog')], TODAY);
    expect(breakdown.firstAttemptCount).toBe(1);
    expect(breakdown.firstAttempt).toBe(0.5);
    expect(earned).toBe(0.5);
  });

  it('awards no credit for wrong answers', () => {
    const { earned } = computeWeeklyScore(fresh(), [bad('cat'), bad('dog')], TODAY);
    expect(earned).toBe(0);
  });

  it('awards no credit for correct on attempt > 1', () => {
    const { earned } = computeWeeklyScore(fresh(), [ok2('cat')], TODAY);
    expect(earned).toBe(0);
  });

  it('skips words already in firstAttemptCorrect', () => {
    const prev = fresh({ firstAttemptCorrect: ['cat'] });
    const { breakdown } = computeWeeklyScore(prev, [ok1('cat'), ok1('dog')], TODAY);
    expect(breakdown.firstAttemptCount).toBe(1); // only dog is new
    expect(breakdown.firstAttempt).toBe(0.5);
  });

  it('accumulates firstAttemptCorrect across runs', () => {
    const prev = fresh({ firstAttemptCorrect: ['cat'] });
    const { updated } = computeWeeklyScore(prev, [ok1('dog')], TODAY);
    expect(updated.firstAttemptCorrect).toContain('cat');
    expect(updated.firstAttemptCorrect).toContain('dog');
  });
});

// ── Perfect run bonus (+3) ────────────────────────────────────────────────────
describe('perfect run bonus', () => {
  it('awards +3 when all words correct on first attempt', () => {
    const { breakdown, earned } = computeWeeklyScore(fresh(), [ok1('cat'), ok1('dog')], TODAY);
    expect(breakdown.perfect).toBe(3);
    expect(earned).toBe(1 + 3); // 0.5*2 first-attempt + 3 perfect
  });

  it('does not award perfect bonus again if already earned', () => {
    const prev = fresh({ perfectRun: true });
    const { breakdown } = computeWeeklyScore(prev, [ok1('cat'), ok1('dog')], TODAY);
    expect(breakdown.perfect).toBe(0);
  });

  it('does not award perfect bonus if any word is wrong', () => {
    const { breakdown } = computeWeeklyScore(fresh(), [ok1('cat'), bad('dog')], TODAY);
    expect(breakdown.perfect).toBe(0);
  });

  it('does not award perfect bonus if any word needed more than 1 attempt', () => {
    const { breakdown } = computeWeeklyScore(fresh(), [ok1('cat'), ok2('dog')], TODAY);
    expect(breakdown.perfect).toBe(0);
  });

  it('persists perfectRun flag even on later imperfect runs', () => {
    const prev = fresh({ perfectRun: true });
    const { updated } = computeWeeklyScore(prev, [ok1('cat'), bad('dog')], TODAY);
    expect(updated.perfectRun).toBe(true);
  });
});

// ── Daily replay bonus (+2) ───────────────────────────────────────────────────
describe('daily replay bonus', () => {
  it('awards +2 if completed before, all correct, not yet claimed today', () => {
    const prev = fresh({ completed: true, lastDailyReward: YESTERDAY });
    const { breakdown, earned } = computeWeeklyScore(prev, [ok1('cat'), ok2('dog')], TODAY);
    expect(breakdown.daily).toBe(2);
    expect(earned).toBeGreaterThanOrEqual(2);
  });

  it('does not award daily on the very first completion', () => {
    // completed was false → daily requires prev.completed === true
    const { breakdown } = computeWeeklyScore(fresh(), [ok1('cat')], TODAY);
    expect(breakdown.daily).toBe(0);
  });

  it('does not award daily if already claimed today', () => {
    const prev = fresh({ completed: true, lastDailyReward: TODAY });
    const { breakdown } = computeWeeklyScore(prev, [ok1('cat')], TODAY);
    expect(breakdown.daily).toBe(0);
  });

  it('does not award daily if not all correct', () => {
    const prev = fresh({ completed: true, lastDailyReward: YESTERDAY });
    const { breakdown } = computeWeeklyScore(prev, [ok1('cat'), bad('dog')], TODAY);
    expect(breakdown.daily).toBe(0);
  });

  it('sets lastDailyReward to today after claiming', () => {
    const prev = fresh({ completed: true, lastDailyReward: YESTERDAY });
    const { updated } = computeWeeklyScore(prev, [ok1('cat')], TODAY);
    expect(updated.lastDailyReward).toBe(TODAY);
  });

  it('does not update lastDailyReward if daily not earned', () => {
    const prev = fresh({ completed: true, lastDailyReward: TODAY });
    const { updated } = computeWeeklyScore(prev, [ok1('cat')], TODAY);
    expect(updated.lastDailyReward).toBe(TODAY);
  });
});

// ── State updates ─────────────────────────────────────────────────────────────
describe('state updates', () => {
  it('marks completed after first run', () => {
    const { updated } = computeWeeklyScore(fresh(), [ok1('cat')], TODAY);
    expect(updated.completed).toBe(true);
  });

  it('keeps completed true on subsequent runs', () => {
    const prev = fresh({ completed: true });
    const { updated } = computeWeeklyScore(prev, [bad('cat')], TODAY);
    expect(updated.completed).toBe(true);
  });

  it('accumulates creditsEarned across runs', () => {
    // one correct on first attempt, one wrong — avoids perfect run bonus
    const prev = fresh({ creditsEarned: 2 });
    const { updated } = computeWeeklyScore(prev, [ok1('cat'), bad('dog')], TODAY);
    expect(updated.creditsEarned).toBe(2 + 0.5);
  });

  it('returns zero earned with no results', () => {
    const { earned } = computeWeeklyScore(fresh(), [], TODAY);
    expect(earned).toBe(0);
  });
});

// ── Combined scenario ─────────────────────────────────────────────────────────
describe('combined scenario', () => {
  it('correctly combines all three bonuses on a replay after a perfect first run', () => {
    // Previous state: completed with a perfect run, last daily reward was yesterday
    const prev = {
      firstAttemptCorrect: ['cat', 'dog'],
      completed: true,
      perfectRun: true,
      creditsEarned: 4,
      lastDailyReward: YESTERDAY,
    };
    // New run: all correct, both already in firstAttemptCorrect (no new first-attempt credits)
    const results = [ok1('cat'), ok1('dog')];
    const { earned, breakdown, updated } = computeWeeklyScore(prev, results, TODAY);

    expect(breakdown.firstAttemptCount).toBe(0);
    expect(breakdown.firstAttempt).toBe(0);
    expect(breakdown.perfect).toBe(0); // already earned
    expect(breakdown.daily).toBe(2);
    expect(earned).toBe(2);
    expect(updated.creditsEarned).toBe(6);
    expect(updated.lastDailyReward).toBe(TODAY);
  });
});
