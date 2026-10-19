/**
 * PokéBastion — Benchmark del core con N enemigos vivos (spec: docs/SPEC_SPAWNER_BOSSES.md, WP6).
 *
 * Mide ms por `stepOnce` (vía tickGame) manteniendo la arena rellena a N enemigos
 * "inmortales" y casi inmóviles, para aislar el coste del core (movimiento, auto-disparo,
 * colisiones). NO mide el renderer ni la UI: para eso usar Chrome Performance.
 *
 * Uso: pnpm run bench:core   (añadir a package.json: "bench:core": "tsx scripts/bench-core.ts")
 */
import { tickGame } from '../src/core/gameLoop';
import { TYPE_CHART } from '../src/core/damage';
import { POKEDEX } from '../src/data/pokemon';
import { mulberry32 } from '../src/core/rng';
import { PokemonType } from '../src/core/types';
import type { GameConfig, GameState } from '../src/core/types';

const emptySlot = (index: number) => ({ index, pokemon: null, isActive: false, hotSwapCooldownSec: 0 });
const baseState = (): GameState =>
  ({
    phase: 'STARTER_SELECT',
    floor: 1,
    team: [0, 1, 2, 3, 4, 5].map(emptySlot),
    teamLevel: 1,
    gold: 0,
    bastionUpgrades: { UP_MULTI: 4, UP_ARROW: 10, UP_SPD: 10, UP_CRIT: 0, UP_CDMG: 0, UP_GOLD: 0, UP_AUTOCLICK: 0 },
    enemies: [],
    projectiles: [],
    floatingTexts: [],
    ultimateCharge: 0,
    ultimateMax: 0,
    waveEnemiesRemaining: 0,
    hotSwapCooldowns: [0, 0, 0, 0, 0, 0],
    runStats: {
      totalKills: 0, totalGoldEarned: 0, totalDamageDealt: 0, damagePerSlot: [0, 0, 0, 0, 0, 0],
      mvpSlotIndex: -1, floorReached: 1, durationSec: 0, manualClicks: 0, autoClicks: 0, defeatedBossFloors: [],
    },
  }) as unknown as GameState;

const cfg: GameConfig = { pokedex: POKEDEX, typeChart: TYPE_CHART, seed: 1 };
const STEPS = 600;

console.log('--- Tabla 1: Baseline sintético (N enemigos inmóviles) ---');
console.log('N enemigos | ms/step | % de un frame (16.7 ms) | proyectiles | textos');
for (const N of [10, 50, 100, 200, 400, 800]) {
  const rng = mulberry32(7);
  let s: any = tickGame(
    baseState(),
    { startRun: [{ definitionId: '0004', stars: 1 }, null, null, null, null, null] },
    cfg, 0, rng,
  );
  const dtMs = 1000 / 60 + 0.001;
  let id = 1_000_000;
  const t0 = performance.now();
  for (let i = 0; i < STEPS && s.phase === 'PLAYING'; i++) {
    const alive = s.enemies.filter((e: any) => e.alive).length;
    if (alive < N) {
      const add = [];
      for (let k = 0; k < N - alive; k++) {
        const a = rng() * Math.PI * 2;
        const r = 100 + rng() * 90;
        add.push({
          id: id++, x: 192 + Math.cos(a) * r, y: 192 + Math.sin(a) * r, hp: 1e9, maxHp: 1e9, alive: true,
          types: [PokemonType.Normal], speed: 0.01, goldValue: 1, isBoss: false, definitionId: '0019', kind: 'normal',
        });
      }
      s = { ...s, enemies: [...s.enemies, ...add], waveEnemiesRemaining: 9999 };
    }
    s = tickGame(s, {}, cfg, dtMs, rng);
  }
  const ms = (performance.now() - t0) / STEPS;
  console.log(
    `${String(N).padStart(10)} | ${ms.toFixed(3).padStart(7)} | ${((ms / 16.67) * 100).toFixed(1).padStart(22)}% | ${String(s.projectiles.length).padStart(11)} | ${s.floatingTexts.length}`,
  );
}

console.log('\n--- Tabla 2: Escenario realista WP6: >=30 proyectiles AoE/Pierce/Bounce + 5 jefes anclados + definitivas ---');
console.log('N enemigos | ms/step | % de un frame (16.7 ms) | proyectiles | textos');
let n100Ms = 0;

for (const N of [10, 50, 100, 200, 400, 800]) {
  const rng = mulberry32(7);
  let s: any = tickGame(
    baseState(),
    { startRun: [{ definitionId: '0004', stars: 1 }, null, null, null, null, null] },
    cfg, 0, rng,
  );
  const dtMs = 1000 / 60 + 0.001;
  let id = 2_000_000;
  let minProjectiles = 999;
  const t0 = performance.now();
  for (let i = 0; i < STEPS && s.phase === 'PLAYING'; i++) {
    // Mantener la salud del equipo activa para que los ataques periódicos de los 5 jefes no terminen la run
    if (s.team) {
      s.team = s.team.map((slot: any) =>
        slot.pokemon
          ? { ...slot, pokemon: { ...slot.pokemon, hp: slot.pokemon.maxHp, alive: true } }
          : slot,
      );
    }

    // 1. Mantener 5 jefes anclados y Math.max(0, N - 5) enemigos normales vivos
    const aliveBosses = s.enemies.filter((e: any) => e.alive && e.isBoss).length;
    const aliveNormals = s.enemies.filter((e: any) => e.alive && !e.isBoss).length;
    const targetNormals = Math.max(0, N - 5);
    const addBosses: any[] = [];
    if (aliveBosses < 5) {
      for (let k = 0; k < 5 - aliveBosses; k++) {
        const a = (k / 5) * Math.PI * 2;
        addBosses.push({
          id: id++,
          x: 192 + Math.cos(a) * 24,
          y: 192 + Math.sin(a) * 24,
          hp: 1e9,
          maxHp: 1e9,
          alive: true,
          types: [PokemonType.Normal],
          speed: 0.01,
          goldValue: 1,
          isBoss: true,
          definitionId: '0143',
          kind: 'boss',
          anchoredAtBastion: true,
          bossPhase: 2,
          bossAttackCooldownSec: 0.85,
        });
      }
    }
    const addNormals: any[] = [];
    if (aliveNormals < targetNormals) {
      for (let k = 0; k < targetNormals - aliveNormals; k++) {
        const a = rng() * Math.PI * 2;
        const r = 100 + rng() * 90;
        addNormals.push({
          id: id++,
          x: 192 + Math.cos(a) * r,
          y: 192 + Math.sin(a) * r,
          hp: 1e9,
          maxHp: 1e9,
          alive: true,
          types: [PokemonType.Normal],
          speed: 0.01,
          goldValue: 1,
          isBoss: false,
          definitionId: '0019',
          kind: 'normal',
        });
      }
    }
    if (addBosses.length > 0 || addNormals.length > 0) {
      s = { ...s, enemies: [...s.enemies, ...addBosses, ...addNormals], waveEnemiesRemaining: 9999 };
    }

    // 2. Si s.projectiles.length < 35, se inyectan proyectiles con splashRadius: 36, pierce: 2, bounce: 2
    if (s.projectiles.length < 35) {
      const needed = 35 - s.projectiles.length;
      const addProj: any[] = [];
      for (let k = 0; k < needed; k++) {
        const a = rng() * Math.PI * 2;
        const speed = 120 + rng() * 60;
        const r = rng() * 150;
        addProj.push({
          id: id++,
          x: 192 + Math.cos(a) * r,
          y: 192 + Math.sin(a) * r,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          damage: 50,
          types: [PokemonType.Fire],
          fromPlayer: true,
          splashRadius: 36,
          pierce: 2,
          bounce: 2,
          hitIds: [],
        });
      }
      s = { ...s, projectiles: [...s.projectiles, ...addProj] };
    }

    // 3. Cada 60 steps se cargue y dispare useUltimate: true
    const input: any = {};
    if (i % 60 === 0) {
      s = { ...s, ultimateCharge: s.ultimateMax };
      input.useUltimate = true;
    }

    s = tickGame(s, input, cfg, dtMs, rng);
    if (s.projectiles.length < minProjectiles) {
      minProjectiles = s.projectiles.length;
    }
  }
  const ms = (performance.now() - t0) / STEPS;
  if (N === 100) {
    n100Ms = ms;
  }
  console.log(
    `${String(N).padStart(10)} | ${ms.toFixed(3).padStart(7)} | ${((ms / 16.67) * 100).toFixed(1).padStart(22)}% | ${String(s.projectiles.length).padStart(11)} | ${s.floatingTexts.length}`,
  );
}

if (n100Ms > 1.0) {
  console.error(`\n[FALLO] Presupuesto core superado en N=100: ${n100Ms.toFixed(3)} ms/step > 1.0 ms/step`);
  process.exit(1);
} else {
  console.log(`\n[OK] Presupuesto core cumplido en N=100: ${n100Ms.toFixed(3)} ms/step <= 1.0 ms/step`);
}

