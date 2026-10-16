/**
 * PokéBastion — Habilidades Definitivas (PRD §3.2), data-driven.
 *
 * `PokemonDefinition.ultimate.id` indexes this table. The core reads shape /
 * power / status from here, so adding a move never touches the game loop.
 *
 *   ARENA — hits every enemy on screen.
 *   NOVA  — burst around the bastion (`size` = radius).
 *   BEAM  — piercing line toward the nearest enemy (`size` = half-width).
 *
 * `power` multiplies PROJECTILE_BASE_DAMAGE (Phase 1 used a flat x10 ARENA).
 */

import type { UltimateDef } from '../core/types';

export interface UltimateEntry extends UltimateDef {
  /** Display name (Spanish, as shown in the HUD). */
  name: string;
}

/** Fallback for an unknown id: the Phase 1 behaviour (x10 on every enemy). */
export const DEFAULT_ULTIMATE: UltimateEntry = { name: 'Definitiva', shape: 'ARENA', power: 10 };

export const ULTIMATES: Readonly<Record<string, UltimateEntry>> = Object.freeze({
  // Fire
  flamethrower: { name: 'Llamarada', shape: 'BEAM', power: 13, size: 20, status: 'BURN' },
  fire_blast: { name: 'Llamarada', shape: 'ARENA', power: 10, status: 'BURN' },
  // Water
  water_gun: { name: 'Hidrobomba', shape: 'BEAM', power: 13, size: 20, status: 'SLOW' },
  hydro_pump: { name: 'Hidrobomba', shape: 'ARENA', power: 10, status: 'SLOW' },
  // Grass
  vine_whip: { name: 'Tormenta Floral', shape: 'NOVA', power: 12, size: 120, status: 'SLOW' },
  solar_beam: { name: 'Tormenta Floral', shape: 'BEAM', power: 16, size: 28 },
  // Electric
  thunderbolt: { name: 'Rayo', shape: 'BEAM', power: 13, size: 20, status: 'PARALYZE' },
  thunder: { name: 'Trueno', shape: 'ARENA', power: 10, status: 'PARALYZE' },
  // Ice
  blizzard: { name: 'Ventisca', shape: 'ARENA', power: 14, status: 'SLOW' },
  // Psychic / Ghost / Dark
  psychic: { name: 'Psíquico', shape: 'NOVA', power: 13, size: 130, status: 'PARALYZE' },
  psystrike: { name: 'Psicoataque', shape: 'ARENA', power: 20, status: 'PARALYZE' },
  shadow_ball: { name: 'Bola Sombra', shape: 'BEAM', power: 14, size: 22 },
  dark_pulse: { name: 'Pulso Umbrío', shape: 'NOVA', power: 14, size: 140 },
  // Fighting / Steel / Rock / Ground
  aura_sphere: { name: 'Esfera Aural', shape: 'BEAM', power: 15, size: 22 },
  flash_cannon: { name: 'Foco Resplandor', shape: 'BEAM', power: 14, size: 24 },
  rock_slide: { name: 'Avalancha', shape: 'ARENA', power: 10 },
  earthquake: { name: 'Terremoto', shape: 'ARENA', power: 10 },
  // Dragon / Flying / Normal / Bug
  dragon_pulse: { name: 'Pulso Dragón', shape: 'BEAM', power: 14, size: 24 },
  draco_meteor: { name: 'Cometa Draco', shape: 'ARENA', power: 14 },
  air_slash: { name: 'Tajo Aéreo', shape: 'NOVA', power: 12, size: 120 },
  hyper_beam: { name: 'Hiperrayo', shape: 'BEAM', power: 16, size: 28 },
  bug_buzz: { name: 'Zumbido', shape: 'NOVA', power: 12, size: 110 },
});

/** Entry for an ultimate id, falling back to the default behaviour. */
export function getUltimate(id: string): UltimateEntry {
  return ULTIMATES[id] ?? DEFAULT_ULTIMATE;
}
