/**
 * PokéBastion — secuenciador de música de fondo.
 * Programa notas con antelación (lookahead) sobre el reloj de Web Audio para que
 * el ritmo sea estable aunque el hilo principal vaya justo (el juego corre a 60 fps).
 * Pistas: melodía (pulso/triángulo), bajo (triángulo), arpegio (pulso fino) y batería (ruido).
 */

import { midiToFreq, noise, tone } from './engine';
import { parseMelody, triad } from './themes';
import type { LeadNote, Theme } from './themes';

const LOOKAHEAD_S = 0.14;
const TICK_MS = 30;

export class Sequencer {
  private readonly c: AudioContext;
  private readonly out: GainNode;
  private readonly theme: Theme;
  private readonly notes = new Map<number, LeadNote>();
  private readonly totalSteps: number;
  private readonly stepDur: number;
  private step = 0;
  private nextTime: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(c: AudioContext, dest: AudioNode, theme: Theme, fadeInS = 0.6) {
    this.c = c;
    this.theme = theme;
    this.out = c.createGain();
    this.out.gain.setValueAtTime(0.0001, c.currentTime);
    this.out.gain.linearRampToValueAtTime(1, c.currentTime + fadeInS);
    this.out.connect(dest);
    for (const n of parseMelody(theme.melody)) this.notes.set(n.step, n);
    this.totalSteps = theme.melody.length * 8;
    this.stepDur = 60 / theme.bpm / 2; // corchea
    this.nextTime = c.currentTime + 0.06;
    this.timer = setInterval(() => this.pump(), TICK_MS);
    this.pump();
  }

  get id(): string {
    return this.theme.id;
  }

  private pump(): void {
    if (this.stopped) return;
    while (this.nextTime < this.c.currentTime + LOOKAHEAD_S) {
      this.scheduleStep(this.step, this.nextTime);
      this.nextTime += this.stepDur;
      this.step = (this.step + 1) % this.totalSteps;
    }
  }

  private scheduleStep(step: number, t: number): void {
    const th = this.theme;
    const bar = Math.floor(step / 8);
    const s = step % 8;
    const chord = th.chords[bar % th.chords.length];
    const [r, third, fifth] = triad(chord);
    const d = this.stepDur;
    const out = this.out;

    // Melodía.
    const note = this.notes.get(step);
    if (note) {
      const dur = note.len * d;
      tone(this.c, out, {
        wave: th.lead,
        freq: midiToFreq(note.midi),
        t,
        dur: dur * 0.92,
        vol: th.leadVol,
        attack: 0.006,
        release: Math.min(0.06, dur * 0.3),
        vibrato: note.len >= 3 ? [5.5, 10] : undefined,
      });
    }

    // Bajo (triángulo): fundamental y quinta alternadas; "pumping" en estilo drive.
    const bassMid = r - 12;
    if (th.drums === 'drive') {
      tone(this.c, out, { wave: 'triangle', freq: midiToFreq(s % 4 === 3 ? bassMid + 12 : bassMid), t, dur: d * 0.85, vol: 0.2, release: 0.03 });
    } else if (s === 0 || s === 4) {
      tone(this.c, out, { wave: 'triangle', freq: midiToFreq(bassMid), t, dur: d * 1.8, vol: 0.22, release: 0.05 });
    } else if (s === 2 || s === 6) {
      tone(this.c, out, { wave: 'triangle', freq: midiToFreq(fifth - 12), t, dur: d * 1.7, vol: 0.2, release: 0.05 });
    }

    // Arpegio suave de la tríada una octava por encima de la melodía grave.
    if (th.arp) {
      const seq = [r + 12, third + 12, fifth + 12, third + 12];
      tone(this.c, out, { wave: 'pulse12', freq: midiToFreq(seq[s % 4] + 12), t, dur: d * 0.7, vol: 0.026, release: 0.03 });
    }

    // Batería.
    this.drums(s, t);
  }

  private drums(s: number, t: number): void {
    const style = this.theme.drums;
    if (style === 'none') return;
    const out = this.out;
    const kick = (vol: number) => tone(this.c, out, { wave: 'sine', freq: 150, to: 45, t, dur: 0.12, vol, release: 0.06 });
    const snare = (vol: number) => noise(this.c, out, { t, dur: 0.09, vol, filter: 'bandpass', f0: 2600, q: 0.8 });
    const hat = (vol: number) => noise(this.c, out, { t, dur: 0.03, vol, filter: 'highpass', f0: 7500 });
    if (style === 'soft') {
      if (s === 0) kick(0.12);
      if (s % 2 === 1) hat(0.02);
      return;
    }
    if (style === 'groove') {
      if (s === 0 || s === 4) kick(0.2);
      if (s === 2 || s === 6) snare(0.07);
      if (s % 2 === 1) hat(0.03);
      return;
    }
    // drive
    if (s === 0 || s === 3 || s === 4 || s === 7) kick(0.22);
    if (s === 2 || s === 6) snare(0.09);
    hat(s % 2 === 1 ? 0.04 : 0.02);
  }

  /** Fundido de salida y liberación de recursos. */
  stop(fadeS = 0.5): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const t = this.c.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0.0001, t + fadeS);
    setTimeout(() => {
      try {
        this.out.disconnect();
      } catch {
        // ya desconectado
      }
    }, (fadeS + 0.4) * 1000);
  }
}
