import { describe, it, expect } from 'vitest';
import { pickNextPokemon } from '../pickNextPokemon';
import { ALL_POKEMON } from '../data/pokemon';

describe('pickNextPokemon', () => {
  it('returns null when all Pokemon are caught', () => {
    const col = {};
    ALL_POKEMON.forEach(p => { col[p.id] = { regular: true }; });
    expect(pickNextPokemon(col)).toBeNull();
  });

  it('returns a Pokemon when collection is empty', () => {
    const result = pickNextPokemon({});
    expect(result).not.toBeNull();
    expect(result.id).toBeDefined();
    expect(result.slug).toBeDefined();
  });

  it('never returns an already-caught Pokemon', () => {
    // Catch first 500, leave rest
    const col = {};
    ALL_POKEMON.slice(0, 500).forEach(p => { col[p.id] = { regular: true }; });
    for (let i = 0; i < 100; i++) {
      const result = pickNextPokemon(col);
      expect(col[result.id]).toBeUndefined();
    }
  });

  it('picks randomly from remaining when fewer than 5 available', () => {
    const col = {};
    ALL_POKEMON.forEach(p => { col[p.id] = { regular: true }; });
    // Leave only 3 uncaught
    delete col[1]; delete col[2]; delete col[3];
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      const result = pickNextPokemon(col);
      seen.add(result.id);
    }
    // Should pick from the 3 available
    seen.forEach(id => expect([1, 2, 3]).toContain(id));
  });

  it('uses bucket weighting — lower-ID Pokemon picked more often', () => {
    // With a large pool and many trials, bucket 1 (50%) should dominate
    const col = {};
    const counts = { low: 0, high: 0 };
    const available = ALL_POKEMON.filter(p => !col[p.id]?.regular);
    const midId = available[Math.floor(available.length / 2)].id;

    for (let i = 0; i < 500; i++) {
      const result = pickNextPokemon(col);
      if (result.id <= midId) counts.low++; else counts.high++;
    }
    // Lower half should be picked significantly more often (bucket 1+2 = 80%)
    expect(counts.low).toBeGreaterThan(counts.high);
  });

  it('respects evolution bias — base forms favored over evolutions', () => {
    // Leave only Bulbasaur line uncaught
    const col = {};
    ALL_POKEMON.forEach(p => { col[p.id] = { regular: true }; });
    delete col[1]; // Bulbasaur
    delete col[2]; // Ivysaur
    delete col[3]; // Venusaur
    const counts = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < 2000; i++) {
      const result = pickNextPokemon(col);
      counts[result.id]++;
    }
    // Bulbasaur (base, weight 4) should be picked most, Venusaur (weight 1) least
    // Expected ratio roughly 4:2:1 → ~57%:29%:14%
    expect(counts[1]).toBeGreaterThan(counts[2]);
    expect(counts[2]).toBeGreaterThan(counts[3]);
  });

  it('uses deterministic rand parameter', () => {
    let callCount = 0;
    // Fixed rand that always returns 0 → should always pick bucket 0, first item
    const fixedRand = () => 0;
    const result1 = pickNextPokemon({}, fixedRand);
    const result2 = pickNextPokemon({}, fixedRand);
    expect(result1.id).toBe(result2.id);
  });

  it('handles null/undefined collection', () => {
    expect(pickNextPokemon(null)).not.toBeNull();
    expect(pickNextPokemon(undefined)).not.toBeNull();
  });
});
