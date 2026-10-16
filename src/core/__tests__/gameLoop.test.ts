import { describe, it, expect } from 'vitest';
import { tickGame } from '../gameLoop';
import { generateWave } from '../waveGenerator';
import { calculateUpgradeCost, purchaseUpgrade } from '../bastionUpgrades';
import { POKEDEX } from '../../data/pokemon';
import { TYPE_CHART } from '../damage';
import { ARENA } from '../../config/arena.config';
import {
  BOSS_HP_MULTIPLIER,
  BOSS_TIMER_DURATION,
  ENEMY_CONTACT_DAMAGE,
  ENEMY_CONTACT_DAMAGE_FLOOR_SCALE,
  HOT_SWAP_COOLDOWN,
  INTER_WAVE_BREAK_SEC,
  WALL_HP_PER_LEVEL,
  WAVE_ENEMY_COUNT_BASE,
  enemyHp,
} from '../../config/balance.config';
import type { BastionUpgrades, Cooldowns6, GameConfig, GameState, Team6 } from '../types';

const config: GameConfig = { pokedex: POKEDEX, typeChart: TYPE_CHART, seed: 42 };

const ZERO_UPGRADES: BastionUpgrades = {
  UP_CLICK: 0,
  UP_HP: 0,
  UP_MULTI: 0,
  UP_ARROW: 0,
  UP_SPD: 0,
  UP_CRIT: 0,
  UP_CDMG: 0,
  UP_GOLD: 0,
  UP_WALL: 0,
};

/** Deterministic PRNG so runs are reproducible across calls. */
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

function emptyState(): GameState {
  const empty = (index: number) => ({ index, pokemon: null, isActive: false, hotSwapCooldownSec: 0 });
  const cooldowns: Cooldowns6 = [0, 0, 0, 0, 0, 0];
  return {
    phase: 'STARTER_SELECT',
    floor: 0,
    team: [empty(0), empty(1), empty(2), empty(3), empty(4), empty(5)] as Team6,
    teamLevel: 1,
    gold: 0,
    bastionHp: 100,
    bastionMaxHp: 100,
    bastionUpgrades: { ...ZERO_UPGRADES },
    enemies: [],
    projectiles: [],
    floatingTexts: [],
    ultimateCharge: 0,
    ultimateMax: 0,
    waveEnemiesRemaining: 0,
    hotSwapCooldowns: cooldowns,
    runStats: {
      totalKills: 0,
      totalGoldEarned: 0,
      totalDamageDealt: 0,
      damagePerSlot: [0, 0, 0, 0, 0, 0],
      mvpSlotIndex: -1,
      floorReached: 0,
      durationSec: 0,
    },
  };
}

function startingRun(seed: number): GameState {
  return tickGame(emptyState(), { selectStarter: '0004' }, config, 0, mulberry32(seed));
}

describe('generateWave', () => {
  it('spawns a normal wave of enemies on the arena perimeter', () => {
    const wave = generateWave(5, mulberry32(1));
    expect(wave).toHaveLength(WAVE_ENEMY_COUNT_BASE);
    expect(wave.every((e) => !e.isBoss)).toBe(true);
    for (const enemy of wave) {
      expect(Math.hypot(enemy.x - ARENA.CENTER, enemy.y - ARENA.CENTER)).toBeCloseTo(ARENA.CENTER, 5);
      expect(enemy.hp).toBe(enemyHp(5));
    }
    expect(new Set(wave.map((e) => e.id)).size).toBe(WAVE_ENEMY_COUNT_BASE);
  });

  it('spawns a single boss with 10x HP and a 30s timer on mini-boss floors', () => {
    const wave = generateWave(10, mulberry32(2));
    expect(wave).toHaveLength(1);
    expect(wave[0].isBoss).toBe(true);
    expect(wave[0].hp).toBe(enemyHp(10) * BOSS_HP_MULTIPLIER);
    expect(wave[0].bossTimerSec).toBe(BOSS_TIMER_DURATION);
  });

  it('gives major bosses (floor 50/100) even more HP', () => {
    const mini = generateWave(40, mulberry32(3))[0];
    const major = generateWave(50, mulberry32(3))[0];
    expect(major.isBoss).toBe(true);
    expect(major.hp).toBeGreaterThan(mini.hp);
  });
});

describe('tickGame', () => {
  it('starts a run with the chosen starter active', () => {
    const state = startingRun(7);
    expect(state.phase).toBe('PLAYING');
    expect(state.floor).toBe(1);
    expect(state.team[0].isActive).toBe(true);
    expect(state.team[0].pokemon?.definitionId).toBe('0004');
    expect(state.enemies).toHaveLength(WAVE_ENEMY_COUNT_BASE);
    expect(state.waveEnemiesRemaining).toBe(WAVE_ENEMY_COUNT_BASE);
  });

  it('is deterministic for a given seed', () => {
    const run = (seed: number) => {
      const rng = mulberry32(seed);
      let state = tickGame(emptyState(), { selectStarter: '0004' }, config, 0, rng);
      for (let i = 0; i < 120; i++) state = tickGame(state, {}, config, 16.7, rng);
      return state;
    };
    expect(JSON.stringify(run(99))).toBe(JSON.stringify(run(99)));
  });

  it('swaps the active Pokémon and applies the cooldown', () => {
    const base = startingRun(1);
    const bench = { ...base.team[0].pokemon!, id: 99 };
    const withBench: GameState = {
      ...base,
      team: base.team.map((slot, i) => (i === 1 ? { ...slot, pokemon: bench } : slot)) as Team6,
    };

    const swapped = tickGame(withBench, { hotSwapIndex: 1 }, config, 0, mulberry32(2));
    expect(swapped.team[1].isActive).toBe(true);
    expect(swapped.team[0].isActive).toBe(false);
    expect(swapped.hotSwapCooldowns[1]).toBe(HOT_SWAP_COOLDOWN);

    const ticked = tickGame(swapped, {}, config, 16.7, mulberry32(3));
    expect(ticked.hotSwapCooldowns[1]).toBeLessThan(HOT_SWAP_COOLDOWN);
    expect(ticked.hotSwapCooldowns[1]).toBeGreaterThan(0);
  });

  it('moves enemies toward the bastion center', () => {
    const base = startingRun(11);
    const before = base.enemies[0];
    const distBefore = Math.hypot(before.x - ARENA.CENTER, before.y - ARENA.CENTER);
    const after = tickGame(base, {}, config, 16.7, mulberry32(12));
    const moved = after.enemies.find((e) => e.id === before.id) ?? after.enemies[0];
    const distAfter = Math.hypot(moved.x - ARENA.CENTER, moved.y - ARENA.CENTER);
    expect(distAfter).toBeLessThan(distBefore);
  });

  const ticks = (from: GameState, n: number): GameState => {
    let state = from;
    for (let i = 0; i < n; i++) state = tickGame(state, {}, config, 16.7, mulberry32(100 + i));
    return state;
  };

  it('advances the floor once a wave is cleared and the breather expires', () => {
    const base = startingRun(21);
    const cleared: GameState = { ...base, enemies: [], waveEnemiesRemaining: 0 };
    const inBreak = tickGame(cleared, {}, config, 16.7, mulberry32(22));
    expect(inBreak.floor).toBe(1);
    expect(inBreak.interWaveTimerSec).toBeCloseTo(INTER_WAVE_BREAK_SEC - 1 / 60, 5);
    expect(inBreak.enemies).toHaveLength(0);

    const next = ticks(inBreak, 60 * 3);
    expect(next.floor).toBe(2);
    expect(next.interWaveTimerSec).toBeUndefined();
    expect(next.enemies.length).toBeGreaterThan(0);
    expect(next.waveEnemiesRemaining).toBe(next.enemies.length);
  });

  it('waits for the player when auto-advance is off', () => {
    const base = startingRun(21);
    const cleared: GameState = { ...base, enemies: [], waveEnemiesRemaining: 0, autoAdvanceWave: false };
    const awaiting = tickGame(cleared, {}, config, 16.7, mulberry32(22));
    expect(awaiting.awaitingNextWave).toBe(true);
    expect(awaiting.interWaveTimerSec).toBeUndefined();

    const waited = ticks(awaiting, 60 * 10);
    expect(waited.floor).toBe(1);
    expect(waited.enemies).toHaveLength(0);

    const spawned = tickGame(waited, { startNextWave: true }, config, 16.7, mulberry32(23));
    expect(spawned.floor).toBe(2);
    expect(spawned.enemies.length).toBeGreaterThan(0);
  });

  it('startNextWave skips the auto-advance countdown', () => {
    const base = startingRun(21);
    const cleared: GameState = { ...base, enemies: [], waveEnemiesRemaining: 0 };
    const inBreak = tickGame(cleared, {}, config, 16.7, mulberry32(22));
    expect(inBreak.interWaveTimerSec).toBeGreaterThan(0);

    const spawned = tickGame(inBreak, { startNextWave: true }, config, 16.7, mulberry32(23));
    expect(spawned.floor).toBe(2);
    expect(spawned.enemies.length).toBeGreaterThan(0);
  });

  it('setAutoAdvance flips the auto-advance flag', () => {
    const base = startingRun(21);
    expect(tickGame(base, { setAutoAdvance: false }, config, 16.7, mulberry32(22)).autoAdvanceWave).toBe(false);
    const off: GameState = { ...base, autoAdvanceWave: false };
    expect(tickGame(off, { setAutoAdvance: true }, config, 16.7, mulberry32(22)).autoAdvanceWave).toBe(true);
  });

  it('charges the ultimate but does not regenerate during the breather', () => {
    const base = startingRun(21);
    // interWaveTimerSec is pre-set: a single tick starts the break in section 6,
    // which runs after regen, so the pause is only observable across ticks.
    const inBreak: GameState = {
      ...base,
      enemies: [],
      waveEnemiesRemaining: 0,
      bastionHp: 50,
      interWaveTimerSec: 1.5,
    };
    const next = tickGame(inBreak, {}, config, 16.7, mulberry32(22));
    expect(next.ultimateCharge).toBeGreaterThan(0);
    expect(next.bastionHp).toBe(50);
  });

  it('scales contact damage with the floor (≈1.4x at floor 41 vs floor 1)', () => {
    const leakDamage = (floor: number): number => {
      const base = startingRun(43);
      const atCenter = { ...base.enemies[0], x: ARENA.CENTER, y: ARENA.CENTER };
      const doomed: GameState = {
        ...base,
        floor,
        bastionHp: 10_000,
        bastionMaxHp: 10_000,
        enemies: [atCenter],
        waveEnemiesRemaining: 1,
        // Pause regen (breather) so the contact hit is not healed away within the tick.
        interWaveTimerSec: 1.5,
      };
      return doomed.bastionHp - tickGame(doomed, {}, config, 16.7, mulberry32(44)).bastionHp;
    };
    expect(leakDamage(1)).toBeCloseTo(ENEMY_CONTACT_DAMAGE, 5);
    expect(leakDamage(41)).toBeCloseTo(ENEMY_CONTACT_DAMAGE * (1 + 40 * ENEMY_CONTACT_DAMAGE_FLOOR_SCALE), 5);
    expect(leakDamage(41)).toBeCloseTo(1.4 * leakDamage(1), 5);
  });

  it('UP_WALL raises max HP by 10% (rounded) and heals by the same amount', () => {
    const base = startingRun(81);
    const wallState: GameState = { ...base, gold: 1000, bastionMaxHp: 130, bastionHp: 50 };
    const next = purchaseUpgrade(wallState, 'UP_WALL');
    const gain = Math.round(130 * WALL_HP_PER_LEVEL);
    expect(next.bastionUpgrades.UP_WALL).toBe(1);
    expect(next.bastionMaxHp).toBe(130 + gain);
    expect(next.bastionHp).toBe(50 + gain);
    expect(next.gold).toBe(1000 - calculateUpgradeCost('UP_WALL', 0));
  });

  it('UP_WALL is a no-op when gold is insufficient', () => {
    const base = startingRun(81);
    const poor: GameState = { ...base, gold: 0, bastionMaxHp: 130, bastionHp: 50 };
    expect(purchaseUpgrade(poor, 'UP_WALL')).toBe(poor);
  });

  it('ends the run when the boss timer expires', () => {
    const base = startingRun(31);
    const bossWave = generateWave(10, mulberry32(32));
    const bossState: GameState = {
      ...base,
      floor: 10,
      enemies: bossWave,
      waveEnemiesRemaining: bossWave.length,
      bossTimerSec: 0.01,
    };
    const next = tickGame(bossState, {}, config, 16.7, mulberry32(33));
    expect(next.phase).toBe('GAME_OVER');
  });

  it('ends the run when an enemy reaches the bastion and HP is depleted', () => {
    const base = startingRun(41);
    const atCenter = { ...base.enemies[0], x: ARENA.CENTER, y: ARENA.CENTER };
    const doomed: GameState = { ...base, bastionHp: 1, enemies: [atCenter], waveEnemiesRemaining: 1 };
    const next = tickGame(doomed, {}, config, 16.7, mulberry32(42));
    expect(next.phase).toBe('GAME_OVER');
    expect(next.bastionHp).toBe(0);
    expect(next.runStats.defeatCause).toBe('bastionDestroyed');
    expect(next.runStats.defeatEnemyType).toBeDefined();
  });

  it('regenerates bastion HP passively each step', () => {
    const base = startingRun(51);
    const hurt: GameState = { ...base, bastionHp: 50 };
    const next = tickGame(hurt, {}, config, 16.7, mulberry32(52));
    expect(next.bastionHp).toBeGreaterThan(50);
  });

  it('hits nearby enemies with a switch-in burst and credits the incoming slot', () => {
    const base = startingRun(61);
    const bench = { ...base.team[0].pokemon!, id: 99 };
    const atCenter = { ...base.enemies[0], x: ARENA.CENTER, y: ARENA.CENTER, hp: 100_000, maxHp: 100_000 };
    const withBench: GameState = {
      ...base,
      team: base.team.map((slot, i) => (i === 1 ? { ...slot, pokemon: bench } : slot)) as Team6,
      enemies: [atCenter],
      waveEnemiesRemaining: 1,
    };

    const swapped = tickGame(withBench, { hotSwapIndex: 1 }, config, 0, mulberry32(62));
    expect(swapped.runStats.damagePerSlot[1]).toBeGreaterThan(0);
    expect(swapped.runStats.totalDamageDealt).toBeGreaterThan(0);
    expect(swapped.enemies.find((e) => e.id === atCenter.id)?.hp).toBeLessThan(atCenter.hp);
    expect(swapped.floatingTexts.length).toBeGreaterThan(0);
  });

  it('records the highest-damage slot as MVP on game over', () => {
    const base = startingRun(71);
    const atCenter = { ...base.enemies[0], x: ARENA.CENTER, y: ARENA.CENTER };
    const doomed: GameState = {
      ...base,
      bastionHp: 1,
      enemies: [atCenter],
      waveEnemiesRemaining: 1,
      runStats: { ...base.runStats, damagePerSlot: [0, 10, 0, 0, 0, 0] },
    };
    const next = tickGame(doomed, {}, config, 16.7, mulberry32(72));
    expect(next.phase).toBe('GAME_OVER');
    expect(next.runStats.mvpSlotIndex).toBe(1);
  });

  it('ages and expires floating texts', () => {
    const base = startingRun(81);
    const stale = { id: 999, x: 10, y: 10, text: '999', color: '#ffffff', age: 0.99, maxAge: 1 };
    const next = tickGame({ ...base, floatingTexts: [stale] }, {}, config, 16.7, mulberry32(82));
    expect(next.floatingTexts.some((t) => t.id === 999)).toBe(false);
  });
});
