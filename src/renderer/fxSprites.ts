/**
 * PokéBastion — runtime de sprites de efectos de combate (proyectiles e impactos).
 *
 * Carga y dibuja directamente desde las hojas de sprites maestras:
 *   - `public/fx/projectiles.png` (16×16 px × 4 frames por tipo)
 *   - `public/fx/impacts.png` (32×32 px × 6 frames por tipo)
 *
 * Si las imágenes aún no han cargado o se ejecuta en un entorno sin DOM (tests),
 * las llamadas a dibujo operan como un no-op seguro.
 */

import { FX_ATLAS } from './fxAtlas';
import type { TypeKey } from './fxAtlas';
import type { PokemonType } from '../core/types';

export const PROJ = 16;
export const PROJ_FRAMES = 4;
export const IMPACT = 32;
export const IMPACT_FRAMES = 6;

const PRELOAD_TIMEOUT_MS = 3000;
let projImg: HTMLImageElement | null = null;
let impactImg: HTMLImageElement | null = null;
let loading: Promise<void> | null = null;
let ready = typeof Image === 'undefined'; // En tests sin DOM, ready=true de inmediato

export function fxBaseUrl(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';
  return base.endsWith('/') ? base : `${base}/`;
}

export function toTypeKey(type: PokemonType | TypeKey | string): TypeKey {
  return (typeof type === 'string' ? type.toLowerCase() : 'normal') as TypeKey;
}

export function preloadFx(): Promise<void> {
  if (loading) return loading;
  if (typeof Image === 'undefined') {
    ready = true;
    loading = Promise.resolve();
    return loading;
  }

  const loadOne = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  loading = Promise.race([
    Promise.all([
      loadOne(`${fxBaseUrl()}fx/projectiles.png`),
      loadOne(`${fxBaseUrl()}fx/impacts.png`),
    ]),
    new Promise<[null, null]>((resolve) =>
      setTimeout(() => resolve([null, null]), PRELOAD_TIMEOUT_MS),
    ),
  ]).then(([p, i]) => {
    projImg = p;
    impactImg = i;
    ready = true;
  });

  return loading;
}

export function fxReady(): boolean {
  return ready;
}

export function __setFxImagesForTesting(
  proj: HTMLImageElement | null,
  impact: HTMLImageElement | null,
): void {
  projImg = proj;
  impactImg = impact;
}

/**
 * Dibuja un proyectil orientado según `angleRad`.
 * El proyectil base mide 16×16 px y apunta a +x (hacia la derecha).
 */
export function drawProjectile(
  ctx: CanvasRenderingContext2D,
  type: PokemonType | TypeKey,
  cx: number,
  cy: number,
  angleRad: number,
  nowMs: number,
): void {
  if (!projImg) return;
  const tKey = toTypeKey(type);
  const frame = Math.floor((nowMs / 80) % PROJ_FRAMES);

  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));
  ctx.rotate(angleRad);

  const meta = FX_ATLAS.projectiles.types[tKey] ?? FX_ATLAS.projectiles.types.normal;
  ctx.drawImage(
    projImg,
    frame * PROJ,
    meta.y,
    PROJ,
    PROJ,
    -PROJ / 2,
    -PROJ / 2,
    PROJ,
    PROJ,
  );

  ctx.restore();
}

/**
 * Dibuja un impacto centrado en (cx, cy) según su progreso (0..1).
 * La animación consta de 6 frames cuadrados de 32×32 px.
 */
export function drawImpact(
  ctx: CanvasRenderingContext2D,
  type: PokemonType | TypeKey,
  cx: number,
  cy: number,
  progress: number,
): void {
  if (!impactImg) return;
  const tKey = toTypeKey(type);
  const p = Math.max(0, Math.min(0.999, progress));
  const frame = Math.min(IMPACT_FRAMES - 1, Math.floor(p * IMPACT_FRAMES));

  const ox = Math.round(cx - IMPACT / 2);
  const oy = Math.round(cy - IMPACT / 2);

  const meta = FX_ATLAS.impacts.types[tKey] ?? FX_ATLAS.impacts.types.normal;
  ctx.drawImage(
    impactImg,
    frame * IMPACT,
    meta.y,
    IMPACT,
    IMPACT,
    ox,
    oy,
    IMPACT,
    IMPACT,
  );
}
