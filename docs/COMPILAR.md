# Compilar el motor

El repositorio ya trae el motor compilado (`web/scummvm/scummvm-6.js` + `.wasm`), que es exactamente el que se probó.
Solo necesitas compilar si vas a cambiar algo del motor o del parche.

## Rápido

```sh
tools/build-engine.sh 7      # 7 = número de versión nuevo (siempre distinto del anterior)
```

Después, en `web/config.js`, pon `engineVersion: 7`.

El script:

1. Clona `github.com/neuromancer/scummvm` (rama `dev-hollywood`) en `.build/` y se sitúa en el commit probado
   `bf1025370c102a049d3af86649bec1dcbe8eb9dd`.
2. Aplica `patches/*.patch`.
3. Ejecuta `./dists/emscripten/build.sh configure --disable-all-engines --enable-engine=hollywood`. Este script de
   ScummVM descarga e instala emsdk (versión 4.0.10 a fecha de este commit) en `dists/emscripten/`.
4. Cambia `DATA_PATH` de `/data` a `/scummvm/data` en `config.mk`.
5. `emmake make` y `emmake make dist-emscripten`.
6. Copia `scummvm.js` y `scummvm.wasm` a `web/scummvm/scummvm-<N>.*` y los datos de interfaz a `web/scummvm/data/`.

Tiempo: 15–30 minutos la primera vez (emsdk + compilación), unos minutos después. Espacio: ~6 GB.

## Paso a paso (si el script falla)

```sh
git clone --branch dev-hollywood https://github.com/neuromancer/scummvm
cd scummvm && git checkout bf1025370c102a049d3af86649bec1dcbe8eb9dd
git apply ../patches/0001-emscripten-lectura-por-trozos-y-render-software.patch
./dists/emscripten/build.sh configure --disable-all-engines --enable-engine=hollywood
# DATA_PATH: el configure de Emscripten fija /data
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
