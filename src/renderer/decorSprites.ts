/**
 * PokéBastion — acceso a los sprites decorativos: Spritesheets PNG editables por bioma,
 * con fallback procedural si no están disponibles.
 *
 * Los spritesheets viven en `public/decor/<bioma>.png` (ver docs/DECOR_SPRITES.md y decor_atlas.json).
 * Se precargan una vez en paralelo (5 imágenes en total en lugar de 51 peticiones individuales);
 * mientras tanto la arena pinta un suelo liso (ver `decorReady`) para evitar saltos visuales.
 */

import { DECOR_CATALOG } from './decorCatalog';
import type { DecorName } from './decorCatalog';
import { DECOR_ATLAS } from './decorAtlas';
import type { DecorFrame, DecorSheetName } from './decorAtlas';
import { PixelBuffer, blit } from './pixelArt';

export interface DecorSprite {
  w: number;
  h: number;
  /** Dibuja con la esquina superior-izquierda en (x, y); `flip` = espejo horizontal. */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, flip?: boolean): void;
}

const PRELOAD_TIMEOUT_MS = 4000;
const sheetImages = new Map<DecorSheetName, HTMLImageElement>();
const procedural = new Map<string, PixelBuffer>();
let loading: Promise<void> | null = null;
let ready = typeof Image === 'undefined'; // entornos sin DOM (tests): solo procedural
let activeFrames: Record<string, DecorFrame> = { ...DECOR_ATLAS.frames };

export function decorBaseUrl(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Carga (una sola vez) todas las hojas de spritesheets disponibles en public/decor/<sheet>.png. */
export function preloadDecor(): Promise<void> {
  if (loading) return loading;
  if (typeof Image === 'undefined') {
    ready = true;
    loading = Promise.resolve();
    return loading;
  }

  const sheets = Object.keys(DECOR_ATLAS.sheets) as DecorSheetName[];
  const loadSheet = (sheet: DecorSheetName) =>
    new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          sheetImages.set(sheet, img);
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = `${decorBaseUrl()}decor/${sheet}.png`;
    });

  // Intentar cargar atlas.json si existe en runtime por si el usuario editó coordenadas manualmente
  const loadAtlasJson = () =>
    fetch(`${decorBaseUrl()}decor/decor_atlas.json`)
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data?.frames) {
          activeFrames = { ...activeFrames, ...data.frames };
        }
      })
      .catch(() => {});

  const all = Promise.all([...sheets.map(loadSheet), loadAtlasJson()]).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, PRELOAD_TIMEOUT_MS));
  loading = Promise.race([all, timeout]).then(() => {
    ready = true;
  });
  return loading;
}

/** true cuando ya se intentó cargar todos los spritesheets (o no hay DOM). */
export function decorReady(): boolean {
  return ready;
}

/** Sprite listo para dibujar: extraído de la spritesheet PNG correspondiente o builder procedural. */
export function getDecorSprite(name: DecorName): DecorSprite {
  const frame: DecorFrame | undefined = activeFrames[name] ?? DECOR_ATLAS.frames[name];
  if (frame) {
    const img = sheetImages.get(frame.sheet);
    if (img) {
      const { x: sx, y: sy, w, h } = frame;
      return {
        w,
        h,
        draw(ctx, x, y, flip = false) {
          const ix = Math.round(x);
          const iy = Math.round(y);
          if (!flip) {
            ctx.drawImage(img, sx, sy, w, h, ix, iy, w, h);
            return;
          }
          ctx.save();
          ctx.translate(ix + w, iy);
          ctx.scale(-1, 1);
          ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
          ctx.restore();
        },
      };
    }
  }

  // Fallback procedural
  let buf = procedural.get(name);
  if (!buf) {
    buf = DECOR_CATALOG[name]();
    procedural.set(name, buf);
  }
  const b = buf;
  return { w: b.w, h: b.h, draw: (ctx, x, y, flip = false) => blit(ctx, b, x, y, flip) };
}
