// src/core/wave.ts
import { BALANCE } from '../config/balance.config';
import type { Entity } from './types';
import { spawnAngle, spawnPosition } from './movement';

let nextEntityId = 10000;

// Simple enemy pokemon pool by biome
const ENEMY_POOL = [
  { id: 'enemy_pidgey', name: 'Pidgey', types: ['NORMAL' as const, 'FLYING' as const] },
  { id: 'enemy_rattata', name: 'Rattata', types: ['NORMAL' as const] },
  { id: 'enemy_caterpie', name: 'Caterpie', types: ['BUG' as const] },
  { id: 'enemy_weedle', name: 'Weedle', types: ['BUG' as const, 'POISON' as const] },
  { id: 'enemy_zubat', name: 'Zubat', types: ['POISON' as const, 'FLYING' as const] },
  { id: 'enemy_geodude', name: 'Geodude', types: ['ROCK' as const, 'GROUND' as const] },
  { id: 'enemy_gastly', name: 'Gastly', types: ['GHOST' as const, 'POISON' as const] },
  { id: 'enemy_magikarp', name: 'Magikarp', types: ['WATER' as const] },
];

export function isBossFloor(floor: number): boolean {
  return BALANCE.BOSS_FLOORS.includes(floor);
}

export function isMiniBossFloor(floor: number): boolean {
  return floor % BALANCE.MINI_BOSS_EVERY === 0 && !isBossFloor(floor);
}

export function getWaveDuration(floor: number): number {
  return BALANCE.BASE_WAVE_DURATION_SEC;
}

export function scaleEnemyStats(
  baseHp: number,
  baseAtk: number,
  floor: number
): { hp: number; atk: number } {
  const scale = 1 + (floor - 1) * 0.12;
  return {
    hp: Math.floor(baseHp * scale),
    atk: Math.floor(baseAtk * scale),
  };
}

export function spawnWaveEnemies(floor: number): Entity[] {
  const enemies: Entity[] = [];
  const count = BALANCE.ENEMIES_PER_WAVE + Math.floor(floor / 5);

  for (let i = 0; i < count; i++) {
    const template = ENEMY_POOL[Math.floor(Math.random() * ENEMY_POOL.length)];
    const angle = spawnAngle();
    const pos = spawnPosition(angle);
    const stats = scaleEnemyStats(15 + floor * 2, 3 + floor * 0.5, floor);

    enemies.push({
      id: nextEntityId++,
      pokemonId: template.id,
      x: pos.x,
      y: pos.y,
      hp: stats.hp,
      maxHp: stats.hp,
      speed: 8 + Math.random() * 4, // 8-12 px/sec
      types: [...template.types],
      atk: stats.atk,
      spd: 1,
      critRate: 0,
      critDmg: 1,
      angle,
      isBoss: false,
      isMiniBoss: false,
    });
  }
  return enemies;
}

export function spawnMiniBoss(floor: number): Entity {
  const angle = spawnAngle();
  const pos = spawnPosition(angle);
  const stats = scaleEnemyStats(100 + floor * 10, 8 + floor * 2, floor);

  return {
    id: nextEntityId++,
    pokemonId: 'enemy_miniboss',
    x: pos.x,
    y: pos.y,
    hp: stats.hp * 3,
    maxHp: stats.hp * 3,
    speed: 5,
    types: ['ROCK'],
    atk: stats.atk * 2,
    spd: 0.5,
    critRate: 0.05,
    critDmg: 1.5,
    angle,
    isBoss: false,
    isMiniBoss: true,
    bossTimerSec: BALANCE.BOSS_TIMER_SEC,
  };
}

export function spawnBoss(floor: number): Entity {
  const angle = spawnAngle();
  const pos = spawnPosition(angle);
  const stats = scaleEnemyStats(200 + floor * 20, 15 + floor * 3, floor);

  return {
    id: nextEntityId++,
    pokemonId: 'enemy_boss',
    x: pos.x,
    y: pos.y,
    hp: stats.hp * BALANCE.BOSS_HP_MULTIPLIER,
    maxHp: stats.hp * BALANCE.BOSS_HP_MULTIPLIER,
    speed: 3,
    types: ['DRAGON'],
    atk: stats.atk * 3,
    spd: 0.3,
    critRate: 0.1,
    critDmg: 2.0,
    angle,
    isBoss: true,
    isMiniBoss: false,
    bossTimerSec: BALANCE.BOSS_TIMER_SEC,
  };
}

export function calculateRuna(floor: number): number {
  return Math.floor(Math.pow(floor / 5, 1.5));
}
