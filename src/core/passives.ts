/**
 * PokéBastion — BENCH_PASSIVE aggregation (PRD §3.1, 2★ and 5★).
 * PURE TYPESCRIPT: no DOM / browser imports.
 *
 * A species' `benchPassive` is `{ stat, value }`. It only counts once the
 * Pokémon has reached STAR_BENCH_PASSIVE (2★) and doubles at 5★. Supported
 * stat keys:
 *
 *   <TYPE>_DAMAGE   e.g. FIRE_DAMAGE — extra damage for attackers of that type
 *   ALL_DAMAGE      extra damage for every attack
 *   CRIT_RATE       flat crit chance (0.08 = +8 percentage points)
 *   ATTACK_SPEED    extra shots per second (fraction)
 *   GOLD            extra gold per kill (additive with UP_GOLD)
 *   CLICK_DAMAGE    extra click damage
 *   ULT_CHARGE      extra ultimate charge rate (fraction)
 *   MAX_HP          extra max HP for all team members (fraction)
 *
 * Unknown stat keys are ignored (forward-compatible with future species data).
 */

import type { GameState, PokemonDefinition, PokemonType, Team6, TeamSlot } from './types';
import {
  BENCH_BONUS_CAP,
  BENCH_PASSIVE_ACTIVE_COUNTS,
  BENCH_PASSIVE_MAX_STAR_MULTIPLIER,
  MAX_STARS,
  STAR_BENCH_PASSIVE,
} from '../config/balance.config';
import { POKEDEX } from '../data/pokemon';

export interface TeamBonuses {
  /** Per attacker type, keyed by the PokemonType enum string (e.g. 'FIRE'). */
  typeDamage: Partial<Record<PokemonType, number>>;
  allDamage: number;
  critRate: number;
  attackSpeed: number;
  gold: number;
  clickDamage: number;
  ultCharge: number;
  /** Additive max HP bonus fraction for all team members (e.g. 0.12 = +12% maxHp) */
  maxHp: number;
}

export const NO_BONUSES: Readonly<TeamBonuses> = Object.freeze({
  typeDamage: {},
  allDamage: 0,
  critRate: 0,
  attackSpeed: 0,
  gold: 0,
  clickDamage: 0,
  ultCharge: 0,
  maxHp: 0,
});

/** Clamp an awakening rank into 1..MAX_STARS; undefined counts as 1★. */
export function starsOf(pokemon: { stars?: number } | null | undefined): number {
  const s = pokemon?.stars ?? 1;
  return Math.max(1, Math.min(MAX_STARS, Math.floor(s)));
}

/** Passive value a single Pokémon contributes (0 below 2★). */
export function benchPassiveValue(def: PokemonDefinition, stars: number): number {
  if (stars < STAR_BENCH_PASSIVE) return 0;
  const mult = stars >= MAX_STARS ? BENCH_PASSIVE_MAX_STAR_MULTIPLIER : 1;
  return def.benchPassive.value * mult;
}

/** Sum every team member's passive into one TeamBonuses (each stat capped). */
export function computeTeamBonuses(
  team: readonly TeamSlot[] | Team6 | GameState['team'],
  pokedex: Readonly<Record<string, PokemonDefinition>> = POKEDEX,
): TeamBonuses {
  const out: TeamBonuses = {
    typeDamage: {},
    allDamage: 0,
    critRate: 0,
    attackSpeed: 0,
    gold: 0,
    clickDamage: 0,
    ultCharge: 0,
    maxHp: 0,
  };

  for (const slot of team) {
    const pkm = slot.pokemon;
    if (!pkm || !pkm.alive || (pkm.stars ?? 1) < 2) continue;
    if (!BENCH_PASSIVE_ACTIVE_COUNTS && slot.isActive) continue;
    const def = pokedex[pkm.definitionId];
    if (!def) continue;
    const value = benchPassiveValue(def, starsOf(pkm));
    if (value <= 0) continue;

    const stat = def.benchPassive.stat;
    if (stat.endsWith('_DAMAGE') && stat !== 'ALL_DAMAGE' && stat !== 'CLICK_DAMAGE') {
      const type = stat.slice(0, -'_DAMAGE'.length) as PokemonType;
      out.typeDamage[type] = (out.typeDamage[type] ?? 0) + value;
      continue;
    }
    switch (stat) {
      case 'ALL_DAMAGE': out.allDamage += value; break;
      case 'CRIT_RATE': out.critRate += value; break;
      case 'ATTACK_SPEED': out.attackSpeed += value; break;
      case 'GOLD': out.gold += value; break;
      case 'CLICK_DAMAGE': out.clickDamage += value; break;
      case 'ULT_CHARGE': out.ultCharge += value; break;
      case 'MAX_HP': out.maxHp += value; break;
      default: break;
    }
  }

  const cap = (v: number) => Math.min(BENCH_BONUS_CAP, v);
  for (const k of Object.keys(out.typeDamage) as PokemonType[]) {
    out.typeDamage[k] = cap(out.typeDamage[k] ?? 0);
  }
  out.allDamage = cap(out.allDamage);
  out.attackSpeed = cap(out.attackSpeed);
  out.gold = cap(out.gold);
  out.clickDamage = cap(out.clickDamage);
  out.ultCharge = cap(out.ultCharge);
  out.maxHp = cap(out.maxHp);
  return out;
}

/**
 * Damage multiplier for an attack carrying `attackerTypes`: all-damage plus the
 * type bonus of each distinct attacker type, applied additively.
 * Also includes clickDamage bonus so CLICK_DAMAGE passives seamlessly boost all projectiles.
 */
export function damageBonusMultiplier(
  bonuses: TeamBonuses,
  attackerTypes: readonly PokemonType[],
): number {
  let extra = bonuses.allDamage + bonuses.clickDamage;
  for (const t of new Set(attackerTypes)) extra += bonuses.typeDamage[t] ?? 0;
  return 1 + extra;
}
