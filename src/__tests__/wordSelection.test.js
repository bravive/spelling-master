import { describe, it, expect } from 'vitest';
import { selectWords, updateWordStats, checkLevelUp } from '../wordSelection';
import { WORD_POOL } from '../data/words';

const LEVEL1 = WORD_POOL[1].map(e => e.w);

describe('selectWords', () => {
  it('returns up to 10 words from the level pool', () => {
    const result = selectWords({}, 1, 0);
    expect(result.length).toBe(10);
    result.forEach(w => expect(w).toHaveProperty('w'));
  });

  it('excludes words on cooldown', () => {
    // Put first 5 level-1 words on cooldown
    const wordStats = {};
    const cooldownWords = LEVEL1.slice(0, 5);
    cooldownWords.forEach(w => {
      wordStats[w] = { attempts: 1, correct: 1, weight: 0.75, consecutivePasses: 1, cooldownUntilRound: 10, retired: false };
    });
    const result = selectWords(wordStats, 1, 5);
    const selected = result.map(e => e.w);
    cooldownWords.forEach(w => expect(selected).not.toContain(w));
  });

  it('includes words once their cooldown has expired', () => {
    // Retire all level-1 words except exactly 10 so selection is deterministic
    const wordStats = {};
    const target = LEVEL1[0];
    // Retire all words past the first 10
    LEVEL1.slice(10).forEach(w => {
      wordStats[w] = { attempts: 5, correct: 0, weight: 5, consecutivePasses: 0, cooldownUntilRound: null, retired: true };
    });
    // target had cooldown until round 3; at roundCount=3 it expires (3 < 3 = false)
    wordStats[target] = { attempts: 1, correct: 1, weight: 0.75, consecutivePasses: 1, cooldownUntilRound: 3, retired: false };
    const result = selectWords(wordStats, 1, 3);
    // Only 10 eligible words → all must be selected
    expect(result.map(e => e.w)).toContain(target);
  });

  it('permanently excludes retired words', () => {
    const wordStats = {};
    // Retire all but 5 words in the pool
    const retiredWords = LEVEL1.slice(0, LEVEL1.length - 5);
    retiredWords.forEach(w => {
      wordStats[w] = { attempts: 5, correct: 0, weight: 5, consecutivePasses: 0, cooldownUntilRound: null, retired: true };
    });
    const result = selectWords(wordStats, 1, 0);
    const selected = result.map(e => e.w);
    retiredWords.forEach(w => expect(selected).not.toContain(w));
    expect(result.length).toBe(5);
  });

  it('relaxes cooldown when fewer than 10 words remain after filtering', () => {
    const wordStats = {};
    // Put enough words on cooldown to leave only 5 active
    LEVEL1.slice(0, LEVEL1.length - 5).forEach(w => {
      wordStats[w] = { attempts: 1, correct: 1, weight: 0.75, consecutivePasses: 1, cooldownUntilRound: 99, retired: false };
    });
    const result = selectWords(wordStats, 1, 0);
    expect(result.length).toBe(10);
  });
});

describe('updateWordStats', () => {
  it('increments attempts and correct on success', () => {
    const result = updateWordStats({}, [{ word: 'cat', correct: true }], 1);
    expect(result.cat.attempts).toBe(1);
    expect(result.cat.correct).toBe(1);
    expect(result.cat.consecutivePasses).toBe(1);
  });

  it('sets cooldown on correct answer', () => {
    const result = updateWordStats({}, [{ word: 'cat', correct: true }], 5);
    expect(result.cat.cooldownUntilRound).toBeGreaterThan(5);
  });

  it('resets consecutivePasses and clears cooldown on wrong answer', () => {
    const ws = { cat: { attempts: 2, correct: 2, consecutivePasses: 2, cooldownUntilRound: 10, retired: false, weight: 0.5 } };
    const result = updateWordStats(ws, [{ word: 'cat', correct: false }], 6);
    expect(result.cat.consecutivePasses).toBe(0);
    expect(result.cat.cooldownUntilRound).toBeNull();
  });

  it('retires a word after 5 consecutive passes', () => {
    const ws = { cat: { attempts: 4, correct: 4, consecutivePasses: 4, cooldownUntilRound: null, retired: false, weight: 0.3 } };
    const result = updateWordStats(ws, [{ word: 'cat', correct: true }], 10);
    expect(result.cat.retired).toBe(true);
    expect(result.cat.consecutivePasses).toBe(5);
  });
});

describe('checkLevelUp', () => {
  it('advances level when 50% of words have been passed at least once', () => {
    const wordStats = {};
    const half = Math.ceil(LEVEL1.length / 2);
    LEVEL1.slice(0, half).forEach(w => {
      wordStats[w] = { attempts: 1, correct: 1, consecutivePasses: 1, retired: false, weight: 0.75, cooldownUntilRound: null };
    });
    expect(checkLevelUp(wordStats, 1)).toBe(2);
  });

  it('does not advance when fewer than 50% passed', () => {
    const wordStats = {};
    const lessThanHalf = Math.floor(LEVEL1.length / 2) - 1;
    LEVEL1.slice(0, lessThanHalf).forEach(w => {
      wordStats[w] = { attempts: 1, correct: 1, consecutivePasses: 1, retired: false, weight: 0.75, cooldownUntilRound: null };
    });
    expect(checkLevelUp(wordStats, 1)).toBe(1);
  });

  it('does not advance beyond level 5', () => {
    expect(checkLevelUp({}, 5)).toBe(5);
  });
});
