/**
 * PokéBastion — utilidades de color y ruido procedural.
 *
 * Funciones puras de cálculo de color (RGB/hex/RGBA), interpolación lineal y
 * funciones de ruido determinista 2D usadas para texturizar y tramado continuo
 * del suelo de los biomas en la arena.
 */

export type Rgb = readonly [number, number, number];

/** Convierte '#rrggbb' en [r, g, b]. */
export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** '#rrggbb' o 'rgba(r,g,b,a)' → [r, g, b, a(0..255)]. */
export function toRgba(css: string): [number, number, number, number] {
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(css);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), Math.round(Number(m[4]) * 255)];
  const [r, g, b] = hexToRgb(css);
  return [r, g, b, 255];
}

/** Mezcla lineal de dos colores '#rrggbb' (t=0 → a, t=1 → b). */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

/** Multiplica la luminosidad de un color (k<1 oscurece, k>1 aclara). */
export function scale(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r * k, g * k, b * k]);
}

/** PRNG determinista (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash 2D determinista en [0,1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1013904223)) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value-noise suave en [0,1) con celdas de `cell` px. */
export function valueNoise(x: number, y: number, cell: number, seed = 0): number {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
