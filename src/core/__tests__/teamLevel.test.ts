import { describe, it, expect } from 'vitest';
import {
  calculateTeamLevelUpgradeCost,
  computePokemonMaxHp,
  getStatMultiplier,
  upgradeTeamLevel,
} from '../teamLevel';
import { POKEDEX } from '../../data/pokemon';
import {
  SOLO_STARTER_HP_MULT,
  isShopFloor,
  nextShopFloor,
  teamLevelCost,
} from '../../config/balance.config';
import { computeTeamBonuses } from '../passives';
import { AttackPattern } from '../types';
import type { BastionUpgrades, Cooldowns6, GameState, PlayerPokemon, Team6 } from '../types';

const ZERO_UPGRADES: BastionUpgrades = {
  UP_ARROW: 0,
  UP_SPD: 0,
  UP_MULTI: 0,
  UP_AUTOCLICK: 0,
  UP_CRIT: 0,
  UP_CDMG: 0,
  UP_GOLD: 0,
};

function makePokemon(defId: string, evolutionStage: number, hp = 100, maxHp = 100, alive = true): PlayerPokemon {
  const def = POKEDEX[defId];
  return {
    id: 1,
    x: 192,
    y: 192,
    hp,
    maxHp,
    alive,
    definitionId: def.id,
    types: def.types,
    atk: def.baseStats.atk,
    spd: def.baseStats.spd,
    critRate: def.baseStats.critRate,
    critDmg: def.baseStats.critDmg,
    pattern: def.pattern,
    ultimateEnergy: 0,
    ultimateMax: def.ultimate.cooldownSec,
    evolutionStage,
  };
}

function makeState(teamLevel: number, gold: number, defId: string, evolutionStage: number): GameState {
  const pokemon = makePokemon(defId, evolutionStage);
  const team: Team6 = [
    { index: 0, pokemon, isActive: true, hotSwapCooldownSec: 0 },
    { index: 1, pokemon: null, isActive: false, hotSwapCooldownSec: 0 },
    { index: 2, pokemon: null, isActive: false, hotSwapCooldownSec: 0 },
    { index: 3, pokemon: null, isActive: false, hotSwapCooldownSec: 0 },
    { index: 4, pokemon: null, isActive: false, hotSwapCooldownSec: 0 },
    { index: 5, pokemon: null, isActive: false, hotSwapCooldownSec: 0 },
  ];
  const hotSwapCooldowns: Cooldowns6 = [0, 0, 0, 0, 0, 0];
  return {
    phase: 'PLAYING',
    floor: 1,
    team,
    teamLevel,
    gold,
    bastionUpgrades: { ...ZERO_UPGRADES },
    enemies: [],
    projectiles: [],
    floatingTexts: [],
    ultimateCharge: 0,
    ultimateMax: pokemon.ultimateMax,
    waveEnemiesRemaining: 0,
    hotSwapCooldowns,
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

describe('calculateTeamLevelUpgradeCost', () => {
  it('grows exponentially with the current level', () => {
    expect(calculateTeamLevelUpgradeCost(1)).toBe(teamLevelCost(1));
    expect(calculateTeamLevelUpgradeCost(2)).toBeGreaterThan(calculateTeamLevelUpgradeCost(1));
    expect(calculateTeamLevelUpgradeCost(3)).toBeGreaterThan(calculateTeamLevelUpgradeCost(2));
    const ratio = calculateTeamLevelUpgradeCost(3) / calculateTeamLevelUpgradeCost(2);
    expect(ratio).toBeGreaterThan(1.2);
    expect(ratio).toBeLessThan(1.25);
  });
});

describe('getStatMultiplier', () => {
  it('is 1x at Team Level 1 and scales +10% per level', () => {
    expect(getStatMultiplier(1)).toBeCloseTo(1, 5);
    expect(getStatMultiplier(6)).toBeCloseTo(1.5, 5);
    expect(getStatMultiplier(11)).toBeCloseTo(2, 5);
  });
});

describe('upgradeTeamLevel', () => {
  it('spends gold and raises the level by one', () => {
    const state = makeState(3, 100_000, '0004', 0);
    const next = upgradeTeamLevel(state);
    expect(next.teamLevel).toBe(4);
    expect(next.gold).toBe(state.gold - calculateTeamLevelUpgradeCost(3));
  });

  it('does nothing when the player cannot afford it', () => {
    const state = makeState(3, 0, '0004', 0);
    expect(upgradeTeamLevel(state)).toBe(state);
  });

  it('evolves Charmander -> Charmeleon at Team Level 16', () => {
    const next = upgradeTeamLevel(makeState(15, 100_000, '0004', 0));
    const pokemon = next.team[0].pokemon;
    expect(next.teamLevel).toBe(16);
    expect(pokemon?.definitionId).toBe('0005');
    expect(pokemon?.evolutionStage).toBe(1);
    expect(pokemon?.pattern).toBe(AttackPattern.SNIPER);
  });

  it('evolves Charmeleon -> Charizard at Team Level 36', () => {
    const next = upgradeTeamLevel(makeState(35, 1_000_000, '0005', 1));
    const pokemon = next.team[0].pokemon;
    expect(next.teamLevel).toBe(36);
    expect(pokemon?.definitionId).toBe('0006');
    expect(pokemon?.evolutionStage).toBe(2);
    expect(pokemon?.types).toEqual([POKEDEX['0006'].types[0], POKEDEX['0006'].types[1]]);
  });

  it('clamps the ultimate charge to the evolved form cooldown', () => {
    const state = makeState(15, 100_000, '0004', 0);
    const full: GameState = {
      ...state,
      team: state.team.map((slot, i) =>
        i === 0
          ? { ...slot, pokemon: { ...slot.pokemon!, ultimateEnergy: POKEDEX['0004'].ultimate.cooldownSec } }
          : slot,
      ) as Team6,
    };
    const pokemon = upgradeTeamLevel(full).team[0].pokemon;
    expect(pokemon?.definitionId).toBe('0005');
    expect(pokemon?.ultimateMax).toBe(POKEDEX['0005'].ultimate.cooldownSec);
    expect(pokemon?.ultimateEnergy).toBe(POKEDEX['0005'].ultimate.cooldownSec);
  });

  it('does not evolve a starter past its current stage', () => {
    const next = upgradeTeamLevel(makeState(15, 100_000, '0004', 0));
    expect(next.team[0].pokemon?.definitionId).not.toBe('0006');
  });
});

describe('Block 3A.2-V — Individual Vitality & Route Stop Config', () => {
  describe('hpFactor and computePokemonMaxHp', () => {
    it('tank Snorlax (0143, baseStats.hp = 160) has significantly higher maxHp than Gastly (0092, baseStats.hp = 30) at same teamLevel', () => {
      const snorlaxDef = POKEDEX['0143'];
      const gastlyDef = POKEDEX['0092'];
      expect(snorlaxDef.baseStats.hp).toBe(160);
      expect(gastlyDef.baseStats.hp).toBe(30);
      const snorlaxHp = computePokemonMaxHp(snorlaxDef, 1, 0, false);
      const gastlyHp = computePokemonMaxHp(gastlyDef, 1, 0, false);
      expect(snorlaxHp).toBeGreaterThan(gastlyHp * 2);
    });

    it('solo team receives SOLO_STARTER_HP_MULT (x1.3), team of 2+ does not', () => {
      const def = POKEDEX['0004'];
      const soloHp = computePokemonMaxHp(def, 1, 0, true);
      const teamHp = computePokemonMaxHp(def, 1, 0, false);
      expect(soloHp).toBe(Math.floor(teamHp * SOLO_STARTER_HP_MULT));
    });
  });

  describe('hp / maxHp ratio preservation on upgradeTeamLevel and evolution', () => {
    it('maintains hp / maxHp ratio around 50% without free full healing, even when evolving at lvl 16', () => {
      const baseState = makeState(15, 100_000, '0004', 0);
      const initialSlot = baseState.team[0];
      const maxHp15 = computePokemonMaxHp(POKEDEX['0004'], 15, 0, true);
      const halfHp = Math.round(maxHp15 / 2);
      const woundedState: GameState = {
        ...baseState,
        team: [
          { ...initialSlot, pokemon: { ...initialSlot.pokemon!, maxHp: maxHp15, hp: halfHp } },
          baseState.team[1],
          baseState.team[2],
          baseState.team[3],
          baseState.team[4],
          baseState.team[5],
        ],
      };

      const next = upgradeTeamLevel(woundedState);
      expect(next.teamLevel).toBe(16);
      const evolved = next.team[0].pokemon!;
      expect(evolved.definitionId).toBe('0005'); // Charmeleon
      expect(evolved.maxHp).toBeGreaterThan(maxHp15);
      const ratio = evolved.hp / evolved.maxHp;
      expect(ratio).toBeGreaterThan(0.48);
      expect(ratio).toBeLessThan(0.52);
      expect(evolved.hp).toBeLessThan(evolved.maxHp);
    });

    it('fainted Pokemon (alive: false, hp: 0) remains alive: false, hp: 0 after upgradeTeamLevel', () => {
      const baseState = makeState(5, 100_000, '0004', 0);
      const slot0 = baseState.team[0];
      const faintedState: GameState = {
        ...baseState,
        team: [
          { ...slot0, pokemon: { ...slot0.pokemon!, hp: 0, alive: false } },
          baseState.team[1],
          baseState.team[2],
          baseState.team[3],
          baseState.team[4],
          baseState.team[5],
        ],
      };
      const next = upgradeTeamLevel(faintedState);
      const p = next.team[0].pokemon!;
      expect(p.alive).toBe(false);
      expect(p.hp).toBe(0);
    });
  });

  describe('Rule D9 — Fainted Pokemon deactivates bench passives', () => {
    it('bench 2★+ Pokemon contributes bonus when alive, but 0 when fainted', () => {
      const aliveTeam: Team6 = [
        { index: 0, pokemon: makePokemon('0001', 0, 100, 100, true), isActive: true, hotSwapCooldownSec: 0 },
        { index: 1, pokemon: { ...makePokemon('0143', 0, 100, 100, true), stars: 2 }, isActive: false, hotSwapCooldownSec: 0 },
        { index: 2, pokemon: { ...makePokemon('0004', 0, 100, 100, true), stars: 2 }, isActive: false, hotSwapCooldownSec: 0 },
        { index: 3, pokemon: null, isActive: false, hotSwapCooldownSec: 0 },
        { index: 4, pokemon: null, isActive: false, hotSwapCooldownSec: 0 },
        { index: 5, pokemon: null, isActive: false, hotSwapCooldownSec: 0 },
      ];
      const aliveBonuses = computeTeamBonuses(aliveTeam, POKEDEX);
      expect(aliveBonuses.maxHp).toBeCloseTo(0.20, 5);
      expect(aliveBonuses.typeDamage.FIRE).toBeCloseTo(0.08, 5);

      const faintedTeam: Team6 = [
        aliveTeam[0],
        { ...aliveTeam[1], pokemon: { ...aliveTeam[1].pokemon!, hp: 0, alive: false } },
        { ...aliveTeam[2], pokemon: { ...aliveTeam[2].pokemon!, hp: 0, alive: false } },
        aliveTeam[3],
        aliveTeam[4],
        aliveTeam[5],
      ];
      const faintedBonuses = computeTeamBonuses(faintedTeam, POKEDEX);
      expect(faintedBonuses.maxHp).toBe(0);
      expect(faintedBonuses.typeDamage.FIRE ?? 0).toBe(0);
    });
  });

  describe('Route Stop configuration (isShopFloor, nextShopFloor)', () => {
    it('isShopFloor is true for 5, 15, 25, 35, 45 and false for 1, 4, 6, 10, 14, 20', () => {
      for (const f of [5, 15, 25, 35, 45]) {
        expect(isShopFloor(f)).toBe(true);
      }
      for (const f of [1, 4, 6, 10, 14, 20]) {
        expect(isShopFloor(f)).toBe(false);
      }
    });

    it('nextShopFloor returns 5 for 1..5, 15 for 6..15, 25 for 16..25', () => {
      for (let f = 1; f <= 5; f++) {
        expect(nextShopFloor(f)).toBe(5);
      }
      for (let f = 6; f <= 15; f++) {
        expect(nextShopFloor(f)).toBe(15);
      }
      for (let f = 16; f <= 25; f++) {
        expect(nextShopFloor(f)).toBe(25);
      }
    });
  });
});

