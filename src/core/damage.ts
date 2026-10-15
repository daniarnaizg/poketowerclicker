// src/core/damage.ts
import type { PokemonType } from './types';
import { BALANCE } from '../config/balance.config';

export function getTypeMultiplier(
  attackType: PokemonType,
  defenderTypes: PokemonType[]
): number {
  const chart = BALANCE.TYPE_CHART[attackType];
  let mult = 1;
  for (const defType of defenderTypes) {
    const entry = chart[defType];
    if (entry !== undefined) {
      mult *= entry;
    }
  }
  return mult;
}

export function calculateDamage(
  attackerAtk: number,
  attackType: PokemonType,
  defenderTypes: PokemonType[],
  critRate: number,
  critDmg: number
): { damage: number; isCrit: boolean } {
  // attackerAtk is already pre-scaled by team level and upgrades
  const typeMult = getTypeMultiplier(attackType, defenderTypes);
  const isCrit = Math.random() < critRate;
  const critMult = isCrit ? critDmg : 1;
  const damage = Math.max(1, Math.floor(attackerAtk * typeMult * critMult));
  return { damage, isCrit };
}

export function calculateClickDamage(
  attackerAtk: number,
  attackType: PokemonType,
  defenderTypes: PokemonType[],
  critRate: number,
  critDmg: number,
  upgradeClick: number
): { damage: number; isCrit: boolean } {
  // Click gets its own bonus multiplier on top of pre-scaled atk
  const baseDmg = attackerAtk * (1 + upgradeClick * 0.25);
  const typeMult = getTypeMultiplier(attackType, defenderTypes);
  const isCrit = Math.random() < critRate;
  const critMult = isCrit ? critDmg : 1;
  const damage = Math.max(1, Math.floor(baseDmg * typeMult * critMult));
  return { damage, isCrit };
}
