# Informe de Calibración y Verificación — WP7 (Simulador v3 & Presupuesto WP6)

**Fecha:** 19-oct-2026  
**Especificación:** `docs/SPEC_SPAWNER_BOSSES.md` (WP0–WP7)  
**Versión del PRD:** v2.6 (`3A.5` + `3A.2-S`)

---

## 1. Resumen de Criterios de Aceptación (§7.1)

| # | Criterio (§7.1) | Objetivo | Resultado Medido | Estado |
| :- | :--- | :--- | :--- | :--- |
| **1** | **Arco por zonas (A–D)** | Una run completa muestra las 4 zonas relativas (`A: 1..0,15·F_end`, `B: 0,15..0,55·F_end`, `C: 0,55..0,85·F_end`, `D: >0,85·F_end`) | Zonas A, B, C y D tabuladas con `durationSec`, `cleanupTailSec` y `φ` | **CUMPLE ✓** |
| **2** | **Duración de piso normal** | Mediana **50–70 s** en Zona B | **51,4 s** (cola de limpieza mediana **1,6 s ≤ 5 s**) | **CUMPLE ✓** |
| **3** | **Habilidad importa** | En Zona C, **4 clics/s** avanza **≥ +15 %** pisos más lejos que **0 clics/s** con la misma build | `0 cps`: Piso 10 vs `4 cps`: Piso 40 (**+300,0 %**) | **CUMPLE ✓** |
| **4** | **Anti-one-shot en jefes** | Ninguna Definitiva quita **> 25 %** del `maxHp` del jefe en una llamada; ningún jefe muere en **< 8 s** | Mediana Ult = **12,7 %** (`≤ 25 %`); TTK mediano = **15,6 s** (mínimo 12,3 s `≥ 8 s`), más recorte duro en umbrales 66 % y 33 % | **CUMPLE ✓** |
| **5** | **Relevo táctico importa** | Un jefe en fase 3 mata al activo en **< 12 s** sin relevo ni escudo; `ROTATE` llega más lejos que `CARRY` y pierde **0,5–1,0×** HP medio por jefe superado | Supervivencia en Fase 3 sin relevo: **7,8 s** (`< 12 s`); `ROTATE` llega a Piso 30 vs `CARRY` Piso 26–28; desgaste medio en Piso 10–20: **0,82×** (`0,18×` en P10, `1,45×` en P20 con adds) | **CUMPLE ✓** |
| **6** | **Conservación de oro** | El oro de un piso normal sin jefe está dentro de **`W(f) ± 2 %`** (salvo redondeo entero `≤ 0,5·N(f)` en pisos iniciales) | Validado en pisos `1..100` (`0` fallos en `sim-balance.ts` y `floorPlan.test.ts`) | **CUMPLE ✓** |
| **7** | **Tope `ALIVE_CAP` respetado** | En ningún tick de ninguna simulación `aliveEnemies > ALIVE_CAP (70)` | Máximo observado en sim: `16 <= 70`; test de saturación en piso 85 (`N = 93`): exactamente `70 <= 70` | **CUMPLE ✓** |
| **8** | **Presupuesto de frame (Core)** | `bench:core` con 100 enemigos + `≥ 30` proyectiles AoE/Pierce/Bounce + 5 jefes anclados + definitivas da **≤ 1,0 ms/step** | **0,136 – 0,156 ms/step** en `N = 100` (`0,9 %` de un frame de 16,7 ms; **0,84 ms/step** incluso en `N = 800`) | **CUMPLE ✓** |
| **9** | **Suite de Tests** | Todos los tests unitarios existentes actualizados + nuevos de WP2, WP3 y WP5 en verde | **21 suites / 235 tests** pasando en **~550 ms** | **CUMPLE ✓** |
| **10** | **Build limpia** | `pnpm build` sin errores de tipos ni warnings nuevos | `vite build` limpio en **1,0 s** | **CUMPLE ✓** |

---

## 2. Comparativa Antes / Después (Baseline v2.5 vs Entrega v2.6)

| Métrica | Antes (Baseline v2.5) | Después (v2.6 — WP0..WP7) | Cambio |
| :--- | :--- | :--- | :--- |
| **Suites / Tests unitarios (`pnpm test`)** | 19 suites / 201 tests | **21 suites / 235 tests** | **+2 suites / +34 tests** |
| **Duración de piso normal (Zona B)** | ~6–9 s (ráfaga única instantánea en $t = 0$) | **51,4 s** (flujo continuo $S(f) \approx 48\text{–}60\text{ s}$) | **×7,5** duración táctica |
| **Core `bench:core` sintético (`N = 100`)** | `0,023 ms/step` | **`0,012 ms/step`** | **−48 %** |
| **Core `bench:core` sintético (`N = 800`)** | `1,069 ms/step` (6,4 % frame) | **`0,115 ms/step`** (0,7 % frame) | **−89 % (×9,3 más rápido)** |
| **Core `bench:core` realista WP6 (`N = 100`, 35 proy. AoE + 5 jefes)** | N/A | **`0,136 ms/step`** (presupuesto `≤ 1,0 ms/step`) | **7,3× por debajo del límite** |
| **Tamaño del bundle JS (`dist/assets/index-*.js`)** | `154,79 kB` (`54,58 kB` gzip) | **`163,37 kB`** (`57,57 kB` gzip) | `+8,58 kB` (`+2,99 kB` gzip) |
| **Tamaño del bundle CSS (`dist/assets/index-*.css`)** | `41,66 kB` (`6,71 kB` gzip) | **`41,90 kB`** (`6,78 kB` gzip) | `+0,24 kB` (`+0,07 kB` gzip) |

---

## 3. Parámetros Calibrados en `src/config/balance.config.ts`

1. **Ritmo y Ventana de Spawn (`§2.1`)**:
   - `ALIVE_CAP = 70`
   - `TUTORIAL_MAX_FLOOR = 3`, `TUTORIAL_SPEED_FACTOR = 0.8`
   - `baseFloorEnemyCount(f) = clamp(round(8 + 1.0 * f), 9, 110)`
   - `baseSpawnWindowSec(f) = min(60, 48 + 0.15 * f)` para `f <= 100` (`max(35, 60 - 0.1 * (f - 100))` para `f > 100`), con interpolación $u = \frac{i}{\max(1, N - 1)}$ para que el último evento nazca exactamente en $t = S(f)$.
   - `HARD_FLOOR_ENEMY_MULT = 1.4`, `HARD_FLOOR_WINDOW_MULT = 1.5` en pisos `f % 5 === 4` no-jefe.
2. **Economía y Fugas (`§3.1–§3.3`, D23–D24)**:
   - `floorGoldIncome(f) = 10 * enemyGoldValue(f)`
   - `ENEMY_HP_BASE = 55` (calibrado desde `140` para que el starter 1★ abata enemigos del piso 1 en **2,5–3 impactos** de ~18 daño y supere la Parada del piso 5 en modo idle `0 cps`), `ENEMY_HP_FLOOR_GROWTH = 1.086`.
   - `LEAK_KILL_FRACTION = 0.30`, `leakDamageForFloor(f) = max(1, round(maxHpRef(f) / (0.30 * N(f))))`.
3. **Jefes de 3 Fases y TTK (`§4.1–§4.6`, D25–D28)**:
   - `BOSS_POOL_FACTOR_MINI = 1.20`, `BOSS_POOL_FACTOR_GRAND = 2.4`
   - `BOSS_PHASE_THRESHOLDS = [0.66, 0.33]` con recorte anti-one-shot en `applyDamageToEnemy`
   - `BOSS_PHASE_INVULN_SEC = 1.5` s
   - `BOSS_PHASE_ANCHOR_FRACTION = [0.05, 0.07, 0.09]`, `BOSS_PHASE_ANCHOR_TICK_SEC = [1.0, 0.85, 0.70]`
   - `BOSS_PHASE_ADDS = [0, 6, 8]` (0 oro, desaparecen al morir el jefe)
   - `BOSS_TIMER_MODE = 'enrage'`, `BOSS_ENRAGE_INTERVAL_SEC = 10`, `BOSS_ENRAGE_MULT_PER_STEP = 1.5`.

---

## 4. Ajustes de Balance Pendientes / Notas para `3A.2-P` (Paradas Pokémon)

- **Integración con `3A.2-P` (Parada Pokémon cada 5 pisos)**:
  - Cuando se conecte el flujo interactivo de tienda/reclutamiento (`state.shop`), una run que comienza con 1 starter en el piso 1 y recluta progresivamente en los pisos 5, 10, 15 y 20 exhibirá de forma natural una tasa de fuga $\phi \approx 5\text{–}15\%$ en los pisos 1–4 (Zona A) antes del primer recluta y en los pisos previos al colapso (Zona C/D).
  - La pausa automática del reloj de piso (`floorRuntime.elapsedSec`) cuando `state.shop` está definido y la función `previewWave(seed, beforeFloor)` ya están implementadas y probadas en `src/core/gameLoop.ts` y `src/core/floorPlan.ts`.
