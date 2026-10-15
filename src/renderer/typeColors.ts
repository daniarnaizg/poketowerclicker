/**
 * PokéBastion — elemental type → color, shared by the arena renderer.
 * Keys use the PokemonType enum member names so the map stays exhaustive.
 */

import { PokemonType } from '../core/types';

export const TYPE_COLORS: Record<PokemonType, string> = {
  [PokemonType.Normal]: '#A8A878',
  [PokemonType.Fire]: '#F08030',
  [PokemonType.Water]: '#6890F0',
  [PokemonType.Grass]: '#78C850',
  [PokemonType.Electric]: '#F8D030',
  [PokemonType.Ice]: '#98D8D8',
  [PokemonType.Fighting]: '#C03028',
  [PokemonType.Poison]: '#A040A0',
  [PokemonType.Ground]: '#E0C068',
  [PokemonType.Flying]: '#A890F0',
  [PokemonType.Psychic]: '#F85888',
  [PokemonType.Bug]: '#A8B820',
  [PokemonType.Rock]: '#B8A038',
  [PokemonType.Ghost]: '#705898',
  [PokemonType.Dragon]: '#7038F8',
  [PokemonType.Dark]: '#705848',
  [PokemonType.Steel]: '#B8B8D0',
  [PokemonType.Fairy]: '#EE99AC',
};

/** Color of the entity's primary type. */
export function typeColor(type: PokemonType): string {
  return TYPE_COLORS[type];
}

/** 1–2 letter code shown inside entity circles ("FW" for Fire/Water). */
export function typeLetters(types: readonly PokemonType[]): string {
  return types.map((t) => String(t).charAt(0)).join('');
}
