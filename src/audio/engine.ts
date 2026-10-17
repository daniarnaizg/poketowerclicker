/**
 * PokéBastion — motor de audio (Web Audio API, síntesis chiptune en tiempo real).
 *
 * No hay ficheros de audio: SFX y BGM se generan con osciladores de pulso /
 * triángulo y ruido, así que no añade peso al bundle ni dependencias.
 * El AudioContext se crea en el primer gesto del usuario (política de autoplay).
 *
 * Buses:  [sfxBus] ─┐
 *                   ├─> [master] ─> destino
 *         [musicBus]┘
 */

export interface AudioPrefs {
  muted: boolean;
  /** Volumen de la música, 0..1. */
  music: number;
  /** Volumen de los efectos, 0..1. */
  sfx: number;
}

const STORAGE_KEY = 'pokebastion.audio.v1';
const DEFAULT_PREFS: AudioPrefs = { muted: false, music: 0.55, sfx: 0.8 };

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const pulseCache = new Map<number, PeriodicWave>();
const listeners = new Set<() => void>();

function loadPrefs(): AudioPrefs {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULT_PREFS };
    const p = JSON.parse(raw) as Partial<AudioPrefs>;
    const clamp = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);
    return {
      muted: p.muted === true,
      music: clamp(p.music, DEFAULT_PREFS.music),
      sfx: clamp(p.sfx, DEFAULT_PREFS.sfx),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

let prefs: AudioPrefs = loadPrefs();

function savePrefs(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // almacenamiento no disponible (modo privado, cuota...): se ignora
  }
}

function notify(): void {
  for (const fn of listeners) fn();
}

function applyGains(): void {
  if (!ctx || !master || !musicBus || !sfxBus) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(prefs.muted ? 0 : 1, t, 0.03);
  musicBus.gain.setTargetAtTime(prefs.music * 0.5, t, 0.05);
  sfxBus.gain.setTargetAtTime(prefs.sfx * 0.9, t, 0.05);
}

/** Crea (una sola vez) el contexto de audio. Llamar desde un gesto del usuario. */
export function unlock(): boolean {
  if (typeof window === 'undefined') return false;
  if (!ctx) {
    const Ctor: AudioCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return false;
    try {
      ctx = new Ctor();
    } catch {
      return false;
    }
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    // Limitador suave para que el solapamiento de muchos SFX no sature.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.16;
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);
    master.gain.value = prefs.muted ? 0 : 1;
    musicBus.gain.value = prefs.music * 0.5;
    sfxBus.gain.value = prefs.sfx * 0.9;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  notify();
  return true;
}

export function isUnlocked(): boolean {
  return ctx !== null;
}

export function getContext(): AudioContext | null {
  return ctx;
}

export function getBuses(): { music: GainNode; sfx: GainNode } | null {
  return musicBus && sfxBus ? { music: musicBus, sfx: sfxBus } : null;
}

export function getPrefs(): Readonly<AudioPrefs> {
  return prefs;
}

export function setMuted(muted: boolean): void {
  prefs = { ...prefs, muted };
  savePrefs();
  applyGains();
  notify();
}

export function toggleMuted(): boolean {
  setMuted(!prefs.muted);
  return prefs.muted;
}

export function setVolumes(v: Partial<Pick<AudioPrefs, 'music' | 'sfx'>>): void {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  prefs = {
    ...prefs,
    music: v.music !== undefined ? clamp(v.music) : prefs.music,
    sfx: v.sfx !== undefined ? clamp(v.sfx) : prefs.sfx,
  };
  savePrefs();
  applyGains();
  notify();
}

/** Suscripción a cambios (mute, volumen, desbloqueo). Devuelve la función de baja. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Pausa/reanuda el contexto con la visibilidad de la pestaña (ahorra CPU y batería). */
export function setPageVisible(visible: boolean): void {
  if (!ctx) return;
  if (visible) void ctx.resume();
  else void ctx.suspend();
}

// ---------------------------------------------------------------------------
// Utilidades de síntesis compartidas por sfx.ts y bgm.ts
// ---------------------------------------------------------------------------

export type Wave = OscillatorType | 'pulse12' | 'pulse25' | 'pulse75';

const DUTY: Record<'pulse12' | 'pulse25' | 'pulse75', number> = { pulse12: 0.125, pulse25: 0.25, pulse75: 0.75 };

function pulseWave(c: BaseAudioContext, duty: number): PeriodicWave {
  let w = pulseCache.get(duty);
  if (!w) {
    const N = 48;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    for (let n = 1; n < N; n++) {
      real[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
      imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI);
    }
    w = c.createPeriodicWave(real, imag);
    pulseCache.set(duty, w);
  }
  return w;
}

export interface ToneOpts {
  wave?: Wave;
  freq: number;
  /** Frecuencia final (deslizamiento exponencial). */
  to?: number;
  /** Instante de inicio (s del reloj del contexto). */
  t: number;
  dur: number;
  vol?: number;
  attack?: number;
  /** Cuánto dura el fundido final dentro de `dur`. */
  release?: number;
  /** Desafinación en cents (para vibrato/efectos). */
  detune?: number;
  /** Vibrato: [Hz, cents]. */
  vibrato?: readonly [number, number];
}

/** Una nota con envolvente. Devuelve el nodo de ganancia por si se quiere enlazar. */
export function tone(c: AudioContext, dest: AudioNode, o: ToneOpts): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  const wave = o.wave ?? 'square';
  if (wave === 'pulse12' || wave === 'pulse25' || wave === 'pulse75') osc.setPeriodicWave(pulseWave(c, DUTY[wave]));
  else osc.type = wave;
  const end = o.t + o.dur;
  osc.frequency.setValueAtTime(o.freq, o.t);
  if (o.to && o.to !== o.freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), end);
  if (o.detune) osc.detune.value = o.detune;
  const vol = o.vol ?? 0.15;
  const atk = Math.min(o.attack ?? 0.004, o.dur * 0.5);
  const rel = Math.min(o.release ?? Math.min(0.05, o.dur * 0.5), o.dur - atk);
  g.gain.setValueAtTime(0.0001, o.t);
  g.gain.linearRampToValueAtTime(vol, o.t + atk);
  g.gain.setValueAtTime(vol, Math.max(o.t + atk, end - rel));
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(g);
  g.connect(dest);
  if (o.vibrato) {
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = o.vibrato[0];
    lg.gain.value = o.vibrato[1];
    lfo.connect(lg);
    lg.connect(osc.detune);
    lfo.start(o.t);
    lfo.stop(end + 0.02);
  }
  osc.start(o.t);
  osc.stop(end + 0.02);
}

function getNoise(c: BaseAudioContext): AudioBuffer {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    const len = c.sampleRate; // 1 s de ruido blanco reutilizable
    noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let seed = 1337;
    for (let i = 0; i < len; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      d[i] = ((seed >>> 8) / 8388608) - 1;
    }
  }
  return noiseBuf;
}

export interface NoiseOpts {
  t: number;
  dur: number;
  vol?: number;
  filter?: BiquadFilterType;
  f0?: number;
  /** Frecuencia final del filtro (barrido exponencial). */
  f1?: number;
  q?: number;
}

/** Ráfaga de ruido filtrado (percusión, golpes, chispas). */
export function noise(c: AudioContext, dest: AudioNode, o: NoiseOpts): void {
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  const f = c.createBiquadFilter();
  f.type = o.filter ?? 'highpass';
  f.frequency.setValueAtTime(o.f0 ?? 3000, o.t);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), o.t + o.dur);
  f.Q.value = o.q ?? 0.7;
  const g = c.createGain();
  const vol = o.vol ?? 0.15;
  g.gain.setValueAtTime(vol, o.t);
  g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(o.t, Math.random() * 0.5);
  src.stop(o.t + o.dur + 0.02);
}

/** Frecuencia de una nota MIDI (69 = La4 = 440 Hz). */
export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}
