# Cómo contribuir

Gracias por ayudar. Lo que más falta hace ahora mismo es **resolver el cuelgue del navegador en algunos equipos**
([docs/PROBLEMAS.md](docs/PROBLEMAS.md)).

## Reglas

- **Nunca subas datos del juego** (ficheros del CD, imágenes, partidas con contenido del juego). Solo código,
  documentación y huellas (`hashes.json`).
- Los fallos del **propio juego** (escenas, diálogos, gráficos dentro del juego) son del motor `hollywood` de
  ScummVM: repórtalos en el PR scummvm/scummvm#7868. Aquí, lo que tenga que ver con la web (descarga, memoria,
  cuelgues, partidas, rendimiento).
- Si tocas el motor, actualiza el parche (`git diff` sobre el commit base, ver [docs/PARCHE.md](docs/PARCHE.md)) y
  compila con un número de versión nuevo.

## Informar de un problema

Incluye:

1. Equipo, sistema operativo y navegador con versión.
2. Captura completa de `diag.html`.
3. Qué variantes probaste (`?svmfresh=1`, `?svmmode=mem`, `?svmmode=slice`, `?svmgfx=soft`) y qué pasó con cada una.
4. La consola del navegador hasta el fallo, si puedes abrirla.

## Antes de enviar cambios

- `node tools/e2e.mjs` debe acabar en `RESULTADO: OK` (necesitas tus datos del juego colocados).
- `diag.html` debe dar `128 correctos`.
- Explica en el PR qué problema resuelve y en qué equipos lo has probado.
