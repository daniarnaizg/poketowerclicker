# PRD: PokéBastion — Pokémon Idle Defense & Gacha (v2.4)

Documento de Requisitos de Producto para un juego de defensa e incremento progresivo (*Roguelite Idle Defense*) con mecánicas gacha, rotación táctica elemental en tiempo real y arena simétrica.

| Atributo | Detalle |
| --- | --- |
| **Estado del Documento** | Borrador Consolidado (v2.4) — Fase 1 y Fase 2 completadas (commit `d800ce9`) · Fase 3A re-planificada tras auditoría de simulador (§8, §9, Anexo A) |
| **Plataforma** | Web App (Desktop & Mobile PWA) — 100% Client-Side Execution |
| **Tooling & Build** | **Vite** + **pnpm** + **TypeScript** |
| **UI & Estado** | **Preact** (o React) + **Tailwind CSS** + **Zustand** |
| **Motor de Render** | **Canvas 2D Nativo** (Arena 384×384 px lógicos, pixel-art determinista) |
| **Audio & Storage** | **Howler.js** + **`idb-keyval` (IndexedDB)** |
| **Arte y Assets** | PMDCollab (Sprites 8 direcciones, `AnimData.xml` y Retratos) |
| **Monetización / Infraestructura** | Servidores serverless de coste $0 / Cliente autónomo |

---

## 1. Visión General del Producto

### Concepto High-Level

Un juego web *Roguelite Idle Defense* con coleccionismo **Gacha** y gestión táctica de equipo. El jugador empieza eligiendo un Pokémon Inicial clásico, forma un escuadrón de **máximo 6 Pokémon por run** y defiende la posición central en una **arena cuadrada simétrica con un único Pokémon activo en pantalla a la vez**.

El jugador alterna en tiempo real (*Hot-Swap*) entre los miembros de su equipo para explotar debilidades elementales frente a oleadas de enemigos que avanzan en 360°, Mini-Bosses cada 10 pisos y Grandes Bosses en los pisos 50 y 100.

### Filosofía de Despliegue (Coste Cero / Bajo Mantenimiento)

Todo el bucle de juego, físicas, cálculo de daño y guardado primario se ejecutan 100% en el cliente (navegador). El backend es inexistente en el MVP (alojamiento estático puro) y, cuando se active el **Ranking Global**, consistirá únicamente en una API serverless ultraligera (<5 ms por validación) para registrar récords verificados.

### Diferenciación Clave

* **Un Único Pokémon Activo + Banquillo de 5:** Solo el Pokémon activo combate en el centro de la arena cuadrada; los otros 5 aguardan en la reserva listos para entrar al relevo y aportar sus bonificaciones pasivas de equipo (`BENCH_PASSIVE`).
* **Gacha con Propósito Táctico y Despertar (1★ a 5★):** Desbloquear duplicados no adelanta la evolución, sino que desbloquea pasivas de banquillo, potencia los ataques de entrada (*Switch-In Bonus*), amplía los patrones de disparo y desbloquea el *Aura Apex* (el aspecto *Shiny* es un coleccionable de suerte independiente, ver §9.7).
* **Rotación en Tiempo Real (Tag-In Elemental):** En el *mid/late game*, el jugador debe alternar qué Pokémon está en el campo en mitad de un combate para superar escudos elementales y contrarrestar tipos.
* **Evolución por Niveles Canónicos:** Cada Pokémon evoluciona durante la run en sus **niveles reales de los juegos originales** (ej. Charmander evoluciona a Charmeleon a Nv. 16 y a Charizard a Nv. 36; Caterpie a Nv. 7 y 10; Dratini a Nv. 30 y 55).
* **Economía Unificada de Equipo:** El oro intra-run sube un único **Nivel de Equipo**, garantizando que cualquier relevo sea tácticamente competitivo de inmediato.
* **Estética Mundo Misterioso (PMDCollab):** Sprites animados en 8 direcciones (`Walk-Anim.png`, `Attack-Anim.png`) y retratos expresivos (`Normal.png`).

---

## 2. Pilares de Diseño

1. **Coleccionismo Gacha Emocionante:** Conseguir Cupones/Gemas de Invocación derrotando jefes, superando hitos o abatiendo variantes *Shiny* para ampliar la Caja Pokémon y potenciar las estrellas del equipo.
2. **Profundidad Elemental y Equipo de 6:** El límite de **6 Pokémon por expedición** obliga a diseñar combinaciones equilibradas en tipos elementales (Fuego, Agua, Planta, Eléctrico, Psíquico, etc.) y patrones de ataque complementarios.
3. **Cambio Dinámico en Combate (Hot-Swap Viable):** Cambiar de Pokémon adapta instantáneamente el elemento activo, cadencia, patrón de disparo y Habilidad Definitiva sin penalizaciones de nivel.
4. **Bucle Roguelite Idle & Viralidad:** La derrota es real y genera una tarjeta de fin de run atractiva y compartible con estadísticas, récords y desafíos para competir socialmente.
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
| **2★ (Vínculo)** | **Pasiva de Banquillo Nv. 1** (`BENCH_PASSIVE`). | Otorga bonificación al equipo incluso estando en reserva (ej. *Charmander: +8% daño Fuego al equipo*). |
| **3★ (Técnica)** | **Ataque de Entrada Mejorado** (*Switch-In Bonus*). | La onda de relevo aplica estados (Quemadura, Parálisis, Ralentización o Escudo defensivo temporal). |
| **4★ (Perfección)** | **Evolución del Patrón de Disparo**. | Mayor radio AoE, proyectiles que rebotan +1 vez adicional o proyectil perforante. |
| **5★ (Apex)** | **Aura Apex (dorada)** + Duplica Pasiva. | Prestigio visual y maximización de la bonificación de banquillo. *(v2.3: el Shiny ya no depende de las estrellas; se obtiene por suerte, §9.7.)* |

---

### 3.2. Ficha Técnica y Estadísticas por Pokémon

Cada especie de la colección cuenta con atributos específicos que escalan con el Nivel de Equipo y las mejoras del Bastión:

* **Ataque Base (`ATK`):** Multiplicador de daño para el disparo automático y el clic.
* **Clic (bonus táctico) y Autoclick ergonómico:** El clic hace ~1.5×–2× el daño de un disparo automático del mismo ATK: acelera la run, pero **el auto-disparo por sí solo debe ser capaz de limpiar los primeros pisos** (el clic no es requisito para sobrevivir al inicio).
  * **Hold-to-fire gratis:** Mantener pulsado (`pointerdown` + seguimiento en `pointermove`) dispara un clic cada 250 ms (máx. 4 clics/s) siguiendo al puntero.
  * **Autoclick (ergonomía, Fase 3A):** Desbloqueo base permanente (o coste simbólico de Nv. 1) cuya **cadencia se mejora con oro en la run** (`UP_AUTOCLICK`: 1 → 1.5 → 2 → 3 → 4 clics/s, con tope por debajo o igual al hold manual). En escritorio dispara automáticamente en la posición del cursor (*hover*); en pantallas táctiles activa el modo **"fijar punto de apuntado"** (un toque fija la retícula y dispara solo hasta que se toque otro punto).
* **Velocidad de Ataque (`SPD`):** Cadencia base de disparo (ej. *Pikachu* alta cadencia; *Snorlax* cadencia lenta pero daño masivo).
* **Probabilidad y Daño Crítico Base (`CRIT` / `CDMG`):** Afinidad innata para asestar golpes críticos.
* **Patrón de Ataque (`PATTERN`):**
  * *Francotirador:* Proyectil veloz a larga distancia hacia los enemigos más cercanos al Bastión.
  * *Artillero (AoE):* Bombas parabólicas con explosión en área en zonas densas.
  * *Pulso / Cuerpo a Cuerpo:* Ondas expansivas de corto alcance y alto daño.
  * *Cadena / Rebote:* Proyectiles que saltan entre múltiples objetivos.
* **Tipo Elemental (1 o 2 tipos) y Suelo de Inmunidad Global (`×0.25`):** Multiplicadores de tabla de tipos (`×1.5` Súper Eficaz, `×0.65` No muy eficaz). Para evitar *soft-locks* cuando el auto-disparo apunta al enemigo más cercano, **no existe daño `×0` en combate normal ni contra jefes**: si *cualquier* par de tipos (atacante bitipo × defensor bitipo) tiene inmunidad canónica, la efectividad combinada se calcula como `min(producto de los pares no inmunes, 0.25)` (`IMMUNITY_FLOOR = 0.25`). Así nunca es peor que una doble resistencia severa ni produce un `0.25 × 0.25 = 0.0625`.
* **Habilidad Definitiva (Ultimate):** Movimiento insignia con **enfriamiento en segundos por especie** (30 s en la forma inicial, 26 s en la primera evolución, 22 s en la final; 26 s en especies sin evolución), acelerable con pasivas `ULT_CHARGE` (ej. *Llamarada*, *Hidrobomba*, *Tormenta Floral*, *Rayo*).
* **Nivel de Evolución Canónico:** Umbral de Nivel de Equipo requerido para evolucionar (ej. Lv. 16/36, Lv. 7/10, Lv. 30/55).

---

### 3.3. Geometría de la Arena Cuadrada y UI Lateral

#### Arena Cuadrada Simétrica (384×384 px lógicos)
Para evitar la asimetría de distancias de los lienzos panorámicos, la zona de combate es un **cuadrado perfecto**:
* El Pokémon activo se sitúa en el centro exacto `(192, 192)`.
* La distancia a cualquier borde exterior es idéntica en 360° (192 px de radio).
* Los enemigos emergen sobre una circunferencia de radio 192 centrada en la arena y avanzan hacia el centro con velocidades homogéneas. Las cuatro **esquinas** del cuadrado quedan fuera de esa circunferencia y no se recorren nunca: es el lugar del decorado de fondo (§9.2.2).

#### Panel Lateral de Control (Configurable Izquierda / Derecha y Responsive 1080p)
El resto de la pantalla alberga la interfaz:
* **Barra de Equipo de 6 Pokémon:** Retratos (`Normal.png`), tipo elemental, nivel de evolución actual, barra de HP y botón de relevo directo (*Hot-Swap* mediante clics o teclas 1 a 6).
* **Medidor de Habilidad Definitiva:** Botón activador (`Espacio` o clic secundario).
* **Controles de Mejora de Oro:** Botón único de *Nivel de Equipo* y lista de mejoras del Bastión.
* **Ajuste en Opciones:** Posición del Panel: *Derecha* (predeterminado) o *Izquierda* (modo accesibilidad / zurdos para juego móvil horizontal).
* **Diseño Responsive en Escritorio (1080p / Portátiles):**
  * **Red de seguridad vertical:** Uso de `h-dvh` en lugar de `h-screen`, `min-height` garantizado en el panel de Mejoras (al menos 3 filas + botón de Nivel de Equipo) y scroll en el contenedor lateral si el alto del viewport es insuficiente (evitando el colapso del grid de mejoras en 1366×768 o 1536×864).
  * **Layout de 2 columnas en viewports panorámicos bajos** (`min-aspect-ratio: 16/10` y `max-height: 1000px`, ej. 1920×969 con barra de navegador): el panel lateral aprovecha los ~600 px horizontales sobrantes dividiéndose en **dos columnas** (*HUD + Equipo* a la izquierda, *Mejoras* a la derecha), mostrando las 9+ mejoras sin scroll interno.
  * **Tarjetas de Equipo compactas** en alturas `≤ 800px` (1 fila o grid compacto con retrato y barra, ahorrando ~200 px verticales sin reducir el tamaño de la fuente *Press Start 2P*).

```
+--------------------------+-------------------------------------+
|                          |  [ Piso 45 ]  [ 00:23 / 30s ]       |
|                          |  HP Bastión: [====================] |
|     ARENA CUADRADA       |-------------------------------------|
|       (384 x 384)        |  EQUIPO (Hot-Swap 1-6):             |
|                          |  [1] Charmeleon (ACTIVO)            |
|       Enemigos 360°      |  [2] Wartortle  [3] Ivysaur         |
|             ↓            |  [4] Pikachu    [5] Gastly  [6] Aron|
|         [POKÉMON]        |-------------------------------------|
|             ↑            |  [DEF. LISTA: LLAMARADA (Espacio)]  |
|                          |-------------------------------------|
|                          |  NIVEL DE EQUIPO (Nv. 34) [Subir]   |
|                          |  MEJORAS DEL BASTIÓN (Oro)          |
+--------------------------+-------------------------------------+
   (Arena fija cuadrada)        (Panel lateral 1 o 2 cols según viewport)
```

#### Mecánica de Relevo en Combate (Hot-Swap)
* Pulsar sobre cualquier miembro del banquillo sustituye instantáneamente al Pokémon activo en el centro de la arena.
* **Enfriamiento breve (4 segundos):** Desencadena un **Ataque de Entrada (*Switch-In*)** del tipo elemental del Pokémon entrante, con daño y efectos adicionales si cuenta con 3★ o más.

---

## 4. Progresión, Economía y Fórmulas Base

### 4.1. Progresión Intra-Run (Con Oro)

#### Nivel de Equipo Unificado (Oro Intra-Run)
* El oro se invierte en una única estadística de nivel: el **Nivel de Equipo**.
* Todos los 6 Pokémon del escuadrón comparten este nivel en todo momento.
* **Evolución Canónica Durante la Run:** Cuando el Nivel de Equipo alcanza el nivel canónico de un Pokémon en los juegos originales, dicho Pokémon evoluciona visualmente y multiplica sus estadísticas base:
  * *Ejemplos tempranos:* Caterpie evoluciona a Metapod a Nv. 7 y a Butterfree a Nv. 10.
  * *Iniciales:* Charmander a Charmeleon a Nv. 16 y a Charizard a Nv. 36.
  * *Tardíos / Pseudo-legendarios:* Dratini a Dragonair a Nv. 30 y a Dragonite a Nv. 55.

#### Mejoras Globales del Bastión (Con Oro)

| Identificador | Nombre en UI (Alias diseño) | Función de Escalado |
| :--- | :--- | :--- |
| `UP_CLICK` | **Daño de clic** (*Golpe Firme*) | +10% daño y mayor radio de explosión al hacer clic por nivel (toma el elemento y `ATK` del Pokémon activo). |
| `UP_HP` | **Muralla** (*Vitalidad*) | +20 HP máximos del Bastión por nivel (con curación equivalente) y regeneración pasiva base de **3%/s** (`BASTION_REGEN_FRACTION_PER_SEC = 0.03`). |
| `UP_MULTI` | **Multidisparo** (*Ataque Múltiple*) | Comportamiento según el patrón de ataque (de 1 a 9):<br>• *Francotirador:* Dispara a `N` enemigos simultáneos.<br>• *Artillero (AoE):* Lanza `N` bombas parabólicas a distintos grupos.<br>• *Pulso:* Emite `N` ondas concéntricas.<br>• *Cadena:* El proyectil rebota `N` veces adicionales. |
| `UP_ARROW` | **Flechas** (*Potencia Elemental*) | +8% daño base del proyectil del Pokémon activo por nivel. |
| `UP_SPD` | **Cadencia** | +5% velocidad de ataque global por nivel. |
| `UP_CRIT` / `UP_CDMG` | **Precisión / Furia** | +1% prob. de crítico (tope 90%) y +10% multiplicador de daño crítico por nivel. |
| `UP_GOLD` | **Codicia** (*Amuleto Moneda*) | +10% oro obtenido por enemigo eliminado por nivel. |
| `UP_WALL` | **Fortaleza** | +10% de HP máximo del Bastión por nivel (con curación inmediata equivalente). |
| `UP_AUTOCLICK` | **Autoclick** *(Fase 3A)* | Dispara clics automáticos en el cursor (escritorio) o punto fijado (táctil); subir nivel aumenta la cadencia (1 → 1.5 → 2 → 3 → 4 clics/s). |

* **Presión de piso, fugas y respiro (Decisión D2):** para evitar que la estrategia óptima sea comprar solo HP (`UP_HP` / `UP_WALL`) y avanzar pisos "tragándose fugas" sin matar enemigos, el daño de contacto al filtrarse un enemigo escala como **fracción del HP máximo del Bastión + escalado por piso** (de modo que tanquear una oleada entera sin bajas destruya el Bastión). La regeneración pasiva del Bastión se pausa durante el *respiro* entre oleadas (la carga de Definitiva sigue corriendo).

---

### 4.2. Flujo de Derrota y Bucle Roguelite (Idle vs. Competitivo)

1. **Condición de Fin de Run (*Game Over*)**:
   * Si la salud del Bastión llega a 0 **o** expira el cronómetro frente a un Mini-Boss o Gran Boss, la run termina inmediatamente. No existe retroceso de oleada pasivo infinito.
2. **Pantalla de Resumen y Viralidad Social**:
   * Al caer, se despliega una tarjeta de resultados estilizada (*Ficha de Entrenador*):
     * Piso máximo alcanzado y enemigo abatidor.
     * Gráfica de contribución y daño del equipo (con el Pokémon MVP animado).
     * Runas de Ascensión ganadas calculadas automáticamente.
     * Botón de **Compartir Récord** (genera un enlace o captura para redes con llamada de desafío).
3. **Automatización para Farmeo (Árbol de Runas - Rama Estratega)**:
   * Los jugadores avanzados pueden desbloquear en el meta-árbol la opción de **Relevo Automático Táctico**: rota automáticamente de Pokémon si el objetivo actual resiste el elemento activo o presenta debilidad elemental frente a un miembro del banquillo.

---

### 4.3. Meta-Progresión (Ascensión y Árbol de Habilidades)

* **Fórmula base de Runas Ancestrales**:

$$\text{Runas} = \left\lfloor \left(\frac{\text{OleadaMax}}{5}\right)^{1.5} \right\rfloor$$

* **Modelo económico de las Runas (Resolución P3):** Las Runas son **moneda que se gasta** en el Árbol de Habilidades (no otorgan un bono pasivo gratuito por mera acumulación, evitando una inflación pasiva de +356% al llegar al piso 100). Los bonos de daño global y utilidad provienen de desbloquear nodos en las 3 ramas del Árbol:
  * **Entrenador:** Potenciación de estadísticas base de los Pokémon, velocidad de recarga de la Definitiva y desbloqueo base del Autoclick ergonómico.
  * **Estratega:** Reducción de enfriamiento de *Hot-Swap*, potencia del *Switch-In Bonus* y Relevo Automático Táctico.
  * **Explorador:** Aumento de drop de oro, probabilidad de enemigos *Shiny* y Cupones Gacha adicionales.
* **Persistencia:** Los Pokémon de la Caja, sus Estrellas de Despertar y las mejoras del Árbol de Runas se conservan permanentemente.

---

## 5. Estructura de Pisos, Jefes (10 / 50 / 100) y Modos de Juego

### 5.1. Jerarquía de Pisos y Anclaje de Jefes (Decisión D1)

| Tipo de Piso | Pisos | Características del Encuentro |
| :--- | :--- | :--- |
| **Oleada Normal** | Todos excepto múltiplos de 10 | Horda de 10 enemigos salvajes del bioma actual avanzando en 360°. |
| **Mini-Boss** | **Cada 10 pisos** (10, 20, 30, 40, 60, 70, 80, 90...) | Jefe de zona con ×10 HP y cronómetro de **30 s**. **Se ancla al radio del Bastión** al llegar y lo golpea periódicamente hasta morir o agotar el tiempo. Otorga oro extra y Sellos Gacha al ser **abatido** por primera vez. |
| **Gran Boss (Major Boss)** | **Pisos 50 y 100** (y cada 50 pisos en la Torre: 150, 200, 250…) | Jefes principales de hito (cronómetro de **45 s** en piso 50 y **60 s** en piso 100) con cambio de fase elemental y anclaje en el Bastión que exigen rotación táctica activa. |

* **Mecánica de Anclaje de Jefe (Decisión D1):** Un jefe (Mini-Boss o Gran Boss) **nunca se autodestruye ni cuenta como "fuga" al tocar el Bastión**. Cuando alcanza `BASTION_DAMAGE_R` (24 px del centro), se detiene en el perímetro y **golpea periódicamente al Bastión** (1 golpe/s equivalente al **5–8% del HP máximo del Bastión**, respetando el escudo de 3★ si está activo) mientras el cronómetro de jefe sigue corriendo. La única forma de superar un piso de jefe (y de registrar su primera victoria para Sellos en `settleRun`) es **reducir su HP a 0 antes de que el Bastión caiga o el reloj llegue a 0**.
* **Respiro entre oleadas:** al limpiar un piso el siguiente no aparece de golpe: hay **2,75 s de respiro** (la carga de Definitiva sigue corriendo; la regeneración pasiva se pausa) antes de invocar el nuevo piso. El jugador puede adelantarlo con el botón *Siguiente Piso* o desactivar el avance automático con el chip *AUTO* para esperar de forma indefinida.

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
  * El jugador invierte oro en el Bastión y en el Nivel de Equipo con normalidad.
  * Mantiene Mini-Bosses cada 10 pisos y Grandes Bosses cada 50 pisos (50, 100, 150, 200...).
* **Diferenciación:**
  * **Registro de Récord:** la derrota termina el intento en **todos** los modos (§4.2); en la Torre, además, el piso alcanzado se registra como récord (y, en la Fase 4, en el Ranking Global).
  * **Mutadores de Piso (cada 10 pisos) y Terrenos:** modificadores que alteran el combate (ej. *Resistencia Extrema*, *Suelo Volcánico*, *Inversión de Tipos*). Catálogo, reglas y apilado en §9.3 y §9.9.
* *(Roadmap)* **Modo Desafío Diario:** Evento rotativo con semilla fija y presupuesto inicial cerrado para una competencia igualada diaria.

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
    "team_state": [{"id": "0006", "stars": 4, "team_level": 120}],
    "bastion_levels": {"UP_CLICK": 50, "UP_ARROW": 110, "UP_HP": 75, "UP_AUTOCLICK": 4},
    "manual_clicks": 850,
    "auto_clicks": 1300
  }
  ```
* **Comprobación Serverless Rápida (<5 ms)**:
  1. **Consistencia de Oro:** Verifica que el oro total ganado coincida matemáticamente con las mejoras y niveles reportados más el saldo final.
  2. **Umbral Fisiológico de Tiempo:** Comprueba que la duración de la run no sea inferior al tiempo físico mínimo requerido para completar las oleadas declaradas.
  3. **DPS Sanity Check:** Comprueba que el DPS teórico máximo de ese equipo y mejoras (separando `manual_clicks` y `auto_clicks` según la cota de cadencia de `UP_AUTOCLICK`) pueda eliminar al jefe del `final_floor` dentro de su temporizador. La cota usa los **topes por categoría** del pipeline de modificadores (§9.3.1) y un presupuesto máximo de oro por fugitivos de botín (§9.6).
  4. **Reconstrucción determinista:** clima, terreno, mutadores y eventos especiales son funciones puras de `(seed, bioma, piso)` (§9.1.1, §9.3.5); el servidor los recalcula con el mismo código. El payload añade `mode`, `autoSwap` y `schemaVersion`.
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
  baseStats: { atk: number; spd: number; critRate: number; critDmg: number };
  pattern: 'SNIPER' | 'AOE' | 'PULSE' | 'CHAIN';
  evolution?: { targetId: string; canonicalLevel: number };
  ultimate: { id: string; name: string; cooldownSec: number };
  benchPassive: { stat: string; value: number };
}
```

### 7.2. Pipeline Automático de Ingesta (`pnpm run sync:pokemon`)

* **Script de Sincronización:** Un script automatizado en `scripts/sync-pokemon.ts` que se ejecuta mediante `pnpm`:
  1. Consulta la API de PokeAPI para extraer tipos elementales, estadísticas base y **niveles de evolución canónica**.
  2. Descarga los spritesheets de PMDCollab (`Walk-Anim.png`, `Attack-Anim.png` y `Normal.png`) correspondientes a las especies requeridas.
  3. Parsea `AnimData.xml` para resolver dimensiones de frame (`fw`, `fh`), duraciones y etiquetas `<CopyOf>`.
  4. Genera un único manifiesto consolidado en `src/data/pokedex.json`.

### 7.3. Balanceo Centralizado y Simulador Headless

* **Archivo de Configuración Único (`src/config/balance.config.ts`):** Todas las constantes de crecimiento de oro, multiplicadores de tipos, vida de bosses y probabilidades del Gacha residen en un solo archivo.
* **Simulador de Economía (`pnpm run test:balance`):** Script de consola que ejecuta miles de oleadas en segundos simulando el progreso del jugador para verificar curvas de dificultad antes de desplegar a producción.

### 7.4. Distribución de Sprites, Assets y Licencia

* **Estado actual:** los sprites y retratos se piden en caliente a `raw.githubusercontent.com` (Anexo A, A8). No hay modo offline posible, depende de una disponibilidad externa y no existen créditos. Antes de ampliar el elenco (Fase 3A) se pasa a **assets locales** generados por `pnpm run sync:pokemon` (§7.2) y servidos desde `public/sprites/`.
* **Carga por bioma:** se precargan las especies del bioma actual y del siguiente (§9.1.4) y se cachean con el service worker de la PWA. El presupuesto de peso se fija tras medirlo en 3A.
* **Créditos:** los sprites fan-made de SpriteCollab exigen acreditar a sus autores. `sync:pokemon` genera un `CREDITS.md` y la interfaz incluye una pantalla "Créditos".
* **Licencia:** según el README de SpriteCollab, las aportaciones de la comunidad se publican bajo **CC BY-NC 4.0** (uso no comercial); el arte original de Chunsoft y los Pokémon pertenecen a sus titulares. El proyecto es un fan project **no comercial**; cualquier monetización futura exigiría revisar esto (pregunta P7, §9.10).

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

### Fase 3: Mundo, Modificadores, Encuentros y Torre *(re-planificada en v2.4 tras auditoría del simulador)*

> La auditoría post-Fase 2 sobre el simulador demostró que "piso alcanzado" medía cuánto aguantaba el Bastión tragándose fugas (0% bajas desde el piso 21–30), que los jefes recorrían los 168 px en 2,8–6,7 s eliminándose por contacto sin que el reloj de 30 s pudiera expirar nunca, y que los Sellos de jefe se otorgaban por superar el piso sin abatir al jefe. Por ello, **3A se reestructura en bloques secuenciales**: primero *Quick Wins* (inmunidad global `×0.25` y responsive 1080p), luego el replanteamiento de combate y **"Curva v2"** (anclaje de jefes D1, peso de fugas D2, viabilidad idle D3 y simulador por bajas), después **Autoclick** y finalmente las fundaciones de mundo (RNG por canal, `EnemyDefinition`/biomas, sprites locales y fondos).

#### 3A — Quick Wins, "Curva v2" (Combate Real) y Fundaciones del Mundo
*Objetivo: que el progreso dependa de abatir enemigos y jefes, que ningún tipo haga 0 de daño, que el layout sea cómodo en 1080p y que el núcleo soporte biomas y especies locales.*

**Bloque 3A.1 — Higiene y Quick Wins de UX/Combate:**
* [ ] **Higiene de repositorio:** `.gitattributes` (`* text=auto eol=lf`) y verificación de `pnpm test` + `pnpm build` en verde.
* [ ] **Suelo de inmunidad global (`×0,25`)** en `getEffectiveness` (`min(producto de pares no inmunes, 0.25)`), eliminando los *soft-locks* del auto-disparo en el 52% del roster (§3.2, §9.5).
* [ ] **Responsive del panel lateral a 1080p:** `h-dvh`, `min-height` de seguridad en el panel de Mejoras con scroll lateral general (A), layout de **2 columnas** (*HUD+Equipo* | *Mejoras*) en viewports panorámicos bajos (`min-aspect-ratio: 16/10` y `max-height: 1000px`) (B) y tarjetas de Equipo compactas en `≤800px` (C) (§3.3).

**Bloque 3A.2 — Reglas de Combate (D1–D3) y "Curva v2" de Economía:**
* [ ] **Anclaje de Jefes en el Bastión (D1):** el jefe no desaparece al llegar a `BASTION_DAMAGE_R`; se ancla y golpea cada segundo (`5–8%` del HP máx. del Bastión) hasta morir o agotar su reloj (30/45/60 s).
* [ ] **Victoria real sobre Jefes (I2):** `RunStats` registra `defeatedBossFloors` solo cuando `boss.hp <= 0`; `settleRun` otorga Sellos de primera victoria únicamente por jefes **abatidos**.
* [ ] **Peso de las fugas (D2) y viabilidad Idle inicial (D3):** el daño de contacto de enemigos normales escala como fracción del HP máx. del Bastión + piso (impidiendo que comprar solo HP gane a comprar daño), y el auto-disparo inicial abate ≥70% del piso 1 sin clics.
* [ ] **Simulador `pnpm run test:balance` v2 y "Curva v2" (§9.1.5):** instrumentación de bajas vs. fugas por tramo, jefes abatidos, uso de Definitiva/relevos en el bot y recalibración de curvas de HP/oro/costes.

**Bloque 3A.3 — Ergonomía de Puntero y Autoclick:**
* [x] Entrada con `pointerdown` (hold-to-fire, máx. 4 clics/s; cubre ratón y táctil).
* [ ] **Seguimiento `pointermove`** durante hold-to-fire en `App.tsx`.
* [ ] **Mejora de Autoclick (`UP_AUTOCLICK`):** desbloqueo base permanente/simbólico + cadencia mejorable con oro en la run (1 → 1.5 → 2 → 3 → 4 clics/s) en posición del cursor (escritorio) y modo **"fijar punto de apuntado"** (táctil), separando `manual_clicks` y `auto_clicks` en `RunStats`/`RunProof` (§3.2, §6.3).

**Bloque 3A.4 — Fundaciones del Mundo y Assets Locales:**
* [ ] **RNG por canal y por piso** (`WAVE`, `SPECIAL`, `COMBAT`) con `seed` propia de cada run (§9.1.1).
* [ ] **`EnemyDefinition` y `BiomeDefinition`** data-driven; enemigos con especie real en el núcleo y eliminación del mapeo tipo→especie del renderer (§9.1.2–9.1.3).
* [ ] **Biomas 1 y 2 jugables** (Ruta Verde y Cueva Umbría, pisos 1–49) con pesos de tipo por bioma.
* [ ] **`pnpm run sync:pokemon`**: sprites locales en `public/sprites/` (fin del hotlink a `raw.githubusercontent.com`), carga por bioma y `CREDITS.md` (§7.4).
* [ ] **Fondos procedurales pre-renderizados (`buildBackdrop`) y tema web por bioma** (§9.2).

**Criterios de aceptación de 3A (basados en bajas reales):**
1. **Determinismo por canal:** Misma `seed` + inputs de jugador distintos ⇒ mismas oleadas y eventos por piso hasta que una de las runs termine.
2. **Progreso por combate, no por fugas:** En todos los perfiles del simulador (§9.1.5), la política de compra ofensiva/equilibrada supera en piso alcanzado y en jefes abatidos a la política de "comprar solo HP/Muralla".
3. **Métricas de bajas:** Un bot **sin clics** (solo starter) abate ≥70% de los enemigos en los pisos 1–10 y **abate** (mata) al Mini-Boss del piso 10 antes de que expire el reloj de 30 s.
4. **Cero inmunidades nulas y UI 1080p:** Ningún par de tipos devuelve `0` en `getEffectiveness` (mínimo `0.25`), y a `1920×969` las mejoras del Bastión son visibles sin colapso vertical.
5. **Autonomía de red y render:** En producción no hay peticiones a `raw.githubusercontent.com`, y el fondo se dibuja con un único `drawImage` por frame.

#### 3B — Modificadores de Campo, Sinergias y Jefes
*Objetivo: que el relevo elemental tenga más razones para ocurrir que "este enemigo es débil a X".*

* [ ] **Pipeline de modificadores** y `DamageContext` (§9.3.1): sustituye los multiplicadores dispersos de `calculateDamage`.
* [ ] **Climas** (4) con calendario por bioma, banner, partículas y chip en el HUD (§9.3.2).
* [ ] **Biomas 3 y 4** (Monte Ígneo, Costa y Ruinas): la campaña queda completa hasta el piso 100.
* [ ] **Sinergias de Tipo** (§9.4).
* [ ] **Jefes multifase** de los pisos 50 y 100 sobre la mecánica de anclaje D1 (§9.5).
* [ ] **Pista de Relevo** en la barra de equipo (§9.3.6).

**Criterios de aceptación:**
1. Un bot con el perfil "meta máxima" abate los jefes y completa los pisos 1–100 en el simulador (con tasa de bajas ≥70%); con el perfil "primera run" no lo hace.
2. Con el mismo presupuesto de estrellas, ninguna composición de equipo (monotipo, bitipo, cobertura de 5+ tipos) tiene un piso mediano >15% superior al de las demás.
3. Ningún equipo puede quedarse a 0 de daño total contra ningún enemigo ni jefe (garantizado por diseño desde 3A.1 con `IMMUNITY_FLOOR = 0.25`).

#### 3C — Encuentros Especiales y Shiny
*Objetivo: momentos de sorpresa dentro de la run y un coleccionable de suerte en el gacha.*

* [ ] **Director de Encuentros** sobre el canal `SPECIAL` del RNG (§9.1.1).
* [ ] **Fugitivos de Botín** (§9.6).
* [ ] **Shiny**: bandera independiente de las estrellas, tirada en el gacha, encuentro salvaje, *Hora Brillante*, *Resonancia Shiny* y Registro (§9.7).
* [ ] Audio mínimo con Howler (moneda, destello Shiny, aviso de fase de jefe); `howler` ya es dependencia pero no se usa.

**Criterios de aceptación:**
1. Un fugitivo **no bloquea** el avance de piso ni daña al Bastión, y un bot de 4 clics/s lo abate ≥70% de las veces mientras que un bot sin clics lo abate ≤10%.
2. Encuentro Shiny salvaje: frecuencia media de 1 cada 3–5 runs de longitud media (§9.7), máximo uno por run.
3. Misma `seed` ⇒ mismos fugitivos y mismos Shiny salvajes (apto para el Desafío Diario).

#### 3D — Torre del Destino y Automatización
*Objetivo: el endgame y la rama Estratega.*

* [ ] **Modo Torre** (Infinito) con jefes cada 50 pisos y registro de récord local (§9.9).
* [ ] **Terrenos** (4) en pisos de jefe y en la Torre (§9.3.3) y **Mutadores** por década (§9.9).
* [ ] **Árbol de Runas funcional** (gasto de Runas como moneda en ramas Entrenador, Estratega y Explorador) incluyendo el **Relevo Automático Táctico** (§4.3, §9.8).

**Criterios de aceptación:**
1. Pisos > 100 jugables sin cambios de código entre pisos (todo es dato: bioma cíclico, mutadores por década).
2. El relevo automático no oscila (≥6 s de permanencia mínima, histéresis del +25%) y rinde claramente peor que un jugador atento en un jefe multifase.

---

### Fase 4: Ranking Global Serverless y Desafíos
* Endpoint serverless ligero (Neon / Supabase / Cloudflare D1) para el Leaderboard.
* Validador matemático de telemetría `RunProof` (<5 ms).
* Modo Desafío Diario (*Daily Dungeon*) con presupuesto inicial cerrado y semilla comunitaria.

**Requisitos heredados de la Fase 3 (sin ellos esta fase no es viable):**
* `RunProof` incluye `seed`, `mode`, `autoSwap`, `manual_clicks`, `auto_clicks` y `schemaVersion`; el validador reconstruye calendario de clima, terreno y mutadores con las mismas funciones puras que el cliente (§9.3.5).
* La cota de DPS y de oro del validador usa los **topes por categoría** del pipeline de modificadores y un presupuesto máximo de oro por fugitivos (§9.6).
* El Desafío Diario deriva los canales `WAVE` y `SPECIAL` de la semilla diaria; el canal `COMBAT` queda local al jugador (§9.1.1).

---

### Fase 5: Backlog (sin compromiso de fecha)
* Generaciones 2–4: gracias al pipeline de §7.2/§7.4 es añadir datos (especies, biomas, jefes), no código.
* Pasada de arte a mano de los fondos (sustituyendo el generador por biomas concretos, §9.2).
* **Descartado explícitamente** (y por qué, para no reabrirlo sin motivo nuevo): terrenos *espaciales* con parches en la arena (más lógica de colisión y renderizado que valor táctico); Shiny con estadísticas superiores (rompe el balance y reduce el Shiny a "el mejor Pokémon"); Sellos como botín de fugitivos (convierte una distracción en la vía de farmeo del gacha); tilesets extraídos de los juegos PMD (§9.2.1).

---

## 9. Diseño Detallado de las Fases 3+

> **Convenciones.** Los valores marcados *(ajustable)* son hipótesis de partida y deben calibrarse con el simulador (§9.1.5), no tomarse como definitivos. Todas las constantes viven en `src/config/balance.config.ts`; todas las tablas de contenido (climas, sinergias, mutadores, biomas) son **datos**, no código.

### 9.0. Veredicto sobre las ideas propuestas

| Idea | Veredicto | Fase | Qué cambia respecto a la idea original |
| :--- | :--- | :--- | :--- |
| Fondos temáticos (arena + web) | **Sí, pero procedurales.** PMDCollab **no sirve** para terrenos (§9.2.1). | 3A | Se genera el fondo por código con paleta y decorado por bioma; el tema de la web cuelga de las mismas variables. |
| Climas y Terrenos de piso | **Sí, pero fusionados con los Mutadores en un único sistema.** Clima primero, terreno después. | 3B (clima) · 3D (terreno) | El PRD ya tenía "Mutadores de Piso"; son la misma palanca. Se evita construir dos sistemas con la misma tubería. |
| Sinergias por tipo | **Sí, rediseñadas.** | 3B | No pueden duplicar la `BENCH_PASSIVE` (ya es "bonus de tipo al equipo"), y deben dejar de premiar siempre al equipo monotipo. |
| Fugitivos de botín | **Sí. Mejor relación valor/coste de las cinco ideas.** | 3C | Pocas reglas, mucho efecto; tres requisitos técnicos previos (§9.6). Solo dan oro, nunca Sellos. |
| Shiny (gacha + sinergia + evento) | **Sí, en tres capas independientes**, sin poder bruto. | 3C | Se desacopla del 5★ (hoy el PRD lo liga a la estrella 5). Captura de Shiny salvaje = opcional. |

**Dónde no encajan antes:** las Sinergias podrían entrar en cuanto la Fase 2 entregue el equipo de 6, pero necesitan el pipeline de modificadores (si no, se suman como otro multiplicador suelto) y la curva de §9.1.5 para calibrarse; por eso van en 3B.

---

### 9.1. Fundaciones (Fase 3A)

#### 9.1.1. RNG por canal y por piso
**Problema verificado (Anexo A):** hoy hay **un único flujo** `rng` compartido por críticos, probabilidad de disparo y generación de oleadas, y la semilla es siempre `1`. Dos jugadores con la misma semilla verían oleadas distintas según cuándo critean, y una run nunca se parece a otra por semilla.

**Diseño:**
* Cada run genera una `seed` (uint32) al empezar; el Desafío Diario la recibe inyectada.
* Se derivan flujos independientes con un hash determinista `rngFor(seed, canal, piso)`:

| Canal | Alimenta | Estado |
| :--- | :--- | :--- |
| `WAVE` | Especies, tipos y ángulos de las oleadas, fases de jefe | Puro por `(seed, piso)` |
| `SPECIAL` | Fugitivos, Shiny salvajes, mutadores y terrenos de la Torre | Puro por `(seed, piso)` |
| `COMBAT` | Críticos, probabilidad de disparo, efectos con azar | Con estado, local a la run |

* **Regla de oro:** nada que dependa de las acciones del jugador (clics, relevos, críticos) puede alterar `WAVE` ni `SPECIAL`. `generateWave(floor, rng)` pasa a recibir `rngFor(seed,'WAVE',floor)`.
* Test: dos runs con la misma `seed` y secuencias de input distintas producen `deepEqual` las oleadas y eventos del piso *N* mientras ambas sigan vivas.

#### 9.1.2. Enemigos con especie real
Hoy un enemigo es `'WILD'` o `'BOSS'` con tipos al azar entre los 18 (+30% de doble tipo) y el renderer decide el sprite por tipo primario (`sprites.ts: WILD_BY_TYPE`). Eso impide biomas, Shiny salvajes y fugitivos.

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
  grandBosses?: Record<number, BossPhaseDef[]>;       // §9.5
  weather: WeatherPlan;                               // §9.3.2
  runners: string[];                                  // §9.6
  palette: BiomePalette; backdrop: BackdropId;        // §9.2
}
```

`Enemy` gana `kind`, `flags?: { typeless?: boolean }`, `lifetimeSec?`, `anchoredAtBastion?: boolean`, `bossAttackCooldownSec?: number` y `phaseIndex?`; `definitionId` pasa a ser la especie real. El renderer usa `enemy.definitionId` y se elimina el mapeo por tipo.

#### 9.1.3. Biomas y plantillas iniciales (ids por validar con `sync:pokemon`)

| Bioma | Pisos | Salvajes (propuesta) | Fugitivo | Mini-Bosses |
| :--- | :--- | :--- | :--- | :--- |
| Ruta Verde | 1–20 | Rattata `0019`, Pidgey `0016`, Caterpie `0010`, Weedle `0013`, Oddish `0043`, Bellsprout `0069`, Spearow `0021` | Meowth `0052` | 10 Pinsir `0127` · 20 Snorlax `0143` |
| Cueva Umbría | 21–49 | Zubat `0041`, Geodude `0074`, Gastly `0092`, Haunter `0093`, Sandshrew `0027`, Diglett `0050`, Koffing `0109` | Meowth `0052` | 30 Onix `0095` · 40 Alakazam `0065` |
| Monte Ígneo | 51–79 | Growlithe `0058`, Ponyta `0077`, Vulpix `0037`, Magmar `0126`, Mankey `0056`, Primeape `0057`, Dratini `0147` | Persian `0053` | 60 Arcanine `0059` · 70 Dragonite `0149` |
| Costa y Ruinas | 80–99 | Psyduck `0054`, Shellder `0090`, Staryu `0120`, Tentacool `0072`, Magnemite `0081`, Voltorb `0100`, Slowpoke `0079` | Persian `0053` | 80 Gyarados `0130` · 90 Metagross `0376` |

Gran Boss 50: **Gengar** `0094` (Tyranitar `0248` queda como variante cuando exista Gen 2). Gran Boss 100: **Mewtwo** `0150` (Rayquaza `0384` como variante). Los pesos de tipo hacen que cada bioma *enseñe* sus contratipos (Cueva ⇒ Fantasma/Roca/Veneno/Tierra; Monte ⇒ Fuego/Dragón/Lucha; Costa ⇒ Agua/Eléctrico/Psíquico/Acero), que es lo que el PRD ya prometía en §5.2 pero el código aún no implementa.

**Torre (piso > 100):** `biomeAt(f) = campañaBioma(((f − 1) % 100) + 1)`; es decir, los cuatro biomas se repiten cíclicamente con un tinte de "Torre" (§9.2.2).

#### 9.1.4. Sprites, assets y licencia
Ver §7.4. Estrategia de carga: por bioma (precargar las ~8–10 especies del bioma actual y del siguiente), con caché PWA. El tamaño real del presupuesto de assets se fija **tras medirlo** en 3A; no se asume.

#### 9.1.5. Línea base post-Fase 2 y "Curva v2" de economía
**Hallazgos verificados en la auditoría post-Fase 2** (Anexo A.2; `docs/analysis/sim-baseline.ts` instrumentado por bajas vs. fugas):
1. **"Piso alcanzado" medía supervivencia por fugas, no combate:** En `gameLoop.ts`, cualquier enemigo (incluido un jefe) que llega a 24 px del centro se elimina, resta 1 a `waveEnemiesRemaining` y hace un daño de contacto lineal pequeño (`4` en piso 1 → `8` en piso 100). Con 4 clics/s y política "compra barata" (que prioriza Muralla/Fortaleza), el bot llegaba al **piso 103 con 0% de bajas desde el piso 35**, solo Nv. de Equipo 15–17 y habiendo matado únicamente al jefe del piso 10.
2. **El cronómetro de 30 s de los jefes era inalcanzable (I1):** Los jefes recorren los 168 px hasta el Bastión en 6,7 s (piso 10) a 2,8 s (piso 100) y desaparecen al tocarlo haciendo el mismo daño que un salvaje normal. Además, `bossFloorsClearedBelow(floorReached)` regalaba los Sellos por dejar pasar al jefe (I2).
3. **El modo Idle sigue sin ser viable (I3):** Sin clics, el bot abate solo el 9–13% de los enemigos en los pisos 1–10 y el 0% en los 11–20; "pasa" el piso 10 únicamente porque el Bastión (130 HP + regen 3%/s) absorbe las fugas.
4. **Brecha exponencial vs. lineal:** El HP enemigo crece `×1,18/piso` mientras el daño del jugador por nivel crece linealmente (`+10%/nv` y `+8%/nv` en Flechas) con costes exponenciales (`×1,22` y `×1,35`). El techo real donde se mata ≥70% de la oleada está en el **piso ~20–25**.

**Cambios estructurales obligatorios antes de ajustar números ("Curva v2"):**
1. **Decisión D1 (Jefes anclados):** Al llegar a `BASTION_DAMAGE_R`, el jefe se ancla en el perímetro y golpea al Bastión cada 1 s por **5–8% del HP máximo del Bastión** hasta morir o agotar el reloj (`30/45/60 s`). `settleRun` solo premia jefes con `bossKilled === true`.
2. **Decisión D2 (Fugas punitivas):** El daño de contacto de un enemigo normal pasa a incluir una **fracción del HP máximo del Bastión** (ej. `6–8% HP máx.` + base escalada por piso), de modo que dejar pasar una oleada entera sin matar cause derrota incluso comprando `UP_HP`/`UP_WALL`.
3. **Decisión D3 (Idle viable en piso 1):** Ajustar el DPS base del auto-disparo (subiendo `PROJECTILE_BASE_DAMAGE` o cadencia base inicial vs. `enemyHp(1)`) para que un starter Nv. 1 sin clics limpie ≥80% de las primeras oleadas y genere el oro de rodaje necesario para escalar.
4. **Familia de curva cerrada (Pisos 1–100):** Alinear la tasa de crecimiento de `enemyHp(floor)` y `enemyGoldValue(floor)` con el escalado multiplicativo por hitos de evolución (Nv. 16, 36, 55) y mejoras, y ampliar el bot de `pnpm run test:balance` para que utilice Definitivas, relevos elementales y equipo de 6.

**Hitos objetivo (medidos por *Piso de Combate Efectivo* = último piso con ≥70% de bajas y todos los jefes previos abatidos):**

| Perfil en Simulador (`pnpm run test:balance`) | Hito objetivo (bajas ≥70% + jefes abatidos) |
| :--- | :--- |
| Primera run, solo starter (1★), **0 clics (Idle puro)** | Abate al Mini-Boss del **piso 10**; cae en pisos 12–16 |
| Primera run, solo starter (1★), **1,5 clics/s** | Piso **15–20** (llega a Snorlax en 3–5 min) |
| Equipo inicial de 3–4 Pokémon (1★–2★), **1,5–2,5 clics/s** | Piso **25–35** (supera Snorlax y entra en Cueva Umbría) |
| Meta intermedia (equipo de 6 a 2★–3★ + sinergias/relevos) | Piso **50–65** (abate a Gengar en piso 50) |
| Meta máxima (equipo de 6 a 3★–4★ + relevo táctico + Definitivas) | **Piso 100** (abate a Mewtwo) |

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
Hoy `calculateDamage` recibe siete parámetros posicionales y cada multiplicador nuevo (pasivas de banquillo, clima, sinergias, runas, Hora Brillante) añadiría otro. Se sustituye por un pipeline único:

```ts
type ModSource = 'UPGRADE' | 'BENCH' | 'SYNERGY' | 'FIELD' | 'MUTATOR' | 'RUNE' | 'EVENT';
interface Modifier { source: ModSource; stat: StatKey; op: 'ADD' | 'MUL'; value: number; typeFilter?: PokemonType[]; }
interface DamageContext { attacker; defender; baseDmg; state; rng; modifiers: Modifier[]; }
```

**Política de apilado:**

| Categoría | Fuentes | Cómo combina dentro | Tope (para la cota de §9.3.5) |
| :--- | :--- | :--- | :--- |
| EQUIPO | Pasivas de banquillo + Sinergias | **Aditivo** | +100% |
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
Se **difieren** a 3D y se alimentan de la misma tubería que los Mutadores. Diferencia con el clima, para que ambos merezcan existir: el **clima** altera el *daño por tipo*; el **terreno** altera una *mecánica* ligada a un patrón.

| Terreno | Tipo potenciado | Mecánica asociada |
| :--- | :--- | :--- |
| Eléctrico | Eléctrico ×1,3 | +1 rebote a patrones CHAIN |
| Herboso | Planta ×1,3 | Regeneración del Bastión ×2 |
| Neblinoso | Hada ×1,3 · Dragón ×0,8 | Enemigos −10% de velocidad |
| Psíquico | Psíquico ×1,3 | Carga de Definitiva ×1,5 |

Se aplican a pisos de Mini-Boss y a la Torre. Máximo **un clima y un terreno** por piso. Regla de autoría para los jefes: el terreno no debe dejar al jugador sin ninguna respuesta útil; puede tentarlo con una trampa, nunca bloquearlo.

#### 9.3.4. Mutadores
Ver §9.9: comparten tipo `FieldModifier` y pipeline, y solo se activan en la Torre.

#### 9.3.5. Efecto en el validador (Fase 4)
Clima, terreno y mutadores son funciones puras de `(seed, bioma, piso)` → el servidor los reconstruye con el mismo código. La cota de DPS usa los **topes por categoría** de §9.3.1 y se añade un presupuesto de oro máximo por fugitivos (§9.6).

#### 9.3.6. Pista de Relevo
Función pura en el núcleo, reutilizada por la interfaz y por el relevo automático:

```
swapScore(slot) = Σ_e  w_e · eff(slot.tipos, e.tipos) · campo(slot.tipos)  /  Σ_e w_e
w_e = 1 + 2·(1 − dist_e / 192)  ·  (×3 si es jefe)
```

La barra de equipo marca el mejor candidato con una flecha y un multiplicador ("▲ ×1,4") cuando mejora ≥25% al activo y no está en enfriamiento. Es lo que hace comprensibles clima y fases de jefe, sobre todo en móvil; por eso entra en 3B y no en 3D.

---

### 9.4. Sinergias de Tipo (Fase 3B)

**Problema de la idea original:** ya existe `BENCH_PASSIVE` (ej. *Charmander: +8% de daño Fuego al equipo*), que es un bonus de tipo al equipo. Dos sistemas que hacen lo mismo con distinta puerta confunden y se apilan sin control. **Reparto de responsabilidades:**

| Sistema | Requiere | Aporta | Naturaleza |
| :--- | :--- | :--- | :--- |
| `BENCH_PASSIVE` | 2★ en esa especie (inversión) | Bonus **numérico** de estadística | Progresión por Pokémon |
| **Sinergia de Tipo** | Composición del equipo (sin inversión) | Bonus **mecánico** (estado, rebote, relevo) con números pequeños | Decisión de equipo |

**Reglas:**
* Cuentan los **6 slots** (activo + banquillo). Cada Pokémon suma 1 a cada uno de sus tipos *actuales* (Charizard suma Fuego y Volador; cambia al evolucionar).
* Dos umbrales: **2** y **4** del mismo tipo (un equipo monotipo de 6 no obtiene más que el de 4: no se premia la monocultura).
* **Sinergia de Cobertura:** con **≥5 tipos distintos** en el equipo ⇒ enfriamiento de relevo −25% y Ataque de Entrada +15%. Es el contrapeso: el equipo monotipo gana efectos más fuertes; el equipo variado gira más rápido, que es el núcleo del juego.
* Se **derivan** del equipo; no se persisten. Apilado aditivo en la categoría EQUIPO con tope +100% (§9.3.1).
* La sinergia de **Fuego (2)** conserva tu idea original (+15% de daño crítico en clic); los demás efectos son un borrador.

**Primitivas de efecto** (el motor soporta ~12; los 36 efectos son combinaciones en datos):
`DMG_CRIT_CLICK`, `STATUS_ON_HIT(estado, prob)`, `SLOW_AURA`, `CHAIN_BOUNCE`, `PIERCE`, `SPD`, `GOLD`, `ULT_CHARGE`, `BASTION_REGEN/HP/LEAK_REDUCTION`, `SWITCH_CD`, `SWITCH_IN_DMG`, `EXTRA_TARGET`.

| Tipo | 2 Pokémon | 4 Pokémon |
| :--- | :--- | :--- |
| Normal | +10% oro | +20% oro |
| Fuego | **+15% daño crítico en clic** | Impactos queman (60% del impacto repartido en 3 s) |
| Agua | +15% radio de clic y de AoE | Impactos mojan: −20% velocidad enemiga 3 s |
| Planta | Regeneración del Bastión ×1,5 | Impactos curan 0,3% HP máx. (tope 3%/s) |
| Eléctrico | +1 rebote (CHAIN) o +1 perforación | Parálisis 8% (1 s; jefes la mitad) |
| Hielo | −10% velocidad enemiga (aura) | Congelación 5% (1,5 s; jefes inmunes) |
| Lucha | +15% daño de Ataque de Entrada | Ataque de Entrada ignora resistencias (mín. ×1,0) |
| Veneno | Veneno (DoT, apila hasta 3) | +25% daño a envenenados |
| Tierra | +1 perforación | Ataque de Entrada con +50% de radio |
| Volador | +10% velocidad de proyectil | La 1ª fuga de cada piso no daña al Bastión |
| Psíquico | +15% carga de Definitiva | Cada relevo recarga 20% de la Definitiva |
| Bicho | +10% cadencia | +1 objetivo simultáneo |
| Roca | +20% HP máx. del Bastión | Daño de fuga −40% |
| Fantasma | Enemigos abatidos explotan (10% de su HP máx.) | Explosión del 25% |
| Dragón | +10% daño global | +25% daño global (sustituye, no suma) |
| Siniestro | +5% prob. crítica | Críticos ignoran resistencias (mín. ×1,0) |
| Acero | Daño de fuga −25% | Escudo de 3 s tras cada relevo |
| Hada | Relevos curan 5% HP máx. del Bastión | Enfriamiento de relevo −20% |

**Notas de implementación:**
* Los estados (quemadura, veneno, ralentización, parálisis, congelación) necesitan una infraestructura **genérica** de estados alterados en `Enemy`. La Fase 2 ya la implementó (`StatusInstance`); en 3B se añaden los nuevos tipos de estado (`POISON`, `FREEZE`).
* No hace falta implementar los 18 tipos de golpe. Se implementan las primitivas y se activan los tipos presentes en el elenco que entregue la Fase 2.
* **Criterio de calibración:** monotipo-4, bitipo y cobertura-5 deben quedar dentro de ±15% de piso mediano en el simulador con el mismo presupuesto de estrellas.

---

### 9.5. Jefes Multifase y Anclaje en el Bastión (Fases 3A y 3B)

```ts
interface BossPhaseDef {
  hpPct: number;                                   // fase activa mientras HP% >= hpPct
  types: [PokemonType] | [PokemonType, PokemonType];
  hint?: string;                                   // texto del banner
}
```

* **Anclaje en el Bastión (Fase 3A, Decisión D1):** Todo jefe (Mini-Boss y Gran Boss) que alcanza `BASTION_DAMAGE_R` (24 px) permanece vivo y anclado en el borde del Bastión, golpeándolo cada `1.0 s` por `5–8%` del HP máximo del Bastión hasta que muera o expire su temporizador.
* **Rotación = cambiar `types` del jefe** al cruzar el umbral (Fase 3B). No hace falta un "escudo" nuevo: la tabla de tipos ya produce la mecánica *"necesitas relevar"*.
* **Transición:** al cruzar un umbral, el HP se **recorta al umbral** (una Definitiva o un golpe enorme no pueden saltarse una fase), 1,5 s de invulnerabilidad con el temporizador **en pausa** (y sin golpear al Bastión durante la invulnerabilidad), banner "¡Gengar cambia a Siniestro/Fantasma!" y cambio de tinte del sprite.
* **Suelo de inmunidad global (`×0,25`):** implementado globalmente en `getEffectiveness` desde 3A.1 (`IMMUNITY_FLOOR = 0.25`, `min(producto de pares no inmunes, 0.25)`). Ningún equipo puede quedarse a 0 de daño contra ningún jefe ni enemigo normal.
* **Temporizador:** Mini-Boss **30 s** · Gran Boss 50 → **45 s** · Gran Boss 100 → **60 s** (confirmado en P5).

| Jefe | Fases (ejemplo de autoría) |
| :--- | :--- |
| Piso 50 · Gengar | 100–50%: Fantasma/Veneno (mejores: Tierra, Psíquico, Fantasma, Siniestro) → 50–0%: **Fantasma/Siniestro** "Ancestral" (mejor: **Hada**; Psíquico pasa a ser inmune ⇒ suelo ×0,25) |
| Piso 100 · Mewtwo | 100–75% **Psíquico** (Bicho, Fantasma, Siniestro) → 75–50% **Fuego** (Agua, Tierra, Roca) → 50–25% **Planta/Hielo** (×2,25 con **Fuego**) → 25–0% **Agua** (Planta, Eléctrico) |

Regla de autoría: dos fases consecutivas no deben compartir su mejor contratipo, para forzar el relevo. Los ejemplos de arriba están **comprobados contra `TYPE_CHART`**; las fases usan tipos distintos (no un tipo fijo con acompañante) precisamente porque un tipo compartido arrastra sus contratipos de una fase a la siguiente.

---

### 9.6. Fugitivos de Botín (Fase 3C)

**Concepto:** un Pokémon ladrón (Meowth, *Día de Pago*) cruza la arena unos segundos. No ataca. Si se le abate, suelta mucho oro. Es el único elemento de la run que recompensa *puntería y atención* en un juego que presume de idle, y es opcional: nunca es necesario para progresar.

**Requisitos técnicos previos (los tres rompen el diseño si se ignoran):**
1. **No bloquea el piso.** Hoy la oleada termina cuando `waveEnemiesRemaining <= 0 && aliveEnemies.length === 0`. El fugitivo queda **excluido** de ambas condiciones y persiste hasta el final de su vida útil aunque la oleada ya se haya limpiado.
2. **Daño sin tipo (`typeless`).** Aunque el suelo global sea `×0,25`, hacer un 75% menos de daño a un evento de 7 segundos con un tipo Fantasma o Lucha seguiría siendo frustrante. El fugitivo ignora la tabla de tipos y el clima (`eff = 1.0`); solo cuentan ATK, nivel y mejoras.
3. **No es objetivo del auto-disparo** mientras haya otros enemigos (el auto-disparo apunta al más cercano al centro; el fugitivo pasa lejos). Sí recibe AoE, rebotes, Definitiva y clics: así el clic es su vía principal y un jugador idle puede cazarlo por casualidad con AoE.

**Reglas:**

| Parámetro | Valor inicial *(ajustable)* |
| :--- | :--- |
| Aparece en | Pisos normales ≥ 3; nunca en pisos de jefe |
| Probabilidad por piso | 12% + 3% por cada piso sin fugitivo (tope 40%); calculada con el canal `SPECIAL` |
| Frecuencia resultante | Aprox. 1 cada 6–7 pisos |
| Vida útil | 7 s; luego huye ("¡puf!") sin penalización |
| Trayectoria | Cuerda hacia el lado opuesto, sin pasar a menos de 90 px del centro, con ligero zigzag |
| HP | `RUNNER_HP_FACTOR` × HP de un enemigo del piso (calibrar con criterio de aceptación, no con un número) |
| Recompensa | **1,5 × el oro de una oleada normal del piso** (`15 × enemyGoldValue(piso)`), afectada por `UP_GOLD` |
| Ayuda táctil | Radio de impacto de clic ×1,5 sobre el fugitivo |
| Telegrafía | Aviso "!" al aparecer, estela de monedas, anillo con el tiempo restante, sonido de moneda |

**Qué NO hace (y por qué):**
* **No suelta Sellos.** Un evento frecuente y farmeable que da moneda de gacha convierte el sistema en un farmeo.
* **No puede ser Shiny** (mantiene el significado del Shiny, §9.7).
* **No es obligatorio:** a calibrar en torno a +10–15% de ingreso medio para un jugador atento y ≤3% para uno pasivo.

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
Por cada Pokémon Shiny **en el equipo de 6** (hasta 3): **+50% de probabilidad de encuentro Shiny salvaje** y **+3 s de Hora Brillante**. Se muestra como "???" hasta que se consigue el primer Shiny; entonces se revela en la ficha. Es descubrimiento, no secreto real: sin wiki, una mecánica oculta de verdad no la encuentra nadie. **Los Shiny no dan estadísticas superiores.**

#### Capa 3 — Encuentro salvaje
* Tirada por enemigo salvaje normal (canal `SPECIAL`): base `SHINY_WILD_RATE = 1/1000` *(ajustable; con ~250 enemigos por run corta y ~1000 en la campaña completa, apunta a 1 cada 3–5 runs de longitud media)*, × Resonancia × bonus de Explorador. **Máximo uno por run. Nunca en pisos de jefe.**
* **Aspecto y comportamiento:** destello y sonido al aparecer, banner "¡Un Pokémon Shiny salvaje!". Avanza como un enemigo normal (HP ×3), de modo que un jugador idle puede abatirlo con la defensa; si llega al Bastión, **se escapa sin dañarlo** (solo se pierde la oportunidad).
* **Recompensa al abatirlo:**
  1. **Sellos de Reclutamiento** (`3` Sellos, equivalentes a 3 tiradas con `GACHA_PULL_COST = 1`), tal como ya recoge §3.1.
  2. **Hora Brillante:** 12 s con **crítico garantizado, oro ×2 y carga de Definitiva ×2** (+Resonancia). Es un "jackpot" breve y legible, distinto en carácter al fugitivo (que premia puntería).
  3. *(Opcional, 3C-b)* **Captura:** 35% de convertir en Shiny esa especie **solo si ya la posees** y no es Shiny; si no, no pasa nada extra. Se marca opcional por ser lo de peor valor/coste: depende del solapamiento entre el elenco salvaje y el de tu Caja, y no puede dar Pokémon nuevos (sería un atajo al gacha).

#### Riesgos técnicos
* **Sprites Shiny:** SpriteCollab admite recolores Shiny, pero la estructura exacta de carpetas debe **verificarse en un spike** al construir `sync:pokemon`. Plan B: recolor por canal de tono en Canvas más destello.
* **Persistencia:** `shinyOwned/shinyActive` ya está incorporado en `META_VERSION = 2` desde la Fase 2.

---

### 9.8. Relevo Automático Táctico (Fase 3D)

El PRD lo describe en una línea. Para que no sea un trampolín a la oscilación ni sustituya al jugador:

* Reutiliza `swapScore` (§9.3.6), por tanto entiende clima, fases de jefe y terreno.
* Cambia solo si el candidato mejora ≥ **25%** al activo (histéresis) y el activo lleva ≥ **6 s** en campo.
* Retardo de reacción de **1,2 s** tras un cambio de fase de jefe o de piso.
* No usa la Definitiva ni respeta pausas de ritmo del jugador; cada relevo dispara su Ataque de Entrada (con su enfriamiento), de modo que el beneficio está acotado.
* Niveles en el Árbol de Runas (rama Estratega): **Nv1** solo en pisos de jefe · **Nv2** en todos los pisos · **Nv3** considera clima y terreno.
* `RunProof` incluye `autoSwap: boolean` para poder segmentar rankings si se desea.

---

### 9.9. Torre del Destino y Mutadores (Fase 3D)

* **Desbloqueo:** primera victoria sobre el piso 100 de Campaña. En la Torre la run **no se detiene** en el piso 100 (pregunta P2, §9.10).
* **Jefes:** Mini-Boss cada 10 pisos; Gran Boss **cada 50** (50, 100, 150, 200…). El código actual fija `BIG_BOSS_FLOORS = [50, 100]`; pasará a `floor % 50 === 0`.
* **Mutadores:** conjunto activo que **se sustituye** cada década (pisos 101, 111, 121…) y crece en número: 1 mutador (101–150), 2 (151–250), 3 (251+). Se eligen con el canal `SPECIAL` sin repetir ni combinar incompatibles (Resistencia Extrema + Inversión).

| Mutador | Efecto |
| :--- | :--- |
| **Resistencia Extrema** *(antes Inmunidad Elemental)* | El daño del tipo anunciado se multiplica por **`×0,10`** (penalización severa que obliga a relevar pero sin anular a `0` ni romper la regla de no soft-lock). |
| Inversión de Tipos | `×1,5` ↔ `×0,65` (el suelo de inmunidad `×0,25` no se invierte). Máx. uno cada 50 pisos. |
| Suelo Volcánico | El Bastión pierde 1% de HP máx./s mientras el activo no sea Agua, Tierra o Roca. |
| Horda | +50% enemigos, −35% de HP cada uno. |
| Coraza | Enemigos con HP ×1,4 y oro ×1,4. |
| Veloces | Enemigos con +30% de velocidad. |

* **Corrección sobre el PRD v2.2:** la "Muerte Súbita" no diferencia la Torre de la Campaña (la derrota ya termina la run en todos los modos, §4.2). Lo que sí la diferencia es el **registro de récord**, los **mutadores/terrenos** y los **Gran Boss cada 50**.
* Terrenos (§9.3.3) también rotan por década en la Torre.

---

### 9.10. Riesgos y Decisiones de Diseño Confirmadas

**Riesgos**

| Riesgo | Impacto | Mitigación |
| :--- | :--- | :--- |
| Rebalanceo de economía mayor de lo previsto | Retrasa 3A | Anclar jefes (D1) y penalizar fugas (D2) primero; medir por bajas reales en el simulador antes de ajustar números |
| Suma de modificadores desbordada | Rompe balance y validación | Pipeline con topes por categoría (§9.3.1) |
| Sinergias monotipo dominantes | Contradice el pilar "equipo de 6 equilibrado" | Sinergia de Cobertura + criterio ±15% (§9.4) |
| Sprites Shiny no disponibles tal cual | Recorta la capa visual | Spike en 3A; plan B por recolor |
| Carga de assets al crecer el elenco | Tiempo de carga / PWA | Sprites locales y carga por bioma (§7.4) |
| Licencia CC BY-NC del arte comunitario | Limita monetización futura | Proyecto no comercial; créditos visibles (§7.4) |

**Decisiones de diseño confirmadas (v2.3 y v2.4)**

| # | Pregunta / Decisión | Resolución confirmada |
| :--- | :--- | :--- |
| **P1** | ¿Desacoplar el Shiny de la 5★ (la 5★ pasa a *Aura Apex*)? | **Confirmado (Sí)** — Implementado en Fase 2. |
| **P2** | ¿La Torre continúa desde el piso 1 más allá del 100? | **Confirmado (Sí)** — Continúa desde el piso 1. |
| **P3** | ¿Cómo funcionan las Runas Ancestrales entre el bono pasivo y el Árbol? | **Confirmado (Moneda del Árbol)** — Las Runas se gastan como moneda en el Árbol de Habilidades; los bonos provienen de los nodos comprados (evitando +356% pasivo gratis en piso 100). |
| **P4** | ¿Qué progresión e hitos por perfil buscamos? | **Confirmado** — Tabla de §9.1.5 medida por bajas reales (≥70%) y jefes abatidos. |
| **P5** | ¿Temporizadores de Gran Boss de 45 s (piso 50) y 60 s (piso 100)? | **Confirmado (Sí)** — 30 s Mini-Boss, 45 s Piso 50, 60 s Piso 100. |
| **P6 / D3** | ¿"Idle" significa que una run sin clics debe limpiar el inicio? | **Confirmado (Sí)** — El auto-disparo inicial limpia ≥80% del piso 1 y abate al primer jefe (piso 10). |
| **P7** | ¿El proyecto es y seguirá siendo no comercial? | **Confirmado (Sí)** — CC BY-NC 4.0 con pantalla de Créditos. |
| **D1** | ¿Cómo se comporta un jefe al llegar al radio del Bastión? | **Confirmado (Anclaje)** — Se ancla en `BASTION_DAMAGE_R` y golpea cada 1 s (`5–8%` HP máx.) hasta morir o agotar su reloj; los Sellos exigen abatirlo. |
| **D2** | ¿Cómo evitamos que "tanquear fugas" sea óptimo frente a hacer daño? | **Confirmado** — El daño de contacto escala como fracción del HP máx. del Bastión + piso. |
| **D4** | ¿Cómo se integra el Autoclick ergonómico? | **Confirmado** — Desbloqueo base permanente/simbólico + cadencia comprable con oro en la run (`UP_AUTOCLICK` 1→4/s), cursor en escritorio y modo "fijar punto" en táctil, tras calibrar la Curva v2. |
| **D5** | ¿Inmunidad elemental `×0,25` global y qué pasa con el mutador de la Torre? | **Confirmado** — Suelo global `×0,25` siempre (`min(producto del resto, 0.25)`), y el mutador de la Torre pasa a *Resistencia Extrema* (`×0,10`). |

---

## Anexo A. Estado Verificado del Proyecto (Fases 1 y 2)

### A.1. Auditoría inicial (commit `9eafe53`, cierre de Fase 1)
Auditoría hecha leyendo el código y ejecutando el núcleo real con `docs/analysis/sim-baseline.ts`. Leyenda: **E** = ejecutado · **C** = leído en código.

| # | Hallazgo original (Fase 1) | Estado tras Fase 2 (`d800ce9`) | Impacto en Fase 3 |
| :--- | :--- | :--- | :--- |
| A1 | **El juego no es idle en la run inicial.** | Parcialmente enmascarado por HP/regen del Bastión (ver A.2): solo mata 9–13% en pisos 1–10 sin clics. | Bloque 3A.2 (D3) |
| A2 | **Techo real ≈ piso 15–25** matando enemigos. | Se mantiene: a partir del piso ~20–30 el bot mata <5% de los enemigos. | Bloque 3A.2 ("Curva v2") |
| A3 | **La curva de HP no cierra con la del jugador** (`×1,18/piso` vs lineal). | Vigente. | Bloque 3A.2 ("Curva v2") |
| A4 | **RNG único y semilla fija = 1**. | Vigente. | Bloque 3A.4 (§9.1.1) |
| A5 | **Los enemigos no tienen especie** (`'WILD'`/`'BOSS'`). | Vigente. | Bloque 3A.4 (§9.1.2) |
| A6 | **La oleada exige `aliveEnemies.length === 0`**. | Vigente. | Fase 3C (§9.6 req. 1) |
| A7 | **Inmunidades dejan el daño en 0** (52% del roster afectado). | Vigente en código (`SPARSE_CHART` con `0`). | Bloque 3A.1 (suelo global `×0,25`) |
| A8 | **Sprites por *hotlink*** a `raw.githubusercontent.com`. | Vigente. | Bloque 3A.4 (`sync:pokemon`) |
| A9 | `howler` e `idb-keyval` sin uso. | **`idb-keyval` resuelto en Fase 2** (`src/storage/saveGame.ts`); queda `howler`. | Fase 3C (audio) |
| A10 | Clic solo con `mousedown`. | **Resuelto en Fase 2** (`pointerdown` + hold-to-fire 250 ms); falta `pointermove`. | Bloque 3A.3 |
| A11 | **Deriva PRD ↔ código** (arena 384 px, etc.). | Corregido en v2.3/v2.4. | — |
| A12 | Pools de jefes incluyen Gen 2/3. | Vigente. | Bloque 3A.4 (`EnemyDefinition`) |
| A13 | `ARENA.SPAWN_MARGIN` no se usa. | Vigente. | Bloque 3A.4 |

### A.2. Auditoría Post-Fase 2 y Análisis del Simulador (commit `d800ce9`, 16-oct-2026)

1. **Verificación de Fase 2:** Completada al 100% en contratos de datos y funcionalidad (Santuario Gacha 60/30/8/2 con pity 30/80, Caja de 6 con bloqueo de línea evolutiva repetida, Estrellas 1★–5★ con pasivas/Switch-In/patrón/Aura Apex, Definitiva por especie 30/26/22 s, estados alterados `StatusInstance` y persistencia versionada `META_VERSION = 2`).
2. **Separación de Bajas vs. Fugas en el Simulador (semillas 1–2):**
   | Perfil | Piso final reportado | % bajas p1–10 | p11–20 | p21–50 | p51+ | 1.er piso con <3 bajas | Jefes abatidos |
   | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
   | Idle, compra barata | 16–17 | 9–13% | 0% | — | — | **1–2** | ninguno (pasa p10 por fuga) |
   | 1,5 cps, compra barata | 57–67 | 96–98% | 55–70% | 1–5% | 0% | 18–24 | 0–1 (solo piso 10) |
   | 1,5 cps, ofensivo | 38 | 85–89% | 26–31% | 0–1% | — | 11–13 | ninguno |
   | 4 cps, compra barata | 88–103 | 100% | 99% | 18–30% | 0% | 26–32 | solo piso 10 |
   | 4 cps, ofensivo | 47 | 100% | 75–78% | 4–6% | — | 22–24 | solo piso 10 |
   *Conclusión clave:* El jefe recorre los 168 px hasta el Bastión en 2,8–6,7 s y se elimina al tocarlo haciendo 4,4–8,0 de daño, por lo que `bossTimerExpired` (30 s) era inalcanzable y la política "barata" ganaba comprando HP para tanquear fugas. Se resuelve en el Bloque 3A.2 (D1–D3).
3. **Medición de Layout Responsive a 1080p:**
   * En `1920×969` (1080p con barra de navegador), el panel derecho de `26rem` (`416 px`) deja solo `286 px` de alto al panel de Mejoras (6 de 9 visibles con scroll) mientras desperdicia `~600 px` horizontales. En portátiles `1366×650` o `1536×730`, la rejilla de mejoras colapsa a `8–47 px` (inutilizable). Se resuelve en el Bloque 3A.1 (§3.3).

---

## Anexo B. Historial de Cambios del PRD

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

