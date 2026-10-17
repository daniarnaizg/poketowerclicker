/**
 * Exporta los sprites decorativos procedurales a Spritesheets PNG editables en `public/decor/`.
 *
 *   pnpm run export:decor                 → genera solo las hojas que NO existan (no pisa tus ediciones)
 *   pnpm run export:decor -- --force      → regenera todas las hojas (¡sobrescribe tus ediciones!)
 *   pnpm run export:decor -- --only=ruta_verde  → solo la hoja indicada
 *
 * Cada bioma tiene su propia hoja PNG (ej. `ruta_verde.png`, `monte_igneo.png`) con
 * separación de 4 px entre sprites y organización en filas por tamaño/categoría,
 * facilitando su edición directa en Aseprite, Photoshop, etc.
 *
 * Genera además `public/decor/decor_atlas.json` y `src/renderer/decorAtlas.ts` con las
 * coordenadas y dimensiones exactas de cada sprite.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { DECOR_CATALOG } from '../src/renderer/decorCatalog';
import type { DecorName } from '../src/renderer/decorCatalog';
import { toRgba } from '../src/renderer/pixelArt';
import { PixelBuffer } from '../src/renderer/pixelArt';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'decor');
const ATLAS_TS_PATH = join(ROOT, 'src', 'renderer', 'decorAtlas.ts');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** PNG RGBA de 8 bits, sin entrelazado. */
export function encodePng(buf: PixelBuffer): Buffer {
  const rows: Buffer[] = [];
  for (let y = 0; y < buf.h; y++) {
    const row = Buffer.alloc(1 + buf.w * 4); // byte de filtro 0 + RGBA
    for (let x = 0; x < buf.w; x++) {
      const css = buf.get(x, y);
      if (!css) continue; // transparente: 0,0,0,0
      const [r, g, b, a] = toRgba(css);
      row.set([r, g, b, a], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(buf.w, 0);
  ihdr.writeUInt32BE(buf.h, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Disposición en filas lógicas de cada bioma para máxima claridad al editar en Aseprite. */
export const SHEET_LAYOUT: Record<string, string[][]> = {
  ruta_verde: [
    ['tree_a', 'tree_b', 'pine'],
    ['bush_a', 'bush_b', 'bush_berries', 'sign', 'rock'],
    [
      'flowers_a',
      'flowers_b',
      'micro_grass_a',
      'micro_grass_b',
      'micro_flower_red',
      'micro_flower_white',
      'micro_flower_yellow',
      'micro_flower_blue',
      'micro_pebble',
    ],
  ],
  cueva_umbria: [
    ['crystals_a', 'crystals_b', 'stalagmite_tall_a', 'stalagmite_tall_b'],
    ['stalagmite_short_a', 'stalagmite_short_b', 'boulder_a', 'boulder_b', 'glow_shroom'],
    ['micro_shard', 'micro_crack', 'micro_pebble'],
  ],
  monte_igneo: [
    ['lava_pool_a', 'lava_pool_b', 'dead_tree_a', 'dead_tree_b'],
    ['lava_rock_a', 'lava_rock_b', 'lava_rock_c', 'lava_rock_d'],
    ['micro_crack', 'micro_pebble', 'micro_ember'],
  ],
  costa_ruinas: [
    ['palm', 'column_full', 'column_broken_a', 'column_broken_b'],
    ['tide_pool_a', 'tide_pool_b'],
    ['starfish', 'shell', 'micro_ripple', 'micro_pebble'],
  ],
  common: [['platform']],
};

const PADDING = 4;
const force = process.argv.includes('--force');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);

mkdirSync(OUT_DIR, { recursive: true });

interface FrameInfo {
  sheet: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SheetMeta {
  w: number;
  h: number;
  file: string;
}

const atlas = {
  sheets: {} as Record<string, SheetMeta>,
  frames: {} as Record<string, FrameInfo>,
};

let writtenSheets = 0;
let skippedSheets = 0;

for (const [sheetName, rows] of Object.entries(SHEET_LAYOUT)) {
  if (only && sheetName !== only) continue;

  // 1. Calcular dimensiones y posiciones
  let maxW = 0;
  let totalH = PADDING;
  interface ItemPos {
    key: string;
    buffer: PixelBuffer;
    x: number;
    y: number;
  }
  const rowPlacements: ItemPos[] = [];

  for (const row of rows) {
    let curX = PADDING;
    let rowH = 0;
    for (const name of row) {
      const key = `${sheetName}/${name}` as DecorName;
      const builder = DECOR_CATALOG[key];
      if (!builder) {
        throw new Error(`Sprite no encontrado en DECOR_CATALOG: ${key}`);
      }
      const buf = builder();
      rowPlacements.push({ key, buffer: buf, x: curX, y: totalH });
      atlas.frames[key] = {
        sheet: sheetName,
        x: curX,
        y: totalH,
        w: buf.w,
        h: buf.h,
      };
      curX += buf.w + PADDING;
      rowH = Math.max(rowH, buf.h);
    }
    maxW = Math.max(maxW, curX);
    totalH += rowH + PADDING;
  }

  atlas.sheets[sheetName] = {
    w: maxW,
    h: totalH,
    file: `${sheetName}.png`,
  };

  const outFile = join(OUT_DIR, `${sheetName}.png`);
  if (existsSync(outFile) && !force) {
    skippedSheets++;
    continue;
  }

  // 2. Empaquetar sprites en el PixelBuffer de la hoja
  const sheetBuffer = new PixelBuffer(maxW, totalH);
  for (const item of rowPlacements) {
    for (let py = 0; py < item.buffer.h; py++) {
      for (let px = 0; px < item.buffer.w; px++) {
        const c = item.buffer.get(px, py);
        if (c) sheetBuffer.set(item.x + px, item.y + py, c);
      }
    }
  }

  writeFileSync(outFile, encodePng(sheetBuffer));
  writtenSheets++;
}

// 3. Escribir atlas JSON y TS
const atlasJsonPath = join(OUT_DIR, 'decor_atlas.json');
writeFileSync(atlasJsonPath, JSON.stringify(atlas, null, 2), 'utf-8');

const tsContent = `/**
 * PokéBastion — Atlas de sprites decorativos por bioma.
 * Define la posición (x, y) y dimensiones (w, h) de cada sprite dentro de su spritesheet.
 * Cada bioma tiene su propia hoja PNG en \`public/decor/<sheet>.png\`.
 */

import type { DecorName } from './decorCatalog';

export type DecorSheetName = 'ruta_verde' | 'cueva_umbria' | 'monte_igneo' | 'costa_ruinas' | 'common';

export interface DecorFrame {
  sheet: DecorSheetName;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SheetInfo {
  w: number;
  h: number;
  file: string;
}

export interface DecorAtlas {
  sheets: Record<DecorSheetName, SheetInfo>;
  frames: Record<DecorName, DecorFrame>;
}

export const DECOR_ATLAS: DecorAtlas = ${JSON.stringify(atlas, null, 2)};
`;

writeFileSync(ATLAS_TS_PATH, tsContent, 'utf-8');

console.log(
  `decor spritesheets: ${writtenSheets} hojas escritas, ${skippedSheets} existentes conservadas → ${OUT_DIR}`,
);
console.log(`atlas actualizado: ${Object.keys(atlas.frames).length} frames registrados.`);
