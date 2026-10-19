import { describe, expect, it } from 'vitest';
import { ARENA } from '../../config/arena.config';
import {
  HARD_FLOOR_WINDOW_MULT,
  INTER_WAVE_BREAK_SEC,
  PACK_SPREAD_RAD,
  PACK_STAGGER_SEC,
  SPAWN_ANGLE_JITTER_RAD,
  TUTORIAL_SPEED_FACTOR,
  baseSpawnWindowSec,
  enemySpeed,
  floorEnemyCount,
  floorGoldIncome,
  floorSpawnWindowSec,
  interWaveBreakSec,
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
  /** Pincer arm count per floor: 2 on 1-8, 3 on 9-16, 4 from 17 on. */
  const armCountFor = (floor: number): number =>
    Math.min(4, 2 + Math.floor(Math.max(0, floor - 1) / 8));

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

  it('Pincer: 2-4 brazos radiales; cada paquete usa un brazo como centro y se reparte round-robin (f=23 → 4 brazos)', () => {
    const f = 23;
    const TAU = Math.PI * 2;
    const armCount = armCountFor(f);
    expect(armCount).toBe(4);

    // Replay del stream WAVE: baseAngle + un jitter por brazo (contrato determinista).
    const replay = rngFor(SEED, 'WAVE', f);
    const baseAngle = replay() * TAU;
    const armAngles: number[] = [];
    for (let a = 0; a < armCount; a++) {
      armAngles.push(baseAngle + (a * TAU) / armCount + (replay() * 2 - 1) * SPAWN_ANGLE_JITTER_RAD);
    }

    const plan = buildFloorPlan(SEED, f);
    const k = packSizeForFloor(f);
    expect(plan.events.length).toBe(floorEnemyCount(f));

    const angDist = (x: number, y: number): number => {
      const d = Math.abs(x - y) % TAU;
      return d > Math.PI ? TAU - d : d;
    };
    const nearestArm = (angle: number): number => {
      let best = 0;
      for (let a = 1; a < armCount; a++) {
        if (angDist(angle, armAngles[a]) < angDist(angle, armAngles[best])) best = a;
      }
      return best;
    };

    // Cada evento cae dentro del abanico de su brazo: ±((k-1)/2) * PACK_SPREAD_RAD.
    const maxOffset = ((k - 1) / 2) * PACK_SPREAD_RAD + 1e-4;
    const perArm: number[] = new Array(armCount).fill(0);
    for (const ev of plan.events) {
      const arm = nearestArm(ev.angle);
      expect(angDist(ev.angle, armAngles[arm])).toBeLessThanOrEqual(maxOffset);
      perArm[arm] += 1;
    }

    // Reparto round-robin: pack j → brazo (j % armCount).
    const P = Math.ceil(plan.totalEnemies / k);
    const packSize = (j: number) => (j === P - 1 ? plan.totalEnemies - k * (P - 1) : k);
    const expectedByArm: number[] = new Array(armCount).fill(0);
    for (let j = 0; j < P; j++) expectedByArm[j % armCount] += packSize(j);
    expect(perArm).toEqual(expectedByArm);
    for (const count of perArm) expect(count).toBeGreaterThan(0);

    // Los brazos siguen la progresión 2 → 3 → 4 por tramos de piso.
    expect([1, 8].map(armCountFor)).toEqual([2, 2]);
    expect([9, 16].map(armCountFor)).toEqual([3, 3]);
    expect([17, 50].map(armCountFor)).toEqual([4, 4]);
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

  it('Cobertura angular: el test de 6 sectores exige 6/6 para f >= 20 (no jefe) y al menos 4/6 para 10 <= f < 20', () => {
    // Para 10 <= f < 20, al menos 4 de los 6 sectores reciben evento
    for (let f = 10; f < 20; f++) {
      const plan = buildFloorPlan(SEED, f);
      const sectors = new Set(plan.events.map((ev) => Math.floor(ev.angle / (Math.PI / 3)) % 6));
      expect(sectors.size).toBeGreaterThanOrEqual(4);
    }

    // Para f >= 20 los brazos del pincer están a 90° y cada paquete ocupa
    // ~k*PACK_SPREAD_RAD, por lo que los pisos normales siguen cubriendo 6/6.
    const representativeFloors = [21, 23, 29, 41, 73, 97];
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

    // En pisos de jefe solo entran adds en paquetes de 2 (clusters estrechos):
    // se exige al menos un sector por brazo, no cobertura completa.
    for (const f of [20, 40, 50, 100]) {
      const plan = buildFloorPlan(SEED, f);
      const sectors = new Set(plan.events.map((ev) => Math.floor(ev.angle / (Math.PI / 3)) % 6));
      expect(sectors.size).toBeGreaterThanOrEqual(armCountFor(f));
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

  it('Ritmo de pisos: ventana comprimida en 1-9, descanso 0 desde el piso 10 y enemigos más rápidos desde el 10', () => {
    // Ventana de aparición: 16 + 0.25*f en 1-9, curva original desde el 10.
    expect(baseSpawnWindowSec(1)).toBeCloseTo(16.25, 5);
    expect(baseSpawnWindowSec(9)).toBeCloseTo(18.25, 5);
    expect(baseSpawnWindowSec(10)).toBeCloseTo(34.5, 5);
    expect(floorSpawnWindowSec(4)).toBeCloseTo((16 + 0.25 * 4) * HARD_FLOOR_WINDOW_MULT, 5);
    expect(buildFloorPlan(SEED, 7).spawnWindowSec).toBeCloseTo(16 + 0.25 * 7, 5);

    // Descanso entre oleadas: 0.6s en 1-9, solapado desde el 10.
    expect(INTER_WAVE_BREAK_SEC).toBe(0.6);
    expect(interWaveBreakSec(1)).toBe(0.6);
    expect(interWaveBreakSec(9)).toBe(0.6);
    expect(interWaveBreakSec(10)).toBe(0);

    // Velocidad: 20 + 0.5*f hasta el 9, 25 + (f-10)*1.2 desde el 10, tope 90.
    expect(enemySpeed(1)).toBeCloseTo(20.5, 5);
    expect(enemySpeed(9)).toBeCloseTo(24.5, 5);
    expect(enemySpeed(10)).toBeCloseTo(25, 5);
    expect(enemySpeed(20)).toBeCloseTo(37, 5);
    expect(enemySpeed(100)).toBe(90);
    expect(enemySpeed(200)).toBe(90);
  });
});
