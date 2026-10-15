import { describe, expect, it } from 'vitest';
import { circleCollision, distance, isOutOfBounds } from './collisionDetection';
import { ARENA } from '../config/arena.config';

describe('distance', () => {
  it('returns euclidean distance', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
  });
});

describe('circleCollision', () => {
  it('detects overlap', () => {
    expect(circleCollision(0, 0, 10, 15, 0, 10)).toBe(true);
  });

  it('treats exact touching as no collision', () => {
    expect(circleCollision(0, 0, 5, 10, 0, 5)).toBe(false);
  });

  it('detects separated circles', () => {
    expect(circleCollision(0, 0, 5, 100, 100, 5)).toBe(false);
  });
});

describe('isOutOfBounds', () => {
  it('accepts points inside the arena', () => {
    expect(isOutOfBounds(0, 0)).toBe(false);
    expect(isOutOfBounds(ARENA.SIZE, ARENA.SIZE)).toBe(false);
  });

  it('rejects points past the edges', () => {
    expect(isOutOfBounds(-1, 10)).toBe(true);
    expect(isOutOfBounds(10, ARENA.SIZE + 1)).toBe(true);
  });
});
