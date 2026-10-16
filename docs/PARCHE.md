# El parche sobre ScummVM

Fichero: `patches/0001-emscripten-lectura-por-trozos-y-render-software.patch`.
Base: rama `dev-hollywood` de `github.com/neuromancer/scummvm`, commit `bf1025370c102a049d3af86649bec1dcbe8eb9dd`
(28-sep-2026), que es la rama del PR scummvm/scummvm#7868. Solo toca el backend de Emscripten; el motor del juego no
se modifica.

Cuatro ficheros, 121 líneas añadidas:

## 1. `backends/fs/emscripten/http-fs.cpp` y `http-fs.h`: lectura por trozos

### Contexto

En la compilación web, ScummVM accede a sus datos con un sistema de ficheros HTTP (`HTTPFilesystemNode`): lista los
directorios leyendo un `index.json` y, al abrir un fichero, **lo descarga entero** a una caché en memoria
(`/.cache/...`) y lo lee desde ahí. Para un juego de 486 MB eso supone tener el juego entero en la memoria de la
pestaña, más copias intermedias, y algunos navegadores se cuelgan.

### Cambios

- **`HTTPRangeStream`**: un `SeekableReadStream` que lee el fichero por **trozos de 1 MiB** bajo demanda, con una
  caché LRU de **96 trozos** (como máximo ~96 MB en memoria). `read()` copia de los trozos cargados y pide los que
  falten; `seek()` solo mueve la posición.
- **`createReadStream()`**: si el fichero **no** está ya en `/.cache/...` y su URL empieza por `http`, devuelve un
  `HTTPRangeStream` en vez de descargarlo entero. Si el reproductor dejó el fichero en `/.cache` (modo «mem»), se usa
  como siempre.
- **`_httpFsFetchRange()`** (`EM_JS`, **síncrona**): pide un trozo con un `XMLHttpRequest` síncrono
  (`responseText` con `charset=x-user-defined`, copiado byte a byte a `HEAPU8`).
  - Antes de pedirlo pregunta a la página: `globalThis.svmRangeUrl(url, inicio, longitud)`.
    - Si devuelve un objeto `{url}`, esa URL ya **es** el trozo (el reproductor da un `blob:` de `File.slice()` de la
      copia local): se pide sin cabecera `Range`, y después se llama a `globalThis.svmRangeDone(objeto)` para liberarlo.
    - Si devuelve una cadena, se pide esa URL con `Range: bytes=…` (lectura directa del servidor).
    - Si no existe la función, se usa la URL original con `Range`.
  - Si el servidor ignora `Range` y devuelve 200 con el fichero entero, se considera error (sería una descarga enorme
    síncrona).
  - **Por qué síncrona**: la primera versión usaba `EM_ASYNC_JS` + `fetch` + `await` (Asyncify). Mientras el wasm
    estaba suspendido, el callback de audio de SDL volvía a entrar en el motor y corrompía la pila
    (`memory access out of bounds`, `table index is out of bounds`). Con XHR síncrono no hay suspensión.
- **Sufijo por directorio** (`_suffix`): en el `index.json` de juegos, un directorio puede declarar
  `{"suffix": ".bin"}`; a las URL de sus ficheros se les añade ese sufijo. Sirve para CDN que solo cachean ciertas
  extensiones. También se hereda al resolver un nodo desde su padre.

## 2. `backends/platform/sdl/emscripten/emscripten.cpp`: render por software opcional

Al iniciar, si la página definió `globalThis.svmSoftRender = true`, fija `SDL_HINT_RENDER_DRIVER=software` (render de
SDL sin WebGL) y lo anota en el registro (`pcfsite: render SDL por software`). El reproductor lo activa con
`?svmgfx=soft`. Pensado para diagnosticar equipos con problemas de WebGL.

## 3. `backends/graphics/surfacesdl/surfacesdl-graphics.cpp`: traza del renderer

Tras crear el renderer de SDL, en Emscripten escribe `pcfsite: SDL renderer = <nombre>` en la consola. Solo
diagnóstico.

## Cómo aplicarlo a mano

```sh
git clone --branch dev-hollywood https://github.com/neuromancer/scummvm
cd scummvm
git checkout bf1025370c102a049d3af86649bec1dcbe8eb9dd
git apply ../patches/0001-emscripten-lectura-por-trozos-y-render-software.patch
```

Si la rama del PR avanza y el parche deja de aplicar, los cambios son independientes del motor y se pueden portar a
mano: son solo esos tres ficheros del backend.

## ¿Para ScummVM oficial?

La lectura por trozos podría interesar a ScummVM para cualquier juego grande en la web. Antes de proponerla habría que:
generalizarla (tamaño de trozo y de caché configurables), resolver el bloqueo del hilo principal en equipos lentos
(ver `PROBLEMAS.md`) y quitar las trazas `pcfsite:`.
