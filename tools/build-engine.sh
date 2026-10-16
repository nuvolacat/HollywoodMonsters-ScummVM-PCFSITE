#!/usr/bin/env bash
# build-engine.sh [versión] — compila ScummVM para WebAssembly solo con el motor «hollywood» y nuestro parche.
#
# Resultado: web/scummvm/scummvm-<versión>.js + scummvm-<versión>.wasm (+ web/scummvm/data/: temas, iconos…).
# La versión va EN EL NOMBRE del fichero, no en la consulta (?v=): el .js y el .wasm deben ir siempre en pareja
# (un .js cacheado con un .wasm de otra compilación rompe con «ASM_CONSTS[...] is not a function»).
#
# Requisitos: git, python3, make, un compilador de C (para emsdk), ~6 GB libres y 15-30 min.
set -euo pipefail
VERSION="${1:-1}"
AQUI="$(cd "$(dirname "$0")/.." && pwd)"
TRABAJO="${TRABAJO:-$AQUI/.build}"
REPO="https://github.com/neuromancer/scummvm"
RAMA="dev-hollywood"
COMMIT="bf1025370c102a049d3af86649bec1dcbe8eb9dd"   # rama del PR scummvm/scummvm#7868 a 28-sep-2026 (probado)
mkdir -p "$TRABAJO"; cd "$TRABAJO"

if [ ! -d scummvm ]; then
  git clone --branch "$RAMA" "$REPO" scummvm
fi
cd scummvm
git fetch origin "$RAMA" || true
git checkout -f "$COMMIT"
git apply --check "$AQUI/patches/"*.patch && git apply "$AQUI/patches/"*.patch

# 1) emsdk (la versión la fija el propio script de ScummVM) + configure
./dists/emscripten/build.sh configure --disable-all-engines --enable-engine=hollywood

# 2) DATA_PATH: el configure de Emscripten fija datadir=/data; lo movemos a /scummvm/data para que no choque con
#    otras rutas de la web (el reproductor sirve los datos de ScummVM bajo /scummvm/data/ … o bajo la ruta que uses).
sed -i.bak 's#-DDATA_PATH=\\"/data\\" -DPLUGIN_DIRECTORY=\\"/data/plugins\\"#-DDATA_PATH=\\"/scummvm/data\\" -DPLUGIN_DIRECTORY=\\"/scummvm/data/plugins\\"#; s#^datadir = /data$#datadir = /scummvm/data#' config.mk
grep -q 'DATA_PATH=\\"/scummvm/data\\"' config.mk || { echo "No se pudo cambiar DATA_PATH en config.mk"; exit 1; }

# 3) compilar y empaquetar
EMSDK_DIR="$(ls -d dists/emscripten/emsdk-*/ | head -1)"
# shellcheck disable=SC1091
source "$EMSDK_DIR/emsdk_env.sh" >/dev/null
export EMSDK="$PWD/${EMSDK_DIR%/}"
emmake make -j"$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)"
emmake make dist-emscripten

# 4) copiar al reproductor
D="$AQUI/web/scummvm"; mkdir -p "$D"
cp build-emscripten/scummvm.js "$D/scummvm-$VERSION.js"
cp build-emscripten/scummvm.wasm "$D/scummvm-$VERSION.wasm"
rsync -a --exclude games build-emscripten/data/ "$D/data/"
echo "Hecho: web/scummvm/scummvm-$VERSION.js / .wasm. Pon «engineVersion: $VERSION» en web/config.js."
