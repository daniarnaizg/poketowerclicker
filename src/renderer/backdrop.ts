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
 * El terreno y los sprites procedurales se pintan con `fillRect`; si existe un PNG
 * editado en `public/decor/` (ver docs/DECOR_SPRITES.md) se dibuja ese en su lugar.
 */

import { ARENA } from '../config/arena.config';
import type { BiomeDefinition, BiomeId } from '../core/types';
import type { DecorName } from './decorAtlas';
import { getDecorSprite } from './decorSprites';
import type { DecorSprite } from './decorSprites';
import { hash2, mix, valueNoise } from './pixelArt';

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

type MicroKit = ReadonlyArray<{ upTo: number; sprites: readonly DecorName[] }>;

/** Kit por bioma: umbrales acumulados sobre un hash [0,1) → grupos de sprites. */
function microKit(biome: BiomeDefinition): MicroKit {
  switch (biome.id) {
    case 'RUTA_VERDE':
      return [
        { upTo: 0.34, sprites: ['ruta_verde/micro_grass_a', 'ruta_verde/micro_grass_b'] },
        {
          upTo: 0.43,
          sprites: [
            'ruta_verde/micro_flower_red',
            'ruta_verde/micro_flower_white',
            'ruta_verde/micro_flower_yellow',
            'ruta_verde/micro_flower_blue',
          ],
        },
        { upTo: 0.47, sprites: ['ruta_verde/micro_pebble'] },
      ];
    case 'CUEVA_UMBRIA':
      return [
        { upTo: 0.2, sprites: ['cueva_umbria/micro_pebble'] },
        { upTo: 0.34, sprites: ['cueva_umbria/micro_crack'] },
        { upTo: 0.4, sprites: ['cueva_umbria/micro_shard'] },
      ];
    case 'MONTE_IGNEO':
      return [
        { upTo: 0.2, sprites: ['monte_igneo/micro_crack'] },
        { upTo: 0.3, sprites: ['monte_igneo/micro_ember'] },
        { upTo: 0.4, sprites: ['monte_igneo/micro_pebble'] },
      ];
    case 'COSTA_RUINAS':
      return [
        { upTo: 0.3, sprites: ['costa_ruinas/micro_ripple'] },
        { upTo: 0.34, sprites: ['costa_ruinas/shell'] },
        { upTo: 0.38, sprites: ['costa_ruinas/micro_pebble'] },
      ];
  }
}

function drawMicroDecorations(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  const kit = microKit(biome);
  const sprites = new Map<DecorName, DecorSprite>();
  const cells = Math.ceil(SIZE / MICRO_CELL);
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const v = hash2(cx, cy, 1);
      const group = kit.find((g) => v < g.upTo);
      if (!group) continue;
      const name = group.sprites[Math.floor(hash2(cx, cy, 4) * group.sprites.length)];
      let sprite = sprites.get(name);
      if (!sprite) {
        sprite = getDecorSprite(name);
        sprites.set(name, sprite);
      }
      const px = cx * MICRO_CELL + 2 + Math.floor(hash2(cx, cy, 2) * (MICRO_CELL - 4 - sprite.w));
      const py = cy * MICRO_CELL + 2 + Math.floor(hash2(cx, cy, 3) * (MICRO_CELL - 4 - sprite.h));
      // La zona de la plataforma central se deja limpia.
      if (Math.hypot(px + sprite.w / 2 - CENTER, py + sprite.h / 2 - CENTER) < 56) continue;
      sprite.draw(ctx, px, py);
    }
  }
}

// ---------------------------------------------------------------------------
// Layer 3: decoración de esquina
// ---------------------------------------------------------------------------

interface DecorItem {
  name: DecorName;
  /** Centro del sprite respecto a la esquina (positivo = hacia dentro). */
  dx: number;
  dy: number;
}

/** Dos plantillas por bioma (A para esquinas TL/BR, B para TR/BL) para dar variedad. */
function cornerTemplates(id: BiomeId): [DecorItem[], DecorItem[]] {
  const it = (name: DecorName, dx: number, dy: number): DecorItem => ({ name, dx, dy });
  switch (id) {
    case 'RUTA_VERDE':
      return [
        [
          it('ruta_verde/tree_a', 28, 34),
          it('ruta_verde/bush_berries', 70, 20),
          it('ruta_verde/bush_a', 22, 76),
          it('ruta_verde/flowers_a', 62, 58),
          it('ruta_verde/rock', 96, 14),
        ],
        [
          it('ruta_verde/pine', 20, 32),
          it('ruta_verde/tree_b', 60, 36),
          it('ruta_verde/bush_b', 100, 16),
          it('ruta_verde/flowers_b', 40, 80),
          it('ruta_verde/sign', 94, 50),
        ],
      ];
    case 'CUEVA_UMBRIA':
      return [
        [
          it('cueva_umbria/crystals_a', 34, 40),
          it('cueva_umbria/stalagmite_tall_a', 72, 24),
          it('cueva_umbria/stalagmite_short_a', 16, 80),
          it('cueva_umbria/boulder_a', 76, 64),
          it('cueva_umbria/glow_shroom', 52, 84),
        ],
        [
          it('cueva_umbria/stalagmite_tall_b', 22, 36),
          it('cueva_umbria/crystals_b', 62, 36),
          it('cueva_umbria/boulder_b', 20, 78),
          it('cueva_umbria/glow_shroom', 96, 16),
          it('cueva_umbria/stalagmite_short_b', 84, 62),
        ],
      ];
    case 'MONTE_IGNEO':
      return [
        [
          it('monte_igneo/lava_pool_a', 42, 32),
          it('monte_igneo/lava_rock_a', 92, 18),
          it('monte_igneo/lava_rock_b', 18, 74),
          it('monte_igneo/dead_tree_a', 90, 60),
        ],
        [
          it('monte_igneo/dead_tree_b', 20, 44),
          it('monte_igneo/lava_rock_c', 56, 18),
          it('monte_igneo/lava_pool_b', 64, 62),
          it('monte_igneo/lava_rock_d', 16, 90),
        ],
      ];
    case 'COSTA_RUINAS':
      return [
        [
          it('costa_ruinas/column_broken_a', 22, 44),
          it('costa_ruinas/column_full', 54, 34),
          it('costa_ruinas/tide_pool_a', 72, 74),
          it('costa_ruinas/starfish', 20, 88),
          it('costa_ruinas/shell', 96, 20),
        ],
        [
          it('costa_ruinas/palm', 36, 40),
          it('costa_ruinas/column_broken_b', 78, 40),
          it('costa_ruinas/shell', 24, 92),
          it('costa_ruinas/starfish', 92, 82),
          it('costa_ruinas/tide_pool_b', 62, 84),
        ],
      ];
  }
}

function drawCornerDecorations(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  const [tplA, tplB] = cornerTemplates(biome.id);
  const placed: Array<{ sprite: DecorSprite; x: number; y: number; flip: boolean; foot: number }> = [];
  for (let corner = 0; corner < 4; corner++) {
    const left = corner % 2 === 0;
    const top = corner < 2;
    // TL(0)=A, TR(1)=B, BL(2)=B, BR(3)=A
    const tpl = corner === 0 || corner === 3 ? tplA : tplB;
    for (const { name, dx, dy } of tpl) {
      const sprite = getDecorSprite(name);
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
  for (const p of placed) p.sprite.draw(ctx, p.x, p.y, p.flip);
}

// ---------------------------------------------------------------------------
// Layer 4: plataforma central del Bastión (emblema de Poké Ball)
// ---------------------------------------------------------------------------

function drawBastionPlatform(ctx: CanvasRenderingContext2D): void {
  const sprite = getDecorSprite('common/platform');
  sprite.draw(ctx, Math.round(CENTER - sprite.w / 2), Math.round(CENTER - sprite.h / 2));
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
