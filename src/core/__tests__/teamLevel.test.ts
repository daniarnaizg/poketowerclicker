import { describe, it, expect } from 'vitest';
import {
  calculateTeamLevelUpgradeCost,
  getStatMultiplier,
  upgradeTeamLevel,
} from '../teamLevel';
import { POKEDEX } from '../../data/pokemon';
import { teamLevelCost } from '../../config/balance.config';
import { AttackPattern } from '../types';
import type { Cooldowns6, GameState, PlayerPokemon, Team6 } from '../types';

const ZERO_UPGRADES = {
  UP_CLICK: 0,
  UP_HP: 0,
  UP_MULTI: 0,
  UP_ARROW: 0,
  UP_SPD: 0,
  UP_CRIT: 0,
  UP_CDMG: 0,
  UP_GOLD: 0,
  UP_WALL: 0,
} as const;

function makePokemon(defId: string, evolutionStage: number): PlayerPokemon {
  const def = POKEDEX[defId];
  return {
    id: 1,
    x: 192,
    y: 192,
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
    bastionHp: 100,
    bastionMaxHp: 100,
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
