/**
 * PokéBastion — sprites decorativos pixel-art por bioma (estilo Pokémon GBA/DS).
 *
 * Todo se genera proceduralmente con `pixelArt.ts`: siluetas con contorno oscuro
 * de 1 px, 3-4 tonos de sombreado con luz arriba-izquierda y detalles sueltos
 * (brillos, bayas, grietas). Cada builder devuelve un `PixelBuffer` ya
 * compuesto (sombra de suelo incluida) y es determinista.
 */

import { PixelBuffer, hash2, lightAt, makeRng, mix, pickTone, scale, valueNoise } from './pixelArt';

type Disc = readonly [cx: number, cy: number, r: number];

/** Sombra elíptica suave que va DEBAJO del sprite. */
function groundShadow(w: number, h: number, cx: number, cy: number, rx: number, ry: number, alpha = 0.22): PixelBuffer {
  const s = new PixelBuffer(w, h);
  s.ellipse(cx, cy, rx, ry, `rgba(0,0,0,${alpha})`);
  return s;
}

/** Apila capas: la primera queda al fondo. */
function compose(w: number, h: number, ...layers: PixelBuffer[]): PixelBuffer {
  const out = new PixelBuffer(w, h);
  for (const l of layers) out.stamp(l, 0, 0);
  return out;
}

function inUnion(discs: readonly Disc[], x: number, y: number): boolean {
  for (const [cx, cy, r] of discs) {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

/**
 * Masa de follaje redondeada y "grumosa": unión de discos, sombreada con luz
 * global y con mechones (clumps) que añaden brillo arriba-izq. y sombra abajo-der.
 */
function leafMass(
  b: PixelBuffer,
  discs: readonly Disc[],
  tones: readonly string[],
  light: { cx: number; cy: number; r: number },
  seed: number,
  clumpR = 4.2,
): void {
  const rng = makeRng(seed);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [cx, cy, r] of discs) {
    minX = Math.min(minX, cx - r); maxX = Math.max(maxX, cx + r);
    minY = Math.min(minY, cy - r); maxY = Math.max(maxY, cy + r);
  }
  const clumps: Array<[number, number]> = [];
  const step = clumpR * 1.7;
  for (let y = minY + 2; y < maxY - 1; y += step) {
    for (let x = minX + 2; x < maxX - 1; x += step) {
      const jx = x + (rng() - 0.5) * step * 0.7 + (Math.round((y - minY) / step) % 2) * step * 0.5;
      const jy = y + (rng() - 0.5) * step * 0.7;
      if (inUnion(discs, Math.floor(jx), Math.floor(jy))) clumps.push([jx, jy]);
    }
  }
  const cuts = [-0.3, 0.12, 0.5];
  const top = tones.length - 1;
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
      if (!inUnion(discs, x, y)) continue;
      let idx = tones.indexOf(pickTone(lightAt(x, y, light.cx, light.cy, light.r), tones, cuts));
      for (const [ccx, ccy] of clumps) {
        const dx = x + 0.5 - ccx;
        const dy = y + 0.5 - ccy;
        if (dx * dx + dy * dy > clumpR * clumpR) continue;
        const l = lightAt(x, y, ccx, ccy, clumpR);
        if (l > 0.55) idx++;
        else if (l < -0.6) idx--;
        break;
      }
      b.set(x, y, tones[Math.max(0, Math.min(top, idx))]);
    }
  }
}

// ---------------------------------------------------------------------------
// RUTA VERDE
// ---------------------------------------------------------------------------

const FOLIAGE = ['#1f5a2a', '#2f8a38', '#4cb046', '#86dc66'] as const;
const FOLIAGE_OUT = '#12331c';

export function buildTree(seed = 1): PixelBuffer {
  const W = 38;
  const H = 48;
  const b = new PixelBuffer(W, H);
  // Tronco con base ensanchada y luz a la izquierda.
  const barkTones = ['#4a2a14', '#7a4a24', '#a8683a'];
  for (let y = 31; y <= 43; y++) {
    const flare = y >= 41 ? (y - 40) : 0;
    const x0 = 16 - flare;
    const x1 = 22 + flare;
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / Math.max(1, x1 - x0);
      b.set(x, y, t < 0.3 ? barkTones[2] : t < 0.7 ? barkTones[1] : barkTones[0]);
    }
  }
  b.set(18, 35, barkTones[0]); b.set(19, 38, barkTones[0]); b.set(18, 41, barkTones[2]);
  // Copa.
  const canopy: Disc[] = [
    [19, 19, 13.5],
    [9, 23, 8.5],
    [29, 23, 8.5],
    [19, 10, 8.5],
    [19, 28, 8.5],
  ];
  leafMass(b, canopy, FOLIAGE, { cx: 19, cy: 19, r: 17 }, 40 + seed);
  // Hojitas sueltas sobre el contorno superior.
  b.set(11, 6, FOLIAGE[3]); b.set(26, 7, FOLIAGE[2]);
  b.outline(FOLIAGE_OUT);
  return compose(W, H, groundShadow(W, H, 19, 44, 15, 3.4), b);
}

export function buildPine(seed = 1): PixelBuffer {
  const W = 30;
  const H = 46;
  const b = new PixelBuffer(W, H);
  const trunk = ['#4a2a14', '#7a4a24'];
  b.rect(13, 38, 4, 6, trunk[1]);
  b.rect(15, 38, 2, 6, trunk[0]);
  const tiers: Array<{ apexY: number; baseY: number; hw: number }> = [
    { apexY: 1, baseY: 15, hw: 8 },
    { apexY: 8, baseY: 26, hw: 11 },
    { apexY: 16, baseY: 38, hw: 14 },
  ];
  const tones = ['#1b5028', '#2a7c34', '#44a444', '#7cd062'];
  for (const t of tiers) {
    const cx = 15;
    // Triángulo con borde inferior dentado.
    const pts: Array<[number, number]> = [[cx, t.apexY]];
    const n = 4;
    for (let i = 0; i <= n; i++) pts.push([cx + t.hw - (i * t.hw) / n, t.baseY - (i % 2 === 0 ? 0 : 2)]);
    pts.push([cx, t.baseY - 1]);
    for (let i = 1; i <= n; i++) pts.push([cx - (i * t.hw) / n, t.baseY - (i % 2 === 0 ? 0 : 2)]);
    const tier = new PixelBuffer(W, H);
    tier.polygon(pts, tones[2]);
    tier.paintOpaque((x, y) => {
      const rel = (x + 0.5 - cx) / t.hw; // -1 izq … 1 der
      const down = (y - t.apexY) / (t.baseY - t.apexY);
      if (rel > 0.35) return tones[0];
      if (rel > 0.0) return tones[1];
      if (rel < -0.55 && (x + y) % 4 === 0) return tones[3];
      if (down > 0.82) return tones[1];
      return tones[2];
    });
    tier.outline(FOLIAGE_OUT);
    b.stamp(tier, 0, 0);
  }
  b.outline(FOLIAGE_OUT);
  b.rect(12, 44, 6, 1, FOLIAGE_OUT);
  void seed;
  return compose(W, H, groundShadow(W, H, 15, 43, 12, 2.6), b);
}

export function buildBush(withBerries = false, seed = 1): PixelBuffer {
  const W = 26;
  const H = 20;
  const b = new PixelBuffer(W, H);
  const discs: Disc[] = [[7, 11, 6.5], [13, 8.5, 7.5], [19, 11, 6.5], [13, 12.5, 6.5]];
  leafMass(b, discs, FOLIAGE, { cx: 13, cy: 10, r: 12 }, 7 + seed, 3.6);
  if (withBerries) {
    for (const [x, y] of [[8, 9], [15, 7], [18, 12], [11, 13], [14, 11]] as const) {
      b.set(x, y, '#e83850'); b.set(x, y - 1, '#ff8898');
    }
  }
  b.outline(FOLIAGE_OUT);
  return compose(W, H, groundShadow(W, H, 13, 17, 11.5, 2.4), b);
}

/** Pequeño macizo de flores (rojas, amarillas, azules y blancas). */
export function buildFlowerPatch(seed = 1): PixelBuffer {
  const W = 18;
  const H = 12;
  const b = new PixelBuffer(W, H);
  const rng = makeRng(90 + seed);
  const colors = ['#f05868', '#ffffff', '#f8d838', '#68a8f8', '#f890c8'];
  const spots: Array<[number, number]> = [[3, 3], [9, 2], [14, 4], [6, 8], [12, 9]];
  for (const [fx, fy] of spots) {
    b.set(fx, fy + 2, '#2f8a38'); b.set(fx - 1, fy + 3, '#2f8a38'); b.set(fx + 1, fy + 3, '#4cb046');
    const c = colors[Math.floor(rng() * colors.length)];
    b.set(fx, fy - 1, c); b.set(fx - 1, fy, c); b.set(fx + 1, fy, c); b.set(fx, fy + 1, c);
    b.set(fx, fy, c === '#f8d838' ? '#f08030' : '#f8d838');
  }
  return b;
}

export function buildBoulder(
  palette: { dark: string; mid: string; light: string; hi: string; out: string },
  w = 20,
  h = 15,
  seed = 1,
): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const rng = makeRng(300 + seed);
  const cx = w / 2;
  const cy = h * 0.58;
  const pts: Array<[number, number]> = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.3;
    const rr = 0.92 + rng() * 0.1;
    pts.push([cx + Math.cos(a) * (w / 2 - 1.5) * rr, cy + Math.sin(a) * (h / 2 - 2) * rr * 1.05]);
  }
  b.polygon(pts, palette.mid);
  b.paintOpaque((x, y) => {
    const l = lightAt(x, y, cx, cy, Math.max(w, h) / 2);
    return pickTone(l, [palette.dark, palette.mid, palette.light, palette.hi], [-0.3, 0.25, 0.7]);
  });
  // Grietas.
  b.line(Math.round(cx + 1), Math.round(cy - 1), Math.round(cx + 3), Math.round(cy + 3), palette.dark);
  b.set(Math.round(cx - 4), Math.round(cy + 1), palette.dark);
  b.outline(palette.out);
  return compose(w, h, groundShadow(w, h, cx, h - 2.5, w / 2 - 1, 2.2), b);
}

export function buildRock(seed = 1): PixelBuffer {
  return buildBoulder({ dark: '#6a6a64', mid: '#9a9a90', light: '#c4c4b8', hi: '#ececdf', out: '#34342e' }, 20, 15, seed);
}

export function buildSign(): PixelBuffer {
  const W = 16;
  const H = 20;
  const b = new PixelBuffer(W, H);
  b.rect(7, 10, 2, 8, '#7a4a24');
  b.rect(8, 10, 1, 8, '#4a2a14');
  b.rect(2, 2, 12, 9, '#c88a4c');
  b.rect(2, 2, 12, 2, '#e4b070');
  b.rect(2, 9, 12, 2, '#9a6030');
  b.rect(4, 5, 8, 1, '#5a3418');
  b.rect(4, 7, 5, 1, '#5a3418');
  b.set(3, 3, '#f0e0b8'); b.set(12, 9, '#6a4020');
  b.outline('#2c1808');
  return compose(W, H, groundShadow(W, H, 8, 18, 6.5, 1.8), b);
}

// ---------------------------------------------------------------------------
// CUEVA UMBRÍA
// ---------------------------------------------------------------------------

export function buildStalagmite(h = 30, seed = 1): PixelBuffer {
  const W = 20;
  const b = new PixelBuffer(W, h + 4);
  const cx = 10;
  const baseY = h;
  const tones = { dark: '#2a2342', mid: '#4a4070', light: '#6e62a0', hi: '#9a8cd0' };
  const lean = hash2(seed, 5) > 0.5 ? 1 : -1;
  const pts: Array<[number, number]> = [
    [cx + lean, 1],
    [cx + 3.2, h * 0.45],
    [cx + 7.5, baseY - 2],
    [cx + 8.5, baseY],
    [cx - 8.5, baseY],
    [cx - 7.5, baseY - 2],
    [cx - 3.2, h * 0.45],
  ];
  b.polygon(pts, tones.mid);
  b.paintOpaque((x, y) => {
    const rel = (x + 0.5 - (cx + lean * (1 - y / h))) / 8;
    if (rel > 0.18) return tones.dark;
    if (rel < -0.55 && y % 5 !== 0) return tones.hi;
    if (rel < -0.1) return tones.light;
    return tones.mid;
  });
  // Estrías y goteo.
  for (let y = 6; y < h - 3; y += 6) b.line(cx - 2, y, cx + 2 + (y % 3), y + 1, tones.dark);
  b.outline('#0c0818');
  return compose(W, h + 4, groundShadow(W, h + 4, cx, h + 1.5, 9.5, 2.2, 0.3), b);
}

/** Racimo de cristales brillantes (#8a6fd0) con halo. */
export function buildCrystalCluster(seed = 1): PixelBuffer {
  const W = 38;
  const H = 38;
  const b = new PixelBuffer(W, H);
  const halo = new PixelBuffer(W, H);
  halo.ellipse(19, 22, 17, 14, 'rgba(138,111,208,0.14)');
  halo.ellipse(19, 22, 12, 10, 'rgba(176,156,240,0.16)');
  const crystals: Array<{ x: number; base: number; w: number; h: number; tilt: number }> = [
    { x: 12, base: 33, w: 8, h: 18, tilt: -3 },
    { x: 25, base: 34, w: 9, h: 20, tilt: 3 },
    { x: 19, base: 32, w: 10, h: 28, tilt: 0 },
    { x: 6, base: 34, w: 6, h: 11, tilt: -4 },
    { x: 31, base: 35, w: 6, h: 12, tilt: 4 },
  ].sort((p, q) => p.base - q.base);
  for (const c of crystals) {
    const left = '#b8a4f8';
    const right = '#6a48b8';
    const tipX = c.x + c.tilt;
    const tipY = c.base - c.h;
    const shoulderY = tipY + Math.round(c.w * 0.8);
    const lt: [number, number] = [c.x - c.w / 2 + c.tilt * 0.4, shoulderY];
    const rt: [number, number] = [c.x + c.w / 2 + c.tilt * 0.4, shoulderY];
    const lb: [number, number] = [c.x - c.w / 2, c.base];
    const rb: [number, number] = [c.x + c.w / 2, c.base];
    const mb: [number, number] = [c.x, c.base + 1];
    const mt: [number, number] = [c.x + c.tilt * 0.2, shoulderY + 1];
    b.polygon([[tipX, tipY], lt, lb, mb, mt], left);
    b.polygon([[tipX, tipY], mt, mb, rb, rt], right);
    b.line(Math.round(tipX), tipY + 1, Math.round(lt[0] + 1), Math.round(lt[1] + (c.base - shoulderY) * 0.55), '#f0e8ff');
    b.set(Math.round(tipX), tipY + 2, '#ffffff');
    b.set(Math.round(c.x + c.w * 0.25), Math.round(c.base - 3), '#4a2e90');
  }
  b.outline('#2a1660');
  void seed;
  return compose(W, H, halo, groundShadow(W, H, 19, 35, 16, 2.6, 0.28), b);
}

export function buildCaveBoulder(seed = 1): PixelBuffer {
  return buildBoulder({ dark: '#241e38', mid: '#40385e', light: '#625a8a', hi: '#8a80b8', out: '#0c0818' }, 22, 16, seed);
}

export function buildGlowShroom(): PixelBuffer {
  const W = 16;
  const H = 16;
  const b = new PixelBuffer(W, H);
  const halo = new PixelBuffer(W, H);
  halo.ellipse(8, 8, 8, 7, 'rgba(88,224,200,0.16)');
  b.ellipse(8, 7, 6, 4.2, '#2cb0a0');
  b.paintOpaque((x, y) => (y < 6 && x < 8 ? '#58e8d0' : y > 8 ? '#188878' : null));
  b.rect(7, 10, 3, 4, '#e8e0d0');
  b.rect(9, 10, 1, 4, '#b8b0a0');
  b.set(5, 5, '#e8fff8'); b.set(9, 4, '#e8fff8'); b.set(11, 6, '#e8fff8');
  b.outline('#0c3a3a');
  return compose(W, H, halo, b);
}

// ---------------------------------------------------------------------------
// MONTE ÍGNEO
// ---------------------------------------------------------------------------

/** Charco de lava con borde de roca oscura y bandas de calor con ruido. */
export function buildLavaPool(seed = 1): PixelBuffer {
  const W = 68;
  const H = 46;
  const b = new PixelBuffer(W, H);
  const glow = new PixelBuffer(W, H);
  glow.ellipse(34, 23, 33, 21, 'rgba(240,128,48,0.12)');
  glow.ellipse(34, 23, 29, 18, 'rgba(240,128,48,0.14)');
  const cx = 34;
  const cy = 23;
  const wobble = (x: number, y: number, k: number) => (valueNoise(x, y, 6, seed * 11 + k) - 0.5) * 0.28;
  const bands = ['#7a1408', '#b82a0c', '#e8581a', '#f89830', '#ffd860', '#fff4b0'];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / 25;
      const dy = (y + 0.5 - cy) / 15.5;
      const d = Math.sqrt(dx * dx + dy * dy) + wobble(x, y, 1);
      if (d > 1.0) continue;
      if (d > 0.84) { b.set(x, y, '#3a1c14'); continue; } // borde de roca
      const heat = 1 - d / 0.84 + (valueNoise(x, y, 4, seed * 7 + 3) - 0.5) * 0.35;
      const i = Math.max(0, Math.min(bands.length - 1, Math.floor(heat * bands.length * 0.95)));
      b.set(x, y, bands[i]);
    }
  }
  // Luz en el borde de roca (arriba-izq.) y burbujas.
  b.paintOpaque((x, y, c) => (c === '#3a1c14' && (x + y) % 3 === 0 && y < cy ? '#6a3a28' : null));
  for (const [bx, by] of [[26, 18], [38, 26], [44, 19], [30, 29]] as const) {
    b.set(bx, by, '#fff4b0'); b.set(bx + 1, by, '#ffd860');
  }
  b.outline('#160806');
  return compose(W, H, glow, b);
}

export function buildLavaRock(seed = 1): PixelBuffer {
  const b = buildBoulder({ dark: '#1c0e0a', mid: '#38201a', light: '#5a382c', hi: '#7c5240', out: '#0a0402' }, 22, 16, seed);
  // Vetas incandescentes.
  const veins: Array<[number, number, number, number]> = [[8, 6, 11, 9], [13, 9, 15, 8]];
  for (const [x0, y0, x1, y1] of veins) {
    b.line(x0, y0, x1, y1, '#f08030');
    b.set(x0, y0, '#ffd860');
  }
  return b;
}

export function buildDeadTree(seed = 1): PixelBuffer {
  const W = 30;
  const H = 40;
  const b = new PixelBuffer(W, H);
  const dark = '#241410';
  const mid = '#4a2c20';
  const lit = '#7a4a34';
  b.line(15, 36, 15, 14, mid, 4);
  b.line(14, 36, 14, 14, lit, 1);
  b.line(16, 22, 6, 10, mid, 3);
  b.line(15, 18, 24, 6, mid, 3);
  b.line(7, 12, 3, 5, mid, 2);
  b.line(23, 8, 27, 3, mid, 2);
  b.line(15, 14, 15, 3, mid, 2);
  b.paintOpaque((x, y, c) => (c === mid && (x + y) % 5 === 0 ? dark : null));
  b.set(12, 34, lit); b.set(13, 30, lit);
  // Brasas en las puntas.
  for (const [x, y] of [[3, 5], [27, 3], [15, 3]] as const) b.set(x, y, '#f08030');
  b.outline('#0a0402');
  void seed;
  return compose(W, H, groundShadow(W, H, 15, 37, 11, 2.4, 0.3), b);
}

// ---------------------------------------------------------------------------
// COSTA Y RUINAS
// ---------------------------------------------------------------------------

export function buildPalm(seed = 1): PixelBuffer {
  const W = 58;
  const H = 54;
  const b = new PixelBuffer(W, H);
  const trunkDark = '#5a3814';
  const trunkLight = '#b07c3c';
  // Tronco curvo con anillos.
  const crownX = 28;
  const crownY = 16;
  b.curve(22, 50, 20, 32, crownX, crownY, trunkDark, 5);
  b.curve(21, 50, 19, 32, crownX - 1, crownY, trunkLight, 2);
  for (let i = 0; i < 9; i++) {
    const k = i / 9;
    const x = (1 - k) * (1 - k) * 22 + 2 * (1 - k) * k * 20 + k * k * crownX;
    const y = (1 - k) * (1 - k) * 50 + 2 * (1 - k) * k * 32 + k * k * crownY;
    b.set(Math.round(x) - 2, Math.round(y), '#3a2008');
    b.set(Math.round(x) + 2, Math.round(y), '#3a2008');
  }
  // Frondas: curva oscura + nervio claro + puntas colgantes.
  const fronds: Array<[number, number, number, number]> = [
    [-22, -4, -26, 8],
    [-17, -13, -22, -2],
    [-6, -18, -10, -8],
    [8, -17, 12, -5],
    [19, -9, 24, 4],
    [22, 1, 25, 12],
    [-2, -20, 0, -12],
  ];
  const leafDark = '#1c6a2c';
  const leafMid = '#34a040';
  const leafLight = '#7ad860';
  for (const [dx, dy, ex, ey] of fronds) {
    const tipX = crownX + ex;
    const tipY = crownY + ey;
    const ctrlX = crownX + dx;
    const ctrlY = crownY + dy;
    b.curve(crownX, crownY, ctrlX, ctrlY, tipX, tipY, leafDark, 4);
    b.curve(crownX, crownY - 1, ctrlX, ctrlY - 1, tipX, tipY - 1, leafMid, 2);
    b.curve(crownX, crownY - 2, ctrlX, ctrlY - 2, tipX, tipY - 2, leafLight, 1);
  }
  // Cocos.
  b.disc(crownX - 2, crownY + 4, 1.8, '#5a3414');
  b.disc(crownX + 2, crownY + 5, 1.8, '#7a4a20');
  b.outline('#10281a');
  void seed;
  return compose(W, H, groundShadow(W, H, 22, 51, 12, 2.4, 0.25), b);
}

/** Columna de mármol (rota o entera) con acanaladuras y vetas de musgo azulado. */
export function buildColumn(broken = true, seed = 1): PixelBuffer {
  const W = 24;
  const H = 46;
  const b = new PixelBuffer(W, H);
  const m = { dark: '#7a7668', mid: '#aaa698', light: '#d4d0c2', hi: '#f4f1e4' };
  const top = broken ? 14 : 5;
  // Basamento.
  b.rect(3, 38, 18, 5, m.mid);
  b.rect(3, 38, 18, 1, m.hi);
  b.rect(3, 42, 18, 1, m.dark);
  b.rect(5, 35, 14, 3, m.light);
  b.rect(5, 37, 14, 1, m.dark);
  // Fuste con acanaladuras.
  for (let y = top; y < 35; y++) {
    for (let x = 6; x < 18; x++) {
      const rel = (x - 6) / 11;
      const flute = (x - 6) % 4;
      let c = rel < 0.28 ? m.light : rel < 0.72 ? m.mid : m.dark;
      if (flute === 0 && rel > 0.3) c = m.dark;
      if (flute === 1 && rel < 0.7) c = rel < 0.3 ? m.hi : m.light;
      b.set(x, y, c);
    }
  }
  if (broken) {
    // Borde superior irregular y escombros.
    const rng = makeRng(500 + seed);
    for (let x = 6; x < 18; x++) {
      const cut = Math.floor(rng() * 5);
      for (let y = top; y < top + cut; y++) b.clear(x, y);
    }
    b.rect(2, 41, 3, 2, m.mid); b.rect(19, 40, 3, 3, m.light); b.set(20, 40, m.hi);
  } else {
    b.rect(4, 2, 16, 3, m.light); b.rect(4, 2, 16, 1, m.hi);
    b.rect(6, 5, 12, 2, m.mid);
  }
  // Musgo / glifo azul.
  b.set(11, 24, '#58a8d8'); b.set(12, 24, '#58a8d8'); b.set(12, 25, '#3888b8'); b.set(9, 29, '#58a8d8');
  b.outline('#2c2a22');
  return compose(W, H, groundShadow(W, H, 12, 43, 11.5, 2.2), b);
}

export function buildTidePool(seed = 1): PixelBuffer {
  const W = 42;
  const H = 26;
  const b = new PixelBuffer(W, H);
  const cx = 21;
  const cy = 13;
  const sand = ['#a8935a', '#c8b078', '#e8d8a0'];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / 19.5;
      const dy = (y + 0.5 - cy) / 11.5;
      const d = Math.sqrt(dx * dx + dy * dy) + (valueNoise(x, y, 5, seed * 3) - 0.5) * 0.22;
      if (d > 1) continue;
      if (d > 0.78) { b.set(x, y, y < cy ? sand[2] : sand[0]); continue; }
      const t = d / 0.78;
      b.set(x, y, t > 0.72 ? '#3888c8' : t > 0.4 ? '#58b4e8' : '#8ad4f8');
    }
  }
  for (const [x, y] of [[13, 10], [14, 10], [27, 15], [28, 15], [20, 12]] as const) b.set(x, y, '#e8faff');
  b.line(16, 15, 20, 15, '#3888c8');
  b.outline('#4a3c1c');
  return b;
}

export function buildStarfish(): PixelBuffer {
  const b = new PixelBuffer(11, 11);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 5 : 2.1;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([5.5 + Math.cos(a) * r, 5.5 + Math.sin(a) * r]);
  }
  b.polygon(pts, '#f08848');
  b.paintOpaque((x, y) => (x + y > 11 ? '#c8602c' : (x + y) % 3 === 0 ? '#f8b070' : null));
  b.set(5, 5, '#fff0d0');
  b.outline('#5a2c14');
  return b;
}

export function buildShell(): PixelBuffer {
  const b = new PixelBuffer(10, 8);
  b.polygon([[5, 7], [0.5, 3.5], [2, 1], [5, 0.5], [8, 1], [9.5, 3.5]], '#f8d8d8');
  for (const x of [3, 5, 7]) b.line(5, 7, x, 2, '#e8a0b0');
  b.set(4, 1, '#ffffff');
  b.outline('#8a5a68');
  return b;
}

// ---------------------------------------------------------------------------
// Micro-decoración de suelo (matas, flores sueltas, guijarros, grietas...)
// ---------------------------------------------------------------------------

/** Mata de hierba alta al estilo Pokémon (3 hojas en "w"). */
export function buildGrassTuft(dark: string, light: string, variant = 0): PixelBuffer {
  const b = new PixelBuffer(7, 6);
  const rows = variant % 2 === 0
    ? [[1, 0], [3, 1], [5, 0], [1, 1], [2, 2], [3, 2], [4, 2], [5, 1], [2, 3], [3, 3], [4, 3], [3, 4]]
    : [[0, 1], [2, 0], [4, 1], [6, 0], [1, 2], [2, 2], [3, 3], [4, 2], [5, 2], [3, 4], [2, 4], [4, 4]];
  for (const [x, y] of rows) b.set(x, y, dark);
  b.set(1, 0, light); b.set(5, 0, light); b.set(3, 1, light);
  return b;
}

export function buildTinyFlower(color: string): PixelBuffer {
  const b = new PixelBuffer(5, 6);
  b.set(2, 0, color); b.set(1, 1, color); b.set(3, 1, color); b.set(2, 2, color);
  b.set(2, 1, '#f8d838');
  b.set(2, 3, '#2f8a38'); b.set(1, 4, '#2f8a38'); b.set(3, 4, '#4cb046'); b.set(2, 5, '#2f8a38');
  return b;
}

export function buildPebble(dark: string, mid: string, light: string): PixelBuffer {
  const b = new PixelBuffer(6, 4);
  b.rect(1, 1, 4, 2, mid);
  b.rect(2, 0, 2, 1, mid);
  b.rect(1, 3, 4, 1, dark);
  b.set(0, 2, dark); b.set(5, 2, dark);
  b.set(2, 1, light); b.set(3, 0, light);
  return b;
}

export function buildCrack(dark: string, glow?: string): PixelBuffer {
  const b = new PixelBuffer(10, 5);
  const path: Array<[number, number]> = [[0, 2], [1, 2], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3], [7, 3], [8, 2], [9, 2], [5, 3], [5, 4]];
  for (const [x, y] of path) b.set(x, y, dark);
  if (glow) for (const [x, y] of [[2, 1], [3, 1], [4, 2], [5, 2], [6, 3]] as const) b.set(x, y, glow);
  return b;
}

export function buildSandRipple(dark: string, light: string): PixelBuffer {
  const b = new PixelBuffer(10, 4);
  for (const [x, y] of [[0, 1], [1, 0], [2, 0], [3, 1], [4, 1], [5, 0], [6, 0], [7, 1], [8, 1], [9, 0]] as const) b.set(x, y, dark);
  for (const [x, y] of [[1, 1], [2, 1], [5, 1], [6, 1]] as const) b.set(x, y, light);
  return b;
}

export function buildEmber(): PixelBuffer {
  const b = new PixelBuffer(4, 4);
  b.rect(1, 1, 2, 2, '#f08030');
  b.set(1, 1, '#ffd860'); b.set(2, 0, '#f8a040'); b.set(0, 3, '#7a2a10');
  return b;
}

export function buildCrystalShard(): PixelBuffer {
  const b = new PixelBuffer(5, 7);
  b.polygon([[2.5, 0], [4.5, 3], [4.5, 6], [0.5, 6], [0.5, 3]], '#8a6fd0');
  b.rect(0, 3, 2, 3, '#b8a4f8');
  b.set(2, 1, '#ffffff');
  b.outline('#2a1660');
  return b;
}

/** Tono de ayuda para derivar sombras del suelo desde la paleta de bioma. */
export function groundTones(groundA: string, groundB: string): { base: string; patch: string; dark: string; light: string } {
  return {
    base: groundA,
    patch: mix(groundA, groundB, 0.55),
    dark: scale(groundB, 0.8),
    light: mix(groundA, '#ffffff', 0.16),
  };
}

// ---------------------------------------------------------------------------
// Plataforma central del Bastión (emblema de Poké Ball)
// ---------------------------------------------------------------------------

export function buildPlatformSprite(radius = 48): PixelBuffer {
  const d = radius * 2 + 2;
  const b = new PixelBuffer(d, d);
  const c = d / 2;
  const R = radius;
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy);
      if (r > R) continue;
      const ang = Math.atan2(dy, dx);
      // Anillo exterior discontinuo (14 tramos).
      if (r > R - 2.2) {
        const seg = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 28) % 2 === 0;
        b.set(x, y, seg ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.14)');
        continue;
      }
      // Banda central de la Poké Ball.
      if (Math.abs(dy) < 3 && r > 15) { b.set(x, y, 'rgba(32,32,40,0.30)'); continue; }
      // Botón central.
      if (r < 15) {
        if (r > 12) b.set(x, y, 'rgba(32,32,40,0.30)');
        else if (r > 8.5) b.set(x, y, 'rgba(255,255,255,0.20)');
        else b.set(x, y, 'rgba(255,255,255,0.10)');
        continue;
      }
      // Mitades: arriba casi transparente, abajo más clara (sutil para no estorbar a los sprites).
      b.set(x, y, dy < 0 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.20)');
    }
  }
  return b;
}

