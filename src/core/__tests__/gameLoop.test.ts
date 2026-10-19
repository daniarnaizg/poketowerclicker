import { describe, it, expect } from 'vitest';
import { tickGame } from '../gameLoop';
import { generateWave } from '../waveGenerator';
import { calculateUpgradeCost, purchaseUpgrade } from '../bastionUpgrades';
import { POKEDEX } from '../../data/pokemon';
import { TYPE_CHART } from '../damage';
import { ARENA } from '../../config/arena.config';
import {
  ALIVE_CAP,
  BOSS_HP_MULTIPLIER,
  BOSS_PHASE_ANCHOR_FRACTION,
  BOSS_PHASE_ANCHOR_TICK_SEC,
  BOSS_PHASE_INVULN_SEC,
  BOSS_PHASE_THRESHOLDS,
  BOSS_TIMER_DURATION,
  HOT_SWAP_COOLDOWN,
  INTER_WAVE_BREAK_SEC,
  LEAK_BASE_DAMAGE,
  WAVE_ENEMY_COUNT_BASE,
  bossHp,
  enemyHp,
  floorEnemyCount,
  floorSpawnWindowSec,
  leakDamageForFloor,
} from '../../config/balance.config';
import { getEnemyDef } from '../../data/enemies';
import type { BastionUpgrades, Cooldowns6, GameConfig, GameState, Projectile, Team6 } from '../types';
import { PokemonType } from '../types';

const config: GameConfig = { pokedex: POKEDEX, typeChart: TYPE_CHART, seed: 42 };

const ZERO_UPGRADES: BastionUpgrades = {
  UP_ARROW: 0,
  UP_SPD: 0,
  UP_MULTI: 0,
  UP_AUTOCLICK: 0,
  UP_CRIT: 0,
  UP_CDMG: 0,
  UP_GOLD: 0,
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
      expect(Math.hypot(enemy.x - ARENA.CENTER, enemy.y - ARENA.CENTER)).toBeCloseTo(ARENA.SPAWN_HALF_EXTENT, 5);
      const def = getEnemyDef(enemy.definitionId);
      expect(enemy.hp).toBe(Math.max(1, Math.floor(enemyHp(5) * (def.hpFactor ?? 1))));
    }
    expect(new Set(wave.map((e) => e.id)).size).toBe(WAVE_ENEMY_COUNT_BASE);
  });

  it('spawns a single boss with 10x HP and a 30s timer on mini-boss floors', () => {
    const wave = generateWave(10, mulberry32(2));
    expect(wave).toHaveLength(1);
    expect(wave[0].isBoss).toBe(true);
    expect(wave[0].hp).toBe(bossHp(10, getEnemyDef(wave[0].definitionId).hpFactor ?? 1));
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
    expect(state.enemies).toHaveLength(1);
    expect(state.waveEnemiesRemaining).toBe(floorEnemyCount(1));
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
    expect(next.waveEnemiesRemaining).toBe(
      (next.floorRuntime!.plan.events.length - next.floorRuntime!.nextEventIdx) +
        next.enemies.filter((e) => e.alive).length,
    );
    expect(next.waveEnemiesRemaining).toBe(floorEnemyCount(2));
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
    const activeBefore = base.team.find((s) => s.isActive)!.pokemon!;
    const inBreak: GameState = {
      ...base,
      enemies: [],
      waveEnemiesRemaining: 0,
      interWaveTimerSec: 1.5,
    };
    const next = tickGame(inBreak, {}, config, 16.7, mulberry32(22));
    expect(next.ultimateCharge).toBeGreaterThan(0);
    const activeAfter = next.team.find((s) => s.isActive)!.pokemon!;
    expect(activeAfter.hp).toBe(activeBefore.hp);
  });

  it('scales enemy leak damage with the floor so high floors punish harder than floor 1', () => {
    const leakDamage = (floor: number): number => {
      const base = startingRun(43);
      const activeSlot = base.team.findIndex((s) => s.isActive);
      const withLargeHp = base.team.map((s, idx) =>
        idx === activeSlot && s.pokemon ? { ...s, pokemon: { ...s.pokemon, hp: 10_000, maxHp: 10_000 } } : s,
      ) as Team6;
      const atCenter = { ...base.enemies[0], x: ARENA.CENTER, y: ARENA.CENTER, types: [PokemonType.Normal] as [PokemonType] };
      const doomed: GameState = {
        ...base,
        team: withLargeHp,
        floor,
        enemies: [atCenter],
        waveEnemiesRemaining: 1,
        interWaveTimerSec: 1.5,
      };
      const activeBefore = doomed.team[activeSlot].pokemon!.hp;
      const after = tickGame(doomed, {}, config, 16.7, mulberry32(44));
      const activeAfter = after.team[activeSlot].pokemon!.hp;
      return activeBefore - activeAfter;
    };
    expect(leakDamage(1)).toBe(leakDamageForFloor(1));
    expect(leakDamage(41)).toBe(leakDamageForFloor(41));
    expect(leakDamage(41) * floorEnemyCount(41)).toBeGreaterThan(leakDamage(1) * floorEnemyCount(1));
  });

  it('boss anchors at bastion perimeter instead of disappearing on contact (Decision D1)', () => {
    const base = startingRun(100);
    const bossEnemy = {
      ...base.enemies[0],
      id: 1,
      x: ARENA.CENTER,
      y: ARENA.CENTER + 10,
      hp: 1000,
      maxHp: 1000,
      alive: true,
      isBoss: true,
      definitionId: '0127',
      kind: 'miniboss' as const,
    };
    const state: GameState = {
      ...base,
      enemies: [bossEnemy],
      waveEnemiesRemaining: 1,
      interWaveTimerSec: 1.5,
    };
    const next = tickGame(state, {}, config, 1000 / 60, mulberry32(1));
    expect(next.enemies).toHaveLength(1);
    expect(next.enemies[0].alive).toBe(true);
    expect(next.enemies[0].anchoredAtBastion).toBe(true);
    expect(next.waveEnemiesRemaining).toBe(1);
    const activeBefore = state.team.find((s) => s.isActive)!.pokemon!;
    const activeAfter = next.team.find((s) => s.isActive)!.pokemon!;
    expect(activeAfter.hp).toBeLessThan(activeBefore.hp); // took boss anchor strike damage
  });

  it('at UP_SPD = 0, central Pokémon fires autonomous projectiles at base cadence, and increasing UP_SPD increases firing rate', () => {
    const base = startingRun(1);
    expect(base.bastionUpgrades.UP_SPD).toBe(0);
    const tickedZero = tickGame(base, {}, config, 1000, () => 0);
    expect(tickedZero.projectiles.length).toBeGreaterThan(0);

    const withSpd: GameState = {
      ...base,
      bastionUpgrades: { ...base.bastionUpgrades, UP_SPD: 5 },
    };
    let shotsZero = 0;
    let s0 = base;
    let shotsSpd = 0;
    let sSpd = withSpd;
    for (let i = 0; i < 60; i++) {
      s0 = tickGame(s0, {}, config, 16.7, mulberry32(200 + i));
      shotsZero += s0.projectiles.length;
      s0 = { ...s0, projectiles: [] };

      sSpd = tickGame(sSpd, {}, config, 16.7, mulberry32(200 + i));
      shotsSpd += sSpd.projectiles.length;
      sSpd = { ...sSpd, projectiles: [] };
    }
    expect(shotsZero).toBeGreaterThan(0);
    expect(shotsSpd).toBeGreaterThan(shotsZero);
  });

  it('input.click spawns 1 projectile toward target and adds a RING visual effect, and UP_MULTI does not increase click projectile count', () => {
    const base = startingRun(1);
    const target = { x: 50, y: 80 };
    const clicked = tickGame(base, { click: target }, config, 0, mulberry32(1));
    expect(clicked.projectiles).toHaveLength(1);
    const p = clicked.projectiles[0];
    expect(p.x).toBe(ARENA.CENTER);
    expect(p.y).toBe(ARENA.CENTER);
    expect(p.vx).toBeLessThan(0);
    expect(p.vy).toBeLessThan(0);

    // Visual effect: RING at (click.x, click.y)
    const ring = clicked.effects?.find((fx) => fx.kind === 'RING' && fx.x === target.x && fx.y === target.y);
    expect(ring).toBeDefined();
    expect(ring?.radius).toBe(14);
    expect(ring?.maxAge).toBe(0.22);

    // UP_MULTI does NOT increase click projectile count
    const withMulti: GameState = {
      ...base,
      bastionUpgrades: { ...base.bastionUpgrades, UP_MULTI: 3 },
    };
    const clickedMulti = tickGame(withMulti, { click: target }, config, 0, mulberry32(1));
    expect(clickedMulti.projectiles).toHaveLength(1);
  });

  it('UP_MULTI caps at MULTI_MAX_LEVEL (4) with steep cost scaling (150 * 3.2^level)', () => {
    expect(calculateUpgradeCost('UP_MULTI', 0)).toBe(150);
    expect(calculateUpgradeCost('UP_MULTI', 1)).toBe(Math.floor(150 * 3.2));
    expect(calculateUpgradeCost('UP_MULTI', 2)).toBe(Math.floor(150 * Math.pow(3.2, 2)));
    expect(calculateUpgradeCost('UP_MULTI', 3)).toBe(Math.floor(150 * Math.pow(3.2, 3)));
    expect(calculateUpgradeCost('UP_MULTI', 4)).toBe(Infinity);

    const base = startingRun(81);
    const maxed: GameState = {
      ...base,
      gold: 100_000,
      bastionUpgrades: { ...base.bastionUpgrades, UP_MULTI: 4 },
    };
    expect(purchaseUpgrade(maxed, 'UP_MULTI')).toBe(maxed);
  });

  it('UP_AUTOCLICK base cost is 100 (100 * 2.8^level) and caps at level 5', () => {
    const base = startingRun(81);
    const cost0 = calculateUpgradeCost('UP_AUTOCLICK', 0);
    expect(cost0).toBe(100);
    expect(calculateUpgradeCost('UP_AUTOCLICK', 1)).toBe(Math.floor(100 * 2.8));
    expect(calculateUpgradeCost('UP_AUTOCLICK', 2)).toBe(Math.floor(100 * Math.pow(2.8, 2)));

    const withGold: GameState = { ...base, gold: 1000, bastionUpgrades: { ...base.bastionUpgrades, UP_AUTOCLICK: 0 } };
    const bought = purchaseUpgrade(withGold, 'UP_AUTOCLICK');
    expect(bought.bastionUpgrades.UP_AUTOCLICK).toBe(1);
    expect(bought.gold).toBe(1000 - cost0);

    // Max level 5 cannot be exceeded
    const maxed: GameState = { ...base, gold: 1000, bastionUpgrades: { ...base.bastionUpgrades, UP_AUTOCLICK: 5 } };
    expect(calculateUpgradeCost('UP_AUTOCLICK', 5)).toBe(Infinity);
    expect(purchaseUpgrade(maxed, 'UP_AUTOCLICK')).toBe(maxed);
  });

  it('tracks manualClicks and autoClicks in runStats', () => {
    const base = startingRun(91);
    const enemy = base.enemies[0];
    const withManual = tickGame(base, { click: { x: enemy.x, y: enemy.y, isAuto: false } }, config, 0, mulberry32(1));
    expect(withManual.runStats.manualClicks).toBe(1);
    expect(withManual.runStats.autoClicks).toBe(0);

    const withAuto = tickGame(withManual, { click: { x: enemy.x, y: enemy.y, isAuto: true } }, config, 0, mulberry32(2));
    expect(withAuto.runStats.manualClicks).toBe(1);
    expect(withAuto.runStats.autoClicks).toBe(1);
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
    const next = tickGame(bossState, {}, { ...config, bossTimerMode: 'gameover' }, 16.7, mulberry32(33));
    expect(next.phase).toBe('GAME_OVER');
    expect(next.runStats.defeatCause).toBe('bossTimerExpired');
  });

  it('ends the run when an enemy reaches the bastion and HP is depleted', () => {
    const base = startingRun(41);
    const atCenter = { ...base.enemies[0], x: ARENA.CENTER, y: ARENA.CENTER };
    const doomed: GameState = {
      ...base,
      team: base.team.map((s) => s.isActive && s.pokemon ? { ...s, pokemon: { ...s.pokemon, hp: 1 } } : s) as Team6,
      enemies: [atCenter],
      waveEnemiesRemaining: 1,
    };
    const next = tickGame(doomed, {}, config, 16.7, mulberry32(42));
    expect(next.phase).toBe('GAME_OVER');
    const active = next.team.find((s) => s.index === 0)!.pokemon!;
    expect(active.hp).toBe(0);
    expect(active.alive).toBe(false);
    expect(next.runStats.defeatCause).toBe('teamWiped');
    expect(next.runStats.defeatEnemyType).toBeDefined();
  });

  it('does not regenerate HP passively during combat or breather (Rule D10)', () => {
    const base = startingRun(51);
    const activeSlot = base.team.findIndex((s) => s.isActive);
    const woundedTeam = base.team.map((s, idx) =>
      idx === activeSlot && s.pokemon ? { ...s, pokemon: { ...s.pokemon, hp: 50, maxHp: 100 } } : s,
    ) as Team6;
    const hurt: GameState = { ...base, team: woundedTeam };
    const next = tickGame(hurt, {}, config, 16.7, mulberry32(52));
    const activeNext = next.team[activeSlot].pokemon!;
    expect(activeNext.hp).toBe(50);
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
      team: base.team.map((s) => s.isActive && s.pokemon ? { ...s, pokemon: { ...s.pokemon, hp: 1 } } : s) as Team6,
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

describe('Block 3A.2-V — Individual Vitality & Route Stop Config', () => {
  describe('Rule D9 — Fainted Pokémon cannot be swapped in via hotSwap', () => {
    it('does not change the active Pokémon if target slot has alive === false', () => {
      const base = startingRun(1);
      const pkm1 = { ...base.team[0].pokemon!, id: 2, alive: false, hp: 0 };
      const withFainted: GameState = {
        ...base,
        team: base.team.map((s, idx) => (idx === 1 ? { ...s, pokemon: pkm1 } : s)) as Team6,
      };
      const after = tickGame(withFainted, { hotSwapIndex: 1 }, config, 0, mulberry32(1));
      expect(after.team[0].isActive).toBe(true);
      expect(after.team[1].isActive).toBe(false);
    });
  });

  describe('Rules D7 & D8 — Active damage with type effectiveness', () => {
    it('leak reduces hp of active only, applying type effectiveness, and does not damage bench', () => {
      // Starter 0001 (Bulbasaur, Grass/Poison)
      const base = tickGame(emptyState(), { startRun: [{ definitionId: '0001', stars: 1 }, { definitionId: '0007', stars: 1 }, null, null, null, null] }, config, 0, mulberry32(1));
      const active0 = base.team[0].pokemon!;
      const bench0 = base.team[1].pokemon!;
      expect(active0.hp).toBe(active0.maxHp);
      expect(bench0.hp).toBe(bench0.maxHp);

      // Fire enemy at center: Fire vs Grass/Poison => 1.5 * 1.0 = 1.5 effectiveness
      const fireEnemy = {
        ...base.enemies[0],
        x: ARENA.CENTER,
        y: ARENA.CENTER,
        types: [PokemonType.Fire] as [PokemonType],
      };
      const state: GameState = {
        ...base,
        floor: 1,
        enemies: [fireEnemy],
        waveEnemiesRemaining: 1,
        interWaveTimerSec: 1.5,
      };

      const next = tickGame(state, {}, config, 16.7, mulberry32(2));
      const active1 = next.team[0].pokemon!;
      const bench1 = next.team[1].pokemon!;

      const expectedDmg = Math.round(leakDamageForFloor(1) * 1.5);
      expect(active0.hp - active1.hp).toBe(expectedDmg);
      expect(bench1.hp).toBe(bench0.hp); // bench completely unharmed
    });

    it('active takes no damage when bastionShieldSec > 0 and displays BLOQUEO', () => {
      const base = startingRun(1);
      const active0 = base.team[0].pokemon!;
      const atCenter = { ...base.enemies[0], x: ARENA.CENTER, y: ARENA.CENTER };
      const shielded: GameState = {
        ...base,
        enemies: [atCenter],
        waveEnemiesRemaining: 1,
        bastionShieldSec: 2.0,
      };
      const next = tickGame(shielded, {}, config, 16.7, mulberry32(1));
      const active1 = next.team[0].pokemon!;
      expect(active1.hp).toBe(active0.hp);
      expect(next.floatingTexts.some((t) => t.text === 'BLOQUEO')).toBe(true);
    });

    it('boss anchor strike damages only the active Pokémon according to its maxHp fraction', () => {
      const base = tickGame(emptyState(), { startRun: [{ definitionId: '0004', stars: 1 }, { definitionId: '0007', stars: 1 }, null, null, null, null] }, config, 0, mulberry32(1));
      const active0 = base.team[0].pokemon!;
      const bench0 = base.team[1].pokemon!;
      const bossEnemy = {
        ...base.enemies[0],
        id: 99,
        x: ARENA.CENTER,
        y: ARENA.CENTER + 10,
        hp: 1000,
        maxHp: 1000,
        alive: true,
        isBoss: true,
        definitionId: '0127',
        types: [PokemonType.Normal] as [PokemonType],
      };
      const state: GameState = {
        ...base,
        enemies: [bossEnemy],
        waveEnemiesRemaining: 1,
        interWaveTimerSec: 1.5,
      };
      const next = tickGame(state, {}, config, 16.7, mulberry32(1));
      const active1 = next.team[0].pokemon!;
      const bench1 = next.team[1].pokemon!;
      expect(active1.hp).toBeLessThan(active0.hp);
      expect(bench1.hp).toBe(bench0.hp);
    });
  });

  describe('Rules D16 & D17 — Lethal damage, Overkill discard, Forced Switch-In, and teamWiped', () => {
    it('discards overkill, logs faint in faintLog, forces switch-in without adding cooldown, and triggers switch-in burst', () => {
      // Active has 5 HP, bench has 100 HP
      const base = tickGame(emptyState(), { startRun: [{ definitionId: '0004', stars: 1 }, { definitionId: '0007', stars: 1 }, null, null, null, null] }, config, 0, mulberry32(1));
      const slot0 = base.team[0];
      const slot1 = base.team[1];
      const withLowHp: GameState = {
        ...base,
        floor: 3,
        team: [
          { ...slot0, pokemon: { ...slot0.pokemon!, hp: 5 } },
          { ...slot1, pokemon: { ...slot1.pokemon! } },
          base.team[2],
          base.team[3],
          base.team[4],
          base.team[5],
        ] as Team6,
        enemies: [{
          ...base.enemies[0],
          x: ARENA.CENTER,
          y: ARENA.CENTER,
          types: [PokemonType.Water] as [PokemonType],
        }],
        waveEnemiesRemaining: 1,
      };

      // Leak deals leakDamageForFloor(3) * eff (Water vs Fire = 1.5) > 20 damage (far exceeding 5 HP)
      const next = tickGame(withLowHp, {}, config, 16.7, mulberry32(1));

      // Slot 0 fainted
      const prevActive = next.team[0].pokemon!;
      expect(prevActive.hp).toBe(0);
      expect(prevActive.alive).toBe(false);
      expect(next.team[0].isActive).toBe(false);

      // faintLog entry recorded
      expect(next.runStats.faintLog).toBeDefined();
      expect(next.runStats.faintLog?.length).toBe(1);
      expect(next.runStats.faintLog?.[0]).toEqual({
        slot: 0,
        definitionId: '0004',
        floor: 3,
        cause: 'leak',
        killerType: PokemonType.Water,
      });

      // Forced switch-in to living candidate (slot 1)
      expect(next.team[1].isActive).toBe(true);
      const newActive = next.team[1].pokemon!;
      expect(newActive.alive).toBe(true);

      // Overkill discarded: new active retains full maxHp intact!
      expect(newActive.hp).toBe(newActive.maxHp);
      expect(newActive.hp).toBe(slot1.pokemon!.maxHp);

      // NO cooldown added to hotSwapCooldowns for forced switch-in
      expect(next.hotSwapCooldowns[1]).toBe(0);
    });

    it('when the last living Pokémon falls, triggers immediate GAME_OVER with defeatCause teamWiped', () => {
      const base = startingRun(1);
      const slot0 = base.team[0];
      const doomed: GameState = {
        ...base,
        floor: 5,
        team: [
          { ...slot0, pokemon: { ...slot0.pokemon!, hp: 2 } },
          base.team[1],
          base.team[2],
          base.team[3],
          base.team[4],
          base.team[5],
        ] as Team6,
        enemies: [{
          ...base.enemies[0],
          x: ARENA.CENTER,
          y: ARENA.CENTER,
          types: [PokemonType.Rock] as [PokemonType],
        }],
        waveEnemiesRemaining: 1,
      };
      const next = tickGame(doomed, {}, config, 16.7, mulberry32(1));
      expect(next.phase).toBe('GAME_OVER');
      expect(next.runStats.defeatCause).toBe('teamWiped');
      expect(next.runStats.defeatEnemyType).toBe(PokemonType.Rock);
    });
  });

  describe('Rule D10 — Zero healing outside Route Stops', () => {
    it('advancing multiple ticks in combat and breather with wounded Pokémon never increases sum of team HP', () => {
      const base = startingRun(1);
      const activeSlot = base.team.findIndex((s) => s.isActive);
      const woundedTeam = base.team.map((s, idx) =>
        idx === activeSlot && s.pokemon ? { ...s, pokemon: { ...s.pokemon, hp: 40, maxHp: 100 } } : s,
      ) as Team6;

      // In combat (no enemies at center, just moving)
      let s: GameState = {
        ...base,
        team: woundedTeam,
        enemies: [{
          ...base.enemies[0],
          x: 10,
          y: 10,
          hp: 1e6,
          maxHp: 1e6,
        }],
      };
      const initialHpSum = s.team.reduce((sum, sl) => sum + (sl.pokemon?.hp ?? 0), 0);

      for (let i = 0; i < 60; i++) {
        s = tickGame(s, {}, config, 16.7, mulberry32(i));
      }
      const combatHpSum = s.team.reduce((sum, sl) => sum + (sl.pokemon?.hp ?? 0), 0);
      expect(combatHpSum).toBeLessThanOrEqual(initialHpSum);

      // In breather between waves
      s = {
        ...s,
        enemies: [],
        waveEnemiesRemaining: 0,
        interWaveTimerSec: 2.0,
      };
      for (let i = 0; i < 60; i++) {
        s = tickGame(s, {}, config, 16.7, mulberry32(i + 100));
      }
      const breatherHpSum = s.team.reduce((sum, sl) => sum + (sl.pokemon?.hp ?? 0), 0);
      expect(breatherHpSum).toBeLessThanOrEqual(initialHpSum);
    });
  });
});

describe('WP3 — Continuous Spawner Queue & ALIVE_CAP', () => {
  it('caps alive enemies at ALIVE_CAP, keeps pending events in queue, and emits from queue upon kills', () => {
    // Floor 85 has floorEnemyCount(85) = 93 > ALIVE_CAP (70)
    expect(floorEnemyCount(85)).toBe(93);
    expect(floorEnemyCount(85)).toBeGreaterThan(ALIVE_CAP);

    const base = startingRun(42);
    // Transition to floor 85 by setting floor 84 with breather expiring
    const cleared: GameState = {
      ...base,
      floor: 84,
      enemies: [],
      waveEnemiesRemaining: 0,
      interWaveTimerSec: 0.01,
    };
    let state = tickGame(cleared, {}, config, 16.7, mulberry32(1));
    expect(state.floor).toBe(85);
    expect(state.floorRuntime?.plan.events.length).toBe(93);

    // Passive player: set atk: 0 on active Pokémon so projectiles do not kill enemies
    state = {
      ...state,
      team: state.team.map((s) =>
        s.isActive && s.pokemon ? { ...s, pokemon: { ...s.pokemon, atk: 0 } } : s,
      ) as Team6,
      enemies: state.enemies.map((e) => ({ ...e, speed: 0 })),
    };

    const spawnWindowSec = floorSpawnWindowSec(85);
    const rng = mulberry32(100);

    // Advance across the entire spawn window
    while (state.floorRuntime!.elapsedSec < spawnWindowSec) {
      state = tickGame(state, {}, config, 16.7, rng);
      expect(state.enemies.filter((e) => e.alive).length).toBeLessThanOrEqual(ALIVE_CAP);
      // Freeze newly spawned enemies so they don't reach bastion center and leak
      state = {
        ...state,
        enemies: state.enemies.map((e) => (e.speed > 0 ? { ...e, speed: 0 } : e)),
      };
    }

    // At the end of the spawn window: alive enemies must be capped at ALIVE_CAP (70)
    const aliveCount = state.enemies.filter((e) => e.alive).length;
    expect(aliveCount).toBe(ALIVE_CAP);

    // Spawner queue retains 93 - 70 = 23 pending events
    const pendingEvents = state.floorRuntime!.plan.events.length - state.floorRuntime!.nextEventIdx;
    expect(pendingEvents).toBe(23);
    expect(state.floorRuntime!.nextEventIdx).toBe(70);
    expect(state.waveEnemiesRemaining).toBe(93);

    // Eliminate 10 alive enemies
    let killed = 0;
    const enemiesWith10Killed = state.enemies.map((e) => {
      if (e.alive && killed < 10) {
        killed++;
        return { ...e, alive: false, hp: 0 };
      }
      return e;
    });
    state = {
      ...state,
      enemies: enemiesWith10Killed,
      waveEnemiesRemaining:
        (state.floorRuntime!.plan.events.length - state.floorRuntime!.nextEventIdx) +
        enemiesWith10Killed.filter((e) => e.alive).length,
    };
    expect(state.enemies.filter((e) => e.alive).length).toBe(60);
    expect(state.waveEnemiesRemaining).toBe(83);

    // Next tick: exactly 10 events are emitted from queue to refill to ALIVE_CAP without losing any
    state = tickGame(state, {}, config, 16.7, rng);

    expect(state.enemies.filter((e) => e.alive).length).toBe(ALIVE_CAP);
    expect(state.floorRuntime!.nextEventIdx).toBe(80);
    expect(state.floorRuntime!.plan.events.length - state.floorRuntime!.nextEventIdx).toBe(13);
    expect(state.waveEnemiesRemaining).toBe(83);
  });

  it('strictly satisfies state.waveEnemiesRemaining === pending queue events + alive enemies on every tick', () => {
    let state = startingRun(1);
    const rng = mulberry32(77);
    for (let i = 0; i < 200; i++) {
      state = tickGame(state, {}, config, 16.7, rng);
      if (state.floorRuntime && state.phase === 'PLAYING') {
        const pending = state.floorRuntime.plan.events.length - state.floorRuntime.nextEventIdx;
        const alive = state.enemies.filter((e) => e.alive).length;
        expect(state.waveEnemiesRemaining).toBe(pending + alive);
      }
    }
  });

  it('pauses floorRuntime elapsedSec and prevents enemy spawns while state.shop is defined', () => {
    const base = startingRun(1);
    const withShop: GameState = {
      ...base,
      shop: { beforeFloor: 5 },
    };
    const elapsedBefore = withShop.floorRuntime!.elapsedSec;
    const enemiesBefore = withShop.enemies.length;
    const nextEventBefore = withShop.floorRuntime!.nextEventIdx;

    let state = withShop;
    for (let i = 0; i < 60; i++) {
      state = tickGame(state, {}, config, 16.7, mulberry32(i));
    }

    expect(state.floorRuntime!.elapsedSec).toBe(elapsedBefore);
    expect(state.enemies.length).toBe(enemiesBefore);
    expect(state.floorRuntime!.nextEventIdx).toBe(nextEventBefore);
  });
});

describe('WP5.core — Boss Phases, Clipping, Invulnerability, Adds and Enrage Mode', () => {
  it('clips boss HP at 66% on phase 1 and at 33% on phase 2, discarding excess damage and granting invulnerability', () => {
    const base = startingRun(1);
    const maxHp = 1000;
    const threshold66 = Math.ceil(maxHp * BOSS_PHASE_THRESHOLDS[0]); // 660
    const threshold33 = Math.ceil(maxHp * BOSS_PHASE_THRESHOLDS[1]); // 330
    const teamNoShoot = base.team.map((s) =>
      s.isActive && s.pokemon ? { ...s, pokemon: { ...s.pokemon, spd: 0 } } : s,
    ) as Team6;
    const bossEnemy = {
      ...base.enemies[0],
      id: 99,
      x: ARENA.CENTER + 50,
      y: ARENA.CENTER,
      speed: 0,
      hp: maxHp,
      maxHp,
      alive: true,
      isBoss: true,
      bossPhase: 1 as const,
      bossInvulnSec: 0,
      definitionId: '0127',
      types: [PokemonType.Normal] as [PokemonType],
    };
    const state: GameState = {
      ...base,
      team: teamNoShoot,
      floor: 10,
      enemies: [bossEnemy],
      waveEnemiesRemaining: 1,
      interWaveTimerSec: undefined,
    };

    // Huge damage projectile hits the boss in phase 1
    const projectile1: Projectile = {
      id: 500,
      x: ARENA.CENTER + 50,
      y: ARENA.CENTER,
      vx: 0,
      vy: 0,
      damage: 10_000,
      types: [PokemonType.Fighting],
      fromPlayer: true,
    };
    const next1 = tickGame({ ...state, projectiles: [projectile1] }, {}, config, 16.7, mulberry32(1));
    const bossAfter1 = next1.enemies.find((e) => e.id === 99)!;
    expect(bossAfter1.hp).toBe(threshold66); // Clipped at 660!
    expect(bossAfter1.bossPhase).toBe(2);
    expect(bossAfter1.bossInvulnSec).toBe(BOSS_PHASE_INVULN_SEC);
    expect(next1.phaseBannerText).toBe('¡FASE 2!');
    expect(next1.floatingTexts.some((t) => t.text === '¡FASE 2!')).toBe(true);

    // During invulnerability (bossInvulnSec > 0), another projectile hits: deals 0 damage
    const projectile2: Projectile = {
      id: 501,
      x: ARENA.CENTER + 50,
      y: ARENA.CENTER,
      vx: 0,
      vy: 0,
      damage: 1000,
      types: [PokemonType.Fighting],
      fromPlayer: true,
    };
    const nextInvuln = tickGame({ ...next1, projectiles: [projectile2] }, {}, config, 16.7, mulberry32(2));
    const bossInvuln = nextInvuln.enemies.find((e) => e.id === 99)!;
    expect(bossInvuln.hp).toBe(threshold66); // Unchanged!
    expect(bossInvuln.bossInvulnSec).toBeCloseTo(BOSS_PHASE_INVULN_SEC - 1 / 60, 4);

    // Let invulnerability expire (90 ticks = 1.5s)
    let expiredState = nextInvuln;
    for (let i = 0; i < 90; i++) {
      expiredState = tickGame(expiredState, {}, config, 16.7, mulberry32(10 + i));
    }
    const bossReady = expiredState.enemies.find((e) => e.id === 99)!;
    expect(bossReady).toBeDefined();
    expect(bossReady.bossInvulnSec).toBe(0);
    expect(bossReady.bossPhase).toBe(2);

    // In Phase 2, another massive hit crosses 33% threshold
    const projectile3: Projectile = {
      id: 502,
      x: bossReady.x,
      y: bossReady.y,
      vx: 0,
      vy: 0,
      damage: 10_000,
      types: [PokemonType.Fighting],
      fromPlayer: true,
    };
    const next2 = tickGame({ ...expiredState, projectiles: [projectile3] }, {}, config, 16.7, mulberry32(100));
    const bossAfter2 = next2.enemies.find((e) => e.id === 99)!;
    expect(bossAfter2.hp).toBe(threshold33); // Clipped at 330!
    expect(bossAfter2.bossPhase).toBe(3);
    expect(bossAfter2.bossInvulnSec).toBe(BOSS_PHASE_INVULN_SEC);
    expect(next2.phaseBannerText).toBe('¡FASE 3!');

    // Expire invulnerability again
    let expiredState2 = next2;
    for (let i = 0; i < 90; i++) {
      expiredState2 = tickGame(expiredState2, {}, config, 16.7, mulberry32(200 + i));
    }
    const bossReady2 = expiredState2.enemies.find((e) => e.id === 99)!;
    expect(bossReady2).toBeDefined();
    expect(bossReady2.bossPhase).toBe(3);
    expect(bossReady2.bossInvulnSec).toBe(0);

    // In Phase 3, lethal hit kills the boss
    const projectile4: Projectile = {
      id: 503,
      x: bossReady2.x,
      y: bossReady2.y,
      vx: 0,
      vy: 0,
      damage: 10_000,
      types: [PokemonType.Fighting],
      fromPlayer: true,
    };
    const next3 = tickGame({ ...expiredState2, projectiles: [projectile4] }, {}, config, 16.7, mulberry32(300));
    const bossDead = next3.enemies.find((e) => e.id === 99);
    expect(bossDead).toBeUndefined();
    expect(next3.runStats.totalKills).toBeGreaterThan(expiredState2.runStats.totalKills);
    expect(next3.runStats.defeatedBossFloors).toContain(10);
  });

  it('enqueues phase adds on phase 2 and 3, and cleans them up without gold/kills on boss death', () => {
    const base = startingRun(1);
    const maxHp = 1000;
    const teamNoShoot = base.team.map((s) =>
      s.isActive && s.pokemon ? { ...s, pokemon: { ...s.pokemon, spd: 0 } } : s,
    ) as Team6;
    const bossEnemy = {
      ...base.enemies[0],
      id: 99,
      x: ARENA.CENTER + 50,
      y: ARENA.CENTER,
      speed: 0,
      hp: maxHp,
      maxHp,
      alive: true,
      isBoss: true,
      bossPhase: 1 as const,
      bossInvulnSec: 0,
      definitionId: '0127',
      types: [PokemonType.Normal] as [PokemonType],
    };
    const state: GameState = {
      ...base,
      team: teamNoShoot,
      floor: 10,
      enemies: [bossEnemy],
      waveEnemiesRemaining: 1,
      interWaveTimerSec: undefined,
    };

    // Phase 1 -> 2: triggers enqueueBossPhaseAdds
    const p1: Projectile = {
      id: 500,
      x: bossEnemy.x,
      y: bossEnemy.y,
      vx: 0,
      vy: 0,
      damage: 10_000,
      types: [PokemonType.Fighting],
      fromPlayer: true,
    };
    const sPhase2 = tickGame({ ...state, projectiles: [p1] }, {}, config, 16.7, mulberry32(1));
    const pendingAddsPhase2 = sPhase2.floorRuntime!.plan.events.filter((ev) => ev.tier === 'add');
    expect(pendingAddsPhase2.length).toBe(6); // BOSS_PHASE_ADDS[1] = 6

    // Spawn an add manually into enemies to test alive add cleanup
    const aliveAdd = {
      ...bossEnemy,
      id: 1001,
      x: ARENA.CENTER + 80,
      y: ARENA.CENTER,
      hp: 100,
      maxHp: 100,
      isBoss: false,
      tier: 'add' as const,
    };
    const sWithAdd: GameState = {
      ...sPhase2,
      enemies: [...sPhase2.enemies, aliveAdd],
      waveEnemiesRemaining: sPhase2.waveEnemiesRemaining + 1,
    };

    // Directly kill boss in phase 3
    const sPhase3Boss = sWithAdd.enemies.find((e) => e.id === 99)!;
    sPhase3Boss.bossPhase = 3;
    sPhase3Boss.bossInvulnSec = 0;
    sPhase3Boss.hp = 10;

    const killProj: Projectile = {
      id: 502,
      x: sPhase3Boss.x,
      y: sPhase3Boss.y,
      vx: 0,
      vy: 0,
      damage: 10_000,
      types: [PokemonType.Fighting],
      fromPlayer: true,
    };
    const goldBefore = sWithAdd.gold;
    const killsBefore = sWithAdd.runStats.totalKills;
    const sDead = tickGame({ ...sWithAdd, projectiles: [killProj] }, {}, config, 16.7, mulberry32(2));

    // Alive add was cleaned up (alive = false, hp = 0, filtered out)
    expect(sDead.enemies.some((e) => e.id === 1001)).toBe(false);
    // Future add events in queue were removed
    const pendingAddsAfterDeath = sDead.floorRuntime!.plan.events.filter((ev) => ev.tier === 'add');
    expect(pendingAddsAfterDeath.length).toBe(0);
    // Add did not award kill or gold (only boss did)
    expect(sDead.runStats.totalKills).toBe(killsBefore + 1);
    expect(sDead.gold).toBe(goldBefore + Math.floor(bossEnemy.goldValue));
  });

  it('scales boss anchor strike damage and interval by phase, and multiplies by enrage multiplier', () => {
    const testAnchor = (phase: 1 | 2 | 3, enraged = false, enrageElapsed = 0) => {
      const base = tickGame(emptyState(), { startRun: [{ definitionId: '0004', stars: 1 }, null, null, null, null, null] }, config, 0, mulberry32(1));
      const active0 = base.team[0].pokemon!;
      const boss = {
        ...base.enemies[0],
        id: 99,
        x: ARENA.CENTER,
        y: ARENA.CENTER + 10,
        hp: 1000,
        maxHp: 1000,
        alive: true,
        isBoss: true,
        bossPhase: phase,
        bossInvulnSec: 0,
        anchoredAtBastion: true,
        bossAttackCooldownSec: 0,
        enraged,
        enrageElapsedSec: enrageElapsed,
        definitionId: '0127',
        types: [PokemonType.Normal] as [PokemonType],
      };
      const s = tickGame({ ...base, enemies: [boss], waveEnemiesRemaining: 1, interWaveTimerSec: 1.5 }, {}, config, 16.7, mulberry32(1));
      const active1 = s.team[0].pokemon!;
      const dmg = active0.hp - active1.hp;
      const bossCooldown = s.enemies[0].bossAttackCooldownSec;
      return { dmg, bossCooldown, maxHp: active0.maxHp };
    };

    const p1 = testAnchor(1);
    const p2 = testAnchor(2);
    const p3 = testAnchor(3);

    expect(p1.dmg).toBe(Math.round(p1.maxHp * BOSS_PHASE_ANCHOR_FRACTION[0]));
    expect(p2.dmg).toBe(Math.round(p2.maxHp * BOSS_PHASE_ANCHOR_FRACTION[1]));
    expect(p3.dmg).toBe(Math.round(p3.maxHp * BOSS_PHASE_ANCHOR_FRACTION[2]));

    expect(p1.bossCooldown).toBe(BOSS_PHASE_ANCHOR_TICK_SEC[0]);
    expect(p2.bossCooldown).toBe(BOSS_PHASE_ANCHOR_TICK_SEC[1]);
    expect(p3.bossCooldown).toBe(BOSS_PHASE_ANCHOR_TICK_SEC[2]);

    // Enraged test (at 0s enrageElapsedSec: 1.5x damage)
    const enraged0 = testAnchor(1, true, 0.05);
    expect(enraged0.dmg).toBe(Math.round(enraged0.maxHp * (BOSS_PHASE_ANCHOR_FRACTION[0] * 1.5)));

    // Enraged test after 10s (2.25x damage)
    const enraged10 = testAnchor(1, true, 10.5);
    expect(enraged10.dmg).toBe(Math.round(enraged10.maxHp * (BOSS_PHASE_ANCHOR_FRACTION[0] * 2.25)));
  });

  it('in enrage mode, does not end run on timer expire, sets boss.enraged = true and accumulates enrageElapsedSec', () => {
    const base = startingRun(31);
    const bossWave = generateWave(10, mulberry32(32));
    const bossState: GameState = {
      ...base,
      floor: 10,
      enemies: bossWave,
      waveEnemiesRemaining: bossWave.length,
      bossTimerSec: 0.01,
    };
    // Default config has bossTimerMode: 'enrage' (BOSS_TIMER_MODE)
    const next = tickGame(bossState, {}, config, 16.7, mulberry32(33));
    expect(next.phase).toBe('PLAYING');
    const boss = next.enemies.find((e) => e.isBoss)!;
    expect(boss.enraged).toBe(true);
    expect(boss.bossTimerSec).toBe(0);
    expect(next.bossTimerSec).toBe(0);
    expect(boss.enrageElapsedSec).toBeCloseTo(1 / 60, 4);

    // Another tick increases enrageElapsedSec
    const next2 = tickGame(next, {}, config, 16.7, mulberry32(34));
    const boss2 = next2.enemies.find((e) => e.isBoss)!;
    expect(boss2.enraged).toBe(true);
    expect(boss2.enrageElapsedSec).toBeCloseTo(2 / 60, 4);
    expect(next2.phase).toBe('PLAYING');
  });

  it('freezes boss movement and boss timer while bossInvulnSec > 0', () => {
    const base = startingRun(1);
    const boss = {
      ...base.enemies[0],
      id: 99,
      x: ARENA.CENTER + 100,
      y: ARENA.CENTER,
      hp: 1000,
      maxHp: 1000,
      alive: true,
      isBoss: true,
      bossPhase: 2 as const,
      bossInvulnSec: 1.0,
      bossTimerSec: 25,
      definitionId: '0127',
      types: [PokemonType.Normal] as [PokemonType],
    };
    const s: GameState = {
      ...base,
      floor: 10,
      enemies: [boss],
      waveEnemiesRemaining: 1,
      bossTimerSec: 25,
      interWaveTimerSec: 1.5,
    };
    const next = tickGame(s, {}, config, 16.7, mulberry32(1));
    const bossAfter = next.enemies.find((e) => e.id === 99)!;
    // Position did NOT advance
    expect(bossAfter.x).toBe(ARENA.CENTER + 100);
    // Boss timer did NOT decrease
    expect(next.bossTimerSec).toBe(25);
    expect(bossAfter.bossTimerSec).toBe(25);
    // bossInvulnSec decreased by dt
    expect(bossAfter.bossInvulnSec).toBeCloseTo(1.0 - 1 / 60, 4);
  });
});

