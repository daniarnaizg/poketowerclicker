/**
 * PokéBastion — main integration component.
 * Owns the rAF loop: drains store input -> tickGame -> pushes state to the
 * store (throttled) -> draws the arena. The store is the UI's read surface.
 */

import { useEffect, useRef } from 'preact/hooks';
import { ArenaRenderer } from './renderer/arena';
import './renderer/arena.css';
import { useGameStore, useGameState } from './ui/store';
import { useMetaStore } from './ui/metaStore';
import { HubScreen } from './ui/components/HubScreen';
import { loadoutToEntries } from './core/meta';
import { StarterSelection } from './ui/components/StarterSelection';
import { TeamBar } from './ui/components/TeamBar';
import { BastionUpgrades } from './ui/components/BastionUpgrades';
import { GameHUD } from './ui/components/GameHUD';
import { GameOverModal } from './ui/components/GameOverModal';
import { tickGame } from './core/gameLoop';
import { TYPE_CHART } from './core/damage';
import { POKEDEX } from './data/pokemon';
import { ARENA } from './config/arena.config';
import { BASTION_BASE_HP, FIXED_TIMESTEP, HOLD_FIRE_INTERVAL_MS } from './config/balance.config';
import type {
  BastionUpgrades as BastionUpgradeLevels,
  Cooldowns6,
  GameConfig,
  GamePhase,
  GameState,
  Team6,
  TeamSlot,
} from './core/types';

/** Paso fijo del núcleo y máximo de pasos de recuperación por fotograma. */
const STEP_MS = FIXED_TIMESTEP * 1000;
const MAX_CATCHUP_STEPS = 5;

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
  UP_WALL: 0,
};

function emptySlot(index: number): TeamSlot {
  return { index, pokemon: null, isActive: false, hotSwapCooldownSec: 0 };
}

/**
 * Bootstrap state the loop ticks from. STARTER_SELECT on a first launch, MENU
 * (the Hub) once a starter exists; `startRun` input flips it to PLAYING.
 */
function createInitialState(phase: GamePhase = 'STARTER_SELECT'): GameState {
  return {
    phase,
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
  const metaLoaded = useMetaStore((s) => s.loaded);
  const rewards = useMetaStore((s) => s.rewards);

  // Load the persisted meta (collection, seals, loadout) once.
  useEffect(() => {
    void useMetaStore.getState().init();
  }, []);

  // Once the save is read, a returning player lands in the Hub instead of the starter modal.
  useEffect(() => {
    if (!metaLoaded) return;
    if (useMetaStore.getState().meta.starterChosen && stateRef.current.phase === 'STARTER_SELECT') {
      stateRef.current = createInitialState('MENU');
    }
  }, [metaLoaded]);

  // Pay out Sellos exactly once when a run ends (guarded inside the store).
  useEffect(() => {
    if (phase === 'GAME_OVER' && gameState) {
      useMetaStore.getState().settleFinishedRun(gameState.runStats);
    }
  }, [phase, gameState]);

  // Simulation loop: one rAF frame == one tickGame call + one draw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new ArenaRenderer(canvas);
    const store = useGameStore.getState();
    store.setGameState(stateRef.current);

    // Click attack (mouse + touch): `pointerdown` fires once, then the frame
    // loop repeats it every HOLD_FIRE_INTERVAL_MS (hold-to-fire cap). Pointer
    // capture keeps the release even when it happens outside the canvas.
    const hold = { active: false, x: 0, y: 0, lastFire: 0 };
    const toArena = (e: PointerEvent): { x: number; y: number } | null => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      return {
        x: (e.clientX - rect.left) * (ARENA.SIZE / rect.width),
        y: (e.clientY - rect.top) * (ARENA.SIZE / rect.height),
      };
    };
    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 0) return;
      const point = toArena(e);
      if (!point) return;
      hold.active = true;
      hold.x = point.x;
      hold.y = point.y;
      hold.lastFire = performance.now();
      canvas.setPointerCapture(e.pointerId);
      store.requestClickAttack(hold.x, hold.y);
    };
    const onPointerEnd = (): void => {
      hold.active = false;
    };
    // Right click = ultimate (PRD §3.3 "clic secundario"); never opens the browser menu.
    const onContextMenu = (e: MouseEvent): void => {
      e.preventDefault();
      store.requestUltimate();
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerEnd);
    canvas.addEventListener('pointercancel', onPointerEnd);
    canvas.addEventListener('contextmenu', onContextMenu);

    let raf = 0;
    let last = performance.now();
    // Acumulador: tickGame descarta el resto de delta/paso fijo, así que en monitores
    // de >60 Hz (delta < 16,7 ms) el juego no avanzaba nunca. Acumulamos aquí y
    // pasamos solo múltiplos exactos del paso fijo.
    let acc = 0;
    const frame = (now: number): void => {
      acc = Math.min(acc + (now - last), STEP_MS * MAX_CATCHUP_STEPS);
      last = now;
      const steps = Math.floor((acc + 0.001) / STEP_MS);
      acc -= steps * STEP_MS;
      if (hold.active && now - hold.lastFire >= HOLD_FIRE_INTERVAL_MS) {
        hold.lastFire = now;
        store.requestClickAttack(hold.x, hold.y);
      }
      const input = store.consumeInput();
      const delta = steps > 0 ? steps * STEP_MS + 0.001 : 0;
      const next = tickGame(stateRef.current, input, GAME_CONFIG, delta, rngRef.current);
      stateRef.current = next;
      store.setGameState(next); // throttled to ~10 Hz, always on phase change
      renderer.render(next);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
      canvas.removeEventListener('contextmenu', onContextMenu);
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

  /** First launch: the starter joins the collection, then the player enters the Hub. */
  const handleStarter = (id: string): void => {
    useMetaStore.getState().chooseStarter(id);
    stateRef.current = createInitialState('MENU');
    useGameStore.getState().startNewGame('MENU');
  };

  /** Hub -> run, using the loadout configured in the Caja. */
  const handleStartRun = (): void => {
    const meta = useMetaStore.getState().meta;
    useMetaStore.getState().beginRun();
    useGameStore.getState().requestStartRun(loadoutToEntries(meta));
  };

  /** Game over -> back to the Hub (collection, gacha and awakening). */
  const handleRestart = (): void => {
    stateRef.current = createInitialState('MENU');
    rngRef.current = mulberry32(GAME_CONFIG.seed);
    useGameStore.getState().startNewGame('MENU');
  };

  return (
    <div class="flex h-screen flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div class="arena-stage min-h-[70vw] p-5 lg:min-h-0 lg:p-8">
        <div class="arena-container">
          <canvas ref={canvasRef} width={ARENA.SIZE} height={ARENA.SIZE} />
        </div>
      </div>

      <div class="flex w-full flex-col gap-4 p-4 lg:h-full lg:w-[26rem] lg:overflow-hidden lg:p-6">
        {gameState && (
          <>
            <GameHUD
              gameState={gameState}
              onUltimate={() => useGameStore.getState().requestUltimate()}
              onToggleAutoAdvance={() =>
                useGameStore.getState().requestSetAutoAdvance(gameState.autoAdvanceWave === false)
              }
              onStartNextWave={() => useGameStore.getState().requestStartNextWave()}
            />
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

      {!metaLoaded && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-[#2858a8] text-xs text-white">
          CARGANDO…
        </div>
      )}
      {metaLoaded && phase === 'STARTER_SELECT' && <StarterSelection onSelect={handleStarter} />}
      {metaLoaded && phase === 'MENU' && <HubScreen onStart={handleStartRun} />}
      {phase === 'GAME_OVER' && gameState && (
        <GameOverModal
          runStats={gameState.runStats}
          team={gameState.team}
          rewards={rewards}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
