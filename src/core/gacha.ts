/**
 * PokéBastion — gacha rolls with pity (PRD §3.1 "Sistema Pity").
 * PURE TYPESCRIPT: no DOM / browser imports. All randomness is injected.
 *
 * Pity: a ★★★ (EPIC) or better is guaranteed every GACHA_PITY_EPIC pulls and a
 * ★★★★ (LEGENDARY) every GACHA_PITY_LEGENDARY pulls. Counters track pulls since
 * the last hit; the legendary guarantee wins when both trigger on the same pull.
 */

import { RARITIES } from './types';
import type { Rarity } from './types';
import {
  GACHA_PITY_EPIC,
  GACHA_PITY_LEGENDARY,
  GACHA_RATES,
} from '../config/balance.config';
import { GACHA_POOLS } from '../data/gachaPools';

export interface PityState {
  /** Pulls since the last EPIC-or-better. */
  sinceEpic: number;
  /** Pulls since the last LEGENDARY. */
  sinceLegendary: number;
}

export const INITIAL_PITY: Readonly<PityState> = Object.freeze({ sinceEpic: 0, sinceLegendary: 0 });

export interface PullResult {
  speciesId: string;
  rarity: Rarity;
  /** Set when the pity counter, not the dice, decided the rarity. */
  guaranteedBy?: 'EPIC' | 'LEGENDARY';
  /** Pity counters AFTER this pull. */
  pity: PityState;
}

/** Plain weighted roll over GACHA_RATES (no pity). */
export function rollRarity(rng: () => number): Rarity {
  const r = rng();
  let acc = 0;
  for (const rarity of RARITIES) {
    acc += GACHA_RATES[rarity];
    if (r < acc) return rarity;
  }
  return RARITIES[RARITIES.length - 1];
}

/** Uniform species within a rarity pool. */
export function pickFromPool(rarity: Rarity, rng: () => number): string {
  const pool = GACHA_POOLS[rarity];
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/** One pull: roll rarity, apply pity, pick a species, advance counters. */
export function pullOnce(pity: PityState, rng: () => number): PullResult {
  const sinceEpic = pity.sinceEpic + 1;
  const sinceLegendary = pity.sinceLegendary + 1;

  let rarity = rollRarity(rng);
  let guaranteedBy: PullResult['guaranteedBy'];
  if (sinceLegendary >= GACHA_PITY_LEGENDARY) {
    if (rarity !== 'LEGENDARY') guaranteedBy = 'LEGENDARY';
    rarity = 'LEGENDARY';
  } else if (sinceEpic >= GACHA_PITY_EPIC && (rarity === 'COMMON' || rarity === 'RARE')) {
    rarity = 'EPIC';
    guaranteedBy = 'EPIC';
  }

  const speciesId = pickFromPool(rarity, rng);
  const hitEpic = rarity === 'EPIC' || rarity === 'LEGENDARY';
  return {
    speciesId,
    rarity,
    guaranteedBy,
    pity: {
      sinceEpic: hitEpic ? 0 : sinceEpic,
      sinceLegendary: rarity === 'LEGENDARY' ? 0 : sinceLegendary,
    },
  };
}

/** Pulls remaining until each guarantee triggers (1 = the very next pull). */
export function pullsUntilGuarantee(pity: PityState): { epic: number; legendary: number } {
  return {
    epic: Math.max(1, GACHA_PITY_EPIC - pity.sinceEpic),
    legendary: Math.max(1, GACHA_PITY_LEGENDARY - pity.sinceLegendary),
  };
}
