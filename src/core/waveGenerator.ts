/**
 * PokéBastion — 360° radial wave generation with data-driven biomes & enemies (PRD §9.1.2–9.1.3).
 * PURE TYPESCRIPT: no DOM / browser imports. Deterministic: every random
 * decision is drawn from the injected `rng` (() => number in [0,1)).
 */

import type { Enemy, SpawnTier } from './types';
import { ARENA } from '../config/arena.config';
import {
  BIG_BOSS_FLOORS,
  MINIBOSS_INTERVAL,
  TUTORIAL_MAX_FLOOR,
  TUTORIAL_SPEED_FACTOR,
  WAVE_ENEMY_COUNT_BASE,
  bossBounty,
  bossHp,
  bossTimerForFloor,
  enemyHp,
  enemySpeed,
  goldPerEnemy,
  isGrandBossFloor,
} from '../config/balance.config';
import { biomeAt } from '../data/biomes';
import { getEnemyDef } from '../data/enemies';
import { rngFor } from './rng';

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
  tier: SpawnTier = 'normal',
): Enemy {
  const radius = ARENA.SPAWN_HALF_EXTENT;
  const x = ARENA.CENTER + Math.cos(angle) * radius;
  const y = ARENA.CENTER + Math.sin(angle) * radius;
  const biome = biomeAt(floor);

  let defId = speciesId;
  if (!defId) {
    if (isBoss) {
      defId = isGrandBossFloor(floor)
        ? (biome.grandBosses?.[floor] ?? '0150')
        : (biome.miniBosses[floor] ?? '0127');
    } else {
      defId = biome.wild[Math.floor(rng() * biome.wild.length)];
    }
  }

  const def = getEnemyDef(defId);
  const hpFactor = def.hpFactor ?? 1;
  const speedFactor = def.speedFactor ?? 1;

  let speed = enemySpeed(floor) * speedFactor;
  if (!isBoss && floor <= TUTORIAL_MAX_FLOOR) {
    speed *= TUTORIAL_SPEED_FACTOR;
  }

  if (isBoss) {
    const hp = bossHp(floor, hpFactor);
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
      speed,
      goldValue: bossBounty(floor),
      isBoss: true,
      bossTimerSec: bossTimerForFloor(floor),
      definitionId: def.id,
      kind: isGrandBossFloor(floor) ? 'grandboss' : 'miniboss',
      bossPhase: 1,
      bossInvulnSec: 0,
      enraged: false,
      enrageElapsedSec: 0,
    };
  }

  const hp = Math.max(1, Math.floor(enemyHp(floor) * hpFactor));
  return {
    id: 0,
    x,
    y,
    hp,
    maxHp: hp,
    alive: true,
    types: def.types,
    speed,
    goldValue: tier === 'add' ? 0 : goldPerEnemy(floor),
    isBoss: false,
    bossTimerSec: undefined,
    definitionId: def.id,
    kind: tier === 'add' ? 'add' : 'normal',
    tier,
  };
}

/**
 * Deterministically spawn the boss for a given floor.
 * Uses isolated RNG stream channel 'WAVE', salt 99 to avoid perturbing floor plan stream.
 */
export function spawnBossForFloor(seed: number, floor: number): Enemy {
  const rng = rngFor(seed, 'WAVE', floor, 99);
  return spawnEnemyAt(rng() * Math.PI * 2, floor, true, rng);
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
