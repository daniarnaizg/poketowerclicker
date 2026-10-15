# PRD: PokéBastion — Pokémon Idle Defense & Gacha (v2.2)

Documento de Requisitos de Producto para un juego de defensa e incremento progresivo (*Roguelite Idle Defense*) con mecánicas gacha, rotación táctica elemental en tiempo real y arena simétrica.

| Atributo | Detalle |
| --- | --- |
| **Estado del Documento** | Borrador Consolidado (v2.2) |
| **Plataforma** | Web App (Desktop & Mobile PWA) — 100% Client-Side Execution |
| **Tooling & Build** | **Vite** + **pnpm** + **TypeScript** |
| **UI & Estado** | **Preact** (o React) + **Tailwind CSS** + **Zustand** |
| **Motor de Render** | **Canvas 2D Nativo** (Arena 144×144 px pixel-art determinista) |
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
* **Gacha con Propósito Táctico y Despertar (1★ a 5★):** Desbloquear duplicados no adelanta la evolución, sino que desbloquea pasivas de banquillo, potencia los ataques de entrada (*Switch-In Bonus*), amplía los patrones de disparo y desbloquea el aspecto *Shiny*.
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
* **Moneda Gacha:** *Sellos de Reclutamiento* (o *Gemas Iris*), obtenidos al derrotar Mini-Bosses y Grandes Bosses por primera vez, logros, ascensiones o abatiendo enemigos *Shiny* salvajes.
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
| **5★ (Apex)** | **Aspecto Shiny / Aura Dorada** + Duplica Pasiva. | Prestigio visual y maximización de la bonificación de banquillo. |

---

### 3.2. Ficha Técnica y Estadísticas por Pokémon

Cada especie de la colección cuenta con atributos específicos que escalan con el Nivel de Equipo y las mejoras del Bastión:

* **Ataque Base (`ATK`):** Multiplicador de daño para el disparo automático y el clic.
* **Velocidad de Ataque (`SPD`):** Cadencia base de disparo (ej. *Pikachu* alta cadencia; *Snorlax* cadencia lenta pero daño masivo).
* **Probabilidad y Daño Crítico Base (`CRIT` / `CDMG`):** Afinidad innata para asestar golpes críticos.
* **Patrón de Ataque (`PATTERN`):**
  * *Francotirador:* Proyectil veloz a larga distancia hacia los enemigos más cercanos al Bastión.
  * *Artillero (AoE):* Bombas parabólicas con explosión en área en zonas densas.
  * *Pulso / Cuerpo a Cuerpo:* Ondas expansivas de corto alcance y alto daño.
  * *Cadena / Rebote:* Proyectiles que saltan entre múltiples objetivos.
* **Tipo Elemental (1 o 2 tipos):** Multiplicadores de tabla de tipos (×1.5 Súper Eficaz, ×0.65 No muy eficaz, ×0 Inmune según corresponda).
* **Habilidad Definitiva (Ultimate):** Movimiento insignia recargable por impactos y clics (ej. *Llamarada*, *Hidrobomba*, *Tormenta Floral*, *Rayo*).
* **Nivel de Evolución Canónico:** Umbral de Nivel de Equipo requerido para evolucionar (ej. Lv. 16/36, Lv. 7/10, Lv. 30/55).

---

### 3.3. Geometría de la Arena Cuadrada y UI Lateral

#### Arena Cuadrada Simétrica (144×144 px lógicos)
Para evitar la asimetría de distancias de los lienzos panorámicos, la zona de combate es un **cuadrado perfecto**:
* El Pokémon activo se sitúa en el centro exacto `(72, 72)`.
* La distancia a cualquier borde exterior es idéntica en 360° (72 px de radio).
* Los enemigos emergen desde los bordes del perímetro cuadrado y avanzan hacia el centro con velocidades homogéneas.

#### Panel Lateral de Control (Configurable Izquierda / Derecha)
El resto de la pantalla alberga la interfaz:
* **Barra de Equipo de 6 Pokémon:** Retratos (`Normal.png`), tipo elemental, nivel de evolución actual, barra de HP y botón de relevo directo (*Hot-Swap* mediante clics o teclas 1 a 6).
* **Medidor de Habilidad Definitiva:** Botón activador (`Espacio` o clic secundario).
* **Controles de Mejora de Oro:** Botón único de *Nivel de Equipo* y lista de mejoras del Bastión.
* **Ajuste en Opciones:** Posición del Panel: *Derecha* (predeterminado) o *Izquierda* (modo accesibilidad / zurdos para juego móvil horizontal).

```
+--------------------------+-------------------------------------+
|                          |  [ Piso 45 ]  [ 00:23 / 30s ]       |
|                          |  HP Bastión: [====================] |
|     ARENA CUADRADA       |-------------------------------------|
|       (144 x 144)        |  EQUIPO (Hot-Swap 1-6):             |
|                          |  [1] Charmeleon (ACTIVO)            |
|       Enemigos 360°      |  [2] Wartortle  [3] Ivysaur         |
|             ↓            |  [4] Pikachu    [5] Gastly  [6] Aron|
|         [POKÉMON]        |-------------------------------------|
|             ↑            |  [DEF. LISTA: LLAMARADA (Espacio)]  |
|                          |-------------------------------------|
|                          |  NIVEL DE EQUIPO (Nv. 34) [Subir]   |
|                          |  MEJORAS DEL BASTIÓN (Oro)          |
+--------------------------+-------------------------------------+
   (Arena fija cuadrada)        (Panel lateral configurable L/R)
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

| Identificador | Nombre | Función de Escalado |
| :--- | :--- | :--- |
| `UP_CLICK` | Golpe Firme | Daño y radio de explosión al hacer clic (toma el elemento y `ATK` del Pokémon activo). |
| `UP_HP` | Vitalidad | Salud máxima del Bastión y regeneración pasiva (2%/s). |
| `UP_MULTI` | Ataque Múltiple | Comportamiento según el patrón de ataque (de 1 a 9):<br>• *Francotirador:* Dispara a `N` enemigos simultáneos.<br>• *Artillero (AoE):* Lanza `N` bombas parabólicas a distintos grupos.<br>• *Pulso:* Emite `N` ondas concéntricas sucesivas rápidas.<br>• *Cadena:* El proyectil rebota `N` veces adicionales. |
| `UP_ARROW` | Potencia Elemental | Daño base del proyectil del Pokémon activo. |
| `UP_SPD` | Cadencia | Multiplicador de velocidad de ataque global. |
| `UP_CRIT` / `UP_CDMG` | Ojo Certero / Furia | Probabilidad y multiplicador de daño crítico. |
| `UP_GOLD` | Amuleto Moneda | Multiplicador de oro obtenido por enemigo eliminado. |

---

### 4.2. Flujo de Derrota y Bucle Roguelite (Idle vs. Competitivo)

1. **Condición de Fin de Run (*Game Over*)**:
   * Si la salud del Bastión llega a 0 **o** expira el cronómetro de 30 segundos frente a un Mini-Boss o Gran Boss, la run termina inmediatamente. No existe retroceso de oleada pasivo infinito.
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

* Cada Runa otorga un +4% de daño global acumulativo y puede asignarse en 3 ramas:
  * **Entrenador:** Potenciación de estadísticas base de los Pokémon y velocidad de recarga de la Definitiva.
  * **Estratega:** Reducción de enfriamiento de *Hot-Swap*, potencia del *Switch-In Bonus* y Relevo Automático Táctico.
  * **Explorador:** Aumento de drop de oro, probabilidad de enemigos *Shiny* y Cupones Gacha adicionales.
* **Persistencia:** Los Pokémon de la Caja, sus Estrellas de Despertar y las mejoras del Árbol de Runas se conservan permanentemente.

---

## 5. Estructura de Pisos, Jefes (10 / 50 / 100) y Modos de Juego

### 5.1. Jerarquía de Pisos

| Tipo de Piso | Pisos | Características del Encuentro |
| :--- | :--- | :--- |
| **Oleada Normal** | Todos excepto múltiplos de 10 | Horda de 10 enemigos salvajes del bioma actual avanzando en 360°. |
| **Mini-Boss** | **Cada 10 pisos** (10, 20, 30, 40, 60, 70, 80, 90...) | Jefe de zona con ×10 HP y cronómetro de 30s base. Otorga oro extra y Sellos Gacha en la primera victoria. |
| **Gran Boss (Major Boss)** | **Pisos 50 y 100** (y cada 50/100 en Infinito) | Jefes principales de hito con cambio de fase elemental y mecánicas de escudo que exigen rotación táctica activa. |

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
  * Mantiene Mini-Bosses cada 10 pisos y Grandes Bosses cada 50 y 100 pisos (150, 200, 250...).
* **Diferenciación:**
  * **Muerte Súbita:** Una sola caída del Bastión o agotar el tiempo de un jefe termina el intento y registra el récord en el Ranking Global.
  * **Mutadores de Piso (Cada 10 pisos):** Modificadores aleatorios que alteran el combate (ej. *Inmunidad Elemental*, *Suelo Volcánico*, *Inversión de Tipos*).
* *(Roadmap)* **Modo Desafío Diario:** Evento rotativo con semilla fija y presupuesto inicial cerrado para una competencia igualada diaria.

---

## 6. Arquitectura Técnica y Stack Tecnológico

### 6.1. Stack Seleccionado y Gestión con `pnpm`

| Capa | Solución Técnica | Justificación de Diseño |
| :--- | :--- | :--- |
| **Gestor de Paquetes** | **`pnpm`** | Instalaciones ultrarrápidas mediante hardlinks, gestión estricta de dependencias y ahorro masivo de espacio en disco. |
| **Empaquetador & Build** | **Vite** | Arranque instantáneo (HMR con esbuild), bundle de producción ultraoptimizado (Rollup) y plugins oficiales para PWA. |
| **Lógica del Juego** | **TypeScript Puro (Headless)** | Lógica desacoplada de la interfaz gráfica; permite pruebas automatizadas y validación idéntica en serverless. |
| **Capa de Render** | **Canvas 2D Nativo** | Renderizado pixel-art en viewport de 144×144 px. Consumo nulo de memoria de motores externos, determinista a 60/120 FPS. |
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
│    - Viewport 144x144 px      │   │    - Barra de Equipo (1-6)   │
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
    "bastion_levels": {"UP_CLICK": 50, "UP_ARROW": 110, "UP_HP": 75},
    "total_clicks": 2150
  }
  ```
* **Comprobación Serverless Rápida (<5 ms)**:
  1. **Consistencia de Oro:** Verifica que el oro total ganado coincida matemáticamente con las mejoras y niveles reportados más el saldo final.
  2. **Umbral Fisiológico de Tiempo:** Comprueba que la duración de la run no sea inferior al tiempo físico mínimo requerido para completar las oleadas declaradas.
  3. **DPS Sanity Check:** Comprueba que el DPS teórico máximo de ese equipo y mejoras pueda eliminar en ≤30s al jefe del `final_floor`.
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
  ultimate: { id: string; name: string; energyCost: number };
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

---

## 8. Hoja de Ruta (Roadmap de Desarrollo)

### Fase 1: Inicialización, Core Engine y MVP
* Configuración inicial del repositorio con **pnpm**, **Vite**, **TypeScript**, **Preact** y **Tailwind CSS**.
* Implementación del **Core Headless** determinista (fórmulas elementales, Nivel de Equipo unificado y evolución canónica).
* Motor de render en **Canvas 2D** con arena simétrica cuadrada (144×144 px) y generación 360°.
* Barra lateral de equipo (1-6) con mecánica de **Hot-Swap** y **Ataque de Entrada**.
* Selector inicial de Pokémon (*Starter*).
* Flujo de derrota con tarjeta viral de resultados (*Ficha de Entrenador*) y cálculo de Runas.

### Fase 2: Sistema Gacha, Despertar y Definitivas
* **Santuario Gacha** con probabilidades por rareza y contador de *Pity*.
* Gestión de **Caja Pokémon (Colección)** para configurar el equipo de 6.
* Sistema de **Estrellas de Despertar (1★ a 5★)**: desbloqueo de pasivas de banquillo, mejoras de proyectil y skins *Shiny*.
* Implementación de la **Habilidad Definitiva** con carga de energía por impactos y clics.

### Fase 3: Biomas Avanzados, Torre del Destino y Automatización
* Zonas hasta el Piso 100 con Grandes Bosses multifase y escudos rotativos.
* **Modo Infinito ("Torre del Destino")**, desbloqueable al superar el Piso 100 de Campaña.
* Mutadores de piso cada 10 niveles y modo muerte súbita.
* Automatización de farmeo en el Árbol de Runas (**Relevo Automático Táctico**).

### Fase 4: Ranking Global Serverless y Desafíos
* Endpoint serverless ligero (Neon / Supabase / Cloudflare D1) para el Leaderboard.
* Validador matemático de telemetría `RunProof` (<5 ms).
* Modo Desafío Diario (*Daily Dungeon*) con presupuesto inicial cerrado y semilla comunitaria.
