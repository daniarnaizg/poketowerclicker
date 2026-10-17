/**
 * PokéBastion — Phase 2 roster: every species obtainable from the Santuario
 * (PRD §3.1 rarity table), on top of the 3 starter lines in pokemon.ts.
 *
 * Lines are declared compactly and expanded to full PokemonDefinition entries
 * (PRD §7.1) by `defineLine`. Canonical evolution levels follow the original
 * games. Evolutions that are NOT level-based in the games (stone / trade /
 * friendship) use a NOMINAL level, marked `// nominal` below, because the PRD
 * drives every evolution from the unified Team Level. They are tunable here.
 *
 * Benchmarks (balance): final-form ATK ≈ 17-30 Common, 29-34 Rare, 44-47
 * Epic pseudo-legendaries (late scaling, weak when young), 38-48 Legendary
 * (no evolution, strong from level 1).
 */

import { AttackPattern, PokemonType } from '../core/types';
import type { PokemonDefinition } from '../core/types';
import { ULTIMATES } from './ultimates';

const T = PokemonType;
const P = AttackPattern;

type Types = [PokemonType] | [PokemonType, PokemonType];

interface Stage {
  id: string;
  name: string;
  types: Types;
  atk: number;
  spd: number;
  /** Canonical base HP override (defaults to BASE_HP_BY_ID lookup). */
  hp?: number;
  /** Generation of this specific species when it differs from the line's. */
  gen?: number;
  /** Pattern / ultimate overrides for this stage (e.g. final forms). */
  pattern?: AttackPattern;
  ult?: string;
}

/** Canonical base HP (PokeAPI) for species in the roster and potential additions. */
export const BASE_HP_BY_ID: Record<string, number> = {
  // Starters (Gen 1)
  '0001': 45, '0002': 60, '0003': 80,
  '0004': 39, '0005': 58, '0006': 78,
  '0007': 44, '0008': 59, '0009': 79,

  // Common (★)
  '0010': 45, '0011': 50, '0012': 60, // Caterpie, Metapod, Butterfree
  '0013': 40, '0014': 45, '0015': 65, // Weedle, Kakuna, Beedrill
  '0016': 40, '0017': 63, '0018': 83, // Pidgey, Pidgeotto, Pidgeot
  '0019': 30, '0020': 55,             // Rattata, Raticate
  '0025': 35, '0026': 60,             // Pikachu, Raichu
  '0041': 40, '0042': 75,             // Zubat, Golbat
  '0043': 45, '0044': 60, '0045': 75, // Oddish, Gloom, Vileplume
  '0052': 40, '0053': 65,             // Meowth, Persian
  '0054': 50, '0055': 80,             // Psyduck, Golduck
  '0058': 55, '0059': 90,             // Growlithe, Arcanine
  '0063': 25, '0064': 40, '0065': 55, // Abra, Kadabra, Alakazam
  '0066': 70, '0067': 80, '0068': 90, // Machop, Machoke, Machamp
  '0074': 40, '0075': 55, '0076': 80, // Geodude, Graveler, Golem
  '0077': 50, '0078': 65,             // Ponyta, Rapidash
  '0081': 25, '0082': 50,             // Magnemite, Magneton
  '0092': 30, '0093': 45, '0094': 60, // Gastly, Haunter, Gengar
  '0095': 35,                         // Onix
  '0111': 80, '0112': 105,            // Rhyhorn, Rhydon
  '0116': 30, '0117': 55,             // Horsea, Seadra
  '0120': 30, '0121': 60,             // Staryu, Starmie
  '0123': 70,                         // Scyther
  '0125': 65,                         // Electabuzz
  '0126': 65,                         // Magmar
  '0127': 65,                         // Pinsir
  '0129': 20, '0130': 95,             // Magikarp, Gyarados
  '0133': 55,                         // Eevee
  '0134': 130, '0135': 65, '0136': 65,// Vaporeon, Jolteon, Flareon
  '0137': 65,                         // Porygon

  // Rare (★★) & Starters Gen 2-3
  '0152': 45, '0153': 60, '0154': 80, // Chikorita, Bayleef, Meganium
  '0155': 39, '0156': 58, '0157': 78, // Cyndaquil, Quilava, Typhlosion
  '0158': 50, '0159': 65, '0160': 85, // Totodile, Croconaw, Feraligatr
  '0179': 55, '0180': 70, '0181': 90, // Mareep, Flaaffy, Ampharos
  '0183': 70, '0184': 100,            // Marill, Azumarill
  '0228': 45, '0229': 75,             // Houndour, Houndoom
  '0240': 45,                         // Magby
  '0252': 40, '0253': 50, '0254': 70, // Treecko, Grovyle, Sceptile
  '0255': 45, '0256': 60, '0257': 80, // Torchic, Combusken, Blaziken
  '0258': 50, '0259': 70, '0260': 100,// Mudkip, Marshtomp, Swampert
  '0280': 28, '0281': 38, '0282': 68, // Ralts, Kirlia, Gardevoir
  '0304': 50, '0305': 60, '0306': 70, // Aron, Lairon, Aggron
  '0328': 45, '0329': 50, '0330': 80, // Trapinch, Vibrava, Flygon
  '0447': 40, '0448': 70,             // Riolu, Lucario
  '0467': 75,                         // Magmortar

  // Epic (★★★)
  '0131': 130,                        // Lapras
  '0143': 160,                        // Snorlax
  '0147': 41, '0148': 61, '0149': 91, // Dratini, Dragonair, Dragonite
  '0246': 50, '0247': 70, '0248': 100,// Larvitar, Pupitar, Tyranitar
  '0374': 40, '0375': 60, '0376': 80, // Beldum, Metang, Metagross

  // Legendary (★★★★)
  '0144': 90,                         // Articuno
  '0145': 90,                         // Zapdos
  '0146': 90,                         // Moltres
  '0150': 106,                        // Mewtwo
};

interface Line {
  gen: number;
  pattern: AttackPattern;
  /** Default ultimate id (see data/ultimates.ts). */
  ult: string;
  /** [stat key, value at the FINAL stage]; earlier stages scale 50% → 100%. */
  passive: [string, number];
  /** Canonical Team Level of each evolution step (length = stages - 1). */
  evoLevels: number[];
  stages: Stage[];
  /** Ultimate cooldown override (s); by default STAGE_COOLDOWNS[index] applies. */
  cooldown?: number;
  /** Base crit chance of the first stage (+1% per later stage). */
  crit?: number;
}

const round = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;

/** Ultimate cooldown (s) per evolution stage; single-stage species recharge at 26 s. */
const STAGE_COOLDOWNS = [30, 26, 22];
const SINGLE_STAGE_COOLDOWN = 26;

function defineLine(line: Line): PokemonDefinition[] {
  const n = line.stages.length;
  return line.stages.map((st, i): PokemonDefinition => {
    const ultId = st.ult ?? line.ult;
    const ult = ULTIMATES[ultId];
    if (!ult) throw new Error(`roster: unknown ultimate "${ultId}" for ${st.name}`);
    const ratio = n === 1 ? 1 : 0.5 + (0.5 * i) / (n - 1);
    const hp = st.hp ?? BASE_HP_BY_ID[st.id] ?? ([50, 70, 95][i] ?? 70);
    return {
      id: st.id,
      name: st.name,
      generation: st.gen ?? line.gen,
      types: st.types,
      baseStats: {
        hp,
        atk: st.atk,
        spd: st.spd,
        critRate: round((line.crit ?? 0.05) + 0.01 * i, 2),
        critDmg: round(1.5 + 0.05 * i, 2),
      },
      pattern: st.pattern ?? line.pattern,
      evolution: i < n - 1 ? { targetId: line.stages[i + 1].id, canonicalLevel: line.evoLevels[i] } : undefined,
      ultimate: {
        id: ultId,
        name: ult.name,
        cooldownSec: line.cooldown ?? (n === 1 ? SINGLE_STAGE_COOLDOWN : STAGE_COOLDOWNS[i] ?? 26),
      },
      benchPassive: { stat: line.passive[0], value: round(line.passive[1] * ratio, 3) },
    };
  });
}

const LINES: Line[] = [
  // ======================= COMMON (★) =======================
  { // Caterpie 7 / 10
    gen: 1, pattern: P.SNIPER, ult: 'bug_buzz', passive: ['BUG_DAMAGE', 0.12], evoLevels: [7, 10],
    stages: [
      { id: '0010', name: 'Caterpie', types: [T.Bug], atk: 6, spd: 1.1 },
      { id: '0011', name: 'Metapod', types: [T.Bug], atk: 8, spd: 0.9 },
      { id: '0012', name: 'Butterfree', types: [T.Bug, T.Flying], atk: 17, spd: 1.1, pattern: P.AOE },
    ],
  },
  { // Pidgey 18 / 36
    gen: 1, pattern: P.SNIPER, ult: 'air_slash', passive: ['ATTACK_SPEED', 0.1], evoLevels: [18, 36],
    stages: [
      { id: '0016', name: 'Pidgey', types: [T.Normal, T.Flying], atk: 8, spd: 1.2 },
      { id: '0017', name: 'Pidgeotto', types: [T.Normal, T.Flying], atk: 14, spd: 1.25 },
      { id: '0018', name: 'Pidgeot', types: [T.Normal, T.Flying], atk: 25, spd: 1.3 },
    ],
  },
  { // Rattata 20
    gen: 1, pattern: P.SNIPER, ult: 'hyper_beam', passive: ['GOLD', 0.1], evoLevels: [20],
    stages: [
      { id: '0019', name: 'Rattata', types: [T.Normal], atk: 8, spd: 1.3 },
      { id: '0020', name: 'Raticate', types: [T.Normal], atk: 19, spd: 1.4 },
    ],
  },
  { // Pikachu -> Raichu (Thunder Stone in the games)
    gen: 1, pattern: P.CHAIN, ult: 'thunderbolt', passive: ['ELECTRIC_DAMAGE', 0.12],
    evoLevels: [22], // nominal
    stages: [
      { id: '0025', name: 'Pikachu', types: [T.Electric], atk: 9, spd: 1.5 },
      { id: '0026', name: 'Raichu', types: [T.Electric], atk: 23, spd: 1.6 },
    ],
  },
  { // Gastly 25 / Haunter -> Gengar (trade in the games)
    gen: 1, pattern: P.PULSE, ult: 'shadow_ball', passive: ['GHOST_DAMAGE', 0.12],
    evoLevels: [25, 40], // 25 canonical, 40 nominal
    stages: [
      { id: '0092', name: 'Gastly', types: [T.Ghost, T.Poison], atk: 9, spd: 1.0 },
      { id: '0093', name: 'Haunter', types: [T.Ghost, T.Poison], atk: 16, spd: 1.0 },
      { id: '0094', name: 'Gengar', types: [T.Ghost, T.Poison], atk: 29, spd: 0.95, pattern: P.AOE },
    ],
  },

  // ======================= RARE (★★) =======================
  { // Riolu -> Lucario (friendship in the games)
    gen: 4, pattern: P.PULSE, ult: 'aura_sphere', passive: ['FIGHTING_DAMAGE', 0.16],
    evoLevels: [30], // nominal
    stages: [
      { id: '0447', name: 'Riolu', types: [T.Fighting], atk: 11, spd: 1.1 },
      { id: '0448', name: 'Lucario', types: [T.Fighting, T.Steel], atk: 31, spd: 1.2 },
    ],
  },
  { // Ralts 20 / 30
    gen: 3, pattern: P.PULSE, ult: 'psychic', passive: ['PSYCHIC_DAMAGE', 0.16], evoLevels: [20, 30],
    stages: [
      { id: '0280', name: 'Ralts', types: [T.Psychic, T.Fairy], atk: 8, spd: 1.0 },
      { id: '0281', name: 'Kirlia', types: [T.Psychic, T.Fairy], atk: 15, spd: 1.0 },
      { id: '0282', name: 'Gardevoir', types: [T.Psychic, T.Fairy], atk: 31, spd: 0.95, pattern: P.AOE },
    ],
  },
  { // Trapinch 35 / 45
    gen: 3, pattern: P.AOE, ult: 'earthquake', passive: ['GROUND_DAMAGE', 0.16], evoLevels: [35, 45],
    stages: [
      { id: '0328', name: 'Trapinch', types: [T.Ground], atk: 10, spd: 0.9 },
      { id: '0329', name: 'Vibrava', types: [T.Ground, T.Dragon], atk: 18, spd: 1.0 },
      { id: '0330', name: 'Flygon', types: [T.Ground, T.Dragon], atk: 33, spd: 1.0, ult: 'dragon_pulse' },
    ],
  },
  { // Magby 30 / Magmar -> Magmortar (trade in the games)
    gen: 2, pattern: P.SNIPER, ult: 'flamethrower', passive: ['FIRE_DAMAGE', 0.16],
    evoLevels: [30, 45], // 30 canonical, 45 nominal
    stages: [
      { id: '0240', name: 'Magby', types: [T.Fire], atk: 11, spd: 1.0 },
      { id: '0126', name: 'Magmar', types: [T.Fire], atk: 22, spd: 1.0, gen: 1 },
      { id: '0467', name: 'Magmortar', types: [T.Fire], atk: 34, spd: 0.9, gen: 4, pattern: P.AOE, ult: 'fire_blast' },
    ],
  },
  { // Aron 32 / 42
    gen: 3, pattern: P.PULSE, ult: 'flash_cannon', passive: ['STEEL_DAMAGE', 0.16], evoLevels: [32, 42],
    stages: [
      { id: '0304', name: 'Aron', types: [T.Steel, T.Rock], atk: 10, spd: 0.8 },
      { id: '0305', name: 'Lairon', types: [T.Steel, T.Rock], atk: 19, spd: 0.85 },
      { id: '0306', name: 'Aggron', types: [T.Steel, T.Rock], atk: 34, spd: 0.8 },
    ],
  },
  { // Chikorita 16 / 32
    gen: 2, pattern: P.PULSE, ult: 'vine_whip', passive: ['GRASS_DAMAGE', 0.16], evoLevels: [16, 32],
    stages: [
      { id: '0152', name: 'Chikorita', types: [T.Grass], atk: 10, spd: 0.9 },
      { id: '0153', name: 'Bayleef', types: [T.Grass], atk: 17, spd: 0.9 },
      { id: '0154', name: 'Meganium', types: [T.Grass], atk: 29, spd: 0.85, pattern: P.AOE, ult: 'solar_beam' },
    ],
  },
  { // Cyndaquil 14 / 36
    gen: 2, pattern: P.SNIPER, ult: 'flamethrower', passive: ['CRIT_RATE', 0.08], evoLevels: [14, 36],
    stages: [
      { id: '0155', name: 'Cyndaquil', types: [T.Fire], atk: 11, spd: 1.1 },
      { id: '0156', name: 'Quilava', types: [T.Fire], atk: 19, spd: 1.1 },
      { id: '0157', name: 'Typhlosion', types: [T.Fire], atk: 32, spd: 1.0, pattern: P.AOE, ult: 'fire_blast' },
    ],
  },
  { // Totodile 18 / 30
    gen: 2, pattern: P.SNIPER, ult: 'water_gun', passive: ['CLICK_DAMAGE', 0.2], evoLevels: [18, 30],
    stages: [
      { id: '0158', name: 'Totodile', types: [T.Water], atk: 11, spd: 1.0 },
      { id: '0159', name: 'Croconaw', types: [T.Water], atk: 18, spd: 1.0 },
      { id: '0160', name: 'Feraligatr', types: [T.Water], atk: 31, spd: 0.9, pattern: P.AOE, ult: 'hydro_pump' },
    ],
  },
  { // Treecko 16 / 36
    gen: 3, pattern: P.CHAIN, ult: 'solar_beam', passive: ['ATTACK_SPEED', 0.1], evoLevels: [16, 36],
    stages: [
      { id: '0252', name: 'Treecko', types: [T.Grass], atk: 10, spd: 1.2 },
      { id: '0253', name: 'Grovyle', types: [T.Grass], atk: 19, spd: 1.3 },
      { id: '0254', name: 'Sceptile', types: [T.Grass], atk: 30, spd: 1.3 },
    ],
  },
  { // Torchic 16 / 36
    gen: 3, pattern: P.SNIPER, ult: 'flamethrower', passive: ['ULT_CHARGE', 0.2], evoLevels: [16, 36],
    stages: [
      { id: '0255', name: 'Torchic', types: [T.Fire], atk: 10, spd: 1.0 },
      { id: '0256', name: 'Combusken', types: [T.Fire, T.Fighting], atk: 20, spd: 1.1 },
      { id: '0257', name: 'Blaziken', types: [T.Fire, T.Fighting], atk: 33, spd: 1.1, ult: 'fire_blast' },
    ],
  },
  { // Mudkip 16 / 36
    gen: 3, pattern: P.PULSE, ult: 'water_gun', passive: ['MAX_HP', 0.12], evoLevels: [16, 36],
    stages: [
      { id: '0258', name: 'Mudkip', types: [T.Water], atk: 10, spd: 1.0 },
      { id: '0259', name: 'Marshtomp', types: [T.Water, T.Ground], atk: 18, spd: 1.0 },
      { id: '0260', name: 'Swampert', types: [T.Water, T.Ground], atk: 31, spd: 0.9, pattern: P.AOE, ult: 'hydro_pump' },
    ],
  },

  // ======================= EPIC (★★★) =======================
  { // Dratini 30 / 55
    gen: 1, pattern: P.SNIPER, ult: 'dragon_pulse', passive: ['ALL_DAMAGE', 0.1], evoLevels: [30, 55],
    stages: [
      { id: '0147', name: 'Dratini', types: [T.Dragon], atk: 9, spd: 1.0 },
      { id: '0148', name: 'Dragonair', types: [T.Dragon], atk: 18, spd: 1.0 },
      { id: '0149', name: 'Dragonite', types: [T.Dragon, T.Flying], atk: 46, spd: 0.95, pattern: P.AOE, ult: 'draco_meteor' },
    ],
  },
  { // Larvitar 30 / 55
    gen: 2, pattern: P.PULSE, ult: 'rock_slide', passive: ['CRIT_RATE', 0.1], evoLevels: [30, 55],
    stages: [
      { id: '0246', name: 'Larvitar', types: [T.Rock, T.Ground], atk: 9, spd: 0.9 },
      { id: '0247', name: 'Pupitar', types: [T.Rock, T.Ground], atk: 17, spd: 0.9 },
      { id: '0248', name: 'Tyranitar', types: [T.Rock, T.Dark], atk: 47, spd: 0.85, pattern: P.AOE, ult: 'dark_pulse' },
    ],
  },
  { // Beldum 20 / 45
    gen: 3, pattern: P.SNIPER, ult: 'flash_cannon', passive: ['ATTACK_SPEED', 0.15], evoLevels: [20, 45],
    stages: [
      { id: '0374', name: 'Beldum', types: [T.Steel, T.Psychic], atk: 8, spd: 0.9 },
      { id: '0375', name: 'Metang', types: [T.Steel, T.Psychic], atk: 19, spd: 1.0 },
      { id: '0376', name: 'Metagross', types: [T.Steel, T.Psychic], atk: 44, spd: 1.0, pattern: P.AOE, ult: 'psychic' },
    ],
  },
  { // Lapras (no evolution)
    gen: 1, pattern: P.AOE, ult: 'blizzard', passive: ['ULT_CHARGE', 0.25], evoLevels: [],
    stages: [{ id: '0131', name: 'Lapras', types: [T.Water, T.Ice], atk: 27, spd: 0.9 }],
  },
  { // Snorlax (no evolution): slow cadence, massive damage
    gen: 1, pattern: P.PULSE, ult: 'hyper_beam', passive: ['MAX_HP', 0.20], evoLevels: [],
    stages: [{ id: '0143', name: 'Snorlax', types: [T.Normal], atk: 38, spd: 0.5 }],
  },

  // ======================= LEGENDARY (★★★★) =======================
  {
    gen: 1, pattern: P.SNIPER, ult: 'blizzard', passive: ['ICE_DAMAGE', 0.24], evoLevels: [], crit: 0.08,
    stages: [{ id: '0144', name: 'Articuno', types: [T.Ice, T.Flying], atk: 40, spd: 1.0 }],
  },
  {
    gen: 1, pattern: P.CHAIN, ult: 'thunder', passive: ['ELECTRIC_DAMAGE', 0.24], evoLevels: [], crit: 0.08,
    stages: [{ id: '0145', name: 'Zapdos', types: [T.Electric, T.Flying], atk: 42, spd: 1.2 }],
  },
  {
    gen: 1, pattern: P.AOE, ult: 'fire_blast', passive: ['FIRE_DAMAGE', 0.24], evoLevels: [], crit: 0.08,
    stages: [{ id: '0146', name: 'Moltres', types: [T.Fire, T.Flying], atk: 44, spd: 1.0 }],
  },
  {
    gen: 1, pattern: P.SNIPER, ult: 'psystrike', passive: ['ALL_DAMAGE', 0.15], evoLevels: [], crit: 0.1,
    stages: [{ id: '0150', name: 'Mewtwo', types: [T.Psychic], atk: 48, spd: 1.1 }],
  },
];

/** All Phase 2 species, keyed by id. Merged into POKEDEX by data/pokemon.ts. */
export const ROSTER: Readonly<Record<string, PokemonDefinition>> = Object.freeze(
  Object.fromEntries(LINES.flatMap(defineLine).map((d) => [d.id, d])),
);

export const ROSTER_DEFINITIONS = ROSTER;
