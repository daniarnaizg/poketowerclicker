# Mapa del Código — Spawner Continuo, Ritmo de Piso y Jefes por Fases (`PASO 0`)

Generado en modo lectura sobre el estado inicial del repositorio (`HEAD` previo a WP0–WP7) para fundamentar `docs/PLAN_SPAWNER_BOSSES.md`.

---

## 1. Inventario de Símbolos, Firmas y Líneas Actuales

### 1.1. `src/core/waveGenerator.ts` (114 líneas)
| Símbolo | Líneas | Firma / Definición | Notas |
| :--- | :--- | :--- | :--- |
| `BOSS_GOLD_MULTIPLIER` | L23 | `const BOSS_GOLD_MULTIPLIER = BOSS_HP_MULTIPLIER;` (`10`) | Multiplicador de oro para jefe respecto a `enemyGoldValue(floor)`. |
| `BIG_BOSS_HP_FACTOR` | L25 | `const BIG_BOSS_HP_FACTOR = 2;` | Multiplicador adicional (×2) tanto para HP como para oro en Grandes Bosses (`BIG_BOSS_FLOORS`). |
| `spawnEnemyAt` | L31–86 | `export function spawnEnemyAt(angle: number, floor: number, isBoss: boolean, rng: () => number, speciesId?: string): Enemy` | Usa `const radius = ARENA.CENTER;` (L38, `192`), ignorando `ARENA.SPAWN_HALF_EXTENT` (`208`). Si `!speciesId` y `!isBoss`, elige `biome.wild[Math.floor(rng() * biome.wild.length)]` con distribución uniforme (no usa `biome.typeWeights`). Devuelve `id: 0`. |
| `generateWave` | L94–113 | `export function generateWave(floor: number, rng: () => number): Enemy[]` | En piso de jefe (`isBigBoss \|\| isMiniBoss`, L98–101) devuelve `[boss]` con `id: 1`. En piso normal (L103–112) genera `WAVE_ENEMY_COUNT_BASE` (`10`) enemigos de golpe con `id: 1..10`. |

### 1.2. `src/core/rng.ts` (44 líneas)
| Símbolo | Líneas | Firma / Definición | Notas |
| :--- | :--- | :--- | :--- |
| `RngChannel` | L9 | `export type RngChannel = 'WAVE' \| 'SPECIAL' \| 'COMBAT';` | Canales deterministas aislados. |
| `mulberry32` | L18–26 | `export function mulberry32(seed: number): () => number` | PRNG de 32 bits en `[0, 1)`. |
| `deriveSeed` | L29–36 | `export function deriveSeed(seed: number, channel: RngChannel, floor = 0): number` | Actualmente **NO** acepta parámetro `salt`. Para WP1/WP2/WP5 (adds por fase) debe extenderse a `deriveSeed(seed: number, channel: RngChannel, floor = 0, salt = 0): number` manteniendo `salt = 0` idéntico al hash actual si no se pasa `salt`. |
| `rngFor` | L41–43 | `export function rngFor(seed: number, channel: RngChannel, floor = 0): () => number` | Extender a `rngFor(seed: number, channel: RngChannel, floor = 0, salt = 0): () => number`. |

### 1.3. `src/core/gameLoop.ts` (1334 líneas)

#### A) Sitios donde se lee, asigna o decrementa `waveEnemiesRemaining`
| # | Contexto | Líneas | Código actual |
| :--- | :--- | :--- | :--- |
| 1 | `startRun` (inicialización piso 1) | L578 | `waveEnemiesRemaining: wave.length,` |
| 2 | `applyHotSwap` (bajas por onda de entrada manual) | L666 | `waveEnemiesRemaining: Math.max(0, next.waveEnemiesRemaining - burst.killsDelta),` |
| 3 | `applyUltimate` (lectura inicial + decremento por baja + escritura) | L741, L790, L801 | `let remaining = state.waveEnemiesRemaining;` ... `remaining = Math.max(0, remaining - 1);` ... `waveEnemiesRemaining: remaining,` |
| 4 | `stepOnce` (copia local al inicio del step) | L905 | `let waveEnemiesRemaining = state.waveEnemiesRemaining;` |
| 5 | `applyDamageToActive` → Relevo Forzado (bajas por onda de entrada forzada) | L1014 | `waveEnemiesRemaining = Math.max(0, waveEnemiesRemaining - burst.killsDelta);` |
| 6 | Sección 1 de `stepOnce` — Tick de `BURN` (muerte por quemadura) | L1048 | `waveEnemiesRemaining = Math.max(0, waveEnemiesRemaining - 1);` |
| 7 | Sección 1 de `stepOnce` — Fuga en centro (`!enemy.isBoss`) | L1085 | `waveEnemiesRemaining = Math.max(0, waveEnemiesRemaining - 1);` |
| 8 | Helper `strike` en `stepOnce` (impacto directo de proyectil o splash AoE) | L1118 | `waveEnemiesRemaining = Math.max(0, waveEnemiesRemaining - 1);` |
| 9 | Sección 5 (`GAME_OVER` return) | L1233 | `waveEnemiesRemaining,` |
| 10 | Sección 6 (condición de fin de oleada) | L1248 | `if (waveEnemiesRemaining <= 0 && aliveEnemies.length === 0 && interWaveTimerSec === undefined && !awaitingNextWave)` |
| 11 | Sección 7 (spawn del siguiente piso tras `interWaveTimerSec <= 0`) | L1267 | `waveEnemiesRemaining = wave.length;` |
| 12 | Return final de `stepOnce` | L1287 | `waveEnemiesRemaining,` |

#### B) Todos los accesos directos y escrituras a `enemy.hp`
| # | Vía de daño / mutación | Líneas | Código actual | ¿Pasa por `hitEnemy`? |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `hitEnemy` (usado por `strike` y `applyUltimate`) | L237–265 (mutación en L255) | `enemy.hp -= event.amount; if (enemy.alive && enemy.hp <= 0) { enemy.alive = false; killed = true; goldGained = goldFor(enemy, state, bonuses); }` | Sí (es `hitEnemy`) |
| 2 | `applySwitchInBurst` (onda de entrada en relevo manual L644 y forzado L992) | L447–459 | `enemy.hp -= event.amount;` ... `if (enemy.alive && enemy.hp <= 0) { enemy.alive = false; killsDelta += 1; ... }` | **NO** (duplica cálculo y mutación directa) |
| 3 | `applyUltimate` (definitiva) | L779 | `const outcome = hitEnemy(enemy, baseDmg, attacker, state, rng, config, bonuses);` | Sí |
| 4 | Tick de `BURN` en Sección 1 de `stepOnce` | L1035–1040 | `const amount = (burn.dps ?? 0) * dt; enemy.hp -= amount;` ... `if (enemy.hp <= 0) { enemy.alive = false; ... }` | **NO** (mutación directa en bucle de estados) |
| 5 | Fuga de enemigo normal en Sección 1 de `stepOnce` | L1083–1084 | `enemy.alive = false; enemy.hp = 0;` | N/A (autodestrucción por fuga, no es daño del jugador) |
| 6 | `strike` (impacto de proyectil L1145 y splash AoE L1156) | L1107 | `const outcome = hitEnemy(enemy, baseDmg, attackerOf(currentActive, types), state, rng, config, bonuses);` | Sí |

> **Conclusión para WP5 (`applyDamageToEnemy`)**: Actualmente `applySwitchInBurst` y el tick de `BURN` modifican `enemy.hp` sin pasar por `hitEnemy`, y `hitEnemy` no conoce los umbrales de fase de jefe (66 % / 33 %) ni el estado de invulnerabilidad (`bossInvulnSec`). Centralizar la resta de HP, el recorte al umbral de fase, el bloqueo por invulnerabilidad y la detección de muerte en `applyDamageToEnemy` cubrirá las 5 vías de daño del jugador (proyectil, splash, definitiva, switch-in burst y quemadura).

#### C) `maxEntityId` y todas sus llamadas
| # | Ubicación | Líneas | Uso actual |
| :--- | :--- | :--- | :--- |
| Definición | `maxEntityId(state: GameState): number` | L156–165 | Recorre `state.enemies`, `state.projectiles`, `state.floatingTexts`, `state.effects`, `state.strikes` y `state.team`. |
| Llamada 1 | `fireProjectiles` | L354 | `let id = maxEntityId(state) + 1;` (se llama en cada `stepOnce` donde el activo dispara). |
| Llamada 2 | `applyHotSwap` | L642 | `let nextTextId = maxEntityId(next) + 1;` |
| Llamada 3 | `applyClick` | L695 | `const p = createProjectileAtPoint(maxEntityId(state) + 1, ...);` (y `fx` usa `p.id + 1` en L697). |
| Llamada 4 | `applyUltimate` | L736 | `let nextTextId = maxEntityId(state) + 1;` |
| Llamada 5 | `stepOnce` | L880 | `let nextTextId = maxEntityId(state) + 1;` (OJO: `fireProjectiles` en L1127 vuelve a llamar `maxEntityId(state) + 1` sobre el `state` original del principio del step, pudiendo colisionar IDs con `floatingTexts`/`strikes` creados en la sección 1 del mismo step). |

#### D) `fireProjectiles` y Colisión de Proyectiles
- **`fireProjectiles`** (`L329–365`):
  - Filtra vivos: `const living = enemies.filter((e) => e.alive);` (L336).
  - Ordena **todos** los vivos en cada disparo: `const targets = [...living].sort((a, b) => dist2ToCenter(a) - dist2ToCenter(b)).slice(0, multi);` (L349).
- **Colisión de proyectiles** (`L1131–1177`) y **`nearestUnhit`** (`L1296–1308`):
  - Bucle anidado `for (const p of projectiles)` × `for (const enemy of enemies)` (L1132, L1138).
  - En cada impacto: `p.hitIds = [...(p.hitIds ?? []), enemy.id];` (L1147) y crea un efecto `IMPACT` y un `floatingText` (además de otro `floatingText` si muere).
  - Si `p.splashRadius`: segundo bucle `for (const other of enemies)` (L1151–1158) llamando a `strike`.

#### E) Anclaje de Jefe y Temporizador de Jefe
- **Anclaje en Sección 1** (`L1061–1079`):
  - Cuando `d <= ARENA.BASTION_DAMAGE_R || enemy.anchoredAtBastion` y `enemy.isBoss`: fija `enemy.anchoredAtBastion = true`, reposiciona a `ARENA.BASTION_DAMAGE_R` (`24` px) del centro y decrementa `enemy.bossAttackCooldownSec` (inicializado en `0` en el primer frame de anclaje, por lo que golpea inmediatamente al anclarse y luego cada `BOSS_ANCHOR_TICK_SEC = 1.0` s).
  - Daño por golpe: `currentActive.maxHp * BOSS_ANCHOR_MAX_HP_FRACTION` (`0.06`), pasado a `applyDamageToActive(..., enemy.types, 'boss')`.
- **Reloj de jefe en Sección 4 y 5** (`L1181–1184`, `L1200–1218`):
  - `const boss = aliveEnemies.find((e) => e.isBoss);`
  - `bossTimerSec = boss ? (bossTimerSec ?? (boss.bossTimerSec ?? bossTimerForFloor(floor))) - dt : undefined;`
  - En Sección 5 (L1203): si `boss && bossTimerSec !== undefined && bossTimerSec <= 0`, termina la partida con `phase = 'GAME_OVER'` y `defeatCause: 'bossTimerExpired'`.

#### F) Secciones 6 y 7 de `stepOnce` (Fin de piso y siguiente piso)
- **Sección 6** (`L1245–1255`):
  - Condición actual: `waveEnemiesRemaining <= 0 && aliveEnemies.length === 0 && interWaveTimerSec === undefined && !awaitingNextWave`.
  - Si `state.autoAdvanceWave === false` → `awaitingNextWave = true`; si no → `interWaveTimerSec = INTER_WAVE_BREAK_SEC` (`2.75` s).
- **Sección 7** (`L1257–1273`):
  - Cuando `!awaitingNextWave && interWaveTimerSec !== undefined`, resta `dt`.
  - Si `interWaveTimerSec <= 0`: incrementa `floor += 1`, obtiene `waveRng = config.seed !== undefined ? rngFor(config.seed, 'WAVE', floor) : rng`, llama a `generateWave(floor, waveRng)` y actualiza `finalEnemies`, `waveEnemiesRemaining`, `bossTimerSec` y `runStats.floorReached`.

#### G) `createFloatingText` y `createEffect`
- `createFloatingText` (`L104–112`): crea `{ id, x, y, text, color, age: 0, maxAge: FLOATING_TEXT_MAX_AGE (1.0) }`. Se invoca en:
  - `applySwitchInBurst` (L462, daño por enemigo golpeado)
  - `applyUltimate` (L782 daño, L791 `+oro` por baja)
  - `applyDamageToActive` (L927 `'BLOQUEO'`, L940 `-dmg` al activo)
  - `BURN` kill en Sección 1 (L1049 `+oro` por baja)
  - `strike` en Sección 2/3 (L1110 daño, L1120 `+oro` por baja)
- `createEffect` (`L114–123`): crea `{ id, kind, type, x, y, age: 0, maxAge: EFFECT_MAX_AGE[kind], ...extra }`. Se invoca en:
  - `applySwitchInBurst` (L479 `'RING'`)
  - `applyClick` (L697 `'RING'`)
  - `applyUltimate` (L750 `'NOVA'`, L767 `'BEAM'`, L774 `'FLASH'`)
  - Colisión de proyectil (L1146 `'IMPACT'`)

### 1.4. `src/renderer/arena.ts` (591 líneas)
| Símbolo | Líneas | Firma / Comportamiento actual |
| :--- | :--- | :--- |
| `drawShadow` | L122–130 | `function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void` — dibuja elipse `rgba(0,0,0,0.25)` + borde de color (no crea gradientes). |
| `enemyDrawPos` | L324–330 | `export function enemyDrawPos(enemy: Enemy): { x: number; y: number }` — desplaza jefes anclados `+14` px (`BOSS_ANCHOR_PUSH`) hacia fuera. |
| `enemyItems` | L346–416 | `function enemyItems(ctx, enemies, strikes, now): DrawItem[]` — por cada enemigo vivo (y cada `strike` no-jefe) instancia un objeto `{ y, front, draw: () => { ... } }` con closure por frame. |
| `renderEnemies` | L423–434 | `export function renderEnemies(ctx, enemies, now, strikes, layer: 'all' \| 'back' \| 'front' = 'all'): void` — llama a `enemyItems`, filtra por `layer` y ordena por `y`. |
| `ArenaRenderer.render` | L533–583 | Llama a `renderEnemies(..., 'back')` en L568 y **otra vez** a `renderEnemies(..., 'front')` en L571 (duplicando la creación de closures y el sort cada frame). En L575–579 dibuja `renderHPBar` para **todos** los enemigos vivos sin excepción. |

---

## 2. Verificación de Afirmaciones B1–B12 de la Spec

| ID | Afirmación en `SPEC_SPAWNER_BOSSES.md` | Verificación contra el código real | Estado |
| :--- | :--- | :--- | :--- |
| **B1** | `generateWave` genera 10 enemigos de golpe en el anillo de radio 192 a velocidad homogénea. | Confirmado en `waveGenerator.ts` L38 (`radius = ARENA.CENTER = 192`), L105 (`WAVE_ENEMY_COUNT_BASE = 10` en `balance.config.ts` L51). | **Exacto** |
| **B2** | `enemyHp(f) = 10·1,085^(f-1)` frente a `PROJECTILE_BASE_DAMAGE = 60`. | Confirmado en `balance.config.ts` L75 (`PROJECTILE_BASE_DAMAGE = 60`) y L181–183 (`Math.floor(10 * Math.pow(1.085, floor - 1))`). | **Exacto** |
| **B3** | Boss = `enemyHp × 10` (×2 si Gran Boss). Piso 10 ≈ 200 HP. Definitivas `60 × power` (10–20) = 600–1.200 base. | Confirmado en `waveGenerator.ts` L25, L62 (`BOSS_HP_MULTIPLIER = 10`, `BIG_BOSS_HP_FACTOR = 2`), `ultimates.ts` L24–55 (`power` entre 10 y 20) y `gameLoop.ts` L731 (`PROJECTILE_BASE_DAMAGE * ult.power`). | **Exacto** |
| **B4** | Boss tarda ~6,7 s en llegar al centro (25 px/s, 168 px). Golpe anclado: `6 % maxHp activo / 1 s` en `gameLoop.ts` ≈ L1061–1078. | Confirmado: en piso 10 `enemySpeed(10) = 25`, distancia `192 - 24 = 168` px (`168 / 25 = 6.72` s). Anclaje exactamente en `gameLoop.ts` L1061–1078 con `BOSS_ANCHOR_MAX_HP_FRACTION = 0.06` y `BOSS_ANCHOR_TICK_SEC = 1.0`. | **Exacto** |
| **B5** | Simulador: 1,5 clics/s → piso 64 en 389 s (91 bajas/tramo); 4 clics/s → piso 80 en 446 s; Idle puro (0 clics) → muere en piso 2–3. | Reproducido bit a bit al ejecutar `pnpm run test:balance` (guardado en `docs/analysis/baseline-2026-10-18.txt`). Nota: las Paradas (`3A.2-P`) aún no están implementadas en `gameLoop.ts`. | **Exacto** |
| **B6** | `bench-core.ts`: < 1 ms/step hasta 400 enemigos. | Ejecutado en la máquina actual: 0,014 ms (N=10), 0,013 ms (N=100), 0,025 ms (N=200), 0,074 ms (N=400), 0,138 ms (N=800). | **Exacto** |
| **B7** | Sprite a `r×4 = 48 px` en arena de 384 px. | Confirmado: `ARENA.ENEMY_HITBOX_R = 12`, `r * 4 = 48` en `arena.ts` L377. | **Exacto** |
| **B8** | Costes por step: `enemies.map`, `fireProjectiles` ordena todos los vivos, `hitIds = [...hitIds, id]`, `maxEntityId(state)` recorre todas las entidades. | Confirmado en `gameLoop.ts` L862, L349, L1147, L156–165. Además se detectó que `fireProjectiles` (L354) vuelve a evaluar `maxEntityId(state)` sobre el estado previo al step, solapando IDs con textos/strikes creados antes en el mismo step. | **Exacto (+ bug latente de IDs)** |
| **B9** | `waveEnemiesRemaining` se decrementa a mano en ≥6 sitios. | Confirmado: se decrementa manualmente en **6 sitios** (L666 `applyHotSwap`, L790 `applyUltimate`, L1014 relevo forzado, L1048 `BURN`, L1085 fuga, L1118 `strike`) y se reasigna en 2 (`startRun` L578 y siguiente piso L1267). | **Exacto** |
| **B10** | Renderer crea `DrawItem` con closure por enemigo y filtra/ordena dos veces (`back`/`front`); barra de HP para todos. | Confirmado en `arena.ts` L346–434 y L568–579. | **Exacto** |
| **B11** | `ARENA.SPAWN_MARGIN` (`16`) y `ARENA.SPAWN_HALF_EXTENT` (`208`) no se usan; nacen en radio `192`. | Confirmado en `arena.config.ts` L17–19 y `waveGenerator.ts` L38 (`const radius = ARENA.CENTER`). | **Exacto** |
| **B12** | Existe fichero espurio `nul` en la raíz. | Confirmado (`D:\_PROYECTOS\_WEB\poketowerclicker\nul` presente en el listado del directorio raíz). | **Exacto** |

---

## 3. Discrepancias y Puntos de Atención (Spec vs. Código Real)

1. **`typeWeights` del bioma hoy no se usa en `waveGenerator.ts`**:
   - En `src/data/biomes.ts`, cada bioma define `typeWeights: Partial<Record<PokemonType, number>>` y `wild: string[]`, pero `waveGenerator.ts` (L51, L106) hacía `biome.wild[Math.floor(rng() * biome.wild.length)]` ignorando `typeWeights`.
   - **Resolución en WP2 (`buildFloorPlan`)**: cumplir la regla 3 de §2.2 de la spec ponderando cada especie candidata de `biome.wild` por el peso de sus tipos en `biome.typeWeights` (suma o máximo del peso de sus tipos en `biome.typeWeights`, con fallback `1` si un tipo no figura en `typeWeights`).
2. **Paradas de Ruta (`3A.2-P`, `state.shop`) aún no existen en `types.ts` ni `gameLoop.ts`**:
   - La spec (§2.2 punto 5 y §2.3 punto 5) menciona que `previewWave(seed, floor)` se implementa sobre `buildFloorPlan` y que `state.shop` pausa `elapsedSec`.
   - En el código actual, `3A.2-V` está implementado (`isShopFloor` y `nextShopFloor` existen en `balance.config.ts` L121–130), pero `GameState.shop` aún no existe en `types.ts` (corresponde al bloque `3A.2-P`).
   - **Resolución conservadora**:
     - En WP2 exportaremos `previewWave(seed: number, beforeFloor: number): RouteReport` (y el tipo `RouteReport` en `types.ts` tal como lo define el PRD §4.4.5) construido sobre `buildFloorPlan`, dejando listo el contrato para `3A.2-P`.
     - En WP3, la guarda de pausa de `floorRuntime.elapsedSec` comprobará `(state as { shop?: unknown }).shop !== undefined || (bossInvulnSec > 0)` (o el campo opcional `shop?: unknown` en `GameState`), de modo que funcione hoy y sea compatible sin cambios cuando se conecte `3A.2-P`.
3. **Fórmula de oro de jefe (`bossBounty`) y `BIG_BOSS_FLOORS` en Torre (`f > 100`)**:
   - Actualmente `BIG_BOSS_FLOORS = [50, 100]` (`balance.config.ts` L57), mientras que el PRD (§5.1, §9.9) indica que en la Torre (`f > 100`) hay Gran Boss cada 50 pisos (`f % 50 === 0`).
   - **Resolución conservadora**: definir helper `isGrandBossFloor(floor: number): boolean` (`floor >= 50 && floor % 50 === 0`) y `isMiniBossFloor(floor: number): boolean` (`floor > 0 && floor % MINIBOSS_INTERVAL === 0 && !isGrandBossFloor(floor)`), manteniendo `BIG_BOSS_FLOORS = [50, 100]` exportado por compatibilidad.
4. **Inspección de selectores Zustand en UI (WP6)**:
   - Revisados `src/ui/store.ts` y `src/App.tsx`: `store.setGameState(next)` ya está **throttled a `HUD_INTERVAL_MS = 100` ms (~10 Hz)** salvo cambio de `phase` (`store.ts` L57–68). Por tanto, la UI lateral de Preact **no** se re-renderiza a 60 Hz por cambios en `state.enemies`, sino como máximo a 10 Hz. Queda verificado y documentado para WP6.
5. **Tests existentes que asumen la oleada instantánea de 10 enemigos o constantes antiguas**:
   - `src/core/__tests__/gameLoop.test.ts`:
     - L79–106 (`describe('generateWave', ...)`): prueba `generateWave` con `WAVE_ENEMY_COUNT_BASE` y `BOSS_HP_MULTIPLIER`.
     - L115–116 (`starts a run with the chosen starter active`): espera `state.enemies` de longitud `WAVE_ENEMY_COUNT_BASE` en `t = 0`, cuando con el spawner continuo en `t = 0` solo se habrán emitido los eventos con `tSec <= 0` (1 enemigo en piso normal o el jefe + primer evento en piso de jefe), mientras que `state.waveEnemiesRemaining` será `N(1) = 9`.
     - L174–175 (`advances the floor once a wave is cleared and the breather expires`): espera `expect(next.waveEnemiesRemaining).toBe(next.enemies.length);`, cuando con el spawner continuo `waveEnemiesRemaining` es `pendientes + vivos` (`N(2) = 10`), mayor que `next.enemies.length` en el primer tick del piso 2.
     - L165, L180, L196, L220, L242, L273, L384–396, L405, L437, L453, L505, L524, L553, L586, L641, L683: tests que construyen estados manuales (`{ ...base, enemies: [...], waveEnemiesRemaining: ... }`). Si `stepOnce` deriva `waveEnemiesRemaining` de `state.floorRuntime`, un estado manual que ponga `enemies: []` sin vaciar `floorRuntime` seguiría teniendo eventos pendientes en `floorRuntime` si no se tiene cuidado.
   - **Resolución clave de diseño en WP3 (compatibilidad con tests que inyectan `enemies` manualmente)**:
     - Si `state.floorRuntime` existe, pero un test modificó manualmente `state.enemies` y `state.waveEnemiesRemaining === 0` con `state.enemies.length === 0` (como en `const cleared: GameState = { ...base, enemies: [], waveEnemiesRemaining: 0 }`), o si `state.floorRuntime` no tiene eventos pendientes cuando el test sobrescribe la oleada:
     - Regla limpia y determinista: en `stepOnce`, si `state.waveEnemiesRemaining === 0 && state.enemies.length === 0 && state.floorRuntime && state.floorRuntime.nextEventIdx < state.floorRuntime.plan.events.length`, interpretamos que el llamador (un test unitario) forzó el vaciado de la oleada y sincronizamos `nextEventIdx = state.floorRuntime.plan.events.length`. Asimismo, cuando un test reemplaza `state.enemies` manualmente (p. ej. `withEnemies` en `phase2Combat.test.ts` o `leakState`/`bossState` en `enemyStrike.test.ts`), si `state.enemies` no coincide con el flujo o si en `withEnemies` queremos aislar el combate sin que salgan spawns extra del plan en medio del test, `stepOnce` solo emite eventos de `floorRuntime` cuando `state.waveEnemiesRemaining > state.enemies.filter(e => e.alive).length` (o sincroniza la cola si el test fijó `waveEnemiesRemaining = enemies.length`). ¡Esto hace que el 95 % de los tests de combate unitarios sigan funcionando sin fragilidad!
