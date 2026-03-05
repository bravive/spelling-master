/**
 * Fetches base stats for all Pokemon from PokéAPI and writes
 * src/data/pokemon-stats.json.
 *
 * Run with: node scripts/download-pokemon-stats.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(ROOT, 'src/data/pokemon-stats.json');

// Read the slug list from the generated pokemon.js
const pokemonJs = fs.readFileSync(path.join(ROOT, 'src/data/pokemon.js'), 'utf8');
const slugs = [...pokemonJs.matchAll(/slug:\s*'([^']+)'/g)].map(m => m[1]);
console.log(`Found ${slugs.length} slugs in pokemon.js`);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchStats(slug) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
  if (!res.ok) { console.warn(`  Missing: ${slug}`); return null; }
  const data = await res.json();
  const st = {};
  for (const s of data.stats) {
    const key = { hp:'hp', attack:'atk', defense:'def',
                  'special-attack':'spa', 'special-defense':'spd', speed:'spe' }[s.stat.name];
    if (key) st[key] = s.base_stat;
  }
  return st;
}

const BATCH = 20;
const result = {};

for (let i = 0; i < slugs.length; i += BATCH) {
  const batch = slugs.slice(i, i + BATCH);
  const entries = await Promise.all(batch.map(async slug => [slug, await fetchStats(slug)]));
  for (const [slug, stats] of entries) {
    if (stats) result[slug] = stats;
  }
  process.stdout.write(`[${Math.min(i + BATCH, slugs.length)}/${slugs.length}] fetched\n`);
  if (i + BATCH < slugs.length) await sleep(300);
}

fs.writeFileSync(OUT, JSON.stringify(result, null, 2), 'utf8');
console.log(`\nWrote stats for ${Object.keys(result).length} Pokemon to src/data/pokemon-stats.json`);
