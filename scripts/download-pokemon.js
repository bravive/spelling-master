/**
 * Downloads all Pokemon sprites from pokemondb.net and generates pokemon.js.
 * Run with: node scripts/download-pokemon.js
 *
 * Images are saved to:
 *   public/pokemon/normal/{slug}.png
 *   public/pokemon/shiny/{slug}.png
 *
 * src/data/pokemon.js is regenerated with the full roster.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const NORMAL_DIR = path.join(ROOT, 'public/pokemon/normal');
const SHINY_DIR  = path.join(ROOT, 'public/pokemon/shiny');
fs.mkdirSync(NORMAL_DIR, { recursive: true });
fs.mkdirSync(SHINY_DIR,  { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

function downloadFile(url, dest) {
  return new Promise((resolve) => {
    if (fs.existsSync(dest)) { resolve('skip'); return; }
    const tmp = dest + '.tmp';
    const file = fs.createWriteStream(tmp);
    https.get(url, res => {
      if (res.statusCode !== 200) {
        file.destroy();
        try { fs.unlinkSync(tmp); } catch {}
        resolve('missing');
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        fs.renameSync(tmp, dest);
        resolve('ok');
      });
    }).on('error', () => {
      try { fs.unlinkSync(tmp); } catch {}
      resolve('error');
    });
  });
}

// Capitalise first letter of each word, handle hyphens
function toDisplayName(slug) {
  return slug
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// Fetch all species (base forms only, no forms/variants) from PokéAPI
async function fetchAllPokemon() {
  console.log('Fetching Pokémon list from PokéAPI…');
  const res  = await fetch('https://pokeapi.co/api/v2/pokemon-species?limit=10000');
  const data = await res.json();
  // results: [{ name, url }] sorted by national dex id
  return data.results.map((pk, i) => {
    const id = parseInt(pk.url.split('/').filter(Boolean).pop());
    return { id, name: toDisplayName(pk.name), slug: pk.name };
  }).sort((a, b) => a.id - b.id);
}

async function main() {
  const all = await fetchAllPokemon();
  console.log(`Found ${all.length} Pokémon species.`);

  let downloaded = 0;
  let skipped    = 0;
  let missing    = 0;

  for (let i = 0; i < all.length; i++) {
    const { slug } = all[i];
    const normalUrl = `https://img.pokemondb.net/sprites/home/normal/${slug}.png`;
    const shinyUrl  = `https://img.pokemondb.net/sprites/home/shiny/${slug}.png`;
    const normalDest = path.join(NORMAL_DIR, `${slug}.png`);
    const shinyDest  = path.join(SHINY_DIR,  `${slug}.png`);

    const [nResult, sResult] = await Promise.all([
      downloadFile(normalUrl, normalDest),
      downloadFile(shinyUrl,  shinyDest),
    ]);

    if (nResult === 'ok' || sResult === 'ok') {
      downloaded++;
      process.stdout.write(`[${i + 1}/${all.length}] Downloaded ${slug}\n`);
      await sleep(80); // be polite to the server
    } else if (nResult === 'missing') {
      missing++;
      process.stdout.write(`[${i + 1}/${all.length}] No image for ${slug}\n`);
    } else {
      skipped++;
      if (skipped % 50 === 0) process.stdout.write(`  …${skipped} already cached…\n`);
    }
  }

  console.log(`\nDone. Downloaded: ${downloaded}, Skipped (cached): ${skipped}, Missing: ${missing}`);

  // Filter to only Pokémon that have a downloaded normal image
  const withImages = all.filter(pk =>
    fs.existsSync(path.join(NORMAL_DIR, `${pk.slug}.png`))
  );

  // Write pokemon.js
  const STARTER_SLUGS = [
    'bulbasaur','charmander','squirtle',
    'chikorita','cyndaquil','totodile',
    'treecko','torchic','mudkip',
  ];

  const lines = withImages.map(pk => {
    const idPart = String(pk.id).padStart(4);
    const namePad = ' '.repeat(Math.max(1, 22 - pk.name.length));
    return `  { id: ${idPart}, name: '${pk.name}',${namePad}slug: '${pk.slug}' },`;
  });

  const out = `export const pkImg   = slug => \`/pokemon/normal/\${slug}.png\`;
export const pkShiny = slug => \`/pokemon/shiny/\${slug}.png\`;

export const ALL_POKEMON = [
${lines.join('\n')}
];

export const STARTER_POKEMON = ALL_POKEMON.filter(pk =>
  ${JSON.stringify(STARTER_SLUGS)}.includes(pk.slug)
).slice(0, 9);
`;

  const pokemonJsPath = path.join(ROOT, 'src/data/pokemon.js');
  fs.writeFileSync(pokemonJsPath, out, 'utf8');
  console.log(`\nWrote ${withImages.length} Pokémon to src/data/pokemon.js`);
  console.log('Update the collection counter in App.jsx if needed (search "/ 60 caught").');
}

main().catch(err => { console.error(err); process.exit(1); });
