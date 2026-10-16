/**
 * PokéBastion — gacha pools by rarity (PRD §3.1 table).
 *
 * Pools hold BASE-FORM ids only: a pull yields the base Pokémon, and the line
 * evolves during the run through the unified Team Level.
 *
 * "Iniciales" (★★) includes the three Kanto starters so the two you did not
 * pick are obtainable; their line is also what the starter modal offers.
 */

import type { Rarity } from '../core/types';

export const GACHA_POOLS: Readonly<Record<Rarity, readonly string[]>> = Object.freeze({
  COMMON: ['0010', '0016', '0019', '0025', '0092'], // Caterpie, Pidgey, Rattata, Pikachu, Gastly
  RARE: [
    '0447', // Riolu
    '0280', // Ralts
    '0328', // Trapinch
    '0240', // Magby
    '0304', // Aron
    '0001', '0004', '0007', // Kanto starters
    '0152', '0155', '0158', // Johto starters
    '0252', '0255', '0258', // Hoenn starters
  ],
  EPIC: ['0147', '0246', '0374', '0131', '0143'], // Dratini, Larvitar, Beldum, Lapras, Snorlax
  LEGENDARY: ['0144', '0145', '0146', '0150'], // Articuno, Zapdos, Moltres, Mewtwo
});

/** Rarity of a base-form species id, or undefined when it is not in any pool. */
export function rarityOf(baseId: string): Rarity | undefined {
  for (const r of Object.keys(GACHA_POOLS) as Rarity[]) {
    if (GACHA_POOLS[r].includes(baseId)) return r;
  }
  return undefined;
}

/** Every pullable base-form id (pool order: rarity asc). */
export const ALL_POOL_IDS: readonly string[] = Object.freeze(
  (['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as Rarity[]).flatMap((r) => GACHA_POOLS[r]),
);
