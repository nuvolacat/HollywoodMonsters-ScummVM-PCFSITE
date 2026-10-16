# Publicarlo en un servidor

Todo es estático: basta un servidor web que sirva la carpeta `web/`.

## 1. Preparar

1. Coloca los datos de **tu** copia del juego en `web/scummvm/data/games/hollywood/` y genera el índice
   (ver [DATOS.md](DATOS.md)).
2. Si los datos van en otro sitio (otra carpeta, una CDN), ajusta `dataBase` y `dataSuffix` en `web/config.js` y
   copia allí también `index.json` y `hashes.json`. La URL debe ser del mismo origen o permitir CORS con la
   cabecera `Range`.

## 2. Servir `web/` como raíz

ScummVM tiene compilada la ruta absoluta `/scummvm/data/` (DATA_PATH). Opciones:

- **Raíz del sitio** (lo más sencillo): `https://tu-dominio/` → `web/`.
- **Subcarpeta**: reescribe `/scummvm/` hacia tu subcarpeta en el servidor, o recompila cambiando DATA_PATH
  ([COMPILAR.md](COMPILAR.md)).

## 3. Cabeceras

| Qué | Valor |
|---|---|
| Tipo de `.wasm` | `application/wasm` |
| `Accept-Ranges` en los datos del juego | `bytes` (lo hace cualquier servidor de ficheros estáticos) |
| Caché del motor (`scummvm-<N>.*`) y de los datos del juego | `public, max-age=31536000, immutable` |
| Caché de `index.html`, `player.js`, `config.js`, `svm-worker.js` | `no-cache` (o pocos minutos) |
| Compresión | gzip/brotli para `.js` y `.wasm`; los datos del juego no ganan nada |

No hace falta `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`.

Si usas **Content-Security-Policy**, como mínimo:

```
script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self' blob:; img-src 'self' data: blob:
```

(añade el origen de los datos a `connect-src` si están en otro dominio). El reproductor no usa scripts en línea.

### Ejemplo nginx

```nginx
server {
    root /srv/hollywood/web;
    types { application/wasm wasm; }
    location /scummvm/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
    location ~ ^/(index\.html|player\.js|config\.js|svm-worker\.js)?$ { add_header Cache-Control "no-cache"; }
}
```

## 4. Actualizar el motor

Cada compilación nueva con un número nuevo (`scummvm-7.*`) y `engineVersion: 7` en `config.js`. No sobrescribas
nunca `scummvm-6.*` con otra compilación: con caché inmutable, un navegador podría mezclar el `.js` viejo con el
`.wasm` nuevo (ver [REPRODUCTOR.md](REPRODUCTOR.md#versiones-del-motor)).

## 5. CDN

- Si la CDN solo cachea ciertas extensiones, sube los datos con sufijo (`RESOURCE.004.bin`) y pon
  `dataSuffix: ".bin"`.
- Algunas CDN no respetan `Range` en ficheros grandes no cacheados todavía. El reproductor descarga cada fichero
  entero a la copia local del navegador, así que solo el modo de lectura directa por red lo necesitaría.
- `RESOURCE.004` pesa 265 MB: comprueba el tamaño máximo de fichero cacheable de tu CDN.
