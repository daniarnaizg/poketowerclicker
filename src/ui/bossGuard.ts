/**
 * PokéBastion — boss guard rule: which boss floor forces 1x + AUTO off, once.
 * Pure (no Preact/DOM) so the one-shot rule is testable on its own.
 */

import { isBossFloor } from '../config/balance.config';

/**
 * Boss floor the guard should act on, or 0 when it should not fire.
 * Fires on entering a boss floor, or during the breather right before one;
 * `alreadyHandled` latches the floor so speed stays player-controlled afterwards.
 */
export function bossGuardTarget(
  floor: number,
  inBreak: boolean,
  enabled: boolean,
  alreadyHandled: number,
): number {
  if (!enabled) return 0;
  if (isBossFloor(floor) && alreadyHandled !== floor) return floor;
  if (inBreak && isBossFloor(floor + 1) && alreadyHandled !== floor + 1) return floor + 1;
  return 0;
}
