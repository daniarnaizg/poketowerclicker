// src/ui/store.ts — Zustand bridge between headless engine and reactive UI
import { create } from 'zustand';
import type { GameState, GameAction, TeamMember, Upgrades, GamePhase } from '../core/types';
import { GameEngine } from '../core/engine';

const engine = new GameEngine();

export interface UIState {
  phase: GamePhase;
  floor: number;
  gold: number;
  teamLevel: number;
  teamLevelCost: number;
  upgrades: Upgrades;
  team: (TeamMember | null)[];
  activeIndex: number;
  bastionHp: number;
  bastionMaxHp: number;
  ultimateCharge: number;
  waveTimerSec: number;
  bossActive: boolean;
  runaEarned: number;
  totalKills: number;
  elapsedSec: number;
  dispatch: (action: GameAction) => void;
}

export const useGameStore = create<UIState>((set) => {
  function syncFromEngine() {
    const s = engine.state;
    set({
      phase: s.phase,
      floor: s.floor,
      gold: s.gold,
      teamLevel: s.upgrades.teamLevel,
      teamLevelCost: s.upgrades.teamLevelCost,
      upgrades: { ...s.upgrades },
      team: [...s.team],
      activeIndex: s.activeIndex,
      bastionHp: s.bastionHp,
      bastionMaxHp: s.bastionMaxHp,
      ultimateCharge: s.ultimateCharge,
      waveTimerSec: s.waveTimerSec,
      bossActive: s.bossActive,
      runaEarned: s.runaEarned,
      totalKills: s.totalKills,
      elapsedSec: s.elapsedSec,
    });
  }

  engine.setOnStateChange(syncFromEngine);

  return {
    phase: 'STARTER_SELECT',
    floor: 1,
    gold: 0,
    teamLevel: 1,
    teamLevelCost: 10,
    upgrades: engine.state.upgrades,
    team: engine.state.team,
    activeIndex: 0,
    bastionHp: 100,
    bastionMaxHp: 100,
    ultimateCharge: 0,
    waveTimerSec: 30,
    bossActive: false,
    runaEarned: 0,
    totalKills: 0,
    elapsedSec: 0,
    dispatch: (action: GameAction) => {
      engine.dispatch(action);
    },
  };
});

export { engine };
