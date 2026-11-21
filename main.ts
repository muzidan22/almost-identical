// The entrypoint the grader runs: hand in the game.
//
// Almost Identical ships as plain static files in game/ — an index.html and the scripts and
// stylesheet it loads, nothing else, no build step and no network request. This program does the
// one job the bounty asks of it: copy game/ and screenshots/ into the output directory and write
// dossier.json beside them with make.fun's own library, which is what the judge reads.
//
// Run it locally with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the game itself with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The caps the bounty's scorer applies (its gate.json), passed through so a local run refuses
 *  exactly what the scorer would refuse rather than handing in something that fails remotely. */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

/** A count of the files under a directory, used only for the line this program prints. */
function countFiles(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += countFiles(join(dir, entry.name));
    else if (entry.isFile()) total += 1;
  }
  return total;
}

// Fail early and say why, rather than writing an output directory that is quietly incomplete.
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing: the game is a directory of static files with a page at its root');
}
if (!existsSync(shotsDir) || countFiles(shotsDir) < 3) {
  throw new Error('screenshots/ must hold at least three renders of the game');
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));

// Say what was handed in, so a local run is not silent about it.
const gameFiles = countFiles(join(out, 'game'));
const shotFiles = readdirSync(join(out, 'screenshots')).length;
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`Almost Identical: ${gameFiles} game files and ${shotFiles} screenshots written to ${out}`);
console.log(`dossier.json: ${dossierBytes} bytes`);
