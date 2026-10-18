import { describe, expect, it } from 'vitest';
import { chooseStarter, createMeta } from '../core/meta';
import type { MetaState } from '../core/meta';
import { PokemonType } from '../core/types';
import { EMPTY_FILTERS, activeFilterCount, applyBoxFilters } from './boxFilters';

const entry = (stars: number, fragments = 0) => ({ stars, fragments, shinyOwned: false, shinyActive: false });

function sample(): MetaState {
  const m = chooseStarter(createMeta(), '0004'); // Charmander (Fuego, 2★ de rango)
  return {
    ...m,
    collection: {
      ...m.collection,
      '0007': entry(3, 1), // Squirtle
      '0010': entry(1, 3), // Caterpie, 3/3 fragmentos para 2★ -> listo
      '0150': { ...entry(5), shinyOwned: true }, // Mewtwo
    },
  };
}
const ids = (m: MetaState): string[] => Object.keys(m.collection);

describe('applyBoxFilters', () => {
  it('sorts by rarity (legendary first) by default', () => {
    const m = sample();
    expect(applyBoxFilters(ids(m), m, EMPTY_FILTERS)[0]).toBe('0150');
  });

  it('filters by name, dex number, stars, type, ready and shiny', () => {
    const m = sample();
    const run = (p: Partial<typeof EMPTY_FILTERS>) => applyBoxFilters(ids(m), m, { ...EMPTY_FILTERS, ...p });
    expect(run({ query: 'squir' })).toEqual(['0007']);
    expect(run({ query: '10' })).toContain('0010');
    expect(run({ stars: [3] })).toEqual(['0007']);
    expect(run({ types: [PokemonType.Fire] })).toEqual(['0004']);
    expect(run({ ready: true })).toEqual(['0010']);
    expect(run({ shiny: true })).toEqual(['0150']);
    expect(run({ inTeam: true })).toEqual(['0004']);
  });

  it('counts active filters but not the sort', () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, sort: 'NAME' })).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, query: 'x', stars: [1, 2], ready: true })).toBe(3);
  });
});
