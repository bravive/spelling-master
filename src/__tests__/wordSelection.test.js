import { describe, it, expect } from 'vitest';
import { selectWords } from '../App.jsx';

const makeUser = (overrides = {}) => ({
  level: 1,
  roundCount: 0,
  wordStats: {},
  ...overrides,
});

describe('selectWords', () => {
  it('returns up to 10 words from the level pool', () => {
    const user = makeUser();
    const result = selectWords(user);
    expect(result.length).toBe(10);
    result.forEach(w => expect(w).toHaveProperty('w'));
  });

  it('excludes words on cooldown (passed in last 3 rounds)', () => {
    // Mark the first 15 level-1 words as passed in round 5 (roundCount=5 means last round was 5)
    const wordStats = {};
    const cooldownWords = ['cat','dog','hat','sun','bed','cup','bus','pig','hop','wet','fox','log','jam','mud','nap'];
    cooldownWords.forEach(w => {
      wordStats[w] = { attempts: 1, correct: 1, weight: 0.75, lastPassedRound: 4 };
    });
    const user = makeUser({ roundCount: 5, wordStats });
    const result = selectWords(user);
    // None of the cooldown words should appear (pool has 20 words, 15 on cooldown → 5 left < 10 → cooldown relaxed)
    // So cooldown is relaxed here. Let's test with only 5 on cooldown so the filter holds.
    const fewCooldownStats = {};
    ['cat','dog','hat','sun','bed'].forEach(w => {
      fewCooldownStats[w] = { attempts: 1, correct: 1, weight: 0.75, lastPassedRound: 4 };
    });
    const user2 = makeUser({ roundCount: 5, wordStats: fewCooldownStats });
    const result2 = selectWords(user2);
    const selected = result2.map(e => e.w);
    expect(selected).not.toContain('cat');
    expect(selected).not.toContain('dog');
    expect(selected).not.toContain('hat');
    expect(selected).not.toContain('sun');
    expect(selected).not.toContain('bed');
  });

  it('includes words after the 3-round cooldown has expired', () => {
    const wordStats = {
      cat: { attempts: 1, correct: 1, weight: 0.75, lastPassedRound: 1 },
    };
    // roundCount=4 means 3 rounds have passed since lastPassedRound=1 (4-1=3, not <3)
    const user = makeUser({ roundCount: 4, wordStats });
    const result = selectWords(user);
    const selected = result.map(e => e.w);
    expect(selected).toContain('cat');
  });

  it('permanently excludes words failed 3+ times with no correct answers', () => {
    const wordStats = {};
    // Retire all but 5 words from the level-1 pool by marking them as failed 3 times
    const allLevel1 = ['cat','dog','hat','sun','bed','cup','bus','pig','hop','wet','fox','log','jam','mud','nap','pan','web','zip','box','van'];
    allLevel1.slice(0, 15).forEach(w => {
      wordStats[w] = { attempts: 3, correct: 0, weight: 5, lastPassedRound: null };
    });
    const user = makeUser({ wordStats });
    const result = selectWords(user);
    const selected = result.map(e => e.w);
    allLevel1.slice(0, 15).forEach(w => {
      expect(selected).not.toContain(w);
    });
    // Only the 5 non-retired words should appear
    expect(result.length).toBe(5);
  });

  it('does not exclude a word failed fewer than 3 times', () => {
    // Retire all level-1 words except 'cat' and 9 others so cat is guaranteed to be selected
    const allLevel1 = ['cat','dog','hat','sun','bed','cup','bus','pig','hop','wet','fox','log','jam','mud','nap','pan','web','zip','box','van'];
    const wordStats = {};
    // Retire all except the first 10 (cat stays eligible with 2 failures)
    allLevel1.slice(10).forEach(w => {
      wordStats[w] = { attempts: 3, correct: 0, weight: 5, lastPassedRound: null };
    });
    wordStats['cat'] = { attempts: 2, correct: 0, weight: 2.56, lastPassedRound: null };
    const user = makeUser({ wordStats });
    const result = selectWords(user);
    const selected = result.map(e => e.w);
    expect(selected).toContain('cat');
  });

  it('relaxes cooldown when fewer than 10 words remain after filtering', () => {
    // Put 15 words on cooldown — only 5 remain. Should relax and return 10.
    const wordStats = {};
    const allLevel1 = ['cat','dog','hat','sun','bed','cup','bus','pig','hop','wet','fox','log','jam','mud','nap','pan','web','zip','box','van'];
    allLevel1.slice(0, 15).forEach(w => {
      wordStats[w] = { attempts: 1, correct: 1, weight: 0.75, lastPassedRound: 5 };
    });
    const user = makeUser({ roundCount: 6, wordStats });
    const result = selectWords(user);
    expect(result.length).toBe(10);
  });
});
