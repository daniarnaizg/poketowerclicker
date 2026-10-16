import { describe, it, expect } from 'vitest';
import { POKEDEX } from '../../data/pokemon';
import { ULTIMATES } from '../../data/ultimates';
import { ALL_POOL_IDS, GACHA_POOLS, rarityOf } from '../../data/gachaPools';
import { getEvolutionChain } from '../evolution';
import { SWITCH_IN_EFFECT_BY_TYPE, STARTER_IDS } from '../../config/balance.config';
import { PokemonType } from '../types';

const defs = Object.values(POKEDEX);
const evolutionTargets = new Set(defs.flatMap((d) => (d.evolution ? [d.evolution.targetId] : [])));
const baseForms = defs.filter((d) => !evolutionTargets.has(d.id));

describe('pokedex integrity', () => {
  it('every key matches its definition id and ids are 4-digit strings', () => {
    for (const [key, d] of Object.entries(POKEDEX)) {
      expect(d.id).toBe(key);
      expect(/^\d{4}$/.test(d.id)).toBe(true);
    }
  });

  it('every evolution target exists and canonical levels strictly increase along a chain', () => {
    for (const d of baseForms) {
      const chain = getEvolutionChain(d.id);
      let prev = 0;
      for (const id of chain) {
        expect(POKEDEX[id]).toBeDefined();
        const lvl = POKEDEX[id].evolution?.canonicalLevel;
        if (lvl !== undefined) { expect(lvl).toBeGreaterThan(prev); prev = lvl; }
      }
    }
  });

  it('keeps the canonical levels called out by the PRD', () => {
    expect(POKEDEX['0004'].evolution?.canonicalLevel).toBe(16);
    expect(POKEDEX['0005'].evolution?.canonicalLevel).toBe(36);
    expect(POKEDEX['0010'].evolution?.canonicalLevel).toBe(7);
    expect(POKEDEX['0011'].evolution?.canonicalLevel).toBe(10);
    expect(POKEDEX['0147'].evolution?.canonicalLevel).toBe(30);
    expect(POKEDEX['0148'].evolution?.canonicalLevel).toBe(55);
  });

  it('every species has sane stats and a known ultimate', () => {
    for (const d of defs) {
      expect(d.baseStats.atk).toBeGreaterThan(0);
      expect(d.baseStats.spd).toBeGreaterThan(0);
      expect(d.baseStats.critRate).toBeLessThan(0.5);
      expect(d.types.length >= 1 && d.types.length <= 2).toBe(true);
      expect(ULTIMATES[d.ultimate.id]).toBeDefined();
      expect(d.ultimate.name).toBe(ULTIMATES[d.ultimate.id].name);
      expect(d.benchPassive.value).toBeGreaterThan(0);
    }
  });

  it('final forms out-damage their base forms', () => {
    for (const d of baseForms) {
      const chain = getEvolutionChain(d.id);
      if (chain.length > 1) {
        expect(POKEDEX[chain[chain.length - 1]].baseStats.atk).toBeGreaterThan(d.baseStats.atk);
      }
    }
  });
});

describe('gacha pools', () => {
  it('contain only existing base forms, each in exactly one pool', () => {
    expect(new Set(ALL_POOL_IDS).size).toBe(ALL_POOL_IDS.length);
    for (const id of ALL_POOL_IDS) {
      expect(POKEDEX[id]).toBeDefined();
      expect(evolutionTargets.has(id)).toBe(false);
    }
  });

  it('cover every base form in the pokedex (nothing unobtainable)', () => {
    for (const d of baseForms) expect(ALL_POOL_IDS.includes(d.id)).toBe(true);
  });

  it('place the PRD example species in the right rarity', () => {
    expect(rarityOf('0016')).toBe('COMMON'); // Pidgey
    expect(rarityOf('0025')).toBe('COMMON'); // Pikachu
    expect(rarityOf('0280')).toBe('RARE'); // Ralts
    expect(rarityOf('0147')).toBe('EPIC'); // Dratini
    expect(rarityOf('0143')).toBe('EPIC'); // Snorlax
    expect(rarityOf('0150')).toBe('LEGENDARY'); // Mewtwo
    expect(GACHA_POOLS.LEGENDARY).toHaveLength(4);
  });

  it('offer all three Kanto starters as RARE so none is unobtainable', () => {
    for (const id of STARTER_IDS) expect(rarityOf(id)).toBe('RARE');
  });
});

describe('type coverage', () => {
  it('every elemental type maps to a switch-in effect', () => {
    for (const t of Object.values(PokemonType)) expect(SWITCH_IN_EFFECT_BY_TYPE[t]).toBeDefined();
  });
});
