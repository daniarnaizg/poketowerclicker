/**
 * PokéBastion — unified Team Level progression (PRD §4.1).
 * PURE TYPESCRIPT: no DOM / browser imports.
 *
 * Gold buys a single shared level. Raising it may push team members past their
 * canonical evolution threshold, which transforms them (evolution.ts).
 */

import type { GameState, PlayerPokemon, Team6, TeamSlot } from './types';
import { LEVEL_STAT_SCALE, teamLevelCost } from '../config/balance.config';
import { checkEvolution } from './evolution';
import { POKEDEX } from '../data/pokemon';

/** Cost of the NEXT Team Level, given the current level. */
export function calculateTeamLevelUpgradeCost(currentLevel: number): number {
  return teamLevelCost(currentLevel);
}

/**
 * Multiplier applied to every Pokémon stat at a given Team Level.
 * Matches the `levelScale` used by calculateDamage so displayed and simulated
 * stats never diverge.
 */
export function getStatMultiplier(teamLevel: number): number {
  return 1 + (teamLevel - 1) * LEVEL_STAT_SCALE;
}

function evolveSlot(slot: TeamSlot, teamLevel: number): TeamSlot {
  const pokemon = slot.pokemon;
  if (!pokemon) return slot;

  const result = checkEvolution(pokemon, teamLevel);
  if (!result.evolved || !result.newDefinitionId) return slot;

  const def = POKEDEX[result.newDefinitionId];
  if (!def) return slot;

  const evolved: PlayerPokemon = {
    ...pokemon,
    definitionId: def.id,
    types: def.types,
    atk: def.baseStats.atk,
    spd: def.baseStats.spd,
    critRate: def.baseStats.critRate,
    critDmg: def.baseStats.critDmg,
    pattern: def.pattern,
    ultimateEnergy: Math.min(pokemon.ultimateEnergy, def.ultimate.cooldownSec),
    ultimateMax: def.ultimate.cooldownSec,
    evolutionStage: pokemon.evolutionStage + 1,
  };
  return { ...slot, pokemon: evolved };
}

/**
 * Spend gold to raise the shared Team Level by one and evolve any team member
 * that crosses its canonical threshold. Returns the same state when the player
 * cannot afford the upgrade.
 */
export function upgradeTeamLevel(state: GameState): GameState {
  const cost = calculateTeamLevelUpgradeCost(state.teamLevel);
  if (state.gold < cost) return state;

  const teamLevel = state.teamLevel + 1;
  const team = state.team.map((slot) => evolveSlot(slot, teamLevel)) as Team6;
  return { ...state, gold: state.gold - cost, teamLevel, team };
}
