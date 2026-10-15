/**
 * PokéBastion — Zustand bridge between the 60 Hz game loop and the Preact UI.
 *
 * The loop owns the simulation: each fixed step it drains queued UI input with
 * `consumeInput()`, advances the core, then pushes the result back through
 * `setGameState()`. Pushes are throttled (on phase change, else every 100 ms)
 * so the HUD renders at ~10 Hz instead of 60. `hudVersion` bumps on every
 * accepted push so selectors refresh even when the loop mutates one GameState
 * object in place (same reference).
 */

import { create } from 'zustand';
import type { BastionUpgradeId, GameInput, GamePhase, GameState } from '../core/types';

/** HUD refresh cadence in ms when the phase is unchanged. */
const HUD_INTERVAL_MS = 100;

let lastHudPush = 0;
let lastPushedPhase: GamePhase | null = null;

interface GameStore {
  gameState: GameState | null;
  phase: GamePhase;
  /** Bumps on each accepted `setGameState`; subscribe to force HUD renders. */
  hudVersion: number;
  /** Input queued by UI actions, drained by the loop each fixed step. */
  pendingInput: GameInput;

  setGameState: (state: GameState) => void;
  selectStarter: (starterId: string) => void;
  requestHotSwap: (slotIndex: number) => void;
  requestUltimate: () => void;
  requestClickAttack: (x: number, y: number) => void;
  purchaseUpgrade: (upgradeId: BastionUpgradeId) => void;
  requestTeamLevelUp: () => void;
  consumeInput: () => GameInput;
  startNewGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => {
  const queue = (partial: GameInput) =>
    set((s) => ({ pendingInput: { ...s.pendingInput, ...partial } }));

  return {
    gameState: null,
    phase: 'STARTER_SELECT',
    hudVersion: 0,
    pendingInput: {},

    setGameState: (incoming) => {
      const now = performance.now();
      const phaseChanged = incoming.phase !== lastPushedPhase;
      if (!phaseChanged && now - lastHudPush < HUD_INTERVAL_MS) return;
      lastHudPush = now;
      lastPushedPhase = incoming.phase;
      set((s) => ({
        gameState: incoming,
        phase: incoming.phase,
        hudVersion: s.hudVersion + 1,
      }));
    },

    selectStarter: (starterId) => queue({ selectStarter: starterId }),
    requestHotSwap: (slotIndex) => queue({ hotSwapIndex: slotIndex }),
    requestUltimate: () => queue({ useUltimate: true }),
    requestClickAttack: (x, y) => queue({ click: { x, y } }),
    purchaseUpgrade: (upgradeId) => queue({ buyUpgrade: upgradeId }),
    requestTeamLevelUp: () => queue({ buyTeamLevel: true }),

    consumeInput: () => {
      const input = get().pendingInput;
      if (Object.keys(input).length > 0) set({ pendingInput: {} });
      return input;
    },

    startNewGame: () => {
      lastHudPush = 0;
      lastPushedPhase = null;
      set({ gameState: null, phase: 'STARTER_SELECT', hudVersion: 0, pendingInput: {} });
    },
  };
});

/** Reads the throttled GameState, refreshing on every accepted push. */
export function useGameState(): GameState | null {
  const gameState = useGameStore((s) => s.gameState);
  useGameStore((s) => s.hudVersion);
  return gameState;
}
