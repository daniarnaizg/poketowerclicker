import { describe, it, expect } from 'vitest';
import { tickGame } from '../gameLoop';
import { buildFloorPlan } from '../floorPlan';
import { spawnBossForFloor, spawnEnemyAt } from '../waveGenerator';
import { POKEDEX } from '../../data/pokemon';
import { TYPE_CHART } from '../damage';
import { ARENA } from '../../config/arena.config';
import {
  ALIVE_CAP,
  BOSS_ENRAGE_INTERVAL_SEC,
  BOSS_ENRAGE_MULT_PER_STEP,
  BOSS_PHASE_ADDS,
  BOSS_PHASE_ANCHOR_FRACTION,
  BOSS_PHASE_ANCHOR_TICK_SEC,
  BOSS_PHASE_INVULN_SEC,
  BOSS_PHASE_THRESHOLDS,
  BOSS_TIMER_MODE,
  bossBounty,
  bossHp,
} from '../../config/balance.config';
import type {
  BastionUpgrades,
  Cooldowns6,
  Enemy,
  GameConfig,
  GameState,
  LoadoutEntry,
  Projectile,
  Team6,
} from '../types';
import { PokemonType } from '../types';

const config: GameConfig = { pokedex: POKEDEX, typeChart: TYPE_CHART, seed: 1 };

const ZERO_UPGRADES: BastionUpgrades = {
  UP_ARROW: 0,
  UP_SPD: 0,
  UP_MULTI: 0,
  UP_AUTOCLICK: 0,
  UP_CRIT: 0,
  UP_CDMG: 0,
  UP_GOLD: 0,
};

const EXTREME_UPGRADES: BastionUpgrades = {
  ...ZERO_UPGRADES,
  UP_ARROW: 50,
  UP_CDMG: 50,
};

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function menuState(): GameState {
  const empty = (index: number) => ({
    index,
    pokemon: null,
    isActive: false,
    hotSwapCooldownSec: 0,
  });
  return {
    phase: 'MENU',
    floor: 1,
    team: [0, 1, 2, 3, 4, 5].map(empty) as Team6,
    teamLevel: 1,
    gold: 0,
    bastionUpgrades: { ...ZERO_UPGRADES },
    enemies: [],
    projectiles: [],
    floatingTexts: [],
    ultimateCharge: 0,
    ultimateMax: 0,
    waveEnemiesRemaining: 0,
    hotSwapCooldowns: [0, 0, 0, 0, 0, 0] as Cooldowns6,
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

function createExtremeState(seed = 1): GameState {
  const loadout: (LoadoutEntry | null)[] = [
    { definitionId: '0150', stars: 5 }, // Mewtwo 5★
    null,
    null,
    null,
    null,
    null,
  ];
  const initial = tickGame(menuState(), { startRun: loadout }, config, 0, mulberry32(seed));
  // Disables auto-fire by setting active pokemon spd: 0 to isolate test actions
  const team = initial.team.map((slot) =>
    slot.isActive && slot.pokemon
      ? { ...slot, pokemon: { ...slot.pokemon, spd: 0 } }
      : slot,
  ) as Team6;

  return {
    ...initial,
    floor: 10,
    teamLevel: 200,
    bastionUpgrades: { ...EXTREME_UPGRADES },
    team,
    gold: 0,
    projectiles: [],
    floatingTexts: [],
    effects: [],
    strikes: [],
  };
}

function createBoss(overrides: Partial<Enemy> = {}): Enemy {
  const maxHp = 3000;
  return {
    id: 99,
    x: ARENA.CENTER + 100,
    y: ARENA.CENTER,
    hp: maxHp,
    maxHp,
    alive: true,
    speed: 0,
    goldValue: 100,
    isBoss: true,
    bossPhase: 1,
    bossInvulnSec: 0,
    enraged: false,
    enrageElapsedSec: 0,
    bossTimerSec: 30,
    definitionId: '0127',
    types: [PokemonType.Normal],
    kind: 'miniboss',
    tier: 'normal',
    ...overrides,
  };
}

/** Ticks the simulation in 16.7 ms increments (~60 fps fixed steps). */
function advanceSec(state: GameState, seconds: number, seed = 1): GameState {
  let current = state;
  const steps = Math.round(seconds * 60);
  const rng = mulberry32(seed);
  for (let i = 0; i < steps; i++) {
    current = tickGame(current, {}, config, 16.7, rng);
  }
  return current;
}

describe('WP5 — Boss Phases & Enrage Invariants (§4.2–§4.6)', () => {
  describe('(a) Extreme team & damage clipping: cannot skip boss phases', () => {
    it('(a.1) Definitiva (Ultimate): clips at 66%, then 33%, then dies only after invuln', () => {
      const boss = createBoss({ maxHp: 3000, hp: 3000 });
      let state: GameState = {
        ...createExtremeState(1),
        enemies: [boss],
        waveEnemiesRemaining: 1,
      };

      const thresh66 = Math.ceil(boss.maxHp * BOSS_PHASE_THRESHOLDS[0]); // 1980
      const thresh33 = Math.ceil(boss.maxHp * BOSS_PHASE_THRESHOLDS[1]); // 990

      // 1) From 100% HP: Extreme Ultimate
      state = { ...state, ultimateCharge: state.ultimateMax };
      state = tickGame(state, { useUltimate: true }, config, 0, mulberry32(2));
      let currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.hp).toBe(thresh66);
      expect(currentBoss.bossPhase).toBe(2);
      expect(currentBoss.bossInvulnSec).toBe(BOSS_PHASE_INVULN_SEC);
      expect(currentBoss.alive).toBe(true);

      // Attempting damage during the 1.5s invuln has no effect
      state = { ...state, ultimateCharge: state.ultimateMax };
      state = tickGame(state, { useUltimate: true }, config, 0, mulberry32(3));
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.hp).toBe(thresh66);
      expect(currentBoss.bossPhase).toBe(2);

      // Advance 1.5s -> invulnerability expires
      state = advanceSec(state, 1.5, 4);
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.bossInvulnSec).toBe(0);
      expect(currentBoss.hp).toBe(thresh66);

      // 2) From 66% HP: Extreme Ultimate
      state = { ...state, ultimateCharge: state.ultimateMax };
      state = tickGame(state, { useUltimate: true }, config, 0, mulberry32(5));
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.hp).toBe(thresh33);
      expect(currentBoss.bossPhase).toBe(3);
      expect(currentBoss.bossInvulnSec).toBe(BOSS_PHASE_INVULN_SEC);
      expect(currentBoss.alive).toBe(true);

      // Advance 1.5s -> invulnerability expires
      state = advanceSec(state, 1.5, 6);
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.bossInvulnSec).toBe(0);
      expect(currentBoss.hp).toBe(thresh33);

      // 3) From 33% HP: Extreme Ultimate kills boss
      state = { ...state, ultimateCharge: state.ultimateMax };
      state = tickGame(state, { useUltimate: true }, config, 0, mulberry32(7));
      const deadBoss = state.enemies.find((e) => e.id === 99);
      expect(!deadBoss || !deadBoss.alive).toBe(true);
    });

    it('(a.2) Clic / proyectil extremo: clips at 66%, then 33%, then dies only after invuln', () => {
      const boss = createBoss({ maxHp: 3000, hp: 3000 });
      let state: GameState = {
        ...createExtremeState(1),
        enemies: [boss],
        waveEnemiesRemaining: 1,
      };

      const thresh66 = Math.ceil(boss.maxHp * BOSS_PHASE_THRESHOLDS[0]);
      const thresh33 = Math.ceil(boss.maxHp * BOSS_PHASE_THRESHOLDS[1]);

      // 1) Extreme projectile hit in Phase 1
      const p1: Projectile = {
        id: 501,
        x: boss.x,
        y: boss.y,
        vx: 0,
        vy: 0,
        damage: 1e9,
        types: [PokemonType.Psychic],
        fromPlayer: true,
      };
      state = tickGame({ ...state, projectiles: [p1] }, {}, config, 16.7, mulberry32(2));
      let currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.hp).toBe(thresh66);
      expect(currentBoss.bossPhase).toBe(2);
      expect(currentBoss.bossInvulnSec).toBe(BOSS_PHASE_INVULN_SEC);
      expect(currentBoss.alive).toBe(true);

      // Advance 1.5s
      state = advanceSec(state, 1.5, 3);
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.bossInvulnSec).toBe(0);

      // 2) Extreme projectile hit in Phase 2
      const p2: Projectile = {
        id: 502,
        x: boss.x,
        y: boss.y,
        vx: 0,
        vy: 0,
        damage: 1e9,
        types: [PokemonType.Psychic],
        fromPlayer: true,
      };
      state = tickGame({ ...state, projectiles: [p2] }, {}, config, 16.7, mulberry32(4));
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.hp).toBe(thresh33);
      expect(currentBoss.bossPhase).toBe(3);
      expect(currentBoss.bossInvulnSec).toBe(BOSS_PHASE_INVULN_SEC);
      expect(currentBoss.alive).toBe(true);

      // Advance 1.5s
      state = advanceSec(state, 1.5, 5);
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.bossInvulnSec).toBe(0);

      // 3) Extreme projectile hit in Phase 3 kills boss
      const p3: Projectile = {
        id: 503,
        x: boss.x,
        y: boss.y,
        vx: 0,
        vy: 0,
        damage: 1e9,
        types: [PokemonType.Psychic],
        fromPlayer: true,
      };
      state = tickGame({ ...state, projectiles: [p3] }, {}, config, 16.7, mulberry32(6));
      const deadBoss = state.enemies.find((e) => e.id === 99);
      expect(!deadBoss || !deadBoss.alive).toBe(true);
    });

    it('(a.3) Splash AoE: clips at 66%, then 33%, then dies only after invuln', () => {
      const boss = createBoss({ maxHp: 3000, hp: 3000, x: ARENA.CENTER + 100, y: ARENA.CENTER });
      const dummy: Enemy = {
        ...boss,
        id: 1001,
        isBoss: false,
        x: ARENA.CENTER + 120, // 20 px away from boss, well within splashRadius 50
        y: ARENA.CENTER,
      };
      let state: GameState = {
        ...createExtremeState(1),
        enemies: [boss, dummy],
        waveEnemiesRemaining: 2,
      };

      const thresh66 = Math.ceil(boss.maxHp * BOSS_PHASE_THRESHOLDS[0]);
      const thresh33 = Math.ceil(boss.maxHp * BOSS_PHASE_THRESHOLDS[1]);

      // 1) AoE splash projectile impacts dummy and splashes boss
      const p1: Projectile = {
        id: 601,
        x: dummy.x,
        y: dummy.y,
        vx: 0,
        vy: 0,
        damage: 1e9,
        splashRadius: 50,
        types: [PokemonType.Psychic],
        fromPlayer: true,
      };
      state = tickGame({ ...state, projectiles: [p1] }, {}, config, 16.7, mulberry32(2));
      let currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.hp).toBe(thresh66);
      expect(currentBoss.bossPhase).toBe(2);
      expect(currentBoss.bossInvulnSec).toBe(BOSS_PHASE_INVULN_SEC);
      expect(currentBoss.alive).toBe(true);

      // Advance 1.5s
      state = advanceSec(state, 1.5, 3);
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.bossInvulnSec).toBe(0);

      // 2) Place another dummy and splash again
      const dummy2: Enemy = { ...dummy, id: 1002, alive: true, hp: 1000 };
      const p2: Projectile = {
        id: 602,
        x: dummy2.x,
        y: dummy2.y,
        vx: 0,
        vy: 0,
        damage: 1e9,
        splashRadius: 50,
        types: [PokemonType.Psychic],
        fromPlayer: true,
      };
      state = tickGame({ ...state, enemies: [...state.enemies, dummy2], projectiles: [p2] }, {}, config, 16.7, mulberry32(4));
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.hp).toBe(thresh33);
      expect(currentBoss.bossPhase).toBe(3);
      expect(currentBoss.bossInvulnSec).toBe(BOSS_PHASE_INVULN_SEC);
      expect(currentBoss.alive).toBe(true);

      // Advance 1.5s
      state = advanceSec(state, 1.5, 5);
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.bossInvulnSec).toBe(0);

      // 3) Splash in Phase 3 kills boss
      const dummy3: Enemy = { ...dummy, id: 1003, alive: true, hp: 1000 };
      const p3: Projectile = {
        id: 603,
        x: dummy3.x,
        y: dummy3.y,
        vx: 0,
        vy: 0,
        damage: 1e9,
        splashRadius: 50,
        types: [PokemonType.Psychic],
        fromPlayer: true,
      };
      state = tickGame({ ...state, enemies: [...state.enemies, dummy3], projectiles: [p3] }, {}, config, 16.7, mulberry32(6));
      const deadBoss = state.enemies.find((e) => e.id === 99);
      expect(!deadBoss || !deadBoss.alive).toBe(true);
    });

    it('(a.4) Switch-in burst: clips at 66%, then 33%, then dies only after invuln', () => {
      // Setup: slot 0 is starter (active), slot 1 is Mewtwo 5★ (bench)
      const loadout: (LoadoutEntry | null)[] = [
        { definitionId: '0004', stars: 1 },
        { definitionId: '0150', stars: 5 },
        null,
        null,
        null,
        null,
      ];
      const initial = tickGame(menuState(), { startRun: loadout }, config, 0, mulberry32(1));
      const team = initial.team.map((slot) =>
        slot.pokemon ? { ...slot, pokemon: { ...slot.pokemon, spd: 0 } } : slot,
      ) as Team6;

      // Boss inside SWITCH_IN_RADIUS (60 px) from ARENA.CENTER
      const boss = createBoss({ maxHp: 3000, hp: 3000, x: ARENA.CENTER + 30, y: ARENA.CENTER });
      let state: GameState = {
        ...initial,
        floor: 10,
        teamLevel: 200,
        bastionUpgrades: { ...EXTREME_UPGRADES },
        team,
        enemies: [boss],
        waveEnemiesRemaining: 1,
      };

      const thresh66 = Math.ceil(boss.maxHp * BOSS_PHASE_THRESHOLDS[0]);
      const thresh33 = Math.ceil(boss.maxHp * BOSS_PHASE_THRESHOLDS[1]);

      // 1) Switch in Mewtwo (slot 1) with deltaMs = 0 -> burst clips at 66%
      state = tickGame(state, { hotSwapIndex: 1 }, config, 0, mulberry32(2));
      let currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.hp).toBe(thresh66);
      expect(currentBoss.bossPhase).toBe(2);
      expect(currentBoss.bossInvulnSec).toBe(BOSS_PHASE_INVULN_SEC);
      expect(currentBoss.alive).toBe(true);

      // Advance 1.5s
      state = advanceSec(state, 1.5, 3);
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.bossInvulnSec).toBe(0);

      // Reset active back to slot 0 and clear cooldowns to allow next switch-in
      state = {
        ...state,
        team: state.team.map((s, idx) => ({ ...s, isActive: idx === 0 })) as Team6,
        hotSwapCooldowns: [0, 0, 0, 0, 0, 0],
      };

      // 2) Switch in Mewtwo again -> burst clips at 33%
      state = tickGame(state, { hotSwapIndex: 1 }, config, 0, mulberry32(4));
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.hp).toBe(thresh33);
      expect(currentBoss.bossPhase).toBe(3);
      expect(currentBoss.bossInvulnSec).toBe(BOSS_PHASE_INVULN_SEC);
      expect(currentBoss.alive).toBe(true);

      // Advance 1.5s
      state = advanceSec(state, 1.5, 5);
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.bossInvulnSec).toBe(0);

      // Reset active to 0 and clear cooldowns
      state = {
        ...state,
        team: state.team.map((s, idx) => ({ ...s, isActive: idx === 0 })) as Team6,
        hotSwapCooldowns: [0, 0, 0, 0, 0, 0],
      };

      // 3) Switch in Mewtwo in Phase 3 kills boss
      state = tickGame(state, { hotSwapIndex: 1 }, config, 0, mulberry32(6));
      const deadBoss = state.enemies.find((e) => e.id === 99);
      expect(!deadBoss || !deadBoss.alive).toBe(true);
    });

    it('(a.5) Tick de BURN con dps: 1e9: clips at 66%, then 33%, then dies only after invuln', () => {
      const boss = createBoss({
        maxHp: 3000,
        hp: 3000,
        statuses: [
          {
            id: 'BURN',
            remainingSec: 10,
            dps: 1e9,
            sourceSlot: 0,
          },
        ],
      });
      let state: GameState = {
        ...createExtremeState(1),
        enemies: [boss],
        waveEnemiesRemaining: 1,
      };

      const thresh66 = Math.ceil(boss.maxHp * BOSS_PHASE_THRESHOLDS[0]);
      const thresh33 = Math.ceil(boss.maxHp * BOSS_PHASE_THRESHOLDS[1]);

      // Step 1: 1st tick of BURN clips at 66%
      state = tickGame(state, {}, config, 16.7, mulberry32(2));
      let currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.hp).toBe(thresh66);
      expect(currentBoss.bossPhase).toBe(2);
      expect(currentBoss.bossInvulnSec).toBe(BOSS_PHASE_INVULN_SEC);

      // During the 1.5s of invulnerability, burn ticks each step but boss hp stays unchanged
      state = advanceSec(state, 1.5, 3);
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.bossInvulnSec).toBe(0);
      expect(currentBoss.hp).toBe(thresh66);

      // Next tick after invulnerability expires: clips at 33%
      state = tickGame(state, {}, config, 16.7, mulberry32(4));
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.hp).toBe(thresh33);
      expect(currentBoss.bossPhase).toBe(3);
      expect(currentBoss.bossInvulnSec).toBe(BOSS_PHASE_INVULN_SEC);

      // During the next 1.5s of invulnerability, hp stays at 33%
      state = advanceSec(state, 1.5, 5);
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.bossInvulnSec).toBe(0);
      expect(currentBoss.hp).toBe(thresh33);

      // Next tick kills boss
      state = tickGame(state, {}, config, 16.7, mulberry32(6));
      const deadBoss = state.enemies.find((e) => e.id === 99);
      expect(!deadBoss || !deadBoss.alive).toBe(true);
    });
  });

  describe('(b) Behavior during 1.5s bossInvulnSec', () => {
    it('prevents damage, freezes bossTimerSec, freezes floorRuntime.elapsedSec and suppresses anchored strike', () => {
      const boss = createBoss({
        maxHp: 3000,
        hp: 1980,
        bossPhase: 2,
        bossInvulnSec: 1.5,
        bossTimerSec: 25,
        anchoredAtBastion: true,
        bossAttackCooldownSec: 0,
      });

      const plan = buildFloorPlan(1, 10);
      const baseState = createExtremeState(1);
      const initialActiveHp = baseState.team[0].pokemon!.hp;

      let state: GameState = {
        ...baseState,
        enemies: [boss],
        bossTimerSec: 25,
        floorRuntime: {
          plan,
          nextEventIdx: 0,
          elapsedSec: 5.0,
        },
        waveEnemiesRemaining: 1,
      };

      // 1) Attacking during invulnerability does not damage boss
      const attackProj: Projectile = {
        id: 701,
        x: boss.x,
        y: boss.y,
        vx: 0,
        vy: 0,
        damage: 1e9,
        types: [PokemonType.Psychic],
        fromPlayer: true,
      };
      state = tickGame({ ...state, projectiles: [attackProj] }, {}, config, 16.7, mulberry32(1));
      let currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.hp).toBe(1980);

      // 2) Advance 0.5s while still invulnerable
      state = advanceSec(state, 0.5, 2);
      currentBoss = state.enemies.find((e) => e.id === 99)!;

      // Invulnerability counts down (1.5 -> ~0.98s remaining)
      expect(currentBoss.bossInvulnSec).toBeCloseTo(1.0, 1);

      // bossTimerSec did NOT decrease
      expect(currentBoss.bossTimerSec).toBe(25);
      expect(state.bossTimerSec).toBe(25);

      // floorRuntime.elapsedSec did NOT advance
      expect(state.floorRuntime?.elapsedSec).toBe(5.0);

      // Anchored boss did NOT damage the active Pokémon
      const activePkm = state.team.find((s) => s.isActive)?.pokemon;
      expect(activePkm?.hp).toBe(initialActiveHp);
      expect(state.strikes ?? []).toHaveLength(0);

      // 3) Once invulnerability completely expires, anchored strike operates normally
      state = advanceSec(state, 1.0, 3);
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.bossInvulnSec).toBe(0);

      // On next step with bossAttackCooldownSec <= 0, boss can strike
      state = tickGame(state, {}, config, 16.7, mulberry32(4));
      const activeAfterInvuln = state.team.find((s) => s.isActive)?.pokemon;
      expect(activeAfterInvuln?.hp).toBeLessThan(initialActiveHp);
    });
  });

  describe('(c) Phase scaling and adds: 5%/7%/9% anchor strike, 1.0/0.85/0.70s intervals, adds respect ALIVE_CAP & pay 0 gold', () => {
    it('scales anchored strike damage to 5% / 7% / 9% and cooldown to 1.0s / 0.85s / 0.70s', () => {
      const testPhase = (phase: 1 | 2 | 3) => {
        const base = createExtremeState(1);
        const active = base.team[0].pokemon!;
        // Make active normal type for neutral effectiveness
        const teamWithNormal = base.team.map((s) =>
          s.isActive && s.pokemon ? { ...s, pokemon: { ...s.pokemon, types: [PokemonType.Normal] } } : s,
        ) as Team6;

        const boss = createBoss({
          bossPhase: phase,
          bossInvulnSec: 0,
          anchoredAtBastion: true,
          bossAttackCooldownSec: 0,
          types: [PokemonType.Normal],
        });

        const state: GameState = {
          ...base,
          team: teamWithNormal,
          enemies: [boss],
          waveEnemiesRemaining: 1,
        };

        const next = tickGame(state, {}, config, 16.7, mulberry32(1));
        const activeAfter = next.team.find((s) => s.isActive)!.pokemon!;
        const bossAfter = next.enemies.find((e) => e.id === 99)!;
        const damageDealt = active.hp - activeAfter.hp;

        return {
          damageDealt,
          maxHp: active.maxHp,
          cooldown: bossAfter.bossAttackCooldownSec,
        };
      };

      const p1 = testPhase(1);
      const p2 = testPhase(2);
      const p3 = testPhase(3);

      expect(p1.damageDealt).toBe(Math.round(p1.maxHp * BOSS_PHASE_ANCHOR_FRACTION[0])); // 5%
      expect(p2.damageDealt).toBe(Math.round(p2.maxHp * BOSS_PHASE_ANCHOR_FRACTION[1])); // 7%
      expect(p3.damageDealt).toBe(Math.round(p3.maxHp * BOSS_PHASE_ANCHOR_FRACTION[2])); // 9%

      expect(p1.cooldown).toBe(BOSS_PHASE_ANCHOR_TICK_SEC[0]); // 1.0 s
      expect(p2.cooldown).toBe(BOSS_PHASE_ANCHOR_TICK_SEC[1]); // 0.85 s
      expect(p3.cooldown).toBe(BOSS_PHASE_ANCHOR_TICK_SEC[2]); // 0.70 s
    });

    it('enqueues 6 adds entering phase 2 and 8 adds entering phase 3', () => {
      const boss = createBoss({ maxHp: 3000, hp: 3000, bossPhase: 1, bossInvulnSec: 0 });
      const plan = buildFloorPlan(1, 10);
      let state: GameState = {
        ...createExtremeState(1),
        enemies: [boss],
        floorRuntime: { plan, nextEventIdx: plan.events.length, elapsedSec: 0 },
        waveEnemiesRemaining: 1,
      };

      // 1) Clip into Phase 2
      const p1: Projectile = {
        id: 801,
        x: boss.x,
        y: boss.y,
        vx: 0,
        vy: 0,
        damage: 1e9,
        types: [PokemonType.Psychic],
        fromPlayer: true,
      };
      state = tickGame({ ...state, projectiles: [p1] }, {}, config, 16.7, mulberry32(2));
      const addsPhase2 = state.floorRuntime!.plan.events.filter((ev) => ev.tier === 'add');
      expect(addsPhase2).toHaveLength(BOSS_PHASE_ADDS[1]); // 6 adds

      // Advance 1.5s
      state = advanceSec(state, 1.5, 3);

      // 2) Clip into Phase 3
      const p2: Projectile = {
        id: 802,
        x: boss.x,
        y: boss.y,
        vx: 0,
        vy: 0,
        damage: 1e9,
        types: [PokemonType.Psychic],
        fromPlayer: true,
      };
      state = tickGame({ ...state, projectiles: [p2] }, {}, config, 16.7, mulberry32(4));
      const addsPhase3 = state.floorRuntime!.plan.events.filter((ev) => ev.tier === 'add');
      expect(addsPhase3).toHaveLength(BOSS_PHASE_ADDS[1] + BOSS_PHASE_ADDS[2]); // 6 + 8 = 14 adds
    });

    it('adds respect ALIVE_CAP: held in queue while aliveCount >= ALIVE_CAP and spawn when capacity opens', () => {
      const boss = createBoss({ id: 99, x: ARENA.CENTER + 150 });
      // Create 69 normal alive enemies + 1 boss = 70 enemies (ALIVE_CAP)
      const aliveEnemies: Enemy[] = [boss];
      for (let i = 1; i < ALIVE_CAP; i++) {
        aliveEnemies.push({
          ...boss,
          id: 100 + i,
          isBoss: false,
          x: ARENA.CENTER + 150,
        });
      }
      expect(aliveEnemies).toHaveLength(ALIVE_CAP);

      const plan = buildFloorPlan(1, 10);
      // Put 6 add events ready to spawn at tSec = 0
      const addEvents = [1, 2, 3, 4, 5, 6].map((i) => ({
        index: i,
        tSec: 0,
        angle: 0,
        defId: '0019',
        tier: 'add' as const,
      }));

      let state: GameState = {
        ...createExtremeState(1),
        enemies: aliveEnemies,
        floorRuntime: {
          plan: { ...plan, events: addEvents, totalEnemies: addEvents.length },
          nextEventIdx: 0,
          elapsedSec: 1.0,
        },
        waveEnemiesRemaining: ALIVE_CAP + addEvents.length,
      };

      // Tick while at ALIVE_CAP: no new adds should spawn
      state = tickGame(state, {}, config, 16.7, mulberry32(1));
      expect(state.enemies.filter((e) => e.alive)).toHaveLength(ALIVE_CAP);
      expect(state.floorRuntime?.nextEventIdx).toBe(0);

      // Kill 2 enemies so alive count drops to 68, maintaining waveEnemiesRemaining in sync
      const enemiesWithRoom = state.enemies.map((e, idx) =>
        idx === 1 || idx === 2 ? { ...e, alive: false, hp: 0 } : e,
      );
      state = {
        ...state,
        enemies: enemiesWithRoom,
        waveEnemiesRemaining: state.waveEnemiesRemaining - 2,
      };

      // Next tick: exactly 2 adds spawn to refill back to ALIVE_CAP (70)
      state = tickGame(state, {}, config, 16.7, mulberry32(2));
      const newlyAlive = state.enemies.filter((e) => e.alive);
      expect(newlyAlive).toHaveLength(ALIVE_CAP);
      expect(state.floorRuntime?.nextEventIdx).toBe(2);
      expect(newlyAlive.some((e) => e.tier === 'add')).toBe(true);
    });

    it('adds pay 0 gold on death', () => {
      const addEnemy: Enemy = {
        ...createBoss(),
        id: 1005,
        isBoss: false,
        tier: 'add',
        goldValue: 0,
        hp: 50,
        maxHp: 50,
      };

      const base = createExtremeState(1);
      const goldBefore = base.gold;
      const killsBefore = base.runStats.totalKills;

      const killProj: Projectile = {
        id: 901,
        x: addEnemy.x,
        y: addEnemy.y,
        vx: 0,
        vy: 0,
        damage: 1e9,
        types: [PokemonType.Psychic],
        fromPlayer: true,
      };

      const next = tickGame(
        { ...base, enemies: [addEnemy], waveEnemiesRemaining: 1 },
        { startRun: undefined },
        config,
        16.7,
        mulberry32(1),
      );
      const afterShot = tickGame({ ...next, projectiles: [killProj] }, {}, config, 16.7, mulberry32(2));

      expect(afterShot.enemies.some((e) => e.id === 1005 && e.alive)).toBe(false);
      expect(afterShot.runStats.totalKills).toBe(killsBefore + 1);
      expect(afterShot.gold).toBe(goldBefore); // 0 gold paid
      expect(afterShot.runStats.totalGoldEarned).toBe(base.runStats.totalGoldEarned);
    });
  });

  describe('(d) Boss death: all alive adds disappear immediately without paying gold or damaging active', () => {
    it('cleans up alive adds immediately with 0 gold gained and no damage dealt to active Pokémon', () => {
      const boss = createBoss({
        id: 99,
        maxHp: 3000,
        hp: 10,
        bossPhase: 3,
        bossInvulnSec: 0,
        goldValue: bossBounty(10),
      });

      const aliveAdd1: Enemy = {
        ...boss,
        id: 2001,
        isBoss: false,
        tier: 'add',
        hp: 100,
        maxHp: 100,
        x: ARENA.CENTER + 50,
        y: ARENA.CENTER,
      };

      const aliveAdd2: Enemy = {
        ...boss,
        id: 2002,
        isBoss: false,
        tier: 'add',
        hp: 100,
        maxHp: 100,
        x: ARENA.CENTER + 60,
        y: ARENA.CENTER,
      };

      const plan = buildFloorPlan(1, 10);
      const futureAddEvents = [
        { index: 10, tSec: 10, angle: 0, defId: '0019', tier: 'add' as const },
      ];

      const base = createExtremeState(1);
      const goldBefore = base.gold;
      const initialActiveHp = base.team[0].pokemon!.hp;

      let state: GameState = {
        ...base,
        enemies: [boss, aliveAdd1, aliveAdd2],
        floorRuntime: {
          plan: { ...plan, events: [...plan.events, ...futureAddEvents] },
          nextEventIdx: plan.events.length,
          elapsedSec: 0,
        },
        waveEnemiesRemaining: 3 + futureAddEvents.length,
      };

      // Kill the boss directly with a projectile
      const killBossProj: Projectile = {
        id: 999,
        x: boss.x,
        y: boss.y,
        vx: 0,
        vy: 0,
        damage: 1e9,
        types: [PokemonType.Psychic],
        fromPlayer: true,
      };

      state = tickGame({ ...state, projectiles: [killBossProj] }, {}, config, 16.7, mulberry32(1));

      // 1) Boss died
      expect(state.enemies.some((e) => e.id === 99 && e.alive)).toBe(false);

      // 2) All alive adds disappeared immediately
      expect(state.enemies.some((e) => e.tier === 'add')).toBe(false);
      expect(state.enemies.some((e) => e.id === 2001 || e.id === 2002)).toBe(false);

      // 3) Future add events in queue were cleaned up
      const remainingAddEvents = state.floorRuntime?.plan.events.filter((ev) => ev.tier === 'add');
      expect(remainingAddEvents).toHaveLength(0);

      // 4) Gold paid is ONLY the boss bounty (adds paid 0)
      const expectedGoldGain = Math.floor(boss.goldValue);
      expect(state.gold).toBe(goldBefore + expectedGoldGain);

      // 5) Active Pokémon took 0 damage from the despawned adds
      const activePkm = state.team.find((s) => s.isActive)?.pokemon;
      expect(activePkm?.hp).toBe(initialActiveHp);
    });
  });

  describe('(e) Boss timer mode: enrage vs gameover', () => {
    it('in default enrage mode, expiring timer does not end run, sets enraged = true, and scales damage x1.5 then x2.25 after 10s', () => {
      expect(BOSS_TIMER_MODE).toBe('enrage');

      const base = createExtremeState(1);
      const active = base.team[0].pokemon!;
      const teamWithNormal = base.team.map((s) =>
        s.isActive && s.pokemon ? { ...s, pokemon: { ...s.pokemon, types: [PokemonType.Normal] } } : s,
      ) as Team6;

      const boss = createBoss({
        id: 99,
        bossTimerSec: 0.01,
        bossInvulnSec: 0,
        bossPhase: 1,
        anchoredAtBastion: true,
        bossAttackCooldownSec: 1.0, // not ready during transition tick
        types: [PokemonType.Normal],
      });

      let state: GameState = {
        ...base,
        team: teamWithNormal,
        enemies: [boss],
        bossTimerSec: 0.01,
        waveEnemiesRemaining: 1,
      };

      // 1) Timer reaches 0 on tick
      state = tickGame(state, {}, config, 16.7, mulberry32(1));
      expect(state.phase).toBe('PLAYING'); // Run did NOT terminate
      let currentBoss = state.enemies.find((e) => e.id === 99)!;
      expect(currentBoss.enraged).toBe(true);
      expect(currentBoss.bossTimerSec).toBe(0);
      expect(state.bossTimerSec).toBe(0);
      expect(currentBoss.enrageElapsedSec).toBeGreaterThan(0);

      // 2) Trigger strike while enraged (at entry: enrageElapsedSec < 10)
      currentBoss.bossAttackCooldownSec = 0;
      const activeHpBeforeHit1 = state.team.find((s) => s.isActive)!.pokemon!.hp;
      state = tickGame(state, {}, config, 16.7, mulberry32(2));
      const activeHpAfterHit1 = state.team.find((s) => s.isActive)!.pokemon!.hp;
      const damageHit1 = activeHpBeforeHit1 - activeHpAfterHit1;
      const expectedHit1 = Math.round(active.maxHp * (BOSS_PHASE_ANCHOR_FRACTION[0] * BOSS_ENRAGE_MULT_PER_STEP));
      expect(damageHit1).toBe(expectedHit1);

      // 3) After 10s of enrage, damage scales x2.25 (1.5 * 1.5)
      currentBoss = state.enemies.find((e) => e.id === 99)!;
      currentBoss.enrageElapsedSec = BOSS_ENRAGE_INTERVAL_SEC + 0.1; // > 10 s
      currentBoss.bossAttackCooldownSec = 0; // ready to attack
      const activeHpBeforeHit2 = activeHpAfterHit1;

      state = tickGame(state, {}, config, 16.7, mulberry32(3));
      const activeHpAfterHit2 = state.team.find((s) => s.isActive)!.pokemon!.hp;
      const damageHit2 = activeHpBeforeHit2 - activeHpAfterHit2;
      const expectedHit2 = Math.round(
        active.maxHp * (BOSS_PHASE_ANCHOR_FRACTION[0] * BOSS_ENRAGE_MULT_PER_STEP * BOSS_ENRAGE_MULT_PER_STEP),
      );
      expect(damageHit2).toBe(expectedHit2);
    });

    it('with bossTimerMode: "gameover", expiring timer terminates run with GAME_OVER and defeatCause: "bossTimerExpired"', () => {
      const gameOverConfig: GameConfig = {
        ...config,
        bossTimerMode: 'gameover',
      };

      const base = createExtremeState(1);
      const boss = createBoss({
        id: 99,
        bossTimerSec: 0.01,
        bossInvulnSec: 0,
      });

      const state: GameState = {
        ...base,
        enemies: [boss],
        bossTimerSec: 0.01,
        waveEnemiesRemaining: 1,
      };

      const next = tickGame(state, {}, gameOverConfig, 16.7, mulberry32(1));
      expect(next.phase).toBe('GAME_OVER');
      expect(next.runStats.defeatCause).toBe('bossTimerExpired');
    });
  });
});
