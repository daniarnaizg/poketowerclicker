/**
 * PokéBastion — pure deterministic floor plan & enemy stream generation (PRD §5.1, §9.1.2–9.1.3).
 * PURE TYPESCRIPT: no DOM / browser imports, no Math.random() or Date.now().
 */

import {
  BOSS_PHASE_ADDS,
  GOLDEN_ANGLE_RAD,
  SPAWN_ANGLE_JITTER_RAD,
  SPAWN_TIME_EXPONENT,
  floorEnemyCount,
  floorSpawnWindowSec,
  isBossFloor,
  isGrandBossFloor,
  isHardFloor,
  isMiniBossFloor,
} from '../config/balance.config';
import { biomeAt } from '../data/biomes';
import { getEnemyDef } from '../data/enemies';
import { rngFor } from './rng';
import type {
  BiomeDefinition,
  FloorKind,
  FloorPlan,
  PokemonType,
  RouteReport,
  SpawnEvent,
  SpawnTier,
} from './types';

const TAU = Math.PI * 2;

/**
 * Weighted wild species selector: weights each species id from biome.wild
 * by summing (biome.typeWeights[t] ?? 1) for each type t of the species.
 * Picks deterministically with a single call to rng().
 */
export function pickWeightedWildSpecies(biome: BiomeDefinition, rng: () => number): string {
  if (biome.wild.length === 0) {
    rng();
    return '0019';
  }

  const weights: number[] = new Array(biome.wild.length);
  let totalWeight = 0;
  for (let i = 0; i < biome.wild.length; i++) {
    const id = biome.wild[i];
    const def = getEnemyDef(id);
    let w = 0;
    for (const t of def.types) {
      w += biome.typeWeights[t] ?? 1;
    }
    weights[i] = w;
    totalWeight += w;
  }

  const roll = rng() * totalWeight;
  if (totalWeight <= 0) {
    return biome.wild[0];
  }

  let cumulative = 0;
  for (let i = 0; i < biome.wild.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative || i === biome.wild.length - 1) {
      return biome.wild[i];
    }
  }

  return biome.wild[biome.wild.length - 1];
}

/**
 * Builds the complete deterministic spawn plan for a floor.
 */
export function buildFloorPlan(seed: number, floor: number): FloorPlan {
  const rng = rngFor(seed, 'WAVE', floor);
  const biome = biomeAt(floor);

  let kind: FloorKind = 'normal';
  if (isGrandBossFloor(floor)) {
    kind = 'grandboss';
  } else if (isMiniBossFloor(floor)) {
    kind = 'miniboss';
  } else if (isHardFloor(floor)) {
    kind = 'hard';
  }

  const totalEnemies = floorEnemyCount(floor);
  const spawnWindowSec = floorSpawnWindowSec(floor);
  const baseAngle = rng() * TAU;

  const burstCounts = [0, 0, 0];
  if (kind === 'hard' && totalEnemies > 0) {
    for (let j = 0; j < totalEnemies; j++) {
      const b = Math.min(2, Math.floor((j * 3) / totalEnemies));
      burstCounts[b]++;
    }
  }
  const burstStartIndices = [
    0,
    burstCounts[0],
    burstCounts[0] + burstCounts[1],
  ];

  const events: SpawnEvent[] = [];
  let prevTSec = 0;

  for (let i = 0; i < totalEnemies; i++) {
    let tSec: number;
    if (kind === 'hard') {
      const burstIdx = Math.min(2, Math.floor((i * 3) / totalEnemies));
      const burstSpan = (spawnWindowSec / 3) * 0.65;
      const burstStart = burstIdx * ((spawnWindowSec - burstSpan) / 2);
      const burstStartIdx = burstStartIndices[burstIdx];
      const localIdx = i - burstStartIdx;
      const burstCount = Math.max(1, burstCounts[burstIdx]);
      const localRatio =
        localIdx === 0 ? 0 : Math.pow(localIdx / Math.max(1, burstCount - 1), SPAWN_TIME_EXPONENT);
      tSec = burstStart + burstSpan * localRatio;
    } else {
      tSec =
        i === 0
          ? 0
          : spawnWindowSec * Math.pow(i / Math.max(1, totalEnemies - 1), SPAWN_TIME_EXPONENT);
    }

    tSec = Number(tSec.toFixed(4));
    if (tSec < prevTSec) {
      tSec = prevTSec;
    }
    if (tSec < 0) {
      tSec = 0;
    }
    if (tSec > spawnWindowSec) {
      tSec = spawnWindowSec;
    }
    tSec = Number(tSec.toFixed(4));
    prevTSec = tSec;

    const jitter = (rng() * 2 - 1) * SPAWN_ANGLE_JITTER_RAD;
    const angle = ((baseAngle + i * GOLDEN_ANGLE_RAD + jitter) % TAU + TAU) % TAU;
    const defId = pickWeightedWildSpecies(biome, rng);

    events.push({
      index: i,
      tSec,
      angle,
      defId,
      tier: 'normal',
    });
  }

  return {
    floor,
    kind,
    totalEnemies,
    spawnWindowSec,
    events,
  };
}

/**
 * Builds deterministic adds spawned during boss phase transitions (phases 2 and 3).
 */
export function buildBossAddEvents(
  seed: number,
  floor: number,
  phase: 2 | 3,
  startElapsedSec: number,
  startIndex: number,
): SpawnEvent[] {
  const rng = rngFor(seed, 'WAVE', floor, phase);
  const biome = biomeAt(floor);
  const count = BOSS_PHASE_ADDS[phase - 1];
  if (count <= 0) {
    return [];
  }

  const baseAngle = rng() * TAU;
  const events: SpawnEvent[] = [];

  for (let k = 0; k < count; k++) {
    const jitter = (rng() * 2 - 1) * SPAWN_ANGLE_JITTER_RAD;
    const angle = ((baseAngle + k * GOLDEN_ANGLE_RAD + jitter) % TAU + TAU) % TAU;
    const defId = pickWeightedWildSpecies(biome, rng);
    const tSec = Number((startElapsedSec + (k / Math.max(1, count)) * 1.5).toFixed(4));

    events.push({
      index: startIndex + k,
      tSec,
      angle,
      defId,
      tier: 'add' as SpawnTier,
    });
  }

  return events;
}

/**
 * Previews upcoming enemy types and boss for a 10-floor route block.
 */
export function previewWave(seed: number, beforeFloor: number): RouteReport {
  const typeCounts = new Map<PokemonType, number>();

  for (let f = beforeFloor; f <= beforeFloor + 9; f++) {
    const plan = buildFloorPlan(seed, f);
    for (const ev of plan.events) {
      const def = getEnemyDef(ev.defId);
      for (const t of def.types) {
        typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
      }
    }
  }

  const dominantTypes = Array.from(typeCounts.entries())
    .sort((a, b) => {
      const diff = b[1] - a[1];
      if (diff !== 0) return diff;
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 3)
    .map(([type]) => type);

  let upcomingBoss: RouteReport['upcomingBoss'];
  for (let f = beforeFloor; f <= beforeFloor + 9; f++) {
    if (isBossFloor(f)) {
      const b = biomeAt(f);
      const bossDefId = isGrandBossFloor(f)
        ? (b.grandBosses?.[f] ?? '0150')
        : (b.miniBosses[f] ?? '0127');
      const def = getEnemyDef(bossDefId);
      upcomingBoss = {
        floor: f,
        definitionId: def.id,
        name: def.name,
        types: [...def.types],
      };
      break;
    }
  }

  const report: RouteReport = {
    fromFloor: beforeFloor,
    toFloor: beforeFloor + 9,
    dominantTypes,
  };
  if (upcomingBoss) {
    report.upcomingBoss = upcomingBoss;
  }
  return report;
}
