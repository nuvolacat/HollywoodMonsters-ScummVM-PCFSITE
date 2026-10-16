# Cómo contribuir

Gracias por ayudar. Lo que más falta hace ahora mismo es **probarlo en equipos con poca memoria** (4 GB): el juego
carga sus 486 MB en la memoria de la pestaña ([docs/PROBLEMAS.md](docs/PROBLEMAS.md)).

## Reglas

- **Nunca subas datos del juego** (ficheros del CD, imágenes, partidas con contenido del juego). Solo código,
  documentación y huellas (`hashes.json`).
- Los fallos del **propio juego** (escenas, diálogos, gráficos dentro del juego) son del motor `hollywood` de
  ScummVM: repórtalos en el PR scummvm/scummvm#7868. Aquí, lo que tenga que ver con la web (descarga, memoria,
  cuelgues, partidas, rendimiento).
- El motor se compila sin parches desde la rama del PR. Los cambios del motor deben ir al PR de ScummVM; aquí solo
  se actualiza el commit en `tools/build-engine.sh` y se compila con un número de versión nuevo.

## Informar de un problema

Incluye:

1. Equipo, sistema operativo y navegador con versión.
2. Captura completa de `diag.html`.
3. Si probaste `?svmfresh=1` (borra la copia local y descarga de nuevo) y qué pasó.
4. La consola del navegador hasta el fallo, si puedes abrirla.

## Antes de enviar cambios

- `node tools/e2e.mjs` debe acabar en `RESULTADO: OK` (necesitas tus datos del juego colocados).
- `diag.html` debe dar `128 correctos`.
- Explica en el PR qué problema resuelve y en qué equipos lo has probado.
