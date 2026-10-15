/**
 * PokéBastion — cargador de sprites animados de PMDCollab (SpriteCollab).
 * Lee `AnimData.xml` (tamaño de frame + duraciones + <CopyOf>) y las hojas
 * `Walk-Anim.png` / `Idle-Anim.png` / `Attack-Anim.png` (8 filas = 8 direcciones,
 * orden: S, SE, E, NE, N, NW, W, SW). Carga perezosa con caché; mientras no esté
 * listo `getSprite` devuelve null y el renderer usa su fallback.
 *
 * Cuando exista `pnpm run sync:pokemon`, cambia SPRITE_BASE por '/sprites'.
 */

import { PokemonType } from '../core/types';
import type { Enemy } from '../core/types';

const SPRITE_BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite';
const TICK_MS = 1000 / 60; // las duraciones de AnimData están en ticks de 1/60 s

export type AnimName = 'walk' | 'idle' | 'attack';

interface AnimInfo {
  img: HTMLImageElement;
  fw: number;
  fh: number;
  durs: number[];
  rows: number;
  totalMs: number;
}
type SpriteSet = Partial<Record<AnimName, AnimInfo>> & { walk: AnimInfo };

const cache = new Map<string, SpriteSet | 'loading' | 'error'>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`sprite: ${url}`));
    img.src = url;
  });
}

interface RawAnim { fw: number; fh: number; durs: number[]; copyOf?: string }

async function loadSet(id: string): Promise<SpriteSet> {
  const res = await fetch(`${SPRITE_BASE}/${id}/AnimData.xml`);
  if (!res.ok) throw new Error(`AnimData ${id}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');

  const raw = new Map<string, RawAnim>();
  for (const a of Array.from(doc.querySelectorAll('Anims > Anim'))) {
    const name = a.querySelector('Name')?.textContent?.trim();
    if (!name) continue;
    raw.set(name, {
      fw: Number(a.querySelector('FrameWidth')?.textContent),
      fh: Number(a.querySelector('FrameHeight')?.textContent),
      durs: Array.from(a.querySelectorAll('Durations > Duration')).map((d) => Number(d.textContent)),
      copyOf: a.querySelector('CopyOf')?.textContent?.trim(),
    });
  }
  /** <CopyOf> reutiliza la hoja (y datos) de otra animación. */
  const resolve = (name: string, depth = 0): { file: string; a: RawAnim } | null => {
    const a = raw.get(name);
    if (!a) return null;
    if (a.copyOf && depth < 4) return resolve(a.copyOf, depth + 1);
    return a.fw > 0 && a.fh > 0 && a.durs.length > 0 ? { file: name, a } : null;
  };

  const images = new Map<string, Promise<HTMLImageElement>>();
  const build = async (name: string): Promise<AnimInfo | undefined> => {
    const r = resolve(name);
    if (!r) return undefined;
    if (!images.has(r.file)) images.set(r.file, loadImage(`${SPRITE_BASE}/${id}/${r.file}-Anim.png`));
    const img = await images.get(r.file)!;
    const total = r.a.durs.reduce((s, d) => s + d, 0) * TICK_MS;
    return {
      img, fw: r.a.fw, fh: r.a.fh, durs: r.a.durs,
      rows: Math.max(1, Math.round(img.naturalHeight / r.a.fh)),
      totalMs: Math.max(1, total),
    };
  };

  const [walk, idle, attack] = await Promise.all([
    build('Walk'),
    build('Idle').catch(() => undefined),
    build('Attack').catch(() => undefined),
  ]);
  if (!walk) throw new Error(`Walk ${id}`);
  return { walk, idle, attack };
}

/** Devuelve el set cuando está cargado; si no, dispara la carga y devuelve null. */
export function getSprite(id: string): SpriteSet | null {
  const hit = cache.get(id);
  if (hit && hit !== 'loading' && hit !== 'error') return hit;
  if (!hit) {
    cache.set(id, 'loading');
    loadSet(id).then((s) => cache.set(id, s)).catch(() => cache.set(id, 'error'));
  }
  return null;
}

/** Fila de la hoja (S,SE,E,NE,N,NW,W,SW) para un vector en coordenadas de pantalla. */
export function dirRow(dx: number, dy: number): number {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI; // 0=E, 90=S (y hacia abajo)
  return (((Math.round((90 - deg) / 45) % 8) + 8) % 8);
}

/** Dibuja el frame actual centrado en (x,y), escalado a `targetH` px lógicos de alto. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  set: SpriteSet,
  anim: AnimName,
  row: number,
  nowMs: number,
  x: number,
  y: number,
  targetH: number,
): void {
  const a = set[anim] ?? set.walk;
  let t = nowMs % a.totalMs;
  let frame = 0;
  for (let i = 0; i < a.durs.length; i++) {
    const d = a.durs[i] * TICK_MS;
    if (t < d) { frame = i; break; }
    t -= d;
  }
  const s = targetH / a.fh;
  const w = a.fw * s;
  const h = a.fh * s;
  const r = a.rows > 1 ? Math.min(row, a.rows - 1) : 0;
  ctx.drawImage(a.img, frame * a.fw, r * a.fh, a.fw, a.fh, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
}

/* Enemigos: el core aún no asigna especie (definitionId 'WILD'/'BOSS'), así que el
 * renderer elige una por tipo primario. Cuando el core la asigne, usar enemy.definitionId. */
const T = PokemonType;
const WILD_BY_TYPE: Record<PokemonType, string> = {
  [T.Normal]: '0019', [T.Fire]: '0058', [T.Water]: '0054', [T.Grass]: '0043',
  [T.Electric]: '0100', [T.Ice]: '0086', [T.Fighting]: '0056', [T.Poison]: '0088',
  [T.Ground]: '0050', [T.Flying]: '0016', [T.Psychic]: '0063', [T.Bug]: '0010',
  [T.Rock]: '0074', [T.Ghost]: '0092', [T.Dragon]: '0147', [T.Dark]: '0228',
  [T.Steel]: '0081', [T.Fairy]: '0035',
};
const BOSS_BY_TYPE: Record<PokemonType, string> = {
  [T.Normal]: '0143', [T.Fire]: '0059', [T.Water]: '0130', [T.Grass]: '0045',
  [T.Electric]: '0125', [T.Ice]: '0131', [T.Fighting]: '0068', [T.Poison]: '0089',
  [T.Ground]: '0051', [T.Flying]: '0018', [T.Psychic]: '0065', [T.Bug]: '0127',
  [T.Rock]: '0095', [T.Ghost]: '0094', [T.Dragon]: '0149', [T.Dark]: '0248',
  [T.Steel]: '0376', [T.Fairy]: '0036',
};

export function speciesForEnemy(e: Enemy): string {
  return (e.isBoss ? BOSS_BY_TYPE : WILD_BY_TYPE)[e.types[0]];
}
