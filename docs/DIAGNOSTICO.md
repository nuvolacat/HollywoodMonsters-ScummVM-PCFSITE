# Diagnóstico (`web/diag.html`)

Página para saber por qué el juego no funciona en un equipo concreto. No arranca el juego: solo comprueba el
navegador, el motor y la copia local de los datos.

## Qué comprueba

1. **Navegador**: agente de usuario, memoria (`deviceMemory`), núcleos, aislamiento de origen.
2. **WebAssembly**, **WebGL** (con el nombre de la GPU), **AudioContext**.
3. **Almacén local (OPFS)**: si existe, si tiene `createWritable` y `createSyncAccessHandle` (este último solo
   existe dentro de Workers, así que en la página sale `undefined` y es normal), cuota y espacio usado.
4. **Motor**: descarga `scummvm-<N>.wasm`, muestra estado HTTP, tipo y tamaño, y lo compila midiendo el tiempo.
5. **Integridad de la copia local**: unos segundos después, lee cada fichero del almacén local y compara tamaño y
   SHA-256 con `hashes.json`. Termina con una línea como:

   ```
   integridad: 128 correctos · 0 corruptos · 0 faltan
   ```

## Cómo leer el resultado

| Resultado | Qué significa | Qué hacer |
|---|---|---|
| `FALLO WebAssembly` / `WebGL no disponible` | El navegador no sirve | Otro navegador o activar la aceleración por hardware |
| `almacén local (OPFS): …error…` | Ventana privada o almacenamiento bloqueado | Ventana normal; permitir datos del sitio |
| Cuota muy baja (< 1 GB) | No cabe la copia del juego (~486 MB) | Liberar espacio del disco |
| `motor: HTTP 404` | Falta `scummvm-<N>.wasm` o `engineVersion` mal puesto | Revisar `config.js` |
| `motor compilado` tarda > 10 s | Equipo lento | El juego también irá lento |
| `no hay copia local` | Aún no se ha pulsado «Jugar» nunca | Normal |
| `faltan` > 0 | La descarga se interrumpió | Volver a «Jugar»: completa lo que falta |
| `corruptos` > 0 | Copia local dañada | `index.html?svmfresh=1` |

## Si tu equipo se cuelga

Ver [PROBLEMAS.md](PROBLEMAS.md#cómo-ayudar-con-este-problema): captura completa de `diag.html` y prueba de las
variantes de URL. Antes de compartir la captura, recorta lo que no quieras enseñar.
