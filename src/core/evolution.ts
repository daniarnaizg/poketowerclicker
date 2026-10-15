/**
 * PokéBastion — canonical evolution checks (PRD §4.1).
 * PURE TYPESCRIPT: no DOM / browser imports.
 *
 * Rule: evolution happens when the unified Team Level reaches the species'
 * canonical level from the original games (e.g. Charmander -> Charmeleon at 16).
 * Duplicate gacha pulls NEVER advance evolution — only Team Level does.
 */

import type { PokemonDefinition } from './types';
import { POKEDEX } from '../data/pokemon';

export interface EvolutionResult {
  evolved: boolean;
  /** Species id to transform into, when evolved === true. */
  newDefinitionId?: string;
}

/** Structural param: anything carrying a definitionId (PlayerPokemon qualifies). */
export function checkEvolution(
  pokemon: { definitionId: string },
  teamLevel: number,
  pokedex: Readonly<Record<string, PokemonDefinition>> = POKEDEX,
): EvolutionResult {
  const def = pokedex[pokemon.definitionId];
  if (!def || !def.evolution) return { evolved: false };
  if (teamLevel >= def.evolution.canonicalLevel) {
    return { evolved: true, newDefinitionId: def.evolution.targetId };
  }
  return { evolved: false };
}

/**
 * Full chain starting from a species, e.g. getEvolutionChain('0004')
 * => ['0004', '0005', '0006']. Returns [startId] if no evolutions.
 */
export function getEvolutionChain(
  startId: string,
  pokedex: Readonly<Record<string, PokemonDefinition>> = POKEDEX,
): string[] {
  const chain: string[] = [startId];
  let current = pokedex[startId];
  // Guard against malformed cyclic data.
  const seen = new Set<string>([startId]);
  while (current?.evolution && !seen.has(current.evolution.targetId)) {
    seen.add(current.evolution.targetId);
    chain.push(current.evolution.targetId);
    current = pokedex[current.evolution.targetId];
  }
  return chain;
}
