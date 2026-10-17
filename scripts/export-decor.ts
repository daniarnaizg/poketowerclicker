/**
 * Exporta los sprites decorativos procedurales a PNG editables en `public/decor/`.
 *
 *   pnpm run export:decor                 → crea solo los PNG que NO existan (no pisa tus ediciones)
 *   pnpm run export:decor -- --force      → regenera todos (¡sobrescribe tus ediciones!)
 *   pnpm run export:decor -- --only=ruta_verde/   → solo los nombres que empiecen así
 *
 * En ejecución el juego usa el PNG si existe y, si no, el sprite procedural (ver
 * src/renderer/decorSprites.ts). Para volver al original de un sprite, borra su PNG.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { DECOR_CATALOG } from '../src/renderer/decorCatalog';
import { toRgba } from '../src/renderer/pixelArt';
import type { PixelBuffer } from '../src/renderer/pixelArt';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'decor');

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

const force = process.argv.includes('--force');
const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);

let written = 0;
let skipped = 0;
for (const [name, build] of Object.entries(DECOR_CATALOG) as Array<[string, () => PixelBuffer]>) {
  if (only && !name.startsWith(only)) continue;
  const file = join(OUT_DIR, `${name}.png`);
  if (existsSync(file) && !force) {
    skipped++;
    continue;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePng(build()));
  written++;
}
console.log(`decor: ${written} PNG escritos, ${skipped} existentes conservados → ${OUT_DIR}`);
