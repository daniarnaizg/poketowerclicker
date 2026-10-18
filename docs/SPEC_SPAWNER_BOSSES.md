# SPEC — Spawner continuo, ritmo de piso y Jefes por fases (PRD v2.5 → v2.6)

| | |
| :--- | :--- |
| **Destinatarios** | Agentes implementadores (código, tests, simulador) y agente de documentación (PRD) |
| **Fecha / base** | 18-oct-2026 · repo en el estado del zip `poketowerclicker` (rama `develop`, PRD v2.5) |
| **Ubicación sugerida en el repo** | `docs/SPEC_SPAWNER_BOSSES.md` (y `scripts/bench-core.ts`, adjunto) |
| **Alcance** | Cambia el modelo de oleadas, la duración de un piso, la economía por piso, las fugas y los jefes. **No** toca Gacha, Runas, Sinergias ni Climas. |

> **Convenciones.** Los valores marcados *(ajustable)* son hipótesis de partida que **deben calibrarse con el simulador (WP7)**; lo que es **invariante** está marcado como tal y se valida con tests. Toda constante vive en `src/config/balance.config.ts`. El núcleo sigue siendo TypeScript puro y determinista (PRD §6.2, §9.1.1).

---

## 0. Resumen ejecutivo

Hoy el juego es muy corto y plano: un piso dura ~6 s, la oleada son 10 enemigos que aparecen a la vez en el mismo anillo y llegan a la vez, cualquier enemigo muere de un impacto hasta el piso ~20, y los jefes (~200 HP en el piso 10) mueren de una definitiva (600–1.200 de daño base) antes de llegar al centro. El autor quiere:

1. **Más enemigos, en flujo continuo**, para que el gameplay sea satisfactorio y exija habilidad (clics, decisiones, relevos).
2. **Pisos de ~1 minuto** (más para pisos exigentes) con un arco de dificultad: *duro al principio (sin inversión) → dominio en la fase media (destruyes cada oleada) → falta de daño y cada clic cuenta → la run termina*. Una build fuerte (Pokémon potentes, pasivas activas) acorta la fase dura inicial.
3. **Jefes mucho más duros y peligrosos**: más HP, ataques más frecuentes/fuertes, y **una definitiva nunca debe matarlos de golpe en una run normal**.
4. Aceptar que esto tensiona la filosofía *idle*; las mecánicas que la sostengan se diseñan después (ver §9, fuera de alcance).

### Decisiones de diseño (nuevas, a registrar en PRD §9.10 como D20–D28)

| # | Decisión |
| :--- | :--- |
| **D20** | Una oleada deja de ser un pulso de 10 enemigos. Cada piso normal es un **flujo de `N(f)` enemigos repartido en una ventana de `S(f)` segundos**, descrito por un **plan puro** `buildFloorPlan(seed, floor)`. |
| **D21** | Existe un **tope de enemigos vivos simultáneos `ALIVE_CAP`** (arena 384 px, sprites a 48 px). Los spawns que exceden el tope **se retienen en cola**, no se descartan. Más allá del tope, la dificultad escala por HP/daño/densidad de ventana, **nunca** por cantidad ilimitada. |
| **D22** | **Duración objetivo**: piso normal ≈ **60 s** (ventana de spawn 40–55 s + cola de limpieza). **Pisos exigentes** (`f % 5 === 4`: 4, 9, 14, 19… justo antes de Parada y de Jefe) ≈ **75–95 s**. Una run de 100 pisos ≈ 1,7–2 h. |
| **D23** | **El ingreso por piso `W(f)` es el invariante económico**, no el oro por enemigo. `oro por enemigo = W(f) / N(f)`. Los precios de Parada y los fugitivos siguen expresados en `W`. |
| **D24** | Las fugas se calibran **como fracción de la horda**, no como número absoluto de fugas (sustituye al invariante "≈7 fugas" de §4.4.2). |
| **D25** | **HP de jefe por tiempo objetivo de muerte (TTK)**, no por múltiplo `×10` del enemigo normal. |
| **D26** | **Todos los jefes tienen 3 fases (umbrales 66 % / 33 %)** con **recorte de HP al umbral** e invulnerabilidad breve. Esto garantiza que ningún golpe (definitiva incluida) salte más de una fase. Generaliza §9.5 (hoy solo pisos 50/100). |
| **D27** | **Cada fase endurece al jefe** (golpes más rápidos y fuertes) e **invoca adds** a través del spawner. El jefe ya no es un saco de HP que camina. |
| **D28** | **Modo de fin por reloj de jefe configurable**: `BOSS_TIMER_MODE: 'gameover' \| 'enrage'`. **Por defecto `'enrage'`** (al agotarse el reloj el jefe enfurece; la run solo termina por `teamWiped`). Pendiente de confirmación final del autor; implementar detrás del flag para que cambiarlo sea una línea. |

---

## 1. Estado verificado (baseline, `HEAD` del zip)

Medido leyendo el código y ejecutando `pnpm run test:balance` y `scripts/bench-core.ts`.

| # | Hallazgo | Dónde |
| :--- | :--- | :--- |
| B1 | La oleada se genera **de golpe**: 10 enemigos en el anillo de radio 192 a velocidad homogénea → llegan sincronizados. | `waveGenerator.ts` `generateWave`; `balance.config.ts` `WAVE_ENEMY_COUNT_BASE` |
| B2 | `enemyHp(f) = 10·1,085^(f-1)` (10 HP en piso 1, 20 en piso 10, 47 en piso 20) frente a `PROJECTILE_BASE_DAMAGE = 60`: cada enemigo muere de **un** impacto hasta ~piso 20. | `balance.config.ts` |
| B3 | Boss = `enemyHp × 10` (×2 si Gran Boss). Piso 10 ≈ **200 HP**. Las definitivas hacen `60 × power` con `power` 10–20 ⇒ **600–1.200 base** (antes de nivel/mejoras). Un boss del piso 10 muere de una definitiva con margen ×3–6. | `waveGenerator.ts`, `data/ultimates.ts` |
| B4 | El boss tarda ~6,7 s en llegar al centro (25 px/s, 168 px) y casi nunca llega a golpear. Golpe anclado: `6 % maxHp activo / 1 s`. | `gameLoop.ts` ≈ L1061–1078 |
| B5 | Simulador, 1,5 clics/s: **piso 64 en 389 s, exactamente 91 bajas por tramo de 10 pisos (0 fugas)**; 4 clics/s: piso 80 en 446 s. Idle puro (0 clics, solo starter): muere en el piso 2–3 (el PRD da D3 por resuelto; hay que revisarlo, aunque las Paradas aún no existen). | `scripts/sim-balance.ts` |
| B6 | Core: `tickGame` con N enemigos inmortales casi inmóviles (Node 22, pocos proyectiles): **~0,08 ms/step con 10, ~0,2 con 100, ~0,4 con 200, <1 ms con 400** (ruido de JIT; usar como orden de magnitud). **No incluye renderer ni UI.** Cota inferior. | `scripts/bench-core.ts` |
| B7 | Límite geométrico/visual: sprite a `r×4 = 48 px` en arena de 384 px ⇒ ~50 sin solaparse, 60–80 legibles. (Estimación, no medida.) | `renderer/arena.ts`, `arena.config.ts` |
| B8 | Patrones de coste por tick/enemigo: `enemies.map(e => ({...e}))` en cada step; `fireProjectiles` ordena **todos** los vivos cada step para quedarse con ≤5; colisión proyectil×enemigo O(P·E) con `hitIds = [...hitIds, id]`; `maxEntityId(state)` recorre todas las entidades en cada creación; un `floatingText` por impacto y otro por baja. | `gameLoop.ts` |
| B9 | `waveEnemiesRemaining` se decrementa a mano en **≥6 sitios** (tick de quemadura, strike, fuga, definitiva, burst de relevo…): frágil al introducir spawns diferidos. | `gameLoop.ts` |
| B10 | Renderer: por frame y por enemigo se crea un `DrawItem` con closure; se filtra y ordena dos veces (capas `back`/`front`); barra de HP para **todos** los enemigos. | `renderer/arena.ts` `enemyItems`, `render` |
| B11 | `ARENA.SPAWN_MARGIN` no se usa: los enemigos nacen **dentro** del borde (radio 192) y "aparecen" en vez de entrar. | `arena.config.ts` (A13 del PRD) |
| B12 | Existe un fichero espurio `nul` en la raíz (artefacto de Windows). Eliminar y añadir a `.gitignore`. | raíz del repo |

> Antes de empezar: ejecutar `pnpm test`, `pnpm run test:balance` y `pnpm run bench:core` y **guardar la salida** en `docs/analysis/baseline-2026-10-18.txt`. Es la referencia para el "antes/después".

---

## 2. Modelo de ritmo y spawner

### 2.1. Parámetros por piso *(todos ajustables; viven en `balance.config.ts`)*

```ts
// Enemigos totales del piso normal
N(f) = clamp(round(8 + 1.0 * f), 9, 110)          // f=1→9, 10→18, 50→58, 100→108
// Ventana de spawn (s)
S(f) = min(55, 40 + 0.15 * f)                     // 40 s → 55 s
// Piso exigente: f % 5 === 4 (y no es piso de jefe)
N_hard = round(N * 1.4);  S_hard = S * 1.5;       // ≈ 75–85 s totales
// Tope de vivos
ALIVE_CAP = 70
// Pisos de jefe: flujo ligero de relleno mientras dura el combate (ver §4.5)
N_boss_trickle = round(0.4 * N(f))
```

- **Pisos 1–3 son de tutorial**: `N = 9, 10, 11` y velocidad de enemigo reducida un 20 %. La primera run (un solo Pokémon, ver §2.4) debe poder entenderlo sin morir.
- **Torre (f > 100)**: `N` se queda en el máximo (110). La presión sube por HP/daño y acortando la ventana: `S(f) = max(35, 55 − 0.1·(f − 100))`, más variantes élite (opcional, §9). **Nunca** por encima de `ALIVE_CAP`.
- **Mutador "Horda" (§9.9)**: se redefine como `N ×1,5` y `HP ×0,7`, **respetando `ALIVE_CAP`**.

### 2.2. Plan de piso (función pura) — nuevo `src/core/floorPlan.ts`

```ts
export type SpawnTier = 'normal' | 'add';          // 'elite' queda reservado (§9)
export interface SpawnEvent {
  index: number;          // 0..N-1, contiguo; fija el orden de consumo del RNG
  tSec: number;           // instante objetivo (desde el inicio del piso)
  angle: number;          // radianes
  defId: string;          // EnemyDefinition.id
  tier: SpawnTier;
}
export type FloorKind = 'normal' | 'hard' | 'miniboss' | 'grandboss';
export interface FloorPlan {
  floor: number;
  kind: FloorKind;
  totalEnemies: number;       // excluye al jefe
  spawnWindowSec: number;
  events: readonly SpawnEvent[];   // ordenados por tSec
}
export function buildFloorPlan(seed: number, floor: number): FloorPlan;  // PURA
```

**Reglas (invariantes, con test):**

1. **Pura y determinista** por `(seed, floor)` usando el canal `WAVE` (`rngFor(seed, 'WAVE', floor)`). **Todas** las tiradas del plan se consumen al construirlo, en orden de `index`; nada que dependa del jugador (clics, relevos, retrasos por cola) altera el plan. Misma `seed` ⇒ mismo `FloorPlan` `deepEqual`.
2. **Distribución temporal**: `tSec_i = S · (i / N)^0.85` (leve crescendo). Pisos exigentes: 2–3 ráfagas (`shape` interno, p. ej. 3 grupos separados por `S/3`) en lugar de continuo.
3. **Ángulos estratificados**: secuencia de ángulo áureo + jitter ±15°, para que no se agrupen aleatoriamente en un lado. El tipo/especie sigue los `typeWeights` del bioma (`biomes.ts`).
4. **Posición de nacimiento**: radio `ARENA.SPAWN_HALF_EXTENT` (208, fuera del borde visible) en lugar de 192; usar el `SPAWN_MARGIN` hoy sin uso (B11).
5. **`previewWave(seed, floor)`** (Informe de Ruta, PRD §4.4.4, bloque 3A.2-P) se implementa **sobre `buildFloorPlan`**: tipos dominantes del bloque de 10 pisos y datos del jefe de `beforeFloor + 5`.
6. Adds de jefe (§4.5): sub-flujo determinista `(seed, 'WAVE', floor, salt = fase)`. Extender `rngFor` con `salt` opcional si no lo admite (comprobar `src/core/rng.ts`).

### 2.3. Integración en `gameLoop.ts`

Estado nuevo (`types.ts`):

```ts
interface FloorRuntime {
  plan: FloorPlan;
  nextEventIdx: number;      // puntero al siguiente SpawnEvent por emitir
  elapsedSec: number;        // tiempo transcurrido del piso (se pausa en Parada y en invulnerabilidad de jefe)
}
// GameState:
//   floorRuntime?: FloorRuntime
//   nextEntityId: number           // reemplaza maxEntityId(state)+1 en caliente (B8)
```

Reglas de `stepOnce`:

1. Cada step: `elapsedSec += dt`; mientras `plan.events[nextEventIdx].tSec <= elapsedSec` **y** `aliveCount < ALIVE_CAP`: emitir el enemigo (misma lógica que `spawnEnemyAt`), `nextEventIdx++`. Si se alcanza el tope, **los eventos pendientes esperan** (no se pierden ni se reordenan).
2. **`waveEnemiesRemaining` pasa a ser un valor derivado**: `(events.length − nextEventIdx) + vivos no-jefe` (más 1 si hay jefe vivo). **Eliminar** los decrementos manuales dispersos (B9); mantener el campo en `GameState` solo como espejo calculado al final del step para no romper la UI/tests.
3. **Fin de piso** = cola vacía **y** ningún enemigo vivo (los fugitivos de §9.6 seguirán excluidos). Entonces entra el respiro de `INTER_WAVE_BREAK_SEC` (2,75 s, sin cambios) y, si procede, la Parada.
4. `startRun` y el spawn de la siguiente oleada (sección 7 del tick) dejan de llamar a `generateWave`: construyen el `FloorPlan` y reinician `floorRuntime`. `generateWave` se elimina (o queda como wrapper obsoleto solo si algún test lo exige; preferible migrar los tests).
5. Las Paradas (`state.shop`) y la invulnerabilidad de fase de jefe **pausan `elapsedSec`**.
6. Piso de jefe: el jefe sale en `t = 0` y el flujo ligero (§4.5) usa el mismo mecanismo de cola.

### 2.4. Primera run (1 Pokémon) y listón del arco de dificultad

El arco pedido se formaliza como **cuatro zonas relativas** al piso final `F_end` de cada perfil del simulador:

| Zona | Rango | Qué debe sentirse | Métricas objetivo (perfil "intermedio", calibrar) |
| :--- | :--- | :--- | :--- |
| **A · Tensión** | `1 … 0,15·F_end` | Cuesta: casi no hay inversión. Un equipo fuerte o con pasivas activas la acorta. | fuga `φ` 5–20 %; cola de limpieza 10–25 s; duración de piso 55–80 s |
| **B · Dominio** | `0,15 … 0,55·F_end` | "Destruyes cada oleada". | `φ ≤ 3 %`; cola ≤ 5 s; duración ≈ ventana de spawn (45–65 s) |
| **C · Presión** | `0,55 … 0,85·F_end` | Falta daño; cada clic y decisión cuenta. | `φ` sube de 3 % a 15 %; cola 5→25 s; **el bot de 4 clics/s llega ≥ +15 % pisos más lejos que el de 0 clics con la misma build** |
| **D · Colapso** | `> 0,85·F_end` | Se acumulan fugas, cae el primer Pokémon, la run termina. | `φ > 25 %`; tras el primer KO, fin de run en ≤ 2 bloques con prob. ≤ 60 % (criterio 4 existente) |

`φ` = bajas por fuga / enemigos totales del piso. Con build fuerte (equipo 3★–4★), `φ` en los pisos 1–5 debe ser ≤ 5 % (la zona A se acorta).

**Los hitos por perfil de §9.1.5 (criterio 5) se conservan como punto de partida pero deben revalidarse**: con pisos 10× más largos, "idle puro supera la Parada del piso 5 y abate al jefe del 10" implica ~10 minutos de run; el autor ha aceptado un inicio duro, así que se admite relajar el hito idle a *"supera la Parada del piso 5"* si el simulador demuestra que lo contrario obliga a trivializar la zona A. Documentar la decisión en el PRD.

---

## 3. Economía y fugas

### 3.1. Oro (D23)

```ts
// balance.config.ts
floorGoldIncome(f) = 10 * enemyGoldValue(f)        // = W(f); misma definición numérica que hoy
goldPerEnemy(f)    = floorGoldIncome(f) / N(f)     // enemigos del flujo; adds de jefe pagan 0
bossBounty(f)      = 1.0 * W(f)  (mini)  |  2.0 * W(f)  (gran boss)   // equivale al valor actual
```

- **Invariante (test)**: sumando el oro de **todos** los enemigos del flujo de un piso normal (sin jefe, sin `UP_GOLD`), el resultado está en `W(f) ± 2 %` (redondeos).
- **No** aumentar el oro por enemigo "para que se note": la sensación de recompensa se da con feedback (§6), no con inflación. Los precios de Parada (`HEAL_*`, `REVIVE_ONE`) no cambian de fórmula.
- Efecto colateral aceptado: el ingreso **por segundo** cae ~10× al alargar los pisos. El progreso del jugador se mide por piso, y los costes (`teamLevelCost`, `upgradeCost`) están indexados por nivel, no por tiempo; el simulador calibra la relación `W(f)` ↔ costes. Si en el playtest el ritmo de compras se siente lento, **primero** ajustar costes, no `W`.

### 3.2. HP de enemigo (punto de partida)

- Hits-to-kill objetivo de un enemigo normal: **2–3 impactos** de un starter sin mejoras en el piso 1 → `enemyHp(1) ≈ 2,5 × daño por impacto del starter` (medirlo en el simulador; hoy 10 HP vs 60 de daño). El crecimiento exponencial por piso se recalibra en WP7 para producir el arco de §2.4.
- AoE/perforación/rebote deben producir **multi-bajas** visibles en la zona B (es lo que da la sensación de "destruyo la oleada").

### 3.3. Fugas (D24)

Sustituye el invariante "≈7 fugas neutrales abaten al Pokémon de `hpFactor = 1,0`" (§4.4.2) por:

```ts
// invariante: LEAK_KILL_FRACTION de la horda del piso, filtrada neutral, abate a un Pokémon de hpFactor 1.0 con HP lleno
leakDamage(f) = maxHpRef(f) / (LEAK_KILL_FRACTION * N(f))
LEAK_KILL_FRACTION = 0.30  (ajustable)
maxHpRef(f) = HP_BASE * (1 + (EXPECTED_TEAM_LEVEL(f) - 1) * HP_LEVEL_SCALE)
EXPECTED_TEAM_LEVEL(f) = tabla en balance.config.ts, rellenada con la mediana del perfil "intermedio" del simulador
```

`leakDamageForFloor` pasa a calcularse así. El invariante anti-carry de §9.1.5 ("daño esperado por bloque de 10 pisos ≈ 1,2–1,6× `maxHp` del Pokémon medio") se mantiene y se **mide en el simulador**, no se asume.

---

## 4. Jefes

### 4.1. HP por TTK (D25)

```ts
bossHp(f) = BOSS_POOL_FACTOR * N(f) * enemyHp(f)
BOSS_POOL_FACTOR = 0.6 (miniboss) | 1.2 (grandboss)      // ajustable
```

Se calibra para cumplir, con el perfil "intermedio" (auto-disparo + 1,5 clics/s + definitiva cuando está lista) **en el piso del jefe**:

| Tipo | TTK objetivo (mediana) | Timer actual (P5) |
| :--- | :--- | :--- |
| Mini-Boss | 15–20 s | 30 s |
| Gran Boss 50 | 25–30 s | 45 s |
| Gran Boss 100 | 40–45 s | 60 s |

TTK ≤ ~60 % del timer. El factor de HP por especie (`EnemyDefinition.hpFactor`) se mantiene como modificador.

### 4.2. Fases con recorte de HP (D26) — **invariante anti-one-shot**

- Umbrales fijos: **66 % y 33 %** del `maxHp` (los Grandes Bosses 50/100 mantienen **además** su cambio de tipos por fase de §9.5; los umbrales de 100 % pueden diferir ahí: aplicar los de `BossPhaseDef` si existen, si no 66/33).
- **Recorte**: si un daño cruzaría un umbral, el HP del jefe se fija **en el umbral** (el exceso se descarta). Debe cubrir **todas** las vías de daño: impacto de proyectil, splash, quemadura (hoy modifica `enemy.hp` directamente en el tick), definitiva, burst de relevo. **Refactor requerido**: centralizar el daño a enemigos en una única función `applyDamageToEnemy(enemy, amount, ...)` y usarla en todos los sitios (hoy hay accesos directos a `enemy.hp`).
- **Transición**: 1,5 s de **invulnerabilidad**, con el temporizador de jefe **en pausa**, sin golpes al Pokémon activo y sin avance de `floorRuntime.elapsedSec`. Banner de fase.
- **Invariante (test)**: para cualquier jefe y para un equipo extremo (p. ej. `UP_ARROW = 50`, nivel de equipo ×2 sobre la curva), **ninguna instancia de daño reduce al jefe más de una fase**; en particular una definitiva nunca lo mata desde fase 1 ni desde fase 2.
- **Criterio de calibración (simulador)**: en perfil intermedio, una definitiva quita **≤ 25 % del `maxHp` del jefe (mediana) y ≤ 40 % (p95, con crítico)**; el jefe vive ≥ 8 s (mini) / ≥ 15 s (gran) en perfil intermedio.

### 4.3. Escalado por fase *(ajustable)*

| Fase | Golpe anclado (`× maxHp` del activo) | Intervalo | DPS aprox. (% maxHp/s) | Adds al entrar |
| :--- | :--- | :--- | :--- | :--- |
| 1 (100–66 %) | 5 % | 1,00 s | 5,0 | — |
| 2 (66–33 %) | 7 % | 0,85 s | 8,2 | `ADDS_PER_PHASE` (6) |
| 3 (33–0 %) | 9 % | 0,70 s | 12,9 | `ADDS_PER_PHASE` (8) |

- Sigue aplicándose `getEffectiveness`, mitigación y escudo 3★ (PRD §4.4.2).
- Constantes en `balance.config.ts`: `BOSS_PHASE_ANCHOR_FRACTION = [0.05, 0.07, 0.09]`, `BOSS_PHASE_ANCHOR_TICK_SEC = [1.0, 0.85, 0.7]`, `BOSS_PHASE_ADDS = [0, 6, 8]`. `BOSS_ANCHOR_MAX_HP_FRACTION` y `BOSS_ANCHOR_TICK_SEC` actuales pasan a ser el valor de la fase 1 (compat).
- **Criterio de calibración**: un combate de jefe en perfil intermedio cuesta **0,5–1,0 × el `maxHp` medio del Pokémon** en total, y **un jefe ignorado (CARRY, sin relevo) mata al activo en < 10 s en fase 3**. Si el carry único aguanta el combate entero, subir las fracciones.

### 4.4. Adds

- Salen por el **mismo spawner** (cola, tope de vivos, `salt` de RNG por fase). `tier: 'add'`, **pagan 0 de oro** (el botín del jefe es el `bossBounty`), HP = `enemyHp(f)`, hacen daño de fuga normal si llegan.
- Al morir el jefe, los adds vivos **desaparecen** sin penalización y sin pago.
- Respetan `ALIVE_CAP`; si el tope está lleno, esperan.

### 4.5. Flujo ligero durante el combate de jefe

Durante un piso de jefe sale además un flujo ligero `N_boss_trickle = 0,4·N(f)` repartido en la ventana, con oro `W·0,15` en total. Motivo: la arena no debe quedar vacía durante los ~6–7 s de aproximación (ventana de daño gratis) y obliga a **priorizar objetivo** (el auto-disparo apunta al más cercano; el clic manual decide si es jefe o add). Si el playtest lo desaconseja, se desactiva con `BOSS_TRICKLE_ENABLED = false` sin tocar nada más.

### 4.6. Reloj de jefe (D28)

```ts
BOSS_TIMER_MODE: 'gameover' | 'enrage' = 'enrage'   // ajustable
```

- `'gameover'`: comportamiento actual (`defeatCause = 'bossTimerExpired'`).
- `'enrage'`: al llegar a 0, el jefe pasa a *enfurecido*: `daño ×1,5` cada 10 s adicionales, sin tope. La run termina solo por `teamWiped`. `bossTimerExpired` se mantiene en tipos y `RunStats` para el modo `'gameover'`.
- Los timers 30/45/60 s (P5) se **conservan** como hipótesis; revisar tras la calibración (los jefes ahora duran más y las fases pausan el reloj ~3 s).

---

## 5. Rendimiento y legibilidad (WP6)

**Antes de optimizar, medir** (`scripts/bench-core.ts` adjunto; añadir `"bench:core": "tsx scripts/bench-core.ts"` a `package.json`). Presupuestos objetivo:

| Capa | Presupuesto | Cómo medirlo |
| :--- | :--- | :--- |
| Core | ≤ 1 ms/step con 100 enemigos vivos **y** proyectiles realistas (≥ 30 vivos), 5 jefes anclados incluidos | `bench:core` ampliado con splash/rebote/definitivas |
| Renderer | 60 fps sostenidos con `ALIVE_CAP` enemigos + 100 proyectiles + efectos en un móvil de gama media | Chrome Performance / Android remote debugging |
| UI | Sin re-render por frame del panel lateral por cambio del array `enemies` | React/Preact DevTools Profiler (no verificado en esta auditoría: **comprobar** los selectores de Zustand) |

Lista de trabajo (por prioridad; **aplicar solo lo que el benchmark justifique** salvo los marcados ★, que son necesarios por diseño):

1. ★ **`nextEntityId` en el estado** en lugar de `maxEntityId(state)` (recorre enemigos+proyectiles+textos+efectos en cada creación).
2. ★ **Textos flotantes**: agrupar. Un número de daño por enemigo cada ≥ 0,15 s (acumulado); críticos y bajas de élite/jefe siempre; **un único "+oro" agregado** cada 0,25 s en vez de uno por baja; tope de 40 textos vivos y de 60 efectos `IMPACT`.
3. ★ **Renderer en un solo pase**: una lista de draw-items reutilizable (sin closures por frame), un único ordenado por `y`, capas `back/front` por marca, no por doble filtrado. **Barra de HP solo** si el enemigo está dañado, es jefe o está a < 100 px del centro.
4. `fireProjectiles`: selección de los `k ≤ 5` más cercanos al centro en O(E·k) en vez de ordenar todos (B8).
5. Colisión proyectil×enemigo: rejilla espacial de 32 px (solo si `E > 40`); sustituir `hitIds = [...hitIds, id]` por mutación in-place / `Set` pequeño.
6. Clonado por step: clonar `enemies` **una vez por `tickGame`** (no por `stepOnce`) y mutar dentro del lote de steps; mantener la salida inmutable a ojos de la UI. Hacerlo solo si (4–5) no bastan; cuidado con los tests de determinismo.
7. Sprites: confirmar que `getSprite` cachea por especie y que `drawShadow` no crea gradientes por frame.

**Legibilidad**: con ~50+ vivos la densidad cerca del centro es alta. Reglas: sombra más tenue en `E > 40`, no dibujar "walk" animado a más de 20 Hz de frame de sprite, y aislar visualmente al jefe (anillo/escala). Esto es un ajuste de arte, no de simulación.

---

## 6. Feedback de "satisfacción" (mínimo, sin inflar oro)

Alcance acotado; priorizar solo lo que no cuesta rendimiento:

- Multi-baja visible (efecto agregado "x5" cuando un solo impacto/AoE mata ≥ 3).
- Monedas agrupadas al centro (ver 5.2) y contador de racha de bajas con decaimiento de 2 s (solo visual; **no** afecta a daño ni a oro).
- Sacudida breve del arena en definitiva y en cambio de fase de jefe (desactivable en opciones).

Cualquier *combo* con efecto en el cálculo (daño/oro por racha) queda **fuera de alcance** hasta tener el simulador v3 (rompería el determinismo de `RunProof` si no se modela).

---

## 7. Plan de trabajo (work packages)

Dependencias: `WP0 ∥ WP1 → WP2 → WP3 → (WP4 ∥ WP5) → WP6 → WP7`. `WP6.baseline` (medir) va **antes** de WP3. `3A.2-P` (Paradas) puede avanzar en paralelo **una vez WP4 fije `W(f)`** (los precios dependen de `W`).

### WP0 — Documentación y PRD v2.6 *(agente de documentación)*
- [ ] Aplicar la lista de ediciones de §8 al `PRD.md` y subir a **v2.6**.
- [ ] Copiar este documento a `docs/SPEC_SPAWNER_BOSSES.md`.
- [ ] Higiene: borrar `nul` de la raíz y añadirlo a `.gitignore` (B12).
- [ ] Guardar baseline (`docs/analysis/baseline-2026-10-18.txt`).

### WP1 — Config y tipos
- [ ] `balance.config.ts`: `ALIVE_CAP`, `N(f)`, `S(f)`, `HARD_FLOOR_*`, `floorGoldIncome`, `goldPerEnemy`, `bossHp`, `BOSS_POOL_FACTOR`, `BOSS_PHASE_*`, `BOSS_TIMER_MODE`, `LEAK_KILL_FRACTION`, `EXPECTED_TEAM_LEVEL`, `BOSS_TRICKLE_ENABLED`. Retirar `WAVE_ENEMY_COUNT_BASE` y `BOSS_HP_MULTIPLIER` (o dejarlos deprecados con comentario y sin uso).
- [ ] `types.ts`: `SpawnEvent`, `FloorPlan`, `FloorRuntime`, estado de fase de jefe (`bossPhase`, `bossInvulnSec`, `enraged`), `nextEntityId`.

### WP2 — `floorPlan.ts` + tests unitarios
- [ ] `buildFloorPlan` según §2.2; ángulos estratificados; ráfagas en pisos exigentes; pisos de jefe (jefe en `t=0` + flujo ligero).
- [ ] Tests: determinismo (misma seed, distinto input), `events.length === N(f)`, `index` contiguo, orden por `tSec`, `tSec ≤ S(f)`, cobertura angular (ningún sector de 60° vacío con `N ≥ 18`), `previewWave` coherente con el plan.

### WP3 — Integración en el bucle
- [ ] Cola de spawn con tope de vivos; `waveEnemiesRemaining` derivado (§2.3.2); fin de piso (§2.3.3); `startRun`/siguiente piso; pausa de `elapsedSec` en Parada/invulnerabilidad; spawn en `SPAWN_HALF_EXTENT`.
- [ ] Migrar tests que asuman "10 enemigos de golpe" (`gameLoop.test.ts`, `phase2Combat.test.ts`, `enemyStrike.test.ts`, `phase2Contract.test.ts` y los que fallen). Ejecutar `pnpm test` y arreglar sin bajar el nivel de las aserciones.
- [ ] Tests nuevos: tope de vivos nunca superado en 10.000 ticks; la cola retiene y reanuda sin perder eventos; `remaining === (pendientes + vivos)` en todo momento.

### WP4 — Economía y fugas
- [ ] Oro por enemigo según §3.1; `bossBounty`; test `Σ oro de piso ≈ W(f) ± 2 %`.
- [ ] `leakDamageForFloor` según §3.3; rehacer `EXPECTED_TEAM_LEVEL` con la salida del simulador.
- [ ] `HP de enemigo` recalibrado a 2–3 impactos en el piso 1 (§3.2).

### WP5 — Jefes
- [ ] Refactor `applyDamageToEnemy` único (incluye quemadura, splash, definitiva, burst de relevo).
- [ ] Fases 66/33 con recorte, invulnerabilidad 1,5 s con reloj en pausa, banner de fase.
- [ ] Escalado por fase (§4.3), adds por el spawner (§4.4), flujo ligero (§4.5), `BOSS_TIMER_MODE` (§4.6).
- [ ] **Tests**: (a) equipo extremo ⇒ ninguna instancia de daño salta una fase; (b) durante la invulnerabilidad: sin daño, reloj en pausa, sin golpes al activo; (c) adds respetan `ALIVE_CAP` y no pagan oro; (d) al morir el jefe los adds desaparecen; (e) modo `'enrage'`: la run no termina por reloj y el daño crece cada 10 s.
- [ ] Actualizar `UP`/UI de jefe: barra de HP con marcas en 66/33 y chip de fase.

### WP6 — Rendimiento y legibilidad
- [ ] `WP6.baseline`: añadir `bench:core` al `package.json`, ejecutarlo y guardar salida (antes de WP3).
- [ ] Aplicar §5 (★ primero), re-medir y comparar con el baseline; registrar en `docs/analysis/`.

### WP7 — Simulador v3 (redefine y absorbe `3A.2-S`)
- [ ] Bots: los de §9.1.5 (`NO_SHOP`, `HEAL_FIRST`, `REVIVE_FIRST`, `SMART`, `CARRY`, `ROTATE`) más un bot de clics con puntería que respete el tope de cadencia.
- [ ] **Nuevas métricas por piso y zona**: duración de piso, cola de limpieza, `φ`, bajas por clic vs por auto-disparo, TTK de jefe, % de `maxHp` de jefe quitado por definitiva, daño total a Pokémon por combate de jefe, `aliveCount` máximo.
- [ ] Calibrar `N(f)`, `S(f)`, `enemyHp`, `enemyGoldValue`, `HP_BASE`, `HP_LEVEL_SCALE`, `LEAK_KILL_FRACTION`, `BOSS_POOL_FACTOR`, costes y fracciones de fase **hasta cumplir los criterios de §7.1**.

### 7.1. Criterios de aceptación (se añaden a los 7 de §9.1.5)

1. **Arco por zonas** (§2.4): el perfil intermedio cumple las métricas de A, B, C y D.
2. **Duración**: mediana de piso normal 50–70 s en zona B; pisos exigentes 75–95 s; run de 100 pisos del perfil máximo ≤ ~2,2 h.
3. **Clic importa**: en zona C, 4 clics/s ≥ **+15 %** de pisos que 0 clics con la misma build.
4. **Anti-one-shot**: una definitiva ≤ 25 % del HP del jefe (mediana) / ≤ 40 % (p95); el jefe vive ≥ 8 s (mini) / ≥ 15 s (gran) en perfil intermedio; el test del equipo extremo pasa.
5. **Combate de jefe**: cuesta 0,5–1,0 × `maxHp` medio del Pokémon; en `CARRY` el activo muere en < 10 s en fase 3.
6. **Conservación de oro**: `Σ oro de piso ≈ W(f) ± 2 %`.
7. **Tope respetado**: `aliveCount ≤ ALIVE_CAP` en todos los ticks de todas las simulaciones.
8. **Rendimiento**: presupuestos de §5.
9. **Determinismo**: misma `seed` ⇒ mismo `FloorPlan`, mismos Informes de Ruta y mismos adds por fase, con inputs de jugador distintos.
10. **Sin regresión**: `pnpm test` y `pnpm build` en verde; los criterios 1–7 de §9.1.5 siguen valiendo, adaptados a la nueva duración.

---

## 8. Ediciones concretas del PRD (para el agente de documentación)

| Sección | Cambio |
| :--- | :--- |
| Cabecera | Versión **v2.6**; estado: añadir este bloque como **`3A.5`** pendiente, previo a `3A.2-S`. |
| §1 Concepto | "oleadas de enemigos" → "flujo continuo de enemigos en 360°". |
| §3.2 Habilidad Definitiva | Añadir nota: la definitiva **no puede saltar fases de jefe** (D26). |
| §4.4.2 | Sustituir el invariante "≈7 fugas" por la fórmula de D24 (§3.3 de esta spec). Actualizar la tabla de golpe de jefe anclado por fase (§4.3). |
| §4.4.4 | Redefinir `W(piso)` como `floorGoldIncome(f)`, independiente de "10 enemigos". Precios sin cambio. |
| §5.1 tabla | *Oleada Normal* → flujo `N(f)` en `S(f)` (≈1 min); añadir fila **Piso Exigente** (`f%5==4`); *Mini-Boss*/*Gran Boss* → HP por TTK, 3 fases, adds, `BOSS_TIMER_MODE`. |
| §5.1 párrafo "Anclaje" | Quitar "6 % × 1/s" fijo; remitir a la tabla por fase. |
| §6.3 `RunProof` | "Umbral fisiológico de tiempo": ahora el piso **no puede completarse antes de `S(f)`** (los spawns son por tiempo) ⇒ cota mínima de duración de run `≥ Σ S(f)` (mejora anti-trampa). DPS Sanity Check: incluir TTK mínimo del jefe por fases. |
| §8 Roadmap | Insertar **bloque `3A.5 — Spawner continuo y Jefes por fases`** (WP1–WP6) antes de `3A.2-S`; redefinir `3A.2-S` = WP7. En **3B**, "Jefes multifase" pasa a ser *cambio de tipos por fase* sobre las fases ya existentes. |
| §9.1.5 | Añadir criterios 8–12 (los de §7.1); marcar el criterio 5 (hitos por perfil) como *a revalidar*. |
| §9.5 | Fases 66/33 para **todos** los jefes; recorte, invulnerabilidad, adds; tabla de escalado. |
| §9.6 | Requisito 1 ("no bloquea el piso") se cumple por construcción del spawner (fin de piso = cola vacía y vivos no-fugitivo = 0); frecuencia en pisos, no en segundos. |
| §9.9 | Mutador *Horda* redefinido (`N ×1,5`, `HP ×0,7`, respeta `ALIVE_CAP`); escalado de la Torre `f > 100` (§2.1). |
| §9.10 | Nuevos riesgos: *fatiga de piso largo en idle*, *ingreso por hora*, *densidad y rendimiento*, *timer de jefe como causa de muerte dominante*. Nuevas decisiones **D20–D28**. |
| Anexo A | A6 ("la oleada exige `aliveEnemies.length === 0`") → resuelto; A13 (`SPAWN_MARGIN`) → resuelto. Añadir **A.4** con los hallazgos B1–B12 de esta spec. |
| Anexo B | Entrada "De la v2.5 a la v2.6 (fecha)". |

---

## 9. Fuera de alcance / pendiente (no implementar sin nueva decisión)

- **Mecánicas idle** que sostengan runs largas sin atención (el autor las diseñará después). Contexto útil: con enemigos convergiendo al centro, el AoE/perforación/rebote escala con la densidad y es el camino natural para que el auto-disparo aguante hordas; hoy el auto-disparo apunta a `UP_MULTI` objetivos (máx. 5) más cercanos. No tocar la selección de objetivos hasta tener datos del simulador.
- **Variantes élite** (`tier: 'elite'`, HP ×4, oro normalizado dentro de `W`): solo si el tope de vivos se satura en el playtest.
- **Ritmo de Runas y Sellos por hora**: con runs ~10× más largas, `runePayout` y los Sellos por piso quedan lentos por hora. Revisar tras el playtest, no ahora.
- **Combos con efecto en daño/oro**, offline/progreso en segundo plano, nuevos biomas.

---

## Apéndice A — Orden recomendado de la primera sesión

1. `pnpm install && pnpm test && pnpm run test:balance`; guardar salida (baseline).
2. Añadir `scripts/bench-core.ts` + `bench:core`; guardar baseline.
3. WP1 (config/tipos) y WP2 (`floorPlan.ts` + tests) — sin tocar todavía el bucle.
4. WP3 detrás de un flag temporal `USE_FLOOR_PLAN` solo si hace falta para mantener el verde por commits pequeños; retirarlo al terminar WP3.
5. WP4 y WP5 en ramas separadas (comparten `applyDamageToEnemy`: hacer ese refactor **primero** en su propio commit).
6. WP6 → WP7. La calibración (WP7) es iterativa: **no cerrar WP4/WP5 hasta pasar los criterios de §7.1**.
