# Datos del juego

**Este repositorio no contiene ni contendrá nunca los datos del juego** (ficheros `RESOURCE.*`, `MONSTERS.EXE`, la
imagen del CD…). Son obra protegida. Cada persona usa los de su propio CD original. El `.gitignore` excluye la
carpeta donde se colocan.

## Edición probada

- **Hollywood Monsters, 2ª edición, en español, para Windows** (Dinamic Multimedia).
- El CD es **mixto**: una pista de datos ISO 9660 y dos pistas de audio. Solo hace falta la pista de datos.
- De ese CD se usa únicamente la carpeta **`MONSTERS`** (128 ficheros, ~486 MB). No hace falta instalar nada: el
  motor de ScummVM lee directamente esa carpeta.

## Cómo obtener la carpeta

1. Mete el CD (o monta la imagen que tú mismo hayas hecho de tu disco: `.iso`, `.bin/.cue`, `.mdf/.mds`…). En
   imágenes mixtas, monta la pista de datos.
2. Copia la carpeta `MONSTERS` completa a `web/scummvm/data/games/hollywood/` (los ficheros directamente dentro, sin
   subcarpeta).
3. Genera el índice y las huellas:

   ```sh
   python3 tools/make-index.py web/scummvm/data/games/hollywood web/scummvm/data/games/hollywood
   ```

   Crea `index.json` (nombre → tamaño, lo necesitan el reproductor y el sistema de ficheros HTTP de ScummVM) y
   `hashes.json` (tamaño, MD5 y SHA-256, para `diag.html`).

## Cómo reconoce ScummVM tu copia

El motor identifica el juego con el MD5 de los **primeros 5000 bytes** y el tamaño total de tres ficheros
(`engines/hollywood/detection.cpp`, entrada «Spanish Windows full game, installed MONSTERS directory»):

| Fichero | MD5 (primeros 5000 bytes) | Tamaño |
|---|---|---|
| `MONSTERS.EXE` | `5b097e04e6ca7225d9dea6cd99909f6d` | 1.431.552 |
| `RESOURCE.000` | `bf580b6b3eedf45e427bb83ab29ccd21` | 4.320.424 |
| `RESOURCE.003` | `352126965c51832ce970faece65cc2f8` | 9.444.153 |

Si al arrancar la consola muestra `Running Hollywood Monsters (Windows/Spanish)` y estas tres líneas con los mismos
valores, la copia es la correcta.

El PR también reconoce: la 1ª edición española de Windows, la edición italiana de Windows, la versión DOS en CD y las
demos (española DOS e italiana Windows). Solo la 2ª edición española de Windows se ha probado en este proyecto.

## Manifiesto de referencia

`docs/manifest/hashes-hollywood-2a-edicion-es.json` lista los 128 ficheros de la copia probada con tamaño, MD5 y
SHA-256 completos. Sirve para comparar tu copia (no contiene datos del juego, solo huellas):

```sh
python3 tools/make-index.py /ruta/a/MONSTERS /tmp/mio
diff <(python3 -m json.tool --sort-keys /tmp/mio/hashes.json) \
     <(python3 -m json.tool --sort-keys docs/manifest/hashes-hollywood-2a-edicion-es.json)
```

Ficheros más grandes: `RESOURCE.004` (265 MB, gráficos), `RESOURCE.003` (9,4 MB), `RESOURCE.000` (4,3 MB) y las
familias `RESOURCE.A..`–`RESOURCE.S..` (escenas, sonido y voces).

## Nota sobre CDN

Si sirves los datos desde una CDN que solo cachea ciertas extensiones, puedes subir cada fichero con un sufijo
(`RESOURCE.004.bin`) y poner `dataSuffix: ".bin"` en `web/config.js`. El índice (`index.json`) sigue con los nombres
originales.
