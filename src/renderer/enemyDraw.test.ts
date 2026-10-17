import { describe, expect, it } from 'vitest';
import { ARENA } from '../config/arena.config';
import type { Enemy } from '../core/types';

const base = {
  id: 1, x: ARENA.CENTER, y: ARENA.CENTER + 24, hp: 10, maxHp: 10, alive: true, speed: 30,
  goldValue: 1, isBoss: false, definitionId: '0019', types: ['NORMAL'],
} as unknown as Enemy;

describe('enemyDrawPos', () => {
  it('un enemigo normal se dibuja donde está', async () => {
    const { enemyDrawPos } = await import('./arena');
    expect(enemyDrawPos(base)).toEqual({ x: base.x, y: base.y });
  });

  it('un jefe anclado se aparta hacia fuera del centro (solo visual)', async () => {
    const { enemyDrawPos } = await import('./arena');
    const boss = { ...base, isBoss: true, anchoredAtBastion: true } as Enemy;
    const p = enemyDrawPos(boss);
    expect(p.x).toBe(ARENA.CENTER);
    expect(p.y > boss.y).toBe(true); // más abajo = más lejos del centro
    expect(Math.round(Math.hypot(p.x - ARENA.CENTER, p.y - ARENA.CENTER))).toBe(ARENA.BASTION_DAMAGE_R + 14);
  });

  it('un jefe que aún camina no se mueve', async () => {
    const { enemyDrawPos } = await import('./arena');
    const boss = { ...base, isBoss: true, anchoredAtBastion: false } as Enemy;
    expect(enemyDrawPos(boss)).toEqual({ x: boss.x, y: boss.y });
  });
});
