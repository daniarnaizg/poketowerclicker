/**
 * PokéBastion — Atlas de sprites decorativos por bioma.
 * Define la posición (x, y) y dimensiones (w, h) de cada sprite dentro de su spritesheet.
 * Cada bioma tiene su propia hoja PNG en `public/decor/<sheet>.png`.
 */

export type DecorSheetName = 'ruta_verde' | 'cueva_umbria' | 'monte_igneo' | 'costa_ruinas' | 'common';

export interface DecorFrame {
  sheet: DecorSheetName;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SheetInfo {
  w: number;
  h: number;
  file: string;
}

export const DECOR_ATLAS = {
  "sheets": {
    "ruta_verde": {
      "w": 138,
      "h": 96,
      "file": "ruta_verde.png"
    },
    "cueva_umbria": {
      "w": 136,
      "h": 87,
      "file": "cueva_umbria.png"
    },
    "monte_igneo": {
      "w": 216,
      "h": 83,
      "file": "monte_igneo.png"
    },
    "costa_ruinas": {
      "w": 150,
      "h": 107,
      "file": "costa_ruinas.png"
    },
    "common": {
      "w": 106,
      "h": 106,
      "file": "common.png"
    }
  },
  "frames": {
    "ruta_verde/tree_a": {
      "sheet": "ruta_verde",
      "x": 4,
      "y": 4,
      "w": 38,
      "h": 48
    },
    "ruta_verde/tree_b": {
      "sheet": "ruta_verde",
      "x": 46,
      "y": 4,
      "w": 38,
      "h": 48
    },
    "ruta_verde/pine": {
      "sheet": "ruta_verde",
      "x": 88,
      "y": 4,
      "w": 30,
      "h": 46
    },
    "ruta_verde/bush_a": {
      "sheet": "ruta_verde",
      "x": 4,
      "y": 56,
      "w": 26,
      "h": 20
    },
    "ruta_verde/bush_b": {
      "sheet": "ruta_verde",
      "x": 34,
      "y": 56,
      "w": 26,
      "h": 20
    },
    "ruta_verde/bush_berries": {
      "sheet": "ruta_verde",
      "x": 64,
      "y": 56,
      "w": 26,
      "h": 20
    },
    "ruta_verde/sign": {
      "sheet": "ruta_verde",
      "x": 94,
      "y": 56,
      "w": 16,
      "h": 20
    },
    "ruta_verde/rock": {
      "sheet": "ruta_verde",
      "x": 114,
      "y": 56,
      "w": 20,
      "h": 15
    },
    "ruta_verde/flowers_a": {
      "sheet": "ruta_verde",
      "x": 4,
      "y": 80,
      "w": 18,
      "h": 12
    },
    "ruta_verde/flowers_b": {
      "sheet": "ruta_verde",
      "x": 26,
      "y": 80,
      "w": 18,
      "h": 12
    },
    "ruta_verde/micro_grass_a": {
      "sheet": "ruta_verde",
      "x": 48,
      "y": 80,
      "w": 7,
      "h": 6
    },
    "ruta_verde/micro_grass_b": {
      "sheet": "ruta_verde",
      "x": 59,
      "y": 80,
      "w": 7,
      "h": 6
    },
    "ruta_verde/micro_flower_red": {
      "sheet": "ruta_verde",
      "x": 70,
      "y": 80,
      "w": 5,
      "h": 6
    },
    "ruta_verde/micro_flower_white": {
      "sheet": "ruta_verde",
      "x": 79,
      "y": 80,
      "w": 5,
      "h": 6
    },
    "ruta_verde/micro_flower_yellow": {
      "sheet": "ruta_verde",
      "x": 88,
      "y": 80,
      "w": 5,
      "h": 6
    },
    "ruta_verde/micro_flower_blue": {
      "sheet": "ruta_verde",
      "x": 97,
      "y": 80,
      "w": 5,
      "h": 6
    },
    "ruta_verde/micro_pebble": {
      "sheet": "ruta_verde",
      "x": 106,
      "y": 80,
      "w": 6,
      "h": 4
    },
    "cueva_umbria/crystals_a": {
      "sheet": "cueva_umbria",
      "x": 4,
      "y": 4,
      "w": 38,
      "h": 38
    },
    "cueva_umbria/crystals_b": {
      "sheet": "cueva_umbria",
      "x": 46,
      "y": 4,
      "w": 38,
      "h": 38
    },
    "cueva_umbria/stalagmite_tall_a": {
      "sheet": "cueva_umbria",
      "x": 88,
      "y": 4,
      "w": 20,
      "h": 34
    },
    "cueva_umbria/stalagmite_tall_b": {
      "sheet": "cueva_umbria",
      "x": 112,
      "y": 4,
      "w": 20,
      "h": 34
    },
    "cueva_umbria/stalagmite_short_a": {
      "sheet": "cueva_umbria",
      "x": 4,
      "y": 46,
      "w": 20,
      "h": 26
    },
    "cueva_umbria/stalagmite_short_b": {
      "sheet": "cueva_umbria",
      "x": 28,
      "y": 46,
      "w": 20,
      "h": 26
    },
    "cueva_umbria/boulder_a": {
      "sheet": "cueva_umbria",
      "x": 52,
      "y": 46,
      "w": 22,
      "h": 16
    },
    "cueva_umbria/boulder_b": {
      "sheet": "cueva_umbria",
      "x": 78,
      "y": 46,
      "w": 22,
      "h": 16
    },
    "cueva_umbria/glow_shroom": {
      "sheet": "cueva_umbria",
      "x": 104,
      "y": 46,
      "w": 16,
      "h": 16
    },
    "cueva_umbria/micro_shard": {
      "sheet": "cueva_umbria",
      "x": 4,
      "y": 76,
      "w": 5,
      "h": 7
    },
    "cueva_umbria/micro_crack": {
      "sheet": "cueva_umbria",
      "x": 13,
      "y": 76,
      "w": 10,
      "h": 5
    },
    "cueva_umbria/micro_pebble": {
      "sheet": "cueva_umbria",
      "x": 27,
      "y": 76,
      "w": 6,
      "h": 4
    },
    "monte_igneo/lava_pool_a": {
      "sheet": "monte_igneo",
      "x": 4,
      "y": 4,
      "w": 68,
      "h": 46
    },
    "monte_igneo/lava_pool_b": {
      "sheet": "monte_igneo",
      "x": 76,
      "y": 4,
      "w": 68,
      "h": 46
    },
    "monte_igneo/dead_tree_a": {
      "sheet": "monte_igneo",
      "x": 148,
      "y": 4,
      "w": 30,
      "h": 40
    },
    "monte_igneo/dead_tree_b": {
      "sheet": "monte_igneo",
      "x": 182,
      "y": 4,
      "w": 30,
      "h": 40
    },
    "monte_igneo/lava_rock_a": {
      "sheet": "monte_igneo",
      "x": 4,
      "y": 54,
      "w": 22,
      "h": 16
    },
    "monte_igneo/lava_rock_b": {
      "sheet": "monte_igneo",
      "x": 30,
      "y": 54,
      "w": 22,
      "h": 16
    },
    "monte_igneo/lava_rock_c": {
      "sheet": "monte_igneo",
      "x": 56,
      "y": 54,
      "w": 22,
      "h": 16
    },
    "monte_igneo/lava_rock_d": {
      "sheet": "monte_igneo",
      "x": 82,
      "y": 54,
      "w": 22,
      "h": 16
    },
    "monte_igneo/micro_crack": {
      "sheet": "monte_igneo",
      "x": 4,
      "y": 74,
      "w": 10,
      "h": 5
    },
    "monte_igneo/micro_pebble": {
      "sheet": "monte_igneo",
      "x": 18,
      "y": 74,
      "w": 6,
      "h": 4
    },
    "monte_igneo/micro_ember": {
      "sheet": "monte_igneo",
      "x": 28,
      "y": 74,
      "w": 4,
      "h": 4
    },
    "costa_ruinas/palm": {
      "sheet": "costa_ruinas",
      "x": 4,
      "y": 4,
      "w": 58,
      "h": 54
    },
    "costa_ruinas/column_full": {
      "sheet": "costa_ruinas",
      "x": 66,
      "y": 4,
      "w": 24,
      "h": 46
    },
    "costa_ruinas/column_broken_a": {
      "sheet": "costa_ruinas",
      "x": 94,
      "y": 4,
      "w": 24,
      "h": 46
    },
    "costa_ruinas/column_broken_b": {
      "sheet": "costa_ruinas",
      "x": 122,
      "y": 4,
      "w": 24,
      "h": 46
    },
    "costa_ruinas/tide_pool_a": {
      "sheet": "costa_ruinas",
      "x": 4,
      "y": 62,
      "w": 42,
      "h": 26
    },
    "costa_ruinas/tide_pool_b": {
      "sheet": "costa_ruinas",
      "x": 50,
      "y": 62,
      "w": 42,
      "h": 26
    },
    "costa_ruinas/starfish": {
      "sheet": "costa_ruinas",
      "x": 4,
      "y": 92,
      "w": 11,
      "h": 11
    },
    "costa_ruinas/shell": {
      "sheet": "costa_ruinas",
      "x": 19,
      "y": 92,
      "w": 10,
      "h": 8
    },
    "costa_ruinas/micro_ripple": {
      "sheet": "costa_ruinas",
      "x": 33,
      "y": 92,
      "w": 10,
      "h": 4
    },
    "costa_ruinas/micro_pebble": {
      "sheet": "costa_ruinas",
      "x": 47,
      "y": 92,
      "w": 6,
      "h": 4
    },
    "common/platform": {
      "sheet": "common",
      "x": 4,
      "y": 4,
      "w": 98,
      "h": 98
    }
  }
} as const;

export type DecorName = keyof typeof DECOR_ATLAS['frames'];

export interface DecorAtlas {
  sheets: Record<DecorSheetName, SheetInfo>;
  frames: Record<DecorName, DecorFrame>;
}
