import { describe, it, expect } from 'vitest';
import { unlockPokemon } from '../unlockPokemon';

describe('unlockPokemon', () => {
  it('unlocks nothing when creditBank < 10', () => {
    const result = unlockPokemon({ creditBank: 9, consecutiveRegular: 0, shinyEligible: false, collection: {} });
    expect(result.newUnlocks).toHaveLength(0);
    expect(result.creditBank).toBe(9);
  });

  it('unlocks a regular Pokemon at 10 credits', () => {
    const result = unlockPokemon({ creditBank: 10, consecutiveRegular: 0, shinyEligible: false, collection: {} });
    expect(result.newUnlocks).toHaveLength(1);
    expect(result.newUnlocks[0].shiny).toBe(false);
    expect(result.creditBank).toBe(0);
    expect(result.consecutiveRegular).toBe(1);
  });

  it('unlocks multiple Pokemon with enough credits', () => {
    const result = unlockPokemon({ creditBank: 20, consecutiveRegular: 0, shinyEligible: false, collection: {} });
    expect(result.newUnlocks).toHaveLength(2);
    expect(result.newUnlocks[0].shiny).toBe(false);
    expect(result.newUnlocks[1].shiny).toBe(false);
    expect(result.creditBank).toBe(0);
    expect(result.consecutiveRegular).toBe(2);
  });

  it('activates shiny eligibility after 3 consecutive regular unlocks', () => {
    const result = unlockPokemon({ creditBank: 10, consecutiveRegular: 2, shinyEligible: false, collection: {} });
    // 3rd consecutive regular triggers shiny, which is immediately consumed
    expect(result.newUnlocks).toHaveLength(2); // 1 regular + 1 shiny
    expect(result.newUnlocks[0].shiny).toBe(false);
    expect(result.newUnlocks[1].shiny).toBe(true);
    expect(result.shinyEligible).toBe(false); // consumed
    expect(result.consecutiveRegular).toBe(0); // reset after shiny
  });

  it('guarantees a shiny when shinyEligible is true (no randomness)', () => {
    // Build a collection with 2 regular Pokemon already caught
    const collection = { 1: { regular: true }, 2: { regular: true } };
    const result = unlockPokemon({ creditBank: 10, consecutiveRegular: 0, shinyEligible: true, collection });
    // Should get regular unlock + guaranteed shiny
    const regulars = result.newUnlocks.filter(u => !u.shiny);
    const shinies = result.newUnlocks.filter(u => u.shiny);
    expect(regulars).toHaveLength(1);
    expect(shinies).toHaveLength(1);
    expect(result.shinyEligible).toBe(false);
    expect(result.consecutiveRegular).toBe(0);
  });

  it('awards both regular and shiny on the same unlock when eligible', () => {
    // consecutiveRegular=2, so the 3rd unlock triggers shiny in the same cycle
    const result = unlockPokemon({ creditBank: 10, consecutiveRegular: 2, shinyEligible: false, collection: {} });
    expect(result.newUnlocks.length).toBe(2);
    expect(result.newUnlocks[0].shiny).toBe(false); // regular
    expect(result.newUnlocks[1].shiny).toBe(true);  // bonus shiny
  });

  it('resets consecutiveRegular to 0 after shiny is awarded', () => {
    const result = unlockPokemon({ creditBank: 10, consecutiveRegular: 2, shinyEligible: false, collection: {} });
    expect(result.consecutiveRegular).toBe(0);
  });

  it('awards shiny to newly unlocked Pokemon when no prior shiny candidates exist', () => {
    // Only existing Pokemon already has a shiny, but the newly unlocked one becomes eligible
    const collection = { 1: { regular: true, shiny: true } };
    const result = unlockPokemon({ creditBank: 10, consecutiveRegular: 0, shinyEligible: true, collection });
    const regulars = result.newUnlocks.filter(u => !u.shiny);
    const shinies = result.newUnlocks.filter(u => u.shiny);
    expect(regulars).toHaveLength(1); // still gets a regular
    expect(shinies).toHaveLength(1);  // newly unlocked Pokemon gets shiny
    expect(result.shinyEligible).toBe(false); // consumed
  });

  it('preserves leftover credits', () => {
    const result = unlockPokemon({ creditBank: 15, consecutiveRegular: 0, shinyEligible: false, collection: {} });
    expect(result.creditBank).toBe(5);
    expect(result.newUnlocks).toHaveLength(1);
  });

  it('returns nextPokemonId for the next unlock', () => {
    const result = unlockPokemon({ creditBank: 10, consecutiveRegular: 0, shinyEligible: false, collection: {} });
    // After unlocking one, should pre-compute the next
    expect(result.nextPokemonId).toBeTypeOf('number');
    // The next should not be the one just unlocked
    const unlockedId = result.newUnlocks[0].id;
    expect(result.nextPokemonId).not.toBe(unlockedId);
  });

  it('returns null nextPokemonId when all Pokemon are caught', () => {
    const col = {};
    const { ALL_POKEMON } = require('../data/pokemon');
    ALL_POKEMON.forEach(p => { col[p.id] = { regular: true }; });
    // Leave one uncaught so the unlock works, but after unlocking it all are caught
    delete col[1];
    const result = unlockPokemon({ creditBank: 10, consecutiveRegular: 0, shinyEligible: false, collection: col });
    expect(result.nextPokemonId).toBeNull();
  });

  it('uses pre-computed nextPokemonId when provided', () => {
    // Pass nextPokemonId=25 (Pikachu), should unlock that one
    const result = unlockPokemon({ creditBank: 10, consecutiveRegular: 0, shinyEligible: false, collection: {}, nextPokemonId: 25 });
    expect(result.newUnlocks[0].id).toBe(25);
  });

  it('uses count-based format instead of regular: true', () => {
    const result = unlockPokemon({ creditBank: 10, consecutiveRegular: 0, shinyEligible: false, collection: {} });
    const unlockedId = result.newUnlocks[0].id;
    expect(result.collection[unlockedId].count).toBe(1);
    expect(result.collection[unlockedId].regular).toBeUndefined();
  });

  it('handles backward-compatible regular: true in input collection', () => {
    // Old format: { regular: true } should be treated as caught
    const collection = { 1: { regular: true }, 2: { regular: true } };
    const result = unlockPokemon({ creditBank: 10, consecutiveRegular: 0, shinyEligible: false, collection });
    // Should not re-unlock id 1 or 2
    const unlockedId = result.newUnlocks[0].id;
    expect(unlockedId).not.toBe(1);
    expect(unlockedId).not.toBe(2);
  });
});
