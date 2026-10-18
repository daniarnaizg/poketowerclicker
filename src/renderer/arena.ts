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
  EnemyStrike,
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
import { animDurationMs, dirRow, drawSprite, getSprite, speciesForEnemy } from './sprites';
import type { AnimName } from './sprites';
import { decorReady, preloadDecor } from './decorSprites';
import { drawImpact, drawProjectile, preloadFx } from './fxSprites';
import { biomeAt, buildBackdrop } from '../data/biomes';
import './arena.css';

const FULL_CIRCLE = Math.PI * 2;
const HP_BAR_WIDTH = 24;
const BOSS_HP_BAR_WIDTH = 36;
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

// Los PNG editables de public/decor/ y public/fx/ se cargan una vez.
void preloadDecor();
void preloadFx();

export function renderBackground(
  ctx: CanvasRenderingContext2D,
  biome: BiomeDefinition = biomeAt(1),
): void {
  if (!decorReady()) {
    ctx.fillStyle = biome.palette.groundA;
    ctx.fillRect(0, 0, ARENA.SIZE, ARENA.SIZE);
    return;
  }
  const canvas = getBackdrop(biome);
  if (canvas && typeof (canvas as any).getContext === 'function') {
    ctx.drawImage(canvas, 0, 0);
  }
}

/** Sombra elíptica bajo el sprite, teñida con el color del tipo primario. */
function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  faint = false,
): void {
  ctx.fillStyle = faint ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.1, r * 0.45, 0, 0, FULL_CIRCLE);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = faint ? 1 : 2;
  ctx.stroke();
}

export function renderPokemon(
  ctx: CanvasRenderingContext2D,
  pokemon: PlayerPokemon,
  x: number,
  y: number,
  opts: { now?: number; dx?: number; dy?: number; anim?: AnimName; animMs?: number } = {},
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
  // `animMs` permite arrancar la animación de ataque en su primer frame; la escala se toma
  // siempre del frame de idle para que el ataque no "encoja" al Pokémon.
  drawSprite(
    ctx,
    set,
    opts.anim ?? 'idle',
    dirRow(opts.dx ?? 0, opts.dy ?? 1),
    opts.animMs ?? opts.now ?? performance.now(),
    x,
    y,
    r * 4,
    'idle',
  );
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
function drawStatusPips(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, y: number): void {
  const statuses = enemy.statuses;
  if (!statuses || statuses.length === 0) return;
  statuses.forEach((st, i) => {
    const px = Math.round(x - (statuses.length * 8) / 2 + i * 8);
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
    } else if (fx.kind === 'IMPACT') {
      drawImpact(ctx, fx.type, fx.x, fx.y, t);
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

/** Tras terminar la animación de ataque, el atacante se queda un instante en el último frame. */
const ATTACK_HOLD_MS = 150;
/** Fundido final del atacante normal antes de despawnear. */
const GHOST_FADE_MS = 140;
/** Distancia visual (px) del centro a la que se dibuja un atacante normal. */
const STRIKE_DRAW_DIST = ARENA.BASTION_DAMAGE_R + 10;
/** Cuánto se aparta visualmente un jefe anclado para no quedar tapado por el Pokémon central. */
const BOSS_ANCHOR_PUSH = 14;

function pushOutward(x: number, y: number, dist: number): { x: number; y: number } {
  const dx = x - ARENA.CENTER;
  const dy = y - ARENA.CENTER;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return { x: ARENA.CENTER, y: ARENA.CENTER - dist };
  return { x: ARENA.CENTER + (dx / d) * dist, y: ARENA.CENTER + (dy / d) * dist };
}

/**
 * Posición donde se DIBUJA un enemigo (no afecta a la simulación). Un jefe anclado en el
 * Bastión se aparta unos px hacia fuera para que se vea junto al Pokémon central, no detrás.
 */
export function enemyDrawPos(enemy: Enemy): { x: number; y: number } {
  if (enemy.isBoss && enemy.anchoredAtBastion) {
    const d = Math.hypot(enemy.x - ARENA.CENTER, enemy.y - ARENA.CENTER);
    return pushOutward(enemy.x, enemy.y, Math.max(d, ARENA.BASTION_DAMAGE_R) + BOSS_ANCHOR_PUSH);
  }
  return { x: enemy.x, y: enemy.y };
}

export interface DrawDescriptor {
  kind: 'enemy' | 'strike';
  y: number;
  front: boolean;
  x: number;
  r: number;
  enemy?: Enemy;
  strike?: EnemyStrike;
}

const descriptorPool: DrawDescriptor[] = [];

/** Strike más reciente de un enemigo (el de menor edad). */
function latestStrike(strikes: readonly EnemyStrike[], enemyId: number): EnemyStrike | null {
  let best: EnemyStrike | null = null;
  for (const st of strikes) if (st.enemyId === enemyId && (!best || st.age < best.age)) best = st;
  return best;
}

/** Pulsing golden barrier ring around an invulnerable boss. */
function drawBossInvulnRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  now: number,
): void {
  const pulse = 0.88 + 0.12 * Math.sin(now / 120);
  const ringR = r * 1.5 * pulse;
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, ringR, 0, FULL_CIRCLE);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, ringR + 3, 0, FULL_CIRCLE);
  ctx.stroke();
}

export function populateDescriptors(
  enemies: readonly Enemy[],
  strikes: readonly EnemyStrike[],
): DrawDescriptor[] {
  let idx = 0;
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;
    const r = enemyRadius(enemy);
    const pos = enemyDrawPos(enemy);
    const anchored = Boolean(enemy.isBoss && enemy.anchoredAtBastion);
    const front = anchored && pos.y > ARENA.CENTER;
    let desc = descriptorPool[idx];
    if (!desc) {
      desc = { kind: 'enemy', y: pos.y, front, x: pos.x, r, enemy };
      descriptorPool.push(desc);
    } else {
      desc.kind = 'enemy';
      desc.y = pos.y;
      desc.front = front;
      desc.x = pos.x;
      desc.r = r;
      desc.enemy = enemy;
      desc.strike = undefined;
    }
    idx++;
  }

  for (let i = 0; i < strikes.length; i++) {
    const st = strikes[i];
    if (st.isBoss) continue;
    const set = getSprite(speciesForEnemy(st));
    if (!set) continue;
    const atkMs = set.attack ? animDurationMs(set, 'attack') : 0;
    const lifeMs = atkMs + ATTACK_HOLD_MS;
    const ageMs = st.age * 1000;
    if (ageMs >= lifeMs) continue;
    const r = ARENA.ENEMY_HITBOX_R;
    const pos = pushOutward(st.x, st.y, STRIKE_DRAW_DIST);
    const front = pos.y > ARENA.CENTER;
    let desc = descriptorPool[idx];
    if (!desc) {
      desc = { kind: 'strike', y: pos.y, front, x: pos.x, r, strike: st };
      descriptorPool.push(desc);
    } else {
      desc.kind = 'strike';
      desc.y = pos.y;
      desc.front = front;
      desc.x = pos.x;
      desc.r = r;
      desc.enemy = undefined;
      desc.strike = st;
    }
    idx++;
  }

  descriptorPool.length = idx;
  descriptorPool.sort((p, q) => p.y - q.y);
  return descriptorPool;
}

export function drawDescriptor(
  ctx: CanvasRenderingContext2D,
  d: DrawDescriptor,
  strikes: readonly EnemyStrike[],
  now: number,
  aliveCount: number,
): void {
  if (d.kind === 'enemy') {
    const enemy = d.enemy!;
    const r = d.r;
    const pos = { x: d.x, y: d.y };
    const anchored = Boolean(enemy.isBoss && enemy.anchoredAtBastion);
    const set = getSprite(speciesForEnemy(enemy));
    const faintShadow = aliveCount > 40 && !enemy.isBoss;

    if (enemy.isBoss && (enemy.bossInvulnSec ?? 0) > 0) {
      drawBossInvulnRing(ctx, pos.x, pos.y, r, now);
    }

    if (set) {
      drawShadow(ctx, pos.x, pos.y + r * 1.2, r, typeColor(enemy.types[0]), faintShadow);
      const row = dirRow(ARENA.CENTER - pos.x, ARENA.CENTER - pos.y);
      if (anchored) {
        const strike = latestStrike(strikes, enemy.id);
        const atkMs = set.attack ? animDurationMs(set, 'attack') : 0;
        if (strike && set.attack && strike.age * 1000 < atkMs + ATTACK_HOLD_MS) {
          drawSprite(ctx, set, 'attack', row, Math.min(strike.age * 1000, atkMs - 1), pos.x, pos.y, r * 4, 'walk');
        } else {
          drawSprite(ctx, set, set.idle ? 'idle' : 'walk', row, now + enemy.id * 137, pos.x, pos.y, r * 4, 'walk');
        }
      } else {
        const animTime = enemy.isBoss ? now : Math.floor(now / 50) * 50;
        drawSprite(ctx, set, 'walk', row, animTime + enemy.id * 137, pos.x, pos.y, r * 4);
      }
    } else {
      drawEntityCircle(ctx, pos.x, pos.y, r, typeColor(enemy.types[0]));
      drawTypeLabel(ctx, enemy.types, pos.x, pos.y);
    }
    if (enemy.isBoss) drawCrown(ctx, pos.x, pos.y - r * 2 + 2);
    drawStatusPips(ctx, enemy, pos.x, pos.y - r * 2 - HP_BAR_GAP - 11);
  } else {
    const st = d.strike!;
    const set = getSprite(speciesForEnemy(st));
    if (!set) return;
    const atkMs = set.attack ? animDurationMs(set, 'attack') : 0;
    const lifeMs = atkMs + ATTACK_HOLD_MS;
    const ageMs = st.age * 1000;
    ctx.globalAlpha = Math.max(0, Math.min(1, (lifeMs - ageMs) / GHOST_FADE_MS));
    drawShadow(ctx, d.x, d.y + d.r * 1.2, d.r, typeColor(st.types[0]), aliveCount > 40);
    const row = dirRow(ARENA.CENTER - d.x, ARENA.CENTER - d.y);
    if (set.attack) {
      drawSprite(ctx, set, 'attack', row, Math.min(ageMs, atkMs - 1), d.x, d.y, d.r * 4, 'walk');
    } else {
      drawSprite(ctx, set, 'walk', row, now, d.x, d.y, d.r * 4);
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Dibuja enemigos y atacantes ordenados por Y. `layer` permite pintar en dos pasadas
 * ('back' antes del Pokémon central, 'front' después) para que un atacante situado
 * debajo del Pokémon central se vea delante de él.
 */
export function renderEnemies(
  ctx: CanvasRenderingContext2D,
  enemies: Enemy[],
  now: number = performance.now(),
  strikes: readonly EnemyStrike[] = [],
  layer: 'all' | 'back' | 'front' = 'all',
): void {
  const items = populateDescriptors(enemies, strikes);
  let aliveCount = 0;
  for (let i = 0; i < enemies.length; i++) {
    if (enemies[i].alive) aliveCount++;
  }
  for (let i = 0; i < items.length; i++) {
    const d = items[i];
    if (layer === 'all' || (layer === 'front') === d.front) {
      drawDescriptor(ctx, d, strikes, now, aliveCount);
    }
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
  now: number = performance.now(),
): void {
  for (const p of projectiles) {
    const angle = Math.atan2(p.vy, p.vx);
    drawProjectile(ctx, p.types[0], p.x, p.y, angle, now);
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

/**
 * Determina si debe dibujarse la barra de HP sobre un enemigo (§5 ítem ★3).
 * Solo se dibuja si es jefe, está dañado (hp < maxHp) o está cerca del Bastión (< 100 px).
 */
export function shouldRenderEnemyHpBar(enemy: Enemy): boolean {
  return Boolean(
    enemy.isBoss ||
    enemy.hp < enemy.maxHp ||
    Math.hypot(enemy.x - ARENA.CENTER, enemy.y - ARENA.CENTER) < 100
  );
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

  const e = entity as Partial<Enemy>;
  if (e.isBoss) {
    ctx.fillStyle = INK;
    ctx.fillRect(left + Math.round(width * 0.33), y, 1, HP_BAR_HEIGHT);
    ctx.fillRect(left + Math.round(width * 0.66), y, 1, HP_BAR_HEIGHT);
    if ((e.bossInvulnSec ?? 0) > 0) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1;
      ctx.strokeRect(left - 1, y - 1, width + 2, HP_BAR_HEIGHT + 2);
    }
  }
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
  /** Instante en que arrancó la última animación de ataque del Pokémon central. */
  private attackStartMs = -1e9;
  /** Ids de proyectiles del jugador ya vistos cerca del centro (detecta disparos NUEVOS). */
  private seenShots = new Set<number>();

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
    // Cada disparo nuevo reinicia la animación de ataque desde su primer frame.
    const shots = new Set<number>();
    let fired = false;
    for (const p of state.projectiles) {
      if (!p.fromPlayer || Math.hypot(p.x - C, p.y - C) >= 48) continue;
      shots.add(p.id);
      if (!this.seenShots.has(p.id)) fired = true;
    }
    this.seenShots = shots;
    if (fired) this.attackStartMs = now;
    const activeSet = active ? getSprite(active.definitionId) : null;
    const attackTotal = activeSet?.attack ? animDurationMs(activeSet, 'attack') : 350;
    const attacking = now - this.attackStartMs < attackTotal;
    const anim: AnimName = attacking ? 'attack' : 'idle';
    const animMs = attacking ? now - this.attackStartMs : now;

    const biome = biomeAt(state.floor);
    renderBackground(ctx, biome);
    if ((state.bastionShieldSec ?? 0) > 0) drawShield(ctx, state.bastionShieldSec ?? 0, now);
    const strikes = state.strikes ?? [];
    let aliveCount = 0;
    for (let i = 0; i < state.enemies.length; i++) {
      if (state.enemies[i].alive) aliveCount++;
    }
    const descriptors = populateDescriptors(state.enemies, strikes);

    for (let i = 0; i < descriptors.length; i++) {
      const d = descriptors[i];
      if (!d.front) drawDescriptor(ctx, d, strikes, now, aliveCount);
    }
    renderProjectiles(ctx, state.projectiles, now);
    if (active) renderPokemon(ctx, active, C, C, { now, dx, dy, anim, animMs });
    for (let i = 0; i < descriptors.length; i++) {
      const d = descriptors[i];
      if (d.front) drawDescriptor(ctx, d, strikes, now, aliveCount);
    }
    renderEffects(ctx, state.effects ?? []);
    renderFloatingText(ctx, state.floatingTexts);

    for (let i = 0; i < state.enemies.length; i++) {
      const enemy = state.enemies[i];
      if (!enemy.alive || !shouldRenderEnemyHpBar(enemy)) continue;
      const pos = enemyDrawPos(enemy);
      const width = enemy.isBoss ? BOSS_HP_BAR_WIDTH : HP_BAR_WIDTH;
      renderHPBar(ctx, enemy, pos.x, pos.y - enemyRadius(enemy) * 2 - HP_BAR_GAP, width);
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
