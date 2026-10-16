# Problemas abiertos

## 1. El navegador se cuelga en algunos equipos (prioritario)

### Síntoma

Tras pulsar «Jugar», la página llega a «Cargando Hollywood Monsters…» y **el navegador deja de responder**
(pestaña congelada; a veces Chrome/Edge la marca como `RESULT_CODE_HUNG`). No aparece ningún error en la consola.

### Equipos

| Equipo | Navegador | Resultado |
|---|---|---|
| Mac mini / MacBook con Apple M4, 16 GB | Edge 155, Safari | **Funciona** |
| MacBook Apple M4, 16 GB (otro equipo) | Edge 155 | **Se cuelga** |
| PC con Windows, 4 GB | Chrome | Se colgaba con la descarga «completa» en memoria; no se pudo volver a probar con la lectura por trozos |
| Chromium y WebKit sin cabeza (pruebas automáticas) | — | Funciona |

### Lo que el diagnóstico (`web/diag.html`) dijo del MacBook que falla

```
navegador: … Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0  (Intel Mac OS X 10_15_7 en el UA)
memoria (deviceMemory): 16 GB · núcleos: 10 · plataforma: MacIntel
aislamiento de origen (SharedArrayBuffer): true · crossOriginIsolated: true
OK WebAssembly disponible
OK WebGL: ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)
OK AudioContext: suspended · 48000 Hz
OK almacén local (OPFS): disponible · createWritable: function · createSyncAccessHandle: undefined
cuota: 11212 MB · usado: 972 MB
motor: HTTP 200 · application/wasm · descargado 11 MB · compilado al instante
```

Todo correcto. **No se llegó a obtener** del equipo que falla:

- la línea de **integridad** de la copia local (`diag.html` la calcula al final, SHA-256 de los 128 ficheros);
- la prueba del **motor sin juego** (abrir solo el lanzador de ScummVM);
- el registro de consola **hasta el momento del cuelgue** con las versiones actuales.

### Hipótesis (ordenadas por probabilidad, a confirmar)

1. **Copia local corrupta o a medias en el almacén del navegador.** Ese equipo había hecho muchos intentos con
   versiones anteriores (972 MB usados en OPFS = dos copias). Si un fichero quedó truncado o con contenido de otra
   versión, el motor puede entrar en un bucle al leerlo. Comprobar con la integridad de `diag.html` y probar con
   `?svmfresh=1`.
2. **Bloqueo del hilo principal por las lecturas síncronas.** Cada trozo es un XHR síncrono sobre `blob:`. En
   condiciones normales tarda milisegundos; si en ese equipo el acceso a OPFS/Blob es lento (antivirus, disco, modo
   de energía), cientos de lecturas seguidas pueden congelar la página. Probar `?svmmode=mem` (todo en memoria, sin
   lecturas por trozos) en ese equipo: si funciona, es esto.
3. **Interacción con el audio.** El callback de audio de SDL (ScriptProcessorNode) corre en el hilo principal; si
   coincide con lecturas síncronas largas podría bloquearse. Probar silenciando el audio (ver ideas abajo).
4. **WebGL/Metal en ese equipo.** Probar `?svmgfx=soft` (render de SDL por software, sin WebGL). Ya se probó sin
   éxito en ese equipo, así que es poco probable.
5. **Extensiones del navegador** que inspeccionan cada petición (los XHR síncronos se multiplican). Probar en una
   ventana InPrivate sin extensiones.

### Cómo ayudar con este problema

1. Si tu equipo se cuelga, abre `diag.html`, espera al final y comparte una captura (sin datos personales).
2. Prueba, por este orden, y di cuál funciona:
   `index.html?svmfresh=1`, `index.html?svmmode=mem`, `index.html?svmmode=slice`, `index.html?svmgfx=soft`.
3. Si sabes perfilar: graba un perfil de rendimiento de 20 s tras pulsar «Jugar» (DevTools → Performance) y comparte
   dónde se queda el hilo principal.

### Ideas sin probar

- Mover el motor a un Worker con `OffscreenCanvas` (`-sPROXY_TO_PTHREAD` u otro esquema): el hilo principal no se
  bloquearía nunca. Requiere cambios en el backend SDL de ScummVM para Emscripten.
- Leer los trozos con un `FileReaderSync` dentro de un Worker auxiliar y pasarlos por `SharedArrayBuffer` +
  `Atomics.wait` (sin XHR síncrono en el hilo principal).
- Usar la variante con JSPI (`-sJSPI`) en lugar de Asyncify, donde el navegador la soporte, y volver a lecturas
  asíncronas.
- Un `AudioWorklet` en lugar del `ScriptProcessorNode` de SDL.

## 2. Problemas menores

- **Portada sobre lienzo negro.** Con WebGL, `drawImage` del lienzo puede devolver negro aunque se vea
  (`preserveDrawingBuffer=false`); la portada usa un tope de 25 s. Mejor sería una señal real del motor («primera
  escena pintada»).
- **Avisos de fuentes del tema «remastered»** de la interfaz de ScummVM (faltan TTF porque no se compila freetype).
  Inofensivo; el `.ini` fija `gui_theme=scummmodern`.
- **Sin teclado en pruebas sin cabeza.** En Chromium sin cabeza las teclas no llegan al juego (foco de ventana); el
  ratón sí. En navegadores reales funciona.
- **Motor del PR en desarrollo.** El motor `hollywood` está marcado como inestable (`ADGF_UNSTABLE`). Los fallos del
  propio juego (escenas, diálogos) deben reportarse en el PR de ScummVM, no aquí.
