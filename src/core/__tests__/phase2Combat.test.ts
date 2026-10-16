import { describe, it, expect } from 'vitest';
import { tickGame } from '../gameLoop';
import { POKEDEX } from '../../data/pokemon';
import { TYPE_CHART } from '../damage';
import { ARENA } from '../../config/arena.config';
import {
  SWITCH_IN_EFFECT_DURATION, SLOW_SPEED_FACTOR, BOSS_STATUS_DURATION_FACTOR,
} from '../../config/balance.config';
import { computeTeamBonuses, damageBonusMultiplier, starsOf } from '../passives';
import { AttackPattern, PokemonType } from '../types';
import type {
  BastionUpgrades, Cooldowns6, Enemy, GameConfig, GameState, LoadoutEntry, Team6,
} from '../types';

const config: GameConfig = { pokedex: POKEDEX, typeChart: TYPE_CHART, seed: 1 };
const ZERO: BastionUpgrades = { UP_CLICK: 0, UP_HP: 0, UP_MULTI: 0, UP_ARROW: 0, UP_SPD: 0, UP_CRIT: 0, UP_CDMG: 0, UP_GOLD: 0 };

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

const start = (loadout: (LoadoutEntry | null)[], seed = 1): GameState =>
  tickGame(menuState(), { startRun: loadout }, config, 0, mulberry32(seed));

/** Replace the wave with hand-placed enemies. */
function withEnemies(s: GameState, list: Partial<Enemy>[]): GameState {
  const enemies = list.map((e, i) => ({
    id: 500 + i, x: ARENA.CENTER, y: ARENA.CENTER, hp: 1e9, maxHp: 1e9, alive: true,
    types: [PokemonType.Normal] as [PokemonType], speed: 20, goldValue: 7, isBoss: false, definitionId: 'WILD', ...e,
  })) as Enemy[];
  return { ...s, enemies, waveEnemiesRemaining: enemies.length };
}
const fullUlt = (s: GameState): GameState => ({ ...s, ultimateCharge: s.ultimateMax });

describe('startRun with a loadout', () => {
  it('keeps slot positions, activates the first filled slot and carries stars', () => {
    const s = start([null, { definitionId: '0007', stars: 3 }, null, { definitionId: '0150', stars: 5 }, null, null]);
    expect(s.phase).toBe('PLAYING');
    expect(s.team[0].pokemon).toBeNull();
    expect(s.team[1].isActive).toBe(true);
    expect(s.team[1].pokemon?.definitionId).toBe('0007');
    expect(s.team[1].pokemon?.stars).toBe(3);
    expect(s.team[3].pokemon?.stars).toBe(5);
    expect(s.ultimateMax).toBe(POKEDEX['0007'].ultimate.energyCost);
    expect(s.effects).toEqual([]);
  });

  it('ignores an empty or unknown loadout', () => {
    expect(start([null, null, null, null, null, null]).phase).toBe('MENU');
    expect(start([{ definitionId: '9999', stars: 1 }, null, null, null, null, null]).phase).toBe('MENU');
  });

  it('legacy selectStarter still starts a 1-Pokémon 1★ run', () => {
    const s = tickGame(menuState(), { selectStarter: '0004' }, config, 0, mulberry32(1));
    expect(s.phase).toBe('PLAYING');
    expect(starsOf(s.team[0].pokemon)).toBe(1);
  });
});

describe('BENCH_PASSIVE (2★ / 5★)', () => {
  const team = (stars: number) => start([{ definitionId: '0010', stars: 1 }, { definitionId: '0004', stars }, null, null, null, null]).team;

  it('does nothing at 1★, applies at 2★ and doubles at 5★', () => {
    expect(computeTeamBonuses(team(1), POKEDEX).typeDamage.FIRE ?? 0).toBe(0);
    const v2 = computeTeamBonuses(team(2), POKEDEX).typeDamage.FIRE;
    expect(v2).toBeCloseTo(0.08, 5);
    expect(computeTeamBonuses(team(5), POKEDEX).typeDamage.FIRE).toBeCloseTo(0.16, 5);
  });

  it('multiplies matching-type damage only', () => {
    const b = computeTeamBonuses(team(2), POKEDEX);
    expect(damageBonusMultiplier(b, [PokemonType.Fire])).toBeCloseTo(1.08, 5);
    expect(damageBonusMultiplier(b, [PokemonType.Water])).toBe(1);
  });

  it('really increases damage dealt by a Fire attacker in the loop', () => {
    // Magby carries FIRE_DAMAGE as its passive.
    const fireDmg = (stars: number) => {
      const s0 = start([{ definitionId: '0004', stars: 1 }, { definitionId: '0240', stars }, null, null, null, null]);
      const s = { ...withEnemies(s0, [{ x: 100, y: 100 }]), teamLevel: 20 };
      return tickGame(s, { click: { x: 100, y: 100 } }, config, 0, () => 0.99).runStats.totalDamageDealt;
    };
    expect(fireDmg(1)).toBeGreaterThan(0);
    expect(fireDmg(2)).toBeGreaterThan(fireDmg(1));
  });

  it('caps an aggregated bonus', () => {
    const s = start([0, 1, 2, 3, 4, 5].map((i) => ({ definitionId: ['0150', '0147', '0150', '0147', '0150', '0147'][i], stars: 5 })));
    expect(computeTeamBonuses(s.team, POKEDEX).allDamage).toBeLessThan(1.51);
  });
});

describe('Switch-In status (3★)', () => {
  const swapTo = (id: string, stars: number, enemy: Partial<Enemy> = {}) => {
    const s0 = start([{ definitionId: '0010', stars: 1 }, { definitionId: id, stars }, null, null, null, null]);
    const s = withEnemies(s0, [{ x: ARENA.CENTER + 30, y: ARENA.CENTER, ...enemy }]);
    return tickGame(s, { hotSwapIndex: 1 }, config, 0, mulberry32(3));
  };

  it('applies nothing below 3★', () => {
    const s = swapTo('0004', 2);
    expect(s.enemies[0].status).toBeUndefined();
    expect(s.bastionShieldSec).toBe(0);
  });

  it('Fire burns, Water slows, Electric paralyzes', () => {
    expect(swapTo('0004', 3).enemies[0].status?.burnSec).toBeCloseTo(SWITCH_IN_EFFECT_DURATION.BURN, 5);
    expect(swapTo('0007', 3).enemies[0].status?.slowSec).toBeCloseTo(SWITCH_IN_EFFECT_DURATION.SLOW, 5);
    expect(swapTo('0025', 3).enemies[0].status?.paralyzeSec).toBeCloseTo(SWITCH_IN_EFFECT_DURATION.PARALYZE, 5);
  });

  it('Normal-type grants a bastion shield even with no enemy nearby', () => {
    const s = swapTo('0016', 3, { x: 10, y: 10 });
    expect(s.bastionShieldSec).toBeCloseTo(SWITCH_IN_EFFECT_DURATION.SHIELD, 5);
  });

  it('bosses only suffer a fraction of the duration', () => {
    const s = swapTo('0004', 3, { isBoss: true });
    expect(s.enemies[0].status?.burnSec).toBeCloseTo(SWITCH_IN_EFFECT_DURATION.BURN * BOSS_STATUS_DURATION_FACTOR, 5);
  });
});

describe('status ailments in the loop', () => {
  const base = () => start([{ definitionId: '0004', stars: 1 }]);

  it('paralysis freezes, slow halves movement', () => {
    const at = (status: Enemy['status']) => {
      const s = withEnemies(base(), [{ x: 10, y: 192, speed: 60, status }]);
      const n = tickGame(s, {}, config, 16.7, mulberry32(1));
      return n.enemies[0].x - 10;
    };
    const normal = at(undefined);
    expect(at({ paralyzeSec: 2 })).toBe(0);
    expect(at({ slowSec: 2 })).toBeCloseTo(normal * SLOW_SPEED_FACTOR, 5);
  });

  it('burn deals damage over time, credits the slot and expires', () => {
    const s = withEnemies(base(), [{ x: 10, y: 192, hp: 1000, maxHp: 1000, status: { burnSec: 1, burnDps: 60, burnSlot: 0 } }]);
    let n = s;
    for (let i = 0; i < 30; i++) n = tickGame(n, {}, config, 16.7, mulberry32(i));
    expect(n.enemies[0].hp).toBeLessThan(1000 - 25);
    expect(n.runStats.damagePerSlot[0]).toBeGreaterThan(25);
    for (let i = 0; i < 40; i++) n = tickGame(n, {}, config, 16.7, mulberry32(i));
    expect(n.enemies[0].status).toBeUndefined();
  });

  it('a burn kill pays gold and counts the kill', () => {
    const s = withEnemies(base(), [{ x: 10, y: 192, hp: 0.5, maxHp: 10, goldValue: 9, status: { burnSec: 1, burnDps: 600, burnSlot: 0 } }]);
    const n = tickGame(s, {}, config, 16.7, mulberry32(1));
    expect(n.runStats.totalKills).toBeGreaterThan(0);
    expect(n.gold).toBeGreaterThanOrEqual(9);
  });

  it('shield blocks contact damage and then wears off', () => {
    const s = { ...withEnemies(base(), [{ x: ARENA.CENTER, y: ARENA.CENTER }]), bastionShieldSec: 1, bastionHp: 50 };
    const n = tickGame(s, {}, config, 16.7, mulberry32(1));
    expect(n.bastionHp).toBeGreaterThanOrEqual(50);
    expect(n.floatingTexts.some((t) => t.text === 'BLOQUEO')).toBe(true);
    const later = tickGame({ ...n, bastionShieldSec: 0, enemies: withEnemies(n, [{ x: ARENA.CENTER, y: ARENA.CENTER }]).enemies }, {}, config, 16.7, mulberry32(2));
    expect(later.bastionHp).toBeLessThan(50);
  });
});

describe('4★ pattern upgrades', () => {
  const fireOnce = (id: string, stars: number) => {
    const s0 = start([{ definitionId: id, stars }]);
    const s = withEnemies(s0, [{ x: 60, y: 192 }]);
    const n = tickGame(s, {}, config, 1000, () => 0); // rng 0 => always fires
    return n.projectiles[0];
  };

  it('AOE has a splash radius that grows 50% at 4★', () => {
    const p3 = fireOnce('0006', 3).splashRadius!;
    const p4 = fireOnce('0006', 4).splashRadius!;
    expect(p3).toBeGreaterThan(0);
    expect(p4).toBeCloseTo(p3 * 1.5, 5);
  });

  it('SNIPER gains pierce, CHAIN gains +1 bounce, only at 4★', () => {
    expect(fireOnce('0004', 3).pierce ?? 0).toBe(0);
    expect(fireOnce('0004', 4).pierce).toBeGreaterThan(0);
    expect(POKEDEX['0025'].pattern).toBe(AttackPattern.CHAIN);
    expect(fireOnce('0025', 3).bounce ?? 0).toBe(0);
    expect(fireOnce('0025', 4).bounce).toBe(1);
  });

  it('AOE splash damages neighbours of the impacted enemy', () => {
    const s0 = start([{ definitionId: '0006', stars: 1 }]);
    const s = { ...withEnemies(s0, [{ x: 190, y: 160, hp: 1e6 }, { x: 205, y: 160, hp: 1e6 }]), teamLevel: 30 };
    const proj = { id: 900, x: 190, y: 160, vx: 0, vy: 0, damage: 10, types: [PokemonType.Fire] as [PokemonType], fromPlayer: true, hitIds: [], splashRadius: 40 };
    const n = tickGame({ ...s, projectiles: [proj] }, {}, config, 16.7, () => 0.99);
    const [a, b] = n.enemies;
    expect(a.hp).toBeLessThan(1e6);
    expect(b.hp).toBeLessThan(1e6);
  });
});

describe('ultimates', () => {
  const run = (id: string, enemies: Partial<Enemy>[]) => {
    const s = fullUlt(withEnemies(start([{ definitionId: id, stars: 1 }]), enemies));
    return tickGame(s, { useUltimate: true }, config, 0, mulberry32(4));
  };
  const dealt = (s: GameState) => s.enemies.map((e) => 1e9 - e.hp);

  it('needs a full meter and a living enemy; never wastes charge', () => {
    const s0 = withEnemies(start([{ definitionId: '0004', stars: 1 }]), [{ x: 100, y: 100 }]);
    expect(tickGame({ ...s0, ultimateCharge: 99 }, { useUltimate: true }, config, 0, mulberry32(1)).ultimateCharge).toBe(99);
    const empty = fullUlt({ ...s0, enemies: [], waveEnemiesRemaining: 0 });
    expect(tickGame(empty, { useUltimate: true }, config, 0, mulberry32(1)).ultimateCharge).toBe(empty.ultimateMax);
  });

  it('ARENA (Charizard) hits every enemy and resets the meter', () => {
    const n = run('0006', [{ x: 20, y: 20 }, { x: 360, y: 360 }]);
    expect(n.ultimateCharge).toBe(0);
    expect(dealt(n).every((d) => d > 0)).toBe(true);
  });

  it('NOVA (Bulbasaur) only reaches enemies inside the radius', () => {
    const n = run('0001', [{ x: 192 + 60, y: 192 }, { x: 5, y: 5 }]);
    const [near, far] = dealt(n);
    expect(near).toBeGreaterThan(0);
    expect(far).toBe(0);
    expect(n.effects?.[0].kind).toBe('NOVA');
  });

  it('BEAM (Charmander) pierces along the aim line and misses off-axis enemies', () => {
    // Nearest enemy east of centre defines the aim; a second one behind it is hit, one far north is not.
    const n = run('0004', [{ x: 192 + 40, y: 192 }, { x: 192 + 160, y: 192 }, { x: 192, y: 192 - 150 }]);
    const [a, b, c] = dealt(n);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(c).toBe(0);
    expect(n.effects?.[0].kind).toBe('BEAM');
  });

  it('status ultimates (Charmander -> burn) leave survivors burning', () => {
    const n = run('0004', [{ x: 192 + 40, y: 192 }]);
    expect(n.enemies[0].status?.burnSec).toBeGreaterThan(0);
  });

  it('every species can cast its ultimate without throwing', () => {
    for (const id of Object.keys(POKEDEX)) {
      const n = run(id, [{ x: 250, y: 192 }, { x: 150, y: 150 }]);
      expect(n.ultimateCharge).toBe(0);
    }
  });

  it('charges from hits and clicks, scaled by ULT_CHARGE passives', () => {
    const s = withEnemies(start([{ definitionId: '0004', stars: 1 }]), [{ x: 100, y: 100 }]);
    const clicked = tickGame(s, { click: { x: 100, y: 100 } }, config, 0, mulberry32(1));
    expect(clicked.ultimateCharge).toBe(5);
    const boosted = start([{ definitionId: '0004', stars: 1 }, { definitionId: '0255', stars: 2 }, null, null, null, null]);
    const c2 = tickGame(withEnemies(boosted, [{ x: 100, y: 100 }]), { click: { x: 100, y: 100 } }, config, 0, mulberry32(1));
    expect(c2.ultimateCharge).toBeCloseTo(5 * (1 + 0.1), 5); // Torchic (base form) ULT_CHARGE 0.2 * 0.5
  });

  it('keeps the meter fill ratio when swapping Pokémon', () => {
    const s0 = start([{ definitionId: '0004', stars: 1 }, { definitionId: '0150', stars: 1 }, null, null, null, null]);
    const half = { ...s0, ultimateCharge: s0.ultimateMax / 2 };
    const n = tickGame(half, { hotSwapIndex: 1 }, config, 0, mulberry32(1));
    expect(n.ultimateMax).toBe(150);
    expect(n.ultimateCharge).toBeCloseTo(75, 5);
  });
});

describe('determinism with Phase 2 systems', () => {
  it('same seed => identical state, with stars, statuses and ultimates in play', () => {
    const run = (seed: number) => {
      const rng = mulberry32(seed);
      let s = tickGame(menuState(), { startRun: [{ definitionId: '0004', stars: 4 }, { definitionId: '0025', stars: 5 }, null, null, null, null] }, config, 0, rng);
      for (let i = 0; i < 400; i++) {
        s = tickGame(s, i === 100 ? { hotSwapIndex: 1 } : i === 250 ? { useUltimate: true } : {}, config, 16.7, rng);
        if (i === 240) s = { ...s, ultimateCharge: s.ultimateMax };
      }
      return JSON.stringify(s);
    };
    expect(run(77)).toBe(run(77));
  });
});
