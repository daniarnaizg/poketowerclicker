/**
 * PokéBastion — elemental type chart & damage calculation.
 * PURE TYPESCRIPT: no DOM / browser imports. Deterministic: all randomness
 * is injected via the `rng` parameter (a () => number returning [0,1)).
 */

import { PokemonType } from './types';
import type {
  BastionUpgrades,
  DamageEvent,
  TypeChart,
} from './types';
import {
  BALANCE,
  LEVEL_STAT_SCALE,
  CRIT_CHANCE_PER_UP_CRIT,
  CRIT_CHANCE_CAP,
  ARROW_DAMAGE_PER_LEVEL,
  critMultiplier,
} from '../config/balance.config';

type EffectivenessMap = Partial<Record<PokemonType, number>>;

/**
 * Sparse matchups (attacker row -> defender overrides).
 * Anything absent is neutral (1.0). Values follow PRD §3.2:
 * super effective 1.5, not very effective 0.65, immune 0.
 * Keys use the PokemonType enum string values.
 */
const SPARSE_CHART: Record<string, EffectivenessMap> = {
  NORMAL:   { ROCK: 0.65, GHOST: 0, STEEL: 0.65 },
  FIRE:     { FIRE: 0.65, WATER: 0.65, GRASS: 1.5, ICE: 1.5, BUG: 1.5, ROCK: 0.65, DRAGON: 0.65, STEEL: 1.5 },
  WATER:    { FIRE: 1.5, WATER: 0.65, GRASS: 0.65, GROUND: 1.5, ROCK: 1.5, DRAGON: 0.65 },
  GRASS:    { FIRE: 0.65, WATER: 1.5, GRASS: 0.65, POISON: 0.65, GROUND: 1.5, FLYING: 0.65, BUG: 0.65, ROCK: 1.5, DRAGON: 0.65, STEEL: 0.65 },
  ELECTRIC: { WATER: 1.5, ELECTRIC: 0.65, GRASS: 0.65, GROUND: 0, FLYING: 1.5, DRAGON: 0.65 },
  ICE:      { FIRE: 0.65, WATER: 0.65, GRASS: 1.5, ICE: 0.65, GROUND: 1.5, FLYING: 1.5, DRAGON: 1.5, STEEL: 0.65 },
  FIGHTING: { NORMAL: 1.5, ICE: 1.5, POISON: 0.65, FLYING: 0.65, PSYCHIC: 0.65, BUG: 0.65, ROCK: 1.5, GHOST: 0, DARK: 1.5, STEEL: 1.5, FAIRY: 0.65 },
  POISON:   { GRASS: 1.5, POISON: 0.65, GROUND: 0.65, ROCK: 0.65, GHOST: 0.65, STEEL: 0, FAIRY: 1.5 },
  GROUND:   { FIRE: 1.5, ELECTRIC: 1.5, GRASS: 0.65, POISON: 1.5, FLYING: 0, BUG: 0.65, ROCK: 1.5, STEEL: 1.5 },
  FLYING:   { ELECTRIC: 0.65, GRASS: 1.5, FIGHTING: 1.5, BUG: 1.5, ROCK: 0.65, STEEL: 0.65 },
  PSYCHIC:  { FIGHTING: 1.5, POISON: 1.5, PSYCHIC: 0.65, DARK: 0, STEEL: 0.65 },
  BUG:      { FIRE: 0.65, GRASS: 1.5, FIGHTING: 0.65, POISON: 0.65, FLYING: 0.65, PSYCHIC: 1.5, GHOST: 0.65, DARK: 1.5, STEEL: 0.65, FAIRY: 0.65 },
  ROCK:     { FIRE: 1.5, ICE: 1.5, FIGHTING: 0.65, GROUND: 0.65, FLYING: 1.5, BUG: 1.5, STEEL: 0.65 },
  GHOST:    { NORMAL: 0, PSYCHIC: 1.5, GHOST: 1.5, DARK: 0.65 },
  DRAGON:   { DRAGON: 1.5, STEEL: 0.65, FAIRY: 0 },
  DARK:     { FIGHTING: 0.65, PSYCHIC: 1.5, GHOST: 1.5, DARK: 0.65, FAIRY: 0.65 },
  STEEL:    { FIRE: 0.65, WATER: 0.65, ELECTRIC: 0.65, ICE: 1.5, ROCK: 1.5, STEEL: 0.65, FAIRY: 1.5 },
  FAIRY:    { FIRE: 0.65, FIGHTING: 1.5, POISON: 0.65, DRAGON: 1.5, DARK: 1.5, STEEL: 0.65 },
};

const ALL_TYPES: PokemonType[] = Object.values(PokemonType);

/** Build the dense 18x18 chart (every cell filled; 1.0 default), frozen. */
function buildTypeChart(): TypeChart {
  const chart = {} as Record<string, Record<string, number>>;
  for (const atk of ALL_TYPES) {
    const row: Record<string, number> = {};
    for (const def of ALL_TYPES) {
      row[def] = SPARSE_CHART[atk]?.[def as PokemonType] ?? 1.0;
    }
    chart[atk] = Object.freeze(row);
  }
  return Object.freeze(chart) as TypeChart;
}

/** The canonical elemental type chart. Import this — never rebuild it. */
export const TYPE_CHART: TypeChart = buildTypeChart();

/**
 * Combined effectiveness of an attacking move that carries 1-2 types
 * against a defender with 1-2 types: multiply every pairwise value
 * (canonical rule for this game; e.g. Fire/Flying vs Grass = 1.5*1.5*0.65*1).
 * PRD §3.2, Decision D5: If any pair has an immunity (0), returns min(nonImmuneProduct, 0.25).
 */
export function getEffectiveness(
  attackerTypes: readonly PokemonType[],
  defenderTypes: readonly PokemonType[],
  chart: TypeChart = TYPE_CHART,
): number {
  if (attackerTypes.length === 0 || defenderTypes.length === 0) return 1;
  let hasImmunity = false;
  let nonImmuneProduct = 1;
  for (const at of attackerTypes) {
    for (const dt of defenderTypes) {
      const val = chart[at][dt];
      if (val === 0) {
        hasImmunity = true;
      } else {
        nonImmuneProduct *= val;
      }
    }
  }
  if (hasImmunity) {
    return Math.min(nonImmuneProduct, 0.25);
  }
  return nonImmuneProduct;
}

/** Attacker-side stats needed by calculateDamage. */
export interface DamageAttacker {
  atk: number;
  critRate: number;
  critDmg: number;
  types: readonly PokemonType[];
}

/** Defender-side stats needed by calculateDamage. */
export interface DamageDefender {
  id: number;
  types: readonly PokemonType[];
}

/**
 * Canonical damage formula (binding for Worker A implementation & tests):
 *
 *   levelScale = 1 + (teamLevel - 1) * LEVEL_STAT_SCALE
 *   arrowMult  = 1 + UP_ARROW * ARROW_DAMAGE_PER_LEVEL
 *   eff        = getEffectiveness(attacker.types, defender.types, chart)
 *   critRate'  = min(CRIT_CHANCE_CAP, critRate + UP_CRIT * CRIT_CHANCE_PER_UP_CRIT)
 *   isCrit     = rng() < critRate'
 *   critMult   = isCrit ? critDmg * (1 + UP_CDMG * 0.1) : 1
 *   amount     = floor(baseDmg * (atk / 50) * levelScale * arrowMult * eff * critMult)
 *
 * Minimum 1 damage unless eff === 0 (immunity => 0).
 * `baseDmg` is the pre-scaled source value: projectile base, click base
 * (already including UP_CLICK), or ultimate base — the caller decides.
 */
export function calculateDamage(
  attacker: DamageAttacker,
  defender: DamageDefender,
  baseDmg: number,
  teamLevel: number,
  bastionUpgrades: BastionUpgrades,
  rng: () => number,
  typeChart: TypeChart = TYPE_CHART,
): DamageEvent {
  const eff = getEffectiveness(attacker.types, defender.types, typeChart);
  if (eff === 0) {
    return { targetId: defender.id, amount: 0, types: attacker.types as DamageEvent['types'], isCrit: false, isSuperEffective: false };
  }

  const levelScale = 1 + (teamLevel - 1) * LEVEL_STAT_SCALE;
  const arrowMult = 1 + bastionUpgrades.UP_ARROW * ARROW_DAMAGE_PER_LEVEL;
  const critChance = Math.min(CRIT_CHANCE_CAP, attacker.critRate + bastionUpgrades.UP_CRIT * CRIT_CHANCE_PER_UP_CRIT);
  const isCrit = rng() < critChance;
  const cMult = isCrit ? critMultiplier(attacker.critDmg, bastionUpgrades.UP_CDMG) : 1;

  const raw = baseDmg * (attacker.atk / 50) * levelScale * arrowMult * eff * cMult;
  const amount = Math.max(1, Math.floor(raw));

  return {
    targetId: defender.id,
    amount,
    types: attacker.types as DamageEvent['types'],
    isCrit,
    isSuperEffective: eff > 1,
  };
}

/** Balance re-export so downstream workers have a single import surface. */
export { BALANCE };
