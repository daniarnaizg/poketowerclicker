/** PokéBastion — rarity presentation (PRD §3.1 table). */
import type { Rarity } from '../core/types';

export const RARITY_LABEL: Record<Rarity, string> = {
  COMMON: 'COMÚN',
  RARE: 'RARO',
  EPIC: 'ÉPICO',
  LEGENDARY: 'LEGENDARIO',
};

/** Rarity tier = number of ★ in the PRD table (COMMON ★ … LEGENDARY ★★★★). */
export const RARITY_TIER: Record<Rarity, number> = { COMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4 };

export const RARITY_COLOR: Record<Rarity, string> = {
  COMMON: '#787850',
  RARE: '#4868c0',
  EPIC: '#803080',
  LEGENDARY: '#c08800',
};
