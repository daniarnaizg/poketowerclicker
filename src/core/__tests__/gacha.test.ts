import { describe, it, expect } from 'vitest';
import { INITIAL_PITY, pullOnce, pullsUntilGuarantee, rollRarity } from '../gacha';
import type { PityState } from '../gacha';
import {
  GACHA_PITY_EPIC,
  GACHA_PITY_LEGENDARY,
  GACHA_RATES,
} from '../../config/balance.config';
import { GACHA_POOLS } from '../../data/gachaPools';
import { RARITIES } from '../types';
import type { Rarity } from '../types';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('gacha rates', () => {
  it('rates sum to 1', () => {
    const sum = RARITIES.reduce((s, r) => s + GACHA_RATES[r], 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('raw rarity roll matches the PRD table (60/30/8/2) over 100k rolls', () => {
    const rng = mulberry32(1234);
    const n = 100_000;
    const counts: Record<Rarity, number> = { COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0 };
    for (let i = 0; i < n; i++) counts[rollRarity(rng)]++;
    expect(Math.abs(counts.COMMON / n - 0.6)).toBeLessThan(0.01);
    expect(Math.abs(counts.RARE / n - 0.3)).toBeLessThan(0.01);
    expect(Math.abs(counts.EPIC / n - 0.08)).toBeLessThan(0.005);
    expect(Math.abs(counts.LEGENDARY / n - 0.02)).toBeLessThan(0.004);
  });

  it('always returns a species from the rolled rarity pool', () => {
    const rng = mulberry32(7);
    let pity: PityState = { ...INITIAL_PITY };
    for (let i = 0; i < 500; i++) {
      const r = pullOnce(pity, rng);
      pity = r.pity;
      expect(GACHA_POOLS[r.rarity].includes(r.speciesId)).toBe(true);
    }
  });
});

describe('gacha pity', () => {
  // rng that always rolls COMMON (0.0 < 0.6) and picks pool[0].
  const alwaysCommon = () => 0;

  it('guarantees an EPIC on the 30th pull when every roll would be COMMON', () => {
    let pity: PityState = { ...INITIAL_PITY };
    for (let i = 1; i < GACHA_PITY_EPIC; i++) {
      const r = pullOnce(pity, alwaysCommon);
      expect(r.rarity).toBe('COMMON');
      pity = r.pity;
    }
    const r = pullOnce(pity, alwaysCommon);
    expect(r.rarity).toBe('EPIC');
    expect(r.guaranteedBy).toBe('EPIC');
    expect(r.pity.sinceEpic).toBe(0);
    expect(r.pity.sinceLegendary).toBe(GACHA_PITY_EPIC);
  });

  it('guarantees a LEGENDARY on the 80th pull (and it beats the epic pity)', () => {
    let pity: PityState = { ...INITIAL_PITY };
    let legendaryAt = -1;
    for (let i = 1; i <= GACHA_PITY_LEGENDARY; i++) {
      const r = pullOnce(pity, alwaysCommon);
      pity = r.pity;
      if (r.rarity === 'LEGENDARY') { legendaryAt = i; break; }
    }
    expect(legendaryAt).toBe(GACHA_PITY_LEGENDARY);
    expect(pity.sinceEpic).toBe(0);
    expect(pity.sinceLegendary).toBe(0);
  });

  it('resets only the epic counter on a natural EPIC, only on LEGENDARY for the other', () => {
    // 0.9 -> EPIC band (0.9..0.98); then species pick uses the same value.
    const r = pullOnce({ sinceEpic: 10, sinceLegendary: 10 }, () => 0.95);
    expect(r.rarity).toBe('EPIC');
    expect(r.guaranteedBy).toBeUndefined();
    expect(r.pity).toEqual({ sinceEpic: 0, sinceLegendary: 11 });
  });

  it('never exceeds 80 pulls without a legendary or 30 without an epic+ over 20k pulls', () => {
    const rng = mulberry32(99);
    let pity: PityState = { ...INITIAL_PITY };
    let maxEpicGap = 0;
    let maxLegGap = 0;
    for (let i = 0; i < 20_000; i++) {
      const r = pullOnce(pity, rng);
      pity = r.pity;
      maxEpicGap = Math.max(maxEpicGap, pity.sinceEpic);
      maxLegGap = Math.max(maxLegGap, pity.sinceLegendary);
    }
    expect(maxEpicGap).toBeLessThan(GACHA_PITY_EPIC);
    expect(maxLegGap).toBeLessThan(GACHA_PITY_LEGENDARY);
  });

  it('reports pulls until each guarantee', () => {
    expect(pullsUntilGuarantee({ sinceEpic: 0, sinceLegendary: 0 })).toEqual({ epic: 30, legendary: 80 });
    expect(pullsUntilGuarantee({ sinceEpic: 29, sinceLegendary: 79 })).toEqual({ epic: 1, legendary: 1 });
  });

  it('is deterministic for a given seed', () => {
    const run = (seed: number) => {
      const rng = mulberry32(seed);
      let pity: PityState = { ...INITIAL_PITY };
      const out: string[] = [];
      for (let i = 0; i < 50; i++) { const r = pullOnce(pity, rng); pity = r.pity; out.push(r.speciesId); }
      return out.join(',');
    };
    expect(run(5)).toBe(run(5));
  });
});
