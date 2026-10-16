/**
 * PokéBastion — Local Pokémon sprite & portrait sync script (PRD v2.4, Block 3A.4).
 *
 * Downloads PMDCollab sprite sheets (Walk-Anim, Idle-Anim, Attack-Anim, AnimData.xml)
 * and portraits (Normal.png) for every species registered in pokemon.ts and enemies.ts.
 * Saves assets into `public/sprites/<id>/` and `public/sprites/portrait/<id>/`.
 *
 * Safe for CI/offline builds: if network is unavailable or fetch fails, logs a
 * warning and exits cleanly with code 0 without failing the build.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POKEDEX } from '../src/data/pokemon';
import { ENEMY_DEFINITIONS } from '../src/data/enemies';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SPRITES_DIR = path.join(PUBLIC_DIR, 'sprites');
const PORTRAIT_DIR = path.join(SPRITES_DIR, 'portrait');

const REMOTE_SPRITE_BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite';
const REMOTE_PORTRAIT_BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait';

interface DownloadTarget {
  url: string;
  destPath: string;
  isOptional: boolean;
}

async function checkConnectivity(): Promise<boolean> {
  try {
    const res = await fetch(`${REMOTE_SPRITE_BASE}/0004/AnimData.xml`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function downloadFile(url: string, destPath: string, isOptional: boolean): Promise<boolean> {
  // If destination exists and has content, skip
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    return false; // Not re-downloaded
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) {
      if (res.status === 404 && isOptional) {
        return false;
      }
      console.warn(`[sync:pokemon] Warning: HTTP ${res.status} for ${url}`);
      return false;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buffer);
    return true;
  } catch (err) {
    if (isOptional) return false;
    console.warn(`[sync:pokemon] Warning: could not download ${url}:`, (err as Error).message);
    return false;
  }
}

async function runPool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<void> {
  let index = 0;
  const running: Promise<void>[] = [];

  const next = async (): Promise<void> => {
    if (index >= tasks.length) return;
    const task = tasks[index++];
    await task();
    return next();
  };

  const poolSize = Math.min(concurrency, tasks.length);
  for (let i = 0; i < poolSize; i++) {
    running.push(next());
  }

  await Promise.all(running);
}

async function main(): Promise<void> {
  console.log('----------------------------------------------------');
  console.log(' PokéBastion — PMDCollab Asset Synchronizer');
  console.log('----------------------------------------------------');

  // 1. Gather all species IDs
  const speciesSet = new Set<string>();
  for (const id of Object.keys(POKEDEX)) {
    if (/^\d{4}$/.test(id)) speciesSet.add(id);
  }
  for (const id of Object.keys(ENEMY_DEFINITIONS)) {
    if (/^\d{4}$/.test(id)) speciesSet.add(id);
  }
  const speciesList = Array.from(speciesSet).sort();
  console.log(`Discovered ${speciesList.length} distinct species in dataset.`);

  // 2. Connectivity check
  console.log('Testing connection to SpriteCollab repository...');
  const online = await checkConnectivity();
  if (!online) {
    console.warn('[sync:pokemon] Network connection to SpriteCollab repository is unavailable.');
    console.warn('[sync:pokemon] Exiting cleanly without error. Existing local/remote fallbacks remain active.');
    process.exit(0);
  }
  console.log('Connection successful.');

  // 3. Ensure directories
  fs.mkdirSync(SPRITES_DIR, { recursive: true });
  fs.mkdirSync(PORTRAIT_DIR, { recursive: true });

  // 4. Build download queue
  const targets: DownloadTarget[] = [];
  for (const id of speciesList) {
    const idDir = path.join(SPRITES_DIR, id);
    const portraitIdDir = path.join(PORTRAIT_DIR, id);

    // Spritesheet files
    targets.push(
      {
        url: `${REMOTE_SPRITE_BASE}/${id}/AnimData.xml`,
        destPath: path.join(idDir, 'AnimData.xml'),
        isOptional: false,
      },
      {
        url: `${REMOTE_SPRITE_BASE}/${id}/Walk-Anim.png`,
        destPath: path.join(idDir, 'Walk-Anim.png'),
        isOptional: false,
      },
      {
        url: `${REMOTE_SPRITE_BASE}/${id}/Idle-Anim.png`,
        destPath: path.join(idDir, 'Idle-Anim.png'),
        isOptional: true, // Some PMDCollab species omit Idle in favor of CopyOf
      },
      {
        url: `${REMOTE_SPRITE_BASE}/${id}/Attack-Anim.png`,
        destPath: path.join(idDir, 'Attack-Anim.png'),
        isOptional: true,
      },
      // Portrait files (saved in public/sprites/<id>/Normal.png AND public/sprites/portrait/<id>/Normal.png)
      {
        url: `${REMOTE_PORTRAIT_BASE}/${id}/Normal.png`,
        destPath: path.join(idDir, 'Normal.png'),
        isOptional: false,
      },
      {
        url: `${REMOTE_PORTRAIT_BASE}/${id}/Normal.png`,
        destPath: path.join(portraitIdDir, 'Normal.png'),
        isOptional: false,
      },
    );
  }

  console.log(`Processing ${targets.length} target files across ${speciesList.length} species...`);

  let downloadedCount = 0;
  let skippedCount = 0;

  const tasks = targets.map((target) => async () => {
    try {
      const downloaded = await downloadFile(target.url, target.destPath, target.isOptional);
      if (downloaded) {
        downloadedCount++;
      } else {
        skippedCount++;
      }
    } catch (e) {
      console.warn(`[sync:pokemon] Error downloading ${target.url}:`, (e as Error).message);
    }
  });

  // Run with concurrency of 6
  await runPool(tasks, 6);

  console.log('----------------------------------------------------');
  console.log(` Sync complete!`);
  console.log(` - Newly downloaded: ${downloadedCount}`);
  console.log(` - Skipped / cached: ${skippedCount}`);
  console.log(` - Destination:      ${path.relative(ROOT_DIR, SPRITES_DIR)}`);
  console.log('----------------------------------------------------');
}

main().catch((err) => {
  console.warn('[sync:pokemon] Sync encountered an unexpected error:', err.message);
  // Do not crash the build
  process.exit(0);
});
