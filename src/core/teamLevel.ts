/**
 * PokéBastion — unified Team Level progression (PRD §4.1).
 * PURE TYPESCRIPT: no DOM / browser imports.
 *
 * Gold buys a single shared level. Raising it may push team members past their
 * canonical evolution threshold, which transforms them (evolution.ts).
 */

import type { GameState, PlayerPokemon, PokemonDefinition, Team6, TeamSlot } from './types';
import {
  HP_BASE,
  HP_LEVEL_SCALE,
  LEVEL_STAT_SCALE,
  SOLO_STARTER_HP_MULT,
  hpFactorForBaseStat,
  teamLevelCost,
} from '../config/balance.config';
import { checkEvolution } from './evolution';
import { POKEDEX, POKEDEX as POKEMON_REGISTRY } from '../data/pokemon';
import { computeTeamBonuses } from './passives';

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

export function computePokemonMaxHp(
  def: PokemonDefinition,
  teamLevel: number,
  maxHpBonus = 0,
  isSoloTeam = false,
): number {
  const factor = hpFactorForBaseStat(def.baseStats.hp ?? 65);
  const levelMult = 1 + Math.max(0, teamLevel - 1) * HP_LEVEL_SCALE;
  const soloMult = isSoloTeam ? SOLO_STARTER_HP_MULT : 1;
  return Math.max(1, Math.floor(HP_BASE * factor * levelMult * (1 + maxHpBonus) * soloMult));
}

/**
 * Recomputes maxHp for every occupied slot in `team` given the current `teamLevel`
 * and active `MAX_HP` bench passives (from living Pokémon only), preserving each
 * living Pokémon's `hp / maxHp` ratio (no free healing, no death from cap change).
 * Fainted Pokémon (`!alive`) update their `maxHp` but remain at `hp = 0, alive = false`.
 */
export function reconcileTeamMaxHp(
  team: TeamSlot[],
  teamLevel: number,
  registry: Record<string, PokemonDefinition> = POKEMON_REGISTRY,
  fillFull = false,
): TeamSlot[] {
  const occupiedCount = team.filter((s) => s.pokemon !== null).length;
  const isSoloTeam = occupiedCount === 1;
  const bonuses = computeTeamBonuses(team);
  return team.map((slot) => {
    const pkm = slot.pokemon;
    if (!pkm) return slot;
    const def = registry[pkm.definitionId];
    if (!def) return slot;
    const nextMaxHp = computePokemonMaxHp(def, teamLevel, bonuses.maxHp, isSoloTeam);
    if (!pkm.alive) {
      return {
        ...slot,
        pokemon: { ...pkm, maxHp: nextMaxHp, hp: 0, alive: false },
      };
    }
    if (fillFull || pkm.maxHp <= 0) {
      return {
        ...slot,
        pokemon: { ...pkm, maxHp: nextMaxHp, hp: nextMaxHp, alive: true },
      };
    }
    const ratio = Math.min(1, Math.max(0, pkm.hp / pkm.maxHp));
    const nextHp = Math.min(nextMaxHp, Math.max(1, Math.round(ratio * nextMaxHp)));
    return {
      ...slot,
      pokemon: { ...pkm, maxHp: nextMaxHp, hp: nextHp, alive: true },
    };
  });
}

function evolveSlot(slot: TeamSlot, teamLevel: number): TeamSlot {
  const pokemon = slot.pokemon;
  if (!pokemon || !pokemon.alive) return slot;

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
  const evolvedTeam = state.team.map((slot) => evolveSlot(slot, teamLevel));
  const team = reconcileTeamMaxHp(evolvedTeam, teamLevel, POKEMON_REGISTRY, false) as Team6;
  return { ...state, gold: state.gold - cost, teamLevel, team };
}
