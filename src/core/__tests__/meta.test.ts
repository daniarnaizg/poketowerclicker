import { describe, it, expect } from 'vitest';
import {
  awaken, canAwaken, chooseStarter, createMeta, loadoutSize, loadoutToEntries,
  findLineConflict, nextAwakenCost, pullGacha, sanitizeMeta, setLoadoutSlot, setTeam, settleRun, bossFloorsClearedBelow,
} from '../meta';
import type { MetaState } from '../meta';
import {
  AWAKEN_FRAGMENT_COST, DUPLICATE_FRAGMENTS, GACHA_MULTI_PULL, SEALS_FIRST_CLEAR_MAJOR_BOSS,
  SEALS_FIRST_CLEAR_MINIBOSS, STARTING_SEALS,
} from '../../config/balance.config';

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

const started = (): MetaState => chooseStarter(createMeta(), '0004');

describe('chooseStarter', () => {
  it('grants the starter at 1★ in slot 1 plus the welcome seals', () => {
    const m = started();
    expect(m.starterChosen).toBe(true);
    expect(m.collection['0004']).toEqual({ stars: 1, fragments: 0, shinyOwned: false, shinyActive: false });
    expect(m.loadout[0]).toBe('0004');
    expect(m.seals).toBe(STARTING_SEALS);
  });
  it('ignores a second choice and non-starter ids', () => {
    const m = started();
    expect(chooseStarter(m, '0007')).toBe(m);
    expect(chooseStarter(createMeta(), '0150').starterChosen).toBe(false);
  });
});

describe('pullGacha', () => {
  it('does nothing when seals are insufficient', () => {
    const m = chooseStarter(createMeta(), '0004');
    const poor = { ...m, seals: 2 };
    const res = pullGacha(poor, 3, mulberry32(1));
    expect(res.outcomes).toHaveLength(0);
    expect(res.meta).toBe(poor);
  });

  it('spends 1 seal per pull and advances counters', () => {
    const res = pullGacha(started(), GACHA_MULTI_PULL, mulberry32(2));
    expect(res.outcomes).toHaveLength(GACHA_MULTI_PULL);
    expect(res.meta.seals).toBe(STARTING_SEALS - GACHA_MULTI_PULL);
    expect(res.meta.totalPulls).toBe(GACHA_MULTI_PULL);
  });

  it('new species are collected at 1★ and auto-fill empty loadout slots', () => {
    const res = pullGacha({ ...started(), seals: 30 }, 30, mulberry32(3));
    const news = res.outcomes.filter((o) => o.isNew);
    expect(news.length).toBeGreaterThan(0);
    for (const o of news) expect(res.meta.collection[o.speciesId].stars).toBe(1);
    expect(loadoutSize(res.meta)).toBe(Math.min(6, 1 + news.length));
    // No species ever occupies two slots.
    const ids = res.meta.loadout.filter((x) => x !== null);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('duplicates grant rarity-based fragments instead of a new entry', () => {
    // rng 0 => COMMON, pool[0] = Caterpie every time.
    const res = pullGacha({ ...started(), seals: 5 }, 3, () => 0);
    expect(res.outcomes[0].isNew).toBe(true);
    expect(res.outcomes[1].isNew).toBe(false);
    expect(res.outcomes[1].fragmentsGained).toBe(DUPLICATE_FRAGMENTS.COMMON);
    expect(res.meta.collection['0010'].fragments).toBe(2 * DUPLICATE_FRAGMENTS.COMMON);
  });
});

describe('awakening', () => {
  const withFragments = (n: number): MetaState => {
    const m = started();
    return { ...m, collection: { ...m.collection, '0004': { stars: 1, fragments: n, shinyOwned: false, shinyActive: false } } };
  };

  it('needs the exact fragment cost and consumes it', () => {
    const cost = AWAKEN_FRAGMENT_COST[2];
    expect(canAwaken(withFragments(cost - 1), '0004')).toBe(false);
    expect(awaken(withFragments(cost - 1), '0004').collection['0004'].stars).toBe(1);
    const up = awaken(withFragments(cost + 1), '0004');
    expect(up.collection['0004']).toEqual({ stars: 2, fragments: 1, shinyOwned: false, shinyActive: false });
  });

  it('caps at 5★ and reports no further cost', () => {
    const m = started();
    const maxed = { ...m, collection: { '0004': { stars: 5, fragments: 999, shinyOwned: false, shinyActive: false } } };
    expect(nextAwakenCost(maxed, '0004')).toBeNull();
    expect(awaken(maxed, '0004')).toBe(maxed);
  });

  it('can climb 1★ -> 5★ with enough fragments', () => {
    let m = withFragments(1000);
    for (let i = 0; i < 4; i++) m = awaken(m, '0004');
    expect(m.collection['0004'].stars).toBe(5);
    const spent = AWAKEN_FRAGMENT_COST[2] + AWAKEN_FRAGMENT_COST[3] + AWAKEN_FRAGMENT_COST[4] + AWAKEN_FRAGMENT_COST[5];
    expect(m.collection['0004'].fragments).toBe(1000 - spent);
  });
});

describe('loadout', () => {
  const two = (): MetaState => {
    const m = started();
    return { ...m, collection: { ...m.collection, '0007': { stars: 3, fragments: 0, shinyOwned: false, shinyActive: false } } };
  };

  it('places an owned species and refuses unowned ones', () => {
    const m = setLoadoutSlot(two(), 1, '0007');
    expect(m.loadout[1]).toBe('0007');
    expect(setLoadoutSlot(two(), 1, '0150')).toEqual(two());
  });

  it('swaps when the species is already on the team', () => {
    const m = setLoadoutSlot(setLoadoutSlot(two(), 1, '0007'), 0, '0007');
    expect(m.loadout[0]).toBe('0007');
    expect(m.loadout[1]).toBe('0004');
  });

  it('clears a slot and exports entries with current stars', () => {
    let m = setLoadoutSlot(two(), 1, '0007');
    expect(loadoutToEntries(m)[1]).toEqual({ definitionId: '0007', stars: 3, shinyActive: false });
    m = setLoadoutSlot(m, 1, null);
    expect(loadoutToEntries(m)[1]).toBeNull();
  });
});

describe('settleRun', () => {
  it('boss floors cleared are strictly below the floor you died on', () => {
    expect(bossFloorsClearedBelow(10)).toEqual([]);
    expect(bossFloorsClearedBelow(11)).toEqual([10]);
    expect(bossFloorsClearedBelow(31)).toEqual([10, 20, 30]);
  });

  it('pays first-clear + ascension seals once, then only ascension', () => {
    const first = settleRun(started(), { floorReached: 23 });
    expect(first.rewards.firstClearFloors).toEqual([10, 20]);
    expect(first.rewards.sealsFirstClear).toBe(2 * SEALS_FIRST_CLEAR_MINIBOSS);
    expect(first.rewards.sealsAscension).toBe(4);
    expect(first.meta.seals).toBe(STARTING_SEALS + first.rewards.sealsTotal);
    expect(first.meta.bestFloor).toBe(23);

    const again = settleRun(first.meta, { floorReached: 23 });
    expect(again.rewards.firstClearFloors).toEqual([]);
    expect(again.rewards.sealsFirstClear).toBe(0);
    expect(again.rewards.sealsAscension).toBe(4);
    expect(again.rewards.newBestFloor).toBe(false);
    expect(again.meta.totalRuns).toBe(2);
  });

  it('pays the major-boss bonus for floor 50', () => {
    const r = settleRun(started(), { floorReached: 51 });
    expect(r.rewards.firstClearFloors).toEqual([10, 20, 30, 40, 50]);
    expect(r.rewards.sealsFirstClear).toBe(4 * SEALS_FIRST_CLEAR_MINIBOSS + SEALS_FIRST_CLEAR_MAJOR_BOSS);
  });

  it('uses defeatedBossFloors when provided (Decision D1 / Issue I2)', () => {
    const res = settleRun(started(), { floorReached: 25, defeatedBossFloors: [10] });
    expect(res.rewards.firstClearFloors).toEqual([10]);
    expect(res.rewards.sealsFirstClear).toBe(SEALS_FIRST_CLEAR_MINIBOSS);
    expect(res.meta.clearedBossFloors).toEqual([10]);
  });
});

describe('sanitizeMeta', () => {
  it('round-trips a valid meta through JSON', () => {
    const m = pullGacha({ ...started(), seals: 20 }, 20, mulberry32(8)).meta;
    expect(sanitizeMeta(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });

  it('survives garbage, wrong versions and hostile values', () => {
    expect(sanitizeMeta(null)).toEqual(createMeta());
    expect(sanitizeMeta('x')).toEqual(createMeta());
    expect(sanitizeMeta({ schemaVersion: 99 })).toEqual(createMeta());
    const m = sanitizeMeta({
      schemaVersion: 2, starterChosen: true, seals: -5,
      collection: { '0004': { stars: 99, fragments: -1 }, '9999': { stars: 1, fragments: 0 } },
      loadout: ['0004', '0004', '9999', null, 5, undefined],
      clearedBossFloors: [20, 10, 10, -3, 'x'],
    });
    expect(m.seals).toBe(0);
    expect(m.collection['0004']).toEqual({ stars: 5, fragments: 0, shinyOwned: false, shinyActive: false });
    expect(m.collection['9999']).toBeUndefined();
    expect(m.loadout).toEqual(['0004', null, null, null, null, null]);
    expect(m.clearedBossFloors).toEqual([10, 20]);
  });
});

describe('setTeam', () => {
  const own = (ids: string[]): MetaState => {
    const m = started();
    const collection = { ...m.collection };
    for (const id of ids) collection[id] = { stars: 1, fragments: 0, shinyOwned: false, shinyActive: false };
    return { ...m, collection };
  };

  it('packs the team to the front with ids[0] as main', () => {
    const m = setTeam(own(['0007', '0010']), ['0010', null, '0004', '0007']);
    expect(m.loadout).toEqual(['0010', '0004', '0007', null, null, null]);
  });

  it('drops unowned, duplicated and same-line species', () => {
    const m = setTeam(own(['0005', '0007']), ['0004', '0004', '0150', '0005', '0007']);
    // 0005 (Charmeleon) shares a line with 0004 (Charmander).
    expect(m.loadout).toEqual(['0004', '0007', null, null, null, null]);
  });

  it('returns the same object when nothing changes and reports line conflicts', () => {
    const base = own(['0007']);
    expect(setTeam(base, ['0004'])).toBe(base);
    expect(findLineConflict(['0004'], '0005')).toBe('0004');
    expect(findLineConflict(['0004'], '0007')).toBeNull();
  });
});
