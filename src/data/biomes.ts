/**
 * PokéBastion — biome definitions, floor routing & palettes (PRD §5.2, §9.1.3, §9.2.2).
 * PURE TYPESCRIPT: no DOM / browser imports.
 */

import { PokemonType } from '../core/types';
import type { BiomeDefinition, BiomeId } from '../core/types';

const T = PokemonType;

export const BIOMES: Readonly<Record<BiomeId, BiomeDefinition>> = Object.freeze({
  RUTA_VERDE: {
    id: 'RUTA_VERDE',
    name: 'Ruta Verde',
    floors: [1, 20],
    typeWeights: {
      [T.Normal]: 3,
      [T.Grass]: 2.5,
      [T.Flying]: 2,
      [T.Bug]: 2,
      [T.Poison]: 1.5,
    },
    wild: ['0019', '0016', '0010', '0013', '0043', '0069', '0021'],
    miniBosses: { 10: '0127', 20: '0143' },
    runners: ['0052'],
    palette: {
      groundA: '#78c850',
      groundB: '#68b840',
      accent: '#e8d8a0',
      pageBg: '#2858a8',
      pageGrid: '#ffffff10',
      frameAccent: '#68b840',
    },
  },
  CUEVA_UMBRIA: {
    id: 'CUEVA_UMBRIA',
    name: 'Cueva Umbría',
    floors: [21, 50],
    typeWeights: {
      [T.Ghost]: 3,
      [T.Rock]: 2.5,
      [T.Poison]: 2.5,
      [T.Ground]: 2.5,
      [T.Psychic]: 1.5,
    },
    wild: ['0041', '0074', '0092', '0093', '0027', '0050', '0109'],
    miniBosses: { 30: '0095', 40: '0065' },
    grandBosses: { 50: '0094' },
    runners: ['0052'],
    palette: {
      groundA: '#3a3550',
      groundB: '#2f2b45',
      accent: '#8a6fd0',
      pageBg: '#1e1a32',
      pageGrid: '#8a6fd018',
      frameAccent: '#8a6fd0',
    },
  },
  MONTE_IGNEO: {
    id: 'MONTE_IGNEO',
    name: 'Monte Ígneo',
    floors: [51, 79],
    typeWeights: {
      [T.Fire]: 3,
      [T.Fighting]: 2.5,
      [T.Dragon]: 2,
    },
    wild: ['0058', '0077', '0037', '0126', '0056', '0057', '0147'],
    miniBosses: { 60: '0059', 70: '0149' },
    runners: ['0053'],
    palette: {
      groundA: '#7a3b2a',
      groundB: '#5e2c20',
      accent: '#f08030',
      pageBg: '#3c1c16',
      pageGrid: '#f0803018',
      frameAccent: '#f08030',
    },
  },
  COSTA_RUINAS: {
    id: 'COSTA_RUINAS',
    name: 'Costa y Ruinas',
    floors: [80, 100],
    typeWeights: {
      [T.Water]: 3,
      [T.Electric]: 2.5,
      [T.Psychic]: 2,
      [T.Steel]: 2,
    },
    wild: ['0054', '0090', '0120', '0072', '0081', '0100', '0079'],
    miniBosses: { 80: '0130', 90: '0376' },
    grandBosses: { 100: '0150' },
    runners: ['0053'],
    palette: {
      groundA: '#d8c890',
      groundB: '#c8b880',
      accent: '#58a8d8',
      pageBg: '#1c3e5e',
      pageGrid: '#58a8d818',
      frameAccent: '#58a8d8',
    },
  },
});

export const BIOME_ORDER: readonly BiomeId[] = [
  'RUTA_VERDE',
  'CUEVA_UMBRIA',
  'MONTE_IGNEO',
  'COSTA_RUINAS',
] as const;

/**
 * Pure floor -> biome mapping (PRD §9.1.3).
 * Floors > 100 (Torre del Destino) cycle through 1..100.
 */
export function biomeAt(floor: number): BiomeDefinition {
  const f = Math.max(1, ((Math.floor(floor) - 1) % 100) + 1);
  if (f <= 20) return BIOMES.RUTA_VERDE;
  if (f <= 50) return BIOMES.CUEVA_UMBRIA;
  if (f <= 79) return BIOMES.MONTE_IGNEO;
  return BIOMES.COSTA_RUINAS;
}

export { buildBackdrop } from '../renderer/backdrop';
