/**
 * PokéBastion — single source of truth for ALL balance numbers (PRD §7.3).
 * Imported by core, renderer and UI. Never hardcode these values elsewhere.
 */

import type { BastionUpgradeId } from '../core/types';

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
export const TYPE_MULTIPLIER_SUPER_EFFECTIVE = 1.5;
export const TYPE_MULTIPLIER_NOT_EFFECTIVE = 0.65;
export const TYPE_MULTIPLIER_IMMUNE = 0;

/** Enemies per normal wave (PRD §5.1). */
export const WAVE_ENEMY_COUNT_BASE = 10;
/** Boss HP multiplier vs a normal enemy of the same floor. */
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
export const PROJECTILE_BASE_DAMAGE = 10;
/** Base click damage before UP_CLICK and atk scaling. */
export const CLICK_BASE_DAMAGE = 15;
/** UP_ARROW: +8% projectile damage per level. */
export const ARROW_DAMAGE_PER_LEVEL = 0.08;
/** UP_CRIT: +1% crit chance per level. */
export const CRIT_CHANCE_PER_UP_CRIT = 0.01;
export const CRIT_CHANCE_CAP = 0.9;
/** UP_SPD: +5% attack speed per level. */
export const SPD_PER_LEVEL = 0.05;
/** UP_GOLD: +10% gold per level. */
export const GOLD_PER_LEVEL = 0.10;
/** UP_HP: +20 max bastion HP per level; passive regen 2%/s (PRD §4.1). */
export const HP_PER_LEVEL = 20;
export const BASTION_BASE_HP = 100;
export const BASTION_REGEN_FRACTION_PER_SEC = 0.02;
/** UP_MULTI: extra shots/bounces per level, capped (PRD: 1 to 9). */
export const MULTI_MAX = 9;

/** Crit damage multiplier including UP_CDMG (+10% of base critDmg per level). */
export function critMultiplier(baseCritDmg: number, upCdmgLevel: number): number {
  return baseCritDmg * (1 + upCdmgLevel * 0.1);
}

/**
 * Cost of the NEXT level of a bastion upgrade.
 * Generic geometric curve; per-upgrade base costs below.
 */
const UPGRADE_BASE_COST: Record<BastionUpgradeId, number> = {
  UP_CLICK: 15,
  UP_HP: 20,
  UP_MULTI: 120,
  UP_ARROW: 25,
  UP_SPD: 30,
  UP_CRIT: 40,
  UP_CDMG: 45,
  UP_GOLD: 50,
};

export function upgradeCost(id: BastionUpgradeId, currentLevel: number): number {
  return Math.floor(UPGRADE_BASE_COST[id] * Math.pow(1.35, currentLevel));
}

/** Gold dropped by a normal enemy on floor N. */
export function enemyGoldValue(floor: number): number {
  return Math.floor(5 + floor * 2);
}

/** Normal enemy HP on floor N. */
export function enemyHp(floor: number): number {
  return Math.floor(20 * Math.pow(1.18, floor - 1));
}

/** Normal enemy speed px/s (slight floor scaling, capped). */
export function enemySpeed(floor: number): number {
  return Math.min(60, 20 + floor * 0.5);
}

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
  TYPE_MULTIPLIER_SUPER_EFFECTIVE,
  TYPE_MULTIPLIER_NOT_EFFECTIVE,
  TYPE_MULTIPLIER_IMMUNE,
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
  SPD_PER_LEVEL,
  GOLD_PER_LEVEL,
  HP_PER_LEVEL,
  BASTION_BASE_HP,
  BASTION_REGEN_FRACTION_PER_SEC,
  MULTI_MAX,
  RUNE_DAMAGE_BONUS,
});
