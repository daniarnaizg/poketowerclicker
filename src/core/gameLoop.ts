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
  Cooldowns6,
  Enemy,
  FloatingText,
  GameConfig,
  GameInput,
  GameState,
  LoadoutEntry,
  PlayerPokemon,
  PokemonDefinition,
  Projectile,
  StatusInstance,
  StatusKind,
  Team6,
  TeamSlot,
  VisualEffect,
} from './types';
import { ARENA } from '../config/arena.config';
import {
  AOE_SPLASH_DAMAGE_FACTOR,
  AOE_SPLASH_RADIUS,
  AOE_SPLASH_STAR_MULTIPLIER,
  BASTION_BASE_HP,
  BASTION_REGEN_FRACTION_PER_SEC,
  BOSS_STATUS_DURATION_FACTOR,
  BOSS_TIMER_DURATION,
  BURN_DPS_FACTOR,
  CHAIN_EXTRA_BOUNCES_AT_MAX_PATTERN,
  CLICK_BASE_DAMAGE,
  ENEMY_CONTACT_DAMAGE,
  ENEMY_CONTACT_DAMAGE_FLOOR_SCALE,
  FIXED_TIMESTEP,
  HOT_SWAP_COOLDOWN,
  INTER_WAVE_BREAK_SEC,
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
import { calculateDamage } from './damage';
import type { DamageAttacker } from './damage';
import { generateWave } from './waveGenerator';
import {
  attackSpeedMultiplier,
  clickDamageMultiplier,
  clickRadius,
  goldMultiplier,
  projectileCount,
  purchaseUpgrade,
} from './bastionUpgrades';
import { upgradeTeamLevel } from './teamLevel';
import { computeTeamBonuses, damageBonusMultiplier, starsOf } from './passives';
import type { TeamBonuses } from './passives';
import { getUltimate } from '../data/ultimates';

const FIXED_STEP_MS = FIXED_TIMESTEP * 1000;
/** Cap sub-steps per call so a long frame stall cannot spiral. */
const MAX_STEPS_PER_TICK = 5;

/** Floating-text lifetime in seconds. */
const FLOATING_TEXT_MAX_AGE = 1.0;
/** Visual-effect lifetime in seconds, by kind. */
const EFFECT_MAX_AGE: Record<VisualEffect['kind'], number> = {
  BEAM: 0.35,
  NOVA: 0.5,
  FLASH: 0.4,
  RING: 0.45,
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
  for (const slot of state.team) if (slot.pokemon && slot.pokemon.id > max) max = slot.pokemon.id;
  return max;
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

function aimProjectile(p: Projectile, target: Enemy, speed: number): void {
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  p.vx = (dx / len) * speed;
  p.vy = (dy / len) * speed;
}

function createProjectile(
  id: number,
  active: PlayerPokemon,
  target: Enemy,
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
  aimProjectile(p, target, speed);

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

/** Active Pokémon fires at the nearest enemies according to its SPD + pattern. */
function fireProjectiles(
  state: GameState,
  active: PlayerPokemon,
  enemies: Enemy[],
  rng: () => number,
  bonuses: TeamBonuses,
): Projectile[] {
  const living = enemies.filter((e) => e.alive);
  if (living.length === 0) return [];

  const expectedShots =
    active.spd * attackSpeedMultiplier(state.bastionUpgrades) * (1 + bonuses.attackSpeed) * FIXED_TIMESTEP;
  const whole = Math.floor(expectedShots);
  const shots = whole + (rng() < expectedShots - whole ? 1 : 0);
  if (shots <= 0) return [];

  const multi = projectileCount(state.bastionUpgrades);
  const targets = [...living].sort((a, b) => dist2ToCenter(a) - dist2ToCenter(b)).slice(0, multi);
  const speed = PROJECTILE_SPEED[active.pattern];
  const chainBounces =
    multi - 1 + (starsOf(active) >= STAR_PATTERN ? CHAIN_EXTRA_BOUNCES_AT_MAX_PATTERN : 0);

  let id = maxEntityId(state) + 1;
  const fired: Projectile[] = [];
  for (let s = 0; s < shots; s++) {
    if (active.pattern === AttackPattern.CHAIN) {
      fired.push(createProjectile(id++, active, targets[0], speed, chainBounces));
    } else {
      const count = Math.min(multi, targets.length);
      for (let t = 0; t < count; t++) fired.push(createProjectile(id++, active, targets[t], speed, 0));
    }
  }
  return fired;
}

function createPlayerPokemon(def: PokemonDefinition, id: number, stars = 1, shinyActive = false): PlayerPokemon {
  return {
    id,
    x: ARENA.CENTER,
    y: ARENA.CENTER,
    // shortcut: active Pokémon HP is unused (bastion HP is the health bar)
    hp: 1,
    maxHp: 1,
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

/**
 * Start a run from a 6-slot loadout. Slot positions are preserved (hotkeys 1-6);
 * the first filled slot becomes the active Pokémon. An empty / invalid loadout
 * leaves the state untouched.
 */
function startRun(
  state: GameState,
  loadout: readonly (LoadoutEntry | null)[],
  config: GameConfig,
  rng: () => number,
): GameState {
  const slots: TeamSlot[] = [];
  for (let i = 0; i < 6; i++) {
    const entry = loadout[i];
    const def = entry ? config.pokedex[entry.definitionId] : undefined;
    slots.push(
      entry && def
        ? { index: i, pokemon: createPlayerPokemon(def, i + 1, entry.stars, entry.shinyActive ?? false), isActive: false, hotSwapCooldownSec: 0 }
        : emptySlot(i),
    );
  }
  const first = slots.findIndex((s) => s.pokemon !== null);
  if (first < 0) return state;
  slots[first] = { ...slots[first], isActive: true };
  const team = slots as Team6;
  const lead = slots[first].pokemon!;

  const bastionMaxHp = state.bastionMaxHp > 0 ? state.bastionMaxHp : BASTION_BASE_HP;
  const wave = generateWave(1, rng);

  return {
    ...state,
    phase: 'PLAYING',
    floor: 1,
    team,
    teamLevel: Math.max(1, state.teamLevel),
    bastionMaxHp,
    bastionHp: bastionMaxHp,
    enemies: wave,
    projectiles: [],
    waveEnemiesRemaining: wave.length,
    bossTimerSec: wave.some((e) => e.isBoss) ? BOSS_TIMER_DURATION : undefined,
    hotSwapCooldowns: [0, 0, 0, 0, 0, 0],
    ultimateCharge: 0,
    ultimateMax: lead.ultimateMax,
    interWaveTimerSec: undefined,
    awaitingNextWave: false,
    autoAdvanceWave: undefined,
    bastionShieldSec: 0,
    effects: [],
    runStats: {
      totalKills: 0,
      totalGoldEarned: 0,
      totalDamageDealt: 0,
      damagePerSlot: [0, 0, 0, 0, 0, 0],
      mvpSlotIndex: -1,
      floorReached: 1,
      durationSec: 0,
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
  const slot = state.team[index];
  if (!slot.pokemon || slot.isActive) return state;
  if (state.hotSwapCooldowns[index] > 0) return state;

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
    hotSwapCooldowns: cooldowns,
    ultimateMax: slot.pokemon.ultimateMax,
    ultimateCharge: ratio * slot.pokemon.ultimateMax,
  };

  // Switch-in bonus: the incoming Pokémon detonates a radial burst on arrival.
  const incoming = slot.pokemon;
  const bonuses = computeTeamBonuses(next.team, config.pokedex);
  const attacker = attackerOf(incoming, incoming.types);
  const baseDmg = incoming.atk * SWITCH_IN_DAMAGE_MULTIPLIER;
  const enemies = next.enemies.map((e) => ({ ...e }));
  const damagePerSlot = [...next.runStats.damagePerSlot];
  const floatingTexts = [...next.floatingTexts];
  const effects = [...(next.effects ?? [])];
  let nextTextId = maxEntityId(next) + 1;
  let gold = next.gold;
  let totalKills = next.runStats.totalKills;
  let totalGold = next.runStats.totalGoldEarned;
  let totalDamage = next.runStats.totalDamageDealt;
  let remaining = next.waveEnemiesRemaining;
  const caught: { enemy: Enemy; amount: number }[] = [];

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - ARENA.CENTER;
    const dy = enemy.y - ARENA.CENTER;
    if (dx * dx + dy * dy > SWITCH_IN_RADIUS * SWITCH_IN_RADIUS) continue;
    const outcome = hitEnemy(enemy, baseDmg, attacker, next, rng, config, bonuses);
    totalDamage += outcome.amount;
    damagePerSlot[index] += outcome.amount;
    if (outcome.killed) {
      totalKills += 1;
      gold += outcome.goldGained;
      totalGold += outcome.goldGained;
      remaining = Math.max(0, remaining - 1);
    } else {
      caught.push({ enemy, amount: outcome.amount });
    }
    floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, `${outcome.amount}`, '#ffd166'));
  }

  // 3★+: the entry wave also carries a status (or a temporary bastion shield).
  let shield = next.bastionShieldSec ?? 0;
  if (starsOf(incoming) >= STAR_SWITCH_IN) {
    const effect = SWITCH_IN_EFFECT_BY_TYPE[incoming.types[0]];
    const duration = SWITCH_IN_EFFECT_DURATION[effect];
    if (effect === 'SHIELD') {
      shield = Math.max(shield, duration);
    } else {
      for (const { enemy, amount } of caught) applyStatus(enemy, effect, duration, { sourceDamage: amount, slot: index });
    }
  }
  effects.push(
    createEffect(nextTextId++, 'RING', incoming.types[0], ARENA.CENTER, ARENA.CENTER, {
      radius: SWITCH_IN_RADIUS,
    }),
  );

  next = {
    ...next,
    enemies: enemies.filter((e) => e.alive),
    gold,
    waveEnemiesRemaining: remaining,
    floatingTexts,
    effects,
    bastionShieldSec: shield,
    runStats: {
      ...next.runStats,
      totalKills,
      totalGoldEarned: totalGold,
      totalDamageDealt: totalDamage,
      damagePerSlot,
    },
  };
  return next;
}

function applyClick(
  state: GameState,
  click: { x: number; y: number },
  config: GameConfig,
  rng: () => number,
): GameState {
  const active = getActive(state);
  if (!active) return state;

  const bonuses = computeTeamBonuses(state.team, config.pokedex);
  const slotIndex = activeSlotIndex(state);
  const radius = clickRadius(state.bastionUpgrades);
  const baseDmg =
    CLICK_BASE_DAMAGE * clickDamageMultiplier(state.bastionUpgrades) * (1 + bonuses.clickDamage);
  const attacker = attackerOf(active, active.types);

  const enemies = state.enemies.map((e) => ({ ...e }));
  const damagePerSlot = [...state.runStats.damagePerSlot];
  const floatingTexts = [...state.floatingTexts];
  let nextTextId = maxEntityId(state) + 1;
  let gold = state.gold;
  let totalKills = state.runStats.totalKills;
  let totalGold = state.runStats.totalGoldEarned;
  let totalDamage = state.runStats.totalDamageDealt;
  let remaining = state.waveEnemiesRemaining;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - click.x;
    const dy = enemy.y - click.y;
    if (dx * dx + dy * dy > radius * radius) continue;
    const outcome = hitEnemy(enemy, baseDmg, attacker, state, rng, config, bonuses);
    totalDamage += outcome.amount;
    damagePerSlot[slotIndex] += outcome.amount;
    floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, `${outcome.amount}`, '#ffffff'));
    if (outcome.killed) {
      totalKills += 1;
      gold += outcome.goldGained;
      totalGold += outcome.goldGained;
      remaining = Math.max(0, remaining - 1);
      floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, `+${outcome.goldGained}`, '#ffd700'));
    }
  }

  return {
    ...state,
    enemies: enemies.filter((e) => e.alive),
    gold,
    waveEnemiesRemaining: remaining,
    floatingTexts,
    runStats: {
      ...state.runStats,
      totalKills,
      totalGoldEarned: totalGold,
      totalDamageDealt: totalDamage,
      damagePerSlot,
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

  const slotIndex = activeSlotIndex(state);
  const ult = getUltimate(config.pokedex[active.definitionId]?.ultimate.id ?? '');
  const bonuses = computeTeamBonuses(state.team, config.pokedex);
  const attacker = attackerOf(active, active.types);
  const baseDmg = PROJECTILE_BASE_DAMAGE * ult.power;
  const enemies = state.enemies.map((e) => ({ ...e }));
  const damagePerSlot = [...state.runStats.damagePerSlot];
  const floatingTexts = [...state.floatingTexts];
  const effects = [...(state.effects ?? [])];
  let nextTextId = maxEntityId(state) + 1;
  let gold = state.gold;
  let totalKills = state.runStats.totalKills;
  let totalGold = state.runStats.totalGoldEarned;
  let totalDamage = state.runStats.totalDamageDealt;
  let remaining = state.waveEnemiesRemaining;

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
      remaining = Math.max(0, remaining - 1);
      floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, `+${outcome.goldGained}`, '#ffd700'));
    } else if (ult.status) {
      applyStatus(enemy, ult.status, ULTIMATE_STATUS_DURATION, { sourceDamage: outcome.amount, slot: slotIndex });
    }
  }

  return {
    ...state,
    enemies: enemies.filter((e) => e.alive),
    gold,
    waveEnemiesRemaining: remaining,
    floatingTexts,
    effects,
    ultimateCharge: 0,
    runStats: {
      ...state.runStats,
      totalKills,
      totalGoldEarned: totalGold,
      totalDamageDealt: totalDamage,
      damagePerSlot,
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
  const dt = FIXED_TIMESTEP;
  const active = getActive(state);
  const bonuses = computeTeamBonuses(state.team, config.pokedex);

  // Clone the mutable simulation entities so the input state stays untouched.
  const enemies: Enemy[] = state.enemies.map((e) => ({ ...e }));
  const projectiles: Projectile[] = state.projectiles.map((p) => ({
    ...p,
    hitIds: p.hitIds ? [...p.hitIds] : undefined,
  }));
  const hotSwapCooldowns = state.hotSwapCooldowns.map((c) => Math.max(0, c - dt)) as Cooldowns6;
  const damagePerSlot = [...state.runStats.damagePerSlot];
  const slotIndex = activeSlotIndex(state);
  // Age then drop expired floating texts / effects so the arrays cannot grow unbounded.
  const floatingTexts: FloatingText[] = state.floatingTexts
    .map((t) => ({ ...t, age: t.age + dt }))
    .filter((t) => t.age < t.maxAge);
  const effects: VisualEffect[] = (state.effects ?? [])
    .map((fx) => ({ ...fx, age: fx.age + dt }))
    .filter((fx) => fx.age < fx.maxAge);
  let nextTextId = maxEntityId(state) + 1;
  let lastLeakerType: PokemonType | undefined;

  const shieldSec = state.bastionShieldSec ?? 0;
  let bastionHp = state.bastionHp;
  let gold = state.gold;
  let totalKills = state.runStats.totalKills;
  let totalGold = state.runStats.totalGoldEarned;
  let totalDamage = state.runStats.totalDamageDealt;
  let waveEnemiesRemaining = state.waveEnemiesRemaining;
  let bossTimerSec = state.bossTimerSec;
  let ultimateCharge = state.ultimateCharge;
  let floor = state.floor;
  let interWaveTimerSec = state.interWaveTimerSec;
  let awaitingNextWave = state.awaitingNextWave ?? false;
  // Read the incoming state (before sections 6/7 mutate the locals): the regen
  // pause must reflect the break the player is already in at the start of a tick.
  const inBreak = state.interWaveTimerSec !== undefined || (state.awaitingNextWave ?? false);
  const contactDamage = ENEMY_CONTACT_DAMAGE * (1 + (floor - 1) * ENEMY_CONTACT_DAMAGE_FLOOR_SCALE);

  // The ultimate charges with time (1 s of run = 1 s of cooldown); ULT_CHARGE speeds it up.
  if (state.ultimateMax > 0) {
    ultimateCharge = Math.min(state.ultimateMax, ultimateCharge + dt * (1 + bonuses.ultCharge));
  }

  // 1. Status ticks, then enemies advance toward the center; leaks damage the bastion.
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
          waveEnemiesRemaining = Math.max(0, waveEnemiesRemaining - 1);
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
    if (d <= ARENA.BASTION_DAMAGE_R) {
      if (shieldSec > 0) {
        floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, 'BLOQUEO', '#58b0f8'));
      } else {
        bastionHp -= contactDamage;
        lastLeakerType = enemy.types[0];
        floatingTexts.push(
          createFloatingText(nextTextId++, enemy.x, enemy.y, `-${Math.round(contactDamage)}`, '#ff4444'),
        );
      }
      enemy.alive = false;
      enemy.hp = 0;
      waveEnemiesRemaining = Math.max(0, waveEnemiesRemaining - 1);
      continue;
    }
    const move = Math.min(d, enemy.speed * speedFactor * dt);
    enemy.x += (dx / d) * move;
    enemy.y += (dy / d) * move;
  }

  // Bastion passive regeneration (PRD §4.1 + BASTION_REGEN passives); paused
  // during the breather, and skipped once destroyed.
  if (bastionHp > 0 && !inBreak) {
    bastionHp = Math.min(
      state.bastionMaxHp,
      bastionHp + state.bastionMaxHp * (BASTION_REGEN_FRACTION_PER_SEC + bonuses.bastionRegen) * dt,
    );
  }

  /** One damaging hit from the active Pokémon: damage, kill payout, texts. */
  const strike = (
    enemy: Enemy,
    baseDmg: number,
    types: readonly PokemonType[],
    color: string,
  ): void => {
    const outcome = hitEnemy(enemy, baseDmg, attackerOf(active, types), state, rng, config, bonuses);
    totalDamage += outcome.amount;
    if (slotIndex >= 0) damagePerSlot[slotIndex] += outcome.amount;
    floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, `${outcome.amount}`, color));
    if (outcome.killed) {
      totalKills += 1;
      gold += outcome.goldGained;
      totalGold += outcome.goldGained;
      waveEnemiesRemaining = Math.max(0, waveEnemiesRemaining - 1);
      floatingTexts.push(
        createFloatingText(nextTextId++, enemy.x, enemy.y, `+${outcome.goldGained}`, '#ffd700'),
      );
    }
  };

  // 2. Auto-fire.
  if (active) {
    for (const p of fireProjectiles(state, active, enemies, rng, bonuses)) projectiles.push(p);
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

  // 4. Boss kill-timer.
  const boss = aliveEnemies.find((e) => e.isBoss);
  bossTimerSec = boss ? (bossTimerSec ?? BOSS_TIMER_DURATION) - dt : undefined;

  const runStats = {
    ...state.runStats,
    totalKills,
    totalGoldEarned: totalGold,
    totalDamageDealt: totalDamage,
    damagePerSlot,
    durationSec: state.runStats.durationSec + dt,
    floorReached: Math.max(state.runStats.floorReached, floor),
  };
  const team = syncCooldownMirrors(state.team, hotSwapCooldowns);
  const nextShield = Math.max(0, shieldSec - dt);

  // 5. Game over: bastion destroyed or a boss outlived its timer.
  if (bastionHp <= 0 || (boss && bossTimerSec !== undefined && bossTimerSec <= 0)) {
    const bastionDestroyed = bastionHp <= 0;
    return {
      ...state,
      phase: 'GAME_OVER',
      floor,
      enemies: aliveEnemies,
      projectiles: liveProjectiles,
      floatingTexts,
      effects,
      bastionShieldSec: nextShield,
      bastionHp: Math.max(0, bastionHp),
      gold,
      bossTimerSec,
      ultimateCharge,
      waveEnemiesRemaining,
      interWaveTimerSec,
      awaitingNextWave,
      hotSwapCooldowns,
      team,
      runStats: {
        ...runStats,
        mvpSlotIndex: mvpSlotOf(damagePerSlot),
        defeatCause: bastionDestroyed ? 'bastionDestroyed' : 'bossTimerExpired',
        defeatEnemyType: bastionDestroyed ? lastLeakerType : undefined,
      },
    };
  }

  // 6. Wave cleared -> enter the breather (guarded so it triggers once).
  let finalEnemies = aliveEnemies;
  if (
    waveEnemiesRemaining <= 0 &&
    aliveEnemies.length === 0 &&
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
      const wave = generateWave(floor, rng);
      finalEnemies = wave;
      waveEnemiesRemaining = wave.length;
      bossTimerSec = wave.some((e) => e.isBoss) ? BOSS_TIMER_DURATION : undefined;
      runStats.floorReached = Math.max(runStats.floorReached, floor);
    }
  }

  return {
    ...state,
    floor,
    enemies: finalEnemies,
    projectiles: liveProjectiles,
    floatingTexts,
    effects,
    bastionShieldSec: nextShield,
    bastionHp: Math.max(0, bastionHp),
    gold,
    bossTimerSec,
    ultimateCharge,
    waveEnemiesRemaining,
    interWaveTimerSec,
    awaitingNextWave,
    hotSwapCooldowns,
    team,
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

  const steps = Math.min(Math.floor(deltaMs / FIXED_STEP_MS), MAX_STEPS_PER_TICK);
  for (let i = 0; i < steps && next.phase === 'PLAYING'; i++) {
    next = stepOnce(next, config, rng);
  }
  return next;
}
