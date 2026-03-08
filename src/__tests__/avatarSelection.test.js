import { describe, it, expect } from 'vitest';
import { getOwnedPokemon, isCurrentAvatarAvailable } from '../components/EditProfileScreen';
import { STARTER_POKEMON, ALL_POKEMON } from '../data/pokemon';

describe('getOwnedPokemon', () => {
  it('returns empty array when trophyData is null', () => {
    expect(getOwnedPokemon(null)).toEqual([]);
  });

  it('returns empty array when trophyData has no collection', () => {
    expect(getOwnedPokemon({})).toEqual([]);
    expect(getOwnedPokemon({ collection: null })).toEqual([]);
  });

  it('returns empty array when collection is empty', () => {
    expect(getOwnedPokemon({ collection: {} })).toEqual([]);
  });

  it('excludes the 9 default starter Pokémon from owned list', () => {
    const collection = {};
    STARTER_POKEMON.forEach(pk => {
      collection[pk.id] = { count: 1, shiny: false };
    });
    const result = getOwnedPokemon({ collection });
    expect(result).toEqual([]);
  });

  it('returns caught non-starter Pokémon', () => {
    // Caterpie (id: 10) is not a starter
    const collection = { 10: { count: 1, shiny: false } };
    const result = getOwnedPokemon({ collection });
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('caterpie');
  });

  it('returns multiple caught Pokémon in ALL_POKEMON order', () => {
    // Caterpie (10), Pidgey (16) — both non-starters
    const collection = {
      10: { count: 1, shiny: false },
      16: { count: 2, shiny: false },
    };
    const result = getOwnedPokemon({ collection });
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe('caterpie');
    expect(result[1].slug).toBe('pidgey');
  });

  it('includes caught starters and non-starters correctly (only non-starters returned)', () => {
    const collection = {
      1: { count: 1, shiny: false },   // Bulbasaur — starter, should be excluded
      10: { count: 1, shiny: false },  // Caterpie — not a starter
      4: { count: 1, shiny: false },   // Charmander — starter, should be excluded
      12: { count: 1, shiny: false },  // Butterfree — not a starter
    };
    const result = getOwnedPokemon({ collection });
    expect(result).toHaveLength(2);
    const slugs = result.map(pk => pk.slug);
    expect(slugs).toContain('caterpie');
    expect(slugs).toContain('butterfree');
    expect(slugs).not.toContain('bulbasaur');
    expect(slugs).not.toContain('charmander');
  });

  it('does not include Pokémon with count 0', () => {
    const collection = {
      10: { count: 0, shiny: false },
    };
    const result = getOwnedPokemon({ collection });
    expect(result).toEqual([]);
  });
});

describe('isCurrentAvatarAvailable', () => {
  it('returns true for a default starter slug', () => {
    expect(isCurrentAvatarAvailable('bulbasaur', null)).toBe(true);
    expect(isCurrentAvatarAvailable('charmander', {})).toBe(true);
    expect(isCurrentAvatarAvailable('mudkip', { collection: {} })).toBe(true);
  });

  it('returns true for an owned non-starter Pokémon', () => {
    const trophyData = { collection: { 10: { count: 1, shiny: false } } };
    expect(isCurrentAvatarAvailable('caterpie', trophyData)).toBe(true);
  });

  it('returns false for a non-starter Pokémon no longer in collection', () => {
    // Caterpie was swapped/gifted away — count is 0
    const trophyData = { collection: { 10: { count: 0, shiny: false } } };
    expect(isCurrentAvatarAvailable('caterpie', trophyData)).toBe(false);
  });

  it('returns false for a non-starter Pokémon not in collection at all', () => {
    const trophyData = { collection: {} };
    expect(isCurrentAvatarAvailable('caterpie', trophyData)).toBe(false);
  });

  it('returns false when trophyData is null and slug is not a starter', () => {
    expect(isCurrentAvatarAvailable('caterpie', null)).toBe(false);
  });

  it('returns false for an unknown slug', () => {
    expect(isCurrentAvatarAvailable('missingno', { collection: {} })).toBe(false);
  });
});
