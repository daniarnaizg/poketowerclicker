/**
 * PokéBastion — bastion upgrade costs and effects.
 * PURE TYPESCRIPT: no DOM / browser imports.
 *
 * Purchases only bump the upgrade level (and bastion HP for UP_HP); the other
 * effects are read at use-time by the systems that own them:
 *   UP_ARROW / UP_CRIT / UP_CDMG -> damage.ts
 *   UP_SPD / UP_MULTI / UP_GOLD -> gameLoop.ts (via the helpers below)
 */

import type { BastionUpgradeId, BastionUpgrades, GameState } from './types';
import {
  AUTOCLICK_CPS_BY_LEVEL,
  AUTOCLICK_MAX_LEVEL,
  AUTO_SPD_BASE_MULT,
  BASTION_REGEN_FRACTION_PER_SEC,
  GOLD_PER_LEVEL,
  HP_PER_LEVEL,
  MULTI_MAX,
  MULTI_MAX_LEVEL,
  REGEN_PER_LEVEL,
  SPD_PER_LEVEL,
  upgradeCost,
  upgradeMaxLevel,
} from '../config/balance.config';

export {
  AUTOCLICK_CPS_BY_LEVEL,
  AUTOCLICK_MAX_LEVEL,
  MULTI_MAX_LEVEL,
  REGEN_PER_LEVEL,
  upgradeMaxLevel,
};

/** Cost of the NEXT level of an upgrade (0-based purchase). */
export function calculateUpgradeCost(upgradeId: BastionUpgradeId, currentLevel: number): number {
  const max = upgradeMaxLevel(upgradeId);
  if (max !== undefined && currentLevel >= max) return Infinity;
  return upgradeCost(upgradeId, currentLevel);
}

/** UP_SPD: global attack-speed multiplier (starts at AUTO_SPD_BASE_MULT with 0 upgrades). */
export function attackSpeedMultiplier(upgrades: BastionUpgrades): number {
  return AUTO_SPD_BASE_MULT + (upgrades.UP_SPD ?? 0) * SPD_PER_LEVEL;
}

/** UP_WALL (Regeneración): passive bastion HP regen rate per second as fraction of max HP. */
export function bastionRegenRate(upgrades: BastionUpgrades): number {
  return BASTION_REGEN_FRACTION_PER_SEC + (upgrades.UP_WALL ?? 0) * REGEN_PER_LEVEL;
}

/** UP_GOLD: multiplier applied to gold dropped by enemies. */
export function goldMultiplier(upgrades: BastionUpgrades): number {
  return 1 + upgrades.UP_GOLD * GOLD_PER_LEVEL;
}

/** UP_MULTI: simultaneous shots / bounces, capped at MULTI_MAX. */
export function projectileCount(upgrades: BastionUpgrades): number {
  return Math.min(MULTI_MAX, 1 + upgrades.UP_MULTI);
}

/**
 * Buy one level of an upgrade. UP_HP also raises max HP and follows with a
 * matching heal so the purchase is never wasted. Returns the same state when
 * the player cannot afford it.
 */
export function purchaseUpgrade(state: GameState, upgradeId: BastionUpgradeId): GameState {
  const level = state.bastionUpgrades[upgradeId] ?? 0;
  const max = upgradeMaxLevel(upgradeId);
  if (max !== undefined && level >= max) return state;
  const cost = calculateUpgradeCost(upgradeId, level);
  if (state.gold < cost || !isFinite(cost)) return state;

  const bastionUpgrades: BastionUpgrades = { ...state.bastionUpgrades, [upgradeId]: level + 1 };
  let bastionMaxHp = state.bastionMaxHp;
  let bastionHp = state.bastionHp;
  if (upgradeId === 'UP_HP') {
    bastionMaxHp += HP_PER_LEVEL;
    bastionHp = Math.min(bastionMaxHp, bastionHp + HP_PER_LEVEL);
  }

  return { ...state, gold: state.gold - cost, bastionUpgrades, bastionMaxHp, bastionHp };
}
