/**
 * PokéBastion — Atlas de efectos de combate (proyectiles e impactos por tipo elemental).
 *
 * Mapea cada uno de los 18 tipos elementales de Pokémon a su fila correspondiente
 * en las spritesheets maestras:
 *   - Proyectiles: 16×16 px × 4 frames (tira horizontal de 64 px de ancho)
 *   - Impactos:    32×32 px × 6 frames (tira horizontal de 192 px de ancho)
 */

export const TYPE_KEYS = [
  'normal',
  'fire',
  'water',
  'grass',
  'electric',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'steel',
  'dark',
  'fairy',
] as const;

export type TypeKey = (typeof TYPE_KEYS)[number];

export interface FxAtlas {
  projectiles: {
    w: number;
    h: number;
    frameW: number;
    frameH: number;
    frames: number;
    types: Record<TypeKey, { y: number; index: number }>;
  };
  impacts: {
    w: number;
    h: number;
    frameW: number;
    frameH: number;
    frames: number;
    types: Record<TypeKey, { y: number; index: number }>;
  };
}

export const FX_ATLAS: FxAtlas = {
  projectiles: {
    w: 64,
    h: TYPE_KEYS.length * 16,
    frameW: 16,
    frameH: 16,
    frames: 4,
    types: Object.fromEntries(
      TYPE_KEYS.map((t, i) => [t, { y: i * 16, index: i }]),
    ) as Record<TypeKey, { y: number; index: number }>,
  },
  impacts: {
    w: 192,
    h: TYPE_KEYS.length * 32,
    frameW: 32,
    frameH: 32,
    frames: 6,
    types: Object.fromEntries(
      TYPE_KEYS.map((t, i) => [t, { y: i * 32, index: i }]),
    ) as Record<TypeKey, { y: number; index: number }>,
  },
};
