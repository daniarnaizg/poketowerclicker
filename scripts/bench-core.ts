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
