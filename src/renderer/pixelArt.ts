/**
 * PokéBastion — mini toolkit de pixel-art procedural.
 *
 * Un `PixelBuffer` es una rejilla de píxeles indexados con paleta propia. Los
 * sprites decorativos (árboles, cristales, lava, columnas...) se "dibujan" aquí
 * con primitivas enteras (discos, polígonos, líneas), se sombrean con luz fija
 * arriba-izquierda y se rodean de un contorno oscuro al estilo Pokémon GBA/DS.
 *
 * Es TypeScript puro (sin DOM): `blit` es lo único que toca un contexto 2D y
 * solo usa `fillRect`, así que también funciona con mocks en los tests.
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

/** Contexto mínimo que necesita `blit` (compatible con CanvasRenderingContext2D y con mocks). */
export interface FillCtx {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
}

export class PixelBuffer {
  readonly w: number;
  readonly h: number;
  /** 0 = transparente; n>0 → palette[n-1]. */
  readonly px: Uint8Array;
  readonly palette: string[] = [];
  private readonly index = new Map<string, number>();

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h);
  }

  /** Índice de paleta (1-based) para un color CSS; lo registra si es nuevo. */
  private colorIndex(css: string): number {
    let i = this.index.get(css);
    if (i === undefined) {
      this.palette.push(css);
      i = this.palette.length;
      if (i > 255) throw new Error('PixelBuffer: paleta > 255 colores');
      this.index.set(css, i);
    }
    return i;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, css: string): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    this.px[y * this.w + x] = this.colorIndex(css);
  }

  /** Color CSS del píxel o null si es transparente / fuera. */
  get(x: number, y: number): string | null {
    if (!this.inside(x, y)) return null;
    const i = this.px[y * this.w + x];
    return i === 0 ? null : this.palette[i - 1];
  }

  filled(x: number, y: number): boolean {
    return this.inside(x, y) && this.px[y * this.w + x] !== 0;
  }

  clear(x: number, y: number): void {
    if (this.inside(x, y)) this.px[y * this.w + x] = 0;
  }

  /** Nº de píxeles opacos. */
  count(): number {
    let n = 0;
    for (let i = 0; i < this.px.length; i++) if (this.px[i] !== 0) n++;
    return n;
  }

  rect(x: number, y: number, w: number, h: number, css: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, css);
  }

  /** Recorre todos los píxeles cuyo centro cae dentro de la elipse. */
  private eachInEllipse(cx: number, cy: number, rx: number, ry: number, fn: (x: number, y: number) => void): void {
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) fn(x, y);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, css: string): void {
    this.eachInEllipse(cx, cy, rx, ry, (x, y) => this.set(x, y, css));
  }

  disc(cx: number, cy: number, r: number, css: string): void {
    this.ellipse(cx, cy, r, r, css);
  }

  /** Línea de Bresenham con grosor `t` (cuadrado t×t). */
  line(x0: number, y0: number, x1: number, y1: number, css: string, t = 1): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const off = Math.floor((t - 1) / 2);
    for (;;) {
      this.rect(x0 - off, y0 - off, t, t, css);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Curva cuadrática muestreada (para troncos y hojas de palmera). */
  curve(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, css: string, t = 1, steps = 24): void {
    let px = x0;
    let py = y0;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const x = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * cx + k * k * x1;
      const y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * cy + k * k * y1;
      this.line(px, py, x, y, css, t);
      px = x;
      py = y;
    }
  }

  /** Relleno de polígono (regla par-impar sobre centros de píxel). */
  polygon(pts: ReadonlyArray<readonly [number, number]>, css: string): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
          xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, css);
      }
    }
  }

  /** Repinta (con `fn`) cada píxel opaco; `fn` devuelve un color o null para dejarlo igual. */
  paintOpaque(fn: (x: number, y: number, current: string) => string | null): void {
    const snapshot = new Uint8Array(this.px);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = snapshot[y * this.w + x];
        if (i === 0) continue;
        const next = fn(x, y, this.palette[i - 1]);
        if (next) this.set(x, y, next);
      }
    }
  }

  /** Contorno de 1 px (4-vecinos) alrededor de todo lo opaco. */
  outline(css: string, diagonal = false): void {
    const add: Array<[number, number]> = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.filled(x, y)) continue;
        const n =
          this.filled(x - 1, y) || this.filled(x + 1, y) || this.filled(x, y - 1) || this.filled(x, y + 1) ||
          (diagonal && (this.filled(x - 1, y - 1) || this.filled(x + 1, y - 1) || this.filled(x - 1, y + 1) || this.filled(x + 1, y + 1)));
        if (n) add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.set(x, y, css);
  }

  /** Copia otro buffer encima (los transparentes no pisan). */
  stamp(src: PixelBuffer, ox: number, oy: number, flipX = false): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.get(flipX ? src.w - 1 - x : x, y);
        if (c) this.set(ox + x, oy + y, c);
      }
    }
  }

  /** Reflejo horizontal en una copia nueva. */
  flippedX(): PixelBuffer {
    const out = new PixelBuffer(this.w, this.h);
    out.stamp(this, 0, 0, true);
    return out;
  }
}

/**
 * Pinta el buffer con `fillRect` agrupando tramos horizontales del mismo color.
 * (ox, oy) son coordenadas enteras del píxel superior-izquierdo.
 */
export function blit(ctx: FillCtx, buf: PixelBuffer, ox: number, oy: number, flipX = false): void {
  const ax = Math.round(ox);
  const ay = Math.round(oy);
  for (let y = 0; y < buf.h; y++) {
    let x = 0;
    while (x < buf.w) {
      const sx = flipX ? buf.w - 1 - x : x;
      const idx = buf.px[y * buf.w + sx];
      if (idx === 0) { x++; continue; }
      let run = 1;
      while (x + run < buf.w) {
        const nx = flipX ? buf.w - 1 - (x + run) : x + run;
        if (buf.px[y * buf.w + nx] !== idx) break;
        run++;
      }
      ctx.fillStyle = buf.palette[idx - 1];
      ctx.fillRect(ax + x, ay + y, run, 1);
      x += run;
    }
  }
}

/**
 * Tono de luz [-1..1] para un píxel de un volumen redondo centrado en (cx, cy)
 * con luz arriba-izquierda: 1 = muy iluminado, -1 = en sombra.
 */
export function lightAt(x: number, y: number, cx: number, cy: number, r: number): number {
  const lx = -0.55;
  const ly = -0.83;
  return (((x + 0.5 - cx) * lx + (y + 0.5 - cy) * ly) / r);
}

/** Elige un tono de `tones` (oscuro → claro) según `light` ∈ [-1,1] y umbrales crecientes. */
export function pickTone(light: number, tones: readonly string[], cuts: readonly number[]): string {
  let i = 0;
  while (i < cuts.length && light >= cuts[i]) i++;
  return tones[Math.min(i, tones.length - 1)];
}
