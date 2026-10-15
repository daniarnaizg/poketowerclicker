/**
 * PokéBastion — arena geometry (384x384 logical px, user override of PRD 144).
 * Renderer scales this space via CSS aspect-ratio 1:1; core math stays logical.
 */

import { ARENA_SIZE, ARENA_CENTER } from './balance.config';

export const ARENA = Object.freeze({
  /** Logical width/height in px. */
  SIZE: ARENA_SIZE, // 384
  /** Center point — active Pokémon position. */
  CENTER: ARENA_CENTER, // 192
  /**
   * Enemies spawn on the square perimeter. SPAWN_MARGIN pushes them just
   * outside the visible edge so they walk in instead of popping.
   */
  SPAWN_MARGIN: 16,
  /** Spawn distance from center along an axis (half-size + margin = 208). */
  SPAWN_HALF_EXTENT: ARENA_SIZE / 2 + 16,
  /** Radial hitbox radii, logical px. */
  PLAYER_HITBOX_R: 16,
  ENEMY_HITBOX_R: 12,
  BOSS_HITBOX_R: 24,
  PROJECTILE_R: 4,
  /** Enemy reaching this distance from center deals contact damage to bastion. */
  BASTION_DAMAGE_R: 24,
  /** Click explosion base radius (grows with UP_CLICK). */
  CLICK_RADIUS_BASE: 32,
  CLICK_RADIUS_PER_LEVEL: 4,
});
