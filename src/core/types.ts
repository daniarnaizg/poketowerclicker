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
  /** Canonical base HP (PokeAPI), used to derive species maxHp. */
  hp: number;
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
  /** Signature move; cooldownSec is the charge time in seconds (see gameLoop). */
  ultimate: { id: string; name: string; cooldownSec: number };
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
  /** Seconds accumulated toward the ultimate (0..ultimateMax). */
  ultimateEnergy: number;
  /** Ultimate cooldown in seconds. */
  ultimateMax: number;
  /** 0 = base form, 1 = first evolution, 2 = final evolution. */
  evolutionStage: number;
  /**
   * Awakening rank 1..5 (PRD §3.1), copied from the collection at run start.
   * Optional: undefined is treated as 1★.
   * 5★ = Aura Apex (golden aura + doubled bench passive).
   */
  stars?: number;
  /** Shiny collectible flag (Phase 3C); always false in Phase 2. */
  shinyActive?: boolean;
}

export type EnemyKind = 'normal' | 'add' | 'miniboss' | 'grandboss' | 'runner' | 'shiny';

export type SpawnTier = 'normal' | 'add';

export interface SpawnEvent {
  index: number;
  tSec: number;
  angle: number;
  defId: string;
  tier: SpawnTier;
}

export type FloorKind = 'normal' | 'hard' | 'miniboss' | 'grandboss';

export interface FloorPlan {
  floor: number;
  kind: FloorKind;
  totalEnemies: number;
  spawnWindowSec: number;
  events: readonly SpawnEvent[];
}

export interface FloorRuntime {
  plan: FloorPlan;
  nextEventIdx: number;
  elapsedSec: number;
}

export interface RouteReport {
  fromFloor: number;
  toFloor: number;
  dominantTypes: PokemonType[];
  upcomingBoss?: { floor: number; definitionId: string; name: string; types: PokemonType[] };
}

export interface EnemyDefinition {
  /** Pokedex number as zero-padded string, e.g. "0019". */
  id: string;
  name: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  hpFactor?: number;
  speedFactor?: number;
}

export type BiomeId = 'RUTA_VERDE' | 'CUEVA_UMBRIA' | 'MONTE_IGNEO' | 'COSTA_RUINAS';

export interface BiomePalette {
  groundA: string;
  groundB: string;
  accent: string;
  pageBg: string;
  pageGrid: string;
  frameAccent: string;
}

export interface BiomeDefinition {
  id: BiomeId;
  name: string;
  floors: [number, number];
  typeWeights: Partial<Record<PokemonType, number>>;
  wild: string[];
  miniBosses: Record<number, string>;
  grandBosses?: Record<number, string>;
  runners: string[];
  palette: BiomePalette;
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
  /** Active status ailments (Phase 2); absent when the enemy is clean. */
  statuses?: StatusInstance[];
  /** Phase 3A: enemy category. */
  kind?: EnemyKind;
  /** Phase 3A (D1): true once a boss reaches the bastion perimeter and anchors there. */
  anchoredAtBastion?: boolean;
  /** Phase 3A (D1): seconds until next periodic boss strike while anchored. */
  bossAttackCooldownSec?: number;
  /** Phase 3C prep: special flags (e.g. typeless for loot runners). */
  flags?: { typeless?: boolean };
  /** Phase 3C prep: remaining lifetime for runners. */
  lifetimeSec?: number;
  /** Phase 3B prep: current boss phase index. */
  phaseIndex?: number;
  tier?: SpawnTier;
  bossPhase?: 1 | 2 | 3;
  bossInvulnSec?: number;
  enraged?: boolean;
  enrageElapsedSec?: number;
}

/** Status ailments applied by 3★ Switch-In bonuses and some ultimates. */
export type StatusKind = 'BURN' | 'PARALYZE' | 'SLOW';
/** Switch-In bonus effect: a status on enemies, or a temporary bastion shield. */
export type SwitchInEffect = StatusKind | 'SHIELD';

/** One active ailment on an enemy. */
export interface StatusInstance {
  /** 'BURN' | 'PARALYZE' | 'SLOW' (3B adds 'POISON', 'FREEZE'). */
  id: string;
  remainingSec: number;
  /** Unused in Phase 2; data prep for 3B synergies. */
  stacks?: number;
  /** Team slot credited with the damage/kills. */
  sourceSlot?: number;
  /** BURN only: damage/sec = fraction of the triggering hit. */
  dps?: number;
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
  /** AOE pattern: radius (px) of the explosion around the impacted enemy. */
  splashRadius?: number;
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

export interface FaintEntry {
  slot: number;
  definitionId: string;
  floor: number;
  cause: 'leak' | 'boss';
  killerType?: PokemonType;
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
  defeatCause?: 'teamWiped' | 'bossTimerExpired';
  /** First type of the enemy that destroyed the bastion, when known. */
  defeatEnemyType?: PokemonType;
  /** Phase 3A (I2): boss floors where the boss was actually killed (hp <= 0). */
  defeatedBossFloors?: number[];
  /** Phase 3A (§6.3): manual clicks fired by the player. */
  manualClicks?: number;
  /** Phase 3A (§6.3): automatic clicks fired by UP_AUTOCLICK. */
  autoClicks?: number;
  /** Phase 3A.2-V: log of Pokémon fainting events during the run. */
  faintLog?: FaintEntry[];
}

export type BastionUpgradeId =
  | 'UP_ARROW'
  | 'UP_SPD'
  | 'UP_MULTI'
  | 'UP_AUTOCLICK'
  | 'UP_CRIT'
  | 'UP_CDMG'
  | 'UP_GOLD';

export const BASTION_UPGRADE_IDS: readonly BastionUpgradeId[] = [
  'UP_ARROW',
  'UP_SPD',
  'UP_MULTI',
  'UP_AUTOCLICK',
  'UP_CRIT',
  'UP_CDMG',
  'UP_GOLD',
] as const;

/** Level of each upgrade (0 = not purchased; UP_AUTOCLICK optional for backward compat in tests; UP_CLICK legacy). */
export type BastionUpgrades = Record<Exclude<BastionUpgradeId, 'UP_AUTOCLICK'>, number> & {
  UP_AUTOCLICK?: number;
  UP_CLICK?: number;
};

/**
 * STARTER_SELECT: first launch only. MENU: between runs (Santuario / Caja).
 * Both accept `startRun` / `selectStarter` input; only PLAYING simulates.
 */
export type GamePhase = 'STARTER_SELECT' | 'MENU' | 'PLAYING' | 'GAME_OVER';

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
  bastionUpgrades: BastionUpgrades;
  enemies: Enemy[];
  projectiles: Projectile[];
  floatingTexts: FloatingText[];
  /** Remaining boss kill-timer; undefined when no boss is active. */
  bossTimerSec?: number;
  /** Ultimate charge of the ACTIVE Pokémon mirrored at run level (seconds, 0..ultimateMax). */
  ultimateCharge: number;
  /** Ultimate cooldown in seconds (mirror of the active Pokémon's). */
  ultimateMax: number;
  /** Enemies still to spawn/kill in the current wave (0 during the inter-wave break). */
  waveEnemiesRemaining: number;
  /** Auto-advance to the next floor after the breather; undefined = true. */
  autoAdvanceWave?: boolean;
  /** Seconds left on the inter-wave breather; undefined when none is running. */
  interWaveTimerSec?: number;
  /** true when the floor is cleared with auto-advance off (waiting for the player). */
  awaitingNextWave?: boolean;
  /** Canonical hot-swap cooldowns per slot index, seconds remaining. */
  hotSwapCooldowns: Cooldowns6;
  runStats: RunStats;
  /** Seconds of remaining bastion shield (3★ Switch-In); blocks contact damage. */
  bastionShieldSec?: number;
  /** Short-lived visual cues (ultimates, switch-in rings) consumed by the renderer. */
  effects?: VisualEffect[];
  /** Short-lived attack records (enemies hitting the bastion) consumed by the renderer. */
  strikes?: EnemyStrike[];
  floorRuntime?: FloorRuntime;
  nextEntityId?: number;
  shop?: unknown;
  phaseBannerText?: string;
}

/**
 * Purely cosmetic "hit" record: an enemy reached the bastion and attacked.
 * Normal enemies die in the same tick (gameplay is unchanged), so this lets the
 * renderer keep playing their Attack animation for a moment; bosses create one per
 * periodic strike. The core ages and expires it like floating text.
 */
export interface EnemyStrike {
  id: number;
  /** Id of the enemy that struck (the boss stays alive; normal enemies are already dead). */
  enemyId: number;
  /** Where the attacker stood when it struck (arena logical px). */
  x: number;
  y: number;
  /** Sprite lookup data (the enemy itself may no longer be in `enemies`). */
  definitionId: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  isBoss: boolean;
  age: number;
  maxAge: number;
}

/** Purely cosmetic effect; the core ages and expires it like floating text. */
export interface VisualEffect {
  id: number;
  kind: 'BEAM' | 'NOVA' | 'FLASH' | 'RING' | 'IMPACT';
  /** Origin (arena logical px). */
  x: number;
  y: number;
  /** BEAM end point. */
  x2?: number;
  y2?: number;
  /** NOVA / RING final radius. */
  radius?: number;
  /** Beam width (px). */
  width?: number;
  /** Primary elemental type; the renderer maps it to a color. */
  type: PokemonType;
  age: number;
  maxAge: number;
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
  readonly bossTimerMode?: 'gameover' | 'enrage';
}

export interface GameInput {
  /** Arena click at logical coords (384x384 space). */
  click?: { x: number; y: number; isAuto?: boolean };
  /** Hot-swap to slot index 0..5. */
  hotSwapIndex?: number;
  /** Fire the active Pokémon's ultimate (Space). */
  useUltimate?: boolean;
  /** Purchase one level of a bastion upgrade. */
  buyUpgrade?: BastionUpgradeId;
  /** Purchase one Team Level (gold). */
  buyTeamLevel?: boolean;
  /** Spawn the next floor now (skips the breather / the manual wait). */
  startNextWave?: boolean;
  /** Turn the automatic inter-wave advance on or off. */
  setAutoAdvance?: boolean;
  /** Starter selection (only valid in STARTER_SELECT / MENU phase). Starts a 1-Pokémon run. */
  selectStarter?: string;
  /**
   * Start a run with a 6-slot loadout (null = empty slot). Valid in
   * STARTER_SELECT / MENU. The first filled slot becomes the active Pokémon.
   */
  startRun?: (LoadoutEntry | null)[];
}

// ---------------------------------------------------------------------------
// Gacha / collection contracts (Phase 2, PRD §3.1)
// ---------------------------------------------------------------------------

/** Gacha rarity tiers: COMMON ★, RARE ★★, EPIC ★★★, LEGENDARY ★★★★. */
export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export const RARITIES: readonly Rarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;

/** One team slot as handed to the core at run start. */
export interface LoadoutEntry {
  /** Base-form species id of the line (the run evolves it via Team Level). */
  definitionId: string;
  /** Awakening rank 1..5. */
  stars: number;
  /** Shiny collectible flag (Phase 3C); always false in Phase 2. */
  shinyActive?: boolean;
}

// ---------------------------------------------------------------------------
// Ultimates (Phase 2, PRD §3.2)
// ---------------------------------------------------------------------------

/**
 * ARENA: hits every enemy. NOVA: burst around the bastion (radius = size).
 * BEAM: piercing line toward the nearest enemy (half-width = size).
 */
export type UltimateShape = 'ARENA' | 'NOVA' | 'BEAM';

export interface UltimateDef {
  shape: UltimateShape;
  /** Multiplier over PROJECTILE_BASE_DAMAGE. */
  power: number;
  /** NOVA radius / BEAM half-width, logical px. */
  size?: number;
  /** Ailment applied to every enemy hit. */
  status?: StatusKind;
}
