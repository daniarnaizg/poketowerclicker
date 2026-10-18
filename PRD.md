# PRD: PokéBastion — Pokémon Idle Defense & Gacha (v2.6)

Documento de Requisitos de Producto para un juego de defensa e incremento progresivo (*Roguelite Idle Defense*) con mecánicas gacha, rotación táctica elemental en tiempo real, vitalidad individual por Pokémon, paradas de ruta y arena simétrica.

| Atributo | Detalle |
| --- | --- |
| **Estado del Documento** | Borrador Consolidado (v2.6) — Fase 1, Fase 2 y fundaciones de Fase 3A completadas (`HEAD 89abb76`) · Rediseño de **Vitalidad Individual y Paradas** integrado (bloques `3A.2-V`, `3A.2-P`) · Bloque `3A.5` (Spawner continuo, ritmo de piso y Jefes por fases) pendiente, previo a `3A.2-S` |
| **Plataforma** | Web App (Desktop & Mobile PWA) — 100% Client-Side Execution |
| **Tooling & Build** | **Vite** + **pnpm** + **TypeScript** |
| **UI & Estado** | **Preact** (o React) + **Tailwind CSS** + **Zustand** |
| **Motor de Render** | **Canvas 2D Nativo** (Arena 384×384 px lógicos, pixel-art determinista) |
| **Audio & Storage** | **Howler.js** + **`idb-keyval` (IndexedDB)** |
| **Arte y Assets** | PMDCollab (Sprites 8 direcciones, `AnimData.xml` y Retratos) |
| **Monetización / Infraestructura** | Servidores serverless de coste \$0 / Cliente autónomo |

---

## 1. Visión General del Producto

### Concepto High-Level

Un juego web *Roguelite Idle Defense* con coleccionismo **Gacha** y gestión táctica de equipo. El jugador empieza eligiendo un Pokémon Inicial clásico, forma un escuadrón de **máximo 6 Pokémon por run** y **su propio equipo es la defensa** en una **arena cuadrada simétrica con un único Pokémon activo en pantalla a la vez**.

El jugador alterna en tiempo real (*Hot-Swap*) entre los miembros de su equipo para explotar debilidades elementales, proteger a Pokémon heridos mediante resistencias defensivas y gestionar recursos en **Paradas de Ruta** cada 10 pisos (empezando en el piso 5: 5, 15, 25, 35…) frente a un flujo continuo de enemigos en 360°, Mini-Bosses cada 10 pisos y Grandes Bosses en los pisos 50 y 100.

### Filosofía de Despliegue (Coste Cero / Bajo Mantenimiento)

Todo el bucle de juego, físicas, cálculo de daño y guardado primario se ejecutan 100% en el cliente (navegador). El backend es inexistente en el MVP (alojamiento estático puro) y, cuando se active el **Ranking Global**, consistirá únicamente en una API serverless ultraligera (<5 ms por validación) para registrar récords verificados.

### Diferenciación Clave

* **Un Único Pokémon Activo + Banquillo de 5:** Solo el Pokémon activo combate y recibe daño en el centro de la arena cuadrada; los otros 5 aguardan a salvo en la reserva listos para entrar al relevo y aportar sus bonificaciones pasivas de equipo (`BENCH_PASSIVE`) y Sinergias de Tipo mientras sigan con vida.
* **Vidas Individuales, Permadeath Táctico y Paradas de Ruta (v2.5):** No existe una barra de salud global del Bastión; cada Pokémon tiene su propio HP (escalado por especie y Nivel de Equipo) y puede caer **Debilitado** (apagando sus pasivas y sinergias). No hay regeneración pasiva en combate: curar y revivir ocurre **exclusivamente en Paradas cada 10 pisos empezando en el piso 5** (`5, 15, 25, 35…`, eligiendo un único servicio pagado con el mismo oro que financia las mejoras), creando un dilema real entre potencia ofensiva y supervivencia.
* **Gacha con Propósito Táctico y Despertar (1★ a 5★):** Desbloquear duplicados no adelanta la evolución, sino que desbloquea pasivas de banquillo, potencia los ataques de entrada (*Switch-In Bonus*), amplía los patrones de disparo y desbloquea el *Aura Apex* (el aspecto *Shiny* es un coleccionable de suerte independiente, ver §9.7).
* **Rotación en Tiempo Real (Tag-In Elemental Ofensivo y Defensivo):** El jugador alterna qué Pokémon está en el campo tanto para maximizar el daño elemental como para mitigar el daño recibido (que también usa la tabla de tipos) y evitar que caiga un miembro clave del equipo.
* **Evolución por Niveles Canónicos:** Cada Pokémon evoluciona durante la run en sus **niveles reales de los juegos originales** (ej. Charmander evoluciona a Charmeleon a Nv. 16 y a Charizard a Nv. 36; Caterpie a Nv. 7 y 10; Dratini a Nv. 30 y 55).
* **Economía Unificada de Equipo:** El oro intra-run sube un único **Nivel de Equipo** (que escala tanto el daño como el HP máximo de los 6 Pokémon), garantizando que cualquier relevo sea tácticamente competitivo de inmediato.
* **Estética Mundo Misterioso (PMDCollab):** Sprites animados en 8 direcciones (`Walk-Anim.png`, `Attack-Anim.png`) y retratos expresivos (`Normal.png`).

---

## 2. Pilares de Diseño

1. **Coleccionismo Gacha Emocionante:** Conseguir Cupones/Gemas de Invocación derrotando jefes, superando hitos o abatiendo variantes *Shiny* para ampliar la Caja Pokémon y potenciar las estrellas del equipo.
2. **Profundidad Elemental y Equipo de 6:** El límite de **6 Pokémon por expedición** obliga a diseñar combinaciones equilibradas en tipos elementales (Fuego, Agua, Planta, Eléctrico, Psíquico, etc.), robustez (`hpFactor`) y patrones de ataque complementarios.
3. **Cambio Dinámico en Combate (Hot-Swap Ofensivo y Defensivo):** Cambiar de Pokémon adapta instantáneamente el elemento activo, cadencia, patrón de disparo, resistencias defensivas y Habilidad Definitiva sin penalizaciones de nivel, permitiendo rotar antes de que un Pokémon herido caiga debilitado.
4. **Bucle Roguelite, Dilema de Oro y Viralidad:** La pérdida de cada Pokémon duele (apaga sus pasivas y sinergias) y el oro compite entre escalar daño o pagar servicios en las Paradas. Cuando todo el equipo cae debilitado, la run termina y genera una tarjeta de fin de run compartible con estadísticas, **Cementerio de caídos** y récords.
5. **Arquitectura Client-First & Leaderboard-Ready:** Ejecución determinista en local con verificación serverless instantánea mediante telemetría matemática (`RunProof`).

---

## 3. Sistemas Principales de Jugabilidad

### 3.1. Elección Inicial y Sistema Gacha (Reclutamiento RNG)

#### Elección de Inicial (Starter Set)
Al iniciar partida por primera vez, el jugador elige **1 Pokémon Principal** entre un set clásico (por ejemplo: *Charmander*, *Squirtle* o *Bulbasaur*). Este Pokémon es su primer combatiente y define su tipo inicial.

#### Sistema Gacha (Santuario de Invocación / Pelipper Express)
* **Moneda Gacha:** *Sellos de Reclutamiento* (o *Gemas Iris*), obtenidos al **abatir (matar)** Mini-Bosses y Grandes Bosses por primera vez (`defeatedBossFloors`, nunca por fuga), logros, ascensiones o abatiendo enemigos *Shiny* salvajes.
* **Sistema de Duplicados (Despertar / Estrellas):** Obtener un Pokémon repetido otorga **Fragmentos de Vínculo** de esa especie para subir su rango de estrellas (1★ a 5★).
* **Sistema Pity:** Garantía de obtener al menos un Pokémon ★★★ cada 30 tiradas y un ★★★★ cada 80 tiradas.

| Rareza | Probabilidad | Ejemplos de Pokémon | Descripción de Rol |
| :--- | :--- | :--- | :--- |
| **Común (★)** | 60% | *Pidgey, Rattata, Pikachu, Gastly, Caterpie* | Pokémon básicos de ruta y de rápida evolución temprana |
| **Raro (★★)** | 30% | *Riolu, Ralts, Trapinch, Magby, Aron, Iniciales* | Iniciales de otras regiones y Pokémon de 3 etapas estándar |
| **Épico (★★★)** | 8% | *Dratini, Larvitar, Beldum, Lapras, Snorlax* | Pseudo-legendarios de escalado tardío y especialistas |
| **Legendario (★★★★)** | 2% | *Articuno, Zapdos, Moltres, Mewtwo* | Estadísticas superiores y habilidades únicas de campo |

#### Lógica de las Estrellas de Despertar (1★ a 5★)
A diferencia de la evolución (que se produce exclusivamente mediante el Nivel de Equipo con oro en la run), las estrellas del Gacha aportan **profundidad táctica permanente**:

| Rango | Beneficio Permanente | Impacto Jugable |
| :--- | :--- | :--- |
| **1★ (Base)** | Estadísticas base estándar (×1.0). Disparo estándar. | Desbloqueo inicial del Pokémon en la Caja. |
| **2★ (Vínculo)** | **Pasiva de Banquillo Nv. 1** (`BENCH_PASSIVE`). | Otorga bonificación al equipo incluso estando en reserva **mientras el Pokémon esté vivo** (`alive = true`; si cae debilitado, su pasiva y su aporte a Sinergias se apagan hasta revivir, §4.4.3). |
| **3★ (Técnica)** | **Ataque de Entrada Mejorado** (*Switch-In Bonus*). | La onda de relevo aplica estados (Quemadura, Parálisis, Ralentización o Escudo defensivo temporal sobre el Pokémon entrante). |
| **4★ (Perfección)** | **Evolución del Patrón de Disparo**. | Mayor radio AoE, proyectiles que rebotan +1 vez adicional o proyectil perforante. |
| **5★ (Apex)** | **Aura Apex (dorada)** + Duplica Pasiva. | Prestigio visual y maximización de la bonificación de banquillo (sujeta a que el Pokémon esté vivo). *(v2.3: el Shiny ya no depende de las estrellas; se obtiene por suerte, §9.7.)* |

---

### 3.2. Ficha Técnica y Estadísticas por Pokémon

Cada especie de la colección cuenta con atributos específicos que escalan con el Nivel de Equipo y las mejoras:

* **Salud Base (`HP` / `hpFactor`):** Estadística base de vida extraída de PokeAPI (`sync:pokemon`, §7.2) y comprimida al rango `[0,6 ; 1,8]` para diferenciar tanques (*Snorlax*, *Lapras*, *Aggron*) de cañones de cristal (*Gastly*, *Pikachu*, *Alakazam*). El `maxHp` de cada Pokémon escala automáticamente con el **Nivel de Equipo** y al evolucionar (§4.4.1), sin existir mejoras de oro dedicadas a comprar HP o regeneración.
* **Ataque Base (`ATK`):** Multiplicador de daño para el disparo autónomo y los proyectiles manuales/autoclick.
* **Disparo Manual (Clic) y Autoclick Ergonómico:** Hacer clic en la arena dispara un proyectil del Pokémon activo hacia el punto apuntado (beneficiándose de `UP_ARROW` *Proyectiles*, críticos y pasivas), pero **el disparo autónomo por sí solo limpia los primeros pisos** (el clic no es requisito para sobrevivir al inicio).
  * **Hold-to-fire gratis:** Mantener pulsado (`pointerdown` + seguimiento en `pointermove`) dispara un proyectil manual cada 250 ms (máx. 4 clics/s) siguiendo al puntero.
  * **Autoclick (`UP_AUTOCLICK`):** Mejora con oro en la run cuya cadencia sube por nivel (`1 → 1.5 → 2 → 3 → 4` clics/s, con tope igual al hold manual). En escritorio dispara automáticamente hacia la posición del cursor (*hover*); en pantallas táctiles activa el modo **"fijar punto de apuntado"** (un toque fija la retícula y dispara hacia ella hasta tocar otro punto).
* **Velocidad de Ataque (`SPD`):** Cadencia base de disparo autónomo (ej. *Pikachu* alta cadencia; *Snorlax* cadencia lenta pero daño y HP masivos).
* **Probabilidad y Daño Crítico Base (`CRIT` / `CDMG`):** Afinidad innata para asestar golpes críticos.
* **Patrón de Ataque (`PATTERN`):**
  * *Francotirador:* Proyectil veloz a larga distancia hacia los enemigos más cercanos al centro.
  * *Artillero (AoE):* Bombas parabólicas con explosión en área en zonas densas.
  * *Pulso / Cuerpo a Cuerpo:* Ondas expansivas de corto alcance y alto daño.
  * *Cadena / Rebote:* Proyectiles que saltan entre múltiples objetivos.
* **Tipo Elemental (1 o 2 tipos) y Suelo de Inmunidad Global (`×0.25`):** Multiplicadores de tabla de tipos (`×1.5` Súper Eficaz, `×0.65` No muy eficaz), aplicados tanto al **daño infligido** como al **daño recibido** por el Pokémon activo (§4.4.2). Para evitar *soft-locks*, **no existe daño `×0`**: si *cualquier* par de tipos tiene inmunidad canónica, la efectividad combinada se calcula como `min(producto de los pares no inmunes, 0.25)` (`IMMUNITY_FLOOR = 0.25`).
* **Habilidad Definitiva (Ultimate):** Movimiento insignia con **enfriamiento en segundos por especie** (30 s en la forma inicial, 26 s en la primera evolución, 22 s en la final; 26 s en especies sin evolución), acelerable con pasivas `ULT_CHARGE`. *(Nota v2.6: la Definitiva no puede saltar fases de jefe; el daño se recorta al umbral 66% / 33%, D26).*
* **Nivel de Evolución Canónico:** Umbral de Nivel de Equipo requerido para evolucionar (ej. Lv. 16/36, Lv. 7/10, Lv. 30/55).

---

### 3.3. Geometría de la Arena Cuadrada y UI Lateral

#### Arena Cuadrada Simétrica (384×384 px lógicos)
Para evitar la asimetría de distancias de los lienzos panorámicos, la zona de combate es un **cuadrado perfecto**:
* El Pokémon activo se sitúa en el centro exacto `(192, 192)` sobre la plataforma central.
* La distancia a cualquier borde exterior es idéntica en 360° (192 px de radio).
* Los enemigos emergen sobre una circunferencia de radio 192 centrada en la arena y avanzan hacia el centro con velocidades homogéneas. Las cuatro **esquinas** del cuadrado quedan fuera de esa circunferencia y no se recorren nunca: es el lugar del decorado de fondo (§9.2.2).

#### Panel Lateral de Control (Configurable Izquierda / Derecha y Responsive 1080p)
El resto de la pantalla alberga la interfaz:
* **HUD de Estado y Vitalidad:** Muestra el piso actual, chip **"Próxima parada: N pisos"**, **barra de HP del Pokémon activo** (grande) e indicador de **"Reserva del equipo"** (`Σ hp / Σ maxHp` y `"N/M vivos"`), conservando de un vistazo la lectura de salud global del escuadrón.
* **Barra de Equipo de 6 Pokémon (`TeamBar`):** Retratos (`Normal.png`), tipo elemental, nivel de evolución actual, barra de HP individual, estado (*Activo / Herido / Debilitado / En cooldown*) y botón de relevo directo (*Hot-Swap* mediante clics o teclas 1 a 6). Los Pokémon debilitados se muestran en gris con la etiqueta **"Debilitado"** y no son seleccionables; la flecha de **Pista de Relevo** (§9.3.6) se oculta si el candidato tiene `< 25% HP`.
* **Medidor de Habilidad Definitiva:** Botón activador (`Espacio` o clic secundario).
* **Controles de Mejora de Oro:** Botón único de *Nivel de Equipo* y rejilla con las **7 mejoras con oro** (§4.1).
* **Ajuste en Opciones:** Posición del Panel: *Derecha* (predeterminado) o *Izquierda* (modo accesibilidad / zurdos para juego móvil horizontal).
* **Diseño Responsive en Escritorio (1080p / Portátiles):**
  * **Red de seguridad vertical:** Uso de `h-dvh` en lugar de `h-screen`, `min-height` garantizado en el panel de Mejoras y scroll en el contenedor lateral si el alto del viewport es insuficiente.
  * **Layout de 2 columnas en viewports panorámicos bajos** (`min-aspect-ratio: 16/10` y `max-height: 1000px`, ej. 1920×969 con barra de navegador): el panel lateral se divide en **dos columnas** (*HUD + Equipo* a la izquierda, *Mejoras* a la derecha), mostrando las 7 mejoras sin scroll interno.
  * **Tarjetas de Equipo compactas** en alturas `≤ 800px`.

```
+--------------------------+-------------------------------------+
|                          |  [ Piso 14 ] [Parada: 1p] [00:23]   |
|                          |  HP Activo:  [==============------] |
|     ARENA CUADRADA       |  Reserva Eq: 74% (5/6 vivos)        |
|       (384 x 384)        |-------------------------------------|
|                          |  EQUIPO (Hot-Swap 1-6):             |
|       Enemigos 360°      |  [1] Charmeleon (ACTIVO - 70% HP)   |
|             ↓            |  [2] Wartortle  [3] Ivysaur (▲×1.4) |
|         [POKÉMON]        |  [4] Pikachu (DEBILITADO) [5] [6]   |
|             ↑            |-------------------------------------|
|                          |  [DEF. LISTA: LLAMARADA (Espacio)]  |
|                          |-------------------------------------|
|                          |  NIVEL DE EQUIPO (Nv. 18) [Subir]   |
|                          |  MEJORAS (7 mejoras con Oro)        |
+--------------------------+-------------------------------------+
   (Arena fija cuadrada)        (Panel lateral 1 o 2 cols según viewport)
```

#### Mecánica de Relevo en Combate (Hot-Swap Manual y Relevo Forzado)
* **Relevo Manual:** Pulsar sobre cualquier miembro **vivo** del banquillo sustituye instantáneamente al Pokémon activo en el centro de la arena, aplica un **enfriamiento breve (4 segundos)** y desencadena un **Ataque de Entrada (*Switch-In*)** del tipo elemental del Pokémon entrante (con daño y efectos adicionales si cuenta con 3★ o más).
* **Relevo Forzado (Decisión D16):** Cuando el Pokémon activo cae a `hp ≤ 0` (*Debilitado*), entra automáticamente al campo el mejor candidato vivo según `swapScore` (§9.3.6), **sin coste de enfriamiento** y **disparando su Ataque de Entrada**. Si no queda ningún Pokémon vivo en el equipo, se produce `GAME_OVER` (`teamWiped`).

---

## 4. Progresión, Economía, Vitalidad y Paradas

### 4.1. Progresión Intra-Run (Con Oro)

#### Nivel de Equipo Unificado (Oro Intra-Run)
* El oro se invierte en una única estadística principal de nivel: el **Nivel de Equipo** (`teamLevel`).
* Todos los 6 Pokémon del escuadrón comparten este nivel en todo momento (incluso si están debilitados; al ser revividos en una Parada vuelven directamente al Nivel de Equipo actual, sin "deuda de nivel").
* **Escalado de Daño y Vitalidad Máxima (`maxHp`):** Subir el Nivel de Equipo incrementa tanto el daño como el `maxHp` de todos los Pokémon del equipo (§4.4.1). Al subir de nivel, **se conserva el ratio `hp / maxHp` actual** de cada Pokémon vivo (no otorga curación gratuita).
* **Evolución Canónica Durante la Run:** Cuando el Nivel de Equipo alcanza el nivel canónico de un Pokémon en los juegos originales, dicho Pokémon evoluciona visualmente y multiplica sus estadísticas base (`ATK`, `SPD`, `hpFactor`), conservando su ratio `hp / maxHp` actual:
  * *Ejemplos tempranos:* Caterpie evoluciona a Metapod a Nv. 7 y a Butterfree a Nv. 10.
  * *Iniciales:* Charmander a Charmeleon a Nv. 16 y a Charizard a Nv. 36.
  * *Tardíos / Pseudo-legendarios:* Dratini a Dragonair a Nv. 30 y a Dragonite a Nv. 55.

#### Mejoras Globales con Oro (7 Mejoras)

> **Decisión v2.5 (D15 revisada + refactor `89abb76`):** Se eliminan tanto `UP_HP` (*Muralla / Vida Máxima*) como `UP_WALL` (*Fortaleza / Regeneración*), y `UP_CLICK` queda unificada dentro de `UP_ARROW` (*Proyectiles*). La salud máxima de los Pokémon sube exclusivamente con su **Nivel de Equipo**, su evolución y las pasivas/sinergias/runas de `MAX_HP`, mientras que la recuperación de vida ocurre **únicamente en las Paradas** (§4.4.4).

| Identificador | Nombre en UI | Función de Escalado |
| :--- | :--- | :--- |
| `UP_ARROW` | **Proyectiles** (*Potencia Elemental*) | +10% daño de proyectil por nivel (afecta tanto al disparo autónomo como a los proyectiles manuales/autoclick). |
| `UP_SPD` | **Cadencia Auto** | +12% velocidad de disparo autónomo por nivel (sobre una base inicial del 50%, `AUTO_SPD_BASE_MULT = 0.5`). |
| `UP_MULTI` | **Multidisparo** (*Ataque Múltiple*) | +1 disparo autónomo / rebote simultáneo por nivel (máx. 4 mejoras = 5 disparos):<br>• *Francotirador:* Dispara a `N` enemigos simultáneos.<br>• *Artillero (AoE):* Lanza `N` bombas parabólicas.<br>• *Pulso:* Emite `N` ondas concéntricas.<br>• *Cadena:* Rebota `N` veces adicionales. |
| `UP_CRIT` | **Precisión** | +1% probabilidad de golpe crítico por nivel (tope 90%). |
| `UP_CDMG` | **Furia** | +10% multiplicador de daño crítico por nivel. |
| `UP_GOLD` | **Codicia** (*Amuleto Moneda*) | +10% oro obtenido por enemigo eliminado por nivel. |
| `UP_AUTOCLICK` | **Autoclick** | Dispara proyectiles automáticos hacia el cursor (escritorio) o punto fijado (táctil); subir nivel aumenta la cadencia (`1 → 1.5 → 2 → 3 → 4` clics/s, máx. 5 niveles). |

* **Fin de la estrategia de "tanquear fugas" y cero regeneración pasiva (Decisiones D2, D6, D10):** Al no existir mejoras repetibles de HP/regeneración con oro y aplicarse el daño de fugas directamente sobre la vida finita del Pokémon activo (§4.4.2), es imposible avanzar pisos ignorando el daño ofensivo. El oro se reparte entre **matar más rápido / subir Nivel de Equipo** y **pagar curas o revivires cada 10 pisos (5, 15, 25…) en las Paradas**.

---

### 4.2. Flujo de Derrota y Bucle Roguelite (Idle vs. Competitivo)

1. **Condición de Fin de Run (*Game Over*)**:
   * Cuando **todos los Pokémon del equipo están debilitados** (`defeatCause = 'teamWiped'`) **o** expira el cronómetro frente a un Mini-Boss o Gran Boss (`defeatCause = 'bossTimerExpired'`), la run termina inmediatamente. No existe retroceso de oleada pasivo infinito ni barra de Bastión global (`'bastionDestroyed'` se retira).
2. **Pantalla de Resumen y Viralidad Social (*Ficha de Entrenador*)**:
   * Al caer, se despliega una tarjeta de resultados estilizada:
     * Piso máximo alcanzado, causa de la derrota (`teamWiped` o `bossTimerExpired`) y tipo elemental del último verdugo (`defeatEnemyType`).
     * **Cementerio de la Expedición (Decisión D17):** Lista de Pokémon caídos durante la run (`faintLog`) indicando en qué piso cayeron, por qué causa (`leak` o `boss`) y ante qué tipo elemental.
     * Gráfica de contribución y daño del equipo (con el Pokémon MVP animado).
     * Runas de Ascensión y Sellos ganados calculados automáticamente.
     * Botón de **Compartir Récord** (genera un enlace o captura para redes con llamada de desafío).
3. **Automatización para Farmeo (Árbol de Runas - Rama Estratega)**:
   * Los jugadores avanzados pueden desbloquear en el meta-árbol la opción de **Relevo Automático Táctico** (§9.8): rota automáticamente de Pokémon según ventaja elemental/campo (`swapScore`) e incluye un nivel de **Retirada de Emergencia** cuando el HP del activo cae por debajo de un umbral de seguridad.

---

### 4.3. Meta-Progresión (Ascensión y Árbol de Habilidades)

* **Fórmula base de Runas Ancestrales**:

$$\text{Runas} = \left\lfloor \left(\frac{\text{OleadaMax}}{5}\right)^{1.5} \right\rfloor$$

* **Modelo económico de las Runas (Resolución P3):** Las Runas son **moneda que se gasta** en el Árbol de Habilidades (no otorgan un bono pasivo gratuito por mera acumulación). Los bonos de daño global, supervivencia y utilidad provienen de desbloquear nodos en las 3 ramas del Árbol:
  * **Entrenador:** Potenciación de estadísticas base (`ATK`, `MAX_HP`), velocidad de recarga de la Definitiva, desbloqueo base del Autoclick ergonómico y *(backlog §8 Fase 5)* **Aguante** (el primer golpe letal por run deja al Pokémon a 1 HP).
  * **Estratega:** Reducción de enfriamiento de *Hot-Swap*, potencia del *Switch-In Bonus*, **Retirada Automática por HP bajo** y Relevo Automático Táctico (§9.8).
  * **Explorador:** Aumento de drop de oro, descuentos en Paradas de Ruta *(backlog)*, probabilidad de enemigos *Shiny* y Sellos Gacha adicionales.
* **Persistencia:** Los Pokémon de la Caja, sus Estrellas de Despertar y las mejoras del Árbol de Runas se conservan permanentemente.

---

### 4.4. Vitalidad Individual y Paradas de Ruta (Decisiones D6–D19)

#### 4.4.1. Vitalidad por Pokémon (`maxHp`)
* Cada Pokémon del equipo posee salud real (`hp`, `maxHp`, `alive`) gobernada por su especie y el **Nivel de Equipo**:

$$\text{maxHp} = \left\lfloor \text{HP\_BASE} \times \text{hpFactor}(\text{especie}) \times \left(1 + (\text{NivelEquipo} - 1) \times \text{HP\_LEVEL\_SCALE}\right) \times (1 + \text{bonusMaxHp}) \right\rfloor$$

* **`hpFactor(especie)`:** Derivado de la estadística base de HP de PokeAPI (`sync:pokemon`, §7.2) y comprimido al intervalo `[0,6 ; 1,8]` para que especies tanque (*Snorlax*, *Lapras*) aguanten notablemente más fugas que cañones de cristal (*Gastly*, *Pikachu*). Se añade `hp` a `baseStats` en `PokemonDefinition`.
* **`bonusMaxHp`:** Suma aditiva de bonos porcentuales de vida máxima procedentes de pasivas de banquillo `MAX_HP` (ej. *Mudkip* `+12%` en etapa final, *Snorlax* `+20%`), Sinergias de Tipo (*Planta (2)* `+15%`, *Roca (2)* `+20%`, §9.4) y nodos del Árbol de Runas. No existe mejora de oro `UP_HP` ni `UP_WALL`.
* **Subida de nivel y Evolución:** Cuando sube el Nivel de Equipo o un Pokémon evoluciona, su `maxHp` aumenta pero **el ratio `hp / maxHp` se conserva** (ni otorga curación gratis ni castiga). Un Pokémon debilitado (`alive = false`) no evoluciona visualmente hasta ser revivido, pero al revivir lo hace ya en la etapa evolutiva correspondiente al Nivel de Equipo actual.
* **Colchón de 1 Pokémon (Primera Run):** En una run iniciada con un solo Pokémon (`selectStarter` o equipo de 1 slot ocupado), el inicial recibe un factor de colchón calibrado para equivaler a la supervivencia del antiguo Bastión en los pisos 1–10.

#### 4.4.2. Daño Recibido (Fugas y Jefes Anclados)
* **Único destinatario (Decisión D7):** Todo el daño enemigo lo recibe exclusivamente el **Pokémon activo**. El banquillo nunca recibe daño.
* **Efectividad de tipos defensiva (Decisión D8):** El daño recibido utiliza la misma función `getEffectiveness(tipos del enemigo, tipos del activo)` con suelo global `IMMUNITY_FLOOR = 0.25`. Como en el 96% de los cruces súper eficaces de `TYPE_CHART` quien golpea con ventaja también resiste o es neutral a la vuelta (Anexo A.3), el relevo ofensivo correcto refuerza de forma natural la supervivencia.
* **Daño por Fuga:**
  * `daño = leakDamage(piso) × getEffectiveness(tipos del enemigo, tipos del activo) × (1 − mitigación)`.
  * Es un valor **absoluto por piso** (no una fracción del `maxHp` del receptor), de modo que el `hpFactor` de la especie y los bonos de `MAX_HP` realmente importen.
  * **Invariante de calibración (D24):** Sustituye el antiguo valor fijo ("≈7 fugas") por una fracción calibrada de la horda total del piso: `leakDamage(f) = maxHpRef(f) / (LEAK_KILL_FRACTION * N(f))` con `LEAK_KILL_FRACTION = 0,30` (el 30% de la horda del piso filtrada neutral abate a un Pokémon de `hpFactor = 1.0` con HP lleno; `maxHpRef(f) = HP_BASE * (1 + (EXPECTED_TEAM_LEVEL(f) - 1) * HP_LEVEL_SCALE)`).
* **Golpe de Jefe Anclado (Decisión D1 adaptada, D26–D27):**
  * El daño escala según la **fase del jefe**, reduciendo el intervalo y añadiendo invocación de adds (aplicando siempre `getEffectiveness(tipos del jefe, tipos del activo) × (1 − mitigación)`):
    * **Fase 1 (100–66% HP):** 5% `maxHp` activo / 1,00 s.
    * **Fase 2 (66–33% HP):** 7% `maxHp` activo / 0,85 s + 6 adds.
    * **Fase 3 (33–0% HP):** 9% `maxHp` activo / 0,70 s + 8 adds.
  * Se mantiene como fracción del `maxHp` del receptor (sujeta a efectividad de tipos) porque el jefe actúa como un **reloj de presión táctica**, no como un chequeo de tanqueo puro.
* **Escudo 3★ de Entrada (`bastionShieldSec` → escudo del activo):** El efecto `SHIELD` del Ataque de Entrada 3★ (y el escudo de relevo de *Hada (2)* / *Acero (4)*) protege al Pokémon activo frente a fugas y golpes de jefe mientras dure.
* **Descarte de daño sobrante (*Overkill*):** Cuando un golpe reduce el `hp` del Pokémon activo a `0`, el daño sobrante **se descarta** y no se transfiere al Pokémon que entra por relevo forzado.

#### 4.4.3. Estado Debilitado, Cero Curas en Combate y Relevo Forzado
* **Cero curas fuera de Paradas (Decisión D10):** Se prohíbe cualquier regeneración pasiva o curación por impacto/relevo durante el combate o el respiro entre oleadas. Todas las mecánicas antiguas de curación (`BASTION_REGEN`, `UP_WALL`, *Planta*, *Hada*, *Terreno Herboso*) se eliminan o reconvierten en vida máxima (`MAX_HP`) y mitigación/escudos (§9.3.3, §9.4).
* **Debilitado (Decisión D9):** Al llegar a `hp ≤ 0`, el Pokémon pasa a `hp = 0, alive = false`. Su tarjeta en `TeamBar` muestra el sprite en escala de grises con la etiqueta **"Debilitado"** y queda bloqueada para el relevo.
* **Apagado de Pasivas y Sinergias (Decisión D9 confirmada):** Mientras un Pokémon está debilitado (`alive = false`), **su `BENCH_PASSIVE` y su contribución a las Sinergias de Tipo (§9.4) se desactivan por completo** (`FAINTED_PASSIVE_FACTOR = 0`). Perder a un miembro del equipo duele tanto en cobertura elemental como en poder pasivo del escuadrón.
* **Relevo Forzado (Decisión D16):** En el instante en que cae el activo, el motor selecciona al vivo con mayor `swapScore` (§9.3.6) y lo coloca en la arena sin activar el cooldown de 4 s y disparando su Ataque de Entrada. Si ningún Pokémon sigue vivo ⇒ `GAME_OVER` (`defeatCause = 'teamWiped'`).

#### 4.4.4. Paradas de Ruta (Decisiones D11–D14, D18)
* **Frecuencia (Decisión D11):** Se celebra una Parada **cada 10 pisos empezando en el piso 5** (`f >= 5 && (f - 5) % 10 === 0`: antes de los pisos **5, 15, 25, 35, 45…**, tanto en Campaña como en la Torre del Destino; constantes `SHOP_FIRST_FLOOR = 5`, `SHOP_EVERY_N_FLOORS = 10` *(ajustables)*). De este modo, cada Parada se sitúa exactamente a mitad de cada ciclo de 10 pisos (5 pisos antes del próximo Mini-Boss o Gran Boss), sirviendo como punto de avituallamiento y planificación del ciclo.
* **Flujo y Auto-omisión:** Al limpiar el piso `f − 1` y concluir el respiro (`INTER_WAVE_BREAK_SEC`), si al menos un Pokémon del equipo está herido (`hp < maxHp`) o debilitado (`!alive`), el juego entra en estado de parada (`state.shop`): **la siguiente oleada no se genera y se detienen todos los temporizadores** (pausa total sin límite de tiempo, respetando la filosofía idle). Si todo el equipo está al 100% de HP, la Parada **no abre el modal** y muestra un aviso breve (*"Parada superada — equipo al máximo"*).
* **Regla de Una Acción y Menú Fijo de 3 Servicios (Decisiones D12–D14 confirmadas):**
  * Cada Parada presenta siempre los mismos **3 servicios** (sin RNG de catálogo).
  * El jugador puede comprar **como máximo UN servicio** (o pulsar *Seguir sin comprar*), tras lo cual la Parada se cierra e inicia el piso `f`.
  * Los precios se expresan en múltiplos del **ingreso económico base por piso (invariante D23)** $W(\text{piso}) = \text{floorGoldIncome}(f) = 10 \times \text{enemyGoldValue}(f)$, independiente de "10 enemigos" ($\text{oro por enemigo} = W(f) / N(f)$, los adds pagan 0, D23), y se pagan con el **mismo oro** de la run (precios de Parada sin cambio):

| Servicio (`ShopServiceId`) | Efecto | Precio en Oro *(ajustable)* |
| :--- | :--- | :--- |
| `HEAL_ONE` (**Cura Individual**) | Restaura al **100% de `maxHp`** a un Pokémon **vivo** herido elegido por el jugador. | $\lfloor 1,0 \cdot W(\text{piso}) \times \text{fracción de barra restaurada} \rfloor$ |
| `HEAL_TEAM` (**Descanso Grupal**) | Todos los Pokémon **vivos** recuperan hasta **+40% de su `maxHp`** (sin superar el 100%). | $\lfloor 1,0 \cdot W(\text{piso}) \times \sum \text{fracciones restauradas} \rfloor$ |
| `REVIVE_ONE` (**Revivir**) | Devuelve a la vida a un Pokémon **debilitado** elegido con el **50% de su `maxHp`** (reactiva su pasiva y sinergias). | $\lfloor 2,5 \cdot W(\text{piso}) \times 1,25^{\text{revivesUsed}} \rfloor$ *(+25% acumulativo por cada revivir previo en la run)* |

* **Estados de disponibilidad:** Un servicio sin objetivo válido o sin oro suficiente aparece deshabilitado indicando el motivo (`NOBODY_HURT`, `NOBODY_FAINTED`, `CANT_AFFORD`).
* **Informe de Ruta (Decisión D18):** El modal de Parada incluye un panel de inteligencia con los **tipos elementales dominantes** del próximo bloque de 10 pisos (`beforeFloor` a `beforeFloor + 9`) y **la especie, tipos y fases del jefe intermedio (`beforeFloor + 5`, ej. piso 10, 20, 50…)** (calculado de forma pura mediante `previewWave(seed, floor)` sobre el canal `WAVE`). Esto convierte la elección del servicio en una decisión táctica informada (*"revivo a mi tipo Agua en el piso 55 porque en el 60 viene Arcanine"*).
* **Identidad visual (PMD):** Atendida por **Chansey** (`0113`) con su retrato y sprite de PMDCollab (y **Kecleon** `0352` reservado en backlog para futura tienda de servicios tácticos).

#### 4.4.5. Contratos de Datos de Vitalidad y Paradas
```ts
export type ShopServiceId = 'HEAL_ONE' | 'HEAL_TEAM' | 'REVIVE_ONE';

export interface ShopService {
  id: ShopServiceId;
  /** Para HEAL_ONE es el rango/coste por slot herido; para HEAL_TEAM y REVIVE_ONE el precio exacto. */
  price: number;
  slotPrices?: Record<number, number>; // precio exacto por slot elegible en HEAL_ONE / REVIVE_ONE
  available: boolean;
  reason?: 'NOBODY_HURT' | 'NOBODY_FAINTED' | 'CANT_AFFORD';
}

export interface RouteReport {
  fromFloor: number;
  toFloor: number;
  dominantTypes: PokemonType[];
  upcomingBoss?: { floor: number; definitionId: string; name: string; types: PokemonType[] };
}

export interface ShopState {
  beforeFloor: number;       // piso de parada (5, 15, 25…) que se generará al cerrar la parada
  services: ShopService[];   // menú fijo de 3 entradas
  routeReport: RouteReport;  // función pura de (seed, beforeFloor)
}

// En GameState:
// - Se eliminan `bastionHp` y `bastionMaxHp` (la Reserva del HUD se deriva de `team`).
// - Se añade `shop?: ShopState` (bloquea el spawn de la oleada mientras esté definido).
// - En GameInput: `shopAction?: { service: ShopServiceId; slot?: number } | { skip: true }`.

// En RunStats:
// faintLog: { slot: number; definitionId: string; floor: number; cause: 'leak' | 'boss'; killerType?: PokemonType }[];
// shopLog:  { floor: number; service: ShopServiceId; slot?: number; price: number }[];
// revivesUsed: number;
// defeatCause?: 'teamWiped' | 'bossTimerExpired';
```

---

## 5. Estructura de Pisos, Jefes (10 / 50 / 100) y Modos de Juego

### 5.1. Jerarquía de Pisos, Paradas y Anclaje de Jefes (Decisiones D1 y D11)

| Tipo de Piso / Evento | Pisos | Características del Encuentro |
| :--- | :--- | :--- |
| **Oleada Normal** | Pisos regulares (no múltiplos de 10 ni exigentes) | Flujo continuo de `N(f)` enemigos en ventana `S(f)` (≈60 s, ventana de spawn 40–55 s + cola de limpieza) avanzando en 360°, con tope de vivos simultáneos `ALIVE_CAP = 70`. |
| **Piso Exigente** | `f % 5 === 4` (no jefe: 4, 9, 14, 19, 24…) | Flujo intensificado previo a Parada o Jefe: `N_hard = 1,4*N`, `S_hard = 1,5*S` (duración ≈75–95 s), ráfagas concentradas con tope `ALIVE_CAP = 70`. |
| **Parada de Ruta** | **Cada 10 pisos desde el piso 5** (5, 15, 25, 35, 45…) | Pausa táctica a mitad de cada ciclo con Informe de Ruta (incluyendo el jefe del piso `f + 5`) y menú de 1 acción (`HEAL_ONE`, `HEAL_TEAM`, `REVIVE_ONE`, §4.4.4). |
| **Mini-Boss** | **Cada 10 pisos** (10, 20, 30, 40, 60, 70, 80, 90...) | Jefe de zona con HP por TTK (`bossHp(f) = BOSS_POOL_FACTOR * N(f) * enemyHp(f)` con `BOSS_POOL_FACTOR = 0.6`), cronómetro de **30 s** con `BOSS_TIMER_MODE` (`'enrage'` por defecto), 3 fases de combate (umbrales 66% y 33%) con recorte de daño, 1,5 s de invulnerabilidad entre fases, invocación de adds (6 en fase 2, 8 en fase 3) y flujo ligero de acompañamiento. Se ancla al perímetro central y golpea al activo según la fase (§4.4.2). Otorga botín y Sellos Gacha al ser **abatido** por primera vez. |
| **Gran Boss (Major Boss)** | **Pisos 50 y 100** (y cada 50 pisos en la Torre: 150, 200, 250…) | Jefes principales de hito con HP por TTK (`BOSS_POOL_FACTOR = 1.2`), cronómetro de **45 s** (piso 50) y **60 s** (piso 100) con `BOSS_TIMER_MODE` (`'enrage'`), 3 fases con recorte de daño e invulnerabilidad 1,5 s, adds, flujo ligero, anclaje escalado y cambio de fase elemental (§9.5) que exigen rotación táctica activa. |

* **Mecánica de Anclaje de Jefe (Decisiones D1, D7/D8, D26–D28):** Un jefe (Mini-Boss o Gran Boss) **nunca se autodestruye ni cuenta como "fuga" al tocar el centro**. Cuando alcanza `BASTION_DAMAGE_R` (24 px del centro), se detiene en el perímetro y **golpea periódicamente al Pokémon activo** con la fracción de vida y cadencia escalada de su fase actual (5% / 1,00 s en Fase 1; 7% / 0,85 s en Fase 2; 9% / 0,70 s en Fase 3, multiplicados por efectividad de tipos y mitigación; ver tabla por fase en §4.4.2) mientras el cronómetro de jefe sigue corriendo. Si el golpe debilita al Pokémon activo, se ejecuta el **Relevo Forzado** (D16) y el jefe continúa golpeando al nuevo activo. El fin del combate se rige por `BOSS_TIMER_MODE`: en `'enrage'` (por defecto), agotar el reloj enfurece al jefe (+50% daño cada 10 s) y la run solo concluye por `teamWiped`; en `'gameover'`, agotar el reloj provoca derrota inmediata. Superar el piso de jefe (y registrar su primera victoria para Sellos en `settleRun`) exige **reducir su HP a 0**.
* **Respiro entre oleadas:** al limpiar un piso el siguiente no aparece de golpe: hay **2,75 s de respiro** (la carga de Definitiva sigue corriendo; **no existe regeneración de HP**) antes de invocar el nuevo piso (o de abrir la Parada si el siguiente piso cumple `f >= 5 && (f - 5) % 10 === 0`). El jugador puede adelantarlo con el botón *Siguiente Piso* o desactivar el avance automático con el chip *AUTO* para esperar de forma indefinida.

### 5.2. Modo Campaña / Expedición por Biomas

| Bioma / Hito | Pisos | Tipos Predominantes | Mini-Bosses (Cada 10) / Grandes Bosses (50 y 100) |
| :--- | :--- | :--- | :--- |
| **1. Ruta Verde** | 1–20 | Normal, Planta, Volador | **Piso 10:** Pinsir · **Piso 20:** Snorlax |
| **2. Cueva Umbría** | 21–49 | Fantasma, Roca, Veneno, Tierra | **Piso 30:** Onix · **Piso 40:** Alakazam |
| **★ GRAN BOSS 50** | **Piso 50** | Fantasma / Siniestro / Roca | **Gengar Ancestral / Tyranitar:** Cambia sus resistencias elementales al 50% de HP. |
| **3. Monte Ígneo** | 51–79 | Fuego, Dragón, Lucha | **Piso 60:** Arcanine · **Piso 70:** Dragonite |
| **4. Costa y Ruinas** | 80–99 | Agua, Eléctrico, Psíquico, Acero | **Piso 80:** Gyarados · **Piso 90:** Metagross |
| **★★ GRAN BOSS 100** | **Piso 100** | Multielemental (Legendario) | **Mewtwo / Rayquaza:** Rotación de escudo elemental cada 25% de HP. **Superarlo desbloquea el Modo Infinito**. |

---

### 5.3. Modo Infinito: "Torre del Destino" (Endgame & Competitivo)

* **Desbloqueo Único:** Superar la Oleada 100 de Campaña por primera vez.
* **Mecánica Idéntica a Campaña:**
  * Los enemigos siguen soltando oro en tiempo real.
  * El jugador invierte oro en las 7 mejoras, en el Nivel de Equipo y en las **Paradas cada 10 pisos (5, 15, 25…)** con normalidad.
  * Mantiene Mini-Bosses cada 10 pisos y Grandes Bosses cada 50 pisos (50, 100, 150, 200...).
* **Diferenciación:**
  * **Registro de Récord:** la derrota (`teamWiped` o `bossTimerExpired`) termina el intento en **todos** los modos (§4.2); en la Torre, además, el piso alcanzado se registra como récord (y, en la Fase 4, en el Ranking Global).
  * **Mutadores de Piso (cada 10 pisos) y Terrenos:** modificadores que alteran el combate (ej. *Resistencia Extrema*, *Suelo Volcánico* —que ahora drena HP al Pokémon activo y puede debilitarlo—, *Inversión de Tipos*). Catálogo, reglas y apilado en §9.3 y §9.9.
* *(Roadmap)* **Modo Desafío Diario y Modo Nuzlocke:** Eventos competitivos con semilla fija (y variante Nuzlocke sin `REVIVE_ONE` en paradas, ver §8 Fase 5).

---

## 6. Arquitectura Técnica y Stack Tecnológico

### 6.1. Stack Seleccionado y Gestión con `pnpm`

| Capa | Solución Técnica | Justificación de Diseño |
| :--- | :--- | :--- |
| **Gestor de Paquetes** | **`pnpm`** | Instalaciones ultrarrápidas mediante hardlinks, gestión estricta de dependencias y ahorro masivo de espacio en disco. |
| **Empaquetador & Build** | **Vite** | Arranque instantáneo (HMR con esbuild), bundle de producción ultraoptimizado (Rollup) y plugins oficiales para PWA. |
| **Lógica del Juego** | **TypeScript Puro (Headless)** | Lógica desacoplada de la interfaz gráfica; permite pruebas automatizadas y validación idéntica en serverless. |
| **Capa de Render** | **Canvas 2D Nativo** | Renderizado pixel-art en viewport de 384×384 px lógicos (escalado por CSS). Consumo nulo de memoria de motores externos, determinista a 60/120 FPS. |
| **Interfaz & Menús** | **Preact + Tailwind CSS** | Huella mínima en bundle (~3 KB), reactividad instantánea para modales, cajas y árbol de ascensión. |
| **Gestión de Estado UI** | **Zustand** | Puente reactivo desacoplado entre el bucle a 60 FPS del Core y los componentes visuales de la UI. |
| **Audio** | **Howler.js** | Gestión robusta de audio web (desbloqueo en iOS/Android, canales de efectos y música de fondo). |
| **Almacenamiento Local** | **`idb-keyval` (IndexedDB)** | Persistencia asíncrona sin bloqueos del hilo principal ni límites de 5 MB de LocalStorage. |
| **Modo Offline & PWA** | **`vite-plugin-pwa` (Workbox)** | Permite instalar el juego como aplicación nativa y cachear sprites/audio para juego 100% desconectado. |

### 6.2. Arquitectura Desacoplada en 3 Capas

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. PURE TS GAME CORE (Headless, Lógica pura sin dependencias)│
│    - Fórmulas de daño, cálculo elemental, estados alterados │
│    - Spawn 360°, cronómetros de boss, economía y niveles   │
│    - Determinista: ejecutable en Node.js y Cloudflare/Edge  │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────────┐   ┌──────────────────────────────┐
│ 2. ARENA RENDERER (Canvas 2D) │   │ 3. UI REACTIVA (Preact/Tail) │
│    - Viewport 384x384 px      │   │    - Barra de Equipo (1-6)   │
│    - Sprites PMDCollab        │   │    - Tienda de Mejoras Oro   │
│    - Textos de daño flotante  │   │    - Santuario Gacha y Caja  │
│    - Proyectiles y partículas │   │    - Árbol de Ascensión      │
└───────────────────────────────┘   └──────────────────────────────┘
```

### 6.3. Validación Anti-Tamper (`RunProof`) para el Ranking Global

* Al concluir un intento en la Torre del Destino o superar un récord, el cliente genera un payload de telemetría compacta (`RunProof`):
  ```json
  {
    "player_id": "uuid-v4",
    "seed": 4928172,
    "run_duration_sec": 512,
    "final_floor": 142,
    "total_gold_earned": 2840000,
    "team_state": [{"id": "0006", "stars": 4, "team_level": 120, "alive": true}],
    "bastion_levels": {"UP_ARROW": 110, "UP_SPD": 65, "UP_MULTI": 4, "UP_AUTOCLICK": 5},
    "shop_log": [{"floor": 10, "service": "HEAL_ONE", "slot": 0, "price": 140}],
    "faint_count": 2,
    "manual_clicks": 850,
    "auto_clicks": 1300
  }
  ```
* **Comprobación Serverless Rápida (<5 ms)**:
  1. **Consistencia de Oro:** Verifica que el oro total ganado coincida matemáticamente con las 7 mejoras compradas, los niveles de equipo, **los servicios adquiridos en Paradas (`shop_log`, cuyos precios máximos están acotados por $W(\text{piso})$ y el escalado $\times 1,25^{\text{revives}}$)** más el saldo final.
  2. **Umbral Fisiológico de Tiempo:** Comprueba que la duración de la run no sea inferior al tiempo físico mínimo requerido: dado que el spawner emite enemigos a lo largo de la ventana temporal `S(f)`, un piso no puede completarse antes de `S(f)` ⇒ cota mínima de duración de run $\ge \sum S(f)$ más los respiros entre oleadas (mejora anti-trampa).
  3. **DPS Sanity Check:** Comprueba que el DPS teórico máximo de ese equipo y mejoras (separando `manual_clicks` y `auto_clicks` según la cota de cadencia de `UP_AUTOCLICK`) pueda eliminar al jefe del `final_floor` dentro de su temporizador considerando su TTK mínimo y las pausas de invulnerabilidad (1,5 s por cambio de fase) entre las 3 fases del jefe. La cota usa los **topes por categoría** del pipeline de modificadores (§9.3.1) y un presupuesto máximo de oro por fugitivos de botín (§9.6).
  4. **Reconstrucción determinista:** clima, terreno, mutadores, informe de ruta y eventos especiales son funciones puras de `(seed, bioma, piso)` (§9.1.1, §9.3.5); el servidor los recalcula con el mismo código (el menú de Parada es fijo y no consume RNG, D19). El payload añade `mode`, `autoSwap` y `schemaVersion`.
* La función serverless importa las mismas fórmulas matemáticas de `src/core/damage.ts` garantizando consistencia absoluta sin duplicar código.

---

## 7. Pipeline de Datos, Assets y Escalabilidad

### 7.1. Arquitectura "Data-Driven" (Zod + Schemas)

Para garantizar la escalabilidad y facilitar el añadido de nuevas generaciones de Pokémon (Gen 2, 3, etc.) sin tocar el código fuente del motor, cada especie se define mediante un esquema estricto validado con **Zod**:

```ts
export interface PokemonDefinition {
  id: string; // "0004"
  name: string; // "Charmander"
  generation: number; // 1
  types: [PokemonType] | [PokemonType, PokemonType];
  baseStats: {
    hp: number; // HP base canónico (PokeAPI), del que se deriva hpFactor en [0.6, 1.8]
    atk: number;
    spd: number;
    critRate: number;
    critDmg: number;
  };
  pattern: 'SNIPER' | 'AOE' | 'PULSE' | 'CHAIN';
  evolution?: { targetId: string; canonicalLevel: number };
  ultimate: { id: string; name: string; cooldownSec: number };
  benchPassive: { stat: string; value: number }; // stat: <TYPE>_DAMAGE | ALL_DAMAGE | MAX_HP | CRIT_RATE | ATTACK_SPEED | GOLD | CLICK_DAMAGE | ULT_CHARGE
}
```

* **Sustitución de `BASTION_REGEN` en el Roster (Decisión D10):** Para cumplir con la regla de cero curación fuera de Paradas, la primitiva de pasiva `BASTION_REGEN` se retira y se sustituye por **`MAX_HP`** (+% de vida máxima para todo el equipo). En concreto:
  * **Mudkip / Marshtomp / Swampert** (`0258`–`0260`): pasa a `['MAX_HP', 0.12]` (+6% / +9% / +12% HP máx. al equipo).
  * **Snorlax** (`0143`): pasa a `['MAX_HP', 0.20]` (+20% HP máx. al equipo).

### 7.2. Pipeline Automático de Ingesta (`pnpm run sync:pokemon`)

* **Script de Sincronización:** Un script automatizado en `scripts/sync-pokemon.ts` que se ejecuta mediante `pnpm`:
  1. Consulta la API de PokeAPI para extraer tipos elementales, estadísticas base (**incluyendo `hp` base** para calcular `hpFactor` en `[0,6 ; 1,8]`) y **niveles de evolución canónica**.
  2. Descarga los spritesheets de PMDCollab (`Walk-Anim.png`, `Attack-Anim.png` y `Normal.png`) correspondientes a las especies jugables, enemigos salvajes/jefes y **NPCs de Parada: Chansey (`0113`) y Kecleon (`0352`)**.
  3. Parsea `AnimData.xml` para resolver dimensiones de frame (`fw`, `fh`), duraciones y etiquetas `<CopyOf>`.
  4. Genera el manifiesto consolidado y el archivo de atribución `CREDITS.md`.

### 7.3. Balanceo Centralizado y Simulador Headless

* **Archivo de Configuración Único (`src/config/balance.config.ts`):** Todas las constantes de vitalidad (`HP_BASE`, `HP_LEVEL_SCALE`, `LEAK_BASE`), tarifas de Parada (`SHOP_FIRST_FLOOR = 5`, `SHOP_EVERY_N_FLOORS = 10`, `REVIVE_PRICE_GROWTH`, `REVIVE_HP_FRACTION`, `FAINTED_PASSIVE_FACTOR`), crecimiento de oro, multiplicadores de tipos, vida de bosses y probabilidades del Gacha residen en un solo archivo.
* **Simulador de Economía y Supervivencia (`pnpm run test:balance`):** Script de consola que ejecuta miles de oleadas en segundos simulando distintas políticas de relevo y compra en Paradas (`NO_SHOP`, `HEAL_FIRST`, `REVIVE_FIRST`, `SMART`, `CARRY`, `ROTATE`) para verificar las curvas antes de desplegar a producción.

### 7.4. Distribución de Sprites, Assets y Licencia

* **Estado actual (`HEAD 89abb76`):** `pnpm run sync:pokemon` ya descarga y sirve los sprites y retratos desde `public/sprites/` con `CREDITS.md` generado. En `3A.2-P` se añaden al listado de sincronización **Chansey (`0113`)** y **Kecleon (`0352`)**.
* **Carga por bioma:** se precargan las especies del bioma actual y del siguiente (§9.1.4) y se cachean con el service worker de la PWA.
* **Créditos:** los sprites fan-made de SpriteCollab exigen acreditar a sus autores. `sync:pokemon` genera `CREDITS.md` y la interfaz incluye una pantalla "Créditos".
* **Licencia:** según el README de SpriteCollab, las aportaciones de la comunidad se publican bajo **CC BY-NC 4.0** (uso no comercial); el arte original de Chunsoft y los Pokémon pertenecen a sus titulares. El proyecto es un fan project **no comercial** (pregunta P7, §9.10).

---

## 8. Hoja de Ruta (Roadmap de Desarrollo)

### Fase 1: Inicialización, Core Engine y MVP *(completada; commit `9eafe53`)*
* [x] Configuración inicial del repositorio con **pnpm**, **Vite**, **TypeScript**, **Preact** y **Tailwind CSS**.
* [x] Implementación del **Core Headless** determinista (fórmulas elementales, Nivel de Equipo unificado y evolución canónica).
* [x] Motor de render en **Canvas 2D** con arena simétrica cuadrada (384×384 px lógicos) y generación 360°.
* [x] Barra lateral de equipo (1-6) con mecánica de **Hot-Swap** y **Ataque de Entrada**.
* [x] Selector inicial de Pokémon (*Starter*).
* [x] Flujo de derrota con tarjeta viral de resultados (*Ficha de Entrenador*) y cálculo de Runas.

### Fase 2: Sistema Gacha, Despertar y Definitivas *(completada; commits `7a089f9` / `d800ce9`)*
* [x] **Santuario Gacha** con probabilidades por rareza (`60/30/8/2`) y contador de *Pity* (`30/80`).
* [x] Gestión de **Caja Pokémon (Colección)** para configurar el equipo de 6 con regla de línea evolutiva única (`getEvolutionChain`).
* [x] Sistema de **Estrellas de Despertar (1★ a 5★)**: desbloqueo de pasivas de banquillo (`2★`), estados de relevo (*Switch-In*, `3★`), evolución de patrón (`4★`) y *Aura Apex* (`5★` + doble pasiva). *(Contrato de datos `shinyOwned/shinyActive` listo en `META_VERSION = 2` para Fase 3C.)*
* [x] Implementación de la **Habilidad Definitiva** con enfriamiento por especie (`30/26/22 s`) acelerable con pasivas `ULT_CHARGE`.
* [x] Persistencia versionada y migración con `idb-keyval`.

### Fase 3: Mundo, Vitalidad Individual, Paradas, Modificadores y Torre *(actualizada en v2.6)*

> En `HEAD 89abb76` se completaron los bloques `3A.1` (suelo de inmunidad `×0.25` y responsive 1080p), `3A.3` (seguimiento `pointermove` y `UP_AUTOCLICK` con proyectiles dirigidos) y `3A.4` (RNG por canal, `EnemyDefinition`/`BiomeDefinition`, sprites locales y fondos procedurales `buildBackdrop`), además del anclaje de jefes D1 y el registro de victorias reales I2. En **v2.5**, el bloque `3A.2` introdujo `3A.2-V` y `3A.2-P`. En **v2.6**, antes de pasar a la Fase 3B y previo a la calibración final en el Simulador v3 (`3A.2-S` / WP7), se introduce el bloque **`3A.5 — Spawner continuo y Jefes por fases`** (WP1–WP6) para sustituir las oleadas en pulso por un flujo continuo determinista de ~60 s y dotar a todos los jefes de 3 fases mecánicas con recorte de daño, adds y reloj configurable.

#### 3A — Fundaciones del Mundo, Vitalidad Individual, Paradas y "Curva v2"
*Objetivo: que cada Pokémon tenga vida propia y el equipo sea la defensa, que curar/revivir ocurra solo en Paradas cada 10 pisos (desde el piso 5: 5, 15, 25…) compitiendo por el oro, y que el progreso dependa de abatir enemigos/jefes y rotar con cabeza.*

**Bloque 3A.1 — Higiene y Quick Wins de UX/Combate *(completado en `89abb76`)*:**
* [x] **Higiene de repositorio:** verificación de `pnpm test` + `pnpm build` en verde.
* [x] **Suelo de inmunidad global (`×0,25`)** en `getEffectiveness` (`min(producto de pares no inmunes, 0.25)`), eliminando los *soft-locks* del auto-disparo en el 52% del roster (§3.2, §9.5).
* [x] **Responsive del panel lateral a 1080p:** `h-dvh`, `min-height` de seguridad en el panel de Mejoras con scroll lateral general (A), layout de **2 columnas** (*HUD+Equipo* | *Mejoras*) en viewports panorámicos bajos (`min-aspect-ratio: 16/10` y `max-height: 1000px`) (B) y tarjetas de Equipo compactas en `≤800px` (C) (§3.3).

**Bloque 3A.2 — Reglas de Combate Base (D1, I2, D3) *(completado en `89abb76`)*:**
* [x] **Anclaje de Jefes en el perímetro central (D1):** el jefe no desaparece al llegar a `BASTION_DAMAGE_R`; se ancla y golpea cada segundo hasta morir o agotar su reloj (30/45/60 s).
* [x] **Victoria real sobre Jefes (I2):** `RunStats` registra `defeatedBossFloors` solo cuando `boss.hp <= 0`; `settleRun` otorga Sellos de primera victoria únicamente por jefes **abatidos**.
* [x] **Viabilidad Idle inicial (D3):** el auto-disparo inicial abate las primeras oleadas sin necesidad de clics.

**Bloque 3A.2-V — Vitalidad Individual por Pokémon (D6–D10, D15–D17) *(completado)*:**
* [x] **Salud por especie y Nivel de Equipo:** Añadir `baseStats.hp` y `hpFactor` (`[0,6 ; 1,8]`) en `PokemonDefinition`/`sync:pokemon`; calcular `maxHp` real en `createPlayerPokemon`, `upgradeTeamLevel` y evolución conservando el ratio `hp / maxHp` (§4.4.1). Colchón inicial para run de 1 Pokémon.
* [x] **Enrutado de daño al Pokémon activo:** Fugas (`LEAK_BASE(piso) × efectividad`) y golpes de jefe anclado (`BOSS_ANCHOR_MAX_HP_FRACTION × maxHp activo × efectividad`) dañan solo al activo; descarte del daño sobrante tras KO; Escudo 3★ sobre el activo (§4.4.2).
* [x] **Estado Debilitado, Relevo Forzado y `teamWiped`:** Al llegar a `hp ≤ 0` ⇒ `alive = false`, apaga `BENCH_PASSIVE` y Sinergias (`FAINTED_PASSIVE_FACTOR = 0`), ejecuta relevo forzado al mejor candidato vivo (`swapScore` + Ataque de Entrada, sin cooldown) o declara `GAME_OVER` (`defeatCause = 'teamWiped'`).
* [x] **Eliminación de Bastión global, curas y mejoras de HP:** Quitar `bastionHp/bastionMaxHp`, regeneración pasiva, **`UP_HP`** y **`UP_WALL`** (quedan **7 mejoras con oro**). Reconvertir la pasiva `BASTION_REGEN` de **Mudkip** (`+12%`) y **Snorlax** (`+20%`) a `MAX_HP`.
* [x] **UI de Vitalidad y Cementerio:** En `GameHUD`, barra del activo + **Reserva del equipo** (`Σ hp / Σ maxHp`, `N/M vivos`) + chip de próxima parada (`SHOP_FIRST_FLOOR = 5`, `SHOP_EVERY_N_FLOORS = 10`); estados visuales en `TeamBar`; `faintLog` y **Cementerio** en `GameOverModal` (§4.4.5). Tests unitarios de vitalidad, KO y relevo forzado.

**Bloque 3A.2-P — Paradas de Ruta e Informe de Ruta (D11–D14, D18, D19):**
* [ ] **Estado de Parada (`ShopState`) y flujo cada 10 pisos desde el piso 5:** Antes de los pisos `5, 15, 25, 35…` (`SHOP_FIRST_FLOOR = 5`, `SHOP_EVERY_N_FLOORS = 10`, condición `f >= 5 && (f - 5) % 10 === 0`), al terminar el respiro, abrir Parada bloqueando el spawn de oleada y temporizadores (o auto-omitir con aviso si nadie está herido ni debilitado).
* [ ] **Menú fijo de 3 servicios (1 acción por parada):** `HEAL_ONE` (100% HP, `1,0 W × fracción`), `HEAL_TEAM` (+40% HP a vivos, `1,0 W × Σ fracciones`) y `REVIVE_ONE` (50% HP, `2,5 W × 1,25^revivesUsed`) a través de `GameInput.shopAction` (§4.4.4).
* [ ] **Informe de Ruta determinista (`previewWave`):** Función pura sobre `(seed, floor)` que expone tipos dominantes del bloque de 10 pisos y datos del próximo jefe (`beforeFloor + 5`).
* [ ] **UI de Parada (`ShopModal.tsx`) y assets de NPC:** Modal con las 3 tarjetas de servicio, Informe de Ruta, botón *Seguir*, sprite de **Chansey (`0113`)** en `sync:pokemon`, chip **"Próxima parada: N pisos"** en HUD y registro en `shopLog`. Tests unitarios de paradas y precios.

**Bloque 3A.5 — Spawner continuo y Jefes por fases (WP1–WP6, D20–D28):**
* [ ] **WP1 — Configuración y Contratos de Datos (`balance.config.ts`, `types.ts`):** `ALIVE_CAP = 70`, `N(f)`, `S(f)`, pisos exigentes (`N ×1,4`, `S ×1,5`), `floorGoldIncome(f) = W(f)`, `goldPerEnemy(f) = W(f) / N(f)`, `bossHp(f)`, `BOSS_POOL_FACTOR`, `BOSS_PHASE_*`, `BOSS_TIMER_MODE: 'enrage'`, `LEAK_KILL_FRACTION = 0.30`, `EXPECTED_TEAM_LEVEL`, `BOSS_TRICKLE_ENABLED`. Tipos `SpawnEvent`, `FloorPlan`, `FloorRuntime`, fases de jefe (`bossPhase`, `bossInvulnSec`, `enraged`), `nextEntityId`. Retirar `WAVE_ENEMY_COUNT_BASE` y `BOSS_HP_MULTIPLIER`.
* [ ] **WP2 — Generador Puro de Planes de Piso (`floorPlan.ts` + tests):** Función pura `buildFloorPlan(seed, floor)` sobre canal `WAVE`; distribución temporal $t_i = S \cdot (i/N)^{0,85}$; ráfagas en pisos exigentes; ángulos estratificados con ángulo áureo y jitter $\pm 15^\circ$; nacimiento en `SPAWN_HALF_EXTENT` (208 px); pisos de jefe con jefe en $t=0$ y flujo ligero; `previewWave` sobre el plan.
* [ ] **WP3 — Integración del Spawner en el Bucle de Juego (`gameLoop.ts`):** Cola de spawn con retención de pendientes al alcanzar `ALIVE_CAP`; `waveEnemiesRemaining` derivado como valor espejo calculado `(pendientes + vivos)`; fin de piso por cola vacía y vivos no-fugitivos $= 0$; pausa de `elapsedSec` en Paradas e invulnerabilidad de jefe; eliminación de `generateWave`.
* [ ] **WP4 — Economía y Fugas Proporcionales:** Oro por enemigo $W(f) / N(f)$ con invariante $\sum \text{oro} \approx W(f) \pm 2\%$; adds pagan 0 oro; `leakDamageForFloor` por fracción de horda D24 (`LEAK_KILL_FRACTION = 0.30`); HP de enemigo recalibrado a 2–3 impactos en piso 1.
* [ ] **WP5 — Jefes con 3 Fases, Recorte Anti-One-Shot y Escalado:** Función unificada `applyDamageToEnemy`; fases al 66% y 33% con recorte estricto de HP al umbral e invulnerabilidad de 1,5 s con reloj pausado; escalado por fase (5%/1,0s, 7%/0,85s, 9%/0,7s); invocación de adds (0/6/8); flujo ligero de relleno ($0,4 \cdot N(f)$); modo de reloj `BOSS_TIMER_MODE` (`'enrage'` por defecto); chips y marcas de fase en HUD.
* [ ] **WP6 — Rendimiento y Legibilidad:** Medición de baseline; `nextEntityId` en `GameState`; textos flotantes de daño agrupados y único "+oro" periódico (0,25 s); render en un solo pase sin closures por frame y barra de HP selectiva (dañados, jefes o $<100\text{ px}$).

**Bloque 3A.2-S (WP7) — Simulador `pnpm run test:balance` v3 con Métricas por Zonas A–D y Calibración Definitiva:**
* [ ] **Políticas de bot completas:** `NO_SHOP`, `HEAL_FIRST`, `REVIVE_FIRST`, `SMART`, `CARRY`, `ROTATE` (§9.1.5) más bot de clics ergonómico con puntería.
* [ ] **Nuevas métricas por piso y zonas A–D:** Duración de piso (50–70 s en B, 75–95 s en exigentes), cola de limpieza, fracción de fugas $\phi$, bajas por clic vs. auto-disparo, TTK de jefe (15–45 s), % de HP de jefe quitado por Definitiva, daño recibido por Pokémon en combates de jefe y `aliveCount` máximo.
* [ ] **Calibración definitiva conjunta:** Ajuste de $N(f)$, $S(f)$, `enemyHp`, `enemyGoldValue`, `HP_BASE`, `HP_LEVEL_SCALE`, `LEAK_KILL_FRACTION`, `BOSS_POOL_FACTOR`, costes de Parada y fracciones de fase hasta satisfacer los 12 criterios de aceptación (§9.1.5).

**Bloque 3A.3 — Ergonomía de Puntero y Autoclick *(completado en `89abb76`)*:**
* [x] Entrada con `pointerdown` (hold-to-fire, máx. 4 clics/s; cubre ratón y táctil).
* [x] **Seguimiento `pointermove`** durante hold-to-fire en `App.tsx`.
* [x] **Mejora de Autoclick (`UP_AUTOCLICK`):** cadencia mejorable con oro en la run (`1 → 1.5 → 2 → 3 → 4` clics/s) disparando proyectiles hacia el cursor (escritorio) o punto fijado (táctil), separando `manual_clicks` y `auto_clicks` en `RunStats` (§3.2, §6.3).

**Bloque 3A.4 — Fundaciones del Mundo y Assets Locales *(completado en `89abb76`)*:**
* [x] **RNG por canal y por piso** (`WAVE`, `SPECIAL`, `COMBAT`) con `seed` propia de cada run (§9.1.1).
* [x] **`EnemyDefinition` y `BiomeDefinition`** data-driven; enemigos con especie real en el núcleo y eliminación del mapeo tipo→especie del renderer (§9.1.2–9.1.3).
* [x] **Biomas 1–4 definidos** (`biomes.ts`: Ruta Verde, Cueva Umbría, Monte Ígneo, Costa y Ruinas) con pesos de tipo por bioma.
* [x] **`pnpm run sync:pokemon`**: sprites locales en `public/sprites/` (fin del hotlink a `raw.githubusercontent.com`) y `CREDITS.md` (§7.4).
* [x] **Fondos procedurales pre-renderizados (`buildBackdrop`) y tema web por bioma** (§9.2).

**Criterios de aceptación de 3A (Simulador v3 + Vidas y Paradas):**
1. **La Parada importa:** El bot `SMART` supera a `NO_SHOP` en piso mediano y en jefes abatidos con margen **≥ 15%** *(ajustable)* en perfiles intermedio y máximo, y rinde igual o mejor que cualquier política fija (`HEAL_FIRST`, `REVIVE_FIRST`).
2. **Anti "carry único":** Con el mismo presupuesto, el bot `CARRY` (no releva salvo por KO forzado) queda **≥ 15% por debajo** de `ROTATE` en piso mediano.
3. **Presión sana y sin espiral irreversible:** En perfil intermedio, el equipo llega a cada Parada con HP medio del **40–70%** y **≤ 1 debilitado** en la mayoría de paradas; tras el primer KO, la probabilidad de terminar la run en los **2 bloques siguientes** es **≤ 60%** *(ajustable)*.
4. **Cero curas fuera de Parada:** Un test de 10 000 ticks verifica que $\sum \text{hp}$ nunca aumenta salvo por `shopAction` en una Parada.
5. **Métricas de bajas y determinismo:** Un bot **sin clics** (solo starter) abate ≥70% de los enemigos en los pisos 1–10 y **abate** al Mini-Boss del piso 10; misma `seed` ⇒ mismas oleadas, mismos Informes de Ruta y mismas Paradas.

#### 3B — Modificadores de Campo, Sinergias (Sin Curación) y Jefes Multifase
*Objetivo: que el relevo elemental tenga más razones ofensivas y defensivas para ocurrir. **Precondición obligatoria: no iniciar 3B antes de completar `3A.2-V`.***

* [ ] **Pipeline de modificadores** y `DamageContext` (§9.3.1) incluyendo `MAX_HP` y `DAMAGE_REDUCTION`.
* [ ] **Climas** (4) con calendario por bioma, banner, partículas y chip en el HUD (§9.3.2).
* [ ] **Sinergias de Tipo sin curación** (§9.4): solo cuentan Pokémon **vivos**; **Planta** y **Hada** implementadas con vida máxima, debilitación del daño enemigo y escudos de relevo.
* [ ] **Jefes multifase (cambio de tipos elementales por fase):** rotación de tipos en los pisos 50 y 100 sobre las 3 fases ya existentes introducidas en 3A.5 (§9.5).
* [ ] **Pista de Relevo** en la barra de equipo con término defensivo y penalización por HP bajo (§9.3.6).

**Criterios de aceptación:**
1. Un bot con el perfil "meta máxima" (`ROTATE` + `SMART`) abate los jefes y completa los pisos 1–100 en el simulador (con tasa de bajas ≥70%); con el perfil "primera run" no lo hace.
2. Con el mismo presupuesto de estrellas, ninguna composición de equipo (monotipo, bitipo, cobertura de 5+ tipos) tiene un piso mediano >15% superior al de las demás.
3. Ningún equipo puede quedarse a 0 de daño total contra ningún enemigo ni jefe (garantizado desde 3A.1 con `IMMUNITY_FLOOR = 0.25`).

#### 3C — Encuentros Especiales y Shiny
*Objetivo: momentos de sorpresa dentro de la run (con oro extra para financiar niveles o Paradas) y un coleccionable de suerte en el gacha.*

* [ ] **Director de Encuentros** sobre el canal `SPECIAL` del RNG (§9.1.1).
* [ ] **Fugitivos de Botín** (§9.6).
* [ ] **Shiny**: bandera independiente de las estrellas, tirada en el gacha, encuentro salvaje, *Hora Brillante*, *Resonancia Shiny* y Registro (§9.7).
* [ ] Audio mínimo con Howler (moneda, destello Shiny, aviso de fase de jefe, campana de Parada).

**Criterios de aceptación:**
1. Un fugitivo **no bloquea** el avance de piso ni daña al Pokémon activo, y un bot de 4 clics/s lo abate ≥70% de las veces mientras que un bot sin clics lo abate ≤10%.
2. Encuentro Shiny salvaje: frecuencia media de 1 cada 3–5 runs de longitud media (§9.7), máximo uno por run.
3. Misma `seed` ⇒ mismos fugitivos y mismos Shiny salvajes (apto para el Desafío Diario).

#### 3D — Torre del Destino y Automatización
*Objetivo: el endgame infinito con Paradas cada 10 pisos (desde el 5) y la rama Estratega.*

* [ ] **Modo Torre** (Infinito) con Paradas cada 10 pisos (5, 15, 25…), Mini-Bosses cada 10, Grandes Bosses cada 50 pisos y registro de récord local (§9.9).
* [ ] **Terrenos** (4, con *Terreno Herboso* otorgando `-20% daño recibido`) en pisos de jefe y en la Torre (§9.3.3) y **Mutadores** por década (con *Suelo Volcánico* drenando al Pokémon activo, §9.9).
* [ ] **Árbol de Runas funcional** (gasto de Runas como moneda en ramas Entrenador, Estratega y Explorador) incluyendo el **Relevo Automático Táctico** con su nivel inicial de **Retirada por HP bajo** (§4.3, §9.8).

**Criterios de aceptación:**
1. Pisos > 100 jugables sin cambios de código entre pisos (todo es dato: bioma cíclico, paradas cada 10 desde el 5, mutadores por década).
2. El relevo automático no oscila (≥6 s de permanencia mínima, histéresis del +25%, salvo retirada de emergencia por HP crítico) y rinde claramente peor que un jugador atento en un jefe multifase.

---

### Fase 4: Ranking Global Serverless y Desafíos
* Endpoint serverless ligero (Neon / Supabase / Cloudflare D1) para el Leaderboard.
* Validador matemático de telemetría `RunProof` (<5 ms) incluyendo verificación de `shop_log` y `faint_count`.
* Modo Desafío Diario (*Daily Dungeon*) con presupuesto inicial cerrado y semilla comunitaria.

**Requisitos heredados de la Fase 3 (sin ellos esta fase no es viable):**
* `RunProof` incluye `seed`, `mode`, `autoSwap`, `shop_log`, `faint_count`, `manual_clicks`, `auto_clicks` y `schemaVersion`; el validador reconstruye calendario de clima, terreno y mutadores con las mismas funciones puras que el cliente (§9.3.5).
* La cota de DPS y de oro del validador usa los **topes por categoría** del pipeline de modificadores, el coste de servicios en `shop_log` y un presupuesto máximo de oro por fugitivos (§9.6).
* El Desafío Diario deriva los canales `WAVE` y `SPECIAL` de la semilla diaria; el canal `COMBAT` queda local al jugador (§9.1.1).

---

### Fase 5: Backlog y Descartes Explícitos (sin compromiso de fecha)

#### Backlog General y Expansiones de Contenido
* Generaciones 2–4: gracias al pipeline de §7.2/§7.4 es añadir datos (especies, biomas, jefes), no código.
* Pasada de arte a mano de los fondos (sustituyendo el generador por biomas concretos, §9.2).

#### Backlog de Vidas y Paradas (con puerta de entrada explícita)
> **Puerta de entrada:** Ninguna de estas extensiones se diseña ni implementa hasta que el Simulador v3 (`3A.2-S`) y un playtest confirmen que la Parada básica de 3 servicios es divertida tal como está.

| Idea en Backlog | Descripción y Propósito |
| :--- | :--- |
| **Aguante** (nodo meta *Entrenador*) | El primer golpe letal que sufriría cada Pokémon por run lo deja a `1 HP` (*Endure* / Banda Focus / *Death Defiance*). Red de seguridad ideal para runs de 1 Pokémon. |
| **Retirada Automática** (Estratega, Nv. 0 del Relevo Automático) | Retira automáticamente al Pokémon activo cuando su HP cae por debajo de un umbral (ej. `< 20%`). Automatiza un reflejo defensivo, no una decisión de tienda. |
| **Descuento de Parada / 4.º Servicio** (nodo meta *Explorador*) | Reduce un `X%` los precios en Paradas o desbloquea un 4.º servicio táctico. Da un sumidero valioso a las Runas. |
| **Modo Nuzlocke** | Regla especial donde el servicio `REVIVE_ONE` está deshabilitado permanentemente. Con ranking propio y candidato a variante de Desafío Diario. |
| **Tienda de Servicios Tácticos (Kecleon `0352`)** | Servicios puntuales (no inventario) como tarjetas adicionales del menú de 1 acción: p. ej. *Éter* (Definitiva cargada al inicio del próximo jefe) o *Barrera* (escudo de 3 s al arrancar el próximo jefe). |
| **Objeto Equipado (1 por Pokémon)** | Bayas, Banda Focus, Restos… Es el sistema de mayor crecimiento en *PokéRogue*; alcance grande, a decidir en fases avanzadas. |
| **Cicatrices de Derrota** | Cada vez que un Pokémon es revivido pierde un `X%` de su `maxHp` por el resto de la run. Palanca alternativa si el escalado de precio `×1,25` no bastara en late game. |

#### Descartado Explícitamente (y por qué, para no reabrirlo sin motivo nuevo)
* **Regeneración pasiva en banquillo o entre oleadas:** Vacía de valor la Parada y viola la regla U5/D10.
* **Mejorar HP o Regeneración con oro ilimitado (`UP_HP` / `UP_WALL`):** Eliminados en v2.5; la vida máxima depende del Nivel de Equipo y la curación solo de las Paradas.
* **Consumibles guardados en un inventario usables en cualquier momento:** Convierte el panel lateral en un gestor de inventario y rompe la agilidad del formato idle.
* **Menú de servicios sorteado por RNG en cada Parada:** Añade frustración, reglas de lástima (*pity*) y complejidad de validación sin ganancia táctica frente al menú fijo (D12).
* **Revivir al 100% de HP o a coste fijo/gratis:** Anula la tensión del permadeath táctico.
* **Daño al banquillo o daño en área a todo el equipo:** Castiga llevar equipo completo y contradice el pilar de relevo táctico.
* **Mantener HP del Bastión *y* HP individual a la vez:** Dos barras de salud y dos condiciones de derrota simultáneas generan confusión.
* **Auto-compra en Paradas:** Automatizar qué servicio comprar o a quién revivir elimina la decisión central del sistema.
* **"Último aliento" (lanzar la Definitiva automáticamente al caer debilitado):** Suaviza la muerte justo cuando debe doler (revisitar solo si en playtest caer se percibe injusto).
* **Pasivas al 50% estando debilitado:** Suaviza la pérdida y complica la lectura en UI (D9).
* **Terrenos espaciales con parches en la arena, Shiny con estadísticas superiores, Sellos en fugitivos y tilesets extraídos de ROM PMD:** Descartados desde v2.3 (§9.2.1, §9.6, §9.7).

---

## 9. Diseño Detallado de las Fases 3+

> **Convenciones.** Los valores marcados *(ajustable)* son hipótesis de partida y deben calibrarse con el simulador (§9.1.5), no tomarse como definitivos. Todas las constantes viven en `src/config/balance.config.ts`; todas las tablas de contenido (climas, sinergias, mutadores, biomas) son **datos**, no código.

### 9.0. Veredicto sobre las ideas propuestas

| Idea | Veredicto | Fase | Qué cambia respecto a la idea original |
| :--- | :--- | :--- | :--- |
| **Vidas individuales y Paradas (v2.5)** | **Sí, núcleo de supervivencia.** Sustituye al Bastión global y a `UP_HP`/`UP_WALL`. | **3A (`3A.2-V/P/S`)** | Cero curas fuera de paradas (se reconvierten `BASTION_REGEN`, Planta, Hada y Herboso); `maxHp` sube con el Nivel de Equipo; menú fijo de 3 servicios cada 10 pisos (desde el 5: 5, 15, 25…). |
| Fondos temáticos (arena + web) | **Sí, pero procedurales.** PMDCollab **no sirve** para terrenos (§9.2.1). | 3A *(completado)* | Se genera el fondo por código con paleta y decorado por bioma; el tema de la web cuelga de las mismas variables. |
| Climas y Terrenos de piso | **Sí, pero fusionados con los Mutadores en un único sistema.** Clima primero, terreno después. | 3B (clima) · 3D (terreno) | El PRD ya tenía "Mutadores de Piso"; son la misma palanca. Se evita construir dos sistemas con la misma tubería. |
| Sinergias por tipo | **Sí, rediseñadas y sin curación.** | 3B | Solo cuentan Pokémon **vivos**; no duplican la `BENCH_PASSIVE` ni curan fuera de paradas. |
| Fugitivos de botín | **Sí. Mejor relación valor/coste.** | 3C | Pocas reglas, mucho efecto; su oro extra ahora alimenta el dilema entre Nivel de Equipo y Paradas. Solo dan oro, nunca Sellos. |
| Shiny (gacha + sinergia + evento) | **Sí, en tres capas independientes**, sin poder bruto. | 3C | Se desacopla del 5★ (la 5★ es Aura Apex). Captura de Shiny salvaje = opcional. |

**Orden crítico de dependencias:** `3A.2-V` (Vidas individuales) **debe completarse antes de empezar 3B (Sinergias)**, ya que las sinergias sólo cuentan Pokémon vivos y prohíben efectos de curación.

---

### 9.1. Fundaciones, Vitalidad y Simulador v3 (Fase 3A)

#### 9.1.1. RNG por canal y por piso *(implementado en `89abb76`)*
**Problema verificado (Anexo A):** antes había un único flujo `rng` compartido por críticos, probabilidad de disparo y generación de oleadas, con semilla fija `1`.

**Diseño:**
* Cada run genera una `seed` (uint32) al empezar; el Desafío Diario la recibe inyectada.
* Se derivan flujos independientes con un hash determinista `rngFor(seed, canal, piso)`:

| Canal | Alimenta | Estado |
| :--- | :--- | :--- |
| `WAVE` | Especies, tipos y ángulos de las oleadas, fases de jefe, **Informe de Ruta (`previewWave`)** | Puro por `(seed, piso)` |
| `SPECIAL` | Fugitivos, Shiny salvajes, mutadores y terrenos de la Torre | Puro por `(seed, piso)` |
| `COMBAT` | Críticos, probabilidad de disparo, efectos con azar | Con estado, local a la run |

* **Regla de oro:** nada que dependa de las acciones del jugador (clics, relevos, críticos, compras en Paradas) puede alterar `WAVE` ni `SPECIAL`. Como el menú de Parada es fijo (D12/D19), abrir o comprar en una Parada **no consume RNG**.
* Test: dos runs con la misma `seed` y secuencias de input distintas producen `deepEqual` las oleadas, los Informes de Ruta y los eventos del piso *N* mientras ambas sigan vivas.

#### 9.1.2. Enemigos con especie real *(implementado en `89abb76`)*
```ts
type EnemyKind = 'normal' | 'miniboss' | 'grandboss' | 'runner' | 'shiny';

interface EnemyDefinition {        // plantilla ligera: NO es un PokemonDefinition jugable
  id: string;                      // "0019"
  name: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  hpFactor?: number;               // 1 por defecto
  speedFactor?: number;
}

interface BiomeDefinition {
  id: 'RUTA_VERDE' | 'CUEVA_UMBRIA' | 'MONTE_IGNEO' | 'COSTA_RUINAS';
  name: string;
  floors: [number, number];
  typeWeights: Partial<Record<PokemonType, number>>;  // sesga la elección de especie
  wild: string[];                                     // ids de EnemyDefinition
  miniBosses: Record<number, string>;                 // piso -> id
  grandBosses?: Record<number, string | BossPhaseDef[]>; // §9.5
  weather?: WeatherPlan;                              // §9.3.2
  runners: string[];                                  // §9.6
  palette: BiomePalette;
}
```

#### 9.1.3. Biomas y plantillas iniciales *(implementado en `89abb76`)*

| Bioma | Pisos | Salvajes | Fugitivo | Mini-Bosses |
| :--- | :--- | :--- | :--- | :--- |
| Ruta Verde | 1–20 | Rattata `0019`, Pidgey `0016`, Caterpie `0010`, Weedle `0013`, Oddish `0043`, Bellsprout `0069`, Spearow `0021` | Meowth `0052` | 10 Pinsir `0127` · 20 Snorlax `0143` |
| Cueva Umbría | 21–49 | Zubat `0041`, Geodude `0074`, Gastly `0092`, Haunter `0093`, Sandshrew `0027`, Diglett `0050`, Koffing `0109` | Meowth `0052` | 30 Onix `0095` · 40 Alakazam `0065` |
| Monte Ígneo | 51–79 | Growlithe `0058`, Ponyta `0077`, Vulpix `0037`, Magmar `0126`, Mankey `0056`, Primeape `0057`, Dratini `0147` | Persian `0053` | 60 Arcanine `0059` · 70 Dragonite `0149` |
| Costa y Ruinas | 80–99 | Psyduck `0054`, Shellder `0090`, Staryu `0120`, Tentacool `0072`, Magnemite `0081`, Voltorb `0100`, Slowpoke `0079` | Persian `0053` | 80 Gyarados `0130` · 90 Metagross `0376` |

Gran Boss 50: **Gengar** `0094`. Gran Boss 100: **Mewtwo** `0150`.
**Torre (piso > 100):** `biomeAt(f) = campañaBioma(((f − 1) % 100) + 1)`.

#### 9.1.4. Sprites, assets y licencia
Ver §7.4. `sync:pokemon` incluye además los sprites de **Chansey (`0113`)** y **Kecleon (`0352`)** para la interfaz de Parada.

#### 9.1.5. "Curva v2" sobre Vitalidad Individual y Simulador `pnpm run test:balance` v3 (`3A.2-S`)
**Por qué un único recalibrado sobre el modelo nuevo:**
* En `HEAD 89abb76` ya se implementaron el anclaje de jefes (D1), las victorias reales sobre jefes (I2) y una primera curva `enemyHp(floor) = 10 × 1,085^(floor-1)` con daño de fuga como fracción del Bastión.
* Con la llegada de **Vitalidad Individual y Paradas** (D6–D19) y la **eliminación de `UP_HP` y `UP_WALL`**, calibrar contra el antiguo Bastión sería trabajo tirado. Por ello, el simulador pasa directamente a su **versión v3 (`3A.2-S`)** una vez implementados `3A.2-V` y `3A.2-P`.

**Riesgo n.º 1 a evitar en la calibración — El "Carry Único":**
* Si `HEAL_ONE` es demasiado barato y el daño esperado de un bloque de 10 pisos entre Paradas cabe entero en la barra de un solo Pokémon, relevar no compensa y los otros 5 Pokémon se vuelven decorado.
* **Invariante anti-carry:** El daño esperado por bloque de 10 pisos entre Paradas (en la frontera donde el jugador abate ≥70% de la oleada y sufre ~30% de fugas) se calibra en torno a **1,2–1,6× el `maxHp` del Pokémon medio** de ese piso, forzando al jugador a repartir el desgaste mediante relevos o a usar `HEAL_TEAM` / `REVIVE_ONE`.

**Políticas de bot del Simulador v3:**
* **Políticas de Parada:**
  * `NO_SHOP`: Nunca compra servicios en las Paradas (pasa siempre).
  * `HEAL_FIRST`: Prioriza `HEAL_ONE` / `HEAL_TEAM` siempre que pueda pagarlo.
  * `REVIVE_FIRST`: Prioriza `REVIVE_ONE` si hay algún caído; si no, no gasta.
  * `SMART`: Heurística informada por el `routeReport` (revive si hay un caído con ventaja frente al próximo bloque/jefe; si no, usa `HEAL_TEAM` cuando hay ≥2 heridos relevantes o `HEAL_ONE` sobre el activo/contratipo más dañado).
* **Políticas de Relevo:**
  * `CARRY`: Nunca releva manualmente (solo cambia cuando el activo cae debilitado por relevo forzado D16).
  * `ROTATE`: Releva activamente usando el `swapScore` ampliado con factor defensivo y umbral de HP (§9.3.6).

**El Arco de Dificultad en Cuatro Zonas Relativas (v2.6):**
Con el nuevo modelo de spawner continuo (Fase 3A.5), la dificultad se estructura en **cuatro zonas relativas** al piso final $F_{\text{end}}$ de cada perfil del simulador:

| Zona | Rango | Qué debe sentirse | Métricas objetivo (perfil "intermedio", calibrar en WP7) |
| :--- | :--- | :--- | :--- |
| **A · Tensión** | $1 \dots 0,15 \cdot F_{\text{end}}$ | Cuesta: casi no hay inversión. Un equipo fuerte o con pasivas activas la acorta. | Fracción de fugas $\phi \in [5\%, 20\%]$; cola de limpieza 10–25 s; duración de piso 55–80 s. Con build fuerte (equipo 3★–4★), $\phi \le 5\%$ en pisos 1–5. |
| **B · Dominio** | $0,15 \dots 0,55 \cdot F_{\text{end}}$ | "Destruyes cada oleada". | $\phi \le 3\%$; cola $\le 5\text{ s}$; duración $\approx$ ventana de spawn (45–65 s). |
| **C · Presión** | $0,55 \dots 0,85 \cdot F_{\text{end}}$ | Falta daño; cada clic y decisión cuenta. | $\phi$ sube de $3\%$ a $15\%$; cola 5→25 s; **el bot de 4 clics/s llega $\ge +15\%$ pisos más lejos que el de 0 clics con la misma build**. |
| **D · Colapso** | $> 0,85 \cdot F_{\text{end}}$ | Se acumulan fugas, cae el primer Pokémon, la run termina. | $\phi > 25\%$; tras el primer KO, fin de run en $\le 2$ bloques con probabilidad $\le 60\%$ (criterio 4). |

*Nota:* $\phi = \text{bajas por fuga} / N(f)$ (fracción de la horda).

**Los 12 Criterios de Aceptación del Simulador v3 (`pnpm run test:balance`):**
1. **La Parada importa:** `SMART` supera a `NO_SHOP` en piso mediano y en jefes abatidos con un margen **≥ 15%** *(ajustable)* en los perfiles intermedio y máximo, y `SMART` obtiene un resultado $\ge$ cualquier política fija (`HEAL_FIRST`, `REVIVE_FIRST`).
2. **Anti carry único:** Con el mismo presupuesto de equipo y mejoras, `CARRY` queda **≥ 15% por debajo** de `ROTATE` en piso mediano.
3. **Presión sana por bloque:** En el perfil intermedio, el equipo llega a cada Parada con un HP medio del **40–70%** y **≤ 1 Pokémon debilitado** en la mayoría de paradas; un perfil pasivo (que no releva a tiempo) llega con ≥ 2 debilitados.
4. **Sin espiral de muerte irreversible:** Tras sufrir el primer KO de la run, la probabilidad de terminar en `GAME_OVER` durante los **2 bloques siguientes** es **≤ 60%** *(ajustable)* en el perfil intermedio.
5. **Hitos objetivo por perfil (a revalidar en WP7):**
> *Revalidación en WP7:* Los hitos por perfil se conservan como punto de partida, pero deben revalidarse con pisos de ~60 s (10× más largos). En particular, que un bot *idle* puro (0 clics) supere la Parada del piso 5 y derrote al Mini-Boss del piso 10 implica ~10 minutos de run; dado que se asume un inicio duro y tenso en zona A, **se admite relajar el hito idle a superar la Parada del piso 5** si el simulador demuestra que exigir la victoria del piso 10 sin clics obliga a trivializar la zona A.

| Perfil en Simulador (`pnpm run test:balance` v3) | Hito objetivo (bajas ≥70% + jefes abatidos) |
| :--- | :--- |
| Primera run, solo starter (1★), **0 clics (Idle puro)** | Supera la 1.ª Parada (piso 5); hito de abatir al Mini-Boss del **piso 10** *a revalidar en WP7 (admite relajarse a superar la Parada del piso 5 para no trivializar la zona A)* |
| Primera run, solo starter (1★), **1,5 clics/s** | Piso **15–20** (llega a Snorlax en 3–5 min) |
| Equipo inicial de 3–4 Pokémon (1★–2★), **1,5–2,5 clics/s** | Piso **25–35** (supera Snorlax y entra en Cueva Umbría) |
| Meta intermedia (equipo de 6 a 2★–3★ + `ROTATE` + `SMART`) | Piso **50–65** (abate a Gengar en piso 50) |
| Meta máxima (equipo de 6 a 3★–4★ + `ROTATE` + `SMART` + Definitivas) | **Piso 100** (abate a Mewtwo) |

6. **Determinismo de Parada e Informe de Ruta:** Misma `seed` ⇒ mismas oleadas, mismos Informes de Ruta y mismas Paradas aunque el jugador tome decisiones distintas en cada parada.
7. **Cero curas fuera de Parada:** Test automatizado que recorre 10 000 ticks de combate verificando que $\sum \text{hp}$ nunca sube salvo al procesar un `shopAction` (o en una subida de nivel / evolución, donde el ratio `hp/maxHp` permanece invariante).
8. **Arco por zonas y duración de piso:** El perfil intermedio cumple rigurosamente las métricas de las zonas A, B, C y D. La duración mediana de un piso normal en zona B se sitúa en **50–70 s**; los pisos exigentes (`f % 5 === 4`) duran **75–95 s**; una run completa de 100 pisos del perfil máximo se completa en $\le 2,2\text{ h}$.
9. **El clic y la habilidad importan:** En zona C de presión, un bot de 4 clics/s con puntería alcanza $\ge \mathbf{+15\%}$ pisos adicionales frente a un bot de 0 clics con la misma composición y build.
10. **Anti-one-shot en Jefes:** Una Definitiva quita $\le 25\%$ del `maxHp` del jefe (mediana) y $\le 40\%$ (p95 con crítico); el combate dura $\ge 8\text{ s}$ (Mini-Boss) y $\ge 15\text{ s}$ (Gran Boss) en perfil intermedio. Para cualquier equipo extremo, ninguna instancia individual de daño salta más de una fase.
11. **Peligro real del combate de jefe:** El combate cuesta entre **$0,5$ y $1,0 \times$ el `maxHp` medio del Pokémon** en perfil intermedio; si se ignora el relevo táctico (`CARRY`), el Pokémon activo muere en $<10\text{ s}$ durante la fase 3.
12. **Invariantes del spawner (oro, tope de vivos y rendimiento):**
    * **Conservación de oro:** $\sum \text{oro de piso} \approx W(f) \pm 2\%$.
    * **Tope respetado:** $\text{aliveCount} \le \text{ALIVE\_CAP}$ (70) en el 100% de los ticks de todas las simulaciones.
    * **Rendimiento:** presupuestos de §5 de la spec ($\le 1\text{ ms/step}$ en core con 100 vivos y 30 proyectiles; 60 fps en renderer con `ALIVE_CAP` vivos).
    * **Determinismo:** misma `seed` $\Rightarrow$ mismo `FloorPlan`, mismos Informes de Ruta y mismos adds por fase, con secuencias de inputs distintas.

**Batería mínima de tests unitarios (`3A.2-V` y `3A.2-P`):**
* Enrutado de daño de fuga y de jefe anclado al Pokémon activo aplicando `getEffectiveness`.
* Descarte del daño sobrante (*overkill*) tras un KO sin dañar al Pokémon entrante.
* Relevo forzado al caer el activo (con candidatos vivos disponibles y sin candidatos ⇒ `teamWiped`).
* Pokémon debilitado (`alive = false`): no seleccionable en `hotSwap`, su `BENCH_PASSIVE` vale `0` y no suma para Sinergias de Tipo.
* `REVIVE_ONE`: restaura exactamente el 50% de `maxHp`, reactiva pasivas/sinergias e incrementa el precio del siguiente revivir en `×1,25`.
* Servicios de Parada desactivados con su `reason` correcto (`NOBODY_HURT`, `NOBODY_FAINTED`, `CANT_AFFORD`) y auto-omisión de la Parada cuando todo el equipo está al 100% de HP.
* Mientras `state.shop` está activo, no se generan enemigos ni avanzan los temporizadores.
* Subir `teamLevel` o evolucionar aumenta `maxHp` conservando el ratio `hp / maxHp`.

---

### 9.2. Fondos y Escenarios (Fase 3A; clima en 3B)

#### 9.2.1. ¿Son viables los sprites de terreno de PMDCollab?
**No directamente.** SpriteCollab (sprites.pmdcollab.org) contiene **sprites animados y retratos de Pokémon**, no tilesets de mazmorra. Los tilesets de PMD ("Dungeon Tilesets") son gráficos internos de los juegos que solo se obtienen extrayéndolos de la ROM (documentado, p. ej., en la wiki de SkyTemple). Además la licencia es un asunto aparte: el README de SpriteCollab indica que el arte aportado por la comunidad se publica bajo **CC BY-NC 4.0**, y el arte original de Chunsoft pertenece a sus titulares. Usar tiles extraídos de la ROM en un sitio público tiene bastante más riesgo que usar sprites de SpriteCollab con créditos.

| Opción | Coste | Riesgo / límite | Veredicto |
| :--- | :--- | :--- | :--- |
| **A. Procedural en Canvas** (paleta + ruido + decorado por bioma) | Bajo (~2 días) | Techo artístico moderado | **Recomendada para 3A** |
| B. Tilesets CC0 (OpenGameArt, Kenney…) recoloreados | Medio | Estilo distinto al de PMD; hay que acreditar según licencia | Plan B |
| C. Arte propio a mano (Aseprite) | Alto (tiempo del autor) | Máxima coherencia | Pasada futura (Fase 5), reemplaza A bioma a bioma |
| D. Tiles extraídos de la ROM PMD | Medio | **IP; no recomendable** | Descartada |

El generador se programa detrás de `BackdropId`, de forma que C pueda sustituir a A bioma a bioma sin tocar nada más.

#### 9.2.2. Especificación técnica
* **Pre-render:** `buildBackdrop(biome) → canvas 384×384` se construye **una vez** al cambiar de bioma. El renderer dibuja un único `drawImage` por frame (hoy `renderBackground` recorre 144 tiles por frame).
* **Capas del fondo:** (1) suelo en baldosas de 32 px con dos tonos; (2) micro-decorado disperso (matas, grietas, guijarros) por hash estable; (3) macro-decorado en las **cuatro esquinas** (árboles, estalagmitas, charcos de lava, palmeras): los enemigos nacen en una circunferencia de radio 192 y avanzan al centro, así que las esquinas del cuadrado nunca se pisan y no estorban a la lectura; (4) plataforma del Bastión con el tinte del bioma.
* **Legibilidad primero:** diferencia de luminosidad entre los dos tonos de suelo ≤15%; el decorado, menos saturado que los sprites; animación solo en elementos de esquina (antorchas/cristales, 2 fps).
* **Clima y tinte:** capa independiente por encima de sprites y debajo del texto flotante (§9.3.2). Las partículas son **solo de renderer** (≤60 simultáneas); no entran en `GameState`.
* **Transición de bioma:** fundido de 0,8 s y banner de 2 s con nombre y rango de pisos. Los pisos de Gran Boss oscurecen el borde (viñeta).
* **Determinismo:** el fondo no toca la simulación; usa su propio hash por `(bioma, posición)`.

| Bioma | Suelo A / B | Acento | Decorado de esquina |
| :--- | :--- | :--- | :--- |
| Ruta Verde | `#78c850` / `#68b840` (el actual) | `#e8d8a0` (camino) | Árboles, arbustos |
| Cueva Umbría | `#3a3550` / `#2f2b45` | `#8a6fd0` (cristales) | Estalagmitas, hongos luminosos |
| Monte Ígneo | `#7a3b2a` / `#5e2c20` | `#f08030` (lava) | Charcos de lava, rocas |
| Costa y Ruinas | `#d8c890` / `#c8b880` | `#58a8d8` (agua) | Palmeras, columnas rotas |

#### 9.2.3. Tema de la web
La página ya usa un fondo cuadriculado azul (`body` en `index.css`). Se parametriza con variables CSS controladas por `data-biome` en `<body>`: `--page-bg`, `--page-grid`, `--frame-accent`. Los paneles (`.pk-window`, `.pk-dark`) **no cambian** por bioma (legibilidad y coherencia); solo el fondo de página y el acento del marco de la arena. Coste: horas, no días.

---

### 9.3. Sistema de Modificadores (Fases 3B y 3D)

#### 9.3.1. Un único pipeline
Hoy `calculateDamage` recibe parámetros posicionales y cada multiplicador nuevo (pasivas de banquillo, clima, sinergias, runas, Hora Brillante) añadiría otro. Se sustituye por un pipeline único que también gobierna `MAX_HP` y `DAMAGE_REDUCTION`:

```ts
type ModSource = 'UPGRADE' | 'BENCH' | 'SYNERGY' | 'FIELD' | 'MUTATOR' | 'RUNE' | 'EVENT';
type StatKey = 'ATK' | 'SPD' | 'CRIT_RATE' | 'CRIT_DMG' | 'MAX_HP' | 'DAMAGE_REDUCTION' | 'GOLD' | 'ULT_CHARGE' | 'SWITCH_CD' | 'SWITCH_IN_DMG';
interface Modifier { source: ModSource; stat: StatKey; op: 'ADD' | 'MUL'; value: number; typeFilter?: PokemonType[]; }
interface DamageContext { attacker; defender; baseDmg; state; rng; modifiers: Modifier[]; }
```

**Política de apilado:**

| Categoría | Fuentes | Cómo combina dentro | Tope (para la cota de §9.3.5) |
| :--- | :--- | :--- | :--- |
| EQUIPO | Pasivas de banquillo (**solo vivos**) + Sinergias (**solo vivos**) | **Aditivo** | +100% (+60% en `DAMAGE_REDUCTION`) |
| CAMPO | Clima, Terreno | **Multiplicativo** por tipo | ×1,3 por fuente (×1,69 máx.) |
| META | Nodos del Árbol de Runas | Aditivo | Según árbol |
| EVENTO | Hora Brillante | Aparte, temporal | Duración acotada |
| MUTADOR | Mutadores de Torre | Multiplicativo (suelen ser negativos) | Sin tope (es dificultad) |

Entre categorías se **multiplica**. Los topes existen para que el validador de la Fase 4 pueda calcular un DPS máximo teórico sin simular.

#### 9.3.2. Climas (Fase 3B)
Principio de diseño: **un modificador de campo debe cambiar qué Pokémon quieres tener activo**, ser legible de un vistazo y ser predecible. Por eso el clima es *determinista* por bioma y piso, afecta al **daño del jugador por tipo** y nunca anula la tabla de tipos (×1,3 sobre un ×0,65 sigue siendo ×0,845).

| Clima | Efecto sobre el daño del jugador | Señal |
| :--- | :--- | :--- |
| Despejado | — | — |
| Sol Abrasador | Fuego ×1,30 · Agua ×0,80 | Tinte cálido, destellos |
| Lluvia | Agua ×1,30 · Fuego ×0,80 | Rayas diagonales |
| Tormenta de Arena | Roca / Tierra / Acero ×1,20 · Volador ×0,80 | Velo ocre, partículas horizontales |
| Nieve | Hielo ×1,30 · Planta ×0,80 | Copos |

**Calendario** (`weatherAt(biomeId, floor)`, función pura):

| Bioma | Calendario |
| :--- | :--- |
| Ruta Verde | 1–10 Despejado · **11–15 Lluvia** (introduce el sistema con banner explicativo la primera vez) · 16–20 Despejado |
| Cueva Umbría | 21–29 Despejado · 30–39 Tormenta de Arena · 40–49 Despejado |
| Gran Boss 50 y 100 | Despejado (la rotación de fases *es* la mecánica; no se superpone) |
| Monte Ígneo | 51–69 Sol · 70–79 Despejado |
| Costa y Ruinas | 80–89 Lluvia · 90–99 Nieve |

*Nota de diseño:* los jefes de piso múltiplo de 10 caen a menudo en un clima que potencia el tipo equivocado (Arcanine bajo Sol, Gyarados bajo Lluvia, Metagross bajo Nieve). Es deliberado: una "trampa legible" que premia leer la Pista de Relevo (§9.3.6). Los fugitivos (§9.6) no se ven afectados por clima.

#### 9.3.3. Terrenos (Fase 3D)
Se **difieren** a 3D y se alimentan de la misma tubería que los Mutadores. Diferencia con el clima, para que ambos merezcan existir: el **clima** altera el *daño por tipo*; el **terreno** altera una *mecánica* ligada a un patrón o a la mitigación defensiva (**sin curar nunca fuera de Paradas**, D10).

| Terreno | Tipo potenciado | Mecánica asociada |
| :--- | :--- | :--- |
| Eléctrico | Eléctrico ×1,3 | +1 rebote a patrones CHAIN |
| **Herboso** *(reconvertido v2.5)* | Planta ×1,3 | **Daño recibido por el Pokémon activo −20%** *(sustituye a la antigua regeneración ×2)* |
| Neblinoso | Hada ×1,3 · Dragón ×0,8 | Enemigos −10% de velocidad |
| Psíquico | Psíquico ×1,3 | Carga de Definitiva ×1,5 |

Se aplican a pisos de Mini-Boss y a la Torre. Máximo **un clima y un terreno** por piso. Regla de autoría para los jefes: el terreno no debe dejar al jugador sin ninguna respuesta útil; puede tentarlo con una trampa, nunca bloquearlo.

#### 9.3.4. Mutadores
Ver §9.9: comparten tipo `FieldModifier` y pipeline, y solo se activan en la Torre.

#### 9.3.5. Efecto en el validador (Fase 4)
Clima, terreno, mutadores e Informe de Ruta son funciones puras de `(seed, bioma, piso)` → el servidor los reconstruye con el mismo código. La cota de DPS usa los **topes por categoría** de §9.3.1 y la validación de oro incluye `shop_log` y el presupuesto máximo por fugitivos (§9.6).

#### 9.3.6. Pista de Relevo y `swapScore` Defensivo-Ofensivo
Función pura en el núcleo, reutilizada por la **Pista de Relevo en UI**, el **Relevo Forzado (D16)** y el **Relevo Automático Táctico (§9.8)**. Considera **únicamente Pokémon vivos (`alive = true`)** e incorpora un factor defensivo y de salud restante:

```
offense(slot, e) = eff(slot.tipos, e.tipos) · campo(slot.tipos)
defense(slot, e) = 1 / max(0.5, eff(e.tipos, slot.tipos))
hpFactor(slot)   = slot.hp / slot.maxHp < 0.25 ? 0.35 : (0.6 + 0.4 · slot.hp / slot.maxHp)

swapScore(slot)  = hpFactor(slot) · [ Σ_e w_e · offense(slot, e) · (defense(slot, e))^0.35 ] / Σ_e w_e
w_e = 1 + 2·(1 − dist_e / 192) · (×3 si es jefe)
```

* La barra de equipo marca el mejor candidato vivo con una flecha y un multiplicador (`"▲ ×1,4"`) cuando mejora ≥25% al activo, no está en enfriamiento **y tiene `≥ 25% HP`** (si tiene `< 25% HP`, la flecha se oculta en la UI para no sugerir un suicidio, aunque el Relevo Forzado D16 sí puede elegirlo si es la mejor opción restante).

---

### 9.4. Sinergias de Tipo (Fase 3B — Sin Curación)

**Problema de la idea original:** ya existe `BENCH_PASSIVE` (ej. *Charmander: +8% de daño Fuego al equipo*), que es un bonus de estadística al equipo. **Reparto de responsabilidades:**

| Sistema | Requiere | Aporta | Naturaleza |
| :--- | :--- | :--- | :--- |
| `BENCH_PASSIVE` | 2★ en esa especie (inversión) **y estar vivo** | Bonus **numérico** de estadística | Progresión por Pokémon |
| **Sinergia de Tipo** | Composición de Pokémon **vivos** (sin inversión) | Bonus **mecánico** (estado, rebote, relevo, mitigación, HP máx.) | Decisión de equipo y supervivencia |

**Reglas:**
* **Solo cuentan los Pokémon vivos (`alive = true`, Decisión D9):** Si un Pokémon cae debilitado, sus tipos dejan de sumar inmediatamente a las sinergias hasta que sea revivido en una Parada.
* Cuentan todos los slots vivos (activo + banquillo). Cada Pokémon vivo suma 1 a cada uno de sus tipos *actuales* (Charizard suma Fuego y Volador; cambia al evolucionar).
* Dos umbrales: **2** y **4** del mismo tipo (un equipo monotipo de 6 no obtiene más que el de 4).
* **Sinergia de Cobertura:** con **≥5 tipos distintos vivos** en el equipo ⇒ enfriamiento de relevo −25% y Ataque de Entrada +15%.
* **Prohibición de curación (Decisión D10):** Ninguna sinergia restaura HP. Los efectos de **Planta** y **Hada** se reconvierten a vida máxima (`MAX_HP`), debilitación del daño enemigo y escudos temporales.
* Se **derivan** del equipo vivo; no se persisten. Apilado aditivo en la categoría EQUIPO con tope +100% (§9.3.1).

**Primitivas de efecto** (todas sin curación):
`DMG_CRIT_CLICK`, `STATUS_ON_HIT(estado, prob)`, `ENEMY_WEAKEN`, `SLOW_AURA`, `CHAIN_BOUNCE`, `PIERCE`, `SPD`, `GOLD`, `ULT_CHARGE`, `MAX_HP`, `LEAK_REDUCTION`, `SWITCH_SHIELD`, `SWITCH_CD`, `SWITCH_IN_DMG`, `EXTRA_TARGET`.

| Tipo | 2 Pokémon vivos | 4 Pokémon vivos |
| :--- | :--- | :--- |
| Normal | +10% oro | +20% oro |
| Fuego | **+15% daño crítico en proyectil manual/autoclick** | Impactos queman (60% del impacto repartido en 3 s) |
| Agua | +15% radio de impacto y de AoE | Impactos mojan: −20% velocidad enemiga 3 s |
| **Planta** *(reconvertida v2.5)* | **+15% HP máx. a todo el equipo** | **Impactos debilitan al enemigo (−20% daño de fuga/jefe durante 3 s)** |
| Eléctrico | +1 rebote (CHAIN) o +1 perforación | Parálisis 8% (1 s; jefes la mitad) |
| Hielo | −10% velocidad enemiga (aura) | Congelación 5% (1,5 s; jefes inmunes) |
| Lucha | +15% daño de Ataque de Entrada | Ataque de Entrada ignora resistencias (mín. ×1,0) |
| Veneno | Veneno (DoT, apila hasta 3) | +25% daño a envenenados |
| Tierra | +1 perforación | Ataque de Entrada con +50% de radio |
| Volador | +10% velocidad de proyectil | La 1.ª fuga de cada piso no inflige daño al Pokémon activo |
| Psíquico | +15% carga de Definitiva | Cada relevo recarga 20% de la Definitiva |
| Bicho | +10% cadencia | +1 objetivo simultáneo |
| **Roca** *(adaptada v2.5)* | **+20% HP máx. a todo el equipo** | Daño de fuga recibido −40% |
| Fantasma | Enemigos abatidos explotan (10% de su HP máx.) | Explosión del 25% |
| Dragón | +10% daño global | +25% daño global (sustituye, no suma) |
| Siniestro | +5% prob. crítica | Críticos ignoran resistencias (mín. ×1,0) |
| Acero | Daño de fuga recibido −25% | Escudo de 3 s tras cada relevo |
| **Hada** *(reconvertida v2.5)* | **Relevos otorgan un escudo temporal de 1,5 s (o 10% HP máx. por 3 s) al entrante** | Enfriamiento de relevo −20% |

**Notas de implementación:**
* Cuando una sinergia de `MAX_HP` (*Planta (2)* o *Roca (2)*) se activa o desactiva en mitad de la run (p. ej. porque un Pokémon evoluciona y gana/pierde tipo Roca, o porque cae debilitado un Pokémon de tipo Planta), el `maxHp` del resto de Pokémon vivos se recalcula **conservando siempre su ratio `hp / maxHp` actual** (nunca cura ni mata por cambio de tope).
* **Criterio de calibración:** monotipo-4, bitipo y cobertura-5 deben quedar dentro de ±15% de piso mediano en el simulador con el mismo presupuesto de estrellas.

---

### 9.5. Jefes por Fases (66% / 33%), Anclaje y Escalado (Fases 3A y 3B)

```ts
interface BossPhaseDef {
  hpPct: number;                                   // fase activa mientras HP% >= hpPct
  types: [PokemonType] | [PokemonType, PokemonType];
  hint?: string;                                   // texto del banner
}
```

* **Generalización a 3 Fases para TODOS los Jefes (Fase 3A.5, D26):**
  Todos los jefes (Mini-Bosses cada 10 pisos y Grandes Bosses en pisos 50, 100 y Torre) disponen de **3 fases mecánicas estructuradas por los umbrales fijos del 66% y 33% de su `maxHp`**. Los Grandes Bosses 50 y 100 combinan además su rotación de tipos elementales en Fase 3B sobre esta base.
* **Recorte estricto de HP e Invariante Anti-One-Shot (`applyDamageToEnemy`):**
  Todo el daño a enemigos se canaliza a través de una única función pura en caliente `applyDamageToEnemy(enemy, amount, ...)`. Si una instancia de daño (proyectil, splash, quemadura, Definitiva o burst de relevo) reduciría el HP del jefe por debajo del umbral de fase activo (66% o 33%), **el HP se recorta exactamente en el umbral y el exceso se descarta**.
  * **Invariante (test):** Ningún ataque, incluida una Habilidad Definitiva con crítico o con equipo extremo, puede saltar más de una fase.
* **Transición e Invulnerabilidad Temporal:**
  Al cruzar el 66% o 33%, el jefe entra en **1,5 s de invulnerabilidad**. Durante este intervalo:
  1. El temporizador de jefe se pone **en pausa**.
  2. El jefe no golpea al Pokémon activo.
  3. El reloj del piso (`floorRuntime.elapsedSec`) se **congela**.
  4. Se despliega un banner de fase y se emite feedback visual/sonoro.
* **Tabla de Escalado por Fase y Adds (D27):**
  Cada fase endurece al jefe aumentando la frecuencia y contundencia del anclaje, e invocando una oleada de esbirros (*adds*):

| Fase | Umbral de HP | Golpe anclado (`× maxHp` activo) | Intervalo | DPS aprox. (% maxHp/s) | Adds al entrar |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fase 1** | 100%–66% | 5% | 1,00 s | 5,0% | — (0 adds) |
| **Fase 2** | 66%–33% | 7% | 0,85 s | 8,2% | `BOSS_PHASE_ADDS[1] = 6` adds |
| **Fase 3** | 33%–0% | 9% | 0,70 s | 12,9% | `BOSS_PHASE_ADDS[2] = 8` adds |

* **Reglas de los Adds de Jefe:**
  * Se emiten a través del spawner (`tier: 'add'`) con seed derivada por fase (`salt = fase`).
  * Respetan rigurosamente el tope de vivos `ALIVE_CAP` (si la arena está llena, esperan en cola).
  * **Pagan 0 de oro** (el botín está concentrado en `bossBounty(f)`).
  * Al morir el jefe, todos los adds supervivientes **desaparecen inmediatamente** sin recompensa ni penalización.
* **Flujo Ligero de Relleno en Combate de Jefe:**
  Durante los pisos de jefe se programa un flujo ligero $N_{\text{boss\_trickle}} = \text{round}(0,4 \cdot N(f))$ enemigos normales repartidos en la ventana de spawn, otorgando $0,15 \cdot W(f)$ de oro total. Mantiene la arena viva durante la aproximación inicial del jefe y exige priorizar objetivos (auto-disparo a la cercanía vs. clic manual al jefe). Se puede desactivar con `BOSS_TRICKLE_ENABLED = false`.
* **HP de Jefe por Tiempo Objetivo de Muerte (TTK, D25):**
  `bossHp(f) = BOSS_POOL_FACTOR * N(f) * enemyHp(f)` (`BOSS_POOL_FACTOR = 0.6` en Mini-Boss, `1.2` en Gran Boss). TTK objetivo mediano: 15–20 s (Mini-Boss), 25–30 s (Gran Boss 50), 40–45 s (Gran Boss 100).
* **Modo de Temporizador de Jefe y Estado Enfurecido (D28):**
  `BOSS_TIMER_MODE: 'gameover' | 'enrage' = 'enrage'` *(ajustable en `balance.config.ts`)*.
  * Modo `'gameover'`: la run termina de inmediato si el reloj expira (`defeatCause = 'bossTimerExpired'`).
  * Modo `'enrage'` (por defecto): al llegar el temporizador a 0, el jefe pasa a **enfurecido** (*Enraged*), multiplicando su daño anclado por $\times 1,5$ cada 10 s acumulativo sin tope. La run solo termina orgánicamente por aniquilación del equipo (`teamWiped`).
  * Temporizadores nominales: Mini-Boss **30 s** · Gran Boss 50 **45 s** · Gran Boss 100 **60 s**.
* **Rotación Elemental en Grandes Bosses (Fase 3B):**
  En los pisos 50 y 100, los jefes cambian además sus tipos elementales según `BossPhaseDef`, alterando las efectividades de daño y mitigación.

| Jefe | Fases (ejemplo de autoría) |
| :--- | :--- |
| Piso 50 · Gengar | 100–50%: Fantasma/Veneno (mejores: Tierra, Psíquico, Fantasma, Siniestro) → 50–0%: **Fantasma/Siniestro** "Ancestral" (mejor: **Hada**; Psíquico pasa a ser inmune ⇒ suelo ×0,25) |
| Piso 100 · Mewtwo | 100–75% **Psíquico** (Bicho, Fantasma, Siniestro) → 75–50% **Fuego** (Agua, Tierra, Roca) → 50–25% **Planta/Hielo** (×2,25 con **Fuego**) → 25–0% **Agua** (Planta, Eléctrico) |

---

### 9.6. Fugitivos de Botín (Fase 3C)

**Concepto:** un Pokémon ladrón (Meowth, *Día de Pago*) cruza la arena unos segundos. No ataca. Si se le abate, suelta mucho oro (**1,5× el oro de una oleada normal del piso**, `1,5 W(piso)`). En v2.5 este oro extra adquiere un valor táctico directo: puede financiar un `REVIVE_ONE` o una subida de Nivel de Equipo antes de la siguiente Parada, sin dejar de ser opcional (±10–15% de ingreso medio para un jugador atento y ≤3% para uno pasivo).

**Requisitos técnicos previos (los tres rompen el diseño si se ignoran):**
1. **No bloquea el piso.** Se cumple por construcción del spawner continuo (Fase 3A.5): la condición de fin de piso es que la cola de spawn esté vacía (`nextEventIdx === events.length`) y los enemigos vivos no-fugitivos sean 0 (`vivos no-fugitivo === 0`). El fugitivo queda excluido del cálculo de `waveEnemiesRemaining` y persiste hasta agotar su vida útil (7 s) aunque la oleada ya se haya limpiado o durante el respiro entre pisos.
2. **Daño sin tipo (`typeless`).** El fugitivo ignora la tabla de tipos y el clima (`eff = 1.0`); solo cuentan ATK, nivel y mejoras.
3. **No es objetivo del auto-disparo** mientras haya otros enemigos. Sí recibe AoE, rebotes, Definitiva y proyectiles manuales/autoclick.

**Reglas:**

| Parámetro | Valor inicial *(ajustable)* |
| :--- | :--- |
| Aparece en | Pisos normales ≥ 3; nunca en pisos de jefe |
| Probabilidad por piso | 12% + 3% por cada piso sin fugitivo (tope 40%); calculada con el canal `SPECIAL` |
| Frecuencia resultante | Aprox. 1 cada 6–7 pisos (la frecuencia se mide estrictamente en pisos, no en segundos) |
| Vida útil | 7 s; luego huye ("¡puf!") sin penalización |
| Trayectoria | Cuerda hacia el lado opuesto, sin pasar a menos de 90 px del centro, con ligero zigzag |
| HP | `RUNNER_HP_FACTOR` × HP de un enemigo del piso (calibrar con criterio de aceptación, no con un número) |
| Recompensa | **`1,5 W(piso)`** (`15 × enemyGoldValue(piso)`), afectada por `UP_GOLD` |
| Ayuda táctil | Radio de impacto manual ×1,5 sobre el fugitivo |
| Telegrafía | Aviso "!" al aparecer, estela de monedas, anillo con el tiempo restante, sonido de moneda |

**Criterio de aceptación de calibración:** un bot de 4 clics/s con puntería perfecta lo abate ≥70% de las veces; uno sin clics, ≤10%.

---

### 9.7. Shiny (Fase 3C)

**Cambio de modelo respecto al PRD v2.2:** el 5★ deja de otorgar el aspecto Shiny (pasa a **Aura Apex** dorada). Un Shiny es un coleccionable de **suerte**, no un escalón de progreso. Ambos pueden coexistir en la misma especie. El Shiny se compone de tres capas independientes:

```ts
interface CollectionEntry {
  speciesId: string; stars: 1|2|3|4|5; fragments: number;
  shinyOwned: boolean; shinyActive: boolean;
}
```

#### Capa 1 — Coleccionable (gacha)
* Tras resolver rareza y especie, tirada independiente `SHINY_PULL_RATE = 1/150` *(ajustable)*. La tasa se muestra en el Santuario (transparencia).
* Especie no poseída ⇒ se obtiene directamente en versión Shiny. Poseída y no Shiny ⇒ `shinyOwned = true` (además de los Fragmentos del duplicado). Ya Shiny ⇒ solo Fragmentos.
* **Sin garantía (pity) para el Shiny:** la gracia es la suerte.
* El jugador alterna el aspecto con `shinyActive`.

#### Capa 2 — Sinergia: *Resonancia Shiny*
Por cada Pokémon Shiny **vivo en el equipo de 6** (hasta 3): **+50% de probabilidad de encuentro Shiny salvaje** y **+3 s de Hora Brillante**. Se muestra como "???" hasta que se consigue el primer Shiny; entonces se revela en la ficha. **Los Shiny no dan estadísticas superiores.**

#### Capa 3 — Encuentro salvaje
* Tirada por enemigo salvaje normal (canal `SPECIAL`): base `SHINY_WILD_RATE = 1/1000` *(ajustable)*, × Resonancia × bonus de Explorador. **Máximo uno por run. Nunca en pisos de jefe.**
* **Aspecto y comportamiento:** destello y sonido al aparecer, banner "¡Un Pokémon Shiny salvaje!". Avanza como un enemigo normal (HP ×3); si llega al centro, **se escapa sin dañar al Pokémon activo** (solo se pierde la oportunidad).
* **Recompensa al abatirlo:**
  1. **Sellos de Reclutamiento** (`3` Sellos, equivalentes a 3 tiradas con `GACHA_PULL_COST = 1`).
  2. **Hora Brillante:** 12 s con **crítico garantizado, oro ×2 y carga de Definitiva ×2** (+Resonancia).
  3. *(Opcional, 3C-b)* **Captura:** 35% de convertir en Shiny esa especie **solo si ya la posees** y no es Shiny.

---

### 9.8. Relevo Automático Táctico (Fase 3D)

Para que no sea un trampolín a la oscilación ni sustituya al jugador:

* Reutiliza `swapScore` (§9.3.6), por tanto entiende efectividad ofensiva y defensiva, clima, fases de jefe, terreno y **salud restante** (solo evalúa Pokémon vivos).
* Cambia si el candidato mejora ≥ **25%** al activo (histéresis) y el activo lleva ≥ **6 s** en campo, **o de inmediato (respetando el cooldown de 4 s) si el activo cae por debajo del umbral de emergencia (`< 20% HP`)** y existe un candidato vivo con `≥ 50% HP`.
* Retardo de reacción de **1,2 s** tras un cambio de fase de jefe o de piso.
* No usa la Definitiva ni realiza compras en las Paradas (las Paradas siguen pausando la run para decisión manual o paso manual).
* Niveles en el Árbol de Runas (rama Estratega): **Nv1** Retirada de emergencia por HP bajo + rotación en pisos de jefe · **Nv2** rotación en todos los pisos · **Nv3** considera clima y terreno.
* `RunProof` incluye `autoSwap: boolean` para poder segmentar rankings si se desea.

---

### 9.9. Torre del Destino y Mutadores (Fase 3D)

* **Desbloqueo:** primera victoria sobre el piso 100 de Campaña. En la Torre la run **no se detiene** en el piso 100 (pregunta P2, §9.10).
* **Escalado en Torre ($f > 100$, Fase 3A.5 / D20–D21):**
  * El número total de enemigos de un piso normal se fija en el tope máximo $N = 110$.
  * La dificultad progresa por estadísticas (crecimiento exponencial de HP y daño) y reduciendo la ventana de spawn para aumentar la densidad de flujo: $S(f) = \max(35, 55 - 0,1 \cdot (f - 100))$ segundos.
  * **Tope de Vivos Inviolable:** Bajo ninguna circunstancia se supera `ALIVE_CAP` (70 enemigos vivos simultáneos en arena). Los enemigos que excedan el tope se retienen en la cola del spawner. La dificultad nunca escala por cantidad ilimitada de entidades.
* **Paradas y Jefes:** **Parada cada 10 pisos desde el piso 5 (`5, 15, 25…`)**; Mini-Boss cada 10 pisos; Gran Boss **cada 50** (50, 100, 150, 200…).
* **Mutadores:** conjunto activo que **se sustituye** cada década (pisos 101, 111, 121…) y crece en número: 1 mutador (101–150), 2 (151–250), 3 (251+). Se eligen con el canal `SPECIAL` sin repetir ni combinar incompatibles (Resistencia Extrema + Inversión).

| Mutador | Efecto |
| :--- | :--- |
| **Resistencia Extrema** *(antes Inmunidad Elemental)* | El daño del tipo anunciado se multiplica por **`×0,10`** (penalización severa que obliga a relevar pero sin anular a `0` ni romper la regla de no soft-lock). |
| Inversión de Tipos | `×1,5` ↔ `×0,65` (el suelo de inmunidad `×0,25` no se invierte). Máx. uno cada 50 pisos. |
| **Suelo Volcánico** *(adaptado v2.5)* | **El Pokémon activo pierde 1% de su `maxHp`/s** *(ajustable)* mientras no sea de tipo Agua, Tierra o Roca. **Sí puede debilitar al activo**, forzando a rotar a los tipos inmunes al suelo o gestionar la vida en las Paradas. |
| **Horda** *(redefinido v2.6)* | **$N \times 1,5$ y $\text{HP} \times 0,7$** por enemigo, **respetando rigurosamente `ALIVE_CAP`** (los enemigos que superen el tope esperan en cola). |
| Coraza | Enemigos con HP ×1,4 y oro ×1,4. |
| Veloces | Enemigos con +30% de velocidad. |

* Terrenos (§9.3.3) también rotan por década en la Torre.

---

### 9.10. Riesgos y Decisiones de Diseño Confirmadas

**Riesgos (incluyendo Vitalidad Individual, Paradas y Spawner/Jefes v2.6)**

| Riesgo | Impacto | Mitigación |
| :--- | :--- | :--- |
| **"Carry único"** (un solo Pokémon tanquea todo y se cura en cada Parada; los otros 5 son decorado) | **Crítico (invalidaría el sistema)** | Calibrar el daño esperado por bloque de 10 pisos entre Paradas ≈ **1,2–1,6× el `maxHp` del Pokémon medio**; precios de cura proporcionales a la fracción restaurada; criterio n.º 2 del Simulador v3 (`CARRY` ≥ 15% por debajo de `ROTATE`, §9.1.5). |
| **Espiral de muerte irreversible** (un KO apaga pasivas/sinergias ⇒ menos DPS ⇒ más fugas ⇒ más KO) | Alto | `REVIVE_ONE` siempre presente en el menú fijo de cada Parada; devuelve 50% de HP; precio escalado (`×1,25`) pero finito; criterio n.º 4 del Simulador v3 (≤ 60% de fin de run en los 2 bloques tras el primer KO). |
| **Fricción con la identidad Idle** (pausa cada 10 pisos desde el 5) | Bajo | Al ocurrir cada 10 pisos (`5, 15, 25…`), la pausa es poco frecuente, sin temporizador ni pérdida offline, y se auto-omite si nadie está herido ni debilitado (D11). |
| **Pérdida de lectura de "una sola barra"** | Bajo | En `GameHUD`, además de la barra del activo, se muestra la **Reserva del equipo** (`Σ hp / Σ maxHp` y `N/M vivos`, §3.3). |
| **Dureza en la primera run (1 Pokémon)** | Bajo | Colchón inicial de HP para equipo de 1 Pokémon (§4.4.1) + primera Parada antes del piso 5 + nodo *Aguante* en backlog. |
| **Fatiga de piso largo en idle** (pisos de ~60 s vs. ~6 s del MVP original) | Medio | La progresión sigue anclada por piso; el arco A–D (§2.4, §9.1.5) garantiza una fase B de dominio rápido y gratificante; el auto-disparo con proyectiles dirigidos y AoE escala naturalmente con la densidad de enemigos; diseño de mecánicas idle específicas tras la calibración (fuera de alcance de 3A.5). |
| **Ingreso por hora reducido** (alargamiento temporal de la run) | Medio | El ingreso total por piso $W(f)$ es el invariante económico absoluto (D23); los precios de Parada, mejoras y niveles de equipo están indexados por nivel de progreso y no por tiempo cronológico; si el ritmo de compras se percibe lento en el playtest, se calibran costes antes de inflar $W(f)$. |
| **Densidad de enemigos y rendimiento** (hasta 70 vivos simultáneos con `ALIVE_CAP`) | Alto | Tope estricto de vivos `ALIVE_CAP = 70` con retención en cola (D21); arena lógica de 384 px; paquete de optimizaciones WP6 (renderer en un solo pase sin closures, barra de HP selectiva, textos de daño agrupados y un único "+oro" agregado periódico cada 0,25 s). |
| **Timer de jefe como causa de muerte dominante** (combates más largos de 20–45 s) | Alto | La decisión D28 establece `BOSS_TIMER_MODE: 'enrage'` por defecto: al agotarse el tiempo el jefe entra en estado enfurecido (+50% daño de anclaje cada 10 s acumulativo sin tope), provocando que la run termine orgánicamente por aniquilación del equipo (`teamWiped`) y no por reloj artificial. |
| Suma de modificadores desbordada | Rompe balance y validación | Pipeline con topes por categoría (§9.3.1). |
| Sinergias monotipo dominantes | Contradice el pilar "equipo de 6 equilibrado" | Sinergia de Cobertura + criterio ±15% (§9.4). |

**Decisiones de diseño confirmadas (v2.3 a v2.6)**

| # | Pregunta / Decisión | Resolución confirmada |
| :--- | :--- | :--- |
| **P1** | ¿Desacoplar el Shiny de la 5★ (la 5★ pasa a *Aura Apex*)? | **Confirmado (Sí)** — Implementado en Fase 2. |
| **P2** | ¿La Torre continúa desde el piso 1 más allá del 100? | **Confirmado (Sí)** — Continúa desde el piso 1. |
| **P3** | ¿Cómo funcionan las Runas Ancestrales entre el bono pasivo y el Árbol? | **Confirmado (Moneda del Árbol)** — Las Runas se gastan como moneda en el Árbol de Habilidades; los bonos provienen de los nodos comprados. |
| **P4** | ¿Qué progresión e hitos por perfil buscamos? | **Confirmado** — Tabla de §9.1.5 medida por bajas reales (≥70%) y jefes abatidos. |
| **P5** | ¿Temporizadores de Gran Boss de 45 s (piso 50) y 60 s (piso 100)? | **Confirmado (Sí)** — 30 s Mini-Boss, 45 s Piso 50, 60 s Piso 100. |
| **P6 / D3** | ¿"Idle" significa que una run sin clics debe limpiar el inicio? | **Confirmado (Sí)** — El auto-disparo inicial limpia las primeras oleadas y abate al primer jefe (piso 10). |
| **P7** | ¿El proyecto es y seguirá siendo no comercial? | **Confirmado (Sí)** — CC BY-NC 4.0 con pantalla de Créditos. |
| **D1** | ¿Cómo se comporta un jefe al llegar al perímetro central? | **Confirmado (Anclaje)** — Se ancla en `BASTION_DAMAGE_R` y golpea cada 1 s al Pokémon activo hasta morir o agotar su reloj; los Sellos exigen abatirlo. |
| **D2** | ¿Cómo evitamos que "tanquear fugas" sea óptimo frente a hacer daño? | **Confirmado** — Sin mejoras `UP_HP`/`UP_WALL`, sin regeneración pasiva y con daño de fuga sobre la vida finita del Pokémon activo. |
| **D4** | ¿Cómo se integra el Autoclick ergonómico? | **Confirmado** — Cadencia comprable con oro en la run (`UP_AUTOCLICK` 1→4/s), cursor en escritorio y modo "fijar punto" en táctil (`89abb76`). |
| **D5** | ¿Inmunidad elemental `×0,25` global y qué pasa con el mutador de la Torre? | **Confirmado** — Suelo global `×0,25` siempre (`min(producto del resto, 0.25)`), y el mutador de la Torre pasa a *Resistencia Extrema* (`×0,10`). |
| **D6** | **¿El equipo es el Bastión?** | **Confirmado (Sí)** — Desaparece la barra global (`bastionHp/bastionMaxHp`); cada Pokémon tiene vida propia y la run termina cuando todos caen debilitados (`teamWiped`). |
| **D7** | **¿Quién recibe el daño enemigo?** | **Confirmado (El Pokémon activo)** — Todo daño (fugas y golpes de jefe anclado) lo recibe solo el activo; el banquillo nunca recibe daño. |
| **D8** | **¿El daño recibido usa efectividad de tipos?** | **Confirmado (Sí)** — `getEffectiveness(tipos enemigo, tipos activo)` con `IMMUNITY_FLOOR = 0.25`. |
| **D9** | **¿Qué ocurre cuando un Pokémon cae Debilitado (`hp ≤ 0`)?** | **Confirmado (Fuera de juego + apaga pasivas y sinergias)** — No recibe daño, no puede relevar y **su `BENCH_PASSIVE` y su aporte a Sinergias de Tipo se apagan por completo** (`FAINTED_PASSIVE_FACTOR = 0`) hasta ser revivido. Conserva el Nivel de Equipo común. |
| **D10** | **¿Existen curas fuera de las Paradas?** | **Confirmado (No — Cero curas fuera de paradas)** — Se elimina toda regeneración pasiva. `BASTION_REGEN` en Mudkip (+12%) y Snorlax (+20%) pasa a `MAX_HP`; Planta (2/4), Hada (2) y Terreno Herboso se reconvierten a `MAX_HP`, debilitación de daño enemigo y escudos/mitigación. |
| **D11** | **¿Cuándo ocurren las Paradas y cómo afectan al flujo?** | **Confirmado (Cada 10 pisos desde el piso 5, bloqueando la run)** — Antes de los pisos `5, 15, 25, 35…` (`SHOP_FIRST_FLOOR = 5`, `SHOP_EVERY_N_FLOORS = 10`, condición `f >= 5 && (f - 5) % 10 === 0`), pausa total sin límite de tiempo hasta elegir servicio o *Seguir*. Se auto-omite si nadie está herido ni debilitado. |
| **D12** | **¿Qué servicios ofrece cada Parada?** | **Confirmado (Menú fijo de 3 servicios; se elige 1 acción)** — `HEAL_ONE` (1 vivo al 100%), `HEAL_TEAM` (vivos +40% HP) y `REVIVE_ONE` (1 debilitado al 50% HP). |
| **D13** | **¿Cómo se fijan los precios de la Parada?** | **Confirmado (En ingresos de oleada $W(\text{piso})$ y escalado de revivir)** — $W = 10 \times \text{enemyGoldValue}(\text{piso})$; curas a $1,0 W$ proporcional a la fracción restaurada; revivir a $2,5 W \times 1,25^{\text{revivesUsed}}$. |
| **D14** | **¿Con cuánta vida vuelve un Pokémon revivido?** | **Confirmado (50% de `maxHp`)** — Canon de la saga y mantiene el peso de morir. |
| **D15** | **¿Qué pasa con `UP_HP` y `UP_WALL`?** | **Confirmado (Se eliminan ambas mejoras)** — El `maxHp` de los Pokémon sube automáticamente con el **Nivel de Equipo** (y evoluciones/pasivas `MAX_HP`), quedando **7 mejoras con oro** en el panel. |
| **D16** | **¿Qué ocurre en el instante en que cae el Pokémon activo?** | **Confirmado (Relevo Forzado)** — Entra automáticamente el mejor candidato vivo (`swapScore`), sin cooldown y disparando su Ataque de Entrada. Si no queda ninguno ⇒ `GAME_OVER`. |
| **D17–D19** | **¿Cementerio en Ficha de Entrenador, Informe de Ruta en Parada y `shopLog` en `RunProof`?** | **Confirmado (Sí a los tres)** — `faintLog` en el resumen de derrota, `previewWave` puro en el modal de Parada y `shop_log` en `RunProof` sin consumir RNG. |
| **D20** | **¿Cómo se generan los enemigos en el piso?** | **Confirmado (Flujo continuo $N(f)$ en ventana $S(f)$)** — Una oleada deja de ser un pulso de 10 enemigos. Cada piso normal es un flujo continuo determinista gobernado por `buildFloorPlan(seed, floor)` con $N(f) = \text{clamp}(\text{round}(8 + 1,0 \cdot f), 9, 110)$ y $S(f) = \min(55, 40 + 0,15 \cdot f)$. |
| **D21** | **¿Existe un límite de enemigos vivos simultáneos en arena?** | **Confirmado (`ALIVE_CAP = 70`)** — Tope estricto de enemigos simultáneos (arena 384 px, sprites a 48 px). Los eventos de spawn que excedan el tope se retienen en cola sin descartarse ni perderse. La dificultad escala por densidad y estadísticas, nunca por cantidad ilimitada de entidades. |
| **D22** | **¿Cuál es la duración objetivo de un piso y de una run?** | **Confirmado (Piso normal ≈60 s, exigente ≈75–95 s)** — Pisos exigentes (`f % 5 === 4`, antes de Parada y de Jefe) con $N \times 1,4$ y $S \times 1,5$. Run completa de 100 pisos ≈ 1,7–2 h. |
| **D23** | **¿Cuál es el invariante económico del juego?** | **Confirmado ($W(f)$ como invariante por piso)** — El ingreso total del piso $W(f) = 10 \times \text{enemyGoldValue}(f)$ es el invariante económico, no el oro por enemigo. `oro por enemigo = W(f) / N(f)`. Precios de Parada y recompensas de fugitivos se expresan siempre en $W$. |
| **D24** | **¿Cómo se calibra el daño de fuga?** | **Confirmado (Fracción de la horda `LEAK_KILL_FRACTION = 0.30`)** — Sustituye al antiguo invariante de "≈7 fugas fijas". `leakDamage(f) = maxHpRef(f) / (LEAK_KILL_FRACTION * N(f))`. |
| **D25** | **¿Cómo se calcula el HP de los jefes?** | **Confirmado (HP por TTK objetivo)** — `bossHp(f) = BOSS_POOL_FACTOR * N(f) * enemyHp(f)` (factor `0.6` miniboss, `1.2` gran boss). Se calibra para un TTK de 15–20 s (mini), 25–30 s (Gran Boss 50) y 40–45 s (Gran Boss 100). |
| **D26** | **¿Tienen fases todos los jefes y cómo se evita el one-shot?** | **Confirmado (3 fases 66% / 33% con recorte de HP)** — Centralizado en `applyDamageToEnemy`. Si un daño cruzaría un umbral, el HP se recorta exactamente al umbral (el exceso se descarta). 1,5 s de invulnerabilidad con reloj y `elapsedSec` en pausa. Ninguna Definitiva salta fases. |
| **D27** | **¿Cómo escalan las fases de jefe y qué aportan los adds?** | **Confirmado (Escalado de anclaje + invocación de adds)** — Cada fase acelera y endurece el anclaje (5%/1,0s, 7%/0,85s, 9%/0,7s) e invoca adds (`0 / 6 / 8`) a través del spawner (cola, 0 oro, desaparecen al morir el jefe). Flujo ligero $0,4 \cdot N(f)$ en la arena. |
| **D28** | **¿Cómo se comporta el temporizador de jefe al llegar a 0?** | **Confirmado (`BOSS_TIMER_MODE: 'enrage'` por defecto)** — Modo configurable `'gameover' | 'enrage'`. Por defecto en `'enrage'`: al agotarse el reloj el jefe enfurece (+50% daño cada 10 s acumulativo), terminando la run siempre de forma orgánica por `teamWiped`. |

---

## Anexo A. Estado Verificado del Proyecto (Fases 1, 2 y 3A)

### A.1. Auditoría inicial (commit `9eafe53`, cierre de Fase 1)
Auditoría hecha leyendo el código y ejecutando el núcleo real con `docs/analysis/sim-baseline.ts`. Leyenda: **E** = ejecutado · **C** = leído en código.

| # | Hallazgo original (Fase 1) | Estado tras `HEAD 89abb76` | Impacto restante |
| :--- | :--- | :--- | :--- |
| A1 | **El juego no es idle en la run inicial.** | **Resuelto en `89abb76`** (D3: `PROJECTILE_BASE_DAMAGE = 60`, auto-disparo limpia piso 1 y abate jefe p10). | Recalibrar en `3A.2-S` con vidas individuales |
| A2 | **Techo real ≈ piso 15–25** matando enemigos. | Curva preliminar en `89abb76` (`enemyHp ×1,085/piso`). | Cierre definitivo en `3A.2-S` |
| A3 | **La curva de HP no cierra con la del jugador** (`×1,18/piso` vs lineal). | Ajustada a `×1,085/piso` en `89abb76`. | `3A.2-S` |
| A4 | **RNG único y semilla fija = 1**. | **Resuelto en `89abb76`** (`src/core/rng.ts`: canales `WAVE`, `SPECIAL`, `COMBAT`). | — |
| A5 | **Los enemigos no tienen especie** (`'WILD'`/`'BOSS'`). | **Resuelto en `89abb76`** (`src/data/enemies.ts`, `src/data/biomes.ts`). | — |
| A6 | **La oleada exige `aliveEnemies.length === 0`**. | Vigente. | Fase 3C (§9.6 req. 1) |
| A7 | **Inmunidades dejan el daño en 0** (52% del roster afectado). | **Resuelto en `89abb76`** (`IMMUNITY_FLOOR = 0.25` en `getEffectiveness`). | — |
| A8 | **Sprites por *hotlink*** a `raw.githubusercontent.com`. | **Resuelto en `89abb76`** (`scripts/sync-pokemon.ts` → `public/sprites/` + `CREDITS.md`). | Añadir Chansey `0113` / Kecleon `0352` en `3A.2-P` |
| A9 | `howler` e `idb-keyval` sin uso. | `idb-keyval` resuelto en Fase 2; queda `howler`. | Fase 3C (audio) |
| A10 | Clic solo con `mousedown`. | **Resuelto en `89abb76`** (`pointerdown` + `pointermove` + `UP_AUTOCLICK`). | — |
| A11 | **Deriva PRD ↔ código** (arena 384 px, mejoras, etc.). | Reconciliado en v2.5 (ver A.3). | — |
| A12 | Pools de jefes incluyen Gen 2/3. | **Resuelto en `89abb76`** (`biomes.ts`). | — |
| A13 | `ARENA.SPAWN_MARGIN` no se usa. | Vigente (no bloqueante). | — |

### A.2. Auditoría Post-Fase 2 y Análisis del Simulador (commit `d800ce9`, 16-oct-2026)

1. **Verificación de Fase 2:** Completada al 100% en contratos de datos y funcionalidad.
2. **Separación de Bajas vs. Fugas en el Simulador (semillas 1–2):** Demostró que los jefes desaparecían al tocar el Bastión sin que expirase el reloj de 30 s y que comprar HP ganaba a comprar daño. Esto motivó las decisiones D1–D3 implementadas en `89abb76` y culmina ahora en el modelo de **Vitalidad Individual y Paradas** (D6–D19).
3. **Medición de Layout Responsive a 1080p:** Resuelto en `89abb76` y simplificado aún más en v2.5 al pasar de 9 a **7 mejoras con oro** (tras unificar `UP_CLICK` en `UP_ARROW` y eliminar `UP_HP` y `UP_WALL`).

### A.3. Hallazgos Verificados para Vitalidad Individual y Paradas (`HEAD 89abb76`, 17-oct-2026)

1. **La estructura de datos de vida individual ya existe en el código:**
   * `PlayerPokemon extends Entity` ya posee `hp`, `maxHp` y `alive` (hoy inicializados a `hp: 1, maxHp: 1` en `createPlayerPokemon` con el comentario *"shortcut: active Pokémon HP is unused"*).
   * `TeamBar.tsx` **ya renderiza** una barra de HP por cada Pokémon (`hpRatio`, `hpColor`).
   * Existe **un único punto de entrada de daño al jugador** en `gameLoop.ts` (sección 1 del tick): contacto de fuga y golpe periódico de jefe anclado, ambos ya filtrados por `bastionShieldSec`. Redirigir el daño al Pokémon activo es un cambio localizado y limpio.
2. **Medición sobre `TYPE_CHART` real: la efectividad defensiva refuerza el relevo ofensivo:**
   * De los **51 emparejamientos súper eficaces** (`A → B ×1,5`) en `src/core/damage.ts`, en **30 (59%)** `B` resiste o es inmune a `A`, en **19 (37%)** es neutral y solo en **2 (4%)** es mutuamente súper eficaz.
   * En consecuencia, en el **96%** de los casos el Pokémon que contrarresta ofensivamente a un enemigo también lo aguanta igual o mejor. Aplicar `getEffectiveness` al daño recibido aporta coherencia inmediata sin necesitar una tabla defensiva especial, mientras que la verdadera tensión táctica proviene del **HP finito + permadeath + oro compartido en las Paradas**.
3. **Reconciliación PRD ↔ Código (`HEAD 89abb76`):**
   * En `89abb76`, `UP_CLICK` ya fue absorbida por `UP_ARROW` (*Proyectiles*, +10%/nv tanto para clic/autoclick como para auto-disparo), `AUTO_SPD_BASE_MULT = 0.5` (+12%/nv con `UP_SPD`), `MULTI_MAX_LEVEL = 4` (tope 5 disparos), y ya existen `rng.ts`, `enemies.ts`, `biomes.ts`, `backdrop.ts` y `sync-pokemon.ts`. Con la eliminación en v2.5 de `UP_HP` y `UP_WALL`, el panel queda en **7 mejoras con oro**.

---

## Anexo B. Historial de Cambios del PRD

### De la v2.4 a la v2.5 (17-oct-2026)

| Sección | Cambio |
| :--- | :--- |
| Cabecera, §1, §2 | **El equipo es la defensa (D6):** desaparece la barra global del Bastión (`bastionHp/bastionMaxHp`); cada Pokémon tiene vida individual, puede caer debilitado y la run termina en `teamWiped`. Añadido el dilema de oro entre potencia y supervivencia en **Paradas de Ruta**. |
| §3.1, §4.4.3, §9.4 | **Penalización de Debilitado (D9) y cero curas en combate (D10):** un Pokémon debilitado (`alive = false`) no puede relevar y **apaga al 100% su `BENCH_PASSIVE` y su aporte a Sinergias de Tipo**. Prohibida toda curación fuera de Paradas. |
| §3.2, §4.1 | **Eliminación de `UP_HP` y `UP_WALL` (D15 confirmada) y sincronización con `89abb76`:** el `maxHp` de los Pokémon sube exclusivamente con el **Nivel de Equipo** (conservando el ratio `hp/maxHp`), su evolución (`hpFactor` de PokeAPI en `[0,6 ; 1,8]`) y bonos `MAX_HP`. Quedan **7 mejoras con oro** (`UP_ARROW`, `UP_SPD`, `UP_MULTI`, `UP_CRIT`, `UP_CDMG`, `UP_GOLD`, `UP_AUTOCLICK`). |
| §3.3, §4.2 | **HUD, Relevo Forzado (D16) y Cementerio (D17):** `GameHUD` muestra la barra del activo + **Reserva del equipo** (`Σ hp / Σ maxHp`, `N/M vivos`) + chip de próxima parada (`5, 15, 25…`). Caer debilitado dispara **Relevo Forzado** al mejor candidato vivo (`swapScore` + Ataque de Entrada). Añadido **Cementerio** (`faintLog`) en la Ficha de Entrenador. |
| **§4.4 *(nueva)*** | **Especificación completa de Vitalidad Individual y Paradas de Ruta:** fórmulas de `maxHp` y daño recibido con efectividad de tipos (D7, D8), paradas cada 10 pisos desde el piso 5 (`5, 15, 25…`, `SHOP_FIRST_FLOOR = 5`, `SHOP_EVERY_N_FLOORS = 10`) que bloquean la run (D11), **menú fijo de 3 servicios con 1 acción por parada** (`HEAL_ONE` al 100%, `HEAL_TEAM` +40%, `REVIVE_ONE` al 50% con precio $2,5 W \times 1,25^{\text{revivesUsed}}$, D12–D14), **Informe de Ruta** (`previewWave`, D18) con Chansey (`0113`) y contratos TypeScript. |
| §6.3, §7.1, §7.2 | **`RunProof` y Pipeline de Datos (D19):** añadido `shop_log` y `faint_count` a `RunProof`; añadido `baseStats.hp` en `PokemonDefinition`; sustituida la pasiva `BASTION_REGEN` de **Mudkip** (`+12%`) y **Snorlax** (`+20%`) por `MAX_HP`; incluidos Chansey (`0113`) y Kecleon (`0352`) en `sync:pokemon`. |
| §8, §9.1.5 | **Roadmap 3A actualizado (`89abb76` + bloques `3A.2-V`, `3A.2-P`, `3A.2-S`) y Simulador v3:** marcados como completados `3A.1`, `3A.3` y `3A.4`; definidos los 7 criterios de aceptación del Simulador v3 (bots `SMART`, `NO_SHOP`, `CARRY`, `ROTATE`, invariante anti-carry único) y el backlog con puerta de entrada en Fase 5. |
| §9.3, §9.4, §9.8, §9.9, §9.10 | **Reconversión de Terreno Herboso, Sinergias Planta/Hada y Suelo Volcánico:** *Terreno Herboso* pasa a `-20% daño recibido`; *Planta (2/4)* pasa a `+15% HP máx.` y `-20% daño enemigo por impacto`; *Hada (2)* pasa a escudo temporal en relevo; `swapScore` incorpora defensa y salud; *Suelo Volcánico* drena al activo; añadidas D6–D19 en §9.10 y Anexo A.3. |

### De la v2.3 a la v2.4 (16-oct-2026)

| Sección | Cambio |
| :--- | :--- |
| Cabecera, §8, Anexo A.2 | **Fase 2 marcada como completada** (`d800ce9`). Añadida auditoría post-Fase 2 del simulador (bajas vs. fugas) y de layout 1080p. |
| §3.1, §5.1, §9.5 | **Anclaje de Jefes (D1) y Sellos por baja real (I1, I2):** los jefes no se autodestruyen al tocar el Bastión; se anclan en el radio y golpean cada 1 s (`5–8%` HP máx.) hasta morir o agotar el reloj. Los Sellos de primera victoria exigen `bossKilled`. |
| §3.2, §9.5, §9.6, §9.9 | **Suelo de inmunidad global `×0,25` (D5, I6):** `getEffectiveness` aplica `min(producto de pares no inmunes, 0.25)` globalmente. El mutador de la Torre se redefine como *Resistencia Extrema* (`×0,10`). |
| §3.2, §4.1, §6.3, §8 | **Autoclick ergonómico (`UP_AUTOCLICK`, D4):** desbloqueo base permanente/simbólico + cadencia mejorable con oro en la run (1→4/s), disparo en cursor (escritorio) y modo "fijar punto" (táctil), seguimiento `pointermove` y separación `manual_clicks` / `auto_clicks` en `RunProof`. |
| §3.3, §8 | **Responsive 1080p:** red de seguridad con `h-dvh` y `min-height` en Mejoras, layout de 2 columnas en viewports panorámicos bajos (`min-aspect-ratio: 16/10`, `max-height: 1000px`) y tarjetas de Equipo compactas en `≤800px`. |
| §4.1 | **Sincronización PRD ↔ código (I4, I7) y fugas (D2):** nombres reales de mejoras (`Daño de clic`, `Muralla`, `Flechas`, `Codicia`, `Fortaleza`/`UP_WALL`), regeneración `3%/s` y daño de contacto por fracción del HP máx. del Bastión. |
| §4.3, §9.3.1, §9.10 | **Resolución P3 (Runas):** las Runas son moneda que se gasta en el Árbol de Habilidades, sin bono pasivo gratuito por acumulación bruta. |
| §8, §9.1.5 | **Reestructuración de Fase 3A en 4 bloques (3A.1–3A.4)** y nuevos criterios de aceptación basados en tasa de bajas (`≥70%`) y jefes abatidos. |

### De la v2.2 a la v2.3

| Sección | Cambio |
| :--- | :--- |
| Cabecera, §1, §3.3, §6.1, §6.2, Fase 1 | Arena 144 → **384 px lógicos** (centro `(192,192)`, radio 192). Fase 1 marcada como completada. |
| §1, §3.1 (fila 5★), Fase 2 | El 5★ otorga **Aura Apex**; el **Shiny** pasa a ser independiente (§9.7). *Único cambio que toca el alcance de la Fase 2: ver P1.* |
| §5.1, §5.3 | Gran Boss "cada 50" en la Torre; se retira "Muerte Súbita" como diferenciador. |
| §6.3 | Requisitos de `RunProof` derivados de las Fases 3 (seed por run, modificadores, fugitivos). |
| §7.4 *(nueva)* | Distribución de sprites y licencia. |
| §8 | **Fase 3 dividida en 3A–3D**; Fase 4 con requisitos heredados; **Fase 5** (backlog y descartes). |
| §9 *(nueva)* | Diseño detallado de las Fases 3+. |
| Anexo A *(nuevo)* | Estado verificado del proyecto. |

