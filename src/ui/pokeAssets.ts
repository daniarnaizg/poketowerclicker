/**
 * PokéBastion — PMDCollab asset URLs (PRD §1/§7.2).
 * Hotlinks the SpriteCollab repo for portraits. Cuando exista `pnpm run sync:pokemon`,
 * cambia SPRITE_BASE por '/sprites' y sirve los PNG desde /public.
 */
const SPRITE_BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';

/** Retrato 40x40 pixel-art de la especie (id de 4 dígitos, p.ej. "0004"). */
export const portraitUrl = (id: string, emotion = 'Normal'): string =>
  `${SPRITE_BASE}/portrait/${id}/${emotion}.png`;
