/**
 * PokéBastion — Canvas 2D arena renderer (384x384 logical px).
 * Draw-only: it reads the current GameState each frame and never mutates it.
 * CSS (arena.css) scales the fixed-size backing canvas to its container.
 */

import { ARENA } from '../config/arena.config';
import type {
  Enemy,
  Entity,
  FloatingText,
  GameState,
  PlayerPokemon,
  PokemonType,
  Projectile,
} from '../core/types';
import { typeColor, typeLetters } from './typeColors';
import { dirRow, drawSprite, getSprite, speciesForEnemy } from './sprites';
import type { AnimName } from './sprites';
import './arena.css';

const FULL_CIRCLE = Math.PI * 2;
const HP_BAR_WIDTH = 24;
const HP_BAR_HEIGHT = 3;
/** Vertical gap between a circle's top edge and its HP bar. */
const HP_BAR_GAP = 6;
const PIXEL_FONT = "'Press Start 2P', monospace";
const TYPE_FONT = `7px ${PIXEL_FONT}`;
const TEXT_FONT = `10px ${PIXEL_FONT}`;
const TILE = 32;
const INK = '#303030';

/** Oscurece un #rrggbb para el sombreado pixel-art de cada sprite. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

function drawEntityCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
): void {
  // Sprite cuadrado de pixel-art: marco, base, sombra inferior y brillo superior.
  const s = Math.round(r * 2);
  const left = Math.round(x - r);
  const top = Math.round(y - r);
  ctx.fillStyle = INK;
  ctx.fillRect(left - 2, top - 2, s + 4, s + 4);
  ctx.fillStyle = fill;
  ctx.fillRect(left, top, s, s);
  ctx.fillStyle = shade(fill, 0.72);
  ctx.fillRect(left, top + s - 4, s, 4);
  ctx.fillRect(left + s - 4, top, 4, s);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(left, top, s - 4, 3);
}

function drawTypeLabel(
  ctx: CanvasRenderingContext2D,
  types: readonly PokemonType[],
  x: number,
  y: number,
): void {
  ctx.fillStyle = '#ffffff';
  ctx.font = TYPE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(typeLetters(types), x, y);
}

function enemyRadius(enemy: Enemy): number {
  return enemy.isBoss ? ARENA.BOSS_HITBOX_R : ARENA.ENEMY_HITBOX_R;
}

export function renderBackground(ctx: CanvasRenderingContext2D): void {
  // Césped en damero de 32px, como una ruta de los juegos clásicos.
  for (let ty = 0; ty < ARENA.SIZE / TILE; ty++) {
    for (let tx = 0; tx < ARENA.SIZE / TILE; tx++) {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? '#78c850' : '#68b840';
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }

  // Plataforma del Bastión: círculo claro con borde discontinuo.
  const r = ARENA.PLAYER_HITBOX_R * 2;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(ARENA.CENTER, ARENA.CENTER, r, 0, FULL_CIRCLE);
  ctx.fill();
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Sombra elíptica bajo el sprite, teñida con el color del tipo primario. */
function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.1, r * 0.45, 0, 0, FULL_CIRCLE);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function renderPokemon(
  ctx: CanvasRenderingContext2D,
  pokemon: PlayerPokemon,
  x: number,
  y: number,
  opts: { now?: number; dx?: number; dy?: number; anim?: AnimName } = {},
): void {
  const r = ARENA.PLAYER_HITBOX_R;
  const set = getSprite(pokemon.definitionId);
  if (!set) {
    drawEntityCircle(ctx, x, y, r, typeColor(pokemon.types[0]));
    drawTypeLabel(ctx, pokemon.types, x, y);
    return;
  }
  drawShadow(ctx, x, y + r * 1.2, r, typeColor(pokemon.types[0]));
  drawSprite(ctx, set, opts.anim ?? 'idle', dirRow(opts.dx ?? 0, opts.dy ?? 1), opts.now ?? performance.now(), x, y, r * 4);
}

export function renderEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: Enemy[],
  now: number = performance.now(),
): void {
  // Orden por Y para que los de más abajo tapen a los de arriba.
  const alive = enemies.filter((e) => e.alive).sort((p, q) => p.y - q.y);
  for (const enemy of alive) {
    const r = enemyRadius(enemy);
    const set = getSprite(speciesForEnemy(enemy));
    if (set) {
      drawShadow(ctx, enemy.x, enemy.y + r * 1.2, r, typeColor(enemy.types[0]));
      const row = dirRow(ARENA.CENTER - enemy.x, ARENA.CENTER - enemy.y);
      drawSprite(ctx, set, 'walk', row, now + enemy.id * 137, enemy.x, enemy.y, r * 4);
    } else {
      drawEntityCircle(ctx, enemy.x, enemy.y, r, typeColor(enemy.types[0]));
      drawTypeLabel(ctx, enemy.types, enemy.x, enemy.y);
    }
    if (enemy.isBoss) drawCrown(ctx, enemy.x, enemy.y - r * 2 + 2);
  }
}

function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#F8D030';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 2);
  ctx.lineTo(x - 6, y - 7);
  ctx.lineTo(x - 3, y - 4);
  ctx.lineTo(x, y - 8);
  ctx.lineTo(x + 3, y - 4);
  ctx.lineTo(x + 6, y - 7);
  ctx.lineTo(x + 6, y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

export function renderProjectiles(
  ctx: CanvasRenderingContext2D,
  projectiles: Projectile[],
): void {
  for (const p of projectiles) {
    const d = ARENA.PROJECTILE_R * 2;
    ctx.fillStyle = INK;
    ctx.fillRect(Math.round(p.x - d / 2) - 2, Math.round(p.y - d / 2) - 2, d + 4, d + 4);
    ctx.fillStyle = typeColor(p.types[0]);
    ctx.fillRect(Math.round(p.x - d / 2), Math.round(p.y - d / 2), d, d);
  }
}

export function renderFloatingText(
  ctx: CanvasRenderingContext2D,
  texts: FloatingText[],
): void {
  ctx.font = TEXT_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of texts) {
    if (t.age >= t.maxAge) continue;
    const life = t.maxAge > 0 ? 1 - t.age / t.maxAge : 0;
    ctx.globalAlpha = Math.max(0, Math.min(1, life));
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

export function renderHPBar(
  ctx: CanvasRenderingContext2D,
  entity: Entity,
  x: number,
  y: number,
  width: number,
): void {
  const ratio = entity.maxHp > 0 ? Math.max(0, Math.min(1, entity.hp / entity.maxHp)) : 0;
  const left = x - width / 2;
  ctx.fillStyle = INK;
  ctx.fillRect(left - 2, y - 2, width + 4, HP_BAR_HEIGHT + 4);
  ctx.fillStyle = '#f8f8f0';
  ctx.fillRect(left, y, width, HP_BAR_HEIGHT);
  ctx.fillStyle = hpBarColor(ratio);
  ctx.fillRect(left, y, Math.round(width * ratio), HP_BAR_HEIGHT);
}

function hpBarColor(ratio: number): string {
  if (ratio > 0.5) return '#48c048';
  if (ratio >= 0.25) return '#f8d030';
  return '#f04040';
}

/** The team slot flagged active owns the Pokémon drawn at arena center. */
function activePokemon(state: GameState): PlayerPokemon | null {
  const slot = state.team.find((s) => s.isActive);
  return slot ? slot.pokemon : null;
}

export class ArenaRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private lastFireMs = -1e9;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('ArenaRenderer: Canvas 2D context unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    // Backing store stays at logical size; CSS scales it to the container.
    canvas.width = ARENA.SIZE;
    canvas.height = ARENA.SIZE;
    ctx.imageSmoothingEnabled = false; // pixel-art nítido
  }

  /** Redraw the whole arena from the current state, back to front. */
  render(state: GameState): void {
    const ctx = this.ctx;
    const now = performance.now();
    const active = activePokemon(state);
    const C = ARENA.CENTER;

    // El Pokémon activo mira al enemigo más cercano y ataca cuando acaba de disparar.
    let dx = 0;
    let dy = 1;
    let best = Infinity;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - C, e.y - C);
      if (d < best) { best = d; dx = e.x - C; dy = e.y - C; }
    }
    if (state.projectiles.some((p) => p.fromPlayer && Math.hypot(p.x - C, p.y - C) < 48)) {
      this.lastFireMs = now;
    }
    const anim: AnimName = now - this.lastFireMs < 350 ? 'attack' : 'idle';

    renderBackground(ctx);
    renderEnemies(ctx, state.enemies, now);
    renderProjectiles(ctx, state.projectiles);
    if (active) renderPokemon(ctx, active, C, C, { now, dx, dy, anim });
    renderFloatingText(ctx, state.floatingTexts);

    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      renderHPBar(ctx, enemy, enemy.x, enemy.y - enemyRadius(enemy) * 2 - HP_BAR_GAP, HP_BAR_WIDTH);
    }
    if (active) {
      renderHPBar(ctx, active, C, C - ARENA.PLAYER_HITBOX_R * 2 - HP_BAR_GAP, HP_BAR_WIDTH);
    }
  }

  destroy(): void {
    // Resetting the backing store clears the canvas and releases its bitmap.
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
