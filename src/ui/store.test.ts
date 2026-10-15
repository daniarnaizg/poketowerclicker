import { beforeEach, describe, expect, it } from 'vitest';
import type { GameState, TeamSlot } from '../core/types';
import { useGameStore } from './store';

function makeState(phase: GameState['phase']): GameState {
  const slot: TeamSlot = { index: 0, pokemon: null, isActive: true, hotSwapCooldownSec: 0 };
  return {
    phase,
    floor: 1,
    team: [slot, slot, slot, slot, slot, slot],
    teamLevel: 1,
    gold: 0,
    bastionHp: 100,
    bastionMaxHp: 100,
    bastionUpgrades: {
      UP_CLICK: 0,
      UP_HP: 0,
      UP_MULTI: 0,
      UP_ARROW: 0,
      UP_SPD: 0,
      UP_CRIT: 0,
      UP_CDMG: 0,
      UP_GOLD: 0,
    },
    enemies: [],
    projectiles: [],
    floatingTexts: [],
    ultimateCharge: 0,
    ultimateMax: 100,
    waveEnemiesRemaining: 0,
    hotSwapCooldowns: [0, 0, 0, 0, 0, 0],
    runStats: {
      totalKills: 0,
      totalGoldEarned: 0,
      totalDamageDealt: 0,
      mvpSlotIndex: -1,
      floorReached: 1,
      durationSec: 0,
    },
  };
}

describe('useGameStore', () => {
  beforeEach(() => useGameStore.getState().startNewGame());

  it('queues UI input and drains it once', () => {
    const s = useGameStore.getState();
    s.selectStarter('0004');
    s.requestHotSwap(2);
    s.requestUltimate();
    s.requestClickAttack(10, 20);
    s.purchaseUpgrade('UP_HP');
    s.requestTeamLevelUp();

    expect(useGameStore.getState().consumeInput()).toEqual({
      selectStarter: '0004',
      hotSwapIndex: 2,
      useUltimate: true,
      click: { x: 10, y: 20 },
      buyUpgrade: 'UP_HP',
      buyTeamLevel: true,
    });
    expect(useGameStore.getState().consumeInput()).toEqual({});
  });

  it('pushes on phase change and throttles same-phase frames', () => {
    useGameStore.getState().setGameState(makeState('STARTER_SELECT'));
    expect(useGameStore.getState().gameState?.phase).toBe('STARTER_SELECT');
    const pushed = useGameStore.getState().hudVersion;

    // Same phase within the 100 ms window must not bump the HUD.
    useGameStore.getState().setGameState(makeState('STARTER_SELECT'));
    expect(useGameStore.getState().hudVersion).toBe(pushed);

    useGameStore.getState().setGameState(makeState('PLAYING'));
    expect(useGameStore.getState().gameState?.phase).toBe('PLAYING');
    expect(useGameStore.getState().hudVersion).toBe(pushed + 1);
  });
});
