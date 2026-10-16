/**
 * PokéBastion — persistent save (PRD §6.1: idb-keyval / IndexedDB).
 *
 * Only the META state is stored (collection, stars, seals, loadout, pity,
 * first-clear records). Runs are roguelite and intentionally not persisted.
 * Everything read back is validated by `sanitizeMeta`, so a corrupt or
 * hand-edited save degrades to a fresh one instead of crashing the game.
 * If IndexedDB is unavailable (private mode, blocked), localStorage is used.
 */

import { del, get, set } from 'idb-keyval';
import { createMeta, migrateMeta } from '../core/meta';
import type { MetaState } from '../core/meta';

export const SAVE_KEY = 'pokebastion:save:v1';

const hasIndexedDb = (): boolean => typeof indexedDB !== 'undefined';
const hasLocalStorage = (): boolean => typeof localStorage !== 'undefined';

function readLocal(): unknown {
  if (!hasLocalStorage()) return undefined;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

export async function loadMeta(): Promise<MetaState> {
  if (hasIndexedDb()) {
    try {
      const raw = await get(SAVE_KEY);
      if (raw !== undefined) return migrateMeta(raw);
    } catch (err) {
      console.warn('[save] IndexedDB read failed, trying localStorage', err);
    }
  }
  const local = readLocal();
  return local === undefined ? createMeta() : migrateMeta(local);
}

export async function saveMeta(meta: MetaState): Promise<void> {
  if (hasIndexedDb()) {
    try {
      await set(SAVE_KEY, meta);
      return;
    } catch (err) {
      console.warn('[save] IndexedDB write failed, falling back to localStorage', err);
    }
  }
  if (!hasLocalStorage()) return; // headless (tests / SSR): nothing to persist to
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(meta));
  } catch (err) {
    console.warn('[save] could not persist progress', err);
  }
}

/** Wipe the save (used by the "reiniciar progreso" action). */
export async function clearMeta(): Promise<void> {
  if (hasIndexedDb()) {
    try {
      await del(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
