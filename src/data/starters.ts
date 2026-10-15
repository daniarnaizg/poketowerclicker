import type { PokemonDefinition } from '../core/types';

export const STARTERS: PokemonDefinition[] = [
  {
    id: '0004',
    name: 'Charmander',
    types: ['FIRE'],
    baseStats: {
      atk: 12,
      spd: 1.2,
      critRate: 0.06,
      critDmg: 2.0,
    },
    pattern: 'SNIPER',
    evolution: {
      targetId: '0005', // Charmeleon
      canonicalLevel: 16,
    },
    ultimate: {
      id: 'flamethrower',
      name: 'Llamarada',
      energyCost: 100,
    },
  },
  {
    id: '0005',
    name: 'Charmeleon',
    types: ['FIRE'],
    baseStats: {
      atk: 18,
      spd: 1.3,
      critRate: 0.07,
      critDmg: 2.1,
    },
    pattern: 'SNIPER',
    evolution: {
      targetId: '0006', // Charizard
      canonicalLevel: 36,
    },
    ultimate: {
      id: 'fire_blast',
      name: 'Llamarada',
      energyCost: 100,
    },
  },
  {
    id: '0006',
    name: 'Charizard',
    types: ['FIRE', 'FLYING'],
    baseStats: {
      atk: 28,
      spd: 1.5,
      critRate: 0.08,
      critDmg: 2.2,
    },
    pattern: 'AOE',
    ultimate: {
      id: 'fire_blast',
      name: 'Llamarada',
      energyCost: 100,
    },
  },
  {
    id: '0007',
    name: 'Squirtle',
    types: ['WATER'],
    baseStats: {
      atk: 10,
      spd: 1.0,
      critRate: 0.05,
      critDmg: 2.0,
    },
    pattern: 'PULSE',
    evolution: {
      targetId: '0008', // Wartortle
      canonicalLevel: 16,
    },
    ultimate: {
      id: 'hydro_pump',
      name: 'Hidrobomba',
      energyCost: 100,
    },
  },
  {
    id: '0008',
    name: 'Wartortle',
    types: ['WATER'],
    baseStats: {
      atk: 15,
      spd: 1.1,
      critRate: 0.06,
      critDmg: 2.1,
    },
    pattern: 'PULSE',
    evolution: {
      targetId: '0009', // Blastoise
      canonicalLevel: 36,
    },
    ultimate: {
      id: 'hydro_pump',
      name: 'Hidrobomba',
      energyCost: 100,
    },
  },
  {
    id: '0009',
    name: 'Blastoise',
    types: ['WATER'],
    baseStats: {
      atk: 24,
      spd: 1.2,
      critRate: 0.07,
      critDmg: 2.2,
    },
    pattern: 'AOE',
    ultimate: {
      id: 'hydro_pump',
      name: 'Hidrobomba',
      energyCost: 100,
    },
  },
  {
    id: '0001',
    name: 'Bulbasaur',
    types: ['GRASS', 'POISON'],
    baseStats: {
      atk: 11,
      spd: 1.1,
      critRate: 0.05,
      critDmg: 2.0,
    },
    pattern: 'CHAIN',
    evolution: {
      targetId: '0002', // Ivysaur
      canonicalLevel: 16,
    },
    ultimate: {
      id: 'solar_beam',
      name: 'Tormenta Floral',
      energyCost: 100,
    },
  },
  {
    id: '0002',
    name: 'Ivysaur',
    types: ['GRASS', 'POISON'],
    baseStats: {
      atk: 16,
      spd: 1.2,
      critRate: 0.06,
      critDmg: 2.1,
    },
    pattern: 'CHAIN',
    evolution: {
      targetId: '0003', // Venusaur
      canonicalLevel: 32,
    },
    ultimate: {
      id: 'solar_beam',
      name: 'Tormenta Floral',
      energyCost: 100,
    },
  },
  {
    id: '0003',
    name: 'Venusaur',
    types: ['GRASS', 'POISON'],
    baseStats: {
      atk: 25,
      spd: 1.3,
      critRate: 0.07,
      critDmg: 2.2,
    },
    pattern: 'AOE',
    ultimate: {
      id: 'solar_beam',
      name: 'Tormenta Floral',
      energyCost: 100,
    },
  },
];

export const STARTER_CHOICES = STARTERS.filter(p =>
  ['0004', '0007', '0001'].includes(p.id)
);
