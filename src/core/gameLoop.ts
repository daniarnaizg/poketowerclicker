/**
 * PokéBastion — deterministic fixed-timestep game loop (headless core).
 * PURE TYPESCRIPT: no DOM / browser APIs. All randomness is injected via `rng`.
 *
 * Every update returns a NEW GameState; the input state is never mutated.
 * The renderer/UI drive this by calling tickGame once per animation frame and
 * pushing the returned state into the store.
 *
 * Phase 2 additions: loadout-based run start, BENCH_PASSIVE bonuses, enemy
 * status ailments + bastion shield, star-gated Switch-In / pattern upgrades,
 * and data-driven ultimates (data/ultimates.ts).
 */

import { AttackPattern, PokemonType } from './types';
import type {
  BastionUpgrades,
  Cooldowns6,
  Enemy,
  EnemyStrike,
  FloatingText,
  FloorRuntime,
  GameConfig,
  GameInput,
  GamePhase,
  GameState,
  LoadoutEntry,
  PlayerPokemon,
  PokemonDefinition,
  Projectile,
  RunStats,
  StatusInstance,
  StatusKind,
  Team6,
  TeamSlot,
  TypeChart,
  VisualEffect,
} from './types';
import { ARENA } from '../config/arena.config';
import {
  ALIVE_CAP,
  AOE_SPLASH_DAMAGE_FACTOR,
  AOE_SPLASH_RADIUS,
  AOE_SPLASH_STAR_MULTIPLIER,
  BOSS_ANCHOR_MAX_HP_FRACTION,
  BOSS_ANCHOR_TICK_SEC,
  BOSS_STATUS_DURATION_FACTOR,
  bossTimerForFloor,
  BURN_DPS_FACTOR,
  CHAIN_EXTRA_BOUNCES_AT_MAX_PATTERN,
  FIXED_TIMESTEP,
  HOT_SWAP_COOLDOWN,
  INTER_WAVE_BREAK_SEC,
  isBossFloor,
  leakDamageForFloor,
  MAX_STARS,
  PROJECTILE_BASE_DAMAGE,
  PULSE_PIERCE_AT_MAX_PATTERN,
  SLOW_SPEED_FACTOR,
  SNIPER_PIERCE_AT_MAX_PATTERN,
  STAR_PATTERN,
  STAR_SWITCH_IN,
  SWITCH_IN_DAMAGE_MULTIPLIER,
  SWITCH_IN_EFFECT_BY_TYPE,
  SWITCH_IN_EFFECT_DURATION,
  SWITCH_IN_RADIUS,
  ULTIMATE_STATUS_DURATION,
} from '../config/balance.config';
import { calculateDamage, getEffectiveness } from './damage';
import type { DamageAttacker } from './damage';
import { buildFloorPlan } from './floorPlan';
import { spawnBossForFloor, spawnEnemyAt } from './waveGenerator';
import { rngFor } from './rng';
import {
  attackSpeedMultiplier,
  goldMultiplier,
  projectileCount,
  purchaseUpgrade,
} from './bastionUpgrades';
import { computePokemonMaxHp, reconcileTeamMaxHp, upgradeTeamLevel } from './teamLevel';
import { computeTeamBonuses, damageBonusMultiplier, starsOf } from './passives';
import type { TeamBonuses } from './passives';
import { getUltimate } from '../data/ultimates';

const SWITCH_IN_SHIELD_SEC = SWITCH_IN_EFFECT_DURATION['SHIELD'];

const FIXED_STEP_MS = FIXED_TIMESTEP * 1000;
/** Cap sub-steps per call so a long frame stall cannot spiral. */
const MAX_STEPS_PER_TICK = 5;

/** Floating-text lifetime in seconds. */
const FLOATING_TEXT_MAX_AGE = 1.0;
/** How long an enemy strike record lives (covers the longest Attack animation). */
const ENEMY_STRIKE_MAX_AGE = 0.7;
/** Visual-effect lifetime in seconds, by kind. */
const EFFECT_MAX_AGE: Record<VisualEffect['kind'], number> = {
  BEAM: 0.35,
  NOVA: 0.5,
  FLASH: 0.4,
  RING: 0.45,
  IMPACT: 0.24,
};

/** Slot index currently flagged active, or -1 when the team is empty. */
function activeSlotIndex(state: GameState): number {
  return state.team.findIndex((s) => s.isActive);
}

function createFloatingText(
  id: number,
  x: number,
  y: number,
  text: string,
  color: string,
): FloatingText {
  return { id, x, y, text, color, age: 0, maxAge: FLOATING_TEXT_MAX_AGE };
}

function createEffect(
  id: number,
  kind: VisualEffect['kind'],
  type: PokemonType,
  x: number,
  y: number,
  extra: Partial<VisualEffect> = {},
): VisualEffect {
  return { id, kind, type, x, y, age: 0, maxAge: EFFECT_MAX_AGE[kind], ...extra };
}

/** Highest-damage slot index, or -1 when no slot has dealt damage. */
function mvpSlotOf(damagePerSlot: readonly number[]): number {
  let best = -1;
  let bestDamage = 0;
  for (let i = 0; i < damagePerSlot.length; i++) {
    if (damagePerSlot[i] > bestDamage) {
      bestDamage = damagePerSlot[i];
      best = i;
    }
  }
  return best;
}

/** Projectile travel speed (px/s) per attack pattern. */
const PROJECTILE_SPEED: Record<AttackPattern, number> = {
  [AttackPattern.SNIPER]: 260,
  [AttackPattern.AOE]: 150,
  [AttackPattern.PULSE]: 200,
  [AttackPattern.CHAIN]: 240,
};

const dist2ToCenter = (e: Enemy): number =>
  (e.x - ARENA.CENTER) ** 2 + (e.y - ARENA.CENTER) ** 2;

const enemyHitbox = (e: Enemy): number => (e.isBoss ? ARENA.BOSS_HITBOX_R : ARENA.ENEMY_HITBOX_R);

function getActive(state: GameState): PlayerPokemon | null {
  return state.team.find((slot) => slot.isActive)?.pokemon ?? null;
}

/** Highest entity id currently in play; used to allocate fresh ids. */
function maxEntityId(state: GameState): number {
  let max = 0;
  for (const e of state.enemies) if (e.id > max) max = e.id;
  for (const p of state.projectiles) if (p.id > max) max = p.id;
  for (const f of state.floatingTexts) if (f.id > max) max = f.id;
  for (const fx of state.effects ?? []) if (fx.id > max) max = fx.id;
  for (const st of state.strikes ?? []) if (st.id > max) max = st.id;
  for (const slot of state.team) if (slot.pokemon && slot.pokemon.id > max) max = slot.pokemon.id;
  return max;
}

function resolveNextEntityId(state: GameState): number {
  return state.nextEntityId ?? maxEntityId(state) + 1;
}

function attackerOf(active: PlayerPokemon | null, types: readonly PokemonType[]): DamageAttacker {
  return {
    atk: active?.atk ?? 50,
    critRate: active?.critRate ?? 0,
    critDmg: active?.critDmg ?? 1.5,
    types,
  };
}

// ---------------------------------------------------------------------------
// Status ailments (Phase 2)
// ---------------------------------------------------------------------------

/** Apply (or refresh) an ailment on an already-cloned enemy. Bosses resist duration. */
function applyStatus(
  enemy: Enemy,
  kind: StatusKind,
  durationSec: number,
  opts: { sourceDamage?: number; slot?: number } = {},
): void {
  const duration = durationSec * (enemy.isBoss ? BOSS_STATUS_DURATION_FACTOR : 1);
  const statuses = enemy.statuses ? [...enemy.statuses] : [];
  const i = statuses.findIndex((s) => s.id === kind);
  if (i >= 0) {
    const prev = statuses[i];
    statuses[i] = {
      ...prev,
      remainingSec: Math.max(prev.remainingSec, duration),
      ...(kind === 'BURN'
        ? {
            // Burn DPS scales with the triggering hit (PRD §9: fraction of the impact).
            dps: Math.max(prev.dps ?? 0, (opts.sourceDamage ?? 0) * BURN_DPS_FACTOR),
            sourceSlot: opts.slot ?? prev.sourceSlot,
          }
        : {}),
    };
  } else {
    statuses.push(
      kind === 'BURN'
        ? { id: kind, remainingSec: duration, dps: (opts.sourceDamage ?? 0) * BURN_DPS_FACTOR, sourceSlot: opts.slot }
        : { id: kind, remainingSec: duration },
    );
  }
  enemy.statuses = statuses;
}

/** Status list after `dt` seconds, or undefined when nothing is left. */
function tickStatus(statuses: readonly StatusInstance[], dt: number): StatusInstance[] | undefined {
  const next = statuses
    .map((s) => ({ ...s, remainingSec: s.remainingSec - dt }))
    .filter((s) => s.remainingSec > 0);
  return next.length > 0 ? next : undefined;
}

// ---------------------------------------------------------------------------
// Hits
// ---------------------------------------------------------------------------

interface HitOutcome {
  amount: number;
  killed: boolean;
  goldGained: number;
}

/** Gold paid for killing `enemy` (UP_GOLD + GOLD bench passives, additive). */
function goldFor(enemy: Enemy, state: GameState, bonuses: TeamBonuses): number {
  return Math.floor(enemy.goldValue * (goldMultiplier(state.bastionUpgrades) + bonuses.gold));
}

/** Apply one damage instance to a (cloned) enemy and report the outcome. */
function hitEnemy(
  enemy: Enemy,
  baseDmg: number,
  attacker: DamageAttacker,
  state: GameState,
  rng: () => number,
  config: GameConfig,
  bonuses: TeamBonuses,
): HitOutcome {
  const event = calculateDamage(
    { ...attacker, critRate: attacker.critRate + bonuses.critRate },
    enemy,
    baseDmg * damageBonusMultiplier(bonuses, attacker.types),
    state.teamLevel,
    state.bastionUpgrades,
    rng,
    config.typeChart,
  );
  enemy.hp -= event.amount;

  let killed = false;
  let goldGained = 0;
  if (enemy.alive && enemy.hp <= 0) {
    enemy.alive = false;
    killed = true;
    goldGained = goldFor(enemy, state, bonuses);
  }
  return { amount: event.amount, killed, goldGained };
}

function aimProjectileAtPoint(p: Projectile, tx: number, ty: number, speed: number): void {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    p.vx = 0;
    p.vy = speed;
  } else {
    p.vx = (dx / len) * speed;
    p.vy = (dy / len) * speed;
  }
}

function aimProjectile(p: Projectile, target: Enemy, speed: number): void {
  aimProjectileAtPoint(p, target.x, target.y, speed);
}

function createProjectileAtPoint(
  id: number,
  active: PlayerPokemon,
  tx: number,
  ty: number,
  speed: number,
  bounce: number,
): Projectile {
  const p: Projectile = {
    id,
    x: ARENA.CENTER,
    y: ARENA.CENTER,
    vx: 0,
    vy: 0,
    damage: PROJECTILE_BASE_DAMAGE,
    types: active.types,
    fromPlayer: true,
    hitIds: [],
  };
  aimProjectileAtPoint(p, tx, ty, speed);

  // 4★ "Evolución del Patrón de Disparo" (PRD §3.1).
  const evolved = starsOf(active) >= STAR_PATTERN;
  if (active.pattern === AttackPattern.AOE) {
    p.splashRadius = AOE_SPLASH_RADIUS * (evolved ? AOE_SPLASH_STAR_MULTIPLIER : 1);
  } else if (active.pattern === AttackPattern.SNIPER && evolved) {
    p.pierce = SNIPER_PIERCE_AT_MAX_PATTERN;
  } else if (active.pattern === AttackPattern.PULSE && evolved) {
    p.pierce = PULSE_PIERCE_AT_MAX_PATTERN;
  }
  if (bounce > 0) p.bounce = bounce;
  return p;
}

function createProjectile(
  id: number,
  active: PlayerPokemon,
  target: Enemy,
  speed: number,
  bounce: number,
): Projectile {
  return createProjectileAtPoint(id, active, target.x, target.y, speed, bounce);
}

/** Active Pokémon fires at the nearest enemies according to its SPD + pattern. */
function fireProjectiles(
  state: GameState,
  active: PlayerPokemon,
  enemies: Enemy[],
  rng: () => number,
  bonuses: TeamBonuses,
  allocId?: () => number,
): Projectile[] {
  const living = enemies.filter((e) => e.alive);
  if (living.length === 0) return [];

  const spdMult = attackSpeedMultiplier(state.bastionUpgrades);
  if (spdMult <= 0) return [];

  const expectedShots =
    active.spd * spdMult * (1 + bonuses.attackSpeed) * FIXED_TIMESTEP;
  const whole = Math.floor(expectedShots);
  const shots = whole + (rng() < expectedShots - whole ? 1 : 0);
  if (shots <= 0) return [];

  const multi = projectileCount(state.bastionUpgrades);
  const targets = [...living].sort((a, b) => dist2ToCenter(a) - dist2ToCenter(b)).slice(0, multi);
  const speed = PROJECTILE_SPEED[active.pattern];
  const chainBounces =
    multi - 1 + (starsOf(active) >= STAR_PATTERN ? CHAIN_EXTRA_BOUNCES_AT_MAX_PATTERN : 0);

  let fallbackId = allocId ? 0 : resolveNextEntityId(state);
  const nextId = allocId ?? (() => fallbackId++);
  const fired: Projectile[] = [];
  for (let s = 0; s < shots; s++) {
    if (active.pattern === AttackPattern.CHAIN) {
      fired.push(createProjectile(nextId(), active, targets[0], speed, chainBounces));
    } else {
      const count = Math.min(multi, targets.length);
      for (let t = 0; t < count; t++) fired.push(createProjectile(nextId(), active, targets[t], speed, 0));
    }
  }
  return fired;
}

/**
 * Computes a tactical score for a living candidate Pokémon against the current
 * alive enemies on the arena, combining offensive effectiveness, defensive
 * resistance, distance urgency (×3 weight for bosses) and remaining HP factor.
 */
export function swapScore(
  candidate: PlayerPokemon,
  enemies: readonly Enemy[],
  typeChart: TypeChart,
): number {
  if (!candidate.alive || candidate.hp <= 0) return -1;
  const hpRatio = Math.min(1, Math.max(0, candidate.hp / Math.max(1, candidate.maxHp)));
  const hpFactor = hpRatio < 0.25 ? 0.35 : 0.6 + 0.4 * hpRatio;
  const aliveEnemies = enemies.filter((e) => e.alive);
  if (aliveEnemies.length === 0) return hpFactor;

  const arenaRadius = ARENA.SIZE / 2;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const e of aliveEnemies) {
    const dist = Math.hypot(e.x - ARENA.CENTER, e.y - ARENA.CENTER);
    const w = (1 + 2 * Math.max(0, 1 - dist / arenaRadius)) * (e.isBoss ? 3 : 1);
    const offense = getEffectiveness(candidate.types, e.types, typeChart);
    const enemyEff = getEffectiveness(e.types, candidate.types, typeChart);
    const defense = 1 / Math.max(0.5, enemyEff);
    weightedSum += w * offense * Math.pow(defense, 0.35);
    totalWeight += w;
  }
  return hpFactor * (totalWeight > 0 ? weightedSum / totalWeight : 1);
}

function applySwitchInBurst(
  incoming: PlayerPokemon,
  slotIndex: number,
  team: readonly TeamSlot[],
  enemies: Enemy[],
  floor: number,
  teamLevel: number,
  bastionUpgrades: BastionUpgrades,
  config: GameConfig,
  rng: () => number,
  currentShield: number,
  startTextId: number,
  damagePerSlot: number[],
  defeatedBossFloors: number[],
  floatingTexts: FloatingText[],
  effects: VisualEffect[],
): {
  shield: number;
  damageDelta: number;
  killsDelta: number;
  goldDelta: number;
  nextTextId: number;
} {
  let shield = currentShield;
  let damageDelta = 0;
  let killsDelta = 0;
  let goldDelta = 0;
  let nextTextId = startTextId;

  const bonuses = computeTeamBonuses(team, config.pokedex);
  const attacker = attackerOf(incoming, incoming.types);
  const baseDmg = incoming.atk * SWITCH_IN_DAMAGE_MULTIPLIER;
  const caught: { enemy: Enemy; amount: number }[] = [];

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - ARENA.CENTER;
    const dy = enemy.y - ARENA.CENTER;
    if (dx * dx + dy * dy > SWITCH_IN_RADIUS * SWITCH_IN_RADIUS) continue;

    const event = calculateDamage(
      { ...attacker, critRate: attacker.critRate + bonuses.critRate },
      enemy,
      baseDmg * damageBonusMultiplier(bonuses, attacker.types),
      teamLevel,
      bastionUpgrades,
      rng,
      config.typeChart,
    );
    enemy.hp -= event.amount;
    damageDelta += event.amount;
    damagePerSlot[slotIndex] += event.amount;

    if (enemy.alive && enemy.hp <= 0) {
      enemy.alive = false;
      killsDelta += 1;
      const goldGained = Math.floor(enemy.goldValue * (goldMultiplier(bastionUpgrades) + bonuses.gold));
      goldDelta += goldGained;
      if (enemy.isBoss && !defeatedBossFloors.includes(floor)) {
        defeatedBossFloors.push(floor);
      }
    } else {
      caught.push({ enemy, amount: event.amount });
    }
    floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, `${event.amount}`, '#ffd166'));
  }

  // 3★+: the entry wave also carries a status (or a temporary bastion shield).
  if (starsOf(incoming) >= STAR_SWITCH_IN) {
    const effect = SWITCH_IN_EFFECT_BY_TYPE[incoming.types[0]];
    const duration = SWITCH_IN_EFFECT_DURATION[effect];
    if (effect === 'SHIELD') {
      shield = Math.max(shield, SWITCH_IN_SHIELD_SEC);
    } else {
      for (const { enemy, amount } of caught) {
        applyStatus(enemy, effect, duration, { sourceDamage: amount, slot: slotIndex });
      }
    }
  }

  effects.push(
    createEffect(nextTextId++, 'RING', incoming.types[0], ARENA.CENTER, ARENA.CENTER, {
      radius: SWITCH_IN_RADIUS,
    }),
  );

  return {
    shield,
    damageDelta,
    killsDelta,
    goldDelta,
    nextTextId,
  };
}

function createPlayerPokemon(
  def: PokemonDefinition,
  id: number,
  stars = 1,
  teamLevel = 1,
  maxHpBonus = 0,
  isSoloTeam = false,
  shinyActive = false,
): PlayerPokemon {
  const maxHp = computePokemonMaxHp(def, teamLevel, maxHpBonus, isSoloTeam);
  return {
    id,
    x: ARENA.CENTER,
    y: ARENA.CENTER,
    hp: maxHp,
    maxHp,
    alive: true,
    definitionId: def.id,
    types: def.types,
    atk: def.baseStats.atk,
    spd: def.baseStats.spd,
    critRate: def.baseStats.critRate,
    critDmg: def.baseStats.critDmg,
    pattern: def.pattern,
    ultimateEnergy: 0,
    ultimateMax: def.ultimate.cooldownSec,
    evolutionStage: 0,
    stars: Math.max(1, Math.min(MAX_STARS, Math.floor(stars))),
    shinyActive,
  };
}

function emptySlot(index: number): TeamSlot {
  return { index, pokemon: null, isActive: false, hotSwapCooldownSec: 0 };
}

function syncCooldownMirrors(team: Team6, cooldowns: Cooldowns6): Team6 {
  return team.map((slot, i) =>
    slot.hotSwapCooldownSec === cooldowns[i] ? slot : { ...slot, hotSwapCooldownSec: cooldowns[i] },
  ) as Team6;
}

function initFloorRuntime(
  seed: number,
  floor: number,
  startNextId: number,
): { floorRuntime: FloorRuntime; initialEnemies: Enemy[]; nextId: number } {
  const plan = buildFloorPlan(seed, floor);
  let nextId = startNextId;
  const initialEnemies: Enemy[] = [];
  if (isBossFloor(floor)) {
    const boss = spawnBossForFloor(seed, floor);
    initialEnemies.push({ ...boss, id: nextId++ });
  }
  const rng = rngFor(seed, 'WAVE', floor);
  let nextEventIdx = 0;
  while (
    nextEventIdx < plan.events.length &&
    plan.events[nextEventIdx].tSec <= 0 &&
    initialEnemies.length < ALIVE_CAP
  ) {
    const ev = plan.events[nextEventIdx++];
    const e = spawnEnemyAt(ev.angle, floor, false, rng, ev.defId, ev.tier);
    initialEnemies.push({ ...e, id: nextId++ });
  }
  return {
    floorRuntime: { plan, nextEventIdx, elapsedSec: 0 },
    initialEnemies,
    nextId,
  };
}

function countAliveFloorEnemies(enemies: readonly Enemy[]): number {
  let count = 0;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.alive && !(e as Enemy & { isFleeing?: boolean }).isFleeing) count++;
  }
  return count;
}

function computeWaveEnemiesRemaining(
  runtime: FloorRuntime | undefined,
  enemies: readonly Enemy[],
): number {
  const pending = runtime ? Math.max(0, runtime.plan.events.length - runtime.nextEventIdx) : 0;
  return pending + countAliveFloorEnemies(enemies);
}

function syncFloorRuntimeWithManualState(state: GameState): FloorRuntime | undefined {
  if (!state.floorRuntime) return undefined;
  const expected = computeWaveEnemiesRemaining(state.floorRuntime, state.enemies);
  if (state.waveEnemiesRemaining !== expected) {
    return {
      ...state.floorRuntime,
      nextEventIdx: state.floorRuntime.plan.events.length,
    };
  }
  return state.floorRuntime;
}

/**
 * Start a run from a 6-slot loadout. Slot positions are preserved (hotkeys 1-6);
 * the first filled slot becomes the active Pokémon. An empty / invalid loadout
 * leaves the state untouched.
 */
function startRun(
  state: GameState,
  loadout: readonly (LoadoutEntry | null)[],
  config: GameConfig,
  _rng: () => number,
): GameState {
  const slots: TeamSlot[] = [];
  for (let i = 0; i < 6; i++) {
    const entry = loadout[i];
    const def = entry ? config.pokedex[entry.definitionId] : undefined;
    slots.push(
      entry && def
        ? {
            index: i,
            pokemon: createPlayerPokemon(def, i + 1, entry.stars, 1, 0, false, entry.shinyActive ?? false),
            isActive: false,
            hotSwapCooldownSec: 0,
          }
        : emptySlot(i),
    );
  }
  const first = slots.findIndex((s) => s.pokemon !== null);
  if (first < 0) return state;
  slots[first] = { ...slots[first], isActive: true };
  const team = reconcileTeamMaxHp(slots, 1, config.pokedex, true) as Team6;
  const lead = team[first].pokemon!;

  const startId =
    maxEntityId({
      team,
      enemies: [],
      projectiles: [],
      floatingTexts: [],
      effects: [],
      strikes: [],
    } as unknown as GameState) + 1;

  const { floorRuntime, initialEnemies, nextId } = initFloorRuntime(
    config.seed ?? 1,
    1,
    startId,
  );

  return {
    ...state,
    phase: 'PLAYING',
    floor: 1,
    team,
    teamLevel: Math.max(1, state.teamLevel),
    enemies: initialEnemies,
    floorRuntime,
    projectiles: [],
    waveEnemiesRemaining: computeWaveEnemiesRemaining(floorRuntime, initialEnemies),
    bossTimerSec: initialEnemies.some((e) => e.isBoss)
      ? (initialEnemies.find((e) => e.isBoss)?.bossTimerSec ?? bossTimerForFloor(1))
      : undefined,
    hotSwapCooldowns: [0, 0, 0, 0, 0, 0],
    ultimateCharge: 0,
    ultimateMax: lead.ultimateMax,
    interWaveTimerSec: undefined,
    awaitingNextWave: false,
    autoAdvanceWave: undefined,
    bastionShieldSec: 0,
    effects: [],
    nextEntityId: nextId,
    runStats: {
      totalKills: 0,
      totalGoldEarned: 0,
      totalDamageDealt: 0,
      damagePerSlot: [0, 0, 0, 0, 0, 0],
      mvpSlotIndex: -1,
      floorReached: 1,
      durationSec: 0,
      manualClicks: 0,
      autoClicks: 0,
      defeatedBossFloors: [],
      faintLog: [],
    },
  };
}

function applyHotSwap(
  state: GameState,
  index: number,
  config: GameConfig,
  rng: () => number,
): GameState {
  if (index < 0 || index > 5) return state;
  const targetSlot = state.team[index];
  if (!targetSlot || !targetSlot.pokemon || !targetSlot.pokemon.alive || targetSlot.isActive) return state;
  if (state.hotSwapCooldowns[index] > 0) return state;

  const floorRuntime = syncFloorRuntimeWithManualState(state);

  const cooldowns = state.hotSwapCooldowns.map((c, i) =>
    i === index ? HOT_SWAP_COOLDOWN : c,
  ) as Cooldowns6;
  const team = state.team.map((s, i) => ({
    ...s,
    isActive: i === index,
    hotSwapCooldownSec: cooldowns[i],
  })) as Team6;

  // The ultimate meter keeps its fill RATIO across Pokémon (no swap penalty).
  const ratio = state.ultimateMax > 0 ? Math.min(1, state.ultimateCharge / state.ultimateMax) : 0;
  let next: GameState = {
    ...state,
    team,
    floorRuntime,
    hotSwapCooldowns: cooldowns,
    ultimateMax: targetSlot.pokemon.ultimateMax,
    ultimateCharge: ratio * targetSlot.pokemon.ultimateMax,
  };

  const incoming = targetSlot.pokemon;
  const enemies = next.enemies.map((e) => ({ ...e }));
  const damagePerSlot = [...next.runStats.damagePerSlot];
  const floatingTexts = [...next.floatingTexts];
  const effects = [...(next.effects ?? [])];
  const defeatedBossFloors = next.runStats.defeatedBossFloors ? [...next.runStats.defeatedBossFloors] : [];
  let nextTextId = resolveNextEntityId(next);

  const burst = applySwitchInBurst(
    incoming,
    index,
    next.team,
    enemies,
    next.floor,
    next.teamLevel,
    next.bastionUpgrades,
    config,
    rng,
    next.bastionShieldSec ?? 0,
    nextTextId,
    damagePerSlot,
    defeatedBossFloors,
    floatingTexts,
    effects,
  );

  const finalEnemies = enemies.filter((e) => e.alive);
  const waveEnemiesRemaining = computeWaveEnemiesRemaining(floorRuntime, finalEnemies);

  return {
    ...next,
    enemies: finalEnemies,
    floorRuntime,
    gold: next.gold + burst.goldDelta,
    waveEnemiesRemaining,
    floatingTexts,
    effects,
    bastionShieldSec: burst.shield,
    nextEntityId: burst.nextTextId,
    runStats: {
      ...next.runStats,
      totalKills: next.runStats.totalKills + burst.killsDelta,
      totalGoldEarned: next.runStats.totalGoldEarned + burst.goldDelta,
      totalDamageDealt: next.runStats.totalDamageDealt + burst.damageDelta,
      damagePerSlot,
      defeatedBossFloors,
    },
  };
}

function applyClick(
  state: GameState,
  click: { x: number; y: number; isAuto?: boolean },
  _config: GameConfig,
  _rng: () => number,
): GameState {
  const active = getActive(state);
  if (!active) return state;

  let nextId = resolveNextEntityId(state);
  const speed = PROJECTILE_SPEED[active.pattern];
  const bounce =
    active.pattern === AttackPattern.CHAIN && starsOf(active) >= STAR_PATTERN
      ? CHAIN_EXTRA_BOUNCES_AT_MAX_PATTERN
      : 0;
  const p = createProjectileAtPoint(nextId++, active, click.x, click.y, speed, bounce);

  const fx = createEffect(nextId++, 'RING', active.types[0], click.x, click.y, {
    radius: 14,
    maxAge: 0.22,
  });

  const manualClicks = (state.runStats.manualClicks ?? 0) + (click.isAuto ? 0 : 1);
  const autoClicks = (state.runStats.autoClicks ?? 0) + (click.isAuto ? 1 : 0);

  return {
    ...state,
    projectiles: [...state.projectiles, p],
    effects: [...(state.effects ?? []), fx],
    nextEntityId: nextId,
    runStats: {
      ...state.runStats,
      manualClicks,
      autoClicks,
    },
  };
}

/**
 * Fire the active Pokémon's ultimate (PRD §3.2). Needs a full meter and at
 * least one living enemy (the charge is never wasted on an empty arena).
 * Shape / power / status come from data/ultimates.ts via the species' ultimate id.
 */
function applyUltimate(state: GameState, config: GameConfig, rng: () => number): GameState {
  const active = getActive(state);
  if (!active || state.ultimateMax <= 0 || state.ultimateCharge < state.ultimateMax) return state;
  if (!state.enemies.some((e) => e.alive)) return state;

  const floorRuntime = syncFloorRuntimeWithManualState(state);

  const slotIndex = activeSlotIndex(state);
  const ult = getUltimate(config.pokedex[active.definitionId]?.ultimate.id ?? '');
  const bonuses = computeTeamBonuses(state.team, config.pokedex);
  const attacker = attackerOf(active, active.types);
  const baseDmg = PROJECTILE_BASE_DAMAGE * ult.power;
  const enemies = state.enemies.map((e) => ({ ...e }));
  const damagePerSlot = [...state.runStats.damagePerSlot];
  const floatingTexts = [...state.floatingTexts];
  const effects = [...(state.effects ?? [])];
  let nextTextId = resolveNextEntityId(state);
  let gold = state.gold;
  let totalKills = state.runStats.totalKills;
  let totalGold = state.runStats.totalGoldEarned;
  let totalDamage = state.runStats.totalDamageDealt;
  let defeatedBossFloors = state.runStats.defeatedBossFloors ? [...state.runStats.defeatedBossFloors] : [];

  // Targeting by shape.
  const C = ARENA.CENTER;
  const size = ult.size ?? 120;
  let inRange: (e: Enemy) => boolean = () => true;
  if (ult.shape === 'NOVA') {
    inRange = (e) => Math.hypot(e.x - C, e.y - C) <= size + enemyHitbox(e);
    effects.push(createEffect(nextTextId++, 'NOVA', active.types[0], C, C, { radius: size }));
  } else if (ult.shape === 'BEAM') {
    const nearest = enemies
      .filter((e) => e.alive)
      .reduce((a, b) => (dist2ToCenter(a) <= dist2ToCenter(b) ? a : b));
    const len = Math.hypot(nearest.x - C, nearest.y - C) || 1;
    const dx = (nearest.x - C) / len;
    const dy = (nearest.y - C) / len;
    const reach = ARENA.SIZE * 1.5;
    inRange = (e) => {
      const ex = e.x - C;
      const ey = e.y - C;
      const along = ex * dx + ey * dy;
      const across = Math.abs(ex * dy - ey * dx);
      return along >= 0 && along <= reach && across <= size + enemyHitbox(e);
    };
    effects.push(
      createEffect(nextTextId++, 'BEAM', active.types[0], C, C, {
        x2: C + dx * reach,
        y2: C + dy * reach,
        width: size * 2,
      }),
    );
  } else {
    effects.push(createEffect(nextTextId++, 'FLASH', active.types[0], C, C));
  }

  for (const enemy of enemies) {
    if (!enemy.alive || !inRange(enemy)) continue;
    const outcome = hitEnemy(enemy, baseDmg, attacker, state, rng, config, bonuses);
    totalDamage += outcome.amount;
    damagePerSlot[slotIndex] += outcome.amount;
    floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, `${outcome.amount}`, '#c084fc'));
    if (outcome.killed) {
      totalKills += 1;
      gold += outcome.goldGained;
      totalGold += outcome.goldGained;
      if (enemy.isBoss && !defeatedBossFloors.includes(state.floor)) {
        defeatedBossFloors.push(state.floor);
      }
      floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, `+${outcome.goldGained}`, '#ffd700'));
    } else if (ult.status) {
      applyStatus(enemy, ult.status, ULTIMATE_STATUS_DURATION, { sourceDamage: outcome.amount, slot: slotIndex });
    }
  }

  const finalEnemies = enemies.filter((e) => e.alive);
  const waveEnemiesRemaining = computeWaveEnemiesRemaining(floorRuntime, finalEnemies);

  return {
    ...state,
    enemies: finalEnemies,
    floorRuntime,
    gold,
    waveEnemiesRemaining,
    floatingTexts,
    effects,
    ultimateCharge: 0,
    nextEntityId: nextTextId,
    runStats: {
      ...state.runStats,
      totalKills,
      totalGoldEarned: totalGold,
      totalDamageDealt: totalDamage,
      damagePerSlot,
      defeatedBossFloors,
    },
  };
}

/** Input is edge-triggered: applied once per tickGame call, before sub-steps. */
function applyInput(
  state: GameState,
  input: GameInput,
  config: GameConfig,
  rng: () => number,
): GameState {
  if (state.phase === 'STARTER_SELECT' || state.phase === 'MENU') {
    if (input.startRun) return startRun(state, input.startRun, config, rng);
    return input.selectStarter
      ? startRun(state, [{ definitionId: input.selectStarter, stars: 1 }], config, rng)
      : state;
  }
  if (state.phase !== 'PLAYING') return state;

  let next = state;
  if (input.setAutoAdvance !== undefined) {
    next = { ...next, autoAdvanceWave: input.setAutoAdvance };
    // Turning AUTO back on while awaiting manual advance resumes the countdown.
    if (input.setAutoAdvance === true && next.awaitingNextWave) {
      next = { ...next, awaitingNextWave: false, interWaveTimerSec: INTER_WAVE_BREAK_SEC };
    }
  }
  if (input.startNextWave && (next.awaitingNextWave || next.interWaveTimerSec !== undefined)) {
    // The countdown-expiry branch of stepOnce spawns the wave on the next step.
    next = { ...next, awaitingNextWave: false, interWaveTimerSec: 0 };
  }
  if (input.buyTeamLevel) next = upgradeTeamLevel(next);
  if (input.buyUpgrade) next = purchaseUpgrade(next, input.buyUpgrade);
  if (typeof input.hotSwapIndex === 'number')
    next = applyHotSwap(next, input.hotSwapIndex, config, rng);
  if (input.click) next = applyClick(next, input.click, config, rng);
  if (input.useUltimate) next = applyUltimate(next, config, rng);
  return next;
}

/** One fixed simulation step (dt = FIXED_TIMESTEP). */
function stepOnce(state: GameState, config: GameConfig, rng: () => number): GameState {
  if (Boolean(state.shop)) {
    return state;
  }

  const dt = FIXED_TIMESTEP;
  let team = state.team.map((s) => ({
    ...s,
    pokemon: s.pokemon ? { ...s.pokemon } : null,
  })) as Team6;
  let bonuses = computeTeamBonuses(team, config.pokedex);

  // Clone the mutable simulation entities so the input state stays untouched.
  const enemies: Enemy[] = state.enemies.map((e) => ({ ...e }));
  const projectiles: Projectile[] = state.projectiles.map((p) => ({
    ...p,
    hitIds: p.hitIds ? [...p.hitIds] : undefined,
  }));
  const hotSwapCooldowns = state.hotSwapCooldowns.map((c) => Math.max(0, c - dt)) as Cooldowns6;
  const damagePerSlot = [...state.runStats.damagePerSlot];

  // Age then drop expired floating texts / effects so the arrays cannot grow unbounded.
  const floatingTexts: FloatingText[] = state.floatingTexts
    .map((t) => ({ ...t, age: t.age + dt }))
    .filter((t) => t.age < t.maxAge);
  const effects: VisualEffect[] = (state.effects ?? [])
    .map((fx) => ({ ...fx, age: fx.age + dt }))
    .filter((fx) => fx.age < fx.maxAge);
  const strikes: EnemyStrike[] = (state.strikes ?? [])
    .map((st) => ({ ...st, age: st.age + dt }))
    .filter((st) => st.age < st.maxAge);
  let nextTextId = resolveNextEntityId(state);
  let lastKillerType: PokemonType | undefined;
  let leaksThisWave = 0;

  let floorRuntime = syncFloorRuntimeWithManualState(state);
  if (floorRuntime) {
    const hasInvulnBoss = enemies.some((e) => e.alive && e.isBoss && (e.bossInvulnSec ?? 0) > 0);
    if (!hasInvulnBoss) {
      floorRuntime = { ...floorRuntime, elapsedSec: floorRuntime.elapsedSec + dt };
      while (
        floorRuntime.nextEventIdx < floorRuntime.plan.events.length &&
        floorRuntime.plan.events[floorRuntime.nextEventIdx].tSec <= floorRuntime.elapsedSec &&
        countAliveFloorEnemies(enemies) < ALIVE_CAP
      ) {
        const ev = floorRuntime.plan.events[floorRuntime.nextEventIdx++];
        const e = spawnEnemyAt(
          ev.angle,
          state.floor,
          false,
          rngFor((config.seed ?? 1) ^ (ev.index * 0x9e3779b9), 'WAVE', state.floor),
          ev.defId,
          ev.tier,
        );
        enemies.push({ ...e, id: nextTextId++ });
      }
    }
  }

  /** Records a cosmetic attack so the renderer can play the Attack animation. */
  const recordStrike = (enemy: Enemy): void => {
    strikes.push({
      id: nextTextId++,
      enemyId: enemy.id,
      x: enemy.x,
      y: enemy.y,
      definitionId: enemy.definitionId,
      types: enemy.types,
      isBoss: enemy.isBoss,
      age: 0,
      maxAge: ENEMY_STRIKE_MAX_AGE,
    });
  };

  let bastionShieldSec = state.bastionShieldSec ?? 0;
  let phase: GamePhase = state.phase;
  let gold = state.gold;
  let totalKills = state.runStats.totalKills;
  let totalGold = state.runStats.totalGoldEarned;
  let totalDamage = state.runStats.totalDamageDealt;
  let bossTimerSec = state.bossTimerSec;
  let ultimateCharge = state.ultimateCharge;
  let ultimateMax = state.ultimateMax;
  let floor = state.floor;
  let interWaveTimerSec = state.interWaveTimerSec;
  let awaitingNextWave = state.awaitingNextWave ?? false;
  let defeatedBossFloors = state.runStats.defeatedBossFloors ? [...state.runStats.defeatedBossFloors] : [];
  let runStats: RunStats = { ...state.runStats };

  // The ultimate charges with time (1 s of run = 1 s of cooldown); ULT_CHARGE speeds it up.
  if (ultimateMax > 0) {
    ultimateCharge = Math.min(ultimateMax, ultimateCharge + dt * (1 + bonuses.ultCharge));
  }

  const applyDamageToActive = (
    rawBaseDamage: number,
    attackerTypes: readonly PokemonType[],
    cause: 'leak' | 'boss',
  ): void => {
    if (bastionShieldSec > 0 || phase === 'GAME_OVER') {
      if (bastionShieldSec > 0) {
        floatingTexts.push(createFloatingText(nextTextId++, ARENA.CENTER, ARENA.CENTER, 'BLOQUEO', '#58b0f8'));
      }
      return;
    }
    const activeIdx = team.findIndex((s) => s.isActive && s.pokemon && s.pokemon.alive);
    if (activeIdx === -1) return;

    const activePkm = team[activeIdx].pokemon!;
    const eff = getEffectiveness(attackerTypes, activePkm.types, config.typeChart);
    const dmg = Math.max(1, Math.round(rawBaseDamage * eff));
    const nextHp = Math.max(0, activePkm.hp - dmg);
    lastKillerType = attackerTypes[0];

    floatingTexts.push(createFloatingText(nextTextId++, ARENA.CENTER, ARENA.CENTER, `-${dmg}`, '#ff4444'));

    if (nextHp > 0) {
      team[activeIdx] = {
        ...team[activeIdx],
        pokemon: { ...activePkm, hp: nextHp, alive: true },
      };
      return;
    }

    // nextHp <= 0: Pokémon active is KO'd (Rules D9, D16, D17; overkill is discarded)
    team[activeIdx] = {
      ...team[activeIdx],
      isActive: false,
      pokemon: { ...activePkm, hp: 0, alive: false },
    };

    const nextFaintLog = [
      ...(runStats.faintLog ?? []),
      {
        slot: activeIdx,
        definitionId: activePkm.definitionId,
        floor,
        cause,
        killerType: attackerTypes[0],
      },
    ];
    runStats = { ...runStats, faintLog: nextFaintLog };

    // Reconcile maxHp of survivors in case the fainted Pokémon had a MAX_HP passive
    team = reconcileTeamMaxHp(team, state.teamLevel, config.pokedex, false) as Team6;

    const currentAliveEnemies = enemies.filter((e) => e.alive);
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < team.length; i++) {
      const p = team[i].pokemon;
      if (!p || !p.alive) continue;
      const score = swapScore(p, currentAliveEnemies, config.typeChart);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx !== -1) {
      // Forced Switch-In: no cooldown in hotSwapCooldowns
      team[bestIdx] = { ...team[bestIdx], isActive: true };
      const incoming = team[bestIdx].pokemon!;
      ultimateMax = incoming.ultimateMax;
      ultimateCharge = 0;

      const burst = applySwitchInBurst(
        incoming,
        bestIdx,
        team,
        enemies,
        floor,
        state.teamLevel,
        state.bastionUpgrades,
        config,
        rng,
        bastionShieldSec,
        nextTextId,
        damagePerSlot,
        defeatedBossFloors,
        floatingTexts,
        effects,
      );
      bastionShieldSec = burst.shield;
      totalDamage += burst.damageDelta;
      totalKills += burst.killsDelta;
      gold += burst.goldDelta;
      totalGold += burst.goldDelta;
      nextTextId = burst.nextTextId;
    } else {
      phase = 'GAME_OVER';
      runStats = {
        ...runStats,
        floorReached: Math.max(runStats.floorReached, floor),
        defeatCause: 'teamWiped',
        defeatEnemyType: lastKillerType,
      };
    }
  };

  // 1. Status ticks, then enemies advance toward the center; contact damages active Pokémon.
  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    let speedFactor = 1;
    if (enemy.statuses) {
      const burn = enemy.statuses.find((s) => s.id === 'BURN');
      if (burn && (burn.dps ?? 0) > 0) {
        const amount = (burn.dps ?? 0) * dt;
        enemy.hp -= amount;
        totalDamage += amount;
        if (burn.sourceSlot !== undefined && burn.sourceSlot >= 0) damagePerSlot[burn.sourceSlot] += amount;
        if (enemy.hp <= 0) {
          enemy.alive = false;
          const payout = goldFor(enemy, state, bonuses);
          totalKills += 1;
          gold += payout;
          totalGold += payout;
          if (enemy.isBoss && !defeatedBossFloors.includes(floor)) {
            defeatedBossFloors.push(floor);
          }
          floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, `+${payout}`, '#ffd700'));
          continue;
        }
      }
      if (enemy.statuses.some((s) => s.id === 'PARALYZE')) speedFactor = 0;
      else if (enemy.statuses.some((s) => s.id === 'SLOW')) speedFactor = SLOW_SPEED_FACTOR;
      enemy.statuses = tickStatus(enemy.statuses, dt);
    }

    const dx = ARENA.CENTER - enemy.x;
    const dy = ARENA.CENTER - enemy.y;
    const d = Math.hypot(dx, dy);
    if (d <= ARENA.BASTION_DAMAGE_R || enemy.anchoredAtBastion) {
      if (enemy.isBoss) {
        enemy.anchoredAtBastion = true;
        if (d > 0) {
          enemy.x = ARENA.CENTER - (dx / d) * ARENA.BASTION_DAMAGE_R;
          enemy.y = ARENA.CENTER - (dy / d) * ARENA.BASTION_DAMAGE_R;
        }
        const cd = (enemy.bossAttackCooldownSec !== undefined ? enemy.bossAttackCooldownSec : 0) - dt;
        if (cd <= 0) {
          recordStrike(enemy);
          const currentActive = team.find((s) => s.isActive && s.pokemon?.alive)?.pokemon;
          if (currentActive) {
            applyDamageToActive(currentActive.maxHp * BOSS_ANCHOR_MAX_HP_FRACTION, enemy.types, 'boss');
          }
          enemy.bossAttackCooldownSec = BOSS_ANCHOR_TICK_SEC;
        } else {
          enemy.bossAttackCooldownSec = cd;
        }
      } else {
        recordStrike(enemy);
        applyDamageToActive(leakDamageForFloor(floor), enemy.types, 'leak');
        leaksThisWave += 1;
        enemy.alive = false;
        enemy.hp = 0;
        continue;
      }
    } else {
      const move = Math.min(d, enemy.speed * speedFactor * dt);
      enemy.x += (dx / d) * move;
      enemy.y += (dy / d) * move;
    }
  }

  // Update active Pokémon reference and bonuses after potential switch-ins in Section 1
  const currentActive = team.find((s) => s.isActive && s.pokemon?.alive)?.pokemon ?? null;
  const currentSlotIndex = team.findIndex((s) => s.isActive);
  bonuses = computeTeamBonuses(team, config.pokedex);

  /** One damaging hit from the active Pokémon: damage, kill payout, texts. */
  const strike = (
    enemy: Enemy,
    baseDmg: number,
    types: readonly PokemonType[],
    color: string,
  ): void => {
    const outcome = hitEnemy(enemy, baseDmg, attackerOf(currentActive, types), state, rng, config, bonuses);
    totalDamage += outcome.amount;
    if (currentSlotIndex >= 0) damagePerSlot[currentSlotIndex] += outcome.amount;
    floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, `${outcome.amount}`, color));
    if (outcome.killed) {
      totalKills += 1;
      gold += outcome.goldGained;
      totalGold += outcome.goldGained;
      if (enemy.isBoss && !defeatedBossFloors.includes(floor)) {
        defeatedBossFloors.push(floor);
      }
      floatingTexts.push(
        createFloatingText(nextTextId++, enemy.x, enemy.y, `+${outcome.goldGained}`, '#ffd700'),
      );
    }
  };

  // 2. Auto-fire.
  if (currentActive) {
    for (const p of fireProjectiles(state, currentActive, enemies, rng, bonuses, () => nextTextId++)) {
      projectiles.push(p);
    }
  }

  // 3. Projectiles move, then resolve hits (damage, kills, splash, pierce/bounce).
  const liveProjectiles: Projectile[] = [];
  for (const p of projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < 0 || p.x > ARENA.SIZE || p.y < 0 || p.y > ARENA.SIZE) continue;

    let dead = false;
    for (const enemy of enemies) {
      if (!enemy.alive || p.hitIds?.includes(enemy.id)) continue;
      const rr = enemyHitbox(enemy) + ARENA.PROJECTILE_R;
      const dx = enemy.x - p.x;
      const dy = enemy.y - p.y;
      if (dx * dx + dy * dy > rr * rr) continue;

      strike(enemy, p.damage, p.types, '#ffffff');
      effects.push(createEffect(nextTextId++, 'IMPACT', p.types[0], enemy.x, enemy.y));
      p.hitIds = [...(p.hitIds ?? []), enemy.id];

      // AOE: the explosion also hurts everything near the impact point.
      if (p.splashRadius) {
        for (const other of enemies) {
          if (other === enemy || !other.alive) continue;
          const sx = other.x - enemy.x;
          const sy = other.y - enemy.y;
          if (sx * sx + sy * sy <= p.splashRadius * p.splashRadius) {
            strike(other, p.damage * AOE_SPLASH_DAMAGE_FACTOR, p.types, '#ffe0a0');
          }
        }
      }

      if (p.pierce && p.pierce > 0) {
        p.pierce -= 1;
      } else if (p.bounce && p.bounce > 0) {
        const next = nearestUnhit(enemies, p);
        if (next) {
          p.bounce -= 1;
          aimProjectile(p, next, Math.hypot(p.vx, p.vy));
        } else {
          dead = true;
        }
      } else {
        dead = true;
      }
      break;
    }
    if (!dead) liveProjectiles.push(p);
  }

  const aliveEnemies = enemies.filter((e) => e.alive);
  let waveEnemiesRemaining = computeWaveEnemiesRemaining(floorRuntime, aliveEnemies);

  // 4. Boss kill-timer.
  const boss = aliveEnemies.find((e) => e.isBoss);
  bossTimerSec = boss ? (bossTimerSec ?? (boss.bossTimerSec ?? bossTimerForFloor(floor))) - dt : undefined;
  if (boss) boss.bossTimerSec = bossTimerSec;

  runStats = {
    ...runStats,
    totalKills,
    totalGoldEarned: totalGold,
    totalDamageDealt: totalDamage,
    damagePerSlot,
    defeatedBossFloors,
    durationSec: state.runStats.durationSec + dt,
    floorReached: Math.max(state.runStats.floorReached, floor),
  };
  team = syncCooldownMirrors(team, hotSwapCooldowns);
  const nextShield = Math.max(0, bastionShieldSec - dt);

  // 5. Defeat check: all team wiped, or a boss outlived its timer.
  if (
    phase === 'GAME_OVER' ||
    team.every((s) => !s.pokemon || !s.pokemon.alive) ||
    (boss && bossTimerSec !== undefined && bossTimerSec <= 0)
  ) {
    if (phase !== 'GAME_OVER') {
      phase = 'GAME_OVER';
      if (boss && bossTimerSec !== undefined && bossTimerSec <= 0) {
        runStats = {
          ...runStats,
          defeatCause: 'bossTimerExpired',
        };
      } else {
        runStats = {
          ...runStats,
          defeatCause: 'teamWiped',
          defeatEnemyType: lastKillerType,
        };
      }
    }
    return {
      ...state,
      phase: 'GAME_OVER',
      floor,
      floorRuntime,
      enemies: aliveEnemies,
      projectiles: liveProjectiles,
      floatingTexts,
      effects,
      strikes,
      bastionShieldSec: nextShield,
      gold,
      bossTimerSec,
      ultimateCharge,
      waveEnemiesRemaining,
      interWaveTimerSec,
      awaitingNextWave,
      hotSwapCooldowns,
      team,
      nextEntityId: nextTextId,
      runStats: {
        ...runStats,
        mvpSlotIndex: mvpSlotOf(damagePerSlot),
      },
    };
  }

  // 6. Wave cleared -> enter the breather (guarded so it triggers once).
  let finalEnemies = aliveEnemies;
  const isFloorClear =
    (floorRuntime ? floorRuntime.nextEventIdx >= floorRuntime.plan.events.length : true) &&
    countAliveFloorEnemies(finalEnemies) === 0 &&
    waveEnemiesRemaining <= 0;

  if (
    isFloorClear &&
    interWaveTimerSec === undefined &&
    !awaitingNextWave
  ) {
    if (state.autoAdvanceWave === false) awaitingNextWave = true;
    else interWaveTimerSec = INTER_WAVE_BREAK_SEC;
  }

  // 7. Breather countdown -> spawn the next floor when it expires (the floor
  // counter advances at spawn time, not at clear time).
  if (!awaitingNextWave && interWaveTimerSec !== undefined) {
    interWaveTimerSec -= dt;
    if (interWaveTimerSec <= 0) {
      interWaveTimerSec = undefined;
      floor += 1;
      const nextFloor = initFloorRuntime(config.seed ?? 1, floor, nextTextId);
      finalEnemies = nextFloor.initialEnemies;
      floorRuntime = nextFloor.floorRuntime;
      waveEnemiesRemaining = computeWaveEnemiesRemaining(floorRuntime, finalEnemies);
      nextTextId = nextFloor.nextId;
      bossTimerSec = finalEnemies.some((e) => e.isBoss)
        ? (finalEnemies.find((e) => e.isBoss)?.bossTimerSec ?? bossTimerForFloor(floor))
        : undefined;
      runStats.floorReached = Math.max(runStats.floorReached, floor);
    }
  }

  return {
    ...state,
    floor,
    floorRuntime,
    enemies: finalEnemies,
    projectiles: liveProjectiles,
    floatingTexts,
    effects,
    strikes,
    bastionShieldSec: nextShield,
    gold,
    bossTimerSec,
    ultimateCharge,
    waveEnemiesRemaining,
    interWaveTimerSec,
    awaitingNextWave,
    hotSwapCooldowns,
    team,
    nextEntityId: nextTextId,
    runStats,
  };
}

function nearestUnhit(enemies: Enemy[], p: Projectile): Enemy | null {
  let best: Enemy | null = null;
  let bestDist = Infinity;
  for (const enemy of enemies) {
    if (!enemy.alive || p.hitIds?.includes(enemy.id)) continue;
    const d = (enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return best;
}

/**
 * Advance the simulation by `deltaMs`. Input is applied once, then the loop
 * consumes it in whole FIXED_TIMESTEP sub-steps (remainder is dropped until
 * the next call, matching a standard fixed-timestep accumulator).
 *
 * Note: GameState carries no persisted accumulator field, so callers should
 * tick every frame; sub-frame remainders are intentionally discarded.
 */
export function tickGame(
  state: GameState,
  input: GameInput,
  config: GameConfig,
  deltaMs: number,
  rng: () => number,
): GameState {
  let next = applyInput(state, input, config, rng);
  if (next.phase !== 'PLAYING') return next;

  if (next.nextEntityId === undefined) {
    next = { ...next, nextEntityId: resolveNextEntityId(next) };
  }

  const steps = Math.min(Math.floor(deltaMs / FIXED_STEP_MS), MAX_STEPS_PER_TICK);
  for (let i = 0; i < steps && next.phase === 'PLAYING'; i++) {
    next = stepOnce(next, config, rng);
  }
  return next;
}
