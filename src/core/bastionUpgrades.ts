/**
 * PokéBastion — bastion upgrade costs and effects.
 * PURE TYPESCRIPT: no DOM / browser imports.
 *
 * Purchases only bump the upgrade level (and bastion HP for UP_HP); the other
 * effects are read at use-time by the systems that own them:
 *   UP_ARROW / UP_CRIT / UP_CDMG -> damage.ts
 *   UP_SPD / UP_MULTI / UP_GOLD / UP_CLICK -> gameLoop.ts (via the helpers below)
 */

import type { BastionUpgradeId, BastionUpgrades, GameState } from './types';
import { ARENA } from '../config/arena.config';
import {
  AUTOCLICK_CPS_BY_LEVEL,
  AUTOCLICK_MAX_LEVEL,
  GOLD_PER_LEVEL,
  HP_PER_LEVEL,
  MULTI_MAX,
  SPD_PER_LEVEL,
  WALL_HP_PER_LEVEL,
  upgradeCost,
} from '../config/balance.config';

export { AUTOCLICK_CPS_BY_LEVEL, AUTOCLICK_MAX_LEVEL };

/** UP_CLICK: +10% click damage per level (PRD §4.1). */
export const CLICK_DAMAGE_PER_LEVEL = 0.1;

/** Cost of the NEXT level of an upgrade (0-based purchase). */
export function calculateUpgradeCost(upgradeId: BastionUpgradeId, currentLevel: number): number {
  if (upgradeId === 'UP_AUTOCLICK' && currentLevel >= AUTOCLICK_MAX_LEVEL) return Infinity;
  return upgradeCost(upgradeId, currentLevel);
}

/** UP_SPD: global attack-speed multiplier. */
export function attackSpeedMultiplier(upgrades: BastionUpgrades): number {
  return 1 + upgrades.UP_SPD * SPD_PER_LEVEL;
}

/** UP_GOLD: multiplier applied to gold dropped by enemies. */
export function goldMultiplier(upgrades: BastionUpgrades): number {
  return 1 + upgrades.UP_GOLD * GOLD_PER_LEVEL;
}

/** UP_MULTI: simultaneous shots / bounces, capped at MULTI_MAX. */
export function projectileCount(upgrades: BastionUpgrades): number {
  return Math.min(MULTI_MAX, 1 + upgrades.UP_MULTI);
}

/** UP_CLICK: multiplier applied to click damage. */
export function clickDamageMultiplier(upgrades: BastionUpgrades): number {
  return 1 + upgrades.UP_CLICK * CLICK_DAMAGE_PER_LEVEL;
}

/** UP_CLICK: click explosion radius in logical px. */
export function clickRadius(upgrades: BastionUpgrades): number {
  return ARENA.CLICK_RADIUS_BASE + upgrades.UP_CLICK * ARENA.CLICK_RADIUS_PER_LEVEL;
}

/**
 * Buy one level of an upgrade. UP_HP also raises max HP and follows with a
 * matching heal so the purchase is never wasted. Returns the same state when
 * the player cannot afford it.
 */
export function purchaseUpgrade(state: GameState, upgradeId: BastionUpgradeId): GameState {
  const level = state.bastionUpgrades[upgradeId] ?? 0;
  if (upgradeId === 'UP_AUTOCLICK' && level >= AUTOCLICK_MAX_LEVEL) return state;
  const cost = calculateUpgradeCost(upgradeId, level);
  if (state.gold < cost || !isFinite(cost)) return state;

  const bastionUpgrades: BastionUpgrades = { ...state.bastionUpgrades, [upgradeId]: level + 1 };
  let bastionMaxHp = state.bastionMaxHp;
  let bastionHp = state.bastionHp;
  if (upgradeId === 'UP_HP') {
    bastionMaxHp += HP_PER_LEVEL;
    bastionHp = Math.min(bastionMaxHp, bastionHp + HP_PER_LEVEL);
  } else if (upgradeId === 'UP_WALL') {
    const gain = Math.round(bastionMaxHp * WALL_HP_PER_LEVEL);
    bastionMaxHp += gain;
    bastionHp = Math.min(bastionMaxHp, bastionHp + gain);
  }

  return { ...state, gold: state.gold - cost, bastionUpgrades, bastionMaxHp, bastionHp };
}
