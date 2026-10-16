# Hollywood Monsters en el navegador (ScummVM + WebAssembly)

Reproductor web para jugar a **Hollywood Monsters** (Pendulo Studios, 1997) en el navegador, sin emuladores de
Windows, usando el motor `hollywood` de ScummVM compilado a WebAssembly.

Proyecto de la comunidad de **PCFSITE**. Se publica abierto para que cualquiera pueda ayudar a terminarlo.

> **Este repositorio no incluye el juego.** Necesitas tu propio CD original. Ver [docs/DATOS.md](docs/DATOS.md).

## Estado

| | |
|---|---|
| Arranca y se juega (2ª edición, español, Windows) | ✅ |
| Guardar y cargar desde el menú del juego, con recuperación al recargar | ✅ |
| Copia local de los datos (se descargan una vez) | ✅ |
| Lectura por trozos para no tener 486 MB en memoria | ✅ |
| Funciona en Chromium/WebKit y en varios Mac con Edge y Safari | ✅ |
| **En algunos equipos el navegador se cuelga al arrancar** | ❌ abierto, ver [PROBLEMAS.md](docs/PROBLEMAS.md) |

Por ese cuelgue el juego está retirado de nuestra web hasta resolverlo. Si sabes de WebAssembly, Emscripten o
ScummVM, tu ayuda es bienvenida.

## Probarlo en 5 minutos

```sh
git clone https://github.com/nuvolacat/HollywoodMonsters-ScummVM-PCFSITE
cd HollywoodMonsters-ScummVM-PCFSITE
# copia la carpeta MONSTERS de tu CD dentro de web/scummvm/data/games/hollywood/
python3 tools/make-index.py web/scummvm/data/games/hollywood web/scummvm/data/games/hollywood
cd web && python3 -m http.server 8000
```

Abre <http://localhost:8000/> y pulsa **Jugar**. La primera vez copia los datos al almacén del navegador.

Opciones útiles: `?boot=1010` (empieza en una escena jugable), `?svmmode=mem|slice`, `?svmgfx=soft`, `?svmfresh=1`.
Diagnóstico del equipo: <http://localhost:8000/diag.html>.

## Estructura

```
web/                 reproductor listo para servir (motor compilado incluido)
  config.js          lo que se suele cambiar: versión del motor, ruta de los datos…
  player.js          descarga, arranque, lectura por trozos, partidas
  svm-worker.js      descarga al almacén local (OPFS) en un Worker
  diag.html/.js      diagnóstico del navegador y de la copia local
  scummvm/           scummvm-6.js + scummvm-6.wasm + datos de interfaz de ScummVM
patches/             parche sobre ScummVM (backend Emscripten)
tools/
  build-engine.sh    compila el motor con el parche
  make-index.py      genera index.json y hashes.json de tus datos
  e2e.mjs            prueba automática con Playwright (arrancar, guardar, recargar)
docs/
  HISTORIA.md        todo lo que se probó y por qué se llegó aquí
  PROBLEMAS.md       problemas abiertos e hipótesis
  REPRODUCTOR.md     cómo funciona el reproductor
  PARCHE.md          qué cambia el parche y por qué
  COMPILAR.md        compilar el motor (web y nativo)
  DESPLIEGUE.md      publicarlo en un servidor
  DIAGNOSTICO.md     leer el diagnóstico
  DATOS.md           qué datos hacen falta y cómo comprobarlos
```

## Cómo ayudar

1. Lee [docs/PROBLEMAS.md](docs/PROBLEMAS.md) y [docs/HISTORIA.md](docs/HISTORIA.md) para no repetir lo descartado.
2. Si tu equipo se cuelga, comparte el diagnóstico y prueba las variantes.
3. Si tienes una idea para el cuelgue (motor en un Worker, JSPI, lecturas sin XHR síncrono…), abre un issue o PR.

Detalles en [CONTRIBUIR.md](CONTRIBUIR.md).

## Créditos

- **ScummVM** y su equipo: <https://www.scummvm.org>.
- El motor `hollywood` es obra de **neuromancer** y colaboradores, en el PR
  [scummvm/scummvm#7868](https://github.com/scummvm/scummvm/pull/7868). Este proyecto solo añade el reproductor web
  y un parche pequeño al backend de Emscripten.
- **Hollywood Monsters** © Pendulo Studios. Distribuido en España por Dinamic Multimedia. Este proyecto no tiene
  relación con los titulares de los derechos.

## Licencia

GPL-3.0 o posterior, como ScummVM. Ver [LICENSE](LICENSE). El motor compilado incluido (`web/scummvm/`) se
distribuye bajo la licencia de ScummVM; su código fuente es la rama indicada en [docs/PARCHE.md](docs/PARCHE.md) más
el parche de `patches/`.
