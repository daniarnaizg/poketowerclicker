/**
 * PokéBastion — shared PokémonType → hex palette for UI accents.
 * Kept UI-side (core stays DOM/CSS-free); components tint circles and borders.
 */

import { PokemonType } from '../core/types';

export const TYPE_COLORS: Record<PokemonType, string> = {
  [PokemonType.Normal]: '#a8a878',
  [PokemonType.Fire]: '#f08030',
  [PokemonType.Water]: '#6890f0',
  [PokemonType.Grass]: '#78c850',
  [PokemonType.Electric]: '#f8d030',
  [PokemonType.Ice]: '#98d8d8',
  [PokemonType.Fighting]: '#c03028',
  [PokemonType.Poison]: '#a040a0',
  [PokemonType.Ground]: '#e0c068',
  [PokemonType.Flying]: '#a890f0',
  [PokemonType.Psychic]: '#f85888',
  [PokemonType.Bug]: '#a8b820',
  [PokemonType.Rock]: '#b8a038',
  [PokemonType.Ghost]: '#705898',
  [PokemonType.Dragon]: '#7038f8',
  [PokemonType.Dark]: '#705848',
  [PokemonType.Steel]: '#b8b8d0',
  [PokemonType.Fairy]: '#ee99ac',
};
