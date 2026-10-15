// src/core/evolution.ts
import { STARTERS } from '../data/starters';
import type { PokemonDefinition } from './types';

const pokedex: Map<string, PokemonDefinition> = new Map();
for (const p of STARTERS) {
  pokedex.set(p.id, p);
}

export function getPokemonDef(id: string): PokemonDefinition | undefined {
  return pokedex.get(id);
}

export function getEvolvedId(currentId: string, teamLevel: number): string {
  let current = pokedex.get(currentId);
  if (!current) return currentId;

  let resultId = currentId;
  // Walk the evolution chain as far as level allows
  while (current?.evolution && teamLevel >= current.evolution.canonicalLevel) {
    resultId = current.evolution.targetId;
    current = pokedex.get(resultId);
  }
  return resultId;
}

export function getNextEvolutionLevel(currentId: string): number | null {
  const def = pokedex.get(currentId);
  return def?.evolution?.canonicalLevel ?? null;
}
