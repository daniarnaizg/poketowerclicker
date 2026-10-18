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

describe('shouldRenderEnemyHpBar', () => {
  it('enemigo sano lejos no muestra barra de HP', async () => {
    const { shouldRenderEnemyHpBar } = await import('./arena');
    const farHealthy = { ...base, x: ARENA.CENTER, y: ARENA.CENTER + 150, hp: 10, maxHp: 10, isBoss: false } as Enemy;
    expect(shouldRenderEnemyHpBar(farHealthy)).toBe(false);
  });

  it('enemigo dañado lejos muestra barra de HP', async () => {
    const { shouldRenderEnemyHpBar } = await import('./arena');
    const farDamaged = { ...base, x: ARENA.CENTER, y: ARENA.CENTER + 150, hp: 7, maxHp: 10, isBoss: false } as Enemy;
    expect(shouldRenderEnemyHpBar(farDamaged)).toBe(true);
  });

  it('enemigo sano a < 100 px del centro muestra barra de HP', async () => {
    const { shouldRenderEnemyHpBar } = await import('./arena');
    const closeHealthy = { ...base, x: ARENA.CENTER, y: ARENA.CENTER + 50, hp: 10, maxHp: 10, isBoss: false } as Enemy;
    expect(shouldRenderEnemyHpBar(closeHealthy)).toBe(true);
  });

  it('jefe intacto lejos muestra barra de HP', async () => {
    const { shouldRenderEnemyHpBar } = await import('./arena');
    const farBoss = { ...base, x: ARENA.CENTER, y: ARENA.CENTER + 150, hp: 100, maxHp: 100, isBoss: true } as Enemy;
    expect(shouldRenderEnemyHpBar(farBoss)).toBe(true);
  });
});

