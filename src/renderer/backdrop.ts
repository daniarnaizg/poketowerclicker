/**
 * PokéBastion — Procedural pixel-art backdrop renderer.
 * Builds a 384×384 cached canvas per biome:
 *   Layer 1: terreno continuo (sin cuadrícula): color base + manchas orgánicas
 *            de bajo contraste con bordes tramados (dither), como un mapa GBA.
 *   Layer 2: micro-decoración dispersa (matas, flores, guijarros, grietas...).
 *   Layer 3: decoración de esquina (árboles, cristales, lava, palmeras...) con
 *            sprites pixel-art estilo Pokémon, ordenados por profundidad (Y).
 *   Layer 4: plataforma central del Bastión con emblema de Poké Ball.
 *
 * Todo se pinta solo con `fillRect` (tramos horizontales), así que es nítido a
 * cualquier escala y testeable con un mock mínimo de contexto 2D.
 */

import { ARENA } from '../config/arena.config';
import type { BiomeDefinition, BiomeId } from '../core/types';
import * as Decor from './decor';
import { PixelBuffer, blit, hash2, mix, valueNoise } from './pixelArt';

const SIZE = ARENA.SIZE; // 384
const CENTER = ARENA.CENTER; // 192
const MICRO_CELL = 24;

// ---------------------------------------------------------------------------
// Layer 1: terreno continuo
// ---------------------------------------------------------------------------

/** 0 = base, 1 = mancha oscura, 2 = mancha clara. */
function groundClass(x: number, y: number, seed: number): 0 | 1 | 2 {
  // Dos octavas de ruido; el hash por píxel tramado ("dither") rompe el borde recto.
  const n = valueNoise(x, y, 56, seed) * 0.65 + valueNoise(x, y, 22, seed + 17) * 0.35;
  const jitter = (hash2(x, y, seed + 5) - 0.5) * 0.05 + (((x + y) & 1) === 0 ? 0.012 : -0.012);
  const v = n + jitter;
  if (v > 0.6) return 1;
  if (v < 0.37) return 2;
  return 0;
}

function paintGround(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  const { groundA, groundB } = biome.palette;
  const colors = [
    groundA,
    mix(groundA, groundB, 0.42), // mancha algo más oscura
    mix(groundA, '#ffffff', 0.05), // mancha algo más clara
  ];
  const seed = biome.id.length * 31 + biome.id.charCodeAt(2);
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    let x = 0;
    while (x < SIZE) {
      const cls = groundClass(x, y, seed);
      let run = 1;
      while (x + run < SIZE && groundClass(x + run, y, seed) === cls) run++;
      if (cls !== 0) {
        ctx.fillStyle = colors[cls];
        ctx.fillRect(x, y, run, 1);
      }
      x += run;
    }
  }
}

// ---------------------------------------------------------------------------
// Layer 2: micro-decoración de suelo
// ---------------------------------------------------------------------------

type MicroKit = ReadonlyArray<{ upTo: number; sprites: readonly PixelBuffer[] }>;

/** Kit por bioma: umbrales acumulados sobre un hash [0,1) → grupos de sprites. */
function microKit(biome: BiomeDefinition): MicroKit {
  switch (biome.id) {
    case 'RUTA_VERDE':
      return [
        { upTo: 0.34, sprites: [Decor.buildGrassTuft('#4a9a30', '#a4ec64', 0), Decor.buildGrassTuft('#4a9a30', '#a4ec64', 1)] },
        { upTo: 0.43, sprites: ['#f05868', '#ffffff', '#f8d838', '#68a8f8'].map((c) => Decor.buildTinyFlower(c)) },
        { upTo: 0.47, sprites: [Decor.buildPebble('#6a6a64', '#9a9a90', '#c4c4b8')] },
      ];
    case 'CUEVA_UMBRIA':
      return [
        { upTo: 0.2, sprites: [Decor.buildPebble('#14101e', '#2c2540', '#4a4068')] },
        { upTo: 0.34, sprites: [Decor.buildCrack('#14101e')] },
        { upTo: 0.4, sprites: [Decor.buildCrystalShard()] },
      ];
    case 'MONTE_IGNEO':
      return [
        { upTo: 0.2, sprites: [Decor.buildCrack('#2d140e', '#f08030')] },
        { upTo: 0.3, sprites: [Decor.buildEmber()] },
        { upTo: 0.4, sprites: [Decor.buildPebble('#1c0e0a', '#38201a', '#5a382c')] },
      ];
    case 'COSTA_RUINAS':
      return [
        { upTo: 0.3, sprites: [Decor.buildSandRipple('#b8a870', '#f4e8c4')] },
        { upTo: 0.34, sprites: [Decor.buildShell()] },
        { upTo: 0.38, sprites: [Decor.buildPebble('#7a766c', '#a8a498', '#dcd8cc')] },
      ];
  }
}

function drawMicroDecorations(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  const kit = microKit(biome);
  const cells = Math.ceil(SIZE / MICRO_CELL);
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const v = hash2(cx, cy, 1);
      const group = kit.find((g) => v < g.upTo);
      if (!group) continue;
      const sprite = group.sprites[Math.floor(hash2(cx, cy, 4) * group.sprites.length)];
      const px = cx * MICRO_CELL + 2 + Math.floor(hash2(cx, cy, 2) * (MICRO_CELL - 4 - sprite.w));
      const py = cy * MICRO_CELL + 2 + Math.floor(hash2(cx, cy, 3) * (MICRO_CELL - 4 - sprite.h));
      // La zona de la plataforma central se deja limpia.
      if (Math.hypot(px + sprite.w / 2 - CENTER, py + sprite.h / 2 - CENTER) < 56) continue;
      blit(ctx, sprite, px, py);
    }
  }
}

// ---------------------------------------------------------------------------
// Layer 3: decoración de esquina
// ---------------------------------------------------------------------------

interface DecorItem {
  sprite: PixelBuffer;
  /** Centro del sprite respecto a la esquina (positivo = hacia dentro). */
  dx: number;
  dy: number;
}

/** Dos plantillas por bioma (A para esquinas TL/BR, B para TR/BL) para dar variedad. */
function cornerTemplates(id: BiomeId): [DecorItem[], DecorItem[]] {
  const it = (sprite: PixelBuffer, dx: number, dy: number): DecorItem => ({ sprite, dx, dy });
  switch (id) {
    case 'RUTA_VERDE':
      return [
        [
          it(Decor.buildTree(1), 28, 34),
          it(Decor.buildBush(true, 1), 70, 20),
          it(Decor.buildBush(false, 2), 22, 76),
          it(Decor.buildFlowerPatch(1), 62, 58),
          it(Decor.buildRock(1), 96, 14),
        ],
        [
          it(Decor.buildPine(), 20, 32),
          it(Decor.buildTree(2), 60, 36),
          it(Decor.buildBush(false, 3), 100, 16),
          it(Decor.buildFlowerPatch(2), 40, 80),
          it(Decor.buildSign(), 94, 50),
        ],
      ];
    case 'CUEVA_UMBRIA':
      return [
        [
          it(Decor.buildCrystalCluster(1), 34, 40),
          it(Decor.buildStalagmite(30, 1), 72, 24),
          it(Decor.buildStalagmite(22, 2), 16, 80),
          it(Decor.buildCaveBoulder(1), 76, 64),
          it(Decor.buildGlowShroom(), 52, 84),
        ],
        [
          it(Decor.buildStalagmite(30, 3), 22, 36),
          it(Decor.buildCrystalCluster(2), 62, 36),
          it(Decor.buildCaveBoulder(2), 20, 78),
          it(Decor.buildGlowShroom(), 96, 16),
          it(Decor.buildStalagmite(22, 4), 84, 62),
        ],
      ];
    case 'MONTE_IGNEO':
      return [
        [
          it(Decor.buildLavaPool(1), 42, 32),
          it(Decor.buildLavaRock(1), 92, 18),
          it(Decor.buildLavaRock(2), 18, 74),
          it(Decor.buildDeadTree(1), 90, 60),
        ],
        [
          it(Decor.buildDeadTree(2), 20, 44),
          it(Decor.buildLavaRock(3), 56, 18),
          it(Decor.buildLavaPool(2), 64, 62),
          it(Decor.buildLavaRock(4), 16, 90),
        ],
      ];
    case 'COSTA_RUINAS':
      return [
        [
          it(Decor.buildColumn(true, 1), 22, 44),
          it(Decor.buildColumn(false, 2), 54, 34),
          it(Decor.buildTidePool(1), 72, 74),
          it(Decor.buildStarfish(), 20, 88),
          it(Decor.buildShell(), 96, 20),
        ],
        [
          it(Decor.buildPalm(1), 36, 40),
          it(Decor.buildColumn(true, 3), 78, 40),
          it(Decor.buildShell(), 24, 92),
          it(Decor.buildStarfish(), 92, 82),
          it(Decor.buildTidePool(2), 62, 84),
        ],
      ];
  }
}

function drawCornerDecorations(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  const [tplA, tplB] = cornerTemplates(biome.id);
  const placed: Array<{ sprite: PixelBuffer; x: number; y: number; flip: boolean; foot: number }> = [];
  for (let corner = 0; corner < 4; corner++) {
    const left = corner % 2 === 0;
    const top = corner < 2;
    // TL(0)=A, TR(1)=B, BL(2)=B, BR(3)=A
    const tpl = corner === 0 || corner === 3 ? tplA : tplB;
    for (const { sprite, dx, dy } of tpl) {
      const cx = left ? dx : SIZE - dx;
      const cy = top ? dy : SIZE - dy;
      // Se mantiene el sprite completo dentro del lienzo.
      const x = Math.max(0, Math.min(SIZE - sprite.w, Math.round(cx - sprite.w / 2)));
      const y = Math.max(0, Math.min(SIZE - sprite.h, Math.round(cy - sprite.h / 2)));
      placed.push({ sprite, x, y, flip: !left, foot: y + sprite.h });
    }
  }
  // Orden por profundidad: lo más abajo se pinta al final.
  placed.sort((p, q) => p.foot - q.foot);
  for (const p of placed) blit(ctx, p.sprite, p.x, p.y, p.flip);
}

// ---------------------------------------------------------------------------
// Layer 4: plataforma central del Bastión (emblema de Poké Ball)
// ---------------------------------------------------------------------------

export function buildPlatformSprite(radius = 48): PixelBuffer {
  const d = radius * 2 + 2;
  const b = new PixelBuffer(d, d);
  const c = d / 2;
  const R = radius;
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy);
      if (r > R) continue;
      const ang = Math.atan2(dy, dx);
      // Anillo exterior discontinuo (14 tramos).
      if (r > R - 2.2) {
        const seg = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 28) % 2 === 0;
        b.set(x, y, seg ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.14)');
        continue;
      }
      // Banda central de la Poké Ball.
      if (Math.abs(dy) < 3 && r > 15) { b.set(x, y, 'rgba(32,32,40,0.30)'); continue; }
      // Botón central.
      if (r < 15) {
        if (r > 12) b.set(x, y, 'rgba(32,32,40,0.30)');
        else if (r > 8.5) b.set(x, y, 'rgba(255,255,255,0.20)');
        else b.set(x, y, 'rgba(255,255,255,0.10)');
        continue;
      }
      // Mitades: arriba casi transparente, abajo más clara (sutil para no estorbar a los sprites).
      b.set(x, y, dy < 0 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.20)');
    }
  }
  return b;
}

function drawBastionPlatform(ctx: CanvasRenderingContext2D): void {
  const sprite = buildPlatformSprite(48);
  blit(ctx, sprite, Math.round(CENTER - sprite.w / 2), Math.round(CENTER - sprite.h / 2));
}

// ---------------------------------------------------------------------------
// Main Public Function: buildBackdrop
// ---------------------------------------------------------------------------

/**
 * Builds and pre-renders a 384×384 canvas backdrop for the given biome.
 * Rendered once per biome transition; drawn via a single `drawImage` per frame.
 */
export function buildBackdrop(biome: BiomeDefinition): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    return {} as HTMLCanvasElement;
  }

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;

  paintGround(ctx, biome); // Layer 1 (continuo, sin cuadros)
  drawMicroDecorations(ctx, biome); // Layer 2
  drawCornerDecorations(ctx, biome); // Layer 3
  drawBastionPlatform(ctx); // Layer 4

  return canvas;
}
