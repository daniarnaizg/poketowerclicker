/**
 * PokéBastion — 360° radial wave generation.
 * PURE TYPESCRIPT: no DOM / browser imports. Deterministic: every random
 * decision is drawn from the injected `rng` (() => number in [0,1)).
 */

import { PokemonType } from './types';
import type { Enemy } from './types';
import { ARENA } from '../config/arena.config';
import {
  BIG_BOSS_FLOORS,
  BOSS_HP_MULTIPLIER,
  BOSS_TIMER_DURATION,
  MINIBOSS_INTERVAL,
  WAVE_ENEMY_COUNT_BASE,
  enemyGoldValue,
  enemyHp,
  enemySpeed,
} from '../config/balance.config';

const ALL_TYPES: readonly PokemonType[] = Object.values(PokemonType);

/** Chance a wild enemy rolls a second elemental type. */
const DUAL_TYPE_CHANCE = 0.3;
/** Bosses drop this many times a normal enemy's gold. */
const BOSS_GOLD_MULTIPLIER = BOSS_HP_MULTIPLIER;
/** Major bosses (floors 50/100) carry twice a mini-boss' HP. */
const BIG_BOSS_HP_FACTOR = 2;

function pickType(rng: () => number): PokemonType {
  const i = Math.min(ALL_TYPES.length - 1, Math.floor(rng() * ALL_TYPES.length));
  return ALL_TYPES[i];
}

function randomTypes(rng: () => number): [PokemonType] | [PokemonType, PokemonType] {
  const primary = pickType(rng);
  if (rng() < DUAL_TYPE_CHANCE) {
    const secondary = pickType(rng);
    if (secondary !== primary) return [primary, secondary];
  }
  return [primary];
}

/**
 * Spawn one enemy on the arena perimeter at `angle` (radians) and send it
 * toward the center. HP, gold and speed scale with the floor.
 */
export function spawnEnemyAt(
  angle: number,
  floor: number,
  isBoss: boolean,
  rng: () => number,
): Enemy {
  const radius = ARENA.CENTER;
  const x = ARENA.CENTER + Math.cos(angle) * radius;
  const y = ARENA.CENTER + Math.sin(angle) * radius;
  const hp = Math.max(1, Math.floor(enemyHp(floor) * (isBoss ? BOSS_HP_MULTIPLIER : 1)));

  return {
    // Ids are placeholders; the game loop assigns globally-unique ids when it
    // integrates the wave into the run state.
    id: 0,
    x,
    y,
    hp,
    maxHp: hp,
    alive: true,
    types: randomTypes(rng),
    speed: enemySpeed(floor),
    goldValue: Math.floor(enemyGoldValue(floor) * (isBoss ? BOSS_GOLD_MULTIPLIER : 1)),
    isBoss,
    bossTimerSec: isBoss ? BOSS_TIMER_DURATION : undefined,
    definitionId: isBoss ? 'BOSS' : 'WILD',
  };
}

/**
 * Build the wave for a floor:
 * - major boss (floors in BIG_BOSS_FLOORS): a single high-HP boss,
 * - mini-boss (every MINIBOSS_INTERVAL floors): a single boss,
 * - otherwise: WAVE_ENEMY_COUNT_BASE normal enemies at random angles.
 */
export function generateWave(floor: number, rng: () => number): Enemy[] {
  const isBigBoss = BIG_BOSS_FLOORS.includes(floor);
  const isMiniBoss = floor % MINIBOSS_INTERVAL === 0;

  if (isBigBoss || isMiniBoss) {
    const boss = { ...spawnEnemyAt(rng() * Math.PI * 2, floor, true, rng), id: 1 };
    if (isBigBoss) {
      const hp = boss.hp * BIG_BOSS_HP_FACTOR;
      return [{ ...boss, hp, maxHp: hp }];
    }
    return [boss];
  }

  const wave: Enemy[] = [];
  for (let i = 0; i < WAVE_ENEMY_COUNT_BASE; i++) {
    wave.push({ ...spawnEnemyAt(rng() * Math.PI * 2, floor, false, rng), id: i + 1 });
  }
  return wave;
}
