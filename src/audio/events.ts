/**
 * PokéBastion — traduce cambios de GameState en eventos de audio.
 * Función pura (sin DOM ni audio): compara el estado anterior con el nuevo y
 * devuelve qué ha pasado. Así el núcleo del juego no necesita saber nada de sonido.
 */

import { biomeAt } from '../data/biomes';
import type { GameState } from '../core/types';
import type { SceneId } from './themes';

export type AudioEvent =
  | { type: 'kill'; count: number }
  | { type: 'hurt' }
  | { type: 'ultimate' }
  | { type: 'swap' }
  | { type: 'floor' }
  | { type: 'boss' }
  | { type: 'levelUp' }
  | { type: 'buy' }
  | { type: 'start' }
  | { type: 'gameOver' };

function activeIndex(s: GameState): number {
  return s.team.findIndex((slot) => slot.isActive);
}

function upgradeTotal(s: GameState): number {
  let n = 0;
  for (const v of Object.values(s.bastionUpgrades)) n += v ?? 0;
  return n;
}

function hasLiveBoss(s: GameState): boolean {
  return s.enemies.some((e) => e.alive && e.isBoss);
}

export function detectAudioEvents(prev: GameState | null, next: GameState): AudioEvent[] {
  if (!prev) return [];

  if (prev.phase !== next.phase) {
    if (next.phase === 'PLAYING') return [{ type: 'start' }];
    if (next.phase === 'GAME_OVER' && prev.phase === 'PLAYING') return [{ type: 'gameOver' }];
    return [];
  }
  if (next.phase !== 'PLAYING') return [];

  const out: AudioEvent[] = [];

  const kills = next.runStats.totalKills - prev.runStats.totalKills;
  if (kills > 0) out.push({ type: 'kill', count: kills });

  const sumTeamHp = (s: GameState) =>
    s.team.reduce((acc, sl) => acc + (sl.pokemon?.hp ?? 0), 0);
  if (sumTeamHp(next) < sumTeamHp(prev)) out.push({ type: 'hurt' });

  const seen = new Set((prev.effects ?? []).map((fx) => fx.id));
  if ((next.effects ?? []).some((fx) => !seen.has(fx.id) && fx.kind !== 'RING')) out.push({ type: 'ultimate' });

  const a0 = activeIndex(prev);
  const a1 = activeIndex(next);
  if (a0 >= 0 && a1 >= 0 && a0 !== a1) out.push({ type: 'swap' });

  if (next.floor > prev.floor) out.push({ type: 'floor' });
  if (hasLiveBoss(next) && !hasLiveBoss(prev)) out.push({ type: 'boss' });

  if (next.teamLevel > prev.teamLevel) out.push({ type: 'levelUp' });
  else if (upgradeTotal(next) > upgradeTotal(prev)) out.push({ type: 'buy' });

  return out;
}

/** Escena musical que corresponde al estado actual (null = silencio). */
export function sceneFor(state: GameState | null): SceneId | null {
  if (!state) return 'menu';
  switch (state.phase) {
    case 'STARTER_SELECT':
    case 'MENU':
      return 'menu';
    case 'GAME_OVER':
      return null;
    case 'PLAYING': {
      if (hasLiveBoss(state)) return 'boss';
      switch (biomeAt(state.floor).id) {
        case 'RUTA_VERDE': return 'route';
        case 'CUEVA_UMBRIA': return 'cave';
        case 'MONTE_IGNEO': return 'volcano';
        case 'COSTA_RUINAS': return 'coast';
      }
    }
  }
  return 'menu';
}
