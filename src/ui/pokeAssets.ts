/**
 * PokéBastion — PMDCollab asset URLs (PRD §1/§7.2, Block 3A.4).
 * Serves portraits locally from `/sprites/portrait` when available, with graceful
 * fallback to the remote PMDCollab SpriteCollab repository.
 */

export const REMOTE_PORTRAIT_BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait';
export const LOCAL_PORTRAIT_BASE = '/sprites/portrait';

export let SPRITE_BASE = REMOTE_PORTRAIT_BASE;
let useLocal = false;

// Probe local availability in browser environment (HEAD request for Starter 0004)
if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
  fetch(`${LOCAL_PORTRAIT_BASE}/0004/Normal.png`, { method: 'HEAD' })
    .then((res) => {
      if (res.ok) {
        useLocal = true;
        SPRITE_BASE = LOCAL_PORTRAIT_BASE;
      }
    })
    .catch(() => {
      useLocal = false;
      SPRITE_BASE = REMOTE_PORTRAIT_BASE;
    });
}

/** Explicitly configure whether local or remote portrait URLs are used. */
export function setUseLocalPortraits(enabled: boolean): void {
  useLocal = enabled;
  SPRITE_BASE = enabled ? LOCAL_PORTRAIT_BASE : REMOTE_PORTRAIT_BASE;
}

/** Retrato 40x40 pixel-art de la especie (id de 4 dígitos, p.ej. "0004"). */
export const portraitUrl = (id: string, emotion = 'Normal'): string => {
  const base = useLocal ? LOCAL_PORTRAIT_BASE : REMOTE_PORTRAIT_BASE;
  return `${base}/${id}/${emotion}.png`;
};

/**
 * Resilient image error handler for portrait <img> elements:
 * If a local portrait fails to load (or remote), automatically flips to the alternative.
 */
export function handlePortraitError(
  event: Event | { currentTarget: HTMLImageElement },
  id: string,
  emotion = 'Normal',
): void {
  const img = (event as any).currentTarget as HTMLImageElement;
  if (!img) return;
  const remote = `${REMOTE_PORTRAIT_BASE}/${id}/${emotion}.png`;
  const local = `${LOCAL_PORTRAIT_BASE}/${id}/${emotion}.png`;
  if (img.src.includes(LOCAL_PORTRAIT_BASE)) {
    img.src = remote;
  } else if (img.src.includes(REMOTE_PORTRAIT_BASE)) {
    img.src = local;
  }
}
