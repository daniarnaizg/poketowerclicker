/**
 * PokéBastion — fachada de audio. El resto del juego solo importa `audio` de aquí.
 */

import { Sequencer } from './bgm';
import * as engine from './engine';
import { detectAudioEvents, sceneFor, SILENT_EVENTS } from './events';
import type { AudioEvent } from './events';
import { SFX, SFX_MIN_GAP_MS } from './sfx';
import type { SfxName } from './sfx';
import { THEMES } from './themes';
import type { SceneId } from './themes';
import type { GameState } from '../core/types';

export type { AudioEvent, SceneId, SfxName };
export { detectAudioEvents, sceneFor };

let scene: SceneId | null | undefined; // undefined = aún no se ha pedido ninguna
let seq: Sequencer | null = null;
const lastPlayed = new Map<SfxName, number>();
let rr = 0;

function applyScene(): void {
  const c = engine.getContext();
  const buses = engine.getBuses();
  if (!c || !buses || scene === undefined) return;
  const wanted = scene;
  if (seq && wanted && seq.id === wanted) return;
  if (seq) {
    seq.stop(wanted ? 0.45 : 0.9);
    seq = null;
  }
  if (wanted) seq = new Sequencer(c, buses.music, THEMES[wanted], 0.5);
}

function playSfx(name: SfxName): void {
  const c = engine.getContext();
  const buses = engine.getBuses();
  if (!c || !buses || engine.isSfxMuted() || c.state !== 'running') return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -1e9) < SFX_MIN_GAP_MS[name]) return;
  lastPlayed.set(name, now);
  rr = (rr + 0.37) % 1; // variación de tono determinista, sin Math.random en el bucle
  SFX[name](c, buses.sfx, c.currentTime + 0.005, rr);
}

let installed = false;

export const audio = {
  /** Instala los listeners globales (desbloqueo por gesto, tecla M, sonidos de UI, pausa en segundo plano). */
  install(): () => void {
    if (installed || typeof window === 'undefined') return () => undefined;
    installed = true;

    const onGesture = (): void => {
      if (engine.unlock()) applyScene();
    };
    const onPointerDown = (e: PointerEvent): void => {
      onGesture();
      const el = (e.target as HTMLElement | null)?.closest?.('button, [role="button"]') as HTMLButtonElement | null;
      if (!el || el.dataset.sfx === 'none') return;
      playSfx(el.disabled ? 'deny' : 'select');
    };
    const onKey = (e: KeyboardEvent): void => {
      onGesture();
      if (e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) engine.toggleSfx();
    };
    const onVisibility = (): void => engine.setPageVisible(!document.hidden);

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('visibilitychange', onVisibility);
      installed = false;
    };
  },

  sfx: playSfx,

  /** Cambia la música (no hace nada si ya suena esa escena). */
  setScene(next: SceneId | null): void {
    if (scene === next) return;
    scene = next;
    applyScene();
  },

  /** Llamar una vez por fotograma con el estado previo y el nuevo. */
  observe(prev: GameState | null, next: GameState): void {
    this.setScene(sceneFor(next));
    for (const ev of detectAudioEvents(prev, next)) {
      if (SILENT_EVENTS.has(ev.type)) continue;
      switch (ev.type) {
        case 'hit': playSfx('hit'); break;
        case 'kill': playSfx('kill'); break;
        case 'hurt': playSfx('hurt'); break;
        case 'ultimate': playSfx('ultimate'); break;
        case 'swap': playSfx('swap'); break;
        case 'floor': playSfx('floor'); break;
        case 'boss': playSfx('boss'); break;
        case 'levelUp': playSfx('levelUp'); break;
        case 'buy': playSfx('buy'); break;
        case 'start': playSfx('start'); break;
        case 'gameOver': playSfx('gameOver'); break;
      }
    }
  },

  isMuted: () => engine.getPrefs().muted,
  isMusicMuted: engine.isMusicMuted,
  isSfxMuted: engine.isSfxMuted,
  toggleMute: engine.toggleMuted,
  toggleMusic: engine.toggleMusic,
  toggleSfx: engine.toggleSfx,
  setMusicMuted: engine.setMusicMuted,
  setSfxMuted: engine.setSfxMuted,
  subscribe: engine.subscribe,
};
