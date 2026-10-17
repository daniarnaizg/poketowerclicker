# Sprites decorativos editables (PNG)

Los elementos decorativos de la arena (árboles, cristales, lava, palmeras, columnas…, la
decoración suelta del suelo y el emblema de Poké Ball de la plataforma central) se pueden
editar a mano como PNG.

## Dónde están

`public/decor/<bioma>/<nombre>.png`, por ejemplo `public/decor/ruta_verde/tree_a.png`.
Son PNG RGBA normales (con transparencia): ábrelos con Aseprite, Piskel, GIMP, Photoshop…

| Carpeta | Contenido |
| --- | --- |
| `ruta_verde/` | árboles, pino, arbustos, flores, roca, cartel + `micro_*` (matas, florecitas, guijarro) |
| `cueva_umbria/` | cristales, estalagmitas, rocas, seta luminosa + `micro_*` |
| `monte_igneo/` | charcos de lava, rocas, árboles calcinados + `micro_*` |
| `costa_ruinas/` | palmera, columnas, pozas, estrella, concha + `micro_*` |
| `common/` | `platform.png`: emblema de la plataforma central (98×98) |

Los `micro_*` son los detalles pequeños repartidos por el suelo; el resto se coloca en las
esquinas (ver `cornerTemplates` en `src/renderer/backdrop.ts`).

## Cómo funciona

- Si existe el PNG, el juego usa **ese**. Si no existe (o falla al cargar), usa el sprite
  procedural original (`src/renderer/decor.ts`). Borrar un PNG = volver al original.
- Puedes **cambiar el tamaño** del lienzo de un sprite: la colocación se calcula con sus
  dimensiones reales. Las esquinas derechas usan el sprite **espejado**, así que evita texto
  o luz que deba quedar siempre en el mismo lado.
- El fondo del terreno (color base y manchas) sigue siendo procedural; los sprites se pintan
  encima. La escala en pantalla es ≈3,3× con `image-rendering: pixelated`.
- Tras editar un PNG, recarga la página (el backdrop se genera una vez por bioma).

## Regenerar los PNG

```bash
pnpm run export:decor                       # crea solo los que falten (no pisa tus ediciones)
pnpm run export:decor -- --force            # regenera TODOS (sobrescribe tus ediciones)
pnpm run export:decor -- --only=ruta_verde/ # solo los que empiecen por ese prefijo
```

## Añadir un sprite nuevo

1. Añade una entrada a `DECOR_CATALOG` en `src/renderer/decorCatalog.ts` (nombre + builder).
2. Úsala por nombre en `cornerTemplates` / `microKit` de `src/renderer/backdrop.ts`.
3. `pnpm run export:decor` para generar su PNG inicial y edítalo a tu gusto.
