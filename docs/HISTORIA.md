# Historia técnica: de Windows 98 emulado a ScummVM nativo

Este documento cuenta, en orden y con las pruebas que se hicieron, todo el camino recorrido para poder jugar a
**Hollywood Monsters** (Pendulo Studios, 1997; 2ª edición de Dinamic, 1999-2000) en el navegador. Está escrito
para que quien quiera ayudar no repita lo que ya se descartó y sepa exactamente qué evidencia hay detrás de cada
decisión.

Fechas en formato día-mes de 2026.

---

## 1. Primer intento: el juego original dentro de un Windows 98 emulado (js-dos / DOSBox-X)

### 1.1 Montaje

- Motor: **js-dos 8.5.3** (DOSBox-X compilado a WebAssembly), el mismo sistema con el que funcionan en la web otros
  juegos de Windows 98 de la época (por ejemplo PC Fútbol 2000/2001).
- Instalación: el juego se instaló **con su instalador original** (`INSTALAR.EXE`, instalación máxima, sin DirectX)
  dentro de una máquina virtual QEMU con Windows 98 SE, y la carpeta resultante se copió a `C:\Monsters` de una
  imagen de Windows 98 genérica preparada para js-dos.
- El lanzador del juego necesita unas claves de registro de Dinamic (`HKCU\Software\Dinamic Multimedia\Instalar\
  Hollywood Monsters`: `Instalado`, `DirIni`, etc.) que se exportaron de la instalación y se reaplicaban al arrancar.
- CD: la imagen original es un **CD mixto**: una pista de datos y **dos pistas de audio**. Se montó como `.bin` crudo
  (2352 bytes/sector) más un `.cue` generado en el navegador; también se probó solo la pista de datos (`.iso`).

### 1.2 Resultado

El juego **arrancaba solo y la intro se veía a los ~60 s**, pero el sonido salía con **eco y trompicones**:
fragmentos que «se repiten».

### 1.3 Lo que se probó para el sonido (sin éxito)

| Prueba | Resultado |
|---|---|
| Aceleración de hardware de DirectSound en «Completa» (en tiempo de ejecución y horneada en el registro: valor `Acceleration` borrado en `...\MEDIA\0000\DirectSound\Mixer Defaults`) | Igual |
| Mezclador de DOSBox-X: `rate=22050`, `blocksize=4096`, `prebuffer=100` | Igual |
| Mezclador estándar: `rate=44100`, `blocksize=1024`, `prebuffer=25` | Igual |
| `cycles=auto` y `cycles` fijos | Igual |
| CD solo con la pista de datos (sin las pistas de audio) | Igual |
| Escritorio de Windows a 256 colores (`BitsPerPixel=8`) | Igual |
| Emulador en el hilo principal en vez de en un Worker | Igual |
| Variante JSPI del motor (sin Asyncify) | Igual |
| Sound Blaster 16 «clásica» en vez de la Vibra | Rompe DirectSound (el controlador instalado es el de la Vibra) |
| Sustituir el AudioWorklet de js-dos por una cola FIFO simple | Igual |

### 1.4 Análisis del eco

- Una grabación del sonido con eco se analizó con autocorrelación de la envolvente y correlación de la forma de onda
  por ventanas: **hay copias exactas de la onda repetidas cada 250 ms** (pico muy afilado en 250 ms; a 248 o 252 ms
  ya no hay correlación). Es la firma de un **búfer circular de audio que se reproduce otra vez** porque no se rellena
  a tiempo, no de un filtro ni de un desfase.
- La capa de audio de js-dos usa un AudioWorklet con **estirado de tiempo** (busca tramas parecidas, las solapa y
  ajusta el tempo entre 0,95 y 1,05 según el llenado de la cola). Con una entrega irregular rellena repitiendo tramas.
  Aun así, sustituirlo por una cola simple no lo arregló: el origen está en cómo el Windows emulado alimenta el búfer
  de la Sound Blaster.
- En **QEMU nativo el mismo juego sonaba perfecto**, lo que descarta los datos y apunta al emulador web.

### 1.5 Conclusión

El camino «Windows 98 emulado» se abandonó para este juego: el eco no se pudo eliminar y además la descarga y el
arranque de Windows son pesados.

---

## 2. Segundo camino: ScummVM con el motor «hollywood»

### 2.1 El motor

El 10-oct apareció el **PR scummvm/scummvm#7868** de *neuromancer*: un motor nativo de ScummVM para Hollywood Monsters
(versión DOS y Windows, incluida la edición italiana y las demos). No ejecuta el binario original: reimplementa el
juego. Rama: `dev-hollywood` de `github.com/neuromancer/scummvm`.

### 2.2 Verificación en nativo (macOS)

- Compilado con `./configure --disable-all-engines --enable-engine=hollywood && make`.
- Los datos de la carpeta `MONSTERS` del CD de la 2ª edición española coinciden **exactamente** con la entrada
  «Spanish Windows full game» de la detección (MD5 de los primeros 5000 bytes de `MONSTERS.EXE`, `RESOURCE.000` y
  `RESOURCE.003`; ver `DATOS.md`).
- El juego arranca, la intro suena limpia, se juega.

### 2.3 Compilación para WebAssembly

- `./dists/emscripten/build.sh configure make dist --disable-all-engines --enable-engine=hollywood` (emsdk 4.0.10).
- El motor resultante pesa ~12 MB (`scummvm.wasm`) + ~9 MB de datos de interfaz (temas, iconos, traducciones).
- **Sonido**: correcto desde el primer momento. El único requisito es el habitual de los navegadores: el
  `AudioContext` solo arranca tras un gesto del usuario (el botón «Jugar»).

### 2.4 Problemas resueltos al integrarlo en una web

Cada punto tiene detalle en `REPRODUCTOR.md` y `PARCHE.md`.

1. **Argumentos de arranque ignorados.** El `pre-js` de ScummVM crea `Module.arguments = []` al cargar y el runtime
   se queda con *ese* array; sustituirlo por otro no tiene efecto. Hay que rellenarlo con `push()`.
2. **Ruta de datos.** El `configure` de Emscripten fija `DATA_PATH=/data`. Se cambia a `/scummvm/data` editando
   `config.mk` tras configurar.
3. **Aviso de motor inestable.** `enable_unsupported_game_warning=false` en el `.ini`.
4. **Pantalla negra al principio.** El motor tarda en montar la primera escena (de 15 a 40 s en equipos lentos); la
   portada de carga se mantiene hasta que el lienzo pinta o hasta un tope.
5. **Memoria (equipos de 4 GB).** Con la descarga «completa» clásica (los 485 MB en memoria y después copiados al
   sistema de ficheros de Emscripten) Chrome se colgaba al final de la descarga (`RESULT_CODE_HUNG`). Solución en
   tres piezas:
   - descarga **directa al almacén privado del navegador (OPFS)**, en un Web Worker con
     `FileSystemSyncAccessHandle`, sin pasar por memoria;
   - **lectura por trozos de 1 MB** desde el motor (parche `HTTPRangeStream` en el sistema de ficheros HTTP);
   - cada trozo se entrega como un `blob:` de `File.slice()` del fichero local.
6. **Corrupción con lecturas asíncronas.** La primera versión de la lectura por trozos usaba `fetch` + `await`
   (Asyncify). El callback de audio de SDL reentraba en el wasm durante la espera y aparecía
   `memory access out of bounds`. Se cambió a un **XMLHttpRequest síncrono** (`EM_JS`, sin Asyncify).
7. **Range sobre blob:.** Chromium devuelve 206 con `Range` sobre una URL `blob:` de un `File`, pero no es algo en lo
   que apoyarse en todos los navegadores; la versión final recorta el trozo con `File.slice()` y pide el blob entero.
8. **Service Worker descartado.** Se probó servir los trozos con un Service Worker: **los XHR síncronos no pasan por
   el Service Worker** (comprobado: 404 del servidor real).
9. **Caché del motor.** `scummvm.wasm` se servía con caché inmutable de un año y el `.js` con versión en la consulta:
   los navegadores combinaban un `.js` de una compilación con un `.wasm` de otra →
   `ASM_CONSTS[emAsmAddr] is not a function` y arranque roto sin mensaje. Solución: **pareja con la versión en el
   nombre del fichero** (`scummvm-6.js` + `scummvm-6.wasm`).
10. **Política de seguridad (CSP).** Las páginas de prueba con `<script>` en línea no funcionaban en el servidor real
    porque la CSP solo permite scripts externos. Todo el JS va en ficheros.
11. **Partidas.** ScummVM guarda en `/saves` (memoria). Se empaqueta el directorio (formato `PCFSVM01`) y se persiste;
    al arrancar se restaura antes de que el motor lea nada. Probado: guardar dentro del juego → recargar → la partida
    aparece en «Cargar».

### 2.5 Estado al publicar este repositorio (16-oct)

- **Funciona** en macOS con Edge y Safari, en Chromium y en WebKit (pruebas automáticas), y en equipos con Chrome.
- **Problema abierto**: en un MacBook con Apple M4, 16 GB y Edge 155 (gemelo del equipo donde funciona), el navegador
  se cuelga tras pulsar «Jugar». El diagnóstico de ese equipo está limpio. Detalle y pistas en `PROBLEMAS.md`.
- Por eso el juego se **retiró** de la web pública a la espera de resolverlo, y se abre este repositorio para que la
  comunidad ayude.

### 2.6 El arreglo de Gustavo Grieco (16-oct)

Gustavo Grieco (neuromancer), autor del motor `hollywood` en ScummVM, propuso un cambio mínimo:

- compilar la cabeza del PR (`689f26c7`) **sin parches**, en modo release: la corrección de audio ya estaba upstream;
- exponer `ENV` de Emscripten para dirigir el teclado de SDL a la página (`SDL_EMSCRIPTEN_KEYBOARD_ELEMENT`);
- cargar los datos enteros en memoria en vez de leerlos por trozos con XHR síncrono;
- quitar la portada en cuanto arranca el motor y bloquear el menú contextual del lienzo.

Se revisó el cambio (solo commits de neuromancer dentro de `engines/hollywood`, sin binarios ni direcciones nuevas), se
compiló como versión 7 y se probó: el MacBook que se colgaba lo juega sin problemas. El juego volvió a publicarse.

