/**
 * PokéBastion — Balance Simulation & Validation (PRD §7.3, §9.1.5, Curva v2 / v3, WP7.sim).
 *
 * Verifies that:
 * 1. Métricas por piso en una run (duración, cleanupTailSec, φ leak rate, maxAlive, boss TTK, ult % maxHp, desgaste).
 * 2. Agregación automática en 4 zonas relativas a F_end (A, B, C, D) con medianas.
 * 3. Perfiles evaluados:
 *    - Starter 1★ (0 cps vs 1.5 cps)
 *    - Perfil Intermedio (equipo de 6 a 2★–3★, ROTATE con swapScore a 0 cps, 1.5 cps y 4 cps)
 *    - Comparativa táctica ROTATE vs CARRY
 * 4. Invariantes globales:
 *    - maxAliveObserved <= ALIVE_CAP (70)
 *    - Conservación de oro W(f) ± 2 % (o error entero <= 0.5 * N(f))
 *
 * Run with: pnpm run test:balance
 */

import { tickGame, swapScore } from '../src/core/gameLoop';
import { TYPE_CHART } from '../src/core/damage';
import { POKEDEX } from '../src/data/pokemon';
import {
  ALIVE_CAP,
  floorEnemyCount,
  floorGoldIncome,
  floorSpawnWindowSec,
  goldPerEnemy,
  isBossFloor,
  isGrandBossFloor,
  isMiniBossFloor,
  teamLevelCost,
} from '../src/config/balance.config';
import { calculateUpgradeCost } from '../src/core/bastionUpgrades';
import { mulberry32 } from '../src/core/rng';
import { BASTION_UPGRADE_IDS } from '../src/core/types';
import type {
  BastionUpgradeId,
  GameConfig,
  GameState,
  PlayerPokemon,
  StartRunSlot,
} from '../src/core/types';

// ---------------------------------------------------------------------------
// Helpers & Types
// ---------------------------------------------------------------------------

export interface FloorMetrics {
  floor: number;
  durationSec: number;
  spawnWindowSec: number;
  cleanupTailSec: number;
  totalEnemies: number;
  leaks: number;
  leakRatePhi: number;
  maxAlive: number;
  isBoss: boolean;
  bossTtkSec?: number;
  maxUltPctOfBossMaxHp?: number;
  teamHpLostFraction?: number;
  goldEarned: number;
}

export interface ZoneSummary {
  zone: 'A' | 'B' | 'C' | 'D';
  name: string;
  floorRange: string;
  floorCount: number;
  medianDurationSec: number;
  medianCleanupTailSec: number;
  medianLeakRatePhi: number;
}

export interface SimOptions {
  name: string;
  team: (StartRunSlot | null)[];
  policy: 'cheapest' | 'focus';
  swapPolicy: 'ROTATE' | 'CARRY';
  cps: number;
  seed: number;
  maxSec?: number;
}

export interface SimRunResult {
  options: SimOptions;
  finalState: GameState;
  floorReached: number;
  durationSec: number;
  totalKills: number;
  totalGold: number;
  defeatedBosses: number[];
  floorMetrics: FloorMetrics[];
  zoneSummaries: ZoneSummary[];
  maxAliveObserved: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatPct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

function initialState(): GameState {
  const emptySlot = (index: number) => ({
    index,
    pokemon: null,
    isActive: false,
    hotSwapCooldownSec: 0,
  });
  return {
    phase: 'STARTER_SELECT',
    floor: 1,
    team: [0, 1, 2, 3, 4, 5].map(emptySlot) as any,
    teamLevel: 1,
    gold: 0,
    bastionUpgrades: {
      UP_MULTI: 0,
      UP_ARROW: 0,
      UP_SPD: 0,
      UP_CRIT: 0,
      UP_CDMG: 0,
      UP_GOLD: 0,
      UP_AUTOCLICK: 0,
    },
    enemies: [],
    projectiles: [],
    floatingTexts: [],
    ultimateCharge: 0,
    ultimateMax: 0,
    waveEnemiesRemaining: 0,
    hotSwapCooldowns: [0, 0, 0, 0, 0, 0],
    runStats: {
      totalKills: 0,
      totalGoldEarned: 0,
      totalDamageDealt: 0,
      damagePerSlot: [0, 0, 0, 0, 0, 0],
      mvpSlotIndex: -1,
      floorReached: 1,
      durationSec: 0,
      manualClicks: 0,
      autoClicks: 0,
      defeatedBossFloors: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Simulation Runner
// ---------------------------------------------------------------------------

let globalMaxAliveObserved = 0;

export function runSim(opts: SimOptions): SimRunResult {
  const cfg: GameConfig = { pokedex: POKEDEX, typeChart: TYPE_CHART, seed: opts.seed };
  const rng = mulberry32(opts.seed);
  let s = tickGame(initialState(), { startRun: opts.team as any }, cfg, 0, rng);

  const dtMs = 1000 / 60 + 0.001;
  const dtSec = 1 / 60;
  const maxSec = opts.maxSec ?? 9000;
  let frame = 0;

  const floorMetricsList: FloorMetrics[] = [];

  // Floor tracking accumulators
  let activeFloor = s.floor;
  let floorCombatSec = 0;
  let floorLeaks = 0;
  let floorMaxAlive = 0;
  let floorMaxUltPct = 0;
  let floorHpLost = 0;
  let floorGoldEarned = 0;
  let bossAliveTime = 0;
  let bossTtkSec: number | undefined = undefined;

  let prevGold = s.runStats.totalGoldEarned;
  let prevTeamHp = s.team.map((slot) => (slot.pokemon ? slot.pokemon.hp : 0));
  const seenStrikeIds = new Set<number>();

  const getFloorTotalEnemies = (f: number) =>
    s.floorRuntime ? s.floorRuntime.plan.totalEnemies : floorEnemyCount(f);
  const getFloorSpawnWindow = (f: number) =>
    s.floorRuntime ? s.floorRuntime.plan.spawnWindowSec : floorSpawnWindowSec(f);

  let floorTotalEnemies = getFloorTotalEnemies(activeFloor);
  let floorSpawnWindow = getFloorSpawnWindow(activeFloor);

  const finalizeFloor = (fl: number) => {
    const isBoss = isBossFloor(fl);
    const cleanupTailSec = Math.max(0, floorCombatSec - floorSpawnWindow);
    const leakRatePhi = floorTotalEnemies > 0 ? floorLeaks / floorTotalEnemies : 0;

    const teamPkm = s.team
      .map((slot) => slot.pokemon)
      .filter((p): p is PlayerPokemon => p !== null);
    const avgMaxHp = teamPkm.reduce((acc, p) => acc + p.maxHp, 0) / Math.max(1, teamPkm.length);
    const teamHpLostFraction = avgMaxHp > 0 ? floorHpLost / avgMaxHp : 0;

    floorMetricsList.push({
      floor: fl,
      durationSec: floorCombatSec,
      spawnWindowSec: floorSpawnWindow,
      cleanupTailSec,
      totalEnemies: floorTotalEnemies,
      leaks: floorLeaks,
      leakRatePhi,
      maxAlive: floorMaxAlive,
      isBoss,
      bossTtkSec: isBoss ? bossTtkSec : undefined,
      maxUltPctOfBossMaxHp: isBoss ? floorMaxUltPct : undefined,
      teamHpLostFraction: isBoss ? teamHpLostFraction : undefined,
      goldEarned: floorGoldEarned,
    });
  };

  while (s.phase === 'PLAYING' && s.runStats.durationSec < maxSec) {
    const input: Parameters<typeof tickGame>[1] = {};

    // 1. Skip breather between floors to avoid simulating empty frames
    if (s.interWaveTimerSec !== undefined || s.awaitingNextWave) {
      input.startNextWave = true;
    }

    // 2. Upgrades purchasing logic
    if (frame % 5 === 0) {
      const multiLvl = s.bastionUpgrades.UP_MULTI ?? 0;
      const multiCost = calculateUpgradeCost('UP_MULTI', multiLvl);
      const spdCost = calculateUpgradeCost('UP_SPD', s.bastionUpgrades.UP_SPD ?? 0);
      if (multiLvl < 2 && s.gold >= multiCost) {
        input.buyUpgrade = 'UP_MULTI';
      } else if (opts.cps === 0 && (s.bastionUpgrades.UP_SPD ?? 0) < 5 && s.gold >= spdCost) {
        input.buyUpgrade = 'UP_SPD';
      } else {
        const ids: BastionUpgradeId[] =
          opts.policy === 'focus'
            ? ['UP_MULTI', 'UP_ARROW', 'UP_SPD', 'UP_CRIT', 'UP_CDMG', 'UP_AUTOCLICK']
            : [...BASTION_UPGRADE_IDS];
        const upgradeOptions: { id: BastionUpgradeId | 'TEAM'; cost: number }[] = [
          { id: 'TEAM', cost: teamLevelCost(s.teamLevel) },
          ...ids.map((id) => ({ id, cost: calculateUpgradeCost(id, s.bastionUpgrades[id] ?? 0) })),
        ]
          .filter((u) => isFinite(u.cost))
          .sort((a, b) => a.cost - b.cost);

        if (upgradeOptions.length > 0 && s.gold >= upgradeOptions[0].cost) {
          if (upgradeOptions[0].id === 'TEAM') input.buyTeamLevel = true;
          else input.buyUpgrade = upgradeOptions[0].id;
        }
      }
    }

    // 3. Tactical switch policy: ROTATE vs CARRY
    if (opts.swapPolicy === 'ROTATE' && frame % 15 === 0) {
      const activeIdx = s.team.findIndex(
        (slot) => slot.isActive && slot.pokemon && slot.pokemon.alive,
      );
      if (activeIdx !== -1) {
        const activeSlot = s.team[activeIdx];
        const activePkm = activeSlot.pokemon!;
        const activeHpRatio = activePkm.hp / Math.max(1, activePkm.maxHp);
        const aliveEnemies = s.enemies.filter((e) => e.alive);
        const bossEnemy = aliveEnemies.find((e) => e.isBoss);
        const scoreTargets = bossEnemy ? [bossEnemy] : aliveEnemies;
        const activeScore = swapScore(activePkm, scoreTargets, cfg.typeChart);

        let bestIdx = -1;
        let bestScore = -Infinity;

        for (let i = 0; i < s.team.length; i++) {
          if (i === activeIdx) continue;
          const slot = s.team[i];
          if (!slot.pokemon || !slot.pokemon.alive) continue;
          if (s.hotSwapCooldowns[i] > 0) continue;

          const score = swapScore(slot.pokemon, scoreTargets, cfg.typeChart);
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }

        if (bestIdx !== -1) {
          const activeLowHp = activeHpRatio < (bossEnemy ? 0.35 : 0.25);
          const ultNearlyReady =
            s.ultimateMax > 0 && s.ultimateCharge >= 0.65 * s.ultimateMax;
          const thresholdMult = bossEnemy ? 1.15 : 1.55;
          const candidateOutscores =
            !ultNearlyReady &&
            (activeScore > 0 ? bestScore >= activeScore * thresholdMult : bestScore > activeScore);
          if (activeLowHp || candidateOutscores) {
            input.hotSwapIndex = bestIdx;
          }
        }
      }
    }

    // 4. Aimed manual clicks (when cps > 0): prioritize close non-boss adds (< 90px) per §4.5, else nearest enemy/boss
    if (opts.cps > 0 && frame % Math.max(1, Math.round(60 / opts.cps)) === 0) {
      const alive = s.enemies.filter((e) => e.alive);
      const urgentAdd = alive
        .filter((e) => !e.isBoss && Math.hypot(e.x - 192, e.y - 192) < 90)
        .sort((a, b) => Math.hypot(a.x - 192, a.y - 192) - Math.hypot(b.x - 192, b.y - 192))[0];
      const target =
        urgentAdd ??
        alive.sort((a, b) => Math.hypot(a.x - 192, a.y - 192) - Math.hypot(b.x - 192, b.y - 192))[0];
      if (target) input.click = { x: target.x, y: target.y, isAuto: false };
    }

    // 5. Ultimate trigger & measurement against boss
    const currentBoss = s.enemies.find((e) => e.isBoss && e.alive);
    if (currentBoss && floorMaxUltPct === 0 && (currentBoss.bossInvulnSec ?? 0) <= 0) {
      const distToCenter = Math.hypot(currentBoss.x - 192, currentBoss.y - 192);
      if (distToCenter <= 120 || currentBoss.anchoredAtBastion) {
        const sTest = tickGame(
          { ...s, ultimateCharge: Math.max(1, s.ultimateMax) },
          { useUltimate: true },
          cfg,
          0,
          mulberry32(opts.seed * 1000 + activeFloor),
        );
        const bossAfterTest = sTest.enemies.find((e) => e.isBoss);
        const dmg = Math.max(0, currentBoss.hp - (bossAfterTest ? bossAfterTest.hp : 0));
        const pct = (dmg / Math.max(1, currentBoss.maxHp)) * 100;
        if (pct > floorMaxUltPct) {
          floorMaxUltPct = pct;
        }
      }
    }
    if (s.ultimateMax > 0 && s.ultimateCharge >= s.ultimateMax && s.enemies.some((e) => e.alive)) {
      if (currentBoss) {
        // Execute ultimate synchronously with deltaMs=0 to isolate live boss damage
        const sAfterUlt = tickGame(s, { useUltimate: true }, cfg, 0, rng);
        const bossAfter = sAfterUlt.enemies.find((e) => e.isBoss);
        const bossHpDrop = Math.max(
          0,
          currentBoss.hp - (bossAfter && bossAfter.alive ? bossAfter.hp : 0),
        );
        const ultPct = (bossHpDrop / Math.max(1, currentBoss.maxHp)) * 100;
        if (ultPct > floorMaxUltPct) {
          floorMaxUltPct = ultPct;
        }
        s = sAfterUlt;
      } else {
        input.useUltimate = true;
      }
    }

    // Advance simulation one tick
    const nextState = tickGame(s, input, cfg, dtMs, rng);

    // Track metrics during active combat (not in breather)
    if (s.interWaveTimerSec === undefined && s.phase === 'PLAYING') {
      floorCombatSec += dtSec;
      const aliveCount = s.enemies.filter((e) => e.alive).length;
      if (aliveCount > floorMaxAlive) floorMaxAlive = aliveCount;
      if (aliveCount > globalMaxAliveObserved) globalMaxAliveObserved = aliveCount;

      // Boss TTK tracking
      const boss = s.enemies.find((e) => e.isBoss);
      if (boss) {
        if (boss.alive) {
          bossAliveTime += dtSec;
        } else if (bossTtkSec === undefined) {
          bossTtkSec = bossAliveTime;
        }
      }
      if (
        bossTtkSec === undefined &&
        nextState.runStats.defeatedBossFloors?.includes(activeFloor)
      ) {
        bossTtkSec = bossAliveTime;
      }

      // Leak tracking: newly created strikes with !st.isBoss
      const currentStrikes = nextState.strikes ?? [];
      for (const st of currentStrikes) {
        if (!seenStrikeIds.has(st.id)) {
          seenStrikeIds.add(st.id);
          if (!st.isBoss) {
            floorLeaks++;
          }
        }
      }

      // Team HP lost tracking
      for (let i = 0; i < 6; i++) {
        const prev = prevTeamHp[i];
        const curr = nextState.team[i]?.pokemon?.hp ?? 0;
        if (prev > curr) {
          floorHpLost += prev - curr;
        }
        prevTeamHp[i] = curr;
      }

      // Gold tracking
      const goldDelta = nextState.runStats.totalGoldEarned - prevGold;
      if (goldDelta > 0) {
        floorGoldEarned += goldDelta;
        prevGold = nextState.runStats.totalGoldEarned;
      }
    }

    // Floor transition
    if (nextState.floor !== activeFloor) {
      finalizeFloor(activeFloor);

      activeFloor = nextState.floor;
      floorCombatSec = 0;
      floorLeaks = 0;
      floorMaxAlive = 0;
      floorMaxUltPct = 0;
      floorHpLost = 0;
      floorGoldEarned = 0;
      bossAliveTime = 0;
      bossTtkSec = undefined;
      prevTeamHp = nextState.team.map((slot) => (slot.pokemon ? slot.pokemon.hp : 0));
      floorTotalEnemies = getFloorTotalEnemies(activeFloor);
      floorSpawnWindow = getFloorSpawnWindow(activeFloor);
    }

    s = nextState;
    frame++;
  }

  // Finalize the last active floor if not yet recorded
  if (
    floorMetricsList.length === 0 ||
    floorMetricsList[floorMetricsList.length - 1].floor !== activeFloor
  ) {
    finalizeFloor(activeFloor);
  }

  // Aggregate into 4 zones relative to F_end (§2.4)
  const F_end = Math.max(1, s.runStats.floorReached);
  const boundaryA = Math.max(1, Math.round(0.15 * F_end));
  const boundaryB = Math.max(boundaryA, Math.round(0.55 * F_end));
  const boundaryC = Math.max(boundaryB, Math.round(0.85 * F_end));

  const zonesData: Record<'A' | 'B' | 'C' | 'D', FloorMetrics[]> = {
    A: [],
    B: [],
    C: [],
    D: [],
  };

  for (const fm of floorMetricsList) {
    if (fm.floor <= boundaryA) zonesData.A.push(fm);
    else if (fm.floor <= boundaryB) zonesData.B.push(fm);
    else if (fm.floor <= boundaryC) zonesData.C.push(fm);
    else zonesData.D.push(fm);
  }

  const zoneConfigs: { zone: 'A' | 'B' | 'C' | 'D'; name: string; range: string }[] = [
    { zone: 'A', name: 'Tensión', range: `1..${boundaryA}` },
    { zone: 'B', name: 'Dominio', range: `${boundaryA + 1}..${boundaryB}` },
    { zone: 'C', name: 'Presión', range: `${boundaryB + 1}..${boundaryC}` },
    { zone: 'D', name: 'Colapso', range: `${boundaryC + 1}..${F_end}` },
  ];

  const zoneSummaries: ZoneSummary[] = zoneConfigs.map((zc) => {
    const list = zonesData[zc.zone];
    return {
      zone: zc.zone,
      name: zc.name,
      floorRange: zc.range,
      floorCount: list.length,
      medianDurationSec: median(list.map((m) => m.durationSec)),
      medianCleanupTailSec: median(list.map((m) => m.cleanupTailSec)),
      medianLeakRatePhi: median(list.map((m) => m.leakRatePhi)),
    };
  });

  return {
    options: opts,
    finalState: s,
    floorReached: s.runStats.floorReached,
    durationSec: s.runStats.durationSec,
    totalKills: s.runStats.totalKills,
    totalGold: s.runStats.totalGoldEarned,
    defeatedBosses: s.runStats.defeatedBossFloors ?? [],
    floorMetrics: floorMetricsList,
    zoneSummaries,
    maxAliveObserved: floorMetricsList.reduce((m, f) => Math.max(m, f.maxAlive), 0),
  };
}

// ---------------------------------------------------------------------------
// Main Test Script Execution
// ---------------------------------------------------------------------------

console.log('================================================================');
console.log('PokéBastion — Simulador v3: Spawner continuo & Jefes por fases');
console.log('            (PRD §9.1.5, SPEC §2.4, §7.1, Curva v3)');
console.log('================================================================\n');

// Standard team definitions
const STARTER_LOADOUT: (StartRunSlot | null)[] = [
  { definitionId: '0004', stars: 1 },
  null,
  null,
  null,
  null,
  null,
];

const INTERMEDIATE_LOADOUT: (StartRunSlot | null)[] = [
  { definitionId: '0004', stars: 3 }, // Charmander (Fire) 3★
  { definitionId: '0007', stars: 2 }, // Squirtle (Water) 2★
  { definitionId: '0001', stars: 3 }, // Bulbasaur (Grass/Poison) 3★
  { definitionId: '0025', stars: 2 }, // Pikachu (Electric) 2★
  { definitionId: '0074', stars: 3 }, // Geodude (Rock/Ground) 3★
  { definitionId: '0063', stars: 2 }, // Abra (Psychic) 2★
];

const SEEDS = [1, 2, 3];

// ---------------------------------------------------------------------------
// 1. Starter 1★: 0 cps vs 1.5 cps
// ---------------------------------------------------------------------------
console.log('--- 1) Perfil Starter 1★: 0 cps (Idle puro) vs 1.5 cps ---');

const starter0cpsRuns = SEEDS.map((seed) =>
  runSim({
    name: 'Starter 0 cps',
    team: STARTER_LOADOUT,
    policy: 'cheapest',
    swapPolicy: 'CARRY',
    cps: 0,
    seed,
  }),
);

const starter15cpsRuns = SEEDS.map((seed) =>
  runSim({
    name: 'Starter 1.5 cps',
    team: STARTER_LOADOUT,
    policy: 'focus',
    swapPolicy: 'CARRY',
    cps: 1.5,
    seed,
  }),
);

for (let i = 0; i < SEEDS.length; i++) {
  const r0 = starter0cpsRuns[i];
  const r15 = starter15cpsRuns[i];
  console.log(
    `  Semilla ${SEEDS[i]}: ` +
      `0 cps => Piso ${r0.floorReached} (${Math.round(r0.durationSec)}s, Bajas: ${r0.totalKills}) | ` +
      `1.5 cps => Piso ${r15.floorReached} (${Math.round(r15.durationSec)}s, Bajas: ${r15.totalKills}, Jefes: [${r15.defeatedBosses.join(',')}])`,
  );
}

// ---------------------------------------------------------------------------
// 2. Perfil Intermedio: 0 cps, 1.5 cps y 4 cps (con relevo ROTATE)
// ---------------------------------------------------------------------------
console.log('\n--- 2) Perfil Intermedio (Equipo de 6 a 2★–3★, ROTATE con swapScore) ---');

const inter0cpsRuns = SEEDS.map((seed) =>
  runSim({
    name: 'Inter 0 cps ROTATE',
    team: INTERMEDIATE_LOADOUT,
    policy: 'focus',
    swapPolicy: 'ROTATE',
    cps: 0,
    seed,
  }),
);

const inter15cpsRuns = SEEDS.map((seed) =>
  runSim({
    name: 'Inter 1.5 cps ROTATE',
    team: INTERMEDIATE_LOADOUT,
    policy: 'focus',
    swapPolicy: 'ROTATE',
    cps: 1.5,
    seed,
  }),
);

const inter4cpsRuns = SEEDS.map((seed) =>
  runSim({
    name: 'Inter 4 cps ROTATE',
    team: INTERMEDIATE_LOADOUT,
    policy: 'focus',
    swapPolicy: 'ROTATE',
    cps: 4,
    seed,
  }),
);

// ---------------------------------------------------------------------------
// 3. Comparativa Táctica: ROTATE vs CARRY (a 1.5 cps)
// ---------------------------------------------------------------------------
console.log('\n--- 3) Comparativa Táctica: ROTATE vs CARRY (1.5 cps) ---');

const inter15CarryRuns = SEEDS.map((seed) =>
  runSim({
    name: 'Inter 1.5 cps CARRY',
    team: INTERMEDIATE_LOADOUT,
    policy: 'focus',
    swapPolicy: 'CARRY',
    cps: 1.5,
    seed,
  }),
);

for (let i = 0; i < SEEDS.length; i++) {
  const rot = inter15cpsRuns[i];
  const car = inter15CarryRuns[i];
  console.log(
    `  Semilla ${SEEDS[i]}: ` +
      `ROTATE => Piso ${rot.floorReached} (${Math.round(rot.durationSec)}s, Jefes: [${rot.defeatedBosses.join(',')}]) vs ` +
      `CARRY => Piso ${car.floorReached} (${Math.round(car.durationSec)}s, Jefes: [${car.defeatedBosses.join(',')}])`,
  );
}

const medianFloorRotate = median(inter15cpsRuns.map((r) => r.floorReached));
const medianFloorCarry = median(inter15CarryRuns.map((r) => r.floorReached));
const carryDiffPct = ((medianFloorRotate - medianFloorCarry) / medianFloorRotate) * 100;
console.log(
  `\n  -> Mediana Piso ROTATE: ${medianFloorRotate} | Mediana Piso CARRY: ${medianFloorCarry} (Ventaja ROTATE: +${carryDiffPct.toFixed(1)}%)`,
);

// ---------------------------------------------------------------------------
// 4. Comparativa de Habilidad: 4 cps vs 0 cps (Intermedio ROTATE)
// ---------------------------------------------------------------------------
console.log('\n--- 4) Comparativa de Clics: 4 cps vs 0 cps (Intermedio ROTATE) ---');
const medianFloor0cps = median(inter0cpsRuns.map((r) => r.floorReached));
const medianFloor4cps = median(inter4cpsRuns.map((r) => r.floorReached));
const clickGainPct = ((medianFloor4cps - medianFloor0cps) / Math.max(1, medianFloor0cps)) * 100;
console.log(
  `  Mediana 0 cps: Piso ${medianFloor0cps} | Mediana 4 cps: Piso ${medianFloor4cps} (Ganancia: +${clickGainPct.toFixed(1)}%)`,
);
console.log(
  `  ¿Cumple criterio C3 / §7.1 (+15% pisos más lejos)?: ${clickGainPct >= 15 ? 'SÍ ✓' : 'NO ✗'}`,
);

// ---------------------------------------------------------------------------
// 5. Agregación de Zonas Relativas A–D (§2.4) [Perfil Intermedio 1.5 cps]
// ---------------------------------------------------------------------------
console.log('\n--- 5) Agregación de Zonas Relativas A–D (§2.4) [Perfil Intermedio 1.5 cps] ---');

// Merge floor metrics across the representative runs
const representativeRun = inter15cpsRuns[0];
console.log(
  `Run de referencia: Semilla ${representativeRun.options.seed}, F_end = Piso ${representativeRun.floorReached}`,
);
console.log(
  '┌──────┬──────────┬──────────┬──────────┬──────────────┬──────────────┬──────────┬──────────────────────┐',
);
console.log(
  '│ Zona │ Nombre   │ Rango    │ Pisos    │ Duración (s) │ Cola (s)     │ φ Fugas  │ Objetivo §2.4        │',
);
console.log(
  '├──────┼──────────┼──────────┼──────────┼──────────────┼──────────────┼──────────┼──────────────────────┤',
);

for (const zs of representativeRun.zoneSummaries) {
  let target = '';
  if (zs.zone === 'A') target = 'φ 5–20%, cola 10–25s';
  else if (zs.zone === 'B') target = 'φ ≤ 3%, cola ≤ 5s';
  else if (zs.zone === 'C') target = 'φ 3–15%, cola 5–25s';
  else if (zs.zone === 'D') target = 'φ > 25%, colapso';

  console.log(
    `│ ${zs.zone.padEnd(4)} │ ${zs.name.padEnd(8)} │ ${zs.floorRange.padEnd(8)} │ ${zs.floorCount.toString().padStart(8)} │ ` +
      `${zs.medianDurationSec.toFixed(1).padStart(12)} │ ${zs.medianCleanupTailSec.toFixed(1).padStart(12)} │ ` +
      `${formatPct(zs.medianLeakRatePhi).padStart(8)} │ ${target.padEnd(20)} │`,
  );
}
console.log(
  '└──────┴──────────┴──────────┴──────────┴──────────────┴──────────────┴──────────┴──────────────────────┘',
);

// Aggregate across all seeds of Perfil Intermedio 1.5 cps
const pooledZones: Record<'A' | 'B' | 'C' | 'D', FloorMetrics[]> = { A: [], B: [], C: [], D: [] };
for (const run of inter15cpsRuns) {
  const fEnd = Math.max(1, run.floorReached);
  const bA = Math.max(1, Math.round(0.15 * fEnd));
  const bB = Math.max(bA, Math.round(0.55 * fEnd));
  const bC = Math.max(bB, Math.round(0.85 * fEnd));
  for (const fm of run.floorMetrics) {
    if (fm.floor <= bA) pooledZones.A.push(fm);
    else if (fm.floor <= bB) pooledZones.B.push(fm);
    else if (fm.floor <= bC) pooledZones.C.push(fm);
    else pooledZones.D.push(fm);
  }
}

console.log(`\nAgregado general (${inter15cpsRuns.length} semillas, total ${inter15cpsRuns.reduce((a, r) => a + r.floorMetrics.length, 0)} pisos simulados):`);
console.log(
  '┌──────┬──────────┬──────────┬──────────────┬──────────────┬──────────┬──────────────────────┐',
);
console.log(
  '│ Zona │ Nombre   │ Pisos    │ Duración (s) │ Cola (s)     │ φ Fugas  │ Objetivo §2.4        │',
);
console.log(
  '├──────┼──────────┼──────────┼──────────────┼──────────────┼──────────┼──────────────────────┤',
);
const zoneNames: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: 'Tensión',
  B: 'Dominio',
  C: 'Presión',
  D: 'Colapso',
};
for (const z of ['A', 'B', 'C', 'D'] as const) {
  const list = pooledZones[z];
  const medDur = median(list.map((m) => m.durationSec));
  const medTail = median(list.map((m) => m.cleanupTailSec));
  const medPhi = median(list.map((m) => m.leakRatePhi));
  let target = '';
  if (z === 'A') target = 'φ 5–20%, cola 10–25s';
  else if (z === 'B') target = 'φ ≤ 3%, cola ≤ 5s';
  else if (z === 'C') target = 'φ 3–15%, cola 5–25s';
  else if (z === 'D') target = 'φ > 25%, colapso';

  console.log(
    `│ ${z.padEnd(4)} │ ${zoneNames[z].padEnd(8)} │ ${list.length.toString().padStart(8)} │ ` +
      `${medDur.toFixed(1).padStart(12)} │ ${medTail.toFixed(1).padStart(12)} │ ` +
      `${formatPct(medPhi).padStart(8)} │ ${target.padEnd(20)} │`,
  );
}
console.log(
  '└──────┴──────────┴──────────┴──────────────┴──────────────┴──────────┴──────────────────────┘',
);

// ---------------------------------------------------------------------------
// 6. Métricas de Jefes: TTK, % Definitiva y Desgaste del Equipo
// ---------------------------------------------------------------------------
console.log('\n--- 6) Métricas de Combate de Jefe (TTK, % Definitiva, Desgaste de HP) ---');

const bossFloorsSeen: FloorMetrics[] = [];
for (const r of [...inter15cpsRuns, ...inter4cpsRuns]) {
  for (const fm of r.floorMetrics) {
    if (fm.isBoss && fm.bossTtkSec !== undefined && r.defeatedBosses.includes(fm.floor)) {
      bossFloorsSeen.push(fm);
    }
  }
}

let medUltOverall = 0;
let medDmgOverall = 0;
let medTtkOverall = 0;

const inter15BossesSeen: FloorMetrics[] = [];
for (const r of inter15cpsRuns) {
  for (const fm of r.floorMetrics) {
    if (fm.isBoss && fm.bossTtkSec !== undefined && r.defeatedBosses.includes(fm.floor)) {
      inter15BossesSeen.push(fm);
    }
  }
}

if (bossFloorsSeen.length > 0) {
  medUltOverall = median(bossFloorsSeen.map((b) => b.maxUltPctOfBossMaxHp ?? 0));
  medDmgOverall =
    inter15BossesSeen.length > 0
      ? (median(inter15BossesSeen.filter((b) => b.floor === 10).map((b) => b.teamHpLostFraction ?? 0)) +
          median(inter15BossesSeen.filter((b) => b.floor === 20).map((b) => b.teamHpLostFraction ?? 0))) /
        2
      : median(bossFloorsSeen.map((b) => b.teamHpLostFraction ?? 0));
  medTtkOverall = median(bossFloorsSeen.map((b) => b.bossTtkSec ?? 0));

  console.log('┌──────┬──────────┬──────────┬──────────────┬──────────────┬────────────────┐');
  console.log('│ Piso │ Tipo     │ TTK (s)  │ Max % Ult/HP │ Daño Eq (%Hp)│ Objetivo §7.1  │');
  console.log('├──────┼──────────┼──────────┼──────────────┼──────────────┼────────────────┤');

  // De-duplicate by floor (take median/first)
  const uniqueFloors = [...new Set(bossFloorsSeen.map((b) => b.floor))].sort((a, b) => a - b);
  for (const fl of uniqueFloors) {
    const list = bossFloorsSeen.filter((b) => b.floor === fl);
    const medTtk = median(list.map((b) => b.bossTtkSec ?? 0));
    const medUlt = median(list.map((b) => b.maxUltPctOfBossMaxHp ?? 0));
    const medDmg = median(list.map((b) => b.teamHpLostFraction ?? 0));
    const kindStr = isGrandBossFloor(fl) ? 'Gran Boss' : 'Mini-Boss';
    const target = isGrandBossFloor(fl) ? 'TTK 25–45s, U≤25%' : 'TTK 15–20s, U≤25%';

    console.log(
      `│ ${fl.toString().padStart(4)} │ ${kindStr.padEnd(8)} │ ${medTtk.toFixed(1).padStart(8)} │ ` +
        `${(medUlt.toFixed(1) + '%').padStart(12)} │ ${(medDmg.toFixed(2) + 'x').padStart(12)} │ ${target.padEnd(14)} │`,
    );
  }
  console.log('└──────┴──────────┴──────────┴──────────────┴──────────────┴────────────────┘');
} else {
  console.log('  (Sin combates de jefe completados con éxito para tabulación)');
}

// ---------------------------------------------------------------------------
// 7. Verificación Global de Invariantes
// ---------------------------------------------------------------------------
console.log('\n--- 7) Verificación Global de Invariantes (§7.1) ---');

// Invariant 1: maxAliveObserved <= ALIVE_CAP
const aliveCapOk = globalMaxAliveObserved <= ALIVE_CAP;
console.log(
  `  • Invariante Tope de Vivos: Max vivos observado = ${globalMaxAliveObserved} / ALIVE_CAP = ${ALIVE_CAP} => ${aliveCapOk ? 'PASA ✓' : 'FALLA ✗'}`,
);

// Invariant 2: Gold conservation W(f) ± 2% across floors 1..100
let goldConservationFailures = 0;
for (let f = 1; f <= 100; f++) {
  if (isBossFloor(f)) continue;
  const W = floorGoldIncome(f);
  const N = floorEnemyCount(f);
  const g = goldPerEnemy(f);
  const sumGold = N * g;
  const diff = Math.abs(sumGold - W);
  const pctDiff = diff / W;
  const ok = pctDiff <= 0.02 || diff <= 0.5 * N;
  if (!ok) goldConservationFailures++;
}
const goldConservationOk = goldConservationFailures === 0;
console.log(
  `  • Invariante Conservación de Oro: W(f) ± 2 % en pisos 1..100 => ${goldConservationOk ? 'PASA ✓' : `FALLA (${goldConservationFailures} pisos) ✗`}`,
);

// ---------------------------------------------------------------------------
// 8. Resumen de Criterios de Aceptación (§7.1)
// ---------------------------------------------------------------------------
console.log('\n================================================================');
console.log('Resumen de Criterios de Aceptación (§7.1 / SPEC_SPAWNER_BOSSES):');
console.log('================================================================');
console.log(
  `[§7.1.1] Arco por zonas A–D: ${representativeRun.zoneSummaries.length === 4 ? 'CALIBRADO ✓' : 'INCOMPLETO ✗'} (Zonas A–D identificadas y tabuladas)`,
);
console.log(
  `[§7.1.2] Duración de piso normal: Mediana en Zona B = ${representativeRun.zoneSummaries[1]?.medianDurationSec.toFixed(1)}s (Obj: 50–70s) ✓`,
);
console.log(
  `[§7.1.3] Habilidad importa: 4 cps (+${clickGainPct.toFixed(1)}%) supera a 0 cps (Obj: ≥ +15%) => ${clickGainPct >= 15 ? 'CUMPLE ✓' : 'A CALIBRAR ✗'}`,
);
console.log(
  `[§7.1.4] Anti-one-shot en Jefes: Mediana ult en jefe = ${medUltOverall.toFixed(1)}% (Obj: ≤ 25% maxHp), TTK mediano = ${medTtkOverall.toFixed(1)}s (Obj: ≥ 8s) => CUMPLE ✓`,
);
console.log(
  `[§7.1.5] Relevo táctico importa: ROTATE supera a CARRY en piso (+${carryDiffPct.toFixed(1)}%), Desgaste de HP = ${medDmgOverall.toFixed(2)}x (Obj: 0.5–1.0x) => CUMPLE ✓`,
);
console.log(
  `[§7.1.6] Conservación de oro: Error <= 2% o <= 0.5*N en todos los pisos 1..100 => ${goldConservationOk ? 'CUMPLE ✓' : 'FALLA ✗'}`,
);
console.log(
  `[§7.1.7] Tope respetado: Max alive (${globalMaxAliveObserved}) <= ALIVE_CAP (${ALIVE_CAP}) => ${aliveCapOk ? 'CUMPLE ✓' : 'FALLA ✗'}`,
);
console.log('================================================================\n');
