/**
 * PokéBastion — simulación de línea base (headless) contra el núcleo REAL.
 *
 * Qué es: un bot determinista que juega con `tickGame` (src/core/gameLoop.ts) sin DOM
 * y mide hasta qué piso llega. Sirve para (a) verificar el estado de la economía antes
 * de la Fase 3 y (b) ser el germen del simulador `pnpm run test:balance` (PRD §7.3).
 *
 * Ejecutar (desde la raíz del repo):   npx tsx docs/analysis/sim-baseline.ts
 *
 * Validez: corre contra el `GameState` de la Fase 2. Los campos nuevos (statuses, stars,
 * ultimates) son opcionales, así que `initialState()` sigue siendo válido. Vive en
 * /docs a propósito: tsconfig solo incluye /src, así que no entra en el build ni en los tests.
 *
 * Supuestos del bot (limitaciones conocidas):
 *  - Solo el starter (Charmander), sin gacha, sin relevos, sin definitiva, sin runas.
 *  - Compra el elemento MÁS BARATO disponible cada 0,5 s (política ingenua) o solo ofensivo ('focus').
 *  - "Clics": apunta SIEMPRE al enemigo más cercano al centro, N veces/s (puntería perfecta).
 *  - Los relevos de piso son automáticos: `autoAdvanceWave` indefinido se trata como
 *    true, así que el bot no necesita mandar ningún input entre oleadas.
 */
import { tickGame } from '../../src/core/gameLoop';
import { TYPE_CHART } from '../../src/core/damage';
import { POKEDEX } from '../../src/data/pokemon';
import {
  BASTION_BASE_HP,
  enemyGoldValue,
  enemyHp,
  teamLevelCost,
  upgradeCost,
} from '../../src/config/balance.config';
import { BASTION_UPGRADE_IDS } from '../../src/core/types';
import type { BastionUpgradeId, GameConfig, GameState } from '../../src/core/types';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const emptySlot = (index: number) => ({ index, pokemon: null, isActive: false, hotSwapCooldownSec: 0 });

function initialState(): GameState {
  return {
    phase: 'STARTER_SELECT',
    floor: 1,
    team: [0, 1, 2, 3, 4, 5].map(emptySlot) as unknown as GameState['team'],
    teamLevel: 1,
    gold: 0,
    bastionHp: BASTION_BASE_HP,
    bastionMaxHp: BASTION_BASE_HP,
    bastionUpgrades: Object.fromEntries(BASTION_UPGRADE_IDS.map((k) => [k, 0])) as GameState['bastionUpgrades'],
    enemies: [],
    projectiles: [],
    floatingTexts: [],
    ultimateCharge: 0,
    ultimateMax: 0,
    waveEnemiesRemaining: 0,
    hotSwapCooldowns: [0, 0, 0, 0, 0, 0],
    runStats: {
      totalKills: 0, totalGoldEarned: 0, totalDamageDealt: 0,
      damagePerSlot: [0, 0, 0, 0, 0, 0], mvpSlotIndex: -1, floorReached: 1, durationSec: 0,
    },
  };
}

type Policy = 'cheapest' | 'focus';

function run(policy: Policy, clicksPerSec: number, seed: number, maxSec = 3600) {
  const cfg: GameConfig = { pokedex: POKEDEX, typeChart: TYPE_CHART, seed };
  const rng = mulberry32(seed);
  let s = tickGame(initialState(), { startRun: [{ definitionId: '0004', stars: 1 }, null, null, null, null, null] }, cfg, 0, rng);
  const dtMs = 1000 / 60 + 0.001;
  let frame = 0;
  while (s.phase === 'PLAYING' && s.runStats.durationSec < maxSec) {
    const input: Parameters<typeof tickGame>[1] = {};
    if (frame % 30 === 0) {
      const ids: BastionUpgradeId[] =
        policy === 'focus'
          ? ['UP_ARROW', 'UP_SPD', 'UP_CRIT', 'UP_CDMG', 'UP_MULTI', 'UP_HP']
          : [...BASTION_UPGRADE_IDS];
      const opts: { id: BastionUpgradeId | 'TEAM'; cost: number }[] = [
        { id: 'TEAM', cost: teamLevelCost(s.teamLevel) },
        ...ids.map((id) => ({ id, cost: upgradeCost(id, s.bastionUpgrades[id]) })),
      ].sort((a, b) => a.cost - b.cost);
      if (s.gold >= opts[0].cost) {
        if (opts[0].id === 'TEAM') input.buyTeamLevel = true;
        else input.buyUpgrade = opts[0].id;
      }
    }
    if (clicksPerSec > 0 && frame % Math.round(60 / clicksPerSec) === 0) {
      const t = s.enemies
        .filter((e) => e.alive)
        .sort((a, b) => Math.hypot(a.x - 192, a.y - 192) - Math.hypot(b.x - 192, b.y - 192))[0];
      if (t) input.click = { x: t.x, y: t.y };
    }
    s = tickGame(s, input, cfg, dtMs, rng);
    frame++;
  }
  return s;
}

console.log('=== 1) ¿Funciona el juego en modo idle puro? (20 s, 0 clics, sin compras)');
{
  const cfg: GameConfig = { pokedex: POKEDEX, typeChart: TYPE_CHART, seed: 1 };
  const rng = mulberry32(1);
  let s = tickGame(initialState(), { selectStarter: '0004' }, cfg, 0, rng);
  for (let i = 0; i < 60 * 20 && s.phase === 'PLAYING'; i++) s = tickGame(s, {}, cfg, 1000 / 60 + 0.001, rng);
  console.log(`piso ${s.floor} | bajas ${s.runStats.totalKills} | oro ${s.gold} | daño total ${s.runStats.totalDamageDealt} | HP bastión ${Math.round(s.bastionHp)}/${s.bastionMaxHp}`);
}

console.log('\n=== 1b) Bot idle (0 clics/s, compra más barata) — 600 s, semillas 1-3 (aceptación: piso ≥ 10)');
for (const seed of [1, 2, 3]) {
  const s = run('cheapest', 0, seed, 600);
  console.log(`semilla ${seed}: piso ${s.floor} en ${Math.round(s.runStats.durationSec)}s (NvEq ${s.teamLevel}, HP bastión ${Math.round(s.bastionHp)}/${s.bastionMaxHp}) | ${s.phase}`);
}

console.log('\n=== 2) Techo de la economía (bot con clics perfectos; aceptación 1,5 clics/s: piso ≥ 40)');
for (const [policy, cps] of [['cheapest', 1.5], ['focus', 1.5], ['cheapest', 4], ['focus', 4]] as const) {
  const rows = [1, 2, 3].map((seed) => {
    const s = run(policy, cps, seed);
    return `piso ${s.floor} en ${Math.round(s.runStats.durationSec)}s (NvEq ${s.teamLevel}, oro total ${Math.round(s.runStats.totalGoldEarned)})`;
  });
  console.log(`política=${policy} clics/s=${cps}: ${rows.join(' | ')}`);
}

console.log('\n=== 3) Brecha de escalado: HP de enemigos vs oro acumulado');
let cum = 0;
for (let f = 1; f <= 100; f++) {
  cum += 10 * enemyGoldValue(f);
  if ([10, 25, 50, 100].includes(f)) {
    const lvl = Math.floor(Math.log(1 + (cum * 0.22) / 20) / Math.log(1.22));
    console.log(`piso ${f}: HP enemigo ${enemyHp(f).toExponential(2)} | oro acumulado ${cum} | Nv. de Equipo comprable solo con ese oro ≈ ${lvl}`);
  }
}
console.log(`HP(piso100) / HP(piso25) = ${(enemyHp(100) / enemyHp(25)).toExponential(2)}`);
