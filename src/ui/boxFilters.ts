/**
 * PokéBastion — filtros y orden de la Caja. Lógica pura (sin DOM) para poder
 * probarla y para que escale a cientos de Pokémon sin tocar la UI.
 */

import { canAwaken, nextAwakenCost } from '../core/meta';
import type { MetaState } from '../core/meta';
import type { PokemonType, Rarity } from '../core/types';
import { rarityOf } from '../data/gachaPools';
import { POKEDEX } from '../data/pokemon';
import { RARITY_TIER } from './rarity';

export type BoxSort = 'RARITY' | 'STARS' | 'DEX' | 'NAME' | 'FRAGS';

export const SORT_LABEL: Record<BoxSort, string> = {
  RARITY: 'RANGO',
  STARS: 'ESTRELLAS',
  FRAGS: 'FRAGMENTOS',
  DEX: 'Nº POKÉDEX',
  NAME: 'NOMBRE',
};

export interface BoxFilters {
  query: string;
  stars: number[];
  rarities: Rarity[];
  gens: number[];
  types: PokemonType[];
  /** Solo los que tienen versión shiny. */
  shiny: boolean;
  /** Solo los que ya pueden despertar (fragmentos suficientes). */
  ready: boolean;
  /** Solo los que están en el equipo. */
  inTeam: boolean;
  sort: BoxSort;
}

export const EMPTY_FILTERS: BoxFilters = {
  query: '',
  stars: [],
  rarities: [],
  gens: [],
  types: [],
  shiny: false,
  ready: false,
  inTeam: false,
  sort: 'RARITY',
};

/** Nº de filtros activos (el orden no cuenta). */
export function activeFilterCount(f: BoxFilters): number {
  return (
    (f.query.trim() ? 1 : 0) +
    (f.stars.length ? 1 : 0) +
    (f.rarities.length ? 1 : 0) +
    (f.gens.length ? 1 : 0) +
    (f.types.length ? 1 : 0) +
    (f.shiny ? 1 : 0) +
    (f.ready ? 1 : 0) +
    (f.inTeam ? 1 : 0)
  );
}

/** Progreso hacia la siguiente estrella: 0..1, o -1 si está al máximo. */
function fragProgress(meta: MetaState, id: string): number {
  const cost = nextAwakenCost(meta, id);
  if (cost === null) return -1;
  return Math.min(1, meta.collection[id].fragments / cost);
}

const tier = (id: string): number => {
  const r = rarityOf(id);
  return r ? RARITY_TIER[r] : 0;
};

/** Filtra y ordena `ids` (ids base de la colección) según `f`. */
export function applyBoxFilters(ids: readonly string[], meta: MetaState, f: BoxFilters): string[] {
  const q = f.query.trim().toLowerCase();
  const out = ids.filter((id) => {
    const def = POKEDEX[id];
    const entry = meta.collection[id];
    if (!def || !entry) return false;
    if (q && !def.name.toLowerCase().includes(q) && !String(Number(id)).includes(q)) return false;
    if (f.stars.length && !f.stars.includes(entry.stars)) return false;
    if (f.rarities.length) {
      const r = rarityOf(id);
      if (!r || !f.rarities.includes(r)) return false;
    }
    if (f.gens.length && !f.gens.includes(def.generation)) return false;
    if (f.types.length && !def.types.some((t) => f.types.includes(t))) return false;
    if (f.shiny && !entry.shinyOwned) return false;
    if (f.ready && !canAwaken(meta, id)) return false;
    if (f.inTeam && !meta.loadout.includes(id)) return false;
    return true;
  });

  const byDex = (a: string, b: string): number => Number(a) - Number(b);
  const sorters: Record<BoxSort, (a: string, b: string) => number> = {
    RARITY: (a, b) => tier(b) - tier(a) || byDex(a, b),
    STARS: (a, b) => meta.collection[b].stars - meta.collection[a].stars || byDex(a, b),
    FRAGS: (a, b) => fragProgress(meta, b) - fragProgress(meta, a) || byDex(a, b),
    DEX: byDex,
    NAME: (a, b) => POKEDEX[a].name.localeCompare(POKEDEX[b].name, 'es'),
  };
  return out.sort(sorters[f.sort]);
}
