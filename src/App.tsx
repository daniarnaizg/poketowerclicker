/**
 * PokéBastion — main integration component.
 * Owns the rAF loop: drains store input -> tickGame -> pushes state to the
 * store (throttled) -> draws the arena. The store is the UI's read surface.
 */

import { useEffect, useRef } from 'preact/hooks';
import { ArenaRenderer } from './renderer/arena';
import './renderer/arena.css';
import { useGameStore, useGameState } from './ui/store';
import { StarterSelection } from './ui/components/StarterSelection';
import { TeamBar } from './ui/components/TeamBar';
import { BastionUpgrades } from './ui/components/BastionUpgrades';
import { GameHUD } from './ui/components/GameHUD';
import { GameOverModal } from './ui/components/GameOverModal';
import { tickGame } from './core/gameLoop';
import { TYPE_CHART } from './core/damage';
import { POKEDEX } from './data/pokemon';
import { ARENA } from './config/arena.config';
import { BASTION_BASE_HP } from './config/balance.config';
import type {
  BastionUpgrades as BastionUpgradeLevels,
  Cooldowns6,
  GameConfig,
  GameState,
  Team6,
  TeamSlot,
} from './core/types';

/** Seed 1 == "seed from floor 1"; each run restarts the same deterministic stream. */
const GAME_CONFIG: GameConfig = { pokedex: POKEDEX, typeChart: TYPE_CHART, seed: 1 };

/** Deterministic PRNG; the core injects randomness through this in every step. */
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

const ZERO_UPGRADES: BastionUpgradeLevels = {
  UP_CLICK: 0,
  UP_HP: 0,
  UP_MULTI: 0,
  UP_ARROW: 0,
  UP_SPD: 0,
  UP_CRIT: 0,
  UP_CDMG: 0,
  UP_GOLD: 0,
};

function emptySlot(index: number): TeamSlot {
  return { index, pokemon: null, isActive: false, hotSwapCooldownSec: 0 };
}

/** Bootstrap state the loop ticks from; the starter pick flips it to PLAYING. */
function createInitialState(): GameState {
  return {
    phase: 'STARTER_SELECT',
    floor: 1,
    team: [emptySlot(0), emptySlot(1), emptySlot(2), emptySlot(3), emptySlot(4), emptySlot(5)] as Team6,
    teamLevel: 1,
    gold: 0,
    bastionHp: BASTION_BASE_HP,
    bastionMaxHp: BASTION_BASE_HP,
    bastionUpgrades: { ...ZERO_UPGRADES },
    enemies: [],
    projectiles: [],
    floatingTexts: [],
    ultimateCharge: 0,
    ultimateMax: 0,
    waveEnemiesRemaining: 0,
    hotSwapCooldowns: [0, 0, 0, 0, 0, 0] as Cooldowns6,
    runStats: {
      totalKills: 0,
      totalGoldEarned: 0,
      totalDamageDealt: 0,
      damagePerSlot: [0, 0, 0, 0, 0, 0],
      mvpSlotIndex: -1,
      floorReached: 1,
      durationSec: 0,
    },
  };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const rngRef = useRef<() => number>(mulberry32(GAME_CONFIG.seed));

  const phase = useGameStore((s) => s.phase);
  const gameState = useGameState();

  // Simulation loop: one rAF frame == one tickGame call + one draw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new ArenaRenderer(canvas);
    const store = useGameStore.getState();
    store.setGameState(stateRef.current);

    let raf = 0;
    let last = performance.now();
    const frame = (now: number): void => {
      const delta = now - last;
      last = now;
      const input = store.consumeInput();
      const next = tickGame(stateRef.current, input, GAME_CONFIG, delta, rngRef.current);
      stateRef.current = next;
      store.setGameState(next); // throttled to ~10 Hz, always on phase change
      renderer.render(next);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      renderer.destroy();
    };
  }, []);

  // Hotkeys: 1-6 hot-swap, Space fires the active Pokémon's ultimate.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const store = useGameStore.getState();
      if (e.code === 'Space') {
        e.preventDefault();
        store.requestUltimate();
        return;
      }
      const slot = Number(e.key);
      if (Number.isInteger(slot) && slot >= 1 && slot <= 6) store.requestHotSwap(slot - 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Click attack: map the CSS-scaled canvas rect back to 384x384 logical space.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMouseDown = (e: MouseEvent): void => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = (e.clientX - rect.left) * (ARENA.SIZE / rect.width);
      const y = (e.clientY - rect.top) * (ARENA.SIZE / rect.height);
      useGameStore.getState().requestClickAttack(x, y);
    };
    canvas.addEventListener('mousedown', onMouseDown);
    return () => canvas.removeEventListener('mousedown', onMouseDown);
  }, []);

  const handleRestart = (): void => {
    stateRef.current = createInitialState();
    rngRef.current = mulberry32(GAME_CONFIG.seed);
    useGameStore.getState().startNewGame();
  };

  return (
    <div class="flex h-screen bg-gray-900 text-white">
      <div class="flex flex-1 items-center justify-center p-4">
        <div class="arena-container">
          <canvas ref={canvasRef} width={ARENA.SIZE} height={ARENA.SIZE} />
          {gameState && <GameHUD gameState={gameState} />}
        </div>
      </div>

      <div class="flex w-80 flex-col gap-2 overflow-y-auto p-4">
        {gameState && (
          <>
            <TeamBar
              team={gameState.team}
              hotSwapCooldowns={gameState.hotSwapCooldowns}
              teamLevel={gameState.teamLevel}
              onHotSwap={(i) => useGameStore.getState().requestHotSwap(i)}
            />
            <BastionUpgrades
              upgrades={gameState.bastionUpgrades}
              gold={gameState.gold}
              teamLevel={gameState.teamLevel}
              onPurchase={(id) => useGameStore.getState().purchaseUpgrade(id)}
              onBuyTeamLevel={() => useGameStore.getState().requestTeamLevelUp()}
            />
          </>
        )}
      </div>

      {phase === 'STARTER_SELECT' && (
        <StarterSelection onSelect={(id) => useGameStore.getState().selectStarter(id)} />
      )}
      {phase === 'GAME_OVER' && gameState && (
        <GameOverModal runStats={gameState.runStats} team={gameState.team} onRestart={handleRestart} />
      )}
    </div>
  );
}
