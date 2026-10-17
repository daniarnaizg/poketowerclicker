/**
 * PokéBastion — human-readable (Spanish) text for passives, patterns and
 * switch-in effects, shared by the Caja and the team bar tooltips.
 */

import { AttackPattern, PokemonType } from '../core/types';
import type { SwitchInEffect } from '../core/types';
import { TYPE_LABEL_ES } from './typeColors';

const pct = (v: number): string => `${Math.round(v * 1000) / 10}%`;

/** e.g. ('FIRE_DAMAGE', 0.08) -> "+8% daño Fuego al equipo". */
export function describePassive(stat: string, value: number): string {
  const v = `+${pct(value)}`;
  if (stat.endsWith('_DAMAGE') && stat !== 'ALL_DAMAGE' && stat !== 'CLICK_DAMAGE') {
    const type = stat.slice(0, -'_DAMAGE'.length) as PokemonType;
    const label = TYPE_LABEL_ES[type] ?? type;
    return `${v} daño tipo ${label.toLowerCase()}`;
  }
  switch (stat) {
    case 'ALL_DAMAGE': return `${v} daño a todo el equipo`;
    case 'CRIT_RATE': return `${v} prob. de crítico`;
    case 'ATTACK_SPEED': return `${v} velocidad de ataque`;
    case 'GOLD': return `${v} oro por baja`;
    case 'CLICK_DAMAGE': return `${v} daño de proyectil`;
    case 'ULT_CHARGE': return `${v} carga de Definitiva`;
    case 'BASTION_REGEN': return `${v} regeneración del Bastión/s`;
    default: return `${v} ${stat}`;
  }
}

export const PATTERN_LABEL: Record<AttackPattern, string> = {
  [AttackPattern.SNIPER]: 'Francotirador',
  [AttackPattern.AOE]: 'Artillero (AoE)',
  [AttackPattern.PULSE]: 'Pulso',
  [AttackPattern.CHAIN]: 'Cadena',
};

/** What the 4★ pattern evolution does for each pattern. */
export const PATTERN_UPGRADE_TEXT: Record<AttackPattern, string> = {
  [AttackPattern.SNIPER]: 'Proyectil perforante (atraviesa 2 enemigos más)',
  [AttackPattern.AOE]: 'Radio de explosión +50%',
  [AttackPattern.PULSE]: 'Onda perforante (atraviesa 3 enemigos más)',
  [AttackPattern.CHAIN]: '+1 rebote adicional',
};

export const EFFECT_LABEL: Record<SwitchInEffect, string> = {
  BURN: 'Quemadura',
  PARALYZE: 'Parálisis',
  SLOW: 'Ralentización',
  SHIELD: 'Escudo del Bastión',
};

export const STATUS_COLOR = {
  BURN: '#f08030',
  SLOW: '#58b0f8',
  PARALYZE: '#f8d030',
} as const;
