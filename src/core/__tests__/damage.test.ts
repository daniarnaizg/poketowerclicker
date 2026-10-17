import { describe, it, expect } from 'vitest';
import { calculateDamage, getEffectiveness } from '../damage';
import { PokemonType } from '../types';
import type { BastionUpgrades } from '../types';
import { getStatMultiplier } from '../teamLevel';
import { CRIT_CHANCE_CAP } from '../../config/balance.config';

const NO_UPGRADES: BastionUpgrades = {
  UP_ARROW: 0,
  UP_SPD: 0,
  UP_MULTI: 0,
  UP_AUTOCLICK: 0,
  UP_CRIT: 0,
  UP_CDMG: 0,
  UP_GOLD: 0,
};

const neverCrit = () => 0.999;
const alwaysCrit = () => 0;
const defender = (types: PokemonType[]) => ({ id: 1, types });

describe('calculateDamage — type effectiveness', () => {
  it('applies the 1.5x super-effective multiplier', () => {
    const hit = calculateDamage(
      { atk: 50, critRate: 0, critDmg: 2, types: [PokemonType.Fire] },
      defender([PokemonType.Grass]),
      100,
      1,
      NO_UPGRADES,
      neverCrit,
    );
    expect(hit.amount).toBe(150);
    expect(hit.isSuperEffective).toBe(true);
    expect(hit.isCrit).toBe(false);
  });

  it('applies the 0.65x not-very-effective multiplier', () => {
    const hit = calculateDamage(
      { atk: 50, critRate: 0, critDmg: 2, types: [PokemonType.Fire] },
      defender([PokemonType.Water]),
      100,
      1,
      NO_UPGRADES,
      neverCrit,
    );
    expect(hit.amount).toBe(65);
    expect(hit.isSuperEffective).toBe(false);
  });

  it('applies 0.25x immunity floor instead of 0 damage (Decision D5)', () => {
    const hit = calculateDamage(
      { atk: 50, critRate: 0, critDmg: 2, types: [PokemonType.Normal] },
      defender([PokemonType.Ghost]),
      100,
      1,
      NO_UPGRADES,
      neverCrit,
    );
    expect(hit.amount).toBe(25);
    expect(hit.isSuperEffective).toBe(false);
  });

  it('deals at least 1 damage on a non-immune hit', () => {
    const hit = calculateDamage(
      { atk: 1, critRate: 0, critDmg: 1, types: [PokemonType.Normal] },
      defender([PokemonType.Normal]),
      0,
      1,
      NO_UPGRADES,
      neverCrit,
    );
    expect(hit.amount).toBe(1);
  });
});

describe('getEffectiveness — dual types', () => {
  it('multiplies every attacker/defender type pair', () => {
    // Fire -> Grass (1.5) * Fire -> Ice (1.5)
    expect(getEffectiveness([PokemonType.Fire], [PokemonType.Grass, PokemonType.Ice])).toBeCloseTo(2.25, 5);
    // Fire (1.5) * Water (0.65) against a Grass defender
    expect(getEffectiveness([PokemonType.Fire, PokemonType.Water], [PokemonType.Grass])).toBeCloseTo(0.975, 5);
  });

  it('feeds the combined multiplier into the damage formula', () => {
    const hit = calculateDamage(
      { atk: 50, critRate: 0, critDmg: 2, types: [PokemonType.Fire] },
      defender([PokemonType.Grass, PokemonType.Ice]),
      100,
      1,
      NO_UPGRADES,
      neverCrit,
    );
    // floor(100 * 2.25)
    expect(hit.amount).toBe(225);
  });
});

describe('calculateDamage — crits', () => {
  it('multiplies by critDmg on a crit', () => {
    const hit = calculateDamage(
      { atk: 50, critRate: 0.05, critDmg: 2, types: [PokemonType.Normal] },
      defender([PokemonType.Normal]),
      100,
      1,
      NO_UPGRADES,
      alwaysCrit,
    );
    expect(hit.isCrit).toBe(true);
    expect(hit.amount).toBe(200);
  });

  it('scales crit damage with UP_CDMG', () => {
    const hit = calculateDamage(
      { atk: 50, critRate: 0.05, critDmg: 2, types: [PokemonType.Normal] },
      defender([PokemonType.Normal]),
      100,
      1,
      { ...NO_UPGRADES, UP_CDMG: 10 },
      alwaysCrit,
    );
    // 2 * (1 + 10 * 0.1) = 4
    expect(hit.amount).toBe(400);
  });

  it('clamps crit chance at CRIT_CHANCE_CAP', () => {
    const hit = calculateDamage(
      { atk: 50, critRate: 1, critDmg: 2, types: [PokemonType.Normal] },
      defender([PokemonType.Normal]),
      100,
      1,
      NO_UPGRADES,
      () => CRIT_CHANCE_CAP + 0.01,
    );
    expect(hit.isCrit).toBe(false);
    expect(hit.amount).toBe(100);
  });
});

describe('calculateDamage — scaling', () => {
  it('scales with Team Level and matches getStatMultiplier', () => {
    const at1 = calculateDamage(
      { atk: 50, critRate: 0, critDmg: 2, types: [PokemonType.Normal] },
      defender([PokemonType.Normal]),
      100,
      1,
      NO_UPGRADES,
      neverCrit,
    );
    const at11 = calculateDamage(
      { atk: 50, critRate: 0, critDmg: 2, types: [PokemonType.Normal] },
      defender([PokemonType.Normal]),
      100,
      11,
      NO_UPGRADES,
      neverCrit,
    );
    expect(getStatMultiplier(11)).toBeCloseTo(2, 5);
    expect(at11.amount).toBe(at1.amount * getStatMultiplier(11));
  });

  it('applies UP_ARROW (+10% projectile damage per level)', () => {
    const hit = calculateDamage(
      { atk: 50, critRate: 0, critDmg: 2, types: [PokemonType.Normal] },
      defender([PokemonType.Normal]),
      100,
      1,
      { ...NO_UPGRADES, UP_ARROW: 1 },
      neverCrit,
    );
    expect(hit.amount).toBe(110);
  });
});
