/**
 * PokéBastion — shared type contracts (binding for all 3 worker teams).
 *
 * PURE TYPESCRIPT: this file (and everything under src/core/) must never
 * import DOM, preact, react or browser APIs.
 */

// ---------------------------------------------------------------------------
// Elemental types & attack patterns
// ---------------------------------------------------------------------------

export enum PokemonType {
  Normal = 'NORMAL',
  Fire = 'FIRE',
  Water = 'WATER',
  Grass = 'GRASS',
  Electric = 'ELECTRIC',
  Ice = 'ICE',
  Fighting = 'FIGHTING',
  Poison = 'POISON',
  Ground = 'GROUND',
  Flying = 'FLYING',
  Psychic = 'PSYCHIC',
  Bug = 'BUG',
  Rock = 'ROCK',
  Ghost = 'GHOST',
  Dragon = 'DRAGON',
  Dark = 'DARK',
  Steel = 'STEEL',
  Fairy = 'FAIRY',
}

export enum AttackPattern {
  /** Fast long-range projectile at the enemy closest to the bastion. */
  SNIPER = 'SNIPER',
  /** Parabolic bombs exploding in an area (AoE). */
  AOE = 'AOE',
  /** Short-range concentric shockwaves. */
  PULSE = 'PULSE',
  /** Projectiles that bounce between multiple targets. */
  CHAIN = 'CHAIN',
}

// ---------------------------------------------------------------------------
// Species definitions (data-driven, see PRD §7.1)
// ---------------------------------------------------------------------------

export interface BaseStats {
  /** Attack multiplier for auto-shot and click damage. */
  atk: number;
  /** Base attack cadence, shots per second. */
  spd: number;
  /** Base crit chance, 0..1. */
  critRate: number;
  /** Base crit damage multiplier (e.g. 1.5 = +50% on crit). */
  critDmg: number;
}

export interface PokemonDefinition {
  /** Pokedex number as zero-padded string, e.g. "0004". */
  id: string;
  name: string;
  generation: number;
  types: [PokemonType] | [PokemonType, PokemonType];
  baseStats: BaseStats;
  pattern: AttackPattern;
  /** Canonical evolution: triggers when unified Team Level >= canonicalLevel. */
  evolution?: { targetId: string; canonicalLevel: number };
  ultimate: { id: string; name: string; energyCost: number };
  /** BENCH_PASSIVE: stat key + fractional bonus (0.08 = +8%). */
  benchPassive: { stat: string; value: number };
}

// ---------------------------------------------------------------------------
// Runtime entities
// ---------------------------------------------------------------------------

export interface Entity {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface PlayerPokemon extends Entity {
  /** Current species (changes on evolution). */
  definitionId: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  atk: number;
  spd: number;
  critRate: number;
  critDmg: number;
  pattern: AttackPattern;
  ultimateEnergy: number;
  ultimateMax: number;
  /** 0 = base form, 1 = first evolution, 2 = final evolution. */
  evolutionStage: number;
}

export interface Enemy extends Entity {
  types: [PokemonType] | [PokemonType, PokemonType];
  /** Pixels per second toward the arena center. */
  speed: number;
  goldValue: number;
  isBoss: boolean;
  /** Remaining seconds on the boss kill-timer (only when isBoss). */
  bossTimerSec?: number;
  /** Species id for sprite lookup / boss identity. */
  definitionId: string;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  types: [PokemonType] | [PokemonType, PokemonType];
  fromPlayer: boolean;
  /** Remaining pierce-through hits (0/undefined = dies on first hit). */
  pierce?: number;
  /** Remaining bounces for CHAIN pattern. */
  bounce?: number;
  /** Enemy ids already hit by this projectile (prevents double-hits). */
  hitIds?: number[];
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  /** CSS color string, e.g. '#ff4444'. */
  color: string;
  age: number;
  maxAge: number;
}

// ---------------------------------------------------------------------------
// Team & run state
// ---------------------------------------------------------------------------

export interface TeamSlot {
  /** 0..5 (UI shows index+1; hotkeys 1-6 map to 0-5). */
  index: number;
  pokemon: PlayerPokemon | null;
  isActive: boolean;
  /**
   * Mirror of GameState.hotSwapCooldowns[index], kept for convenience.
   * CANONICAL SOURCE: GameState.hotSwapCooldowns — core writes both,
   * UI should read the array.
   */
  hotSwapCooldownSec: number;
}

export interface RunStats {
  totalKills: number;
  totalGoldEarned: number;
  totalDamageDealt: number;
  /**
   * Damage dealt per team slot index (six entries, parallel to `team`).
   * NOTE: `number[6]` is not valid TS; a length-6 array carries the intent.
   */
  damagePerSlot: number[];
  /** Slot index (0..5) with highest damage contribution; -1 until set. */
  mvpSlotIndex: number;
  floorReached: number;
  durationSec: number;
  /** Set on game over: how the run ended. */
  defeatCause?: 'bastionDestroyed' | 'bossTimerExpired';
  /** First type of the enemy that destroyed the bastion, when known. */
  defeatEnemyType?: PokemonType;
}

export type BastionUpgradeId =
  | 'UP_CLICK'
  | 'UP_HP'
  | 'UP_MULTI'
  | 'UP_ARROW'
  | 'UP_SPD'
  | 'UP_CRIT'
  | 'UP_CDMG'
  | 'UP_GOLD';

export const BASTION_UPGRADE_IDS: readonly BastionUpgradeId[] = [
  'UP_CLICK',
  'UP_HP',
  'UP_MULTI',
  'UP_ARROW',
  'UP_SPD',
  'UP_CRIT',
  'UP_CDMG',
  'UP_GOLD',
] as const;

/** Level of each upgrade (0 = not purchased). */
export type BastionUpgrades = Record<BastionUpgradeId, number>;

export type GamePhase = 'STARTER_SELECT' | 'PLAYING' | 'GAME_OVER';

export type Team6 = [TeamSlot, TeamSlot, TeamSlot, TeamSlot, TeamSlot, TeamSlot];
export type Cooldowns6 = [number, number, number, number, number, number];

export interface GameState {
  phase: GamePhase;
  /** Current floor (1-based). */
  floor: number;
  /** Exactly 6 slots; invariant maintained by core. */
  team: Team6;
  /** Unified Team Level shared by all 6 Pokémon (PRD §4.1). */
  teamLevel: number;
  gold: number;
  bastionHp: number;
  bastionMaxHp: number;
  bastionUpgrades: BastionUpgrades;
  enemies: Enemy[];
  projectiles: Projectile[];
  floatingTexts: FloatingText[];
  /** Remaining boss kill-timer; undefined when no boss is active. */
  bossTimerSec?: number;
  /** Ultimate charge of the ACTIVE Pokémon mirrored at run level (0..ultimateMax). */
  ultimateCharge: number;
  ultimateMax: number;
  /** Enemies still to spawn/kill in the current wave. */
  waveEnemiesRemaining: number;
  /** Canonical hot-swap cooldowns per slot index, seconds remaining. */
  hotSwapCooldowns: Cooldowns6;
  runStats: RunStats;
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

export interface DamageEvent {
  targetId: number;
  amount: number;
  types: [PokemonType] | [PokemonType, PokemonType];
  isCrit: boolean;
  isSuperEffective: boolean;
}

/** Full effectiveness matrix; every type maps to every type (1.0 default). */
export type TypeChart = Readonly<Record<PokemonType, Readonly<Record<PokemonType, number>>>>;

// ---------------------------------------------------------------------------
// Config & input (core loop boundary)
// ---------------------------------------------------------------------------

export interface GameConfig {
  /** Species lookup by definitionId. */
  readonly pokedex: Readonly<Record<string, PokemonDefinition>>;
  readonly typeChart: TypeChart;
  /** Seed for the deterministic RNG. */
  readonly seed: number;
}

export interface GameInput {
  /** Arena click at logical coords (384x384 space). */
  click?: { x: number; y: number };
  /** Hot-swap to slot index 0..5. */
  hotSwapIndex?: number;
  /** Fire the active Pokémon's ultimate (Space). */
  useUltimate?: boolean;
  /** Purchase one level of a bastion upgrade. */
  buyUpgrade?: BastionUpgradeId;
  /** Purchase one Team Level (gold). */
  buyTeamLevel?: boolean;
  /** Starter selection (only valid in STARTER_SELECT phase). */
  selectStarter?: string;
}
