/**
 * PokéBastion — acceso a los sprites decorativos: PNG editable si existe, builder procedural si no.
 *
 * Los PNG viven en `public/decor/<nombre>.png` (ver docs/DECOR_SPRITES.md). Se precargan
 * una vez; mientras tanto el arena pinta un suelo liso (ver `decorReady`) para que no haya
 * "salto" visual entre el sprite procedural y el PNG editado.
 */

import { DECOR_CATALOG } from './decorCatalog';
import type { DecorName } from './decorCatalog';
import { PixelBuffer, blit } from './pixelArt';

export interface DecorSprite {
  w: number;
  h: number;
  /** Dibuja con la esquina superior-izquierda en (x, y); `flip` = espejo horizontal. */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, flip?: boolean): void;
}

const PRELOAD_TIMEOUT_MS = 4000;
const images = new Map<string, HTMLImageElement>();
const procedural = new Map<string, PixelBuffer>();
let loading: Promise<void> | null = null;
let ready = typeof Image === 'undefined'; // entornos sin DOM (tests): solo procedural

export function decorBaseUrl(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Carga (una sola vez) todos los PNG disponibles. Los que falten se ignoran sin error. */
export function preloadDecor(): Promise<void> {
  if (loading) return loading;
  if (typeof Image === 'undefined') {
    ready = true;
    loading = Promise.resolve();
    return loading;
  }
  const one = (name: string) =>
    new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) images.set(name, img);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = `${decorBaseUrl()}decor/${name}.png`;
    });
  const all = Promise.all(Object.keys(DECOR_CATALOG).map(one)).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, PRELOAD_TIMEOUT_MS));
  loading = Promise.race([all, timeout]).then(() => {
    ready = true;
  });
  return loading;
}

/** true cuando ya se intentó cargar todos los PNG (o no hay DOM). */
export function decorReady(): boolean {
  return ready;
}

/** Sprite listo para dibujar: el PNG si se cargó, o el builder procedural. */
export function getDecorSprite(name: DecorName): DecorSprite {
  const img = images.get(name);
  if (img) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    return {
      w,
      h,
      draw(ctx, x, y, flip = false) {
        const ix = Math.round(x);
        const iy = Math.round(y);
        if (!flip) {
          ctx.drawImage(img, ix, iy);
          return;
        }
        ctx.save();
        ctx.translate(ix + w, iy);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      },
    };
  }
  let buf = procedural.get(name);
  if (!buf) {
    buf = DECOR_CATALOG[name]();
    procedural.set(name, buf);
  }
  const b = buf;
  return { w: b.w, h: b.h, draw: (ctx, x, y, flip = false) => blit(ctx, b, x, y, flip) };
}
