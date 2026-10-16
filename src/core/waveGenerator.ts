/**
 * PokéBastion — 360° radial wave generation with data-driven biomes & enemies (PRD §9.1.2–9.1.3).
 * PURE TYPESCRIPT: no DOM / browser imports. Deterministic: every random
 * decision is drawn from the injected `rng` (() => number in [0,1)).
 */

import type { Enemy, EnemyKind } from './types';
import { ARENA } from '../config/arena.config';
import {
  BIG_BOSS_FLOORS,
  BOSS_HP_MULTIPLIER,
  MINIBOSS_INTERVAL,
  WAVE_ENEMY_COUNT_BASE,
  bossTimerForFloor,
  enemyGoldValue,
  enemyHp,
  enemySpeed,
} from '../config/balance.config';
import { biomeAt } from '../data/biomes';
import { getEnemyDef } from '../data/enemies';

/** Bosses drop this many times a normal enemy's gold. */
const BOSS_GOLD_MULTIPLIER = BOSS_HP_MULTIPLIER;
/** Major bosses (floors 50/100) carry twice a mini-boss' HP. */
const BIG_BOSS_HP_FACTOR = 2;

/**
 * Spawn one enemy on the arena perimeter at `angle` (radians) and send it
 * toward the center. HP, gold, types and speed scale with the floor and enemy definition.
 */
export function spawnEnemyAt(
  angle: number,
  floor: number,
  isBoss: boolean,
  rng: () => number,
  speciesId?: string,
): Enemy {
  const radius = ARENA.CENTER;
  const x = ARENA.CENTER + Math.cos(angle) * radius;
  const y = ARENA.CENTER + Math.sin(angle) * radius;
  const isBigBoss = isBoss && BIG_BOSS_FLOORS.includes(floor);
  const biome = biomeAt(floor);

  let defId = speciesId;
  if (!defId) {
    if (isBoss) {
      defId = isBigBoss
        ? (biome.grandBosses?.[floor] ?? '0150')
        : (biome.miniBosses[floor] ?? '0127');
    } else {
      defId = biome.wild[Math.floor(rng() * biome.wild.length)];
    }
  }

  const def = getEnemyDef(defId);
  const hpFactor = def.hpFactor ?? 1;
  const speedFactor = def.speedFactor ?? 1;

  const baseHp = enemyHp(floor) * hpFactor;
  const hp = Math.max(
    1,
    Math.floor(baseHp * (isBoss ? BOSS_HP_MULTIPLIER * (isBigBoss ? BIG_BOSS_HP_FACTOR : 1) : 1)),
  );

  const kind: EnemyKind = isBoss ? (isBigBoss ? 'grandboss' : 'miniboss') : 'normal';

  return {
    // Ids are placeholders; the game loop assigns globally-unique ids when it
    // integrates the wave into the run state.
    id: 0,
    x,
    y,
    hp,
    maxHp: hp,
    alive: true,
    types: def.types,
    speed: enemySpeed(floor) * speedFactor,
    goldValue: Math.floor(
      enemyGoldValue(floor) * (isBoss ? BOSS_GOLD_MULTIPLIER * (isBigBoss ? BIG_BOSS_HP_FACTOR : 1) : 1),
    ),
    isBoss,
    bossTimerSec: isBoss ? bossTimerForFloor(floor) : undefined,
    definitionId: def.id,
    kind,
  };
}

/**
 * Build the wave for a floor:
 * - major boss (floors in BIG_BOSS_FLOORS): a single high-HP grand boss,
 * - mini-boss (every MINIBOSS_INTERVAL floors): a single mini-boss,
 * - otherwise: WAVE_ENEMY_COUNT_BASE normal enemies picked from the current biome.
 */
export function generateWave(floor: number, rng: () => number): Enemy[] {
  const isBigBoss = BIG_BOSS_FLOORS.includes(floor);
  const isMiniBoss = floor % MINIBOSS_INTERVAL === 0;

  if (isBigBoss || isMiniBoss) {
    const boss = { ...spawnEnemyAt(rng() * Math.PI * 2, floor, true, rng), id: 1 };
    return [boss];
  }

  const biome = biomeAt(floor);
  const wave: Enemy[] = [];
  for (let i = 0; i < WAVE_ENEMY_COUNT_BASE; i++) {
    const speciesId = biome.wild[Math.floor(rng() * biome.wild.length)];
    wave.push({
      ...spawnEnemyAt(rng() * Math.PI * 2, floor, false, rng, speciesId),
      id: i + 1,
    });
  }
  return wave;
}
