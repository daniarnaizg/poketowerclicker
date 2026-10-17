# Sprites decorativos editables (Spritesheets PNG)

Los elementos decorativos de la arena (árboles, cristales, lava, palmeras, columnas…, la
decoración suelta del suelo y el emblema de Poké Ball de la plataforma central) están organizados
en **hojas de sprites (spritesheets) por bioma**, siguiendo las mejores prácticas de desarrollo 2D:

1. **Un fichero por bioma** en vez de decenas de ficheros diminutos sueltos: puedes abrir toda la paleta de un bioma de golpe en tu editor (Aseprite, Photoshop, Piskel, GIMP).
2. **Organización en estantes (shelf rows)** con **separación de seguridad de 4 px** entre elementos: evita sangrado de color (*bleeding*), permite selección rectangular limpia y facilita retocar sin desalinear vecinos.
3. **Alto rendimiento web**: se pasa de 51 peticiones HTTP individuales a solo 5 hojas en paralelo, reduciendo latencia y uso de texturas en GPU.
4. **Metadatos en atlas JSON y tipado TS**: `public/decor/decor_atlas.json` y `src/renderer/decorAtlas.ts` guardan la posición `(x, y)` y dimensiones `(w, h)` exactas de cada sprite.

---

## Dónde están las hojas

Viven en `public/decor/<bioma>.png`:

| Fichero | Tamaño | Disposición en filas (de arriba a abajo) |
| --- | --- | --- |
| `public/decor/ruta_verde.png` | 138×96 | **Fila 1:** árboles (`tree_a`, `tree_b`), pino (`pine`)<br>**Fila 2:** arbustos (`bush_a`, `bush_b`, `bush_berries`), cartel (`sign`), roca (`rock`)<br>**Fila 3:** parches de flores y micro-detalles (`micro_grass_*`, `micro_flower_*`, `micro_pebble`) |
| `public/decor/cueva_umbria.png` | 136×87 | **Fila 1:** cúmulos de cristales (`crystals_a`, `b`), estalagmitas altas (`tall_a`, `b`)<br>**Fila 2:** estalagmitas bajas (`short_a`, `b`), rocas (`boulder_a`, `b`), seta luminosa (`glow_shroom`)<br>**Fila 3:** micro-detalles (`micro_shard`, `micro_crack`, `micro_pebble`) |
| `public/decor/monte_igneo.png` | 216×83 | **Fila 1:** charcos de lava (`lava_pool_a`, `b`), árboles secos (`dead_tree_a`, `b`)<br>**Fila 2:** rocas de lava (`lava_rock_a`, `b`, `c`, `d`)<br>**Fila 3:** micro-detalles (`micro_crack`, `micro_pebble`, `micro_ember`) |
| `public/decor/costa_ruinas.png` | 150×107 | **Fila 1:** palmera (`palm`), columnas (`column_full`, `broken_a`, `broken_b`)<br>**Fila 2:** pozas de marea (`tide_pool_a`, `b`)<br>**Fila 3:** estrella de mar (`starfish`), concha (`shell`), ondas (`micro_ripple`), guijarro (`micro_pebble`) |
| `public/decor/common.png` | 106×106 | Plataforma central de la arena con emblema Poké Ball (`platform`) |

---

## Cómo editarlas manualmente (Mejores prácticas)

1. **Abre la hoja del bioma en tu editor de pixel-art** (por ejemplo `public/decor/ruta_verde.png` en Aseprite).
2. **Dibuja o retoca dentro del espacio del sprite**. Gracias al margen de 4 px, puedes pintar con libertad sin riesgo de pisar otros sprites.
3. **Guarda el fichero PNG**.
4. **Recarga la pestaña del navegador**: el juego cargará automáticamente tu hoja editada.
5. **Si necesitas cambiar el tamaño o mover un sprite**:
   - Puedes ajustar directamente las coordenadas `(x, y, w, h)` en `public/decor/decor_atlas.json`.
   - O si prefieres regenerar la hoja desde el código procedural, ejecuta el script de exportación.

---

## Regenerar las hojas con el exportador

El proyecto incluye un script en `scripts/export-decor.ts` configurado en `package.json`:

```bash
npm run export:decor                     # Crea solo las hojas que no existan (conserva tus ediciones)
npm run export:decor -- --force          # Regenera TODAS las hojas (sobrescribe ediciones con el procedural)
npm run export:decor -- --only=ruta_verde # Regenera solo la hoja indicada
```

---

## Añadir un sprite nuevo

1. Añade la función generadora en `src/renderer/decorCatalog.ts`.
2. Añade el sprite a la fila deseada en `SHEET_LAYOUT` en `scripts/export-decor.ts`.
3. Ejecuta `npm run export:decor -- --force` para recalcular el atlas y la hoja.
4. Ya puedes usarlo por nombre en `cornerTemplates` o `microKit` de `src/renderer/backdrop.ts`.
