// src/core/movement.ts
import { BALANCE } from '../config/balance.config';

export function spawnAngle(): number {
  return Math.random() * Math.PI * 2;
}

export function spawnPosition(angle: number): { x: number; y: number } {
  const { ARENA_SIZE, CENTER } = BALANCE;
  const half = ARENA_SIZE / 2;
  // Spawn on square perimeter, not circular
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scale = Math.max(Math.abs(cos), Math.abs(sin));
  return {
    x: CENTER + (cos / scale) * half,
    y: CENTER + (sin / scale) * half,
  };
}

export function moveTowardsCenter(
  x: number,
  y: number,
  angle: number,
  speed: number,
  dt: number
): { x: number; y: number } {
  // Move from spawn toward center (72,72)
  const dx = BALANCE.CENTER - x;
  const dy = BALANCE.CENTER - y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return { x: BALANCE.CENTER, y: BALANCE.CENTER };

  const nx = dx / dist;
  const ny = dy / dist;
  return {
    x: x + nx * speed * dt,
    y: y + ny * speed * dt,
  };
}

export function distanceToCenter(x: number, y: number): number {
  const dx = BALANCE.CENTER - x;
  const dy = BALANCE.CENTER - y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceBetween(
  x1: number, y1: number, x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}
