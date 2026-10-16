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
/** Bastion damage taken when an enemy leaks through to the center. */
export const ENEMY_CONTACT_DAMAGE = 4;
/** Contact damage grows per floor: ENEMY_CONTACT_DAMAGE x (1 + (floor-1) x this). */
export const ENEMY_CONTACT_DAMAGE_FLOOR_SCALE = 0.01;
/** Automatic breather (s) between a cleared wave and the next floor spawn. */
export const INTER_WAVE_BREAK_SEC = 2.75;
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
export const PROJECTILE_BASE_DAMAGE = 40;
/** Base click damage before UP_CLICK and atk scaling. */
export const CLICK_BASE_DAMAGE = 60;
/** Held-click repeat interval (ms): caps hold-to-fire at 4 clicks/s. */
export const HOLD_FIRE_INTERVAL_MS = 250;
/** UP_ARROW: +8% projectile damage per level. */
export const ARROW_DAMAGE_PER_LEVEL = 0.08;
/** UP_CRIT: +1% crit chance per level. */
export const CRIT_CHANCE_PER_UP_CRIT = 0.01;
export const CRIT_CHANCE_CAP = 0.9;
/** UP_SPD: +5% attack speed per level. */
export const SPD_PER_LEVEL = 0.05;
/** UP_GOLD: +10% gold per level. */
export const GOLD_PER_LEVEL = 0.10;
/** UP_HP: +20 max bastion HP per level; passive regen 3%/s (PRD §4.1). */
export const HP_PER_LEVEL = 20;
/** UP_WALL: +10% max bastion HP per level (with a matching heal). */
export const WALL_HP_PER_LEVEL = 0.1;
export const BASTION_BASE_HP = 130;
export const BASTION_REGEN_FRACTION_PER_SEC = 0.03;
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
  UP_WALL: 60,
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
  WALL_HP_PER_LEVEL,
  BASTION_BASE_HP,
  BASTION_REGEN_FRACTION_PER_SEC,
  MULTI_MAX,
  RUNE_DAMAGE_BONUS,
  SWITCH_IN_RADIUS,
  SWITCH_IN_DAMAGE_MULTIPLIER,
  MAX_STARS,
  GACHA_PITY_EPIC,
  GACHA_PITY_LEGENDARY,
  GACHA_PULL_COST,
  STARTING_SEALS,
});
