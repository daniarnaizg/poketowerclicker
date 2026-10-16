/**
 * PokéBastion — species data. The 3 starter lines (9 species) are written out
 * in full below; the Phase 2 gacha roster lives in roster.ts and is merged in.
 * Data-driven (PRD §7.1); later phases ingest the full pokedex.json.
 */

import type { PokemonDefinition } from '../core/types';
import { PokemonType, AttackPattern } from '../core/types';
import { ROSTER } from './roster';

export const POKEDEX: Readonly<Record<string, PokemonDefinition>> = Object.freeze({
  // --- Charmander line (Fire, canonical 16 / 36) ---
  '0004': {
    id: '0004', name: 'Charmander', generation: 1,
    types: [PokemonType.Fire],
    baseStats: { atk: 12, spd: 1.0, critRate: 0.05, critDmg: 1.5 },
    pattern: AttackPattern.SNIPER,
    evolution: { targetId: '0005', canonicalLevel: 16 },
    ultimate: { id: 'flamethrower', name: 'Llamarada', cooldownSec: 30 },
    benchPassive: { stat: 'FIRE_DAMAGE', value: 0.08 },
  },
  '0005': {
    id: '0005', name: 'Charmeleon', generation: 1,
    types: [PokemonType.Fire],
    baseStats: { atk: 20, spd: 1.05, critRate: 0.06, critDmg: 1.55 },
    pattern: AttackPattern.SNIPER,
    evolution: { targetId: '0006', canonicalLevel: 36 },
    ultimate: { id: 'flamethrower', name: 'Llamarada', cooldownSec: 26 },
    benchPassive: { stat: 'FIRE_DAMAGE', value: 0.12 },
  },
  '0006': {
    id: '0006', name: 'Charizard', generation: 1,
    types: [PokemonType.Fire, PokemonType.Flying],
    baseStats: { atk: 32, spd: 0.9, critRate: 0.07, critDmg: 1.6 },
    pattern: AttackPattern.AOE,
    ultimate: { id: 'fire_blast', name: 'Llamarada', cooldownSec: 22 },
    benchPassive: { stat: 'FIRE_DAMAGE', value: 0.16 },
  },

  // --- Squirtle line (Water, canonical 16 / 36) ---
  '0007': {
    id: '0007', name: 'Squirtle', generation: 1,
    types: [PokemonType.Water],
    baseStats: { atk: 11, spd: 1.0, critRate: 0.05, critDmg: 1.5 },
    pattern: AttackPattern.SNIPER,
    evolution: { targetId: '0008', canonicalLevel: 16 },
    ultimate: { id: 'water_gun', name: 'Hidrobomba', cooldownSec: 30 },
    benchPassive: { stat: 'WATER_DAMAGE', value: 0.08 },
  },
  '0008': {
    id: '0008', name: 'Wartortle', generation: 1,
    types: [PokemonType.Water],
    baseStats: { atk: 18, spd: 1.05, critRate: 0.06, critDmg: 1.55 },
    pattern: AttackPattern.SNIPER,
    evolution: { targetId: '0009', canonicalLevel: 36 },
    ultimate: { id: 'water_gun', name: 'Hidrobomba', cooldownSec: 26 },
    benchPassive: { stat: 'WATER_DAMAGE', value: 0.12 },
  },
  '0009': {
    id: '0009', name: 'Blastoise', generation: 1,
    types: [PokemonType.Water],
    baseStats: { atk: 30, spd: 0.85, critRate: 0.06, critDmg: 1.6 },
    pattern: AttackPattern.AOE,
    ultimate: { id: 'hydro_pump', name: 'Hidrobomba', cooldownSec: 22 },
    benchPassive: { stat: 'WATER_DAMAGE', value: 0.16 },
  },

  // --- Bulbasaur line (Grass/Poison, canonical 16 / 36) ---
  '0001': {
    id: '0001', name: 'Bulbasaur', generation: 1,
    types: [PokemonType.Grass, PokemonType.Poison],
    baseStats: { atk: 10, spd: 0.9, critRate: 0.05, critDmg: 1.5 },
    pattern: AttackPattern.PULSE,
    evolution: { targetId: '0002', canonicalLevel: 16 },
    ultimate: { id: 'vine_whip', name: 'Tormenta Floral', cooldownSec: 30 },
    benchPassive: { stat: 'GRASS_DAMAGE', value: 0.08 },
  },
  '0002': {
    id: '0002', name: 'Ivysaur', generation: 1,
    types: [PokemonType.Grass, PokemonType.Poison],
    baseStats: { atk: 17, spd: 0.95, critRate: 0.06, critDmg: 1.55 },
    pattern: AttackPattern.PULSE,
    evolution: { targetId: '0003', canonicalLevel: 36 },
    ultimate: { id: 'vine_whip', name: 'Tormenta Floral', cooldownSec: 26 },
    benchPassive: { stat: 'GRASS_DAMAGE', value: 0.12 },
  },
  '0003': {
    id: '0003', name: 'Venusaur', generation: 1,
    types: [PokemonType.Grass, PokemonType.Poison],
    baseStats: { atk: 28, spd: 0.8, critRate: 0.06, critDmg: 1.6 },
    pattern: AttackPattern.AOE,
    ultimate: { id: 'solar_beam', name: 'Tormenta Floral', cooldownSec: 22 },
    benchPassive: { stat: 'GRASS_DAMAGE', value: 0.16 },
  },

  // --- Phase 2 gacha roster (see roster.ts) ---
  ...ROSTER,
});
