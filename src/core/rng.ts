/**
 * PokéBastion — deterministic channel-based RNG (PRD §9.1.1).
 * PURE TYPESCRIPT: no DOM / browser imports.
 *
 * Guarantees that player actions (clicks, crits, hot-swaps) on the COMBAT
 * stream never perturb WAVE or SPECIAL streams for any given (seed, floor).
 */

export type RngChannel = 'WAVE' | 'SPECIAL' | 'COMBAT';

const CHANNEL_SALT: Readonly<Record<RngChannel, number>> = {
  WAVE: 0x9e3779b9,
  SPECIAL: 0x85ebca6b,
  COMBAT: 0xc2b2ae35,
};

/** Standard Mulberry32 deterministic PRNG returning values in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix (seed, channel, floor, salt) into a well-dispersed 32-bit integer seed. */
export function deriveSeed(seed: number, channel: RngChannel, floor = 0, salt = 0): number {
  let h = (seed ^ CHANNEL_SALT[channel]) | 0;
  h = Math.imul(h ^ (floor * 0x27d4eb2d), 0x85ebca6b);
  if (salt !== 0) {
    h = Math.imul(h ^ Math.imul(salt | 0, 0x165667b1), 0x27d4eb2d);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Create an isolated deterministic PRNG stream for `(seed, channel, floor, salt)`.
 */
export function rngFor(seed: number, channel: RngChannel, floor = 0, salt = 0): () => number {
  return mulberry32(deriveSeed(seed, channel, floor, salt));
}

