/**
 * PokéBastion — efectos de sonido sintetizados (estilo consola 8/16-bit).
 * Cada efecto es una función pura de (contexto, destino, instante, variación).
 * `v` ∈ [0,1) varía un poco el tono para que los sonidos repetidos no cansen.
 */

import { midiToFreq, noise, tone } from './engine';

export type SfxName =
  | 'click'
  | 'kill'
  | 'hurt'
  | 'ultimate'
  | 'swap'
  | 'floor'
  | 'boss'
  | 'levelUp'
  | 'buy'
  | 'select'
  | 'deny'
  | 'start'
  | 'gameOver';

type Player = (c: AudioContext, d: AudioNode, t: number, v: number) => void;

const f = midiToFreq;
// Notas MIDI usadas en jingles.
const C4 = 60, E4 = 64, G4 = 67, B3 = 59, D4 = 62;
const C5 = 72, E5 = 76, G5 = 79, C6 = 84, B5 = 83, E6 = 88;

export const SFX: Record<SfxName, Player> = {
  /** Disparo del clic: "pip" corto y brillante. */
  click(c, d, t, v) {
    tone(c, d, { wave: 'pulse25', freq: 760 + v * 200, to: 420, t, dur: 0.07, vol: 0.1 });
    noise(c, d, { t, dur: 0.025, vol: 0.035, filter: 'highpass', f0: 5000 });
  },

  /** Enemigo derrotado: caída de tono tipo "faint" + chasquido. */
  kill(c, d, t, v) {
    tone(c, d, { wave: 'square', freq: 520 + v * 120, to: 130, t, dur: 0.14, vol: 0.085 });
    noise(c, d, { t, dur: 0.11, vol: 0.07, filter: 'bandpass', f0: 1900, f1: 380, q: 1.2 });
  },

  /** El Bastión recibe daño: golpe grave. */
  hurt(c, d, t) {
    tone(c, d, { wave: 'triangle', freq: 170, to: 52, t, dur: 0.24, vol: 0.24 });
    noise(c, d, { t, dur: 0.2, vol: 0.14, filter: 'lowpass', f0: 1000, f1: 140 });
  },

  /** Definitiva: barrido ascendente + acorde brillante. */
  ultimate(c, d, t) {
    noise(c, d, { t, dur: 0.45, vol: 0.12, filter: 'bandpass', f0: 300, f1: 4200, q: 1.5 });
    tone(c, d, { wave: 'sawtooth', freq: 180, to: 1400, t, dur: 0.45, vol: 0.07 });
    [C5, E5, G5, C6].forEach((m, i) => {
      tone(c, d, { wave: 'pulse25', freq: f(m), t: t + 0.4 + i * 0.03, dur: 0.38, vol: 0.06, release: 0.2 });
    });
    noise(c, d, { t: t + 0.4, dur: 0.25, vol: 0.09, filter: 'highpass', f0: 2500 });
  },

  /** Cambio de Pokémon: "pop" de Poké Ball + destellos. */
  swap(c, d, t) {
    tone(c, d, { wave: 'sine', freq: 380, to: 1500, t, dur: 0.1, vol: 0.13 });
    tone(c, d, { wave: 'pulse12', freq: 1568, t: t + 0.09, dur: 0.05, vol: 0.07 });
    tone(c, d, { wave: 'pulse12', freq: 2093, t: t + 0.13, dur: 0.08, vol: 0.06 });
    noise(c, d, { t, dur: 0.06, vol: 0.05, filter: 'highpass', f0: 4000 });
  },

  /** Piso superado: arpegio mayor ascendente. */
  floor(c, d, t) {
    [C5, E5, G5, C6].forEach((m, i) => {
      tone(c, d, { wave: 'pulse25', freq: f(m), t: t + i * 0.075, dur: i === 3 ? 0.26 : 0.09, vol: 0.1, release: i === 3 ? 0.15 : 0.03 });
    });
  },

  /** Aparece un jefe: retumbo grave + alarma de dos notas. */
  boss(c, d, t) {
    noise(c, d, { t, dur: 0.7, vol: 0.12, filter: 'lowpass', f0: 380, f1: 90 });
    for (let i = 0; i < 2; i++) {
      tone(c, d, { wave: 'sawtooth', freq: 98, to: 90, t: t + i * 0.34, dur: 0.3, vol: 0.12 });
      tone(c, d, { wave: 'square', freq: 622, t: t + i * 0.34, dur: 0.12, vol: 0.06 });
      tone(c, d, { wave: 'pulse25', freq: 466, t: t + i * 0.34 + 0.14, dur: 0.14, vol: 0.06 });
    }
  },

  /** Nivel de equipo: fanfarria corta ascendente. */
  levelUp(c, d, t) {
    [G4, C5, E5, G5, C6].forEach((m, i) => {
      const last = i === 4;
      tone(c, d, {
        wave: 'pulse25',
        freq: f(m),
        t: t + i * 0.065,
        dur: last ? 0.34 : 0.08,
        vol: 0.1,
        release: last ? 0.2 : 0.02,
        vibrato: last ? [7, 18] : undefined,
      });
    });
  },

  /** Compra de mejora: "ding" de moneda. */
  buy(c, d, t) {
    tone(c, d, { wave: 'pulse25', freq: f(B5), t, dur: 0.05, vol: 0.1 });
    tone(c, d, { wave: 'pulse25', freq: f(E6), t: t + 0.05, dur: 0.18, vol: 0.1, release: 0.12 });
  },

  /** Botón de interfaz. */
  select(c, d, t) {
    tone(c, d, { wave: 'square', freq: 1046, t, dur: 0.035, vol: 0.06 });
    tone(c, d, { wave: 'square', freq: 1318, t: t + 0.035, dur: 0.05, vol: 0.06 });
  },

  /** Acción no disponible. */
  deny(c, d, t) {
    tone(c, d, { wave: 'square', freq: 220, t, dur: 0.07, vol: 0.08 });
    tone(c, d, { wave: 'square', freq: 165, t: t + 0.08, dur: 0.12, vol: 0.08 });
  },

  /** Empieza la partida. */
  start(c, d, t) {
    [C5, G5, C6].forEach((m, i) => {
      tone(c, d, { wave: 'pulse25', freq: f(m), t: t + i * 0.08, dur: i === 2 ? 0.3 : 0.09, vol: 0.1, release: i === 2 ? 0.2 : 0.02 });
    });
    noise(c, d, { t, dur: 0.18, vol: 0.05, filter: 'highpass', f0: 3000 });
  },

  /** Fin de partida: frase descendente y grave final. */
  gameOver(c, d, t) {
    [E4, D4, C4, B3].forEach((m, i) => {
      const last = i === 3;
      tone(c, d, { wave: 'triangle', freq: f(m), t: t + i * 0.24, dur: last ? 0.7 : 0.23, vol: 0.2, release: last ? 0.4 : 0.05 });
      tone(c, d, { wave: 'pulse25', freq: f(m + 12), t: t + i * 0.24, dur: last ? 0.6 : 0.2, vol: 0.05, release: last ? 0.4 : 0.05 });
    });
    tone(c, d, { wave: 'sawtooth', freq: 82, to: 55, t: t + 0.72, dur: 0.9, vol: 0.06, release: 0.6 });
  },
};

/** Separación mínima entre dos reproducciones del mismo efecto (ms). */
export const SFX_MIN_GAP_MS: Record<SfxName, number> = {
  click: 45,
  kill: 55,
  hurt: 160,
  ultimate: 300,
  swap: 120,
  floor: 400,
  boss: 800,
  levelUp: 200,
  buy: 70,
  select: 40,
  deny: 120,
  start: 500,
  gameOver: 1500,
};
