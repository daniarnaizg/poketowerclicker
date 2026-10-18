/**
 * PokéBastion — single source of truth for ALL balance numbers (PRD §7.3).
 * Imported by core, renderer and UI. Never hardcode these values elsewhere.
 */

import { PokemonType } from '../core/types';
import type { BastionUpgradeId, Rarity, SwitchInEffect } from '../core/types';

// ---------------------------------------------------------------------------
// Arena & loop
// ---------------------------------------------------------------------------

/** Logical arena size in px (user-specified override of PRD's 144). */
export const ARENA_SIZE = 384;
/** Arena center — active Pokémon sits here. */
export const ARENA_CENTER = ARENA_SIZE / 2; // 192
/** Fixed simulation timestep in seconds (60 Hz deterministic core). */
export const FIXED_TIMESTEP = 1 / 60;

// ---------------------------------------------------------------------------
// Combat & timers
// ---------------------------------------------------------------------------

export const HOT_SWAP_COOLDOWN = 4; // seconds
export const BOSS_TIMER_DURATION = 30; // seconds
/** Global minimum effectiveness multiplier for immune pairs (PRD §3.2, Decision D5). */
export const IMMUNITY_FLOOR = 0.25;
/** Boss anchor interval (s) while at the bastion perimeter (Decision D1). */
export const BOSS_ANCHOR_TICK_SEC = 1.0;
/** Boss anchor damage per tick as a fraction of bastion max HP (Decision D1). */
export const BOSS_ANCHOR_MAX_HP_FRACTION = 0.05;

/** Boss timer duration in seconds by floor (PRD §5.1, Decision D1). */
export function bossTimerForFloor(floor: number): number {
  if (floor >= 100) return 60;
  if (floor >= 50) return 45;
  return 30;
}

/** Bastion damage taken when an enemy leaks through to the center. */
export const ENEMY_CONTACT_DAMAGE = 4;
/** Contact damage grows per floor: ENEMY_CONTACT_DAMAGE x (1 + (floor-1) x this). */
export const ENEMY_CONTACT_DAMAGE_FLOOR_SCALE = 0.01;
/** Automatic breather (s) between a cleared wave and the next floor spawn. */
export const INTER_WAVE_BREAK_SEC = 2.75;
export const TYPE_MULTIPLIER_SUPER_EFFECTIVE = 1.5;
export const TYPE_MULTIPLIER_NOT_EFFECTIVE = 0.65;
export const TYPE_MULTIPLIER_IMMUNE = 0;

/**
 * Enemies per normal wave (PRD §5.1).
 * @deprecated Kept for temporary compatibility during spawner transition. Use baseFloorEnemyCount / floorEnemyCount.
 */
export const WAVE_ENEMY_COUNT_BASE = 10;
/**
 * Boss HP multiplier vs a normal enemy of the same floor.
 * @deprecated Kept for temporary compatibility during spawner transition. Use bossHp.
 */
export const BOSS_HP_MULTIPLIER = 10;
/** Mini-boss every N floors. */
export const MINIBOSS_INTERVAL = 10;
/** Major boss floors (campaign). */
export const BIG_BOSS_FLOORS: readonly number[] = [50, 100];

// ---------------------------------------------------------------------------
// Economy & progression
// ---------------------------------------------------------------------------

/** Starters offered on the selection modal (order matters for UI). */
export const STARTER_IDS: readonly string[] = ['0004', '0007', '0001'];

/** Per-level stat scale from unified Team Level (stat x (1 + (L-1)*scale)). */
export const LEVEL_STAT_SCALE = 0.1;

/** Cost of the NEXT Team Level, given the current level (0-based purchase). */
export function teamLevelCost(currentLevel: number): number {
  return Math.floor(20 * Math.pow(1.22, currentLevel - 1));
}

/** Base projectile damage before atk/level scaling. */
export const PROJECTILE_BASE_DAMAGE = 60;
/** Base click damage before UP_CLICK and atk scaling. */
export const CLICK_BASE_DAMAGE = 60;
/** Held-click repeat interval (ms): caps hold-to-fire at 4 clicks/s. */
export const HOLD_FIRE_INTERVAL_MS = 250;
/** UP_ARROW: +10% projectile damage per level. */
export const ARROW_DAMAGE_PER_LEVEL = 0.10;
/** UP_CRIT: +1% crit chance per level. */
export const CRIT_CHANCE_PER_UP_CRIT = 0.01;
export const CRIT_CHANCE_CAP = 0.9;
/** Base attack speed multiplier when UP_SPD is first unlocked (level 1). */
export const AUTO_SPD_BASE_MULT = 0.5;
/** UP_SPD: +12% attack speed per level above 1. */
export const SPD_PER_LEVEL = 0.12;
/** UP_GOLD: +10% gold per level. */
export const GOLD_PER_LEVEL = 0.10;

/** Base HP at Team Level 1 for a species with hpFactor = 1.0 */
export const HP_BASE = 100;
/** Linear maxHp growth per Team Level above 1 (+10% per level) */
export const HP_LEVEL_SCALE = 0.1;
/** Extra maxHp cushion when the run team has only 1 Pokémon (matches legacy 130 HP bastion) */
export const SOLO_STARTER_HP_MULT = 1.3;
/**
 * Base leak damage on Floor 1 before type effectiveness.
 * @deprecated Superseded by D24 leakDamageForFloor formula.
 */
export const LEAK_BASE_DAMAGE = 14;
/**
 * Exponential leak damage growth per floor.
 * @deprecated Superseded by D24 leakDamageForFloor formula.
 */
export const LEAK_FLOOR_SCALE = 1.05;
/** Fainted Pokémon contribute 0% of bench passives and type synergies (D9) */
export const FAINTED_PASSIVE_FACTOR = 0;
/** First floor before which a Route Stop (Parada) opens */
export const SHOP_FIRST_FLOOR = 5;
/** Interval in floors between Route Stops (5, 15, 25, 35...) */
export const SHOP_EVERY_N_FLOORS = 10;

/** Maps a species canonical base HP (PokeAPI) into the [0.6, 1.8] hpFactor range */
export function hpFactorForBaseStat(baseHp: number): number {
  const normalized = 0.6 + ((baseHp - 30) / (160 - 30)) * 1.2;
  return Math.min(1.8, Math.max(0.6, Math.round(normalized * 100) / 100));
}

/** True if a Route Stop triggers before starting `floor` (5, 15, 25, 35...) */
export function isShopFloor(floor: number): boolean {
  return floor >= SHOP_FIRST_FLOOR && (floor - SHOP_FIRST_FLOOR) % SHOP_EVERY_N_FLOORS === 0;
}

/** Next floor (≥ currentFloor) that will have a Route Stop (5 for 1..5, 15 for 6..15, etc.) */
export function nextShopFloor(currentFloor: number): number {
  if (currentFloor <= SHOP_FIRST_FLOOR) return SHOP_FIRST_FLOOR;
  const steps = Math.ceil((currentFloor - SHOP_FIRST_FLOOR) / SHOP_EVERY_N_FLOORS);
  return SHOP_FIRST_FLOOR + steps * SHOP_EVERY_N_FLOORS;
}

/** UP_MULTI: max upgrade level (4) and max simultaneous shots/bounces (5). */
export const MULTI_MAX_LEVEL = 4;
export const MULTI_MAX = 5;

/** Crit damage multiplier including UP_CDMG (+10% of base critDmg per level). */
export function critMultiplier(baseCritDmg: number, upCdmgLevel: number): number {
  return baseCritDmg * (1 + upCdmgLevel * 0.1);
}

/** UP_AUTOCLICK cadence in clicks per second by upgrade level (PRD §3.2, §4.1). */
export const AUTOCLICK_CPS_BY_LEVEL: readonly number[] = [0, 1, 1.5, 2, 3, 4];
export const AUTOCLICK_MAX_LEVEL = 5;

/**
 * Cost of the NEXT level of a bastion upgrade.
 * Generic geometric curve; per-upgrade base costs below.
 */
const UPGRADE_BASE_COST: Record<BastionUpgradeId, number> = {
  UP_ARROW: 20,
  UP_SPD: 25,
  UP_MULTI: 150,
  UP_CRIT: 35,
  UP_CDMG: 40,
  UP_AUTOCLICK: 100,
  UP_GOLD: 50,
};

export function upgradeMaxLevel(id: BastionUpgradeId): number | undefined {
  if (id === 'UP_MULTI') return MULTI_MAX_LEVEL;
  if (id === 'UP_AUTOCLICK') return AUTOCLICK_MAX_LEVEL;
  return undefined;
}

export function upgradeCost(id: BastionUpgradeId, currentLevel: number): number {
  if (id === 'UP_MULTI') {
    return Math.floor(150 * Math.pow(3.2, currentLevel));
  }
  if (id === 'UP_AUTOCLICK') {
    return Math.floor(100 * Math.pow(2.8, currentLevel));
  }
  return Math.floor(UPGRADE_BASE_COST[id] * Math.pow(1.35, currentLevel));
}

/** Gold dropped by a normal enemy on floor N (Curva v2). */
export function enemyGoldValue(floor: number): number {
  return Math.floor(5 * Math.pow(1.102, floor - 1) + floor * 2);
}

/** Normal enemy speed px/s (slight floor scaling, capped). */
export function enemySpeed(floor: number): number {
  return Math.min(60, 20 + floor * 0.5);
}

// --- Spawner & Floor Rhythm (D20–D22, §2.1) ---
export const ALIVE_CAP = 70;
export const TUTORIAL_MAX_FLOOR = 3;
export const TUTORIAL_SPEED_FACTOR = 0.8;
export const HARD_FLOOR_ENEMY_MULT = 1.4;
export const HARD_FLOOR_WINDOW_MULT = 1.5;
export const BOSS_TRICKLE_ENABLED = true;
export const BOSS_TRICKLE_COUNT_FACTOR = 0.4;
export const BOSS_TRICKLE_GOLD_FACTOR = 0.15;
export const SPAWN_TIME_EXPONENT = 0.85;
export const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5));
export const SPAWN_ANGLE_JITTER_RAD = (15 * Math.PI) / 180;

export function isGrandBossFloor(floor: number): boolean {
  return floor >= 50 && floor % 50 === 0;
}

export function isMiniBossFloor(floor: number): boolean {
  return floor > 0 && floor % MINIBOSS_INTERVAL === 0 && !isGrandBossFloor(floor);
}

export function isBossFloor(floor: number): boolean {
  return isGrandBossFloor(floor) || isMiniBossFloor(floor);
}

export function isHardFloor(floor: number): boolean {
  return floor > 0 && floor % 5 === 4 && !isBossFloor(floor);
}

/** Base normal enemy count N(f) = clamp(round(8 + 1.0 * f), 9, 110). */
export function baseFloorEnemyCount(floor: number): number {
  const f = Math.max(1, Math.floor(floor));
  return Math.min(110, Math.max(9, Math.round(8 + 1.0 * f)));
}

/** Total enemies for floor (normal, hard, or boss trickle). */
export function floorEnemyCount(floor: number): number {
  const base = baseFloorEnemyCount(floor);
  if (isBossFloor(floor)) {
    return BOSS_TRICKLE_ENABLED ? Math.max(1, Math.round(BOSS_TRICKLE_COUNT_FACTOR * base)) : 0;
  }
  if (isHardFloor(floor)) {
    return Math.round(base * HARD_FLOOR_ENEMY_MULT);
  }
  return base;
}

/** Base spawn window S(f) in seconds. */
export function baseSpawnWindowSec(floor: number): number {
  const f = Math.max(1, Math.floor(floor));
  if (f > 100) {
    return Math.max(35, 55 - 0.1 * (f - 100));
  }
  return Math.min(55, 40 + 0.15 * f);
}

/** Effective spawn window S(f) for the floor (multiplied by 1.5 on hard floors). */
export function floorSpawnWindowSec(floor: number): number {
  const base = baseSpawnWindowSec(floor);
  if (isHardFloor(floor)) return base * HARD_FLOOR_WINDOW_MULT;
  return base;
}

// --- Economy per floor (D23, §3.1) ---
/** Invariant floor gold income W(f) = 10 * enemyGoldValue(f). */
export function floorGoldIncome(floor: number): number {
  return 10 * enemyGoldValue(floor);
}

/** Gold paid by a single stream enemy on floor `floor` (adds pay 0). */
export function goldPerEnemy(floor: number): number {
  const n = floorEnemyCount(floor);
  if (n <= 0) return 0;
  const w = floorGoldIncome(floor);
  if (isBossFloor(floor)) {
    return Math.max(1, Math.round((w * BOSS_TRICKLE_GOLD_FACTOR) / n));
  }
  return Math.max(1, Math.round(w / n));
}

/** Boss bounty: 1.0 * W(f) for mini-boss, 2.0 * W(f) for grand boss. */
export function bossBounty(floor: number): number {
  const w = floorGoldIncome(floor);
  return isGrandBossFloor(floor) ? Math.round(2.0 * w) : Math.round(1.0 * w);
}

// --- Enemy HP & Leaks (D24, §3.2–§3.3) ---
export const ENEMY_HP_BASE = 140;
export const ENEMY_HP_FLOOR_GROWTH = 1.075;

export function enemyHp(floor: number): number {
  return Math.max(1, Math.floor(ENEMY_HP_BASE * Math.pow(ENEMY_HP_FLOOR_GROWTH, Math.max(0, floor - 1))));
}

export const LEAK_KILL_FRACTION = 0.30;

export function expectedTeamLevel(floor: number): number {
  const f = Math.max(1, floor);
  return Math.max(1, Math.round(1 + 0.52 * (f - 1)));
}

export function maxHpRef(floor: number): number {
  return HP_BASE * (1 + (expectedTeamLevel(floor) - 1) * HP_LEVEL_SCALE);
}

export function leakDamageForFloor(floor: number): number {
  const n = isBossFloor(floor) ? baseFloorEnemyCount(floor) : floorEnemyCount(floor);
  return Math.max(1, Math.round(maxHpRef(floor) / (LEAK_KILL_FRACTION * Math.max(1, n))));
}

// --- Bosses by TTK & Phases (D25–D28, §4.1–§4.6) ---
export const BOSS_POOL_FACTOR_MINI = 0.6;
export const BOSS_POOL_FACTOR_GRAND = 1.2;
export const BOSS_PHASE_THRESHOLDS: readonly [number, number] = [0.66, 0.33];
export const BOSS_PHASE_INVULN_SEC = 1.5;
export const BOSS_PHASE_ANCHOR_FRACTION: readonly [number, number, number] = [0.05, 0.07, 0.09];
export const BOSS_PHASE_ANCHOR_TICK_SEC: readonly [number, number, number] = [1.0, 0.85, 0.70];
export const BOSS_PHASE_ADDS: readonly [number, number, number] = [0, 6, 8];

export type BossTimerMode = 'gameover' | 'enrage';
export const BOSS_TIMER_MODE: BossTimerMode = 'enrage';
export const BOSS_ENRAGE_INTERVAL_SEC = 10;
export const BOSS_ENRAGE_MULT_PER_STEP = 1.5;

export function bossHp(floor: number, speciesHpFactor = 1): number {
  const poolFactor = isGrandBossFloor(floor) ? BOSS_POOL_FACTOR_GRAND : BOSS_POOL_FACTOR_MINI;
  return Math.max(1, Math.floor(poolFactor * baseFloorEnemyCount(floor) * enemyHp(floor) * speciesHpFactor));
}

// ---------------------------------------------------------------------------
// Phase 2 — Ultimates (PRD §3.2). Damage/shape per move lives in data/ultimates.ts.
// Charge is TIME-based: `ultimate.cooldownSec` per species, so there are no
// per-hit / per-click charge constants.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Phase 2 — Switch-In (PRD §3.3) & status effects (PRD §3.1, 3★)
// ---------------------------------------------------------------------------

/** Radius (px) of the burst the incoming Pokémon detonates at the bastion. */
export const SWITCH_IN_RADIUS = 60;
/** Burst base damage = incoming ATK x this. */
export const SWITCH_IN_DAMAGE_MULTIPLIER = 2;

/** Duration (s) of each Switch-In effect when the incoming Pokémon has 3★+. */
export const SWITCH_IN_EFFECT_DURATION: Readonly<Record<SwitchInEffect, number>> = {
  BURN: 4,
  PARALYZE: 1.5,
  SLOW: 4,
  SHIELD: 3,
};
/** Status duration (s) applied by ultimates that carry one. */
export const ULTIMATE_STATUS_DURATION = 3;

/** Burn DPS = triggering hit damage × this. */
export const BURN_DPS_FACTOR = 0.6;
/** Movement multiplier while slowed. Paralysis freezes movement entirely. */
export const SLOW_SPEED_FACTOR = 0.5;
/** Bosses only suffer this fraction of a status duration. */
export const BOSS_STATUS_DURATION_FACTOR = 0.5;

/**
 * Which effect a 3★+ Switch-In applies, by the incoming Pokémon's PRIMARY type.
 * Every one of the 18 types is covered (enforced by a unit test).
 */
export const SWITCH_IN_EFFECT_BY_TYPE: Readonly<Record<PokemonType, SwitchInEffect>> = {
  [PokemonType.Fire]: 'BURN',
  [PokemonType.Poison]: 'BURN',
  [PokemonType.Bug]: 'BURN',
  [PokemonType.Dark]: 'BURN',
  [PokemonType.Electric]: 'PARALYZE',
  [PokemonType.Psychic]: 'PARALYZE',
  [PokemonType.Ghost]: 'PARALYZE',
  [PokemonType.Fighting]: 'PARALYZE',
  [PokemonType.Water]: 'SLOW',
  [PokemonType.Ice]: 'SLOW',
  [PokemonType.Grass]: 'SLOW',
  [PokemonType.Ground]: 'SLOW',
  [PokemonType.Normal]: 'SHIELD',
  [PokemonType.Flying]: 'SHIELD',
  [PokemonType.Rock]: 'SHIELD',
  [PokemonType.Steel]: 'SHIELD',
  [PokemonType.Dragon]: 'SHIELD',
  [PokemonType.Fairy]: 'SHIELD',
};

// ---------------------------------------------------------------------------
// Phase 2 — Awakening stars (PRD §3.1 "Lógica de las Estrellas de Despertar")
// ---------------------------------------------------------------------------

export const MAX_STARS = 5;
/** 2★: BENCH_PASSIVE unlocks. */
export const STAR_BENCH_PASSIVE = 2;
/** 3★: Switch-In applies a status / shield. */
export const STAR_SWITCH_IN = 3;
/** 4★: firing pattern evolves (pierce / bigger AoE / +1 bounce). */
export const STAR_PATTERN = 4;
/** 5★: Aura Apex (golden aura) + doubled BENCH_PASSIVE. Shiny is a separate 3C collectible. */
export const STAR_AURA_APEX = 5;
/** BENCH_PASSIVE multiplier at 5★ ("Duplica Pasiva"). */
export const BENCH_PASSIVE_MAX_STAR_MULTIPLIER = 2;
/**
 * PRD: the passive is granted "incluso estando en reserva". true = it applies to
 * every Pokémon in the 6-slot team (active or not). false = bench only, so the
 * active Pokémon does NOT buff the team (adds a tactical trade-off to swapping).
 */
export const BENCH_PASSIVE_ACTIVE_COUNTS = true;
/** Safety cap on any single aggregated passive bonus (+150%). */
export const BENCH_BONUS_CAP = 1.5;

/** 4★ AOE: base splash radius (px) and the 4★ multiplier. */
export const AOE_SPLASH_RADIUS = 36;
export const AOE_SPLASH_STAR_MULTIPLIER = 1.5;
/** Splash damage as a fraction of the direct hit. */
export const AOE_SPLASH_DAMAGE_FACTOR = 0.6;
/** 4★ SNIPER / PULSE: extra enemies a projectile passes through. */
export const SNIPER_PIERCE_AT_MAX_PATTERN = 2;
export const PULSE_PIERCE_AT_MAX_PATTERN = 3;
/** 4★ CHAIN: extra bounces. */
export const CHAIN_EXTRA_BOUNCES_AT_MAX_PATTERN = 1;

/** Fragments of Vínculo needed to reach each rank (index = target rank). */
export const AWAKEN_FRAGMENT_COST: readonly number[] = [0, 0, 3, 5, 8, 12];
/** Fragments granted by a duplicate pull, by rarity. */
export const DUPLICATE_FRAGMENTS: Readonly<Record<Rarity, number>> = {
  COMMON: 1,
  RARE: 2,
  EPIC: 4,
  LEGENDARY: 8,
};

// ---------------------------------------------------------------------------
// Phase 2 — Gacha (PRD §3.1)
// ---------------------------------------------------------------------------

/** Probability per rarity; must sum to 1 (enforced by a unit test). */
export const GACHA_RATES: Readonly<Record<Rarity, number>> = {
  COMMON: 0.6,
  RARE: 0.3,
  EPIC: 0.08,
  LEGENDARY: 0.02,
};
/** Pity: a ★★★+ is guaranteed every N pulls, a ★★★★ every M pulls. */
export const GACHA_PITY_EPIC = 30;
export const GACHA_PITY_LEGENDARY = 80;
/** Sellos de Reclutamiento per pull. */
export const GACHA_PULL_COST = 1;
export const GACHA_MULTI_PULL = 10;

// ---------------------------------------------------------------------------
// Phase 2 — Sellos de Reclutamiento income (PRD §3.1 "Moneda Gacha")
// ---------------------------------------------------------------------------

/** Welcome gift when the starter is chosen: one free 10-pull. */
export const STARTING_SEALS = 10;
/** First-ever victory over a Mini-Boss floor (every 10 floors). */
export const SEALS_FIRST_CLEAR_MINIBOSS = 3;
/** First-ever victory over a Major Boss floor (50 / 100). */
export const SEALS_FIRST_CLEAR_MAJOR_BOSS = 10;
/** "Ascensión": 1 seal per N floors reached at the end of every run. */
export const SEALS_ASCENSION_FLOORS_PER_SEAL = 5;

// ---------------------------------------------------------------------------
// Meta-progression (PRD §4.3)
// ---------------------------------------------------------------------------

/** Runas = floor((waveMax / 5) ^ 1.5). */
export function runePayout(waveMax: number): number {
  return Math.floor(Math.pow(waveMax / 5, 1.5));
}

/** Each rune: +4% global damage (meta, Phase 1 stores only). */
export const RUNE_DAMAGE_BONUS = 0.04;

// ---------------------------------------------------------------------------
// Aggregate snapshot (GameConfig consumers may pass this around)
// ---------------------------------------------------------------------------

export const BALANCE = Object.freeze({
  ARENA_SIZE,
  ARENA_CENTER,
  FIXED_TIMESTEP,
  HOT_SWAP_COOLDOWN,
  BOSS_TIMER_DURATION,
  ENEMY_CONTACT_DAMAGE,
  ENEMY_CONTACT_DAMAGE_FLOOR_SCALE,
  INTER_WAVE_BREAK_SEC,
  TYPE_MULTIPLIER_SUPER_EFFECTIVE,
  TYPE_MULTIPLIER_NOT_EFFECTIVE,
  TYPE_MULTIPLIER_IMMUNE,
  IMMUNITY_FLOOR,
  BOSS_ANCHOR_TICK_SEC,
  BOSS_ANCHOR_MAX_HP_FRACTION,
  bossTimerForFloor,
  WAVE_ENEMY_COUNT_BASE,
  BOSS_HP_MULTIPLIER,
  MINIBOSS_INTERVAL,
  BIG_BOSS_FLOORS,
  STARTER_IDS,
  LEVEL_STAT_SCALE,
  PROJECTILE_BASE_DAMAGE,
  CLICK_BASE_DAMAGE,
  ARROW_DAMAGE_PER_LEVEL,
  CRIT_CHANCE_PER_UP_CRIT,
  CRIT_CHANCE_CAP,
  AUTO_SPD_BASE_MULT,
  SPD_PER_LEVEL,
  GOLD_PER_LEVEL,
  HP_BASE,
  HP_LEVEL_SCALE,
  SOLO_STARTER_HP_MULT,
  LEAK_BASE_DAMAGE,
  LEAK_FLOOR_SCALE,
  FAINTED_PASSIVE_FACTOR,
  SHOP_FIRST_FLOOR,
  SHOP_EVERY_N_FLOORS,
  leakDamageForFloor,
  hpFactorForBaseStat,
  isShopFloor,
  nextShopFloor,
  MULTI_MAX_LEVEL,
  MULTI_MAX,
  RUNE_DAMAGE_BONUS,
  SWITCH_IN_RADIUS,
  SWITCH_IN_DAMAGE_MULTIPLIER,
  MAX_STARS,
  GACHA_PITY_EPIC,
  GACHA_PITY_LEGENDARY,
  GACHA_PULL_COST,
  STARTING_SEALS,
  AUTOCLICK_CPS_BY_LEVEL,
  AUTOCLICK_MAX_LEVEL,
  ALIVE_CAP,
  TUTORIAL_MAX_FLOOR,
  TUTORIAL_SPEED_FACTOR,
  HARD_FLOOR_ENEMY_MULT,
  HARD_FLOOR_WINDOW_MULT,
  BOSS_TRICKLE_ENABLED,
  BOSS_TRICKLE_COUNT_FACTOR,
  BOSS_TRICKLE_GOLD_FACTOR,
  SPAWN_TIME_EXPONENT,
  GOLDEN_ANGLE_RAD,
  SPAWN_ANGLE_JITTER_RAD,
  isGrandBossFloor,
  isMiniBossFloor,
  isBossFloor,
  isHardFloor,
  baseFloorEnemyCount,
  floorEnemyCount,
  baseSpawnWindowSec,
  floorSpawnWindowSec,
  floorGoldIncome,
  goldPerEnemy,
  bossBounty,
  ENEMY_HP_BASE,
  ENEMY_HP_FLOOR_GROWTH,
  enemyHp,
  LEAK_KILL_FRACTION,
  expectedTeamLevel,
  maxHpRef,
  BOSS_POOL_FACTOR_MINI,
  BOSS_POOL_FACTOR_GRAND,
  BOSS_PHASE_THRESHOLDS,
  BOSS_PHASE_INVULN_SEC,
  BOSS_PHASE_ANCHOR_FRACTION,
  BOSS_PHASE_ANCHOR_TICK_SEC,
  BOSS_PHASE_ADDS,
  BOSS_TIMER_MODE,
  BOSS_ENRAGE_INTERVAL_SEC,
  BOSS_ENRAGE_MULT_PER_STEP,
  bossHp,
});
