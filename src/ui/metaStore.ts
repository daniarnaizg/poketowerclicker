/**
 * PokéBastion — Zustand store for the persistent meta layer (collection,
 * seals, gacha, awakening, loadout). The core stays pure: every rule lives in
 * src/core/meta.ts; this store only wires it to Math.random, persistence and
 * Preact. Each mutation saves to IndexedDB (fire-and-forget).
 */

import { create } from 'zustand';
import {
  awaken as awakenSpecies,
  chooseStarter as chooseStarterMeta,
  createMeta,
  pullGacha,
  setLoadoutSlot,
  settleRun as settleRunMeta,
} from '../core/meta';
import type { MetaState, PullOutcome, RunRewards } from '../core/meta';
import type { RunStats } from '../core/types';
import { clearMeta, loadMeta, saveMeta } from '../storage/saveGame';

interface MetaStore {
  meta: MetaState;
  /** False until the save has been read from storage. */
  loaded: boolean;
  /** Results of the most recent gacha batch (for the reveal list). */
  lastPull: PullOutcome[] | null;
  /** Rewards of the run that just ended; null while playing. */
  rewards: RunRewards | null;

  init: () => Promise<void>;
  chooseStarter: (id: string) => void;
  pull: (count: number) => void;
  awaken: (id: string) => void;
  setSlot: (slot: number, id: string | null) => void;
  /** Pay out a finished run exactly once (guarded until `beginRun`). */
  settleFinishedRun: (runStats: RunStats) => void;
  /** Re-arm the settle guard when a new run starts. */
  beginRun: () => void;
  resetProgress: () => Promise<void>;
}

let settled = false;

export const useMetaStore = create<MetaStore>((set, get) => {
  const commit = (meta: MetaState, extra: Partial<MetaStore> = {}): void => {
    set({ meta, ...extra });
    void saveMeta(meta);
  };

  return {
    meta: createMeta(),
    loaded: false,
    lastPull: null,
    rewards: null,

    init: async () => {
      if (get().loaded) return;
      const meta = await loadMeta();
      set({ meta, loaded: true });
    },

    chooseStarter: (id) => {
      const next = chooseStarterMeta(get().meta, id);
      if (next !== get().meta) commit(next);
    },

    pull: (count) => {
      const { meta } = get();
      const res = pullGacha(meta, count, Math.random);
      if (res.outcomes.length === 0) return;
      commit(res.meta, { lastPull: res.outcomes });
    },

    awaken: (id) => {
      const next = awakenSpecies(get().meta, id);
      if (next !== get().meta) commit(next);
    },

    setSlot: (slot, id) => {
      const next = setLoadoutSlot(get().meta, slot, id);
      if (next !== get().meta) commit(next);
    },

    settleFinishedRun: (runStats) => {
      if (settled) return;
      settled = true;
      const { meta, rewards } = settleRunMeta(get().meta, runStats);
      commit(meta, { rewards });
    },

    beginRun: () => {
      settled = false;
      set({ rewards: null });
    },

    resetProgress: async () => {
      await clearMeta();
      settled = false;
      set({ meta: createMeta(), lastPull: null, rewards: null });
    },
  };
});
