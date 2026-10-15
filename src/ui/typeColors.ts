/**
 * PokéBastion — PokémonType → paleta UI (colores + etiqueta en español).
 * TYPE_COLORS: color "vivo" para bordes/sprites. TYPE_CHIP: variante oscura
 * con contraste suficiente para texto blanco en las etiquetas de tipo.
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

export const TYPE_CHIP: Record<PokemonType, string> = {
  [PokemonType.Normal]: '#787850',
  [PokemonType.Fire]: '#c06018',
  [PokemonType.Water]: '#4868c0',
  [PokemonType.Grass]: '#488830',
  [PokemonType.Electric]: '#a08000',
  [PokemonType.Ice]: '#488888',
  [PokemonType.Fighting]: '#a02018',
  [PokemonType.Poison]: '#803080',
  [PokemonType.Ground]: '#907028',
  [PokemonType.Flying]: '#6850c0',
  [PokemonType.Psychic]: '#c02860',
  [PokemonType.Bug]: '#788800',
  [PokemonType.Rock]: '#887018',
  [PokemonType.Ghost]: '#584078',
  [PokemonType.Dragon]: '#5028c8',
  [PokemonType.Dark]: '#504038',
  [PokemonType.Steel]: '#686880',
  [PokemonType.Fairy]: '#b05878',
};

export const TYPE_LABEL_ES: Record<PokemonType, string> = {
  [PokemonType.Normal]: 'NORMAL',
  [PokemonType.Fire]: 'FUEGO',
  [PokemonType.Water]: 'AGUA',
  [PokemonType.Grass]: 'PLANTA',
  [PokemonType.Electric]: 'ELÉCTR.',
  [PokemonType.Ice]: 'HIELO',
  [PokemonType.Fighting]: 'LUCHA',
  [PokemonType.Poison]: 'VENENO',
  [PokemonType.Ground]: 'TIERRA',
  [PokemonType.Flying]: 'VOLADOR',
  [PokemonType.Psychic]: 'PSÍQ.',
  [PokemonType.Bug]: 'BICHO',
  [PokemonType.Rock]: 'ROCA',
  [PokemonType.Ghost]: 'FANT.',
  [PokemonType.Dragon]: 'DRAGÓN',
  [PokemonType.Dark]: 'SINIES.',
  [PokemonType.Steel]: 'ACERO',
  [PokemonType.Fairy]: 'HADA',
};
