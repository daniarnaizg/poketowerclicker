/**
 * PokéBastion — pure geometric helpers on logical arena coordinates.
 * No DOM / canvas dependencies.
 */

import { ARENA } from '../config/arena.config';

/** Euclidean distance between two logical points. */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** True when two circles overlap (strict overlap, touching is not a hit). */
export function circleCollision(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number,
): boolean {
  return distance(x1, y1, x2, y2) < r1 + r2;
}

/** True when a point lies outside the visible 384x384 arena. */
export function isOutOfBounds(x: number, y: number): boolean {
  return x < 0 || x > ARENA.SIZE || y < 0 || y > ARENA.SIZE;
}
