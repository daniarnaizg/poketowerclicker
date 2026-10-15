# PokéBastion — Phase 1 Execution Blueprint

## 1. Folder Structure

```
src/
├── core/                        # Headless pure TS game engine
│   ├── types.ts                 # All shared interfaces (Entity, GameState, etc.)
│   ├── engine.ts                # Main game loop (delta accumulator, tick)
│   ├── damage.ts                # Damage formula + type effectiveness
│   ├── evolution.ts             # Canonical evolution thresholds
│   ├── wave.ts                  # Wave/floor spawning logic
│   └── movement.ts              # 360° radial enemy movement
├── renderer/                    # Canvas 2D arena renderer
│   └── arena.ts                 # 144×144 viewport, sprites, projectiles, damage numbers
├── ui/                          # Preact + Tailwind reactive UI
│   ├── store.ts                 # Zustand bridge store
│   ├── App.tsx                  # Root component
│   ├── StarterSelection.tsx     # Modal for choosing initial starter
│   ├── TeamBar.tsx              # 6-slot team with hot-swap (1-6)
│   ├── UpgradePanel.tsx         # Bastion upgrades + team level shop
│   ├── GameOverScreen.tsx       # Trainer card + Runa calculation
│   ├── HUD.tsx                  # Floor, HP bar, timer overlay
│   └── index.css                # Tailwind directives + global styles
├── config/
│   └── balance.config.ts        # All tunable game constants
├── data/
│   └── starters.ts              # Charmander, Squirtle, Bulbasaur definitions
├── main.tsx                     # Entry point
└── vite-env.d.ts
```

## 2. Core TypeScript Interfaces

```ts
// types.ts

// --- Enums ---
type PokemonType = 'NORMAL'|'FIRE'|'WATER'|'GRASS'|'ELECTRIC'|'PSYCHIC'|'GHOST'|'ROCK'|'GROUND'|'POISON'|'FIGHTING'|'FLYING'|'DRAGON'|'STEEL'|'DARK'|'BUG'|'ICE'|'FAIRY';
type AttackPattern = 'SNIPER' | 'AOE' | 'PULSE' | 'CHAIN';
type GamePhase = 'STARTER_SELECT' | 'PLAYING' | 'GAME_OVER';

// --- Data Definitions ---
interface PokemonDefinition {
  id: string;                    // "0004"
  name: string;                  // "Charmander"
  types: [PokemonType] | [PokemonType, PokemonType];
  baseStats: { atk: number; spd: number; critRate: number; critDmg: number };
  pattern: AttackPattern;
  evolution?: { targetId: string; canonicalLevel: number };
  ultimate: { id: string; name: string; energyCost: number };
}

// --- Live Entities ---
interface Entity {
  id: number;
  pokemonId: string;
  x: number; y: number;         // logical px (0-143)
  hp: number; maxHp: number;
  speed: number;                 // px/sec
  types: PokemonType[];
  atk: number; spd: number;
  critRate: number; critDmg: number;
  angle: number;                 // approach angle (radians, for enemies)
  isBoss: boolean;
  isMiniBoss: boolean;
  bossTimerSec?: number;         // countdown for bosses
}

interface Projectile {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  damage: number;
  type: PokemonType;
  pattern: AttackPattern;
  pierced: Set<number>;          // entity IDs already hit
  maxBounces: number;
}

interface FloatingText {
  id: number; x: number; y: number;
  text: string; color: string;
  life: number; maxLife: number;
}

interface TeamMember {
  pokemonId: string;
  currentEvolutionId: string;    // tracks evolution state
  hp: number; maxHp: number;
  switchCooldown: number;        // seconds remaining
}

interface Upgrades {
  teamLevel: number;
  teamLevelCost: number;
  UP_CLICK: number;   // Golpe Firme
  UP_HP: number;      // Vitalidad
  UP_MULTI: number;   // Ataque Múltiple
  UP_ARROW: number;   // Potencia Elemental
  UP_SPD: number;     // Cadencia
  UP_CRIT: number;    // Ojo Certero
  UP_CDMG: number;    // Furia
  UP_GOLD: number;    // Amuleto Moneda
}

// --- Game State (immutable snapshot each tick) ---
interface GameState {
  phase: GamePhase;
  floor: number;
  waveTimerSec: number;          // time remaining in current wave
  gold: number;
  runaEarned: number;            // calculated on game over
  upgrades: Upgrades;
  team: TeamMember[];            // always 6 slots (null/undefined = empty)
  activeIndex: number;           // 0-5, which team member is on screen
  activeEntity: Entity | null;   // centered at (72,72) — the active pokemon
  enemies: Entity[];
  projectiles: Projectile[];
  floatingTexts: FloatingText[];
  bastionHp: number;
  bastionMaxHp: number;
  autoFireTimer: number;         // seconds until next auto-shot
  bossActive: boolean;
  ultimateCharge: number;        // 0.0 - 1.0
  totalKills: number;
  totalDamage: number;
  elapsedSec: number;
}

// --- Actions (UI → Core) ---
type GameAction =
  | { type: 'SELECT_STARTER'; pokemonId: string }
  | { type: 'HOT_SWAP'; index: number }
  | { type: 'UPGRADE_TEAM_LEVEL' }
  | { type: 'UPGRADE'; key: keyof Omit<Upgrades, 'teamLevel' | 'teamLevelCost'> }
  | { type: 'USE_ULTIMATE' }
  | { type: 'CLICK_DAMAGE'; x: number; y: number }
  | { type: 'RESTART' };
```

## 3. Decoupled Contract (Core ↔ UI)

### Pattern:
- **Core** runs a `requestAnimationFrame` loop with a fixed-step delta accumulator (1/60s per tick).
- Each tick produces a new `GameState` snapshot.
- Core writes to **Zustand store** via `set()` after each tick — but only the **UI-visible slice** (floor, gold, team HP, upgrades, phase, etc.), NOT every projectile/entity position.
- **Canvas renderer** reads entity positions directly from the engine's internal mutable state (not through Zustand/Preact) — bypassing the React reconciliation entirely.
- **Preact UI** subscribes to Zustand with selectors — only re-renders on UI-relevant state changes (gold, floor, team HP bars, phase transitions).

### Zustand Store Shape:
```ts
interface GameStore {
  // UI-visible state (updated ~10x/sec, not 60x)
  phase: GamePhase;
  floor: number;
  gold: number;
  teamLevel: number;
  upgrades: Upgrades;
  team: TeamMember[];
  activeIndex: number;
  bastionHp: number;
  bastionMaxHp: number;
  ultimateCharge: number;
  waveTimerSec: number;
  bossActive: boolean;
  runaEarned: number;
  totalKills: number;

  // Actions
  dispatch: (action: GameAction) => void;
}
```

### Data flow:
```
Core Engine (60fps, mutable internal state)
  → writes UI slice to Zustand (~10fps throttle)
  → Canvas renderer reads engine state directly each frame

Preact UI
  → reads Zustand via selectors (re-renders only on change)
  → dispatches GameAction via store.dispatch()
  → store.dispatch() calls engine.handleAction()
```

## 4. Balance Config Shape

```ts
// balance.config.ts
export const BALANCE = {
  // Arena
  ARENA_SIZE: 144,
  CENTER: 72,
  
  // Game loop
  TICK_RATE: 60,
  UI_SYNC_INTERVAL: 100,  // ms between Zustand syncs
  
  // Waves
  BASE_WAVE_DURATION_SEC: 30,
  ENEMIES_PER_WAVE: 10,
  MINI_BOSS_EVERY: 10,
  BOSS_FLOORS: [50, 100],
  BOSS_TIMER_SEC: 30,
  BOSS_HP_MULTIPLIER: 10,
  
  // Team Level
  BASE_TEAM_LEVEL_COST: 10,
  TEAM_LEVEL_COST_SCALE: 1.15,  // each level costs 15% more
  
  // Bastion
  BASE_BASTION_HP: 100,
  BASTION_REGEN_PER_SEC: 0.02,  // 2%/s
  
  // Damage
  SUPER_EFFECTIVE: 1.5,
  NOT_EFFECTIVE: 0.65,
  IMMUNE: 0,
  BASE_CRIT_RATE: 0.05,
  BASE_CRIT_DMG: 2.0,
  
  // Hot-Swap
  SWITCH_COOLDOWN_SEC: 4,
  SWITCH_IN_DMG_MULTIPLIER: 2.0,
  
  // Gold
  BASE_GOLD_PER_KILL: 1,
  GOLD_SCALE_PER_FLOOR: 1.05,
  
  // Runa formula: floor( (waveMax / 5) ^ 1.5 )
  
  // Upgrade costs (base * level * scale)
  UPGRADE_COST_SCALE: 1.12,
  
  // Type effectiveness chart (18 types)
  TYPE_CHART: { /* ... */ } as Record<PokemonType, Record<PokemonType, number>>,
};
```

## 5. Implementation Order

1. **Scaffold**: `pnpm create vite`, install deps, create folder hierarchy
2. **Types** (`src/core/types.ts`): All interfaces above
3. **Balance Config** (`src/config/balance.config.ts`): All constants + type chart
4. **Starter Data** (`src/data/starters.ts`): Charmander/Squirtle/Bulbasaur definitions
5. **Damage Module** (`src/core/damage.ts`): Type effectiveness, damage calc, crit
6. **Evolution Module** (`src/core/evolution.ts`): Canonical evolution lookup
7. **Movement Module** (`src/core/movement.ts`): 360° radial spawn + movement
8. **Wave Module** (`src/core/wave.ts`): Floor spawning, boss waves, enemy stats scaling
9. **Engine** (`src/core/engine.ts`): Main loop, delta accumulator, ties everything together
10. **Zustand Store** (`src/ui/store.ts`): Bridge between engine and UI
11. **Arena Renderer** (`src/renderer/arena.ts`): Canvas 2D, 144×144, sprites/placeholders
12. **Starter Selection** (`src/ui/StarterSelection.tsx`)
13. **Team Bar** (`src/ui/TeamBar.tsx`)
14. **HUD** (`src/ui/HUD.tsx`)
15. **Upgrade Panel** (`src/ui/UpgradePanel.tsx`)
16. **Game Over** (`src/ui/GameOverScreen.tsx`)
17. **App Shell** (`src/ui/App.tsx`)
18. **Integration + Build verification**

## 6. Hard Constraints

- Arena: exactly 144×144 logical pixels, CSS-scaled with `image-rendering: pixelated`
- Active Pokémon: always drawn at (72, 72) center
- Enemies: spawn at random angle on perimeter, move toward center at uniform speed
- Unified Team Level: all 6 members share one level, not individual
- Evolution: Charmander→Charmeleon@16→Charizard@36, Squirtle→Wartortle@16→Blastoise@36, Bulbasaur→Ivysaur@16→Venusaur@32
- 60 FPS fixed timestep with delta accumulator
- Zero DOM/React in src/core/ — pure TS only
- Canvas renderer reads engine state directly, NOT through Zustand
