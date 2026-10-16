/**
 * PokéBastion — data-driven enemy definitions (PRD §9.1.2–9.1.3).
 * PURE TYPESCRIPT: no DOM / browser imports.
 */

import { PokemonType } from '../core/types';
import type { EnemyDefinition } from '../core/types';

const T = PokemonType;

export const ENEMY_DEFINITIONS: Readonly<Record<string, EnemyDefinition>> = Object.freeze({
  // Biome 1 — Ruta Verde (1–20)
  '0019': { id: '0019', name: 'Rattata', types: [T.Normal] },
  '0016': { id: '0016', name: 'Pidgey', types: [T.Normal, T.Flying] },
  '0010': { id: '0010', name: 'Caterpie', types: [T.Bug], hpFactor: 0.9 },
  '0013': { id: '0013', name: 'Weedle', types: [T.Bug, T.Poison], hpFactor: 0.9 },
  '0043': { id: '0043', name: 'Oddish', types: [T.Grass, T.Poison] },
  '0069': { id: '0069', name: 'Bellsprout', types: [T.Grass, T.Poison] },
  '0021': { id: '0021', name: 'Spearow', types: [T.Normal, T.Flying], speedFactor: 1.15 },
  '0127': { id: '0127', name: 'Pinsir', types: [T.Bug] },
  '0143': { id: '0143', name: 'Snorlax', types: [T.Normal], hpFactor: 1.25, speedFactor: 0.8 },

  // Biome 2 — Cueva Umbría (21–49) + Gran Boss 50
  '0041': { id: '0041', name: 'Zubat', types: [T.Poison, T.Flying], speedFactor: 1.15 },
  '0074': { id: '0074', name: 'Geodude', types: [T.Rock, T.Ground], hpFactor: 1.15, speedFactor: 0.85 },
  '0092': { id: '0092', name: 'Gastly', types: [T.Ghost, T.Poison], speedFactor: 1.1 },
  '0093': { id: '0093', name: 'Haunter', types: [T.Ghost, T.Poison], speedFactor: 1.1 },
  '0027': { id: '0027', name: 'Sandshrew', types: [T.Ground] },
  '0050': { id: '0050', name: 'Diglett', types: [T.Ground], hpFactor: 0.85, speedFactor: 1.2 },
  '0109': { id: '0109', name: 'Koffing', types: [T.Poison], hpFactor: 1.1 },
  '0095': { id: '0095', name: 'Onix', types: [T.Rock, T.Ground], hpFactor: 1.2, speedFactor: 0.85 },
  '0065': { id: '0065', name: 'Alakazam', types: [T.Psychic], speedFactor: 1.1 },
  '0094': { id: '0094', name: 'Gengar', types: [T.Ghost, T.Poison] },

  // Biome 3 — Monte Ígneo (51–79)
  '0058': { id: '0058', name: 'Growlithe', types: [T.Fire] },
  '0077': { id: '0077', name: 'Ponyta', types: [T.Fire], speedFactor: 1.15 },
  '0037': { id: '0037', name: 'Vulpix', types: [T.Fire] },
  '0126': { id: '0126', name: 'Magmar', types: [T.Fire], hpFactor: 1.1 },
  '0056': { id: '0056', name: 'Mankey', types: [T.Fighting], speedFactor: 1.1 },
  '0057': { id: '0057', name: 'Primeape', types: [T.Fighting], speedFactor: 1.15 },
  '0147': { id: '0147', name: 'Dratini', types: [T.Dragon] },
  '0059': { id: '0059', name: 'Arcanine', types: [T.Fire], speedFactor: 1.1 },
  '0149': { id: '0149', name: 'Dragonite', types: [T.Dragon, T.Flying], hpFactor: 1.2 },

  // Biome 4 — Costa y Ruinas (80–99) + Gran Boss 100
  '0054': { id: '0054', name: 'Psyduck', types: [T.Water] },
  '0090': { id: '0090', name: 'Shellder', types: [T.Water], hpFactor: 1.1 },
  '0120': { id: '0120', name: 'Staryu', types: [T.Water], speedFactor: 1.1 },
  '0072': { id: '0072', name: 'Tentacool', types: [T.Water, T.Poison] },
  '0081': { id: '0081', name: 'Magnemite', types: [T.Electric, T.Steel], hpFactor: 1.1 },
  '0100': { id: '0100', name: 'Voltorb', types: [T.Electric], speedFactor: 1.2 },
  '0079': { id: '0079', name: 'Slowpoke', types: [T.Water, T.Psychic], hpFactor: 1.2, speedFactor: 0.8 },
  '0130': { id: '0130', name: 'Gyarados', types: [T.Water, T.Flying], hpFactor: 1.15 },
  '0376': { id: '0376', name: 'Metagross', types: [T.Steel, T.Psychic], hpFactor: 1.25 },
  '0150': { id: '0150', name: 'Mewtwo', types: [T.Psychic] },

  // Loot runners (Phase 3C prep)
  '0052': { id: '0052', name: 'Meowth', types: [T.Normal], speedFactor: 1.35 },
  '0053': { id: '0053', name: 'Persian', types: [T.Normal], speedFactor: 1.45 },
});

export function getEnemyDef(id: string): EnemyDefinition {
  return ENEMY_DEFINITIONS[id] ?? ENEMY_DEFINITIONS['0019'];
}
