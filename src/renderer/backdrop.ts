/**
 * PokéBastion — Procedural pixel-art backdrop renderer (PRD §5.2, Block 3A.4).
 * Builds a 384×384 cached canvas per biome with 4 distinct visual layers:
 *   Layer 1: 32px tiled checkerboard ground.
 *   Layer 2: Deterministic micro-decorations (grass tufts, pebbles, cracks, specks).
 *   Layer 3: Corner macro-decorations outside radius 192:
 *     - RUTA_VERDE: pixel-art trees & leafy bushes.
 *     - CUEVA_UMBRIA: jagged stalagmites & glowing crystal clusters (#8a6fd0).
 *     - MONTE_IGNEO: dark volcanic crags & molten lava pool accents (#f08030).
 *     - COSTA_RUINAS: palm trees & broken marble ruin columns (#58a8d8).
 *   Layer 4: Central Bastion platform (radius 48 circle with subtle contrast & dashed border).
 */

import { ARENA } from '../config/arena.config';
import type { BiomeDefinition } from '../core/types';

const FULL_CIRCLE = Math.PI * 2;
const TILE = 32;
const TILES_PER_ROW = ARENA.SIZE / TILE; // 384 / 32 = 12
const CENTER = ARENA.CENTER; // 192

/** Fast deterministic pseudo-random generator based on integer coordinates and seed. */
function tileHash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1013904223) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Layer 2: Micro-decorations (grass, pebbles, cracks, embers)
// ---------------------------------------------------------------------------

function drawMicroDecorations(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  for (let ty = 0; ty < TILES_PER_ROW; ty++) {
    for (let tx = 0; tx < TILES_PER_ROW; tx++) {
      const v = tileHash(tx, ty, 1);
      const ox = Math.floor(tileHash(tx, ty, 2) * (TILE - 12)) + 6;
      const oy = Math.floor(tileHash(tx, ty, 3) * (TILE - 12)) + 6;
      const px = tx * TILE + ox;
      const py = ty * TILE + oy;

      // Skip micro-decorations inside central platform radius (48px)
      if (Math.hypot(px - CENTER, py - CENTER) < 52) continue;

      switch (biome.id) {
        case 'RUTA_VERDE': {
          if (v > 0.42) {
            // Grass blade tufts
            ctx.fillStyle = '#4c8c2c';
            ctx.fillRect(px, py, 2, 4);
            ctx.fillRect(px - 2, py + 1, 2, 3);
            ctx.fillRect(px + 2, py + 2, 2, 2);
            ctx.fillStyle = '#98e058';
            ctx.fillRect(px, py, 1, 2);
          }
          if (v > 0.82) {
            // Tiny flower or pebble
            const flower = v > 0.9;
            ctx.fillStyle = flower ? (v > 0.95 ? '#f8d030' : '#ffffff') : '#6e6a5c';
            ctx.fillRect(px + 5, py - 3, 3, 3);
            if (flower) {
              ctx.fillStyle = '#f08030';
              ctx.fillRect(px + 6, py - 2, 1, 1);
            }
          }
          break;
        }

        case 'CUEVA_UMBRIA': {
          if (v > 0.45) {
            // Small cavern stone / crack
            ctx.fillStyle = '#1c182c';
            ctx.fillRect(px, py, 4, 3);
            ctx.fillRect(px + 1, py - 1, 2, 1);
            ctx.fillStyle = '#4a3f62';
            ctx.fillRect(px + 1, py, 2, 1);
          }
          if (v > 0.8) {
            // Small glowing crystal shard
            ctx.fillStyle = '#8a6fd0';
            ctx.fillRect(px + 3, py + 2, 3, 4);
            ctx.fillStyle = '#d4c4ff';
            ctx.fillRect(px + 3, py + 2, 1, 2);
          }
          break;
        }

        case 'MONTE_IGNEO': {
          if (v > 0.45) {
            // Volcanic ground crack
            ctx.fillStyle = '#2d140e';
            ctx.fillRect(px, py, 5, 2);
            ctx.fillRect(px + 2, py + 2, 3, 2);
            ctx.fillStyle = '#4a2016';
            ctx.fillRect(px + 1, py, 2, 1);
          }
          if (v > 0.8) {
            // Glowing cinder / ember
            ctx.fillStyle = '#f08030';
            ctx.fillRect(px + 4, py - 2, 2, 2);
            ctx.fillStyle = '#f8d030';
            ctx.fillRect(px + 4, py - 2, 1, 1);
          }
          break;
        }

        case 'COSTA_RUINAS': {
          if (v > 0.45) {
            // Sand ripples / small seashell
            ctx.fillStyle = '#b8a870';
            ctx.fillRect(px, py, 5, 2);
            ctx.fillRect(px + 2, py + 2, 3, 1);
            ctx.fillStyle = '#f4e8c4';
            ctx.fillRect(px + 1, py, 2, 1);
          }
          if (v > 0.8) {
            // Weathered marble ruin fragment with cyan accent
            ctx.fillStyle = '#7a766c';
            ctx.fillRect(px + 3, py + 1, 3, 3);
            ctx.fillStyle = '#58a8d8';
            ctx.fillRect(px + 4, py + 2, 1, 1);
          }
          break;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Layer 3: Corner Macro-Decorations (outside radius 192)
// ---------------------------------------------------------------------------

/** RUTA_VERDE: Pixel-art tree */
function drawPixelTree(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  // Trunk
  ctx.fillStyle = '#42240c';
  ctx.fillRect(cx - 3, cy + 6, 6, 12);
  ctx.fillStyle = '#643815';
  ctx.fillRect(cx - 1, cy + 6, 2, 12);

  // Canopy layers
  const canopy = [
    { dy: -4, r: 16, c: '#1c4a18' },
    { dy: -8, r: 14, c: '#286822' },
    { dy: -12, r: 12, c: '#3c8830' },
    { dy: -16, r: 9, c: '#5cb844' },
    { dy: -19, r: 5, c: '#84d868' },
  ];
  for (const layer of canopy) {
    ctx.fillStyle = layer.c;
    ctx.beginPath();
    ctx.arc(cx, cy + layer.dy, layer.r, 0, FULL_CIRCLE);
    ctx.fill();
  }
}

/** RUTA_VERDE: Pixel-art bush */
function drawPixelBush(ctx: CanvasRenderingContext2D, cx: number, cy: number, r = 10): void {
  ctx.fillStyle = '#1c4a18';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, FULL_CIRCLE);
  ctx.fill();
  ctx.fillStyle = '#2e7426';
  ctx.beginPath();
  ctx.arc(cx, cy - 1, r, 0, FULL_CIRCLE);
  ctx.fill();
  ctx.fillStyle = '#4ca438';
  ctx.beginPath();
  ctx.arc(cx - 2, cy - 3, r * 0.65, 0, FULL_CIRCLE);
  ctx.fill();
  ctx.fillStyle = '#7cd85c';
  ctx.fillRect(cx - 3, cy - 5, 3, 3);
}

/** CUEVA_UMBRIA: Stalagmite spire */
function drawStalagmite(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number, w = 10): void {
  ctx.fillStyle = '#181424';
  ctx.beginPath();
  ctx.moveTo(cx - w, cy);
  ctx.lineTo(cx, cy - h);
  ctx.lineTo(cx + w, cy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2a223e';
  ctx.beginPath();
  ctx.moveTo(cx - Math.floor(w / 2), cy);
  ctx.lineTo(cx, cy - h);
  ctx.lineTo(cx + Math.floor(w / 2), cy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#483c66';
  ctx.fillRect(cx - 1, cy - Math.floor(h * 0.7), 2, Math.floor(h * 0.4));
}

/** CUEVA_UMBRIA: Glowing crystal cluster (#8a6fd0) */
function drawCrystalCluster(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  // Soft purple glow
  ctx.fillStyle = 'rgba(138, 111, 208, 0.22)';
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 20, 0, FULL_CIRCLE);
  ctx.fill();

  const crystals = [
    { ox: 0, oy: 0, w: 7, h: 22, rot: -0.05 },
    { ox: -7, oy: 4, w: 5, h: 16, rot: -0.22 },
    { ox: 7, oy: 3, w: 6, h: 18, rot: 0.2 },
    { ox: -12, oy: 8, w: 4, h: 10, rot: -0.4 },
  ];

  for (const cr of crystals) {
    ctx.save();
    ctx.translate(cx + cr.ox, cy + cr.oy);
    ctx.rotate(cr.rot);

    // Dark crystal edge
    ctx.fillStyle = '#543888';
    ctx.beginPath();
    ctx.moveTo(-cr.w, 0);
    ctx.lineTo(0, -cr.h);
    ctx.lineTo(cr.w, 0);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = '#8a6fd0';
    ctx.beginPath();
    ctx.moveTo(-cr.w + 2, 0);
    ctx.lineTo(0, -cr.h + 2);
    ctx.lineTo(cr.w - 1, 0);
    ctx.closePath();
    ctx.fill();

    // Glint highlight
    ctx.fillStyle = '#dfd4ff';
    ctx.fillRect(-1, -cr.h + 3, 2, Math.floor(cr.h * 0.5));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, -cr.h + 2, 1, 2);

    ctx.restore();
  }
}

/** MONTE_IGNEO: Molten lava pool accent (#f08030) */
function drawLavaPool(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx = 24, ry = 18): void {
  // Lava glow
  ctx.fillStyle = 'rgba(240, 128, 48, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 10, ry + 8, 0, 0, FULL_CIRCLE);
  ctx.fill();

  // Dark scorched perimeter
  ctx.fillStyle = '#1e0c08';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, 0, FULL_CIRCLE);
  ctx.fill();

  // Deep molten magma
  ctx.fillStyle = '#9e240a';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, FULL_CIRCLE);
  ctx.fill();

  // Bright molten orange
  ctx.fillStyle = '#f08030';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.72, ry * 0.68, 0, 0, FULL_CIRCLE);
  ctx.fill();

  // White-hot center
  ctx.fillStyle = '#f8d848';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.4, ry * 0.35, 0, 0, FULL_CIRCLE);
  ctx.fill();
}

/** MONTE_IGNEO: Dark lava rock */
function drawLavaRock(ctx: CanvasRenderingContext2D, cx: number, cy: number, w = 18, h = 14): void {
  ctx.fillStyle = '#140804';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2 + 1, h / 2 + 1, 0, 0, FULL_CIRCLE);
  ctx.fill();

  ctx.fillStyle = '#2d140e';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 1, w / 2 - 1, h / 2 - 1, 0, 0, FULL_CIRCLE);
  ctx.fill();

  ctx.fillStyle = '#4a2218';
  ctx.fillRect(cx - 2, cy - 3, Math.floor(w * 0.35), Math.floor(h * 0.3));

  // Small molten crack in rock
  ctx.fillStyle = '#f08030';
  ctx.fillRect(cx - 1, cy, 3, 1);
  ctx.fillRect(cx + 1, cy + 1, 2, 1);
}

/** COSTA_RUINAS: Broken marble column */
function drawBrokenColumn(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const w = 14;
  const h = 26;

  // Shadow base
  ctx.fillStyle = '#48443e';
  ctx.fillRect(cx - w / 2 - 2, cy + 2, w + 4, 6);

  // Column base plinth
  ctx.fillStyle = '#9c988c';
  ctx.fillRect(cx - w / 2 - 2, cy, w + 4, 4);
  ctx.fillStyle = '#dcd8cc';
  ctx.fillRect(cx - w / 2 - 1, cy - 2, w + 2, 3);

  // Fluted column body
  ctx.fillStyle = '#9c988c';
  ctx.fillRect(cx - w / 2, cy - h, w, h);

  // Fluting vertical stripes
  ctx.fillStyle = '#dedad0';
  ctx.fillRect(cx - w / 2 + 2, cy - h, 3, h);
  ctx.fillRect(cx + 2, cy - h, 3, h);

  // Broken jagged top
  ctx.fillStyle = '#48443e';
  ctx.fillRect(cx - w / 2, cy - h, 4, 3);
  ctx.fillRect(cx + 1, cy - h + 2, 3, 3);

  // Subtle cyan ruin glyph / moss accent (#58a8d8)
  ctx.fillStyle = '#58a8d8';
  ctx.fillRect(cx - 1, cy - Math.floor(h * 0.5), 2, 4);
  ctx.fillRect(cx - 3, cy - Math.floor(h * 0.5) + 1, 5, 2);
}

/** COSTA_RUINAS: Palm tree */
function drawPalmTree(ctx: CanvasRenderingContext2D, cx: number, cy: number, flipX = false): void {
  ctx.save();
  if (flipX) {
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.translate(-cx, -cy);
  }

  // Curved segmented trunk
  ctx.strokeStyle = '#5c3818';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 12);
  ctx.quadraticCurveTo(cx - 6, cy - 10, cx + 4, cy - 26);
  ctx.stroke();

  ctx.strokeStyle = '#945c2c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 12);
  ctx.quadraticCurveTo(cx - 6, cy - 10, cx + 4, cy - 26);
  ctx.stroke();

  // Palm fronds fanning out
  const frondApexX = cx + 4;
  const frondApexY = cy - 26;
  const fronds = [
    { dx: -18, dy: -8, c: '#2e7d32' },
    { dx: -14, dy: -18, c: '#388e3c' },
    { dx: 4, dy: -22, c: '#4caf50' },
    { dx: 18, dy: -14, c: '#388e3c' },
    { dx: 22, dy: -2, c: '#2e7d32' },
    { dx: 14, dy: 6, c: '#1b5e20' },
  ];

  for (const f of fronds) {
    ctx.strokeStyle = f.c;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(frondApexX, frondApexY);
    ctx.quadraticCurveTo(
      frondApexX + f.dx * 0.6,
      frondApexY + f.dy * 0.5 - 4,
      frondApexX + f.dx,
      frondApexY + f.dy,
    );
    ctx.stroke();
  }

  // Azure coastal accent speck
  ctx.fillStyle = '#58a8d8';
  ctx.fillRect(frondApexX - 1, frondApexY - 1, 2, 2);

  ctx.restore();
}

function drawCornerDecorations(ctx: CanvasRenderingContext2D, biome: BiomeDefinition): void {
  // Corner anchor points outside radius 192 from center (192, 192)
  // Corner centers at approx (32, 32), (352, 32), (32, 352), (352, 352).
  // Distance from (192, 192) to (32, 32) is ~226.3 px (> 192).

  switch (biome.id) {
    case 'RUTA_VERDE': {
      // Top-Left corner
      drawPixelTree(ctx, 32, 32);
      drawPixelBush(ctx, 58, 26, 9);
      drawPixelBush(ctx, 24, 60, 11);

      // Top-Right corner
      drawPixelTree(ctx, 352, 32);
      drawPixelBush(ctx, 326, 26, 9);
      drawPixelBush(ctx, 360, 60, 11);

      // Bottom-Left corner
      drawPixelTree(ctx, 32, 352);
      drawPixelBush(ctx, 58, 358, 9);
      drawPixelBush(ctx, 24, 324, 11);

      // Bottom-Right corner
      drawPixelTree(ctx, 352, 352);
      drawPixelBush(ctx, 326, 358, 9);
      drawPixelBush(ctx, 360, 324, 11);
      break;
    }

    case 'CUEVA_UMBRIA': {
      // Top-Left corner
      drawStalagmite(ctx, 16, 44, 26, 10);
      drawStalagmite(ctx, 44, 16, 22, 9);
      drawCrystalCluster(ctx, 30, 32);

      // Top-Right corner
      drawStalagmite(ctx, 368, 44, 26, 10);
      drawStalagmite(ctx, 340, 16, 22, 9);
      drawCrystalCluster(ctx, 354, 32);

      // Bottom-Left corner
      drawStalagmite(ctx, 16, 340, 26, 10);
      drawStalagmite(ctx, 44, 368, 22, 9);
      drawCrystalCluster(ctx, 30, 352);

      // Bottom-Right corner
      drawStalagmite(ctx, 368, 340, 26, 10);
      drawStalagmite(ctx, 340, 368, 22, 9);
      drawCrystalCluster(ctx, 354, 352);
      break;
    }

    case 'MONTE_IGNEO': {
      // Top-Left corner
      drawLavaPool(ctx, 30, 30, 24, 18);
      drawLavaRock(ctx, 58, 22, 16, 12);
      drawLavaRock(ctx, 22, 58, 14, 12);

      // Top-Right corner
      drawLavaPool(ctx, 354, 30, 24, 18);
      drawLavaRock(ctx, 326, 22, 16, 12);
      drawLavaRock(ctx, 362, 58, 14, 12);

      // Bottom-Left corner
      drawLavaPool(ctx, 30, 354, 24, 18);
      drawLavaRock(ctx, 58, 362, 16, 12);
      drawLavaRock(ctx, 22, 326, 14, 12);

      // Bottom-Right corner
      drawLavaPool(ctx, 354, 354, 24, 18);
      drawLavaRock(ctx, 326, 362, 16, 12);
      drawLavaRock(ctx, 362, 326, 14, 12);
      break;
    }

    case 'COSTA_RUINAS': {
      // Top-Left corner: Broken marble column
      drawBrokenColumn(ctx, 32, 40);
      drawBrokenColumn(ctx, 56, 22);

      // Top-Right corner: Palm tree
      drawPalmTree(ctx, 352, 44, false);
      drawBrokenColumn(ctx, 330, 36);

      // Bottom-Left corner: Palm tree
      drawPalmTree(ctx, 32, 340, true);
      drawBrokenColumn(ctx, 56, 356);

      // Bottom-Right corner: Broken marble column
      drawBrokenColumn(ctx, 352, 344);
      drawBrokenColumn(ctx, 328, 362);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Layer 4: Central Bastion Platform (radius 48)
// ---------------------------------------------------------------------------

function drawBastionPlatform(ctx: CanvasRenderingContext2D): void {
  const r = 48; // Radius ~48 px

  // Platform fill with subtle contrast
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, r, 0, FULL_CIRCLE);
  ctx.fill();

  // Subtle inner accent rim
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, r - 4, 0, FULL_CIRCLE);
  ctx.fill();

  // Dashed border
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.stroke();
  ctx.setLineDash([]);
}

// ---------------------------------------------------------------------------
// Main Public Function: buildBackdrop
// ---------------------------------------------------------------------------

/**
 * Builds and pre-renders a 384×384 canvas backdrop for the given biome (Block 3A.4).
 * Rendered once per biome transition; drawn via a single `drawImage` per frame.
 */
export function buildBackdrop(biome: BiomeDefinition): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    return {} as HTMLCanvasElement;
  }

  const canvas = document.createElement('canvas');
  canvas.width = ARENA.SIZE;
  canvas.height = ARENA.SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;

  // Layer 1: 32px tiled checkerboard ground
  for (let ty = 0; ty < TILES_PER_ROW; ty++) {
    for (let tx = 0; tx < TILES_PER_ROW; tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? biome.palette.groundA : biome.palette.groundB;
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }

  // Layer 2: Deterministic micro-decorations
  drawMicroDecorations(ctx, biome);

  // Layer 3: Corner macro-decorations (outside radius 192)
  drawCornerDecorations(ctx, biome);

  // Layer 4: Central Bastion platform (radius ~48 circle with dashed border)
  drawBastionPlatform(ctx);

  return canvas;
}
