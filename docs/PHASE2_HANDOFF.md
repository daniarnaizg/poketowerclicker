# Contrato para el agente de Fase 2 (salida de la sesión de planificación Fase 3+)

Objetivo: decisiones que cuestan poco **ahora** y mucho **después**. Salvo el punto 1, no amplían el alcance de la Fase 2. Contexto y justificación: `PRD.md` v2.3, §9 y Anexo A.

## 1. Cambia el alcance (requiere confirmación del usuario: pregunta P1 del PRD)

**El Shiny deja de ser el premio de la 5★.**
- 5★ = **Aura Apex** (aura dorada) + duplica la pasiva de banquillo. Nada más.
- El Shiny será un coleccionable de suerte (tirada propia en el gacha, Fase 3C). **No lo implementes en Fase 2**, pero deja el dato preparado (punto 2).
- Si ya implementaste "5★ ⇒ skin Shiny", basta con renombrarlo a Aura Apex.

## 2. Contratos de datos (baratos ahora)

1. **Persistencia versionada.** El esquema guardado en `idb-keyval` lleva `schemaVersion` y una función `migrate(oldVersion → new)`. Los Shiny, las Runas y la Caja viven ahí; una migración sin versión previa es dolorosa.
2. **Entrada de colección** con estos campos (aunque `shiny*` quede siempre a `false` en Fase 2):
   ```ts
   interface CollectionEntry {
     speciesId: string; stars: 1|2|3|4|5; fragments: number;
     shinyOwned: boolean; shinyActive: boolean;
   }
   ```
3. **`stars` y `shinyActive` copiados a `PlayerPokemon`** al construir la run, para que el renderer pinte aura/Shiny sin consultar la colección.
4. **Estados alterados genéricos en `Enemy`** para los 3★ (Quemadura, Parálisis, Ralentización): `statuses?: { id: string; remainingSec: number; stacks?: number; sourceSlot?: number }[]`. Las Sinergias (3B) añadirán Veneno y Congelación sobre la misma estructura. El daño por estado debe expresarse como **fracción del impacto que lo causó**, no del HP máximo (así escala con el piso).
5. **No añadas más parámetros posicionales a `calculateDamage`** (ya tiene 7). Si necesitas un multiplicador nuevo (pasivas de banquillo), pásalo por **un único objeto opcional `modifiers`**. En 3B se sustituirá por el pipeline completo (PRD §9.3.1); así el refactor será mecánico.
6. **Regla de equipo a confirmar:** ¿puede haber dos Pokémon de la misma línea evolutiva en los 6 slots? Las Sinergias asumen que **no**.

## 3. Observaciones (sin acción obligatoria)

- **Dos "estrellas" distintas:** el PRD llama ★–★★★★ a la rareza del gacha y 1★–5★ al despertar. Conviene nombres distintos en la UI (p. ej. rareza = "Rango", despertar = "Estrellas").
- **Pity:** con 8% de probabilidad de ★★★ por tirada, el pity de 30 tiradas solo se alcanza en ~8% de los casos (0,92³⁰ ≈ 0,08): es casi decorativo. El de ★★★★ (2%, 80 tiradas) sí actúa (0,98⁸⁰ ≈ 0,20).
- **Coste de tirada y fuentes de Sellos** deben fijarse en Fase 2: las recompensas de jefes, Shiny salvajes y logros se calibran contra ese número.
- **Entrada táctil:** `App.tsx` usa `pointerdown` + hold-to-fire (máx. 4 clics/s).
- **Idle:** hoy una run sin clics no avanza (0 bajas en 20 s; ver `docs/analysis/sim-baseline.ts`). Si Fase 2 toca daño base o definitivas, ten en cuenta que el balance se rehace en 3A.

## 4. Conflictos de fusión

`PRD.md` v2.3 reescribe el roadmap (§8) y añade §7.4, §9 y anexos. Si tu agente también edita `PRD.md` (p. ej. para marcar progreso), **fusiona a mano** con `git diff` en vez de sobrescribir.
