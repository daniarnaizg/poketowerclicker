// Core types for PokéBastion

export type PokemonType =
  | 'NORMAL' | 'FIRE' | 'WATER' | 'GRASS' | 'ELECTRIC' | 'PSYCHIC'
  | 'GHOST' | 'ROCK' | 'GROUND' | 'POISON' | 'FIGHTING' | 'FLYING'
  | 'DRAGON' | 'STEEL' | 'DARK' | 'BUG' | 'ICE' | 'FAIRY';

export type AttackPattern = 'SNIPER' | 'AOE' | 'PULSE' | 'CHAIN';

export type GamePhase = 'STARTER_SELECT' | 'PLAYING' | 'GAME_OVER';

export interface PokemonDefinition {
  id: string;
  name: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  baseStats: {
    atk: number;
    spd: number;
    critRate: number;
    critDmg: number;
  };
  pattern: AttackPattern;
  evolution?: {
    targetId: string;
    canonicalLevel: number;
  };
  ultimate: {
    id: string;
    name: string;
    energyCost: number;
  };
}

export interface Entity {
  id: number;
  pokemonId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  types: PokemonType[];
  atk: number;
  spd: number;
  critRate: number;
  critDmg: number;
  angle: number;
  isBoss: boolean;
  isMiniBoss: boolean;
  bossTimerSec?: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  type: PokemonType;
  pattern: AttackPattern;
  pierced: Set<number>;
  maxBounces: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface TeamMember {
  pokemonId: string;
  currentEvolutionId: string;
  hp: number;
  maxHp: number;
  switchCooldown: number;
}

export interface Upgrades {
  teamLevel: number;
  teamLevelCost: number;
  UP_CLICK: number;
  UP_HP: number;
  UP_MULTI: number;
  UP_ARROW: number;
  UP_SPD: number;
  UP_CRIT: number;
  UP_CDMG: number;
  UP_GOLD: number;
}

export interface GameState {
  phase: GamePhase;
  floor: number;
  waveTimerSec: number;
  gold: number;
  runaEarned: number;
  upgrades: Upgrades;
  team: (TeamMember | null)[];
  activeIndex: number;
  activeEntity: Entity | null;
  enemies: Entity[];
  projectiles: Projectile[];
  floatingTexts: FloatingText[];
  bastionHp: number;
  bastionMaxHp: number;
  autoFireTimer: number;
  bossActive: boolean;
  ultimateCharge: number;
  totalKills: number;
  totalDamage: number;
  elapsedSec: number;
}

export type GameAction =
  | { type: 'SELECT_STARTER'; pokemonId: string }
  | { type: 'HOT_SWAP'; index: number }
  | { type: 'UPGRADE_TEAM_LEVEL' }
  | { type: 'UPGRADE'; key: keyof Omit<Upgrades, 'teamLevel' | 'teamLevelCost'> }
  | { type: 'USE_ULTIMATE' }
  | { type: 'CLICK_DAMAGE'; x: number; y: number }
  | { type: 'RESTART' };
