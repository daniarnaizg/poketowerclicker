# DESIGN.md — Interfaz de partida de PokéBastion

Guía de diseño de la interfaz durante el gameplay (arena + panel lateral). Describe los principios, el sistema de escalado, los tokens visuales, los componentes y las reglas para modificarlos sin romper la responsividad.

- **Ámbito:** pantalla de partida (`phase: PLAYING`). Hub, selección de inicial, caja y modales usan los estilos `pk-*` de `src/index.css` y quedan fuera de este documento.
- **Fuente de verdad del código:** `src/ui/gameUi.css` (layout y componentes), `src/renderer/arena.css` (escenario y marco), `src/App.tsx` (estructura) y `src/ui/components/{GameHUD,PokemonPanel,TeamBar,BastionUpgrades,AudioToggle}.tsx`.
- **Estado:** vigente. Si cambias una constante o regla de este documento, actualiza ambos sitios en el mismo cambio.

---

## 1. Principios

1. **Todo escala.** Ninguna medida del panel está en `px` salvo los bordes mínimos. El mismo diseño debe verse con las mismas proporciones en 1080p, 1440p, 4K, portátiles, tablets y móviles.
2. **Sin huecos.** En escritorio, arena y panel deben llenar la pantalla. Si sobra espacio, se reparte dentro de los paneles; nunca se deja vacío alrededor.
3. **El contenido no mueve el layout.** Un texto distinto (`ON`/`OFF`, `1` o `3` cifras, un contador que aparece) no puede cambiar el tamaño de un botón ni desplazar lo que tiene debajo. Se reservan ranuras de tamaño fijo.
4. **Legibilidad antes que densidad.** El texto no se corta ni se trunca si es información que el jugador necesita para decidir (coste, nivel, cuenta atrás). Lo secundario (nombre largo de pasiva) se limita a líneas fijas y tiene `title` con el texto completo.
5. **Estilo pixel-art Pokémon.** Ventanas crema con marco oscuro, bordes gruesos y sombra inferior, tipografía pixel. No se introducen gradientes, sombras difusas ni esquinas muy redondeadas.
6. **Cero lógica de juego en la UI de layout.** Los componentes leen `GameState` y emiten acciones al store; el layout vive solo en CSS.

---

## 2. Sistema de escalado

### 2.1 Unidad base `--u`

El panel lateral tiene `font-size: var(--u)` y todo dentro se expresa en `em`. Por tanto, `1em` en el panel equivale a `--u` píxeles y **cambiar `--u` reescala toda la interfaz**.

`--u` se calcula en `.game-shell` a partir del viewport, con CSS puro (sin JS ni `ResizeObserver`):

| Modo | Cálculo de `--u` | Límites |
|---|---|---|
| Apilado | `(ancho útil − 2·pad) / --sb-wd` | 9 – 18 px |
| Horizontal | el menor de `(100dvh − 2·pad) / --sb-hd` y `(100vw − 100dvh − pad) / --sb-wd` | 9 – 22 px |

### 2.2 Variables de la escena (`.game-shell`)

| Variable | Valor | Uso |
|---|---|---|
| `--pad` | `clamp(6px, 1.3vmin, 20px)` | Margen exterior y separación arena/panel |
| `--sb-wd` | `30` (1 columna) · `58` (2 columnas) | Ancho de diseño del panel, en em |
| `--sb-cols` | `1` · `2` | Columnas del panel |
| `--sb-hd` | `54` (solo horizontal) | Alto de diseño del panel, en em |
| `--arena` | ver §3 | Lado del escenario cuadrado |
| `--frame` | `clamp(4px, 0.45 · --u, 10px)` | Grosor del marco de la arena |
| `--vw` | `100vw`, o `100vw − 16px` con `pointer: fine` en modo apilado | Compensa la barra de scroll |
| `--bw` (en `.game-sidebar`) | `max(3px, 0.3em)` | Grosor de borde pixel-art. Registrada con `@property` para que se herede ya resuelta en px |

> **Por qué `@property --bw`:** una variable normal con `em` se reevalúa en cada elemento con *su* `font-size`, y los bordes saldrían de distinto grosor en botones con fuente menor. Registrada como `<length>` se calcula una vez y se hereda en px.

### 2.3 Constantes de diseño

`--sb-wd = 58` y `--sb-hd = 54` son el tamaño en em del panel en modo horizontal. Se midieron con el contenido más ancho/alto posible (jefe activo, dos pasivas de 3 líneas, valores de 6 cifras). **Si añades contenido al panel y supera ese alto, sube `--sb-hd`**; si no, el panel hará scroll interno en pantallas bajas.

---

## 3. Layout

### 3.1 Modos

| Modo | Condición | Disposición |
|---|---|---|
| **Horizontal** | `min-width: 900px` y `min-aspect-ratio: 3/2` | Arena a la izquierda (todo el alto), panel a la derecha. Composición centrada |
| **Apilado ancho** | `min-width: 640px` (resto) | Arena arriba, panel debajo en 2 columnas. La página hace scroll |
| **Apilado estrecho** | menos de 640px | Arena arriba, panel debajo en 1 columna. La página hace scroll |

Los monitores 4:3 y 5:4 caen en apilado a propósito: con la arena a todo el alto no queda ancho para un panel legible.

### 3.2 Arena

- **Horizontal:** `--arena = min(100dvh − 2·pad, 100vw − 3·pad − --sb-wd · --u)`.
- **Apilado:** `--arena = min(ancho útil − 2·pad, max(62dvh, 360px))`.
- `.arena-stage` es un cuadrado de lado `--arena` con `container-type: size`. `.arena-container` es el mayor cuadrado que cabe en su contenido (`min(100cqw, 100cqh)`) y lleva el marco de 3 capas (borde oscuro, filo con `--frame-accent` del bioma, borde exterior oscuro), todo en función de `--frame`.
- El *hit-testing* del canvas usa `getBoundingClientRect()`, por lo que el escalado CSS no afecta a la puntería.

### 3.3 Panel (`.game-sidebar`)

Rejilla de `--sb-cols` columnas con tres hijos directos, en este orden:

1. `GameHUD` (controles) — ocupa todas las columnas (`grid-column: 1 / -1`).
2. `PokemonPanel` (activo + equipo + estadísticas) — columna 1 de la fila inferior; con 2 columnas ocupa `1.4fr`.
3. `BastionUpgrades` — columna 2 de la fila inferior (`1fr`).

En modo horizontal el panel mide exactamente `--arena` de alto (`grid-template-rows: auto minmax(min-content, 1fr)`): los controles toman su altura natural y Pokémon/Mejoras se reparten el resto, de modo que **la base del panel queda alineada con la de la arena**. Si el contenido no cabe, el panel hace scroll vertical interno (`overflow-y: auto`) en lugar de desbordar la pantalla.

---

## 4. Tokens visuales

### 4.1 Tipografía

| Uso | Fuente | Notas |
|---|---|---|
| Texto de UI | `Press Start 2P` | Monoespaciada: cada carácter ocupa `1em` de ancho. Para estimar si un texto cabe: `nº de caracteres × tamaño de fuente` |
| Números grandes (HP, nivel, cooldowns) | `VT323` (`.gx-num`) | Más estrecha (~0.4em por carácter) |

Escala de tamaños dentro del panel (relativos a `--u`):

| Rol | Tamaño |
|---|---|
| Etiqueta de ficha de estado | `0.6em` |
| Texto de pasiva, detalle de mejora, reserva | `0.6 – 0.68em` |
| Nombre de mejora, filas del panel | `0.75 – 0.8em` |
| Botones | `0.8em` |
| Valor de ficha de estado | `0.95em` |
| Números `VT323` | `1.35 – 2.1em` |

### 4.2 Color

| Token | Hex | Uso |
|---|---|---|
| Crema | `#f8f8f0` | Fondo de ventanas y botones |
| Tinta | `#303030` | Bordes y texto |
| Filo | `#c8d0d8` | Borde interior de ventanas |
| Dorado | `#ffd860` | Elemento activo, hover, compra de nivel de equipo |
| Verde | `#48c048` | Activado, comprable, HP alto |
| Gris | `#585858` | Desactivado / tecla |
| Azul | `#58b0f8` | Velocidad activa, barra de carga |
| Amarillo | `#f8d030` | HP medio (25–50 %) |
| Rojo | `#f04040` | HP bajo (< 25 %) |
| Rojo jefe | `#f85848` | Cronómetro de jefe |
| Verde parada | `#78f0a0` | Ficha de parada |
| Violeta | `#7c3aed` | Fase de jefe |
| Azul tenue | `#a8c0e0` | Etiquetas sobre fondo oscuro |

El fondo de página y el acento del marco cambian por bioma mediante `body[data-biome]` (`--page-bg`, `--frame-accent`, definidos en `src/index.css`). No uses colores de bioma dentro de los componentes del panel.

### 4.3 Bordes y relieve

- Ventana (`.gx-win`): borde `--bw` en tinta, radio `1.5·--bw`, filo interior `--bw` y sombra inferior `1.5·--bw`.
- Botón (`.gx-btn`): borde `--bw`, sombra inferior sólida `--bw`; al pulsar se desplaza hacia abajo.
- Barras (`.gx-bar`): borde `0.8·--bw`, relleno por `width` en porcentaje.

---

## 5. Componentes

Todos los componentes comparten `.gx-win` (ventana) y `.gx-btn` (botón base). Conservar los `data-testid`: `next-wave-button`, `ult-button`, `team-slot-{0..5}`.

### 5.1 Controles (`GameHUD`)

Sección propia con todo lo que *se pulsa* durante la partida. Dos filas:

- **Fila 1:** fichas de estado (`.gx-stats`, 3 columnas, `25em` de ancho en 2 columnas, alto fijo `3.3em`) y `SIGUIENTE PISO` (`.gx-next`, el botón principal: el más alto y de ancho flexible, con la cuenta atrás en una ranura fija a la derecha; deshabilitado = gris).
  - Fichas: `PISO`, `SALVAJES` y una tercera que es **`JEFE · {n}s` con el cronómetro** durante un jefe y **`PARADA P.{n}` con `EN {n}P`/`AHORA`** el resto del tiempo (misma ranura).
  - **Jefe:** mientras hay un jefe vivo, su fase (`FASE n/3`), su barra (marcas al 33 % y 66 %; `INVULN`/`¡ENFURECIDO!` dentro de la barra) y su HP **cubren la ranura de `SIGUIENTE PISO`** (`.gx-boss-over`, posición absoluta). El botón sigue montado y deshabilitado debajo, así que nada cambia de tamaño ni de sitio.
- **Fila 2:** velocidad (icono de doble flecha `.gx-speed-ico` + selector segmentado `1x · 2x · 4x`), `AUTO ON/OFF` (ancho fijo) y los dos botones de audio a la derecha (`margin-left: auto`). Con poco ancho la fila puede partirse en dos líneas (`flex-wrap`).

El selector `JEFE 1x` ya no se muestra. La protección de jefe (bajar a 1x y desactivar el avance en pisos de jefe, `bossGuard`) sigue activa de forma fija en `App.tsx`.

### 5.2 Pokémon (`PokemonPanel`)

Una sola ventana (`.gx-pkm`) con tres subsecciones (`.gx-sub`), cada una con una etiqueta `.gx-sl` (texto pequeño con línea inferior):

1. **Activo** — etiqueta `ACTIVO` con, a la derecha, `RESERVA n%`, el escudo (ranura de `7em`, vacía si no hay) y 6 *pips* de vivos (`.gx-pips`; rojo el último vivo). Debajo: nombre y HP numérico grande (`VT323`), barra de HP (amarilla/roja por tramos) y la **definitiva** (`.gx-ult`) en una sola fila: nombre con elipsis · barra · cuenta atrás · chip `ESPACIO`. Lista = dorada y pulsando; el chip de tecla se oculta en dispositivos táctiles.
2. **Equipo** (`TeamBar`) — cuadrícula 3×2 de tarjetas iguales que se estiran con el alto sobrante. De arriba abajo: índice (atajo `1–6`) en la esquina; retrato (ocupa lo sobrante, hasta `5em`); fila nombre + `Nv n`; fila chip de tipo + estrellas; barra de HP; pie de 2 líneas con la pasiva (o `DEBILITADO`). Estados: activa (`is-hot`), 5★ (borde dorado inline), debilitada, en *cooldown* (velo con cuenta atrás) y deshabilitada fuera de combate.
3. **Estadísticas** — del Pokémon activo, en 6 fichas (3×2): `PS MÁX.`, `ATAQUE`, `CADENCIA`, `CRÍTICO`, `DAÑO CRÍT.` y `DEFINITIVA` (recarga). Son los valores de la especie escalados por el nivel de equipo (ataque y PS); **no incluyen las mejoras del bastión**, que se ven en MEJORAS. El juego no tiene defensa ni estadísticas especiales.

### 5.3 Mejoras (`BastionUpgrades`)

- **Cabecera:** título y oro actual (número grande).
- **Filas** (`.gx-urow`, una por mejora, ancho completo y mismo alto): nombre y descripción (2 líneas máx.) a la izquierda y **precio** (`.gx-price`, ancho fijo) a la derecha. Sin barras de nivel. Orden fijo por coste base (Cadencia Auto, Precisión, Furia, Codicia, Multidisparo) para que no salten al comprar; la primera fila es *Nivel de equipo* (dorada).
  - Descripción: valor actual para *Cadencia Auto* y *Multidisparo*; ganancia por nivel para el resto.
  - Estado: `can-buy` (fondo cálido y precio verde) si hay oro; precio gris si no; **`is-max`** con `MAX` y la fila deshabilitada al llegar al tope (mejoras limitadas).
- *Proyectiles* y *Autoclick* siguen sin mostrarse (decisión de diseño previa); no hay que reintroducirlos para rellenar espacio.

### 5.4 Audio (`AudioToggle`)

Dos botones cuadrados (música y efectos) de `3.1em`, con icono SVG que escala con la fuente. Silenciado = atenuado y fondo gris.

---

## 6. Reglas para modificar la interfaz

**Hacer**
- Dimensionar con `em` (o `%`, `fr`, `cq*`). Para bordes usa `var(--bw)` o un múltiplo.
- Reservar siempre el espacio de un contador o estado opcional (ranura de ancho fijo o `min-width`), aunque esté vacío.
- Para texto que puede crecer: `min-width: 0` en el elemento flex y `text-overflow: ellipsis` o `-webkit-line-clamp`, más `title` con el valor completo.
- Estimar anchos con la regla de la monoespaciada (`caracteres × tamaño`) antes de añadir etiquetas.
- Mantener el orden y los nombres de clase `gx-*`; los componentes del panel no deben usar utilidades Tailwind para tamaños.

**Evitar**
- `px`, `rem`, `vw` o `vh` en medidas dentro del panel (rompen la proporcionalidad). Las únicas excepciones son los mínimos de `--bw`/`--frame` y los `text-shadow` de 1 px.
- Añadir una fila a los controles que aparezca y desaparezca: cambiaría la altura de la banda y movería Pokémon/Mejoras. Si es necesario, cabe en una ranura existente (como el jefe sobre `SIGUIENTE PISO`).
- Meter `min-height` fijos grandes en tarjetas o fichas: el reparto del alto sobrante lo hace la rejilla.
- Cambiar `--sb-wd`/`--sb-hd` sin repetir la comprobación de §7.

---

## 7. Verificación

Antes de dar por buena cualquier modificación de la interfaz, comprobar en un navegador real con la fuente `Press Start 2P` cargada:

| Viewport | Qué se espera |
|---|---|
| 1872×961 (1080p con barras del navegador) | Horizontal; arena y panel llenan la pantalla, base alineada |
| 2515×1323 (1440p) | Ídem, texto proporcionalmente mayor |
| 1366×657 (portátil) | Horizontal con `--u` ≈ 12 px, sin recortes |
| 3440×1440 (ultrawide) | `--u` tope (22 px); composición centrada |
| 1024×768 (4:3) | Apilado; HUD visible bajo la arena |
| 820×1180 (tablet vertical) | Apilado, 2 columnas |
| 390×844 (móvil vertical) | Apilado, 1 columna |
| 844×390 (móvil horizontal) | Apilado ancho; arena de 360 px y scroll |

Estados a forzar en cada uno: **jefe activo y enfurecido**, **cuenta atrás entre pisos**, **escudo**, **Pokémon debilitado**, ***cooldown* de relevo**, **definitiva lista** y **valores altos** (oro de 6 cifras, piso de 3 cifras, nivel de equipo de 2 cifras, HP de jefe de 5 cifras).

Criterios de aceptación:
1. Ningún texto se recorta salvo los de elipsis/clamp previstos.
2. No hay scroll horizontal en la página.
3. Un cambio de estado no altera el tamaño de ningún botón ni la posición de otros bloques.
4. En modo horizontal, el panel no hace scroll en 1080p ni en 1440p.

> La estructura del layout se validó con una fuente monoespaciada de ancho equivalente. La verificación final con `Press Start 2P` y `VT323` reales debe hacerse en el proyecto (`npm run dev`).

---

## 8. Decisiones y compromisos

| Decisión | Motivo | Coste |
|---|---|---|
| `em` + `--u` calculado en CSS en lugar de `zoom` o `transform: scale` | Mantiene el layout real, el hit-testing y el texto nítido; sin JS | Hay que respetar la regla de no usar `px` |
| Banda de controles a ancho completo; Pokémon y Mejoras debajo | Separa lo que se pulsa de lo que se lee y agrupa todo lo del Pokémon en una sección | La columna Pokémon es la más cargada |
| Panel de la misma altura que la arena | Alineación visual y sin huecos | El sobrante de alto se reparte en tarjetas/fichas, que pueden quedar algo holgadas en pantallas muy anchas |
| Apilar en 4:3 y 5:4 | La arena a todo el alto no deja ancho suficiente para el panel | Requiere scroll de página en esas pantallas |
| Fichas de mejora con botón de coste propio | Objetivo táctil grande y estado de compra legible de un vistazo | Ocupan más alto que una lista compacta |
| Estado de jefe dentro de la barra | Evita chips que cambian el ancho de la fila | Texto superpuesto a la barra (con sombra para contraste) |

---

## 9. Mejoras pendientes

- Accesibilidad: roles y `aria-live` para cuenta atrás, escudo y estado de jefe; foco visible en botones; contraste de las etiquetas `#a8c0e0` sobre `#303030` ya cumple AA, pero revisar los textos grises sobre crema.
- Movimiento: `prefers-reduced-motion` ya desactiva el pulso de la definitiva; revisar el resto de transiciones si se añaden.
- Permitir ajustar la escala de la interfaz desde ajustes (multiplicador sobre `--u`) para pantallas muy grandes o con zoom del sistema.
- Tests visuales automáticos (Playwright) con la lista de viewports y estados de §7.
