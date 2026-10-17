import { describe, it, expect } from 'vitest';
import { createMeta, migrateMeta, setLoadoutSlot } from '../meta';
import type { MetaState } from '../meta';
import { tickGame } from '../gameLoop';
import { POKEDEX } from '../../data/pokemon';
import { TYPE_CHART, calculateDamage } from '../damage';
import { ARENA } from '../../config/arena.config';
import { BURN_DPS_FACTOR } from '../../config/balance.config';
import type { BastionUpgrades, Cooldowns6, Enemy, GameConfig, GameState, LoadoutEntry, Team6 } from '../types';
import { PokemonType } from '../types';

const config: GameConfig = { pokedex: POKEDEX, typeChart: TYPE_CHART, seed: 1 };
const ZERO: BastionUpgrades = { UP_HP: 0, UP_MULTI: 0, UP_ARROW: 0, UP_SPD: 0, UP_CRIT: 0, UP_CDMG: 0, UP_GOLD: 0, UP_WALL: 0 };

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
  const empty = (index: number) => ({ index, pokemon: null, isActive: false, hotSwapCooldownSec: 0 });
  return {
    phase: 'MENU', floor: 1, team: [0, 1, 2, 3, 4, 5].map(empty) as Team6, teamLevel: 1, gold: 0,
    bastionHp: 100, bastionMaxHp: 100, bastionUpgrades: { ...ZERO }, enemies: [], projectiles: [],
    floatingTexts: [], ultimateCharge: 0, ultimateMax: 0, waveEnemiesRemaining: 0,
    hotSwapCooldowns: [0, 0, 0, 0, 0, 0] as Cooldowns6,
    runStats: { totalKills: 0, totalGoldEarned: 0, totalDamageDealt: 0, damagePerSlot: [0, 0, 0, 0, 0, 0], mvpSlotIndex: -1, floorReached: 1, durationSec: 0 },
  };
}

const start = (loadout: (LoadoutEntry | null)[]): GameState =>
  tickGame(menuState(), { startRun: loadout }, config, 0, mulberry32(1));

/** Replace the wave with hand-placed enemies. */
function withEnemies(s: GameState, list: Partial<Enemy>[]): GameState {
  const enemies = list.map((e, i) => ({
    id: 500 + i, x: ARENA.CENTER, y: ARENA.CENTER, hp: 1e9, maxHp: 1e9, alive: true,
    types: [PokemonType.Normal] as [PokemonType], speed: 20, goldValue: 7, isBoss: false, definitionId: 'WILD', ...e,
  })) as Enemy[];
  return { ...s, enemies, waveEnemiesRemaining: enemies.length };
}

/** Owning meta with the given base-form species at 1★. */
const owning = (ids: string[]): MetaState => {
  const m = createMeta();
  const collection = { ...m.collection };
  for (const id of ids) collection[id] = { stars: 1, fragments: 0, shinyOwned: false, shinyActive: false };
  return { ...m, starterChosen: true, collection };
};

describe('migrateMeta', () => {
  const v1Save = {
    version: 1,
    starterChosen: true,
    seals: 7,
    collection: { '0004': { stars: 3, fragments: 2 } },
    loadout: ['0004', null, null, null, null, null],
    pity: { sinceEpic: 4, sinceLegendary: 9 },
    totalPulls: 13,
    clearedBossFloors: [10, 20],
    bestFloor: 23,
    totalRuns: 5,
  };

  it('upgrades a v1 save losslessly and stamps the v2 schema', () => {
    const m = migrateMeta(v1Save);
    expect(m.schemaVersion).toBe(2);
    expect(m.seals).toBe(7);
    expect(m.bestFloor).toBe(23);
    expect(m.clearedBossFloors).toEqual([10, 20]);
    expect(m.pity).toEqual({ sinceEpic: 4, sinceLegendary: 9 });
    expect(m.totalPulls).toBe(13);
    expect(m.totalRuns).toBe(5);
    expect(m.loadout[0]).toBe('0004');
    expect(m.collection['0004']).toEqual({ stars: 3, fragments: 2, shinyOwned: false, shinyActive: false });
  });

  it('is idempotent on an already-migrated save', () => {
    const once = migrateMeta(v1Save);
    expect(migrateMeta(once)).toEqual(once);
    expect(migrateMeta(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });

  it('falls back to a fresh meta on garbage', () => {
    expect(migrateMeta(null)).toEqual(createMeta());
    expect(migrateMeta('x')).toEqual(createMeta());
    expect(migrateMeta({})).toEqual(createMeta());
    expect(migrateMeta({ version: 99 })).toEqual(createMeta());
    expect(migrateMeta({ schemaVersion: 1 })).toEqual(createMeta());
  });
});

describe('evolutionary-line uniqueness (§2.6)', () => {
  it('refuses two Pokémon from the same line, in either direction', () => {
    const m = setLoadoutSlot(owning(['0004', '0005']), 0, '0004');
    const rejected = setLoadoutSlot(m, 1, '0005');
    expect(rejected.loadout[1]).toBeNull();
    expect(rejected).toBe(m);
    const m2 = setLoadoutSlot(owning(['0004', '0005']), 0, '0005');
    expect(setLoadoutSlot(m2, 1, '0004')).toBe(m2);
  });

  it('allows different lines and same-slot replacement', () => {
    const m = setLoadoutSlot(owning(['0004', '0007']), 0, '0004');
    expect(setLoadoutSlot(m, 1, '0007').loadout[1]).toBe('0007');
    expect(setLoadoutSlot(m, 0, '0004').loadout[0]).toBe('0004');
  });
});

describe('Aura Apex / no shiny in Phase 2', () => {
  it('5★ is Aura Apex and never sets shinyActive', () => {
    const s = start([{ definitionId: '0004', stars: 5 }]);
    expect(s.team[0].pokemon?.stars).toBe(5);
    expect(s.team[0].pokemon?.shinyActive).toBe(false);
  });
});

describe('burn scales with the triggering hit', () => {
  const burnFromSwap = (teamLevel: number) => {
    const s0 = { ...start([{ definitionId: '0010', stars: 1 }, { definitionId: '0004', stars: 3 }, null, null, null, null]), teamLevel };
    const s = withEnemies(s0, [{ x: ARENA.CENTER + 30, y: ARENA.CENTER }]);
    const n = tickGame(s, { hotSwapIndex: 1 }, config, 0, mulberry32(3));
    const burn = n.enemies[0].statuses?.find((st) => st.id === 'BURN');
    return { hit: n.runStats.damagePerSlot[1], dps: burn?.dps ?? 0 };
  };

  it('stores a larger dps at a higher Team Level and equals hit × BURN_DPS_FACTOR', () => {
    const lo = burnFromSwap(1);
    const hi = burnFromSwap(30);
    expect(lo.hit).toBeGreaterThan(0);
    expect(hi.dps).toBeGreaterThan(lo.dps);
    expect(hi.dps).toBeCloseTo(hi.hit * BURN_DPS_FACTOR, 5);
  });
});

describe('contract tripwires', () => {
  it('calculateDamage keeps its positional-parameter contract', () => {
    // 7 params are declared, but the 7th (typeChart) is defaulted so Function.length is 6.
    // A new REQUIRED positional param (e.g. a modifiers arg) would push this to 7 and trip.
    expect(calculateDamage.length).toBe(6);
  });

  it('startRun copies shinyActive onto PlayerPokemon', () => {
    const s = start([{ definitionId: '0004', stars: 1, shinyActive: true }]);
    expect(s.team[0].pokemon?.shinyActive).toBe(true);
  });
});
