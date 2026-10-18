import { describe, it, expect } from 'vitest';
import { mulberry32, deriveSeed, rngFor } from '../rng';

describe('RNG — Mulberry32 & deterministic channel separation (PRD §9.1.1)', () => {
  it('mulberry32 is deterministic and produces consistent floats in [0, 1)', () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);
    const seq1 = [rng1(), rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2(), rng2()];

    expect(seq1).toEqual(seq2);
    for (const val of seq1) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('deriveSeed produces distinct seeds across channels and floors', () => {
    const sWaveF1 = deriveSeed(42, 'WAVE', 1);
    const sWaveF2 = deriveSeed(42, 'WAVE', 2);
    const sCombatF1 = deriveSeed(42, 'COMBAT', 1);
    const sSpecialF1 = deriveSeed(42, 'SPECIAL', 1);

    expect(sWaveF1).not.toBe(sWaveF2);
    expect(sWaveF1).not.toBe(sCombatF1);
    expect(sCombatF1).not.toBe(sSpecialF1);
  });

  it('rngFor isolates channels: combat rolls do not perturb WAVE generation', () => {
    const seed = 999;
    const floor = 10;

    // Stream 1: Generate floor wave directly
    const waveRng1 = rngFor(seed, 'WAVE', floor);
    const waveSeq1 = [waveRng1(), waveRng1(), waveRng1()];

    // Stream 2: Do some combat and special rolls first
    const combatRng = rngFor(seed, 'COMBAT', floor);
    for (let i = 0; i < 50; i++) combatRng();

    const specialRng = rngFor(seed, 'SPECIAL', floor);
    for (let i = 0; i < 10; i++) specialRng();

    // Now generate floor wave
    const waveRng2 = rngFor(seed, 'WAVE', floor);
    const waveSeq2 = [waveRng2(), waveRng2(), waveRng2()];

    expect(waveSeq2).toEqual(waveSeq1);
  });

  it('salt = 0 preserves backward compatibility, and salts 1, 2, 3 produce distinct sequences', () => {
    const seed = 12345;
    const floor = 5;

    // salt = 0 preserves exact value without salt
    expect(deriveSeed(seed, 'WAVE', floor)).toBe(deriveSeed(seed, 'WAVE', floor, 0));

    const rngDefault = rngFor(seed, 'WAVE', floor);
    const rngSalt0 = rngFor(seed, 'WAVE', floor, 0);
    const seqDefault = [rngDefault(), rngDefault(), rngDefault()];
    const seqSalt0 = [rngSalt0(), rngSalt0(), rngSalt0()];
    expect(seqSalt0).toEqual(seqDefault);

    // salt = 1, 2, 3 produce distinct seeds and sequences
    const seed0 = deriveSeed(seed, 'WAVE', floor, 0);
    const seed1 = deriveSeed(seed, 'WAVE', floor, 1);
    const seed2 = deriveSeed(seed, 'WAVE', floor, 2);
    const seed3 = deriveSeed(seed, 'WAVE', floor, 3);

    const uniqueSeeds = new Set([seed0, seed1, seed2, seed3]);
    expect(uniqueSeeds.size).toBe(4);

    const r1 = rngFor(seed, 'WAVE', floor, 1);
    const r2 = rngFor(seed, 'WAVE', floor, 2);
    const r3 = rngFor(seed, 'WAVE', floor, 3);

    const seq1 = [r1(), r1(), r1()];
    const seq2 = [r2(), r2(), r2()];
    const seq3 = [r3(), r3(), r3()];

    expect(seq1).not.toEqual(seqDefault);
    expect(seq2).not.toEqual(seqDefault);
    expect(seq3).not.toEqual(seqDefault);
    expect(seq1).not.toEqual(seq2);
    expect(seq2).not.toEqual(seq3);
    expect(seq1).not.toEqual(seq3);
  });
});

