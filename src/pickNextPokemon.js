import { ALL_POKEMON } from './data/pokemon';
import evolutions from './data/pokemon-evolutions.json';

const BUCKET_WEIGHTS = [0.50, 0.30, 0.10, 0.09, 0.01];

/**
 * Pick a bucket index using weighted probability.
 * bucketCount may be less than 5 if there aren't enough Pokémon.
 */
const pickBucket = (bucketCount, rand = Math.random) => {
  if (bucketCount <= 1) return 0;
  // Slice weights to match bucket count, then normalise
  const weights = BUCKET_WEIGHTS.slice(0, bucketCount);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
};

/**
 * Given an evolution chain (array of slugs, base→final) and a set of
 * uncaught slugs, pick one biased toward lower evolutions.
 * Weights: stage 0 gets weight 4, stage 1 gets 2, stage 2 gets 1, etc.
 */
const pickFromChain = (chain, uncaughtSlugs, rand = Math.random) => {
  const candidates = chain.filter(slug => uncaughtSlugs.has(slug));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Assign weights based on position in the full chain (lower index = higher weight)
  const weighted = candidates.map(slug => {
    const stageIndex = chain.indexOf(slug);
    const weight = Math.pow(2, chain.length - 1 - stageIndex); // base=highest
    return { slug, weight };
  });

  const total = weighted.reduce((s, c) => s + c.weight, 0);
  let r = rand() * total;
  for (const c of weighted) {
    r -= c.weight;
    if (r <= 0) return c.slug;
  }
  return weighted[weighted.length - 1].slug;
};

/**
 * Pick the next Pokémon to unlock using weighted bucket probability
 * and evolution-chain bias toward base forms.
 *
 * @param {Object} collection - user's collection { [pokemonId]: { regular, shiny } }
 * @param {Function} rand - random number generator (0-1), for testability
 * @returns {Object|null} the chosen Pokémon from ALL_POKEMON, or null if all caught
 */
export const pickNextPokemon = (collection, rand = Math.random) => {
  const col = collection || {};
  const available = ALL_POKEMON.filter(p => !col[p.id]?.regular);
  if (available.length === 0) return null;

  // Fewer than 5 available → just pick randomly
  if (available.length < 5) {
    return available[Math.floor(rand() * available.length)];
  }

  // Split into 5 equal buckets (last bucket gets remainder)
  const bucketSize = Math.floor(available.length / 5);
  const buckets = [];
  for (let i = 0; i < 5; i++) {
    const start = i * bucketSize;
    const end = i === 4 ? available.length : start + bucketSize;
    buckets.push(available.slice(start, end));
  }

  // Pick a bucket
  const bucketIdx = pickBucket(5, rand);
  const bucket = buckets[bucketIdx];

  // Pick a random Pokémon from the bucket
  const picked = bucket[Math.floor(rand() * bucket.length)];

  // Check if it belongs to an evolution chain
  const chain = evolutions[picked.slug];
  if (!chain || chain.length <= 1) return picked;

  // Build set of uncaught slugs for fast lookup
  const uncaughtSlugs = new Set(available.map(p => p.slug));

  // Pick from the chain with evolution bias
  const chosenSlug = pickFromChain(chain, uncaughtSlugs, rand);
  if (!chosenSlug) return picked; // fallback

  return ALL_POKEMON.find(p => p.slug === chosenSlug) || picked;
};
