# Compilar el motor

El repositorio ya trae el motor compilado (`web/scummvm/scummvm-7.js` + `.wasm`), que es exactamente el que se probó.
Se compila **sin parches** desde la rama del PR de ScummVM. Solo necesitas compilar para actualizar a un commit nuevo
de esa rama.

## Rápido

```sh
tools/build-engine.sh 8      # 8 = número de versión nuevo (siempre distinto del anterior)
```

Después, en `web/config.js`, pon `engineVersion: 8`.

El script:

1. Clona `github.com/neuromancer/scummvm` (rama `dev-hollywood`) en `.build/` y se sitúa en el commit probado
   `689f26c7d3f1c4eaa76067c3fe37d12b55902fe3` (cabeza del PR scummvm/scummvm#7868 a 16-oct-2026).
2. Ejecuta `./dists/emscripten/build.sh configure --disable-all-engines --enable-engine=hollywood
   --enable-release-mode --disable-debug --enable-optimizations`. Este script de
   ScummVM descarga e instala emsdk (versión 4.0.10 a fecha de este commit) en `dists/emscripten/`.
3. Cambia `DATA_PATH` de `/data` a `/scummvm/data` en `config.mk`.
4. Añade `ENV` a `EXPORTED_RUNTIME_METHODS` en `config.mk` (el reproductor dirige el teclado de SDL a la página).
5. `emmake make` y `emmake make dist-emscripten`.
6. Copia `scummvm.js` y `scummvm.wasm` a `web/scummvm/scummvm-<N>.*` y los datos de interfaz a `web/scummvm/data/`.

Tiempo: 15–30 minutos la primera vez (emsdk + compilación), unos minutos después. Espacio: ~6 GB.

## Paso a paso (si el script falla)

```sh
git clone --branch dev-hollywood https://github.com/neuromancer/scummvm
cd scummvm && git checkout 689f26c7d3f1c4eaa76067c3fe37d12b55902fe3
./dists/emscripten/build.sh configure --disable-all-engines --enable-engine=hollywood \
  --enable-release-mode --disable-debug --enable-optimizations
# el reproductor necesita ENV (teclado de SDL); DATA_PATH: el configure de Emscripten fija /data
sed -i.bak 's/writeArrayToMemory]/writeArrayToMemory,ENV]/' config.mk
sed -i.bak 's#-DDATA_PATH=\\"/data\\" -DPLUGIN_DIRECTORY=\\"/data/plugins\\"#-DDATA_PATH=\\"/scummvm/data\\" -DPLUGIN_DIRECTORY=\\"/scummvm/data/plugins\\"#; s#^datadir = /data$#datadir = /scummvm/data#' config.mk
source dists/emscripten/emsdk-*/emsdk_env.sh
export EMSDK=$PWD/dists/emscripten/emsdk-4.0.10
emmake make -j8 && emmake make dist-emscripten
ls build-emscripten/   # scummvm.js, scummvm.wasm, data/
```

### Problemas conocidos al compilar

- `./configure --datadir=/scummvm/data` **no sirve**: el configure de Emscripten lo sobrescribe con `/data`. Hay que
  editar `config.mk` después, y si ya habías compilado, tocar (`touch`) los ficheros que usan `DATA_PATH` para que se
  recompilen: `backends/platform/sdl/sdl.cpp`, `backends/platform/sdl/emscripten/emscripten.cpp` y
  `backends/fs/emscripten/*.cpp`. Comprobación: `strings build-emscripten/scummvm.wasm | grep /scummvm/data`.
- El script de ScummVM usa `wget`; en macOS sin `wget`, descarga a mano el `.tar.gz` de emsdk o instala `wget`.
- `make clean` antes de reconfigurar si cambias de compilación nativa a web en la misma carpeta.

## Compilación nativa (para comparar)

Útil para saber si un fallo es del motor o de la web:

```sh
./configure --disable-all-engines --enable-engine=hollywood && make -j8
./scummvm --detect -p /ruta/a/MONSTERS
./scummvm -c mi.ini hollywood
```

con `mi.ini`:

```ini
[scummvm]
enable_unsupported_game_warning=false
[hollywood]
gameid=hollywood
engineid=hollywood
path=/ruta/a/MONSTERS
language=es
platform=windows
```

## Pruebas automáticas

`tools/e2e.mjs` (Playwright) arranca el juego en una escena jugable, guarda una partida desde el menú del juego,
recarga y comprueba que se recupera. Ver el propio fichero para usarlo.
