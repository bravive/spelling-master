/**
 * Fetches evolution chains for all Pokemon and writes
 * src/data/pokemon-evolutions.json
 *
 * Format: { "bulbasaur": ["bulbasaur","ivysaur","venusaur"], ... }
 * Each entry is the full flat family (BFS order) that the Pokemon belongs to.
 *
 * Run with: node scripts/download-pokemon-evolutions.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(ROOT, 'src/data/pokemon-evolutions.json');

// Read slugs from pokemon.js
const pokemonJs = fs.readFileSync(path.join(ROOT, 'src/data/pokemon.js'), 'utf8');
const slugs = [...pokemonJs.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]);
console.log(`Found ${slugs.length} slugs`);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Flatten a chain node (BFS) into an ordered slug array
function flattenChain(node) {
  const result = [];
  const queue = [node];
  while (queue.length) {
    const cur = queue.shift();
    result.push(cur.species.name);
    for (const evo of cur.evolves_to) queue.push(evo);
  }
  return result;
}

const chainCache = {};   // chainUrl → slug[]
const result = {};

const BATCH = 15;

for (let i = 0; i < slugs.length; i += BATCH) {
  const batch = slugs.slice(i, i + BATCH);

  await Promise.all(batch.map(async slug => {
    try {
      // 1. Species → evolution_chain url
      const specRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${slug}`);
      if (!specRes.ok) { result[slug] = [slug]; return; }
      const spec = await specRes.json();
      const chainUrl = spec.evolution_chain.url;

      // 2. Evolution chain (cached)
      if (!chainCache[chainUrl]) {
        const chainRes = await fetch(chainUrl);
        if (!chainRes.ok) { result[slug] = [slug]; return; }
        const chainData = await chainRes.json();
        chainCache[chainUrl] = flattenChain(chainData.chain);
      }

      result[slug] = chainCache[chainUrl];
    } catch {
      result[slug] = [slug];
    }
  }));

  process.stdout.write(`[${Math.min(i + BATCH, slugs.length)}/${slugs.length}] done\n`);
  if (i + BATCH < slugs.length) await sleep(400);
}

fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8');
console.log(`\nWrote evolutions for ${Object.keys(result).length} Pokemon to src/data/pokemon-evolutions.json`);
