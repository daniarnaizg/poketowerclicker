/**
 * PokéBastion — temas musicales (composiciones originales, ambiente "ruta Pokémon").
 *
 * Cada tema son 8 compases (4 en el de jefe) de 8 corcheas. La melodía se escribe
 * como texto: 'C5' nota, '#'/'b' alteraciones, '-' silencio, '~' alarga la nota anterior.
 */

export type SceneId = 'menu' | 'route' | 'cave' | 'volcano' | 'coast' | 'boss';

export interface Chord {
  /** Fundamental (MIDI). Se toca en octava grave para el bajo. */
  root: number;
  minor: boolean;
}

export type DrumStyle = 'none' | 'soft' | 'groove' | 'drive';
export type LeadWave = 'pulse25' | 'pulse12' | 'square' | 'triangle';

export interface Theme {
  id: SceneId;
  bpm: number;
  /** Un acorde por compás. */
  chords: Chord[];
  /** Una cadena de 8 pasos (corcheas) por compás. */
  melody: string[];
  lead: LeadWave;
  leadVol: number;
  drums: DrumStyle;
  /** Arpegio de acompañamiento. */
  arp: boolean;
}

const NOTE_BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C#5' → 73 · 'Bb3' → 58. */
export function noteToMidi(name: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`Nota no válida: ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NOTE_BASE[m[1]] + acc;
}

export interface LeadNote {
  /** Paso absoluto dentro del bucle (corchea). */
  step: number;
  midi: number;
  /** Duración en corcheas. */
  len: number;
}

/** Convierte las cadenas de melodía en notas con duración. */
export function parseMelody(bars: readonly string[]): LeadNote[] {
  const out: LeadNote[] = [];
  let last: LeadNote | null = null;
  bars.forEach((bar, b) => {
    const tokens = bar.trim().split(/\s+/);
    if (tokens.length !== 8) throw new Error(`Compás ${b + 1}: se esperan 8 pasos, hay ${tokens.length}`);
    tokens.forEach((tk, s) => {
      if (tk === '~') {
        if (last) last.len++;
      } else if (tk === '-') {
        last = null;
      } else {
        last = { step: b * 8 + s, midi: noteToMidi(tk), len: 1 };
        out.push(last);
      }
    });
  });
  return out;
}

/** Notas (MIDI) de la tríada: fundamental, tercera, quinta. */
export function triad(ch: Chord): [number, number, number] {
  return [ch.root, ch.root + (ch.minor ? 3 : 4), ch.root + 7];
}

const maj = (root: number): Chord => ({ root, minor: false });
const min = (root: number): Chord => ({ root, minor: true });
// Fundamentales en octava 3 (bajo y arpegio las suben/bajan según necesiten).
const C = 48, D = 50, E = 52, F = 53, G = 55, A = 57, Bb = 58;

export const THEMES: Record<SceneId, Theme> = {
  /** Ruta Verde: alegre, mayor, 132 bpm. */
  route: {
    id: 'route',
    bpm: 132,
    chords: [maj(C), maj(G), min(A), maj(F), maj(C), maj(G), maj(F), maj(G)],
    melody: [
      'E5 ~ G5 E5 C5 ~ D5 E5',
      'D5 ~ B4 ~ G4 A4 B4 D5',
      'C5 ~ E5 ~ A4 ~ C5 B4',
      'A4 ~ C5 ~ F5 E5 D5 C5',
      'E5 ~ G5 E5 C6 ~ B5 G5',
      'A5 ~ G5 ~ D5 ~ B4 D5',
      'F5 ~ A5 ~ C5 ~ F5 A5',
      'G5 ~ F5 D5 B4 ~ ~ ~',
    ],
    lead: 'pulse25',
    leadVol: 0.085,
    drums: 'groove',
    arp: true,
  },

  /** Cueva Umbría: la menor, lento y misterioso. */
  cave: {
    id: 'cave',
    bpm: 88,
    chords: [min(A), maj(F), min(D), maj(E), min(A), maj(F), min(D), maj(E)],
    melody: [
      'A4 ~ ~ ~ C5 ~ E5 ~',
      'F5 ~ ~ E5 C5 ~ ~ ~',
      'D5 ~ ~ ~ F5 ~ A5 ~',
      'G#5 ~ ~ B4 E5 ~ ~ ~',
      'E5 ~ D5 ~ C5 ~ A4 ~',
      'A4 ~ C5 ~ F5 ~ E5 ~',
      'F5 ~ ~ D5 A4 ~ ~ ~',
      'B4 ~ G#4 ~ E4 ~ ~ ~',
    ],
    lead: 'triangle',
    leadVol: 0.2,
    drums: 'soft',
    arp: true,
  },

  /** Monte Ígneo: re menor, rápido y marcado. */
  volcano: {
    id: 'volcano',
    bpm: 148,
    chords: [min(D), maj(Bb), maj(C), maj(A), min(D), maj(Bb), maj(C), maj(A)],
    melody: [
      'D5 D5 F5 D5 A5 ~ F5 D5',
      'D5 D5 F5 D5 Bb5 ~ A5 F5',
      'E5 E5 G5 E5 C6 ~ G5 E5',
      'E5 A4 C#5 E5 A5 ~ G5 E5',
      'F5 F5 A5 F5 D6 ~ C6 A5',
      'D6 ~ C6 Bb5 A5 ~ F5 D5',
      'G5 G5 E5 G5 C6 ~ B5 G5',
      'A5 ~ G5 E5 C#5 ~ E5 A4',
    ],
    lead: 'pulse12',
    leadVol: 0.075,
    drums: 'drive',
    arp: false,
  },

  /** Costa y Ruinas: sol mayor, brisa marina. */
  coast: {
    id: 'coast',
    bpm: 112,
    chords: [maj(G), min(E), maj(C), maj(D), maj(G), min(E), maj(C), maj(D)],
    melody: [
      'B4 ~ D5 ~ G5 ~ D5 B4',
      'E5 ~ G5 ~ B5 ~ G5 E5',
      'C5 ~ E5 ~ G5 ~ E5 C5',
      'D5 ~ F#5 ~ A5 ~ F#5 D5',
      'B5 ~ A5 G5 ~ D5 ~ B4',
      'G5 ~ E5 ~ B4 ~ E5 G5',
      'E5 ~ G5 C6 ~ B5 ~ G5',
      'A5 ~ F#5 ~ D5 ~ A4 ~',
    ],
    lead: 'pulse25',
    leadVol: 0.08,
    drums: 'groove',
    arp: true,
  },

  /** Menú / Hub: tranquilo. */
  menu: {
    id: 'menu',
    bpm: 96,
    chords: [maj(C), min(A), maj(F), maj(G), maj(C), min(A), maj(F), maj(G)],
    melody: [
      'G4 ~ ~ ~ E5 ~ ~ ~',
      'E5 ~ ~ C5 A4 ~ ~ ~',
      'A4 ~ C5 ~ F5 ~ E5 ~',
      'D5 ~ ~ ~ B4 ~ G4 ~',
      'E5 ~ G5 ~ C6 ~ G5 ~',
      'A5 ~ ~ G5 E5 ~ ~ ~',
      'F5 ~ A5 ~ C6 ~ A5 ~',
      'B5 ~ G5 ~ D5 ~ ~ ~',
    ],
    lead: 'pulse25',
    leadVol: 0.07,
    drums: 'none',
    arp: true,
  },

  /** Jefe: la menor, 160 bpm, insistente. */
  boss: {
    id: 'boss',
    bpm: 160,
    chords: [min(A), maj(F), min(D), maj(E)],
    melody: [
      'A4 A4 C5 A4 E5 ~ D5 C5',
      'A4 A4 C5 A4 F5 ~ E5 C5',
      'D5 D5 F5 D5 A5 ~ G5 F5',
      'E5 E5 G#5 E5 B5 ~ G#5 E5',
    ],
    lead: 'pulse12',
    leadVol: 0.085,
    drums: 'drive',
    arp: false,
  },
};

