/**
 * PokéBastion — Canvas 2D arena renderer (384x384 logical px).
 * Draw-only: it reads the current GameState each frame and never mutates it.
 * CSS (arena.css) scales the fixed-size backing canvas to its container.
 */

import { ARENA } from '../config/arena.config';
import type {
  BiomeDefinition,
  BiomeId,
  Enemy,
  Entity,
  FloatingText,
  GameState,
  PlayerPokemon,
  PokemonType,
  Projectile,
  VisualEffect,
} from '../core/types';
import { MAX_STARS } from '../config/balance.config';
import { typeColor, typeLetters } from './typeColors';
import { dirRow, drawSprite, getSprite, speciesForEnemy } from './sprites';
import type { AnimName } from './sprites';
import { biomeAt, buildBackdrop } from '../data/biomes';
import './arena.css';

const FULL_CIRCLE = Math.PI * 2;
const HP_BAR_WIDTH = 24;
const HP_BAR_HEIGHT = 3;
/** Vertical gap between a circle's top edge and its HP bar. */
const HP_BAR_GAP = 6;
const PIXEL_FONT = "'Press Start 2P', monospace";
const TYPE_FONT = `7px ${PIXEL_FONT}`;
const TEXT_FONT = `10px ${PIXEL_FONT}`;
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

const backdropCache = new Map<BiomeId, HTMLCanvasElement>();

/** Returns cached pre-rendered backdrop canvas for the given biome. */
export function getBackdrop(biome: BiomeDefinition): HTMLCanvasElement {
  let canvas = backdropCache.get(biome.id);
  if (!canvas) {
    canvas = buildBackdrop(biome);
    backdropCache.set(biome.id, canvas);
  }
  return canvas;
}

export function clearBackdropCache(): void {
  backdropCache.clear();
}

export function renderBackground(
  ctx: CanvasRenderingContext2D,
  biome: BiomeDefinition = biomeAt(1),
): void {
  const canvas = getBackdrop(biome);
  if (canvas && typeof (canvas as any).getContext === 'function') {
    ctx.drawImage(canvas, 0, 0);
  }
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
  // 5★ Aura Apex: golden aura + sparkles behind the sprite.
  if ((pokemon.stars ?? 1) >= MAX_STARS) drawApexAura(ctx, x, y, r, opts.now ?? performance.now());
  if (!set) {
    drawEntityCircle(ctx, x, y, r, typeColor(pokemon.types[0]));
    drawTypeLabel(ctx, pokemon.types, x, y);
    return;
  }
  drawShadow(ctx, x, y + r * 1.2, r, typeColor(pokemon.types[0]));
  drawSprite(ctx, set, opts.anim ?? 'idle', dirRow(opts.dx ?? 0, opts.dy ?? 1), opts.now ?? performance.now(), x, y, r * 4);
}

/** Pulsing golden glow with four orbiting sparkles (5★ Aura Apex). */
function drawApexAura(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, now: number): void {
  const pulse = 0.75 + 0.25 * Math.sin(now / 260);
  const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4);
  g.addColorStop(0, `rgba(255,224,96,${0.55 * pulse})`);
  g.addColorStop(1, 'rgba(255,224,96,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, FULL_CIRCLE);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const a = now / 700 + (i * Math.PI) / 2;
    const sx = Math.round(x + Math.cos(a) * r * 1.9);
    const sy = Math.round(y + Math.sin(a) * r * 1.5);
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(sx - 1, sy - 3, 2, 6);
    ctx.fillRect(sx - 3, sy - 1, 6, 2);
  }
}

/** Translucent dome around the bastion while the 3★ Switch-In shield is up. */
function drawShield(ctx: CanvasRenderingContext2D, secLeft: number, now: number): void {
  const r = ARENA.BASTION_DAMAGE_R + 18;
  const blink = secLeft < 1 ? 0.5 + 0.5 * Math.sin(now / 60) : 1; // flickers before expiring
  ctx.globalAlpha = 0.28 * blink;
  ctx.fillStyle = '#58b0f8';
  ctx.beginPath();
  ctx.arc(ARENA.CENTER, ARENA.CENTER, r, 0, FULL_CIRCLE);
  ctx.fill();
  ctx.globalAlpha = 0.9 * blink;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#d8f0ff';
  ctx.stroke();
  ctx.globalAlpha = 1;
}

const STATUS_COLOR: Record<string, string> = {
  BURN: '#f08030',
  SLOW: '#58b0f8',
  PARALYZE: '#f8d030',
};

/** Small colored squares over an enemy for each active ailment. */
function drawStatusPips(ctx: CanvasRenderingContext2D, enemy: Enemy, y: number): void {
  const statuses = enemy.statuses;
  if (!statuses || statuses.length === 0) return;
  statuses.forEach((st, i) => {
    const px = Math.round(enemy.x - (statuses.length * 8) / 2 + i * 8);
    ctx.fillStyle = INK;
    ctx.fillRect(px - 1, y - 1, 8, 8);
    ctx.fillStyle = STATUS_COLOR[st.id] ?? INK;
    ctx.fillRect(px, y, 6, 6);
  });
}

/**
 * Estallido de clic / cambio de Pokémon al estilo Pokémon: anillo de cuadraditos
 * pixel-art (con contorno) que se expande girando un poco + chispa de 4 puntas
 * en el centro. Sin trazos suaves: todo en píxeles enteros.
 */
function drawPixelRing(ctx: CanvasRenderingContext2D, fx: VisualEffect, t: number, color: string): void {
  const fade = Math.max(0, 1 - t);
  const finalR = fx.radius ?? 14;
  const ease = 1 - (1 - t) * (1 - t);
  const r = finalR * (0.3 + 0.7 * ease);
  const n = Math.max(8, Math.min(24, Math.round(finalR * 0.8)));
  const size = finalR > 30 ? 4 : 3;
  const spin = t * 0.9;
  ctx.globalAlpha = Math.min(1, fade * 1.4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * FULL_CIRCLE + spin;
    const px = Math.round(fx.x + Math.cos(a) * r - size / 2);
    const py = Math.round(fx.y + Math.sin(a) * r - size / 2);
    ctx.fillStyle = INK;
    ctx.fillRect(px - 1, py - 1, size + 2, size + 2);
    ctx.fillStyle = i % 2 === 0 ? color : '#ffffff';
    ctx.fillRect(px, py, size, size);
  }
  // Chispa central de 4 puntas que se encoge.
  if (t < 0.75) {
    const arm = Math.max(1, Math.round((finalR > 30 ? 9 : 6) * (1 - t)));
    const cx = Math.round(fx.x);
    const cy = Math.round(fx.y);
    ctx.fillStyle = INK;
    ctx.fillRect(cx - arm - 1, cy - 2, arm * 2 + 3, 4);
    ctx.fillRect(cx - 2, cy - arm - 1, 4, arm * 2 + 3);
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(cx - arm, cy - 1, arm * 2 + 1, 2);
    ctx.fillRect(cx - 1, cy - arm, 2, arm * 2 + 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }
}

/** Ultimate beams / novas / flashes and switch-in rings; fades out with age. */
export function renderEffects(ctx: CanvasRenderingContext2D, effects: readonly VisualEffect[]): void {
  for (const fx of effects) {
    const t = fx.maxAge > 0 ? Math.min(1, fx.age / fx.maxAge) : 1;
    const fade = 1 - t;
    const color = typeColor(fx.type);
    ctx.save();
    if (fx.kind === 'BEAM' && fx.x2 !== undefined && fx.y2 !== undefined) {
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.85 * fade;
      ctx.strokeStyle = color;
      ctx.lineWidth = (fx.width ?? 30) * (1 - t * 0.4);
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y);
      ctx.lineTo(fx.x2, fx.y2);
      ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = (fx.width ?? 30) * 0.35;
      ctx.stroke();
    } else if (fx.kind === 'FLASH') {
      ctx.globalAlpha = 0.45 * fade;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, ARENA.SIZE, ARENA.SIZE);
    } else if (fx.kind === 'RING') {
      drawPixelRing(ctx, fx, t, color);
    } else {
      // NOVA: expanding circle.
      const radius = (fx.radius ?? 60) * (1 - (1 - t) * (1 - t));
      ctx.globalAlpha = (fx.kind === 'NOVA' ? 0.25 : 0.12) * fade;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, radius, 0, FULL_CIRCLE);
      ctx.fill();
      ctx.globalAlpha = 0.95 * fade;
      ctx.lineWidth = 2 + 4 * fade;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
    ctx.restore();
  }
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
    drawStatusPips(ctx, enemy, enemy.y - r * 2 - HP_BAR_GAP - 11);
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

    const biome = biomeAt(state.floor);
    renderBackground(ctx, biome);
    if ((state.bastionShieldSec ?? 0) > 0) drawShield(ctx, state.bastionShieldSec ?? 0, now);
    renderEnemies(ctx, state.enemies, now);
    renderProjectiles(ctx, state.projectiles);
    if (active) renderPokemon(ctx, active, C, C, { now, dx, dy, anim });
    renderEffects(ctx, state.effects ?? []);
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
