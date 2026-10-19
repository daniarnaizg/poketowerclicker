import { describe, expect, it } from 'vitest';
import { bossGuardTarget } from './bossGuard';

describe('bossGuardTarget', () => {
  it('never fires when the guard is disabled', () => {
    expect(bossGuardTarget(20, false, false, 0)).toBe(0);
    expect(bossGuardTarget(19, true, false, 0)).toBe(0);
  });

  it('fires on boss-floor entry with that floor', () => {
    expect(bossGuardTarget(10, false, true, 0)).toBe(10);
    expect(bossGuardTarget(20, false, true, 0)).toBe(20);
    expect(bossGuardTarget(50, false, true, 0)).toBe(50);
  });

  it('fires for the upcoming boss during the breather', () => {
    expect(bossGuardTarget(19, true, true, 0)).toBe(20);
    expect(bossGuardTarget(9, true, true, 0)).toBe(10);
  });

  it('does not fire for a non-boss floor outside the breather', () => {
    expect(bossGuardTarget(19, false, true, 0)).toBe(0);
  });

  it('does not fire twice for the same boss floor', () => {
    expect(bossGuardTarget(20, false, true, 20)).toBe(0);
    expect(bossGuardTarget(19, true, true, 20)).toBe(0);
  });

  it('ignores floors with no boss ahead', () => {
    expect(bossGuardTarget(11, true, true, 0)).toBe(0);
    expect(bossGuardTarget(1, true, true, 0)).toBe(0);
  });
});
