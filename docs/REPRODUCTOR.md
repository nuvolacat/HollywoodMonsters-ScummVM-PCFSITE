# El reproductor web (`web/`)

Ficheros:

| Fichero | Qué hace |
|---|---|
| `index.html` | Página: lienzo 4:3, portada con «Jugar», barra de progreso y botones de partidas |
| `config.js` | Configuración: versión del motor, ruta de los datos, sufijo, carpeta local, clave de partidas |
| `player.js` | Toda la lógica (descarga, arranque, partidas) |
| `svm-worker.js` | Web Worker que descarga los datos al almacén privado del navegador (OPFS) |
| `player.css` | Estilos |
| `diag.html` + `diag.js` | Diagnóstico del navegador y de la copia local |
| `scummvm.ini` | Configuración por defecto que ScummVM pide al arrancar |
| `scummvm/scummvm-<N>.js` + `.wasm` | El motor (pareja inseparable, ver «Versiones») |
| `scummvm/data/` | Datos de la interfaz de ScummVM (temas, iconos, traducciones) e índice de juegos |

## Secuencia de arranque

```
[Jugar] ─► leer partida de IndexedDB ─► cargar scummvm-N.js ─► preRun:
            · escribir /scummvm.ini
            · restaurar /saves desde la partida
            · addRunDependency("hm-datos")   ← el motor espera
            · fetch(dataBase/index.json)
            · Worker: descarga de cada fichero → OPFS (6 a la vez… 3 en el worker actual)
            · abrir los File de OPFS
            · copiar los ficheros enteros a /.cache/scummvm/data/games/<target>/ (MEMFS, ~486 MB)
            · ENV.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT = "body" (el teclado de SDL escucha en la página)
            · removeRunDependency("hm-datos")  ← arranca el motor
        ─► ScummVM: -c /scummvm.ini [-b escena] hollywood
        ─► «Running Hollywood Monsters (Windows/Spanish)» ─► portada fuera y foco en el lienzo
```

## Descarga al almacén local (OPFS)

- Se hace en `svm-worker.js` con `FileSystemSyncAccessHandle`: cada fichero se escribe según llega, **sin acumular
  en memoria**. En el hilo principal, `createWritable()` colgaba o fallaba en algunos navegadores (Safari).
- Antes de descargar, si el fichero ya está en OPFS **con el tamaño correcto**, se reutiliza: la segunda vez el juego
  arranca sin descargar nada.
- Carpeta: `HM_CONFIG.storageDir` (por defecto `hm-scummvm`); ficheros `<target>_<nombre>`.
- `?svmfresh=1` borra esa carpeta y la carpeta persistente de ScummVM (`IndexedDB /home/web_user`) y descarga de nuevo.

## Datos en memoria

Desde el 16-oct (arreglo de Gustavo Grieco) el motor es ScummVM **sin parches**. Su sistema de ficheros HTTP, al
abrir un fichero, mira primero en `/.cache/...`; el reproductor deja allí los 128 ficheros (~486 MB) copiados de la
copia local (OPFS), así el motor nunca descarga nada por su cuenta.

Coste: la pestaña tiene los datos del juego enteros en memoria. Hasta el 16-oct había un modo «por trozos» con un
parche propio (ver [PARCHE.md](PARCHE.md)) pensado para equipos de 4 GB; se quitó porque las lecturas síncronas
colgaban el navegador en algunos equipos.

## Partidas

- ScummVM guarda en `/saves` (sistema de ficheros en memoria). El reproductor, cada 10 s y al ocultar o cerrar la
  pestaña, lee `/saves`, lo empaqueta y, si ha cambiado, lo guarda en IndexedDB (`hm-scummvm-saves`, clave
  `HM_CONFIG.saveKey`).
- Formato **`PCFSVM01`**:

  ```
  "PCFSVM01" (8 bytes) · u32 n (LE)
  n × ( u16 longitud del nombre · nombre UTF-8 · u32 longitud de los datos · datos )
  ```
- Al arrancar, antes de que el motor lea nada, se restauran los ficheros en `/saves`.
- «Descargar copia» guarda el paquete como `hollywood.hmsave`; «Restaurar copia» lo carga (se valida el formato).
- Casilla «Continuar con mi partida guardada» desmarcada = empieza de cero y **borra** la partida guardada.
- El `.ini` pone `savepath=/saves` y `autosave_period=120` (ScummVM guarda solo cada 2 minutos en la ranura 0).

En una web con cuentas de usuario, basta con sustituir las funciones de `idb` por llamadas al servidor (es lo que hace
la versión que usamos en producción).

## Versiones del motor

`scummvm-<N>.js` y `scummvm-<N>.wasm` llevan **la versión en el nombre del fichero**. El `.js` generado por
Emscripten está ligado a su `.wasm` (tabla `ASM_CONSTS`): si el navegador combina un `.js` de una compilación con un
`.wasm` de otra, el arranque falla con `ASM_CONSTS[emAsmAddr] is not a function`. Con versionado por consulta
(`?v=`) y caché inmutable eso pasó en equipos reales. Cada compilación nueva debe llevar un número nuevo
(`tools/build-engine.sh <N>` y `engineVersion` en `config.js`).

`locateFile` traduce `scummvm.wasm` a `scummvm/scummvm-<N>.wasm`.

## Opciones por URL

| Opción | Efecto |
|---|---|
| `?boot=1010` | Arranca directamente en una escena (opción `-b` de ScummVM; útil para pruebas: 1010 es una escena jugable del principio) |
| `?svmfresh=1` | Borra la copia local y la carpeta persistente de ScummVM y descarga de nuevo |

## Requisitos del servidor (despliegue)

- **Servir `web/` como raíz del sitio**: ScummVM busca sus datos en la ruta absoluta `/scummvm/data/` (DATA_PATH
  compilado). Si lo sirves en una subcarpeta, recompila cambiando DATA_PATH o reescribe esa ruta en el servidor.
- `application/wasm` como tipo MIME de `.wasm` (casi todos los servidores ya lo hacen).
- No hace falta aislamiento de origen (`COOP`/`COEP`): este motor no usa hilos.
- Si usas **CSP**, todo el JS está en ficheros externos (sin scripts en línea); necesitas `'wasm-unsafe-eval'` en
  `script-src`.
- Caché recomendada: el motor y los datos del juego, inmutables (llevan versión o no cambian); `index.html`,
  `player.js` y `config.js`, sin caché o cortos.
- Para probar en local: `cd web && python3 -m http.server 8000` y abrir `http://localhost:8000/`.
