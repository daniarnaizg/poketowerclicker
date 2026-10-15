/**
 * PokéBastion — deterministic fixed-timestep game loop (headless core).
 * PURE TYPESCRIPT: no DOM / browser APIs. All randomness is injected via `rng`.
 *
 * Every update returns a NEW GameState; the input state is never mutated.
 * The renderer/UI drive this by calling tickGame once per animation frame and
 * pushing the returned state into the store.
 */

import { AttackPattern, PokemonType } from './types';
import type {
  Cooldowns6,
  Enemy,
  FloatingText,
  GameConfig,
  GameInput,
  GameState,
  PlayerPokemon,
  PokemonDefinition,
  Projectile,
  Team6,
  TeamSlot,
} from './types';
import { ARENA } from '../config/arena.config';
import {
  BASTION_BASE_HP,
  BASTION_REGEN_FRACTION_PER_SEC,
  BOSS_TIMER_DURATION,
  CLICK_BASE_DAMAGE,
  FIXED_TIMESTEP,
  HOT_SWAP_COOLDOWN,
  PROJECTILE_BASE_DAMAGE,
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

const FIXED_STEP_MS = FIXED_TIMESTEP * 1000;
/** Cap sub-steps per call so a long frame stall cannot spiral. */
const MAX_STEPS_PER_TICK = 5;

// shortcut: flat bastion damage when an enemy leaks, move to balance.config when specified
const ENEMY_CONTACT_DAMAGE = 5;
// shortcut: ultimate base damage = 10x projectile, move to balance.config when specified
const ULTIMATE_DAMAGE_MULTIPLIER = 10;
// shortcut: ultimate charge rates, move to balance.config when specified
const ULTIMATE_CHARGE_PER_HIT = 1;
const ULTIMATE_CHARGE_PER_CLICK = 5;
// shortcut: switch-in burst radius/damage, move to balance.config when specified
const SWITCH_IN_RADIUS = 60;
const SWITCH_IN_DAMAGE_MULTIPLIER = 2;
/** Floating-text lifetime in seconds. */
const FLOATING_TEXT_MAX_AGE = 1.0;

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

function getActive(state: GameState): PlayerPokemon | null {
  return state.team.find((slot) => slot.isActive)?.pokemon ?? null;
}

/** Highest entity id currently in play; used to allocate fresh ids. */
function maxEntityId(state: GameState): number {
  let max = 0;
  for (const e of state.enemies) if (e.id > max) max = e.id;
  for (const p of state.projectiles) if (p.id > max) max = p.id;
  for (const f of state.floatingTexts) if (f.id > max) max = f.id;
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

interface HitOutcome {
  amount: number;
  killed: boolean;
  goldGained: number;
}

/** Apply one damage instance to a (cloned) enemy and report the outcome. */
function hitEnemy(
  enemy: Enemy,
  baseDmg: number,
  attacker: DamageAttacker,
  state: GameState,
  rng: () => number,
  config: GameConfig,
): HitOutcome {
  const event = calculateDamage(
    attacker,
    enemy,
    baseDmg,
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
    goldGained = Math.floor(enemy.goldValue * goldMultiplier(state.bastionUpgrades));
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
  if (bounce > 0) p.bounce = bounce;
  return p;
}

/** Active Pokémon fires at the nearest enemies according to its SPD + pattern. */
function fireProjectiles(
  state: GameState,
  active: PlayerPokemon,
  enemies: Enemy[],
  rng: () => number,
): Projectile[] {
  const living = enemies.filter((e) => e.alive);
  if (living.length === 0) return [];

  const expectedShots = active.spd * attackSpeedMultiplier(state.bastionUpgrades) * FIXED_TIMESTEP;
  const whole = Math.floor(expectedShots);
  const shots = whole + (rng() < expectedShots - whole ? 1 : 0);
  if (shots <= 0) return [];

  const multi = projectileCount(state.bastionUpgrades);
  const targets = [...living].sort((a, b) => dist2ToCenter(a) - dist2ToCenter(b)).slice(0, multi);
  const speed = PROJECTILE_SPEED[active.pattern];

  let id = maxEntityId(state) + 1;
  const fired: Projectile[] = [];
  for (let s = 0; s < shots; s++) {
    if (active.pattern === AttackPattern.CHAIN) {
      fired.push(createProjectile(id++, active, targets[0], speed, multi - 1));
    } else {
      const count = Math.min(multi, targets.length);
      for (let t = 0; t < count; t++) fired.push(createProjectile(id++, active, targets[t], speed, 0));
    }
  }
  return fired;
}

function createPlayerPokemon(def: PokemonDefinition, id: number): PlayerPokemon {
  return {
    id,
    x: ARENA.CENTER,
    y: ARENA.CENTER,
    // shortcut: active Pokémon HP is unused in Phase 1 (bastion HP is the health bar)
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
    ultimateMax: def.ultimate.energyCost,
    evolutionStage: 0,
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

function startRun(state: GameState, starterId: string, config: GameConfig, rng: () => number): GameState {
  const def = config.pokedex[starterId];
  if (!def) return state;

  const starter = createPlayerPokemon(def, 1);
  const team: Team6 = [
    { index: 0, pokemon: starter, isActive: true, hotSwapCooldownSec: 0 },
    emptySlot(1),
    emptySlot(2),
    emptySlot(3),
    emptySlot(4),
    emptySlot(5),
  ];
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
    ultimateMax: starter.ultimateMax,
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

  let next: GameState = {
    ...state,
    team,
    hotSwapCooldowns: cooldowns,
    ultimateMax: slot.pokemon.ultimateMax,
    ultimateCharge: Math.min(state.ultimateCharge, slot.pokemon.ultimateMax),
  };

  // Switch-in bonus: the incoming Pokémon detonates a radial burst on arrival.
  const incoming = slot.pokemon;
  const attacker = attackerOf(incoming, incoming.types);
  const baseDmg = incoming.atk * SWITCH_IN_DAMAGE_MULTIPLIER;
  const enemies = next.enemies.map((e) => ({ ...e }));
  const damagePerSlot = [...next.runStats.damagePerSlot];
  const floatingTexts = [...next.floatingTexts];
  let nextTextId = maxEntityId(next) + 1;
  let gold = next.gold;
  let totalKills = next.runStats.totalKills;
  let totalGold = next.runStats.totalGoldEarned;
  let totalDamage = next.runStats.totalDamageDealt;
  let remaining = next.waveEnemiesRemaining;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - ARENA.CENTER;
    const dy = enemy.y - ARENA.CENTER;
    if (dx * dx + dy * dy > SWITCH_IN_RADIUS * SWITCH_IN_RADIUS) continue;
    const outcome = hitEnemy(enemy, baseDmg, attacker, next, rng, config);
    totalDamage += outcome.amount;
    damagePerSlot[index] += outcome.amount;
    if (outcome.killed) {
      totalKills += 1;
      gold += outcome.goldGained;
      totalGold += outcome.goldGained;
      remaining = Math.max(0, remaining - 1);
    }
    floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, `${outcome.amount}`, '#ffd166'));
  }

  next = {
    ...next,
    enemies: enemies.filter((e) => e.alive),
    gold,
    waveEnemiesRemaining: remaining,
    floatingTexts,
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

  const slotIndex = activeSlotIndex(state);
  const radius = clickRadius(state.bastionUpgrades);
  const baseDmg = CLICK_BASE_DAMAGE * clickDamageMultiplier(state.bastionUpgrades);
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
  let hit = false;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - click.x;
    const dy = enemy.y - click.y;
    if (dx * dx + dy * dy > radius * radius) continue;
    hit = true;
    const outcome = hitEnemy(enemy, baseDmg, attacker, state, rng, config);
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
    ultimateCharge: hit
      ? Math.min(state.ultimateMax, state.ultimateCharge + ULTIMATE_CHARGE_PER_CLICK)
      : state.ultimateCharge,
    runStats: {
      ...state.runStats,
      totalKills,
      totalGoldEarned: totalGold,
      totalDamageDealt: totalDamage,
      damagePerSlot,
    },
  };
}

function applyUltimate(state: GameState, config: GameConfig, rng: () => number): GameState {
  const active = getActive(state);
  if (!active || state.ultimateCharge < state.ultimateMax) return state;

  const slotIndex = activeSlotIndex(state);
  const attacker = attackerOf(active, active.types);
  const baseDmg = PROJECTILE_BASE_DAMAGE * ULTIMATE_DAMAGE_MULTIPLIER;
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
    const outcome = hitEnemy(enemy, baseDmg, attacker, state, rng, config);
    totalDamage += outcome.amount;
    damagePerSlot[slotIndex] += outcome.amount;
    floatingTexts.push(createFloatingText(nextTextId++, enemy.x, enemy.y, `${outcome.amount}`, '#c084fc'));
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
  if (state.phase === 'STARTER_SELECT') {
    return input.selectStarter ? startRun(state, input.selectStarter, config, rng) : state;
  }
  if (state.phase !== 'PLAYING') return state;

  let next = state;
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

  // Clone the mutable simulation entities so the input state stays untouched.
  const enemies: Enemy[] = state.enemies.map((e) => ({ ...e }));
  const projectiles: Projectile[] = state.projectiles.map((p) => ({
    ...p,
    hitIds: p.hitIds ? [...p.hitIds] : undefined,
  }));
  const hotSwapCooldowns = state.hotSwapCooldowns.map((c) => Math.max(0, c - dt)) as Cooldowns6;
  const damagePerSlot = [...state.runStats.damagePerSlot];
  const slotIndex = activeSlotIndex(state);
  // Age then drop expired floating texts so the array cannot grow unbounded.
  const floatingTexts: FloatingText[] = state.floatingTexts
    .map((t) => ({ ...t, age: t.age + dt }))
    .filter((t) => t.age < t.maxAge);
  let nextTextId = maxEntityId(state) + 1;
  let lastLeakerType: PokemonType | undefined;

  let bastionHp = state.bastionHp;
  let gold = state.gold;
  let totalKills = state.runStats.totalKills;
  let totalGold = state.runStats.totalGoldEarned;
  let totalDamage = state.runStats.totalDamageDealt;
  let waveEnemiesRemaining = state.waveEnemiesRemaining;
  let bossTimerSec = state.bossTimerSec;
  let ultimateCharge = state.ultimateCharge;
  let floor = state.floor;

  // 1. Enemies advance toward the center; leaks damage the bastion.
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = ARENA.CENTER - enemy.x;
    const dy = ARENA.CENTER - enemy.y;
    const d = Math.hypot(dx, dy);
    if (d <= ARENA.BASTION_DAMAGE_R) {
      bastionHp -= ENEMY_CONTACT_DAMAGE;
      lastLeakerType = enemy.types[0];
      enemy.alive = false;
      enemy.hp = 0;
      waveEnemiesRemaining = Math.max(0, waveEnemiesRemaining - 1);
      floatingTexts.push(
        createFloatingText(nextTextId++, enemy.x, enemy.y, `-${ENEMY_CONTACT_DAMAGE}`, '#ff4444'),
      );
      continue;
    }
    const move = Math.min(d, enemy.speed * dt);
    enemy.x += (dx / d) * move;
    enemy.y += (dy / d) * move;
  }

  // Bastion passive regeneration (PRD §4.1); skipped once destroyed.
  if (bastionHp > 0) {
    bastionHp = Math.min(
      state.bastionMaxHp,
      bastionHp + state.bastionMaxHp * BASTION_REGEN_FRACTION_PER_SEC * dt,
    );
  }

  // 2. Auto-fire.
  if (active) {
    for (const p of fireProjectiles(state, active, enemies, rng)) projectiles.push(p);
  }

  // 3. Projectiles move, then resolve hits (damage, kills, pierce/bounce).
  const liveProjectiles: Projectile[] = [];
  for (const p of projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < 0 || p.x > ARENA.SIZE || p.y < 0 || p.y > ARENA.SIZE) continue;

    let dead = false;
    for (const enemy of enemies) {
      if (!enemy.alive || p.hitIds?.includes(enemy.id)) continue;
      const rr = (enemy.isBoss ? ARENA.BOSS_HITBOX_R : ARENA.ENEMY_HITBOX_R) + ARENA.PROJECTILE_R;
      const dx = enemy.x - p.x;
      const dy = enemy.y - p.y;
      if (dx * dx + dy * dy > rr * rr) continue;

      const outcome = hitEnemy(enemy, p.damage, attackerOf(active, p.types), state, rng, config);
      totalDamage += outcome.amount;
      if (slotIndex >= 0) damagePerSlot[slotIndex] += outcome.amount;
      floatingTexts.push(
        createFloatingText(nextTextId++, enemy.x, enemy.y, `${outcome.amount}`, '#ffffff'),
      );
      if (outcome.amount > 0) {
        ultimateCharge = Math.min(state.ultimateMax, ultimateCharge + ULTIMATE_CHARGE_PER_HIT);
      }
      if (outcome.killed) {
        totalKills += 1;
        gold += outcome.goldGained;
        totalGold += outcome.goldGained;
        waveEnemiesRemaining = Math.max(0, waveEnemiesRemaining - 1);
        floatingTexts.push(
          createFloatingText(nextTextId++, enemy.x, enemy.y, `+${outcome.goldGained}`, '#ffd700'),
        );
      }
      p.hitIds = [...(p.hitIds ?? []), enemy.id];

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
      bastionHp: Math.max(0, bastionHp),
      gold,
      bossTimerSec,
      ultimateCharge,
      waveEnemiesRemaining,
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

  // 6. Wave complete: advance a floor and spawn the next wave.
  let finalEnemies = aliveEnemies;
  if (waveEnemiesRemaining <= 0 && aliveEnemies.length === 0) {
    floor += 1;
    const wave = generateWave(floor, rng);
    finalEnemies = wave;
    waveEnemiesRemaining = wave.length;
    bossTimerSec = wave.some((e) => e.isBoss) ? BOSS_TIMER_DURATION : undefined;
    runStats.floorReached = Math.max(runStats.floorReached, floor);
  }

  return {
    ...state,
    floor,
    enemies: finalEnemies,
    projectiles: liveProjectiles,
    floatingTexts,
    bastionHp: Math.max(0, bastionHp),
    gold,
    bossTimerSec,
    ultimateCharge,
    waveEnemiesRemaining,
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
