/**
 * PokéBastion — persistent meta-state: collection, seals, awakening, loadout
 * and run settlement (PRD §3.1, §4.3). PURE TYPESCRIPT: no DOM / browser APIs;
 * persistence lives in src/storage. Every function returns a NEW MetaState.
 */

import type { LoadoutEntry, Rarity, RunStats } from './types';
import { INITIAL_PITY, pullOnce } from './gacha';
import type { PityState } from './gacha';
import { getEvolutionChain } from './evolution';
import {
  AWAKEN_FRAGMENT_COST,
  BIG_BOSS_FLOORS,
  DUPLICATE_FRAGMENTS,
  GACHA_PULL_COST,
  MAX_STARS,
  MINIBOSS_INTERVAL,
  SEALS_ASCENSION_FLOORS_PER_SEAL,
  SEALS_FIRST_CLEAR_MAJOR_BOSS,
  SEALS_FIRST_CLEAR_MINIBOSS,
  STARTER_IDS,
  STARTING_SEALS,
} from '../config/balance.config';
import { ALL_POOL_IDS } from '../data/gachaPools';

export const TEAM_SIZE = 6;
export const META_VERSION = 2;

export interface CollectionEntry {
  /** Awakening rank 1..MAX_STARS. */
  stars: number;
  /** Fragmentos de Vínculo banked toward the next rank. */
  fragments: number;
  /** Shiny collectible owned (Phase 3C); always false in Phase 2, dead-data prep per handoff §2.2. */
  shinyOwned: boolean;
  /** Shiny currently equipped (Phase 3C); always false in Phase 2, dead-data prep per handoff §2.2. */
  shinyActive: boolean;
}

export interface MetaState {
  schemaVersion: typeof META_VERSION;
  starterChosen: boolean;
  /** Sellos de Reclutamiento (gacha currency). */
  seals: number;
  /** Owned species, keyed by BASE-form id. */
  collection: Record<string, CollectionEntry>;
  /** 6 slots of base-form ids (null = empty). Slot order = hotkeys 1-6. */
  loadout: (string | null)[];
  pity: PityState;
  totalPulls: number;
  /** Boss floors already beaten at least once (first-clear rewards paid). */
  clearedBossFloors: number[];
  bestFloor: number;
  totalRuns: number;
}

export function createMeta(): MetaState {
  return {
    schemaVersion: META_VERSION,
    starterChosen: false,
    seals: 0,
    collection: {},
    loadout: Array<string | null>(TEAM_SIZE).fill(null),
    pity: { ...INITIAL_PITY },
    totalPulls: 0,
    clearedBossFloors: [],
    bestFloor: 0,
    totalRuns: 0,
  };
}

// ---------------------------------------------------------------------------
// Starter
// ---------------------------------------------------------------------------

/** First launch: own the chosen starter, put it in slot 1 and gift STARTING_SEALS. */
export function chooseStarter(meta: MetaState, starterId: string): MetaState {
  if (meta.starterChosen || !STARTER_IDS.includes(starterId)) return meta;
  const loadout = [...meta.loadout];
  loadout[0] = starterId;
  return {
    ...meta,
    starterChosen: true,
    seals: meta.seals + STARTING_SEALS,
    collection: { ...meta.collection, [starterId]: { stars: 1, fragments: 0, shinyOwned: false, shinyActive: false } },
    loadout,
  };
}

// ---------------------------------------------------------------------------
// Gacha
// ---------------------------------------------------------------------------

export interface PullOutcome {
  speciesId: string;
  rarity: Rarity;
  isNew: boolean;
  /** Fragments granted when the pull was a duplicate (0 for new species). */
  fragmentsGained: number;
  guaranteedBy?: 'EPIC' | 'LEGENDARY';
  /** Loadout slot index when a new species auto-filled an empty slot. */
  autoSlot?: number;
}

export interface PullBatch {
  meta: MetaState;
  outcomes: PullOutcome[];
}

export function canAffordPulls(meta: MetaState, count: number): boolean {
  return count > 0 && meta.seals >= count * GACHA_PULL_COST;
}

/**
 * Spend seals on `count` pulls. Returns the same meta and no outcomes when the
 * player cannot afford it. New species auto-fill the first empty loadout slot.
 */
export function pullGacha(meta: MetaState, count: number, rng: () => number): PullBatch {
  if (!canAffordPulls(meta, count)) return { meta, outcomes: [] };

  let seals = meta.seals - count * GACHA_PULL_COST;
  let pity = meta.pity;
  const collection: Record<string, CollectionEntry> = { ...meta.collection };
  const loadout = [...meta.loadout];
  const outcomes: PullOutcome[] = [];

  for (let i = 0; i < count; i++) {
    const res = pullOnce(pity, rng);
    pity = res.pity;
    const owned = collection[res.speciesId];
    if (owned) {
      const gain = DUPLICATE_FRAGMENTS[res.rarity];
      collection[res.speciesId] = { ...owned, fragments: owned.fragments + gain };
      outcomes.push({ speciesId: res.speciesId, rarity: res.rarity, isNew: false, fragmentsGained: gain, guaranteedBy: res.guaranteedBy });
    } else {
      collection[res.speciesId] = { stars: 1, fragments: 0, shinyOwned: false, shinyActive: false };
      const slot = loadout.indexOf(null);
      if (slot >= 0) loadout[slot] = res.speciesId;
      outcomes.push({
        speciesId: res.speciesId,
        rarity: res.rarity,
        isNew: true,
        fragmentsGained: 0,
        guaranteedBy: res.guaranteedBy,
        autoSlot: slot >= 0 ? slot : undefined,
      });
    }
  }

  return {
    meta: { ...meta, seals, pity, collection, loadout, totalPulls: meta.totalPulls + count },
    outcomes,
  };
}

// ---------------------------------------------------------------------------
// Awakening (stars)
// ---------------------------------------------------------------------------

/** Fragments needed for the next rank, or null when maxed / not owned. */
export function nextAwakenCost(meta: MetaState, speciesId: string): number | null {
  const entry = meta.collection[speciesId];
  if (!entry || entry.stars >= MAX_STARS) return null;
  return AWAKEN_FRAGMENT_COST[entry.stars + 1];
}

export function canAwaken(meta: MetaState, speciesId: string): boolean {
  const cost = nextAwakenCost(meta, speciesId);
  return cost !== null && meta.collection[speciesId].fragments >= cost;
}

/** Spend fragments to raise a species by one star. */
export function awaken(meta: MetaState, speciesId: string): MetaState {
  if (!canAwaken(meta, speciesId)) return meta;
  const entry = meta.collection[speciesId];
  const cost = AWAKEN_FRAGMENT_COST[entry.stars + 1];
  return {
    ...meta,
    collection: {
      ...meta.collection,
      [speciesId]: { ...entry, stars: entry.stars + 1, fragments: entry.fragments - cost },
    },
  };
}

// ---------------------------------------------------------------------------
// Loadout (Caja Pokémon)
// ---------------------------------------------------------------------------

/**
 * Put an owned species into `slot` (or clear it with null). A species can only
 * occupy one slot, so placing one that is already on the team swaps the two.
 */
export function setLoadoutSlot(meta: MetaState, slot: number, speciesId: string | null): MetaState {
  if (!Number.isInteger(slot) || slot < 0 || slot >= TEAM_SIZE) return meta;
  if (speciesId !== null && !meta.collection[speciesId]) return meta;

  const loadout = [...meta.loadout];
  if (speciesId === null) {
    loadout[slot] = null;
    return { ...meta, loadout };
  }
  // handoff §2.6: Sinergias (3B) assume one Pokémon per evolutionary line.
  const chain = getEvolutionChain(speciesId);
  for (let i = 0; i < TEAM_SIZE; i++) {
    if (i === slot) continue;
    const other = loadout[i];
    if (!other || other === speciesId) continue;
    if (chain.includes(other) || getEvolutionChain(other).includes(speciesId)) return meta;
  }
  const from = loadout.indexOf(speciesId);
  const displaced = loadout[slot];
  loadout[slot] = speciesId;
  if (from >= 0 && from !== slot) loadout[from] = displaced;
  return { ...meta, loadout };
}

export function loadoutSize(meta: MetaState): number {
  return meta.loadout.filter((id) => id !== null).length;
}

/** Loadout in the shape the core consumes at run start. */
export function loadoutToEntries(meta: MetaState): (LoadoutEntry | null)[] {
  return meta.loadout.map((id) => {
    if (!id) return null;
    const entry = meta.collection[id];
    return entry ? { definitionId: id, stars: entry.stars, shinyActive: entry.shinyActive } : null;
  });
}

// ---------------------------------------------------------------------------
// Run settlement
// ---------------------------------------------------------------------------

export interface RunRewards {
  /** Boss floors beaten for the first time this run. */
  firstClearFloors: number[];
  sealsFirstClear: number;
  /** "Ascensión": 1 seal per SEALS_ASCENSION_FLOORS_PER_SEAL floors reached. */
  sealsAscension: number;
  sealsTotal: number;
  newBestFloor: boolean;
}

/** Boss floors strictly below `floorReached` (the floor you died on was not cleared). */
export function bossFloorsClearedBelow(floorReached: number): number[] {
  const out: number[] = [];
  for (let f = MINIBOSS_INTERVAL; f < floorReached; f += MINIBOSS_INTERVAL) out.push(f);
  return out;
}

/**
 * Pay out the end-of-run seals. Call exactly ONCE per finished run (the UI
 * layer guards this); calling twice would pay the ascension bonus twice, though
 * first-clear rewards are naturally idempotent.
 */
export function settleRun(meta: MetaState, runStats: Pick<RunStats, 'floorReached'>): { meta: MetaState; rewards: RunRewards } {
  const floorReached = Math.max(1, Math.floor(runStats.floorReached));
  const known = new Set(meta.clearedBossFloors);
  const firstClearFloors = bossFloorsClearedBelow(floorReached).filter((f) => !known.has(f));
  const sealsFirstClear = firstClearFloors.reduce(
    (sum, f) => sum + (BIG_BOSS_FLOORS.includes(f) ? SEALS_FIRST_CLEAR_MAJOR_BOSS : SEALS_FIRST_CLEAR_MINIBOSS),
    0,
  );
  const sealsAscension = Math.floor(floorReached / SEALS_ASCENSION_FLOORS_PER_SEAL);
  const sealsTotal = sealsFirstClear + sealsAscension;
  const newBestFloor = floorReached > meta.bestFloor;

  return {
    meta: {
      ...meta,
      seals: meta.seals + sealsTotal,
      clearedBossFloors: [...meta.clearedBossFloors, ...firstClearFloors].sort((a, b) => a - b),
      bestFloor: Math.max(meta.bestFloor, floorReached),
      totalRuns: meta.totalRuns + 1,
    },
    rewards: { firstClearFloors, sealsFirstClear, sealsAscension, sealsTotal, newBestFloor },
  };
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/**
 * Validate untrusted persisted data into a safe MetaState. Unknown species are
 * dropped, numbers are clamped, the loadout is repaired. Anything unusable
 * yields a fresh meta (a corrupt save must never brick the game).
 */
export function sanitizeMeta(raw: unknown): MetaState {
  const fresh = createMeta();
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion !== META_VERSION) return fresh;

  const known = new Set(ALL_POOL_IDS);
  const collection: Record<string, CollectionEntry> = {};
  if (r.collection && typeof r.collection === 'object') {
    for (const [id, v] of Object.entries(r.collection as Record<string, unknown>)) {
      if (!known.has(id) || !v || typeof v !== 'object') continue;
      const e = v as Record<string, unknown>;
      const stars = isCount(e.stars) ? Math.max(1, Math.min(MAX_STARS, Math.floor(e.stars))) : 1;
      const fragments = isCount(e.fragments) ? Math.floor(e.fragments) : 0;
      collection[id] = { stars, fragments, shinyOwned: e.shinyOwned === true, shinyActive: e.shinyActive === true };
    }
  }

  const loadout = Array<string | null>(TEAM_SIZE).fill(null);
  const used = new Set<string>();
  if (Array.isArray(r.loadout)) {
    for (let i = 0; i < TEAM_SIZE; i++) {
      const id = r.loadout[i];
      if (typeof id === 'string' && collection[id] && !used.has(id)) {
        loadout[i] = id;
        used.add(id);
      }
    }
  }

  const pityRaw = (r.pity && typeof r.pity === 'object' ? r.pity : {}) as Record<string, unknown>;
  const cleared = Array.isArray(r.clearedBossFloors)
    ? Array.from(new Set(r.clearedBossFloors.filter((f): f is number => Number.isInteger(f) && f > 0))).sort((a, b) => a - b)
    : [];

  return {
    schemaVersion: META_VERSION,
    starterChosen: r.starterChosen === true && Object.keys(collection).length > 0,
    seals: isCount(r.seals) ? Math.floor(r.seals) : 0,
    collection,
    loadout,
    pity: {
      sinceEpic: isCount(pityRaw.sinceEpic) ? Math.floor(pityRaw.sinceEpic) : 0,
      sinceLegendary: isCount(pityRaw.sinceLegendary) ? Math.floor(pityRaw.sinceLegendary) : 0,
    },
    totalPulls: isCount(r.totalPulls) ? Math.floor(r.totalPulls) : 0,
    clearedBossFloors: cleared,
    bestFloor: isCount(r.bestFloor) ? Math.floor(r.bestFloor) : 0,
    totalRuns: isCount(r.totalRuns) ? Math.floor(r.totalRuns) : 0,
  };
}

/**
 * Upgrade an untrusted persisted save to the current schema, then sanitize it.
 * PURE + deterministic: no Date / Math.random. v1 (`version: 1`) is the only
 * shipped shape; v2 already carries `schemaVersion`.
 */
export function migrateMeta(raw: unknown): MetaState {
  if (!raw || typeof raw !== 'object') return createMeta();
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion === META_VERSION) return sanitizeMeta(r);
  if (r.version !== 1) return createMeta();

  const collection: Record<string, unknown> = {};
  if (r.collection && typeof r.collection === 'object') {
    for (const [id, v] of Object.entries(r.collection as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      collection[id] = { ...(v as Record<string, unknown>), shinyOwned: false, shinyActive: false };
    }
  }
  const { version: _v1, ...rest } = r;
  return sanitizeMeta({ ...rest, schemaVersion: META_VERSION, collection });
}
