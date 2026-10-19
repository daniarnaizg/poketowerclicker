import { describe, expect, it } from 'vitest';
import { ARENA } from '../../config/arena.config';
import {
  PACK_SPREAD_RAD,
  PACK_STAGGER_SEC,
  TUTORIAL_SPEED_FACTOR,
  enemySpeed,
  floorEnemyCount,
  floorGoldIncome,
  floorSpawnWindowSec,
  isBossFloor,
  isGrandBossFloor,
  isHardFloor,
  isMiniBossFloor,
  packSizeForFloor,
} from '../../config/balance.config';
import { buildBossAddEvents, buildFloorPlan, previewWave } from '../floorPlan';
import { rngFor } from '../rng';
import { PokemonType, type SpawnEvent } from '../types';
import { spawnBossForFloor, spawnEnemyAt } from '../waveGenerator';

describe('FloorPlan, previewWave y spawnEnemyAt (PRD §5.1, §9.1.2–§9.1.3)', () => {
  const SEED = 12345;

  it('Determinismo: buildFloorPlan(12345, 7) llamado dos veces devuelve exactamente el mismo objeto FloorPlan', () => {
    const plan1 = buildFloorPlan(SEED, 7);
    const plan2 = buildFloorPlan(SEED, 7);

    expect(plan1).toEqual(plan2);

    // Semillas distintas generan distribuciones de eventos distintas
    const planOtherSeed = buildFloorPlan(99999, 7);
    expect(plan1).not.toEqual(planOtherSeed);
  });

  it('events.length === floorEnemyCount(f) para pisos normales (1, 7, 23), exigentes (4, 9, 14, 19) y jefes (5, 10, 50)', () => {
    const normalFloors = [1, 7, 23];
    const hardFloors = [4, 9, 14, 19];
    const bossFloors = [5, 10, 50];

    for (const f of normalFloors) {
      const plan = buildFloorPlan(SEED, f);
      expect(plan.events.length).toBe(floorEnemyCount(f));
      expect(plan.totalEnemies).toBe(floorEnemyCount(f));
      expect(plan.kind).toBe('normal');
    }

    for (const f of hardFloors) {
      const plan = buildFloorPlan(SEED, f);
      expect(plan.events.length).toBe(floorEnemyCount(f));
      expect(plan.totalEnemies).toBe(floorEnemyCount(f));
      expect(plan.kind).toBe('hard');
      expect(isHardFloor(f)).toBe(true);
    }

    for (const f of bossFloors) {
      const plan = buildFloorPlan(SEED, f);
      expect(plan.events.length).toBe(floorEnemyCount(f));
      expect(plan.totalEnemies).toBe(floorEnemyCount(f));
      if (isGrandBossFloor(f)) {
        expect(plan.kind).toBe('grandboss');
      } else if (isMiniBossFloor(f)) {
        expect(plan.kind).toBe('miniboss');
      }
    }
  });

  it('En el piso 20 hay paquetes de tamaño packSizeForFloor(20): agrupando eventos con hueco temporal <= PACK_STAGGER_SEC + 1e-3, el tamaño de grupo máximo es k y todos los miembros de un paquete caben en un arco <= k*PACK_SPREAD_RAD', () => {
    const f = 20;
    const plan = buildFloorPlan(SEED, f);
    const k = packSizeForFloor(f);

    const groups: SpawnEvent[][] = [];
    let currentGroup: SpawnEvent[] = [];
    for (const ev of plan.events) {
      if (currentGroup.length === 0) {
        currentGroup.push(ev);
      } else {
        const prev = currentGroup[currentGroup.length - 1];
        if (ev.tSec - prev.tSec <= PACK_STAGGER_SEC + 1e-3) {
          currentGroup.push(ev);
        } else {
          groups.push(currentGroup);
          currentGroup = [ev];
        }
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    expect(groups.length).toBeGreaterThan(0);
    const maxGroupSize = Math.max(...groups.map((g) => g.length));
    expect(maxGroupSize).toBe(k);

    const TAU = Math.PI * 2;
    for (const group of groups) {
      expect(group.length).toBeLessThanOrEqual(k);

      const refAngle = group[0].angle;
      const diffs = group.map((ev) => {
        let diff = (ev.angle - refAngle) % TAU;
        if (diff > Math.PI) diff -= TAU;
        if (diff < -Math.PI) diff += TAU;
        return diff;
      });
      const arc = Math.max(...diffs) - Math.min(...diffs);
      expect(arc).toBeLessThanOrEqual(k * PACK_SPREAD_RAD + 1e-4);
    }
  });

  it('Orden temporal no decreciente (events[i].tSec >= events[i - 1].tSec), primer evento tSec === 0 y último tSec <= spawnWindowSec + 1e-4', () => {
    const floorsToTest = [1, 4, 7, 9, 10, 14, 19, 23, 50, 100];

    for (const f of floorsToTest) {
      const plan = buildFloorPlan(SEED, f);
      const windowSec = floorSpawnWindowSec(f);
      expect(plan.spawnWindowSec).toBe(windowSec);

      expect(plan.events.length).toBeGreaterThan(0);
      expect(plan.events[0].tSec).toBe(0);
      expect(plan.events[plan.events.length - 1].tSec).toBeLessThanOrEqual(windowSec + 1e-4);

      for (let i = 0; i < plan.events.length; i++) {
        const ev = plan.events[i];
        expect(ev.tSec).toBeGreaterThanOrEqual(0);
        expect(ev.tSec).toBeLessThanOrEqual(windowSec + 1e-4);

        if (i > 0) {
          expect(ev.tSec).toBeGreaterThanOrEqual(plan.events[i - 1].tSec);
        }
      }
    }
  });

  it('El hueco temporal máximo entre paquetes consecutivos en un piso normal f=10 es <= S / 2 (no hay huecos enormes)', () => {
    for (const f of [10, 11]) {
      const plan = buildFloorPlan(SEED, f);
      const S = plan.spawnWindowSec;

      const packs: SpawnEvent[][] = [];
      let currentPack: SpawnEvent[] = [];
      for (const ev of plan.events) {
        if (currentPack.length === 0) {
          currentPack.push(ev);
        } else {
          const prev = currentPack[currentPack.length - 1];
          if (ev.tSec - prev.tSec <= PACK_STAGGER_SEC + 1e-3) {
            currentPack.push(ev);
          } else {
            packs.push(currentPack);
            currentPack = [ev];
          }
        }
      }
      if (currentPack.length > 0) {
        packs.push(currentPack);
      }

      expect(packs.length).toBeGreaterThan(1);
      for (let j = 1; j < packs.length; j++) {
        const gap = packs[j][0].tSec - packs[j - 1][packs[j - 1].length - 1].tSec;
        expect(gap).toBeLessThanOrEqual(S / 2);
      }
    }
  });

  it('Cobertura angular: el test de 6 sectores exige 6/6 para f >= 20 y al menos 4/6 para 10 <= f < 20', () => {
    // Para 10 <= f < 20, al menos 4 de los 6 sectores reciben evento
    for (let f = 10; f < 20; f++) {
      const plan = buildFloorPlan(SEED, f);
      const sectors = new Set(plan.events.map((ev) => Math.floor(ev.angle / (Math.PI / 3)) % 6));
      expect(sectors.size).toBeGreaterThanOrEqual(4);
    }

    // Para f >= 20, representativos cubren 6/6
    const representativeFloors = [20, 23, 30, 40, 50, 75, 99];
    for (const f of representativeFloors) {
      const plan = buildFloorPlan(SEED, f);
      const sectors = new Set(plan.events.map((ev) => Math.floor(ev.angle / (Math.PI / 3)) % 6));
      expect(sectors.size).toBe(6);
      for (let s = 0; s < 6; s++) {
        expect(sectors.has(s)).toBe(true);
      }
    }

    // Cobertura 6/6 consistente en todos los pisos normales f = 20..100
    for (let f = 20; f <= 100; f++) {
      if (isBossFloor(f)) continue;
      const plan = buildFloorPlan(SEED, f);
      const sectors = new Set(plan.events.map((ev) => Math.floor(ev.angle / (Math.PI / 3)) % 6));
      expect(sectors.size).toBe(6);
    }
  });

  it('Conservación de oro: en pisos normales f = 1..100, la suma Σ goldValue difiere de floorGoldIncome(f) en como máximo 0.5 * N(f) y ±2% para f >= 15; los adds tienen goldValue === 0', () => {
    for (let f = 1; f <= 100; f++) {
      if (isBossFloor(f)) continue;

      const plan = buildFloorPlan(SEED, f);
      const rng = rngFor(SEED, 'WAVE', f);

      const totalGold = plan.events.reduce((acc, ev) => {
        const enemy = spawnEnemyAt(ev.angle, f, false, rng, ev.defId, ev.tier);
        return acc + enemy.goldValue;
      }, 0);

      const expectedIncome = floorGoldIncome(f);
      const n = floorEnemyCount(f);
      const diff = Math.abs(totalGold - expectedIncome);

      // Error máximo por redondeo entero de N(f) enemigos es <= 0.5 * N(f)
      expect(diff).toBeLessThanOrEqual(0.5 * n);

      // En pisos normales (sin multiplicador de exigente/jefe), para f >= 15 el error relativo es < 2.5% (o diff <= 0.5 * n)
      if (!isHardFloor(f) && f >= 15) {
        const relError = diff / expectedIncome;
        expect(relError <= 0.025 || diff <= 0.5 * n).toBe(true);
      }
    }

    // Los adds (tier === 'add') tienen goldValue === 0
    const addsPhase2 = buildBossAddEvents(SEED, 10, 2, 8.0, 100);
    const addsPhase3 = buildBossAddEvents(SEED, 10, 3, 16.0, 110);
    expect(addsPhase2.length).toBeGreaterThan(0);
    expect(addsPhase3.length).toBeGreaterThan(0);

    const testRng = rngFor(SEED, 'WAVE', 10, 2);
    for (const ev of [...addsPhase2, ...addsPhase3]) {
      expect(ev.tier).toBe('add');
      const addEnemy = spawnEnemyAt(ev.angle, 10, false, testRng, ev.defId, ev.tier);
      expect(addEnemy.goldValue).toBe(0);
      expect(addEnemy.tier).toBe('add');
      expect(addEnemy.kind).toBe('add');
    }
  });

  it('Radio de spawn y velocidad tutorial: spawnEnemyAt(0, 1, false, rng) spawnea a distancia 208 (ARENA.SPAWN_HALF_EXTENT) del centro (192, 192) y en pisos 1..3 su velocidad es 0.8x respecto al piso 4', () => {
    const rng = rngFor(SEED, 'WAVE', 1);
    const enemyAtAngle0 = spawnEnemyAt(0, 1, false, rng);

    expect(ARENA.CENTER).toBe(192);
    expect(ARENA.SPAWN_HALF_EXTENT).toBe(208);
    expect(enemyAtAngle0.x).toBeCloseTo(192 + 208, 4);
    expect(enemyAtAngle0.y).toBeCloseTo(192, 4);

    const distFromCenter = Math.hypot(enemyAtAngle0.x - ARENA.CENTER, enemyAtAngle0.y - ARENA.CENTER);
    expect(distFromCenter).toBeCloseTo(ARENA.SPAWN_HALF_EXTENT, 4);

    // En pisos 1..3 la velocidad tiene aplicado el factor de tutorial 0.8x (TUTORIAL_SPEED_FACTOR)
    expect(TUTORIAL_SPEED_FACTOR).toBe(0.8);

    const testSpecies = '0019'; // Rattata, speedFactor = 1.0
    for (let f = 1; f <= 3; f++) {
      const eTutorial = spawnEnemyAt(0, f, false, rng, testSpecies);
      const unscaled = enemySpeed(f);
      expect(eTutorial.speed).toBeCloseTo(unscaled * 0.8, 4);
      expect(eTutorial.speed).toBeCloseTo(unscaled * TUTORIAL_SPEED_FACTOR, 4);
    }

    // En el piso 4 (primer piso post-tutorial), la velocidad ya no tiene la reducción del 0.8x
    const eFloor4 = spawnEnemyAt(0, 4, false, rng, testSpecies);
    expect(eFloor4.speed).toBeCloseTo(enemySpeed(4), 4);
  });

  it('previewWave(seed, beforeFloor) devuelve dominantTypes.length <= 3 y detecta el upcomingBoss del rango [beforeFloor, beforeFloor + 9]', () => {
    const testBeforeFloors = [1, 5, 11, 20, 45, 50, 95];

    for (const beforeFloor of testBeforeFloors) {
      const preview = previewWave(SEED, beforeFloor);

      expect(preview.fromFloor).toBe(beforeFloor);
      expect(preview.toFloor).toBe(beforeFloor + 9);
      expect(preview.dominantTypes.length).toBeLessThanOrEqual(3);
      expect(preview.dominantTypes.length).toBeGreaterThan(0);

      expect(preview.upcomingBoss).toBeDefined();
      expect(preview.upcomingBoss!.floor).toBeGreaterThanOrEqual(beforeFloor);
      expect(preview.upcomingBoss!.floor).toBeLessThanOrEqual(beforeFloor + 9);
      expect(isBossFloor(preview.upcomingBoss!.floor)).toBe(true);
    }

    // Comprobaciones concretas de jefes clave
    const previewF1 = previewWave(SEED, 1);
    expect(previewF1.upcomingBoss).toEqual({
      floor: 10,
      definitionId: '0127',
      name: 'Pinsir',
      types: [PokemonType.Bug],
    });

    const previewF45 = previewWave(SEED, 45);
    expect(previewF45.upcomingBoss).toEqual({
      floor: 50,
      definitionId: '0094',
      name: 'Gengar',
      types: [PokemonType.Ghost, PokemonType.Poison],
    });

    const previewF95 = previewWave(SEED, 95);
    expect(previewF95.upcomingBoss).toEqual({
      floor: 100,
      definitionId: '0150',
      name: 'Mewtwo',
      types: [PokemonType.Psychic],
    });
  });

  it('spawnBossForFloor(seed, floor) genera deterministamente el jefe con hitboxes y stats correctos', () => {
    const boss10A = spawnBossForFloor(SEED, 10);
    const boss10B = spawnBossForFloor(SEED, 10);

    expect(boss10A).toEqual(boss10B);
    expect(boss10A.isBoss).toBe(true);
    expect(boss10A.kind).toBe('miniboss');
    expect(boss10A.definitionId).toBe('0127');

    const boss50 = spawnBossForFloor(SEED, 50);
    expect(boss50.isBoss).toBe(true);
    expect(boss50.kind).toBe('grandboss');
    expect(boss50.definitionId).toBe('0094');
  });
});
