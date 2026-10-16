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
  /** Generation of this specific species when it differs from the line's. */
  gen?: number;
  /** Pattern / ultimate overrides for this stage (e.g. final forms). */
  pattern?: AttackPattern;
  ult?: string;
}

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
  /** Ultimate energy cost; legendaries need more. */
  energy?: number;
  /** Base crit chance of the first stage (+1% per later stage). */
  crit?: number;
}

const round = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;

function defineLine(line: Line): PokemonDefinition[] {
  const n = line.stages.length;
  return line.stages.map((st, i): PokemonDefinition => {
    const ultId = st.ult ?? line.ult;
    const ult = ULTIMATES[ultId];
    if (!ult) throw new Error(`roster: unknown ultimate "${ultId}" for ${st.name}`);
    const ratio = n === 1 ? 1 : 0.5 + (0.5 * i) / (n - 1);
    return {
      id: st.id,
      name: st.name,
      generation: st.gen ?? line.gen,
      types: st.types,
      baseStats: {
        atk: st.atk,
        spd: st.spd,
        critRate: round((line.crit ?? 0.05) + 0.01 * i, 2),
        critDmg: round(1.5 + 0.05 * i, 2),
      },
      pattern: st.pattern ?? line.pattern,
      evolution: i < n - 1 ? { targetId: line.stages[i + 1].id, canonicalLevel: line.evoLevels[i] } : undefined,
      ultimate: { id: ultId, name: ult.name, energyCost: line.energy ?? 100 },
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
    gen: 3, pattern: P.PULSE, ult: 'water_gun', passive: ['BASTION_REGEN', 0.01], evoLevels: [16, 36],
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
    gen: 1, pattern: P.PULSE, ult: 'hyper_beam', passive: ['BASTION_REGEN', 0.02], evoLevels: [],
    stages: [{ id: '0143', name: 'Snorlax', types: [T.Normal], atk: 38, spd: 0.5 }],
  },

  // ======================= LEGENDARY (★★★★) =======================
  {
    gen: 1, pattern: P.SNIPER, ult: 'blizzard', passive: ['ICE_DAMAGE', 0.24], evoLevels: [], energy: 150, crit: 0.08,
    stages: [{ id: '0144', name: 'Articuno', types: [T.Ice, T.Flying], atk: 40, spd: 1.0 }],
  },
  {
    gen: 1, pattern: P.CHAIN, ult: 'thunder', passive: ['ELECTRIC_DAMAGE', 0.24], evoLevels: [], energy: 150, crit: 0.08,
    stages: [{ id: '0145', name: 'Zapdos', types: [T.Electric, T.Flying], atk: 42, spd: 1.2 }],
  },
  {
    gen: 1, pattern: P.AOE, ult: 'fire_blast', passive: ['FIRE_DAMAGE', 0.24], evoLevels: [], energy: 150, crit: 0.08,
    stages: [{ id: '0146', name: 'Moltres', types: [T.Fire, T.Flying], atk: 44, spd: 1.0 }],
  },
  {
    gen: 1, pattern: P.SNIPER, ult: 'psystrike', passive: ['ALL_DAMAGE', 0.15], evoLevels: [], energy: 150, crit: 0.1,
    stages: [{ id: '0150', name: 'Mewtwo', types: [T.Psychic], atk: 48, spd: 1.1 }],
  },
];

/** All Phase 2 species, keyed by id. Merged into POKEDEX by data/pokemon.ts. */
export const ROSTER: Readonly<Record<string, PokemonDefinition>> = Object.freeze(
  Object.fromEntries(LINES.flatMap(defineLine).map((d) => [d.id, d])),
);
