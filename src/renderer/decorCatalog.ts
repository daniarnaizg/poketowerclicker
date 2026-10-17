/**
 * PokéBastion — catálogo de sprites decorativos.
 *
 * Cada entrada es un nombre de fichero (`public/decor/<nombre>.png`) y el builder
 * procedural equivalente. En ejecución se usa el PNG si existe (así puedes editarlo
 * a mano) y, si no, el builder. `pnpm run export:decor` genera los PNG iniciales
 * a partir de estos builders.
 */

import * as Decor from './decor';
import type { PixelBuffer } from './pixelArt';

export const DECOR_CATALOG = {
  // --- Ruta Verde ---
  'ruta_verde/tree_a': () => Decor.buildTree(1),
  'ruta_verde/tree_b': () => Decor.buildTree(2),
  'ruta_verde/pine': () => Decor.buildPine(),
  'ruta_verde/bush_berries': () => Decor.buildBush(true, 1),
  'ruta_verde/bush_a': () => Decor.buildBush(false, 2),
  'ruta_verde/bush_b': () => Decor.buildBush(false, 3),
  'ruta_verde/flowers_a': () => Decor.buildFlowerPatch(1),
  'ruta_verde/flowers_b': () => Decor.buildFlowerPatch(2),
  'ruta_verde/rock': () => Decor.buildRock(1),
  'ruta_verde/sign': () => Decor.buildSign(),
  'ruta_verde/micro_grass_a': () => Decor.buildGrassTuft('#4a9a30', '#a4ec64', 0),
  'ruta_verde/micro_grass_b': () => Decor.buildGrassTuft('#4a9a30', '#a4ec64', 1),
  'ruta_verde/micro_flower_red': () => Decor.buildTinyFlower('#f05868'),
  'ruta_verde/micro_flower_white': () => Decor.buildTinyFlower('#ffffff'),
  'ruta_verde/micro_flower_yellow': () => Decor.buildTinyFlower('#f8d838'),
  'ruta_verde/micro_flower_blue': () => Decor.buildTinyFlower('#68a8f8'),
  'ruta_verde/micro_pebble': () => Decor.buildPebble('#6a6a64', '#9a9a90', '#c4c4b8'),

  // --- Cueva Umbría ---
  'cueva_umbria/crystals_a': () => Decor.buildCrystalCluster(1),
  'cueva_umbria/crystals_b': () => Decor.buildCrystalCluster(2),
  'cueva_umbria/stalagmite_tall_a': () => Decor.buildStalagmite(30, 1),
  'cueva_umbria/stalagmite_tall_b': () => Decor.buildStalagmite(30, 3),
  'cueva_umbria/stalagmite_short_a': () => Decor.buildStalagmite(22, 2),
  'cueva_umbria/stalagmite_short_b': () => Decor.buildStalagmite(22, 4),
  'cueva_umbria/boulder_a': () => Decor.buildCaveBoulder(1),
  'cueva_umbria/boulder_b': () => Decor.buildCaveBoulder(2),
  'cueva_umbria/glow_shroom': () => Decor.buildGlowShroom(),
  'cueva_umbria/micro_pebble': () => Decor.buildPebble('#14101e', '#2c2540', '#4a4068'),
  'cueva_umbria/micro_crack': () => Decor.buildCrack('#14101e'),
  'cueva_umbria/micro_shard': () => Decor.buildCrystalShard(),

  // --- Monte Ígneo ---
  'monte_igneo/lava_pool_a': () => Decor.buildLavaPool(1),
  'monte_igneo/lava_pool_b': () => Decor.buildLavaPool(2),
  'monte_igneo/lava_rock_a': () => Decor.buildLavaRock(1),
  'monte_igneo/lava_rock_b': () => Decor.buildLavaRock(2),
  'monte_igneo/lava_rock_c': () => Decor.buildLavaRock(3),
  'monte_igneo/lava_rock_d': () => Decor.buildLavaRock(4),
  'monte_igneo/dead_tree_a': () => Decor.buildDeadTree(1),
  'monte_igneo/dead_tree_b': () => Decor.buildDeadTree(2),
  'monte_igneo/micro_crack': () => Decor.buildCrack('#2d140e', '#f08030'),
  'monte_igneo/micro_ember': () => Decor.buildEmber(),
  'monte_igneo/micro_pebble': () => Decor.buildPebble('#1c0e0a', '#38201a', '#5a382c'),

  // --- Costa y Ruinas ---
  'costa_ruinas/column_broken_a': () => Decor.buildColumn(true, 1),
  'costa_ruinas/column_full': () => Decor.buildColumn(false, 2),
  'costa_ruinas/column_broken_b': () => Decor.buildColumn(true, 3),
  'costa_ruinas/tide_pool_a': () => Decor.buildTidePool(1),
  'costa_ruinas/tide_pool_b': () => Decor.buildTidePool(2),
  'costa_ruinas/palm': () => Decor.buildPalm(1),
  'costa_ruinas/starfish': () => Decor.buildStarfish(),
  'costa_ruinas/shell': () => Decor.buildShell(),
  'costa_ruinas/micro_ripple': () => Decor.buildSandRipple('#b8a870', '#f4e8c4'),
  'costa_ruinas/micro_pebble': () => Decor.buildPebble('#7a766c', '#a8a498', '#dcd8cc'),

  // --- Común ---
  'common/platform': () => Decor.buildPlatformSprite(48),
} as const satisfies Record<string, () => PixelBuffer>;

export type DecorName = keyof typeof DECOR_CATALOG;
