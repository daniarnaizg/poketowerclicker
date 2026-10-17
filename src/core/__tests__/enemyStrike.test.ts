import { describe, expect, it } from 'vitest';
import { tickGame } from '../gameLoop';
import { POKEDEX } from '../../data/pokemon';
import { TYPE_CHART } from '../damage';
import { ARENA } from '../../config/arena.config';
import { BOSS_ANCHOR_TICK_SEC } from '../../config/balance.config';
import type { BastionUpgradeLevels, Cooldowns6, GameConfig, GameState, Team6 } from '../types';

const config: GameConfig = { pokedex: POKEDEX, typeChart: TYPE_CHART, seed: 42 };
const STEP = 16.7;

const ZERO_UPGRADES: BastionUpgradeLevels = {
  UP_MULTI: 0,
  UP_ARROW: 0,
  UP_SPD: 0,
  UP_CRIT: 0,
  UP_CDMG: 0,
  UP_GOLD: 0,
  UP_AUTOCLICK: 0,
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
      faintLog: [],
    },
  };
}

function startingRun(seed: number): GameState {
  return tickGame(emptyState(), { selectStarter: '0004' }, config, 0, mulberry32(seed));
}

/** Estado con un único enemigo normal ya pegado al centro. */
function leakState(extra: Partial<GameState> = {}): GameState {
  const base = startingRun(7);
  const enemy = { ...base.enemies[0], id: 900, x: ARENA.CENTER, y: ARENA.CENTER + 10, alive: true, isBoss: false };
  return {
    ...base,
    enemies: [enemy],
    waveEnemiesRemaining: 1,
    interWaveTimerSec: 1.5, // sin regeneración
    ...extra,
  };
}

function bossState(): GameState {
  const base = startingRun(8);
  const boss = {
    ...base.enemies[0],
    id: 901,
    x: ARENA.CENTER,
    y: ARENA.CENTER + 10,
    hp: 1e6,
    maxHp: 1e6,
    alive: true,
    isBoss: true,
    definitionId: '0127',
    kind: 'miniboss' as const,
  };
  return { ...base, enemies: [boss], waveEnemiesRemaining: 1, interWaveTimerSec: 1.5 };
}

describe('enemy strike records (cosmetic attack animation)', () => {
  it('un enemigo normal que llega al centro muere y deja un registro de golpe', () => {
    const next = tickGame(leakState(), {}, config, STEP, mulberry32(1));
    expect(next.enemies.some((e) => e.id === 900 && e.alive)).toBe(false);
    const strikes = next.strikes ?? [];
    expect(strikes.length).toBe(1);
    expect(strikes[0].enemyId).toBe(900);
    expect(strikes[0].isBoss).toBe(false);
    expect(strikes[0].age).toBe(0);
  });

  it('el registro también se crea cuando el escudo bloquea el golpe', () => {
    const s0 = leakState({ bastionShieldSec: 5 });
    const activeHp0 = s0.team.find((s) => s.isActive)?.pokemon?.hp;
    const next = tickGame(s0, {}, config, STEP, mulberry32(1));
    expect((next.strikes ?? []).length).toBe(1);
    const activeHp1 = next.team.find((s) => s.isActive)?.pokemon?.hp;
    expect(activeHp1).toBe(activeHp0); // el escudo sigue bloqueando el daño
  });

  it('no cambia el daño recibido respecto a no tener strikes', () => {
    const withStrikes = tickGame(leakState({ strikes: [] }), {}, config, STEP, mulberry32(1));
    const without = tickGame(leakState(), {}, config, STEP, mulberry32(1));
    const hpWith = withStrikes.team.find((s) => s.isActive)?.pokemon?.hp;
    const hpWithout = without.team.find((s) => s.isActive)?.pokemon?.hp;
    expect(hpWith).toBe(hpWithout);
  });

  it('el registro envejece y caduca', () => {
    let s = tickGame(leakState(), {}, config, STEP, mulberry32(1));
    expect((s.strikes ?? []).length).toBe(1);
    for (let i = 0; i < 20; i++) s = tickGame(s, {}, config, STEP, mulberry32(i));
    expect((s.strikes ?? []).length).toBe(1);
    expect((s.strikes ?? [])[0].age > 0.2).toBe(true);
    for (let i = 0; i < 40; i++) s = tickGame(s, {}, config, STEP, mulberry32(i));
    expect((s.strikes ?? []).length).toBe(0);
  });

  it('un jefe ataca nada más anclarse y de nuevo tras el intervalo, siguiendo vivo', () => {
    let s = tickGame(bossState(), {}, config, STEP, mulberry32(1));
    expect(s.enemies[0].alive).toBe(true);
    expect(s.enemies[0].anchoredAtBastion).toBe(true);
    expect((s.strikes ?? []).filter((x) => x.isBoss).length).toBe(1);

    // Antes de que acabe el intervalo no hay golpes nuevos.
    const firstId = (s.strikes ?? [])[0].id;
    for (let i = 0; i < 30; i++) s = tickGame(s, {}, config, STEP, mulberry32(i));
    expect((s.strikes ?? []).every((x) => x.id === firstId)).toBe(true);

    // Pasado BOSS_ANCHOR_TICK_SEC llega el siguiente golpe.
    const ticks = Math.ceil((BOSS_ANCHOR_TICK_SEC * 1000) / STEP);
    for (let i = 0; i < ticks; i++) s = tickGame(s, {}, config, STEP, mulberry32(i));
    expect((s.strikes ?? []).some((x) => x.id !== firstId && x.isBoss)).toBe(true);
    expect(s.enemies[0].alive).toBe(true);
  });
});
