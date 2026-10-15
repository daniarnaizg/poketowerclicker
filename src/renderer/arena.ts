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
import './arena.css';

const FULL_CIRCLE = Math.PI * 2;
const HP_BAR_WIDTH = 24;
const HP_BAR_HEIGHT = 3;
/** Vertical gap between a circle's top edge and its HP bar. */
const HP_BAR_GAP = 6;
const TYPE_FONT = 'bold 9px monospace';
const TEXT_FONT = 'bold 10px monospace';

function drawEntityCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, FULL_CIRCLE);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.stroke();
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
  // Dim the world so bright entity colors stay legible at 1:1 scale.
  ctx.fillStyle = '#12141f';
  ctx.fillRect(0, 0, ARENA.SIZE, ARENA.SIZE);

  // Bastion pad: a soft ring centered on the active Pokémon.
  ctx.fillStyle = '#1c2138';
  ctx.beginPath();
  ctx.arc(ARENA.CENTER, ARENA.CENTER, ARENA.PLAYER_HITBOX_R * 2, 0, FULL_CIRCLE);
  ctx.fill();
}

export function renderPokemon(
  ctx: CanvasRenderingContext2D,
  pokemon: PlayerPokemon,
  x: number,
  y: number,
): void {
  drawEntityCircle(ctx, x, y, ARENA.PLAYER_HITBOX_R, typeColor(pokemon.types[0]));
  drawTypeLabel(ctx, pokemon.types, x, y);
}

export function renderEnemies(ctx: CanvasRenderingContext2D, enemies: Enemy[]): void {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const r = enemyRadius(enemy);
    drawEntityCircle(ctx, enemy.x, enemy.y, r, typeColor(enemy.types[0]));
    drawTypeLabel(ctx, enemy.types, enemy.x, enemy.y);
    if (enemy.isBoss) drawCrown(ctx, enemy.x, enemy.y - r);
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
}

export function renderProjectiles(
  ctx: CanvasRenderingContext2D,
  projectiles: Projectile[],
): void {
  for (const p of projectiles) {
    ctx.fillStyle = typeColor(p.types[0]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, ARENA.PROJECTILE_R, 0, FULL_CIRCLE);
    ctx.fill();
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
    const life = t.maxAge > 0 ? 1 - t.age / t.maxAge : 0;
    ctx.globalAlpha = Math.max(0, Math.min(1, life));
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
  ctx.fillStyle = '#000000';
  ctx.fillRect(left, y, width, HP_BAR_HEIGHT);
  ctx.fillStyle = hpBarColor(ratio);
  ctx.fillRect(left, y, width * ratio, HP_BAR_HEIGHT);
}

function hpBarColor(ratio: number): string {
  if (ratio > 0.5) return '#48d048';
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

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('ArenaRenderer: Canvas 2D context unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    // Backing store stays at logical size; CSS scales it to the container.
    canvas.width = ARENA.SIZE;
    canvas.height = ARENA.SIZE;
  }

  /** Redraw the whole arena from the current state, back to front. */
  render(state: GameState): void {
    const ctx = this.ctx;
    const active = activePokemon(state);

    renderBackground(ctx);
    renderEnemies(ctx, state.enemies);
    renderProjectiles(ctx, state.projectiles);
    if (active) renderPokemon(ctx, active, ARENA.CENTER, ARENA.CENTER);
    renderFloatingText(ctx, state.floatingTexts);

    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      renderHPBar(ctx, enemy, enemy.x, enemy.y - enemyRadius(enemy) - HP_BAR_GAP, HP_BAR_WIDTH);
    }
    if (active) {
      renderHPBar(
        ctx,
        active,
        ARENA.CENTER,
        ARENA.CENTER - ARENA.PLAYER_HITBOX_R - HP_BAR_GAP,
        HP_BAR_WIDTH,
      );
    }
  }

  destroy(): void {
    // Resetting the backing store clears the canvas and releases its bitmap.
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
