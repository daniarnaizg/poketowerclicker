import { beforeEach, describe, expect, it } from 'vitest';
import { useMetaStore } from './metaStore';
import { STARTING_SEALS } from '../config/balance.config';
import type { RunStats } from '../core/types';

const run = (floorReached: number): RunStats => ({
  totalKills: 0, totalGoldEarned: 0, totalDamageDealt: 0,
  damagePerSlot: [0, 0, 0, 0, 0, 0], mvpSlotIndex: -1, floorReached, durationSec: 0,
});

describe('useMetaStore', () => {
  beforeEach(async () => {
    await useMetaStore.getState().resetProgress();
    useMetaStore.getState().chooseStarter('0004');
  });

  it('chooses a starter once and grants the welcome seals', () => {
    const { meta } = useMetaStore.getState();
    expect(meta.starterChosen).toBe(true);
    expect(meta.seals).toBe(STARTING_SEALS);
    useMetaStore.getState().chooseStarter('0007');
    expect(useMetaStore.getState().meta.collection['0007']).toBeUndefined();
  });

  it('pays run rewards exactly once, even if called on every HUD refresh', () => {
    const s = useMetaStore.getState();
    s.beginRun();
    for (let i = 0; i < 25; i++) useMetaStore.getState().settleFinishedRun(run(23));
    const { meta, rewards } = useMetaStore.getState();
    expect(rewards?.sealsTotal).toBe(2 * 3 + 4);
    expect(meta.seals).toBe(STARTING_SEALS + 10);
    expect(meta.totalRuns).toBe(1);
  });

  it('pays again for the next run after beginRun, but not first-clears twice', () => {
    useMetaStore.getState().beginRun();
    useMetaStore.getState().settleFinishedRun(run(23));
    useMetaStore.getState().beginRun();
    useMetaStore.getState().settleFinishedRun(run(23));
    const { meta, rewards } = useMetaStore.getState();
    expect(rewards?.sealsFirstClear).toBe(0);
    expect(rewards?.sealsTotal).toBe(4);
    expect(meta.totalRuns).toBe(2);
    expect(meta.seals).toBe(STARTING_SEALS + 10 + 4);
  });

  it('pulls spend seals and keep the loadout valid', () => {
    useMetaStore.getState().pull(10);
    const { meta, lastPull } = useMetaStore.getState();
    expect(meta.seals).toBe(0);
    expect(lastPull).toHaveLength(10);
    useMetaStore.getState().pull(1); // cannot afford
    expect(useMetaStore.getState().meta.totalPulls).toBe(10);
  });
});
